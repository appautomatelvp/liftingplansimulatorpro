/**
 * dynamics — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 *
 * REAL-WORLD ENVIRONMENT & HOIST DYNAMICS LAYER
 * ----------------------------------------------
 *  1. Atmospheric wind field
 *     - Mean wind with power-law height shear (open terrain, α = 0.14)
 *     - Stochastic turbulence: Ornstein–Uhlenbeck process per axis (Davenport-type
 *       intensity I = σ/V), deterministic PRNG so every run is reproducible
 *     - Optional gust envelope (+30 % peaks, IEC 61400-1 style coherent gust)
 *  2. Rigid-body aerodynamics
 *     - Box (cargo) relative-wind drag per face: F = ½ ρ Cd A_i |u_i| u_i
 *     - Force acts at the geometric pressure centre → real torque on an
 *       eccentric-CoG load (wind-induced tilt), plus rotational drag damping
 *     - Cylinder drag on spreader / lifting beams
 *  3. Elastic hoist system (crane ↔ hook block)
 *     - Hoist wire-rope axial stiffness k = n_parts · E·A / L_rope in series with
 *       boom / girder structural stiffness → real dynamic amplification (DAF)
 *       at pick-up, snatch and cable failure (EN 13001-2 φ2 behaviour)
 *     - Hook block is a true dynamic body inside the cable solver (mass from
 *       gear catalogue) so hook bounce and load share are two-way coupled
 *     - Pendulum sway of the hook under the boom tip (T/L restoring) when a
 *       crane with a defined suspension point is active
 *  4. Gyroscopic (Euler equation) coupling  I·ω̇ = τ − ω × (I·ω)  for tumbling
 *     cargo / beams, solved with one implicit Newton step (unconditionally stable)
 */
        const AIR_DENSITY = 1.225; // kg/m³ at 15 °C sea level
        const CD_SHARP_BOX = 1.15;  // EN 1991-1-4 sharp-edged prism, moderate aspect ratio
        const CD_CYLINDER = 1.00;   // sub-critical Re round member
        const WIND_SHEAR_ALPHA = 0.14; // power-law exponent, open terrain
        const WIND_REF_HEIGHT = 10.0;  // m (anemometer reference)

        // --- 1. WIND FIELD ------------------------------------------------------

        function windConfig() {
            if (!state.wind) {
                state.wind = {
                    enabled: true,
                    speedMps: 3.5,
                    dirDeg: 0,
                    gust: false,
                    turbulenceIntensity: 0.16,
                    baseSpeedMps: 3.5,
                    vary: true
                };
            }
            if (state.wind.baseSpeedMps == null) state.wind.baseSpeedMps = state.wind.speedMps || 3.5;
            if (state.wind.vary == null) state.wind.vary = true;
            return state.wind;
        }

        function weatherConfig() {
            if (!state.weather) {
                state.weather = { rainMmH: 0, rainBaseMmH: 0, wetFactor: 0 };
            }
            if (state.weather.rainBaseMmH == null) {
                state.weather.rainBaseMmH = state.weather.rainMmH || 0;
            }
            return state.weather;
        }

        /**
         * Slow weather drift around UI setpoints so wind/rain feel alive.
         * Live speedMps / rainMmH are what the solver and FX consume.
         */
        function stepWeatherModulation(dt) {
            const cfg = windConfig();
            const wx = weatherConfig();
            if (!phy.weatherMod) {
                phy.weatherMod = { t: 0, windMul: 1, rainMul: 1, burst: 0 };
            }
            const mod = phy.weatherMod;
            mod.t += dt;
            if (cfg.vary === false) {
                cfg.speedMps = Math.max(0, cfg.baseSpeedMps != null ? cfg.baseSpeedMps : cfg.speedMps);
                wx.rainMmH = Math.max(0, wx.rainBaseMmH != null ? wx.rainBaseMmH : wx.rainMmH);
                mod.windMul = 1;
                mod.rainMul = 1;
            } else {
                const baseW = Math.max(0, cfg.baseSpeedMps != null ? cfg.baseSpeedMps : (cfg.speedMps || 0));
                const baseR = Math.max(0, wx.rainBaseMmH != null ? wx.rainBaseMmH : (wx.rainMmH || 0));
                const slow = 0.22 * Math.sin(mod.t * 0.11) + 0.14 * Math.sin(mod.t * 0.29 + 1.7);
                const pulse = 0.18 * Math.max(0, Math.sin(mod.t * 0.55)) ** 2;
                mod.burst = THREE.MathUtils.lerp(mod.burst || 0, pulse, Math.min(1, dt * 1.2));
                mod.windMul = THREE.MathUtils.clamp(1 + slow + mod.burst * (cfg.gust ? 1.35 : 0.85), 0.35, 2.1);
                mod.rainMul = THREE.MathUtils.clamp(1 + 0.35 * Math.sin(mod.t * 0.19 + 0.4) + 0.45 * mod.burst, 0.2, 2.4);
                cfg.speedMps = baseW * mod.windMul;
                wx.rainMmH = baseR * mod.rainMul;
                cfg.turbulenceIntensity = THREE.MathUtils.clamp(
                    0.12 + Math.min(0.28, (cfg.speedMps || 0) / 80),
                    0.10,
                    0.42
                );
            }
            const targetWet = THREE.MathUtils.clamp((wx.rainMmH || 0) / 55, 0, 1);
            wx.wetFactor = THREE.MathUtils.lerp(wx.wetFactor || 0, targetWet, Math.min(1, dt / 8));
            return mod;
        }

        function windFieldState() {
            if (!phy.windField) {
                phy.windField = {
                    t: 0,
                    u: 0, v: 0, w: 0,         // turbulent fluctuations (m/s), world frame-aligned to mean wind
                    gustPhase: 0,
                    meanVec: new THREE.Vector3(),
                    vec: new THREE.Vector3(),
                    speedNow: 0
                };
            }
            return phy.windField;
        }

        function gaussianRandom() {
            // Box–Muller on the deterministic mulberry32 stream
            let u1 = simRandom();
            if (u1 < 1e-12) u1 = 1e-12;
            const u2 = simRandom();
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        }

        /**
         * Advances the stochastic wind field by dt seconds.
         * OU process: du = -(u/T) dt + σ sqrt(2/T) dW, stationary σ_u = I·V.
         */
        function stepWindField(dt) {
            stepWeatherModulation(dt);
            const cfg = windConfig();
            const wf = windFieldState();
            wf.t += dt;
            const V = Math.max(0, cfg.enabled === false ? 0 : (cfg.speedMps || 0));
            if (V <= 0.01) {
                wf.u = wf.v = wf.w = 0;
                wf.meanVec.set(0, 0, 0);
                wf.vec.set(0, 0, 0);
                wf.speedNow = 0;
                return wf;
            }
            const I = THREE.MathUtils.clamp(cfg.turbulenceIntensity != null ? cfg.turbulenceIntensity : 0.16, 0, 0.6);
            // Integral time scale ~ L_u / V with L_u ≈ 25 m at lifting heights (Kaimal-like)
            const T_u = THREE.MathUtils.clamp(25.0 / V, 1.5, 12.0);
            const sigU = I * V;
            const sigV = 0.8 * sigU;   // lateral ≈ 0.8 σ_u (IEC)
            const sigW = 0.5 * sigU;   // vertical ≈ 0.5 σ_u
            const a = Math.exp(-dt / T_u);
            const q = Math.sqrt(Math.max(0, 1 - a * a));
            wf.u = wf.u * a + sigU * q * gaussianRandom();
            wf.v = wf.v * a + sigV * q * gaussianRandom();
            wf.w = wf.w * a + sigW * q * gaussianRandom();

            // Coherent gust envelope: smooth bursts with +30 % peak every ~11 s
            let gustGain = 0;
            if (cfg.gust) {
                const T_g = 11.0;
                wf.gustPhase += dt / T_g;
                const s = Math.max(0, Math.sin(2 * Math.PI * wf.gustPhase));
                gustGain = 0.30 * s * s * s;
            }
            const dir = THREE.MathUtils.degToRad(cfg.dirDeg || 0);
            const ex = Math.cos(dir), ez = Math.sin(dir);
            const meanSpeed = V * (1 + gustGain);
            wf.meanVec.set(ex * meanSpeed, 0, ez * meanSpeed);
            // Turbulence: u along mean, v lateral (horizontal), w vertical
            wf.vec.set(
                ex * (meanSpeed + wf.u) - ez * wf.v,
                wf.w,
                ez * (meanSpeed + wf.u) + ex * wf.v
            );
            wf.speedNow = wf.vec.length();
            return wf;
        }

        /** Wind velocity vector (m/s, world) at height y, including power-law shear. */
        function windVectorAt(y) {
            const wf = windFieldState();
            if (wf.speedNow <= 1e-6 && wf.vec.lengthSq() < 1e-12) return new THREE.Vector3();
            const z = Math.max(2.0, y || 2.0);
            const shear = Math.pow(z / WIND_REF_HEIGHT, WIND_SHEAR_ALPHA);
            return wf.vec.clone().multiplyScalar(shear);
        }

        // --- 2. AERODYNAMICS -----------------------------------------------------

        /**
         * Relative-wind drag on an oriented box.  Returns force (N, world) and the
         * projected area actually exposed to the relative flow.
         */
        function aeroBoxForce(dims, quat, vRel) {
            const { L, W, H } = dims;
            const speed = vRel.length();
            const out = { force: new THREE.Vector3(), area: 0 };
            if (speed < 1e-4) return out;
            const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
            const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
            const az = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
            const faces = [
                { n: ax, A: H * W },
                { n: ay, A: L * W },
                { n: az, A: L * H }
            ];
            let projected = 0;
            faces.forEach(f => {
                const u = vRel.dot(f.n);
                if (Math.abs(u) < 1e-6) return;
                const Fmag = 0.5 * AIR_DENSITY * CD_SHARP_BOX * f.A * Math.abs(u) * u;
                out.force.addScaledVector(f.n, Fmag);
                projected += f.A * Math.abs(u) / speed;
            });
            out.area = projected;
            return out;
        }

        /**
         * Quadratic rotational air damping torque of a box, per local axis:
         *   τ_i = −ρ Cd ω_i|ω_i| · Σ(b · a⁴ / 64)  over the two plate faces swept by that rotation.
         */
        function aeroBoxRotTorque(dims, quat, omega) {
            const { L, W, H } = dims;
            const invQ = quat.clone().invert();
            const wb = omega.clone().applyQuaternion(invQ);
            const Kx = L * (Math.pow(W, 4) + Math.pow(H, 4)) / 64;
            const Ky = H * (Math.pow(L, 4) + Math.pow(W, 4)) / 64;
            const Kz = W * (Math.pow(L, 4) + Math.pow(H, 4)) / 64;
            const c = AIR_DENSITY * CD_SHARP_BOX;
            const tb = new THREE.Vector3(
                -c * Kx * Math.abs(wb.x) * wb.x,
                -c * Ky * Math.abs(wb.y) * wb.y,
                -c * Kz * Math.abs(wb.z) * wb.z
            );
            return tb.applyQuaternion(quat);
        }

        function aeroTelemetry() {
            if (!phy.wind) {
                phy.wind = {
                    forceN: 0,
                    force: new THREE.Vector3(),
                    speedMps: 0,
                    vector: new THREE.Vector3(),
                    projectedAreaM2: 0,
                    driftDeg: 0,
                    rainForceN: 0,
                    rainMmH: 0,
                    _accF: new THREE.Vector3(),
                    _accRain: 0,
                    _accN: 0
                };
            }
            return phy.wind;
        }

        /**
         * Rain momentum load on cargo: downward impact on roof + wind-driven slant
         * on the windward face. Scales with rainfall rate (mm/h) and wetness.
         */
        function cargoRainForceN(dims, quat, windVec) {
            const wx = weatherConfig();
            const rainMmH = Math.max(0, wx.rainMmH || 0);
            if (rainMmH < 0.2) return new THREE.Vector3();
            const flux = (rainMmH / 1000) / 3600; // m³/(m²·s)
            const vTerm = 8.5; // m/s typical large-drop terminal speed
            const rhoW = 1000;
            const roofA = Math.max(0.2, (dims.L || 1) * (dims.W || 1));
            // Momentum flux onto roof (near-vertical component)
            // Training-visible rain load (true momentum flux is tiny vs 20–40 t cargo)
            const Fdown = rhoW * flux * roofA * vTerm * 12;
            const force = new THREE.Vector3(0, -Fdown, 0);
            // Wind-driven rain: horizontal component on windward faces
            const windH = windVec.clone();
            windH.y = 0;
            const wh = windH.length();
            if (wh > 0.4) {
                const sideA = Math.max(0.2, (dims.L || 1) * (dims.H || 1) * 0.55
                    + (dims.W || 1) * (dims.H || 1) * 0.45);
                const Fh = rhoW * flux * sideA * Math.min(wh, 22) * 6.5;
                force.addScaledVector(windH.normalize(), Fh);
            }
            const wet = wx.wetFactor || 0;
            if (wet > 0.05) force.y -= wet * roofA * 120;
            return force;
        }

        /**
         * Applies wind + rain + motion-relative aerodynamic impulses to the cargo body.
         * @param {number} dt substep
         * @param {THREE.Vector3} vCom   centre-of-mass velocity (mutated)
         * @param {THREE.Vector3} omega  angular velocity (mutated)
         * @param {number} invMass
         * @param {Object} invI inverse inertia (local diag)
         * @param {THREE.Vector3} rCogWorld vector from geometric centre to CoG (world)
         */
        /** Training gain: suspended loads need stronger aero to be visually readable. */
        function weatherLiftGain() {
            const wx = weatherConfig();
            const g = wx.liftForceGain != null ? wx.liftForceGain : 5.5;
            const airborne = !state.poseLock && (phy.groundClearance || 0) > 0.08;
            return airborne ? Math.max(1, g) : 1;
        }

        function applyCargoAerodynamics(dt, vCom, omega, invMass, invI, rCogWorld) {
            const dims = { L: state.L, W: state.W, H: state.H };
            const com = cargoComNow();
            const wind = windVectorAt(com.y);
            const vRel = wind.clone().sub(vCom);
            const { force, area } = aeroBoxForce(dims, phy.cargoQuat, vRel);
            // Wet cargo: slightly higher Cd (film / rivulets)
            const wet = (weatherConfig().wetFactor || 0);
            if (wet > 0.02) force.multiplyScalar(1 + 0.18 * wet);

            const rainF = cargoRainForceN(dims, phy.cargoQuat, wind);
            force.add(rainF);

            const gain = weatherLiftGain();
            if (gain > 1.01) {
                force.multiplyScalar(gain);
                rainF.multiplyScalar(gain);
            }

            // Pressure centre = geometric box centre; lever from CoG = −rCog
            const lever = rCogWorld.clone().negate();
            const torque = new THREE.Vector3().crossVectors(lever, force);
            torque.add(aeroBoxRotTorque(dims, phy.cargoQuat, omega));
            if (gain > 1.01) torque.multiplyScalar(Math.min(gain, 4));

            // Impulse integration — allow a clearer kick while suspended so sway is visible.
            const dv = force.clone().multiplyScalar(invMass * dt);
            const vRelMag = Math.max(vRel.length(), rainF.length() * invMass * 4);
            const dvCap = (gain > 1.01 ? 1.35 : 0.5) * vRelMag + (gain > 1.01 ? 0.12 : 0.04);
            if (dv.length() > dvCap) dv.setLength(dvCap);
            vCom.add(dv);
            const dw = alphaFromTorque(torque.clone().multiplyScalar(dt), phy.cargoQuat, invI);
            const wMag = omega.length();
            const dwCap = (gain > 1.01 ? 0.9 : 0.5) * wMag + (gain > 1.01 ? 0.04 : 0.01);
            if (dw.length() > dwCap) dw.setLength(dwCap);
            omega.add(dw);

            const tel = aeroTelemetry();
            tel._accF.add(force);
            tel._accRain = (tel._accRain || 0) + rainF.length();
            tel._accN += 1;
            tel.vector.copy(wind);
            tel.speedMps = wind.length();
            tel.projectedAreaM2 = area;
            tel.rainMmH = weatherConfig().rainMmH || 0;
            tel.liftGain = gain;
        }

        /** HUD/FX while pose-locked (no XPBD): publish wind/rain estimates without moving cargo. */
        function publishSeatedWeatherTelemetry() {
            const dims = { L: state.L || 6, W: state.W || 2.4, H: state.H || 2.6 };
            const y = (phy.cargoPos && phy.cargoPos.y) || 2;
            const wind = windVectorAt(y);
            const q = phy.cargoQuat || new THREE.Quaternion();
            const { force, area } = aeroBoxForce(dims, q, wind.clone());
            const rainF = cargoRainForceN(dims, q, wind);
            force.add(rainF);
            const tel = aeroTelemetry();
            tel.force.copy(force);
            tel.forceN = force.length();
            tel.rainForceN = rainF.length();
            tel.vector.copy(wind);
            tel.speedMps = wind.length();
            tel.projectedAreaM2 = area;
            tel.rainMmH = weatherConfig().rainMmH || 0;
            tel.driftDeg = 0;
            tel.liftGain = 1;
        }
        if (typeof window !== 'undefined') {
            window.publishSeatedWeatherTelemetry = publishSeatedWeatherTelemetry;
        }

        /** Wind + motion drag on a spreader / lifting beam modelled as a cylinder. */
        function applyBeamAerodynamics(dt, b) {
            if (!b || !b.v || !(b.invMass > 0)) return;
            const wind = windVectorAt(b.x.y);
            const vRel = wind.clone().sub(b.v);
            const speed = vRel.length();
            if (speed < 1e-4) return;
            const axis = new THREE.Vector3(b.axis === 'z' ? 0 : 1, 0, b.axis === 'z' ? 1 : 0).applyQuaternion(b.q);
            const vPerp = vRel.clone().addScaledVector(axis, -vRel.dot(axis));
            const vp = vPerp.length();
            if (vp < 1e-4) return;
            const diameter = 2 * (b.radius || 0.12);
            const area = Math.max(0.2, b.length || 1.0) * diameter;
            const gain = weatherLiftGain();
            const F = 0.5 * AIR_DENSITY * CD_CYLINDER * area * vp * vp * gain;
            const dv = vPerp.multiplyScalar((F / vp) * b.invMass * dt);
            const cap = (gain > 1.01 ? 1.2 : 0.5) * vp + (gain > 1.01 ? 0.08 : 0.02);
            if (dv.length() > cap) dv.setLength(cap);
            b.v.add(dv);
        }

        /** Finalises per-frame wind telemetry (average force over the substeps). */
        function publishAeroTelemetry() {
            const tel = aeroTelemetry();
            if (tel._accN > 0) {
                tel.force.copy(tel._accF).multiplyScalar(1 / tel._accN);
                tel.rainForceN = (tel._accRain || 0) / tel._accN;
            } else {
                tel.force.set(0, 0, 0);
                tel.rainForceN = 0;
            }
            tel.forceN = tel.force.length();
            tel.rainMmH = weatherConfig().rainMmH || 0;
            tel._accF.set(0, 0, 0);
            tel._accRain = 0;
            tel._accN = 0;
            // Measured drift: inclination of hook→CoG line from vertical (what a
            // banksman actually sees), not a static estimate.
            const com = cargoComNow();
            const master = attachWorld({ kind: 'hook' });
            const dx = com.x - master.x, dz = com.z - master.z, dy = master.y - com.y;
            tel.driftDeg = dy > 0.3 && (phy.groundClearance || 0) > 0.05
                ? THREE.MathUtils.radToDeg(Math.atan2(Math.hypot(dx, dz), dy))
                : 0;
            return tel;
        }

        // --- 3. GYROSCOPIC COUPLING -----------------------------------------------

        /**
         * One implicit Newton step of  I(ω' − ω) + dt · ω' × (I ω') = 0  in the body frame
         * (Catto 2015).  Conserves angular momentum magnitude much better than the
         * explicit form and never blows up.  Only meaningful when the inertia tensor
         * is anisotropic and the body actually tumbles.
         */
        function applyGyroscopicTerm(omega, quat, invI, dt) {
            const wMag = omega.length();
            if (!(wMag > 0.02)) return;
            const Ix = 1 / Math.max(1e-9, invI.Ixx);
            const Iy = 1 / Math.max(1e-9, invI.Iyy);
            const Iz = 1 / Math.max(1e-9, invI.Izz);
            const invQ = quat.clone().invert();
            const w = omega.clone().applyQuaternion(invQ);
            const Lx = Ix * w.x, Ly = Iy * w.y, Lz = Iz * w.z;
            // f(ω) = dt · ω × Iω  (residual with ω' = ω guess)
            const f = new THREE.Vector3(
                dt * (w.y * Lz - w.z * Ly),
                dt * (w.z * Lx - w.x * Lz),
                dt * (w.x * Ly - w.y * Lx)
            );
            // Jacobian J = I + dt · (skew(ω) I − skew(Iω))
            const J = [
                [Ix,                        dt * (-w.z * Iy + Lz),      dt * (w.y * Iz - Ly)],
                [dt * (w.z * Ix - Lz),      Iy,                         dt * (-w.x * Iz + Lx)],
                [dt * (-w.y * Ix + Ly),     dt * (w.x * Iy - Lx),       Iz]
            ];
            const sol = solve3(J, [-f.x, -f.y, -f.z]);
            if (!sol) return;
            const dw = new THREE.Vector3(sol[0], sol[1], sol[2]);
            // Guard: a Newton step may not change |ω| by more than 25 % per substep
            if (dw.length() > 0.25 * wMag) dw.setLength(0.25 * wMag);
            w.add(dw);
            omega.copy(w.applyQuaternion(quat));
        }

        // --- 4. ELASTIC HOIST SYSTEM ------------------------------------------------

        function hoistConfig() {
            if (!state.hoistDynamics) {
                state.hoistDynamics = {
                    elastic: 'auto',     // 'auto' = rope + boom compliance only on real cranes (hook_only = rigid test crown)
                    sway: 'auto',        // 'auto' = pendulum sway only on real cranes, true/false to force
                    dampingRatio: 0.06,  // rope + structure modal damping
                    swayDampingRatio: 0.05
                };
            }
            return state.hoistDynamics;
        }

        function hoistState() {
            if (!phy.hoist) {
                phy.hoist = {
                    kin: phy.hookPos.clone(),        // winch-driven suspension point (drum/boom tip projected)
                    off: new THREE.Vector3(),        // physical hook offset from kin (stretch < 0 in y)
                    offLP: new THREE.Vector3(),      // quasi-static part absorbed by the operator (slow)
                    vel: new THREE.Vector3(),        // velocity of `off`
                    massKg: 440,
                    inertiaKg: 3900,
                    kRope: 1e7,
                    kStruct: 2.5e7,
                    k: 7e6,
                    ropeLenM: 14,
                    parts: 8,
                    topY: 24,
                    tensionN: 0,
                    tensionLP: 0,
                    staticLoadN: 0,
                    daf: 1,
                    dafPeak: 1,
                    swayActive: false,
                    stretchMm: 0,
                    winchSpeed: 0                    // current drum line speed (m/s), ramp-limited
                };
            }
            return phy.hoist;
        }

        function hoistSwayEnabled() {
            const cfg = hoistConfig();
            if (cfg.sway === true) return true;
            if (cfg.sway === false) return false;
            return !!(state.craneType && state.craneType !== 'hook_only');
        }

        /** World Y of the hoist rope suspension point (sheave crown / boom nose / girder trolley). */
        function hoistSuspensionTopY(kin) {
            const parts = (typeof craneDynamicParts !== 'undefined' && craneDynamicParts) ? craneDynamicParts : {};
            if (parts.type === 'gantry' || parts.type === 'bridge_gantry') return parts.girderY;
            if (parts.type === 'custom_static') return parts.topY;
            if (parts.type === 'slewing_telescopic' && parts.slewOrigin) {
                const dx = kin.x - parts.slewOrigin.x;
                const dz = kin.z - parts.slewOrigin.z;
                const horizFromPivot = Math.max(2.5, Math.hypot(dx, dz) - parts.pivotLocal.z);
                const clampedR = Math.min(parts.boomLen * 0.90, horizFromPivot);
                const tilt = Math.asin(clampedR / parts.boomLen);
                return parts.slewOrigin.y + parts.pivotLocal.y + parts.boomLen * Math.cos(tilt);
            }
            if (parts.type === 'slewing' && parts.basePos) {
                const dx = kin.x - parts.basePos.x;
                const dz = kin.z - parts.basePos.z;
                const clampedR = Math.min(parts.boomLen * 0.92, Math.max(2.5, Math.hypot(dx, dz)));
                const tilt = Math.asin(clampedR / parts.boomLen);
                return parts.basePos.y + parts.boomLen * Math.cos(tilt);
            }
            return 24.0;
        }

        /** Boom / girder tip vertical stiffness by crane family (N/m). */
        function hoistStructureStiffness() {
            const t = state.craneType || 'hook_only';
            if (t === 'mobile_telescopic' || t === 'harbour' || t === 'portal_harbour') return 2.2e6;  // long telescopic boom
            if (t === 'crawler') return 4.5e6;                                                          // lattice boom
            if (t === 'gantry' || t === 'rtg' || t === 'sts_crane_glb') return 1.8e7;                   // box girder
            if (t === 'hook_only') return 2.5e7;                                                        // rigid test crown
            return 6e6;
        }

        /** Refreshes rope length, reeving and stiffness from the live geometry. */
        function updateHoistParameters(h) {
            const hookGear = (state.gear && state.gear.hook) || {};
            const swl = Math.max(5, hookGear.swlT || 65);
            // Reeving: parts of line so that single-line pull stays ≈ 9 t (typical drum rating)
            h.parts = THREE.MathUtils.clamp(Math.round(swl / 9), 2, 12);
            // Rope diameter from line pull: d ≈ sqrt(linePull_t / 0.0356) at 1960 MPa, SF 5
            const linePullT = swl / h.parts;
            const diaMm = THREE.MathUtils.clamp(Math.round(Math.sqrt(linePullT * 5 / (1.960 * 0.356))), 16, 40);
            const metallicAreaM2 = 0.5 * Math.PI * Math.pow(diaMm / 2000, 2);
            const EA = 105e9 * metallicAreaM2;
            h.topY = hoistSuspensionTopY(h.kin);
            h.ropeLenM = Math.max(2.5, h.topY - (h.kin.y + 0.54));
            h.kRope = h.parts * EA / h.ropeLenM;
            h.kStruct = hoistStructureStiffness();
            h.k = 1 / (1 / h.kRope + 1 / h.kStruct);
            // Hook block + share of hanging rope mass
            const ropeMassPerM = 0.0040 * diaMm * diaMm; // kg/m (ISO 2408 6x36 IWRC)
            h.massKg = Math.max(120, (hookGear.massKg || 380) + 0.5 * h.parts * ropeMassPerM * h.ropeLenM);
            h.inertiaKg = h.massKg + hoistStructureModalMass();
            h.swayActive = hoistSwayEnabled();
            h.diaMm = diaMm;
        }

        function hoistElasticEnabled() {
            const cfg = hoistConfig();
            if (cfg.elastic === true) return true;
            if (cfg.elastic === false) return false;
            return !!(state.craneType && state.craneType !== 'hook_only');
        }

        /**
         * Effective modal mass of the structure that moves with the hook when the
         * hoist spring recoils (boom tip / girder / trolley + reeved rope).  The
         * strain energy of a boom is released into the boom's own vibration, not
         * into the 400 kg hook block alone — without this term a sling failure
         * would launch the block at 5 m/s.
         */
        function hoistStructureModalMass() {
            const t = state.craneType || 'hook_only';
            if (t === 'mobile_telescopic' || t === 'harbour' || t === 'portal_harbour') return 2800;
            if (t === 'crawler') return 4500;
            if (t === 'gantry' || t === 'rtg' || t === 'sts_crane_glb') return 9000;
            return 3500;
        }

        /** Clears the dynamic hoist state (rope unloaded, hook at rest under the drum). */
        function resetHoistDynamicState(h) {
            h.off.set(0, 0, 0);
            h.offLP.set(0, 0, 0);
            h.vel.set(0, 0, 0);
            h.tensionN = 0;
            h.tensionLP = 0;
            h.stretchMm = 0;
            h.winchSpeed = 0;
        }

        /**
         * Re-derives the suspension point from the current physical hook pose.
         * Geometry is always  hookPos = kin + off.
         * A small external nudge of phy.hookPos carries the drum along and keeps
         * the dynamic state; a large jump (tests, presets, reset, park) is a
         * teleport and the rope dynamics are re-initialised at rest.
         */
        function syncHoistFromHook() {
            const h = hoistState();
            const expected = h.kin.clone().add(h.off);
            const d = phy.hookPos.clone().sub(expected);
            if (d.lengthSq() > 0.05 * 0.05) {
                resetHoistDynamicState(h);
                h.kin.copy(phy.hookPos);
                h.teleports = (h.teleports || 0) + 1;
            } else {
                h.kin.copy(phy.hookPos).sub(h.off);
            }
            return h;
        }

        /** Physical hook pose from drum + dynamic deviation. */
        function writeHookFromHoist(h) {
            phy.hookPos.copy(h.kin).add(h.off);
        }

        /**
         * Semi-implicit (spring/damper implicit) integration of the hook block on the
         * hoist rope.  Called once per substep after the winch has moved `kin`.
         * @param {number} dt
         * @param {THREE.Vector3} kinVel velocity of the suspension point
         */
        function stepHoistDynamics(dt, kinVel) {
            const h = hoistState();
            if (!hoistElasticEnabled()) {
                const ws = h.winchSpeed;
                resetHoistDynamicState(h);
                h.winchSpeed = ws;
                h.daf = 1;
                writeHookFromHoist(h);
                phy.hookVel.copy(kinVel);
                return h;
            }
            updateHoistParameters(h);
            const cfg = hoistConfig();
            const m = h.massKg;          // hook block (+ rope share): weight hanging on the rope
            const mI = h.inertiaKg;      // + structure modal mass: inertia of the vertical hoist mode
            const g = G_EARTH;

            // Discontinuity guard.  A physical cable overrun is ~v·dt (< 3 mm per
            // substep even at full winch speed).  An overrun of several centimetres
            // means the solver has just re-seated the rig geometrically (rebuild,
            // preset, pose release, hook teleport).  A hanging load that appears
            // this way would otherwise find an unstretched rope and free-fall
            // through the static stretch (fictitious DAF≈2).  Pre-stretch the rope
            // to the static load instead; genuine snatch loads (small per-substep
            // overrun, large relative velocity) are untouched.
            //
            // NEVER arm this guard while the winch is paying out: unlocking a
            // grounded snug pose and lowering used to pre-stretch to the gross
            // suspended load, raise the drum via offLP, then yank the cargo up.
            {
                const overrun = phy.solverMaxOverrun || 0;
                phy.solverMaxOverrun = 0;
                h._kickJy = 0;
                const payingOut = (phy.hoistSpeed || 0) < -0.01
                    || (kinVel && kinVel.y < -0.05)
                    || ((h.winchSpeed || 0) < -0.05);
                const clrNow = hoistGroundClearanceNow();
                const clrFrame = phy.groundClearance || 0;
                if (overrun > 0.02 && !payingOut && Math.min(clrNow, clrFrame) > 0.05) {
                    const staticN = hoistStaticLoadN(clrNow);
                    const xs = -staticN / h.k;
                    if (h.off.y > xs + 3e4 / h.k) {
                        h.kin.y = phy.hookPos.y - xs;  // hook stays, drum re-derived
                        h.off.y = xs;
                        h.offLP.y = xs;                // operator already holds this height
                        h.vel.y = 0;
                        h.tensionN = staticN;
                        h.tensionLP = staticN;
                    }
                }
            }
            const hangingMass = Math.max(0, h.tensionLP) / g;
            const Mmodal = mI + hangingMass;

            // Vertical: rope only pulls (x < 0 = stretched)
            {
                const x = h.off.y;
                const v = h.vel.y;
                const ropeTaut = x < 0 || (x < 0.002 && v < 0);
                const k = ropeTaut ? h.k : 0;
                // STS headblock rides the hook — under-damped rope bounce reads as
                // cargo “nẩy tưng tưng” on nhớm / nâng hạ. Critically damp the mode.
                let zeta = cfg.dampingRatio != null ? cfg.dampingRatio : 0.06;
                if (state.beamType === 'container_spreader') zeta = Math.max(zeta, 0.42);
                // Slack rope: hook block in free air, only a little aerodynamic drag
                const c = ropeTaut ? 2 * zeta * Math.sqrt(k * Mmodal) : 0.05 * m;
                const vNew = (mI * v - dt * (m * g + k * x)) / (mI + dt * c + dt * dt * k);
                h.vel.y = vNew;
                h.off.y = x + dt * vNew;
                h.tensionN = Math.max(0, -h.k * Math.min(0, h.off.y));
            }

            // Horizontal: pendulum under the suspension point, restoring T/L
            if (h.swayActive) {
                const T = Math.max(m * g, h.tensionN);
                const kh = T / Math.max(1.0, h.ropeLenM);
                const zetaH = cfg.swayDampingRatio != null ? cfg.swayDampingRatio : 0.05;
                const ch = 2 * zetaH * Math.sqrt(kh * (m + hangingMass));
                ['x', 'z'].forEach(ax => {
                    const x = h.off[ax];
                    const v = h.vel[ax];
                    const vNew = (m * v - dt * kh * x) / (m + dt * ch + dt * dt * kh);
                    h.vel[ax] = vNew;
                    h.off[ax] = x + dt * vNew;
                });
                // Rope cannot exceed its geometric length: clamp horizontal excursion
                const maxSway = 0.35 * h.ropeLenM;
                const sw = Math.hypot(h.off.x, h.off.z);
                if (sw > maxSway) {
                    const s = maxSway / sw;
                    h.off.x *= s; h.off.z *= s;
                    h.vel.x *= 0.5; h.vel.z *= 0.5;
                }
            } else {
                h.off.x = 0; h.off.z = 0;
                h.vel.x = 0; h.vel.z = 0;
            }

            // Operator model: the quasi-static rope stretch is compensated by the
            // winch (advanceHook drives the drum to hookTarget - offLP) with a
            // human reaction time of ~1.5 s.  Only stretch is compensated, never
            // slack (a hook resting on an obstacle is not "hauled in").
            //
            // When the rope goes slack OR the winch is paying out, drop the
            // compensation immediately — a lagged offLP would keep the drum high
            // and launch the hook upward the moment stretch recovers.
            const stretchOnly = Math.min(0, h.off.y);
            const payingOut = (phy.hoistSpeed || 0) < -0.01
                || (kinVel && kinVel.y < -0.05)
                || ((h.winchSpeed || 0) < -0.05);
            if (stretchOnly >= -1e-4 || payingOut) {
                h.offLP.y = stretchOnly;
            } else {
                const tauLP = 1.5;
                const aLP = Math.min(1, dt / tauLP);
                h.offLP.y += (stretchOnly - h.offLP.y) * aLP;
            }
            h.offLP.x = 0; h.offLP.z = 0;
            h.tensionLP += (h.tensionN - h.tensionLP) * Math.min(1, dt / 0.5);

            writeHookFromHoist(h);
            phy.hookVel.copy(kinVel).add(h.vel);
            h.stretchMm = Math.max(0, -h.off.y) * 1000;
            return h;
        }

        /**
         * Hook-end generalized inverse mass seen by the cable solver along direction n.
         * Diagonal mass matrix: vertical = hook block + structure modal mass (hoist
         * mode), horizontal = hook block only (pendulum mode, real cranes only).
         */
        function hoistHookInvMass(n) {
            if (!hoistElasticEnabled()) return 0;
            const h = hoistState();
            const invV = 1 / Math.max(50, h.inertiaKg || h.massKg);
            const ny2 = n ? n.y * n.y : 1;
            if (!h.swayActive) return invV * ny2;
            const invH = 1 / Math.max(50, h.massKg);
            return invV * ny2 + invH * (1 - ny2);
        }

        /** Velocity impulse on the hook block from a cable (cable solver callback). */
        function hoistKickHook(n, j) {
            if (!hoistElasticEnabled()) return;
            const h = hoistState();
            const invV = 1 / Math.max(50, h.inertiaKg || h.massKg);
            const invH = h.swayActive ? 1 / Math.max(50, h.massKg) : 0;
            const dv = new THREE.Vector3(n.x * j * invH, n.y * j * invV, n.z * j * invH);
            h.vel.add(dv);
            phy.hookVel.add(dv);
            h._kickJy = (h._kickJy || 0) + j * n.y;
        }

        /**
         * Position-level generalized inverse mass of the hook: zero.
         * Position projections in this solver are drift clean-up, not dynamics.
         * A projection is an "infinitely stiff" displacement, so even a 0.02 mm
         * push on the hook block would show up as tonnes of phantom rope tension.
         * The drift is therefore absorbed by the heavy end of the cable (exactly
         * as before the hook became dynamic) while all real two-way coupling
         * happens at the velocity level through hoistKickHook().
         */
        function hoistHookInvMassPos() {
            return 0;
        }

        /** Position projection on the hook block from a cable: intentionally none. */
        function hoistPushHook() {
            /* see hoistHookInvMassPos */
        }

        /** After an external clamp moved phy.hookPos, fold the change into the dynamic offset. */
        function reconcileHoistAfterClamp() {
            const h = hoistState();
            const expected = h.kin.clone().add(h.off);
            const d = phy.hookPos.clone().sub(expected);
            if (d.lengthSq() < 1e-14) return;
            h.off.add(d);
            if (d.y > 0 && h.vel.y < 0) h.vel.y = 0;
            if (d.y > 0 && phy.hookVel.y < 0) phy.hookVel.y = 0;
        }

        /** Static hook load (N) for the given ground clearance: gross load in the air, rigging only on the ground. */
        function hoistStaticLoadN(clearance) {
            const h = hoistState();
            const mb = phy.massBreakdown || {};
            const grossT = (clearance || 0) > 0.05
                ? (mb.grossHookLoadT || ((phy.effectiveCargoWeightT != null ? phy.effectiveCargoWeightT : state.weight) + (phy.gearWeight || 0)))
                : (mb.belowHookRiggingT || (phy.gearWeight || 0));
            return Math.max(1, grossT * 1000 * G_EARTH + h.massKg * G_EARTH);
        }

        /** Instantaneous cargo ground clearance from the support points (per substep; phy.groundClearance is per frame). */
        function hoistGroundClearanceNow() {
            if (typeof supportPointsLocal !== 'function' || typeof supportY !== 'function') return phy.groundClearance || 0;
            let minGap = Infinity;
            supportPointsLocal().forEach(p => {
                const w = p.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
                const gap = w.y - supportY(w.x, w.z);
                if (gap < minGap) minGap = gap;
            });
            return isFinite(minGap) ? Math.max(0, minGap) : (phy.groundClearance || 0);
        }

        /** Per-frame hoist telemetry: rope tension, DAF, peak DAF. */
        function publishHoistTelemetry() {
            const h = hoistState();
            // DAF is always quoted against the gross suspended load (cargo + rigging
            // + hook block): on the ground it simply reads the pick-up fraction.
            h.staticLoadN = hoistStaticLoadN(1.0);
            h.daf = hoistElasticEnabled() ? h.tensionN / h.staticLoadN : 1;
            if ((phy.groundClearance || 0) > 0.05 && h.daf > h.dafPeak) h.dafPeak = h.daf;
            if ((phy.groundClearance || 0) <= 0.01 && h.tensionN < 0.3 * h.staticLoadN) h.dafPeak = 1;
            return h;
        }

        if (typeof window !== 'undefined') {
            window.windConfig = windConfig;
            window.hoistConfig = hoistConfig;
        }
