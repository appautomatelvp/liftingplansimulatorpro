/**
 * weather_fx — slanted wind-driven rain + horizon lightning flashes.
 * Physics loads live in dynamics.js; this is visual only.
 */
        const WEATHER_RAIN_MAX = 3200;
        const WEATHER_WIND_MAX = 22; // sparse smoke wisps — keep cargo readable
        const WEATHER_BOLT_MAX = 48; // segments per flash bolt
        const WEATHER_FX_VERSION = 4; // bump to force rebuild when FX design changes

        function makeWindSmokeTexture() {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            const g = c.getContext('2d');
            const grd = g.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.5);
            // Soft elongated puff: bright core → transparent edge (smoke / cloud)
            grd.addColorStop(0.0, 'rgba(186, 230, 253, 0.55)');
            grd.addColorStop(0.25, 'rgba(125, 211, 252, 0.28)');
            grd.addColorStop(0.55, 'rgba(56, 189, 248, 0.10)');
            grd.addColorStop(1.0, 'rgba(14, 165, 233, 0)');
            g.fillStyle = grd;
            g.fillRect(0, 0, size, size);
            // Second softer blob offset for cloudy irregularity
            const grd2 = g.createRadialGradient(size * 0.38, size * 0.42, 0, size * 0.38, size * 0.42, size * 0.42);
            grd2.addColorStop(0.0, 'rgba(224, 242, 254, 0.22)');
            grd2.addColorStop(1.0, 'rgba(224, 242, 254, 0)');
            g.fillStyle = grd2;
            g.fillRect(0, 0, size, size);
            const tex = new THREE.CanvasTexture(c);
            tex.needsUpdate = true;
            return tex;
        }

        function ensureWeatherFx() {
            if (phy._weatherFx && phy._weatherFx.root && phy._weatherFx.root.parent
                && phy._weatherFx.version === WEATHER_FX_VERSION && phy._weatherFx.windSmoke) {
                return phy._weatherFx;
            }
            if (phy._weatherFx && phy._weatherFx.root) {
                scene.remove(phy._weatherFx.root);
                phy._weatherFx = null;
            }
            const root = new THREE.Group();
            root.name = 'WeatherFX';
            root.renderOrder = 20;
            scene.add(root);

            // Rain streaks (LineSegments) — direction = velocity (wind-slanted)
            const rainPos = new Float32Array(WEATHER_RAIN_MAX * 2 * 3);
            const rainGeo = new THREE.BufferGeometry();
            rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
            rainGeo.setDrawRange(0, 0);
            // Rain: short cool-white needles (distinct from blue wind smoke)
            const rainMat = new THREE.LineBasicMaterial({
                color: 0xd8dee9,
                transparent: true,
                opacity: 0.55,
                depthWrite: false,
                fog: false
            });
            const rain = new THREE.LineSegments(rainGeo, rainMat);
            rain.frustumCulled = false;
            rain.renderOrder = 40;
            root.add(rain);

            // Wind: soft smoke / drifting-cloud sprites
            const smokeTex = makeWindSmokeTexture();
            const windSmoke = new THREE.Group();
            windSmoke.name = 'WindSmoke';
            windSmoke.renderOrder = 38;
            root.add(windSmoke);
            const windWisps = [];
            for (let i = 0; i < WEATHER_WIND_MAX; i++) {
                const mat = new THREE.SpriteMaterial({
                    map: smokeTex,
                    color: 0xbae6fd,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                    fog: false,
                    blending: THREE.NormalBlending
                });
                const spr = new THREE.Sprite(mat);
                spr.visible = false;
                spr.scale.set(4, 2.2, 1);
                windSmoke.add(spr);
                windWisps.push({
                    spr,
                    x: 0, y: 0, z: 0,
                    vx: 0, vy: 0, vz: 0,
                    age: 0,
                    life: 4,
                    scale: 3,
                    stretch: 1.6,
                    phase: Math.random() * Math.PI * 2
                });
            }

            // Lightning bolt polyline (rebuilt each flash)
            const boltPos = new Float32Array(WEATHER_BOLT_MAX * 2 * 3);
            const boltGeo = new THREE.BufferGeometry();
            boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3));
            boltGeo.setDrawRange(0, 0);
            const boltMat = new THREE.LineBasicMaterial({
                color: 0xf8fafc,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                depthTest: false
            });
            const bolt = new THREE.LineSegments(boltGeo, boltMat);
            bolt.frustumCulled = false;
            bolt.renderOrder = 50;
            root.add(bolt);

            // Soft fill flash on horizon
            const flashLight = new THREE.PointLight(0xdbeafe, 0, 220, 1.4);
            flashLight.position.set(0, 28, -90);
            root.add(flashLight);

            const arrow = new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 4, 0),
                3.5,
                0x38bdf8,
                0.55,
                0.35
            );
            arrow.visible = false;
            root.add(arrow);

            phy._weatherFx = {
                version: WEATHER_FX_VERSION,
                root,
                rain,
                rainGeo,
                rainPos,
                rainOrigin: new Float32Array(WEATHER_RAIN_MAX * 3),
                rainVel: new Float32Array(WEATHER_RAIN_MAX * 3),
                rainCount: 0,
                windSmoke,
                windWisps,
                windCount: 0,
                smokeTex,
                bolt,
                boltGeo,
                boltPos,
                boltMat,
                flashLight,
                arrow,
                lightning: {
                    nextIn: 2.5 + Math.random() * 4,
                    age: 0,
                    life: 0,
                    active: false,
                    pulses: 0,
                    bgSave: null,
                    fogSave: null,
                    keySave: null
                }
            };
            return phy._weatherFx;
        }

        function weatherFxAnchor() {
            // Prefer a point between camera and cargo so rain fills the viewport,
            // not only a thin sheet far above a distant load.
            const cargo = phy.cargoPos
                || (controls && controls.target)
                || new THREE.Vector3(0, 2, 0);
            if (camera && camera.position) {
                return new THREE.Vector3().lerpVectors(camera.position, cargo, 0.55);
            }
            return cargo.clone ? cargo.clone() : new THREE.Vector3().copy(cargo);
        }

        /** Wind smoke sits high near the hook so it doesn't veil the cargo. */
        function weatherWindAnchor() {
            if (phy.hookPos) {
                return new THREE.Vector3(
                    phy.hookPos.x,
                    phy.hookPos.y + 0.6,
                    phy.hookPos.z
                );
            }
            const cargo = phy.cargoPos || (controls && controls.target) || new THREE.Vector3(0, 2, 0);
            const h = (state && state.H) ? state.H : 2.6;
            return new THREE.Vector3(cargo.x, cargo.y + h * 0.5 + 4.5, cargo.z);
        }

        /** Strong wind-driven slant: horizontal rain velocity tracks wind clearly. */
        function rainVelocityFromWind(wind, rainMmH) {
            const wh = wind ? Math.hypot(wind.x, wind.z) : 0;
            const fall = 10 + Math.min(8, (rainMmH || 0) / 12) + Math.random() * 3;
            // Amplify slant so drops look clearly diagonal (not near-vertical)
            const drive = 1.15 + Math.min(1.6, wh / 8);
            const wx = wind ? wind.x * drive : 0;
            const wz = wind ? wind.z * drive : 0;
            // Tiny jitter so sheets don't look locked
            return {
                vx: wx + (Math.random() - 0.5) * 0.8,
                vy: -fall,
                vz: wz + (Math.random() - 0.5) * 0.8
            };
        }

        function seedRainDrop(fx, i, anchor, wind, rainMmH) {
            const span = 42;
            // Spawn upwind so streaks sweep across the view
            const wh = wind ? Math.hypot(wind.x, wind.z) : 0;
            let ux = 0;
            let uz = 0;
            if (wh > 0.2) {
                ux = -wind.x / wh;
                uz = -wind.z / wh;
            }
            const x = anchor.x + (Math.random() - 0.5) * span + ux * (4 + Math.random() * 10);
            const y = anchor.y + (Math.random() - 0.15) * 22;
            const z = anchor.z + (Math.random() - 0.5) * span + uz * (4 + Math.random() * 10);
            fx.rainOrigin[i * 3] = x;
            fx.rainOrigin[i * 3 + 1] = Math.max(0.3, y);
            fx.rainOrigin[i * 3 + 2] = z;
            const v = rainVelocityFromWind(wind, rainMmH);
            fx.rainVel[i * 3] = v.vx;
            fx.rainVel[i * 3 + 1] = v.vy;
            fx.rainVel[i * 3 + 2] = v.vz;
        }

        /** Soft smoke/cloud wisp — high near hook, drift & billow without covering cargo. */
        function seedWindWisp(fx, i, hookAnchor, wind) {
            const w = fx.windWisps[i];
            if (!w) return;
            const wh = wind ? Math.hypot(wind.x, wind.z) : 0;
            let dx = 1;
            let dz = 0;
            if (wh > 0.15) {
                dx = wind.x / wh;
                dz = wind.z / wh;
            }
            // Tight band around / just above the hook (not across the cargo body)
            const along = (Math.random() - 0.35) * 10;
            const side = (Math.random() - 0.5) * 7;
            w.x = hookAnchor.x - dx * (2 + Math.random() * 6) + (-dz) * side + dx * along * 0.2;
            w.y = hookAnchor.y + 0.4 + Math.random() * 3.8; // stay high near hook
            w.z = hookAnchor.z - dz * (2 + Math.random() * 6) + dx * side + dz * along * 0.2;
            const spd = Math.max(1.6, wh * (0.5 + Math.random() * 0.3));
            w.vx = dx * spd + (Math.random() - 0.5) * 0.25;
            w.vy = 0.2 + Math.random() * 0.4;
            w.vz = dz * spd + (Math.random() - 0.5) * 0.25;
            w.age = 0;
            w.life = 2.8 + Math.random() * 3.2;
            w.scale = 1.8 + Math.random() * 2.0; // smaller puffs
            w.stretch = 1.5 + Math.random() * 0.9;
            w.phase = Math.random() * Math.PI * 2;
            w.spr.visible = true;
            w.spr.material.opacity = 0;
            w.spr.position.set(w.x, w.y, w.z);
            w.spr.scale.set(w.scale * w.stretch, w.scale, 1);
        }

        function buildLightningBolt(fx, anchor, wind) {
            // Horizon bolt: far along wind / camera-forward, forked polyline
            const camDir = new THREE.Vector3(0, 0, -1);
            if (camera) camera.getWorldDirection(camDir);
            camDir.y = 0;
            if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, -1);
            else camDir.normalize();
            // Prefer downwind horizon
            if (wind && Math.hypot(wind.x, wind.z) > 0.5) {
                const wd = new THREE.Vector3(wind.x, 0, wind.z).normalize();
                camDir.lerp(wd, 0.55).normalize();
            }
            const dist = 55 + Math.random() * 45;
            const base = new THREE.Vector3(
                anchor.x + camDir.x * dist + (Math.random() - 0.5) * 30,
                6 + Math.random() * 8,
                anchor.z + camDir.z * dist + (Math.random() - 0.5) * 30
            );
            const tip = base.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                18 + Math.random() * 16,
                (Math.random() - 0.5) * 8
            ));

            const segs = [];
            const steps = 10 + Math.floor(Math.random() * 6);
            let prev = tip.clone();
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                const p = tip.clone().lerp(base, t);
                p.x += (Math.random() - 0.5) * (1.2 + t * 3.5);
                p.z += (Math.random() - 0.5) * (1.2 + t * 3.5);
                segs.push(prev.clone(), p.clone());
                // Occasional side fork
                if (Math.random() < 0.28 && s > 2 && s < steps - 1) {
                    const fork = p.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 6,
                        -2 - Math.random() * 5,
                        (Math.random() - 0.5) * 6
                    ));
                    segs.push(p.clone(), fork);
                }
                prev = p;
            }

            const n = Math.min(WEATHER_BOLT_MAX, Math.floor(segs.length / 2));
            for (let i = 0; i < n; i++) {
                const a = segs[i * 2];
                const b = segs[i * 2 + 1];
                const o = i * 6;
                fx.boltPos[o] = a.x; fx.boltPos[o + 1] = a.y; fx.boltPos[o + 2] = a.z;
                fx.boltPos[o + 3] = b.x; fx.boltPos[o + 4] = b.y; fx.boltPos[o + 5] = b.z;
            }
            fx.bolt.geometry.attributes.position.needsUpdate = true;
            fx.bolt.geometry.setDrawRange(0, n * 2);
            fx.flashLight.position.copy(tip.clone().lerp(base, 0.35));
            fx.flashLight.position.y = Math.max(12, fx.flashLight.position.y);
        }

        function updateLightning(fx, dt, rainMmH, windSpd, anchor, wind) {
            const L = fx.lightning;
            // Stormy enough: rain + some wind (or heavy rain alone)
            const storm = rainMmH >= 18 || (rainMmH >= 8 && windSpd >= 6);
            if (!storm) {
                L.active = false;
                L.life = 0;
                fx.boltMat.opacity = 0;
                fx.flashLight.intensity = 0;
                L.nextIn = Math.max(L.nextIn, 3);
                return;
            }

            if (!L.active) {
                L.nextIn -= dt;
                if (L.nextIn > 0) {
                    fx.boltMat.opacity = 0;
                    fx.flashLight.intensity = 0;
                    return;
                }
                // Start a multi-pulse flash
                L.active = true;
                L.age = 0;
                L.life = 0.18 + Math.random() * 0.22;
                L.pulses = 1 + Math.floor(Math.random() * 3);
                buildLightningBolt(fx, anchor, wind);
                if (scene.background && scene.background.isColor && !L.bgSave) {
                    L.bgSave = scene.background.clone();
                }
                if (scene.fog && scene.fog.color && !L.fogSave) {
                    L.fogSave = scene.fog.color.clone();
                }
                if (typeof keyLight !== 'undefined' && keyLight && keyLight.intensity != null && L.keySave == null) {
                    L.keySave = keyLight.intensity;
                }
                // Next gap 4–14 s (more frequent in heavy rain)
                const dens = THREE.MathUtils.clamp(rainMmH / 80, 0.25, 1);
                L.nextIn = (4.5 - dens * 2.2) + Math.random() * (10 - dens * 4);
            }

            L.age += dt;
            const t = L.age / Math.max(1e-3, L.life);
            // Flicker envelope: bright spikes
            let pulse = 0;
            if (t < 0.12) pulse = 1;
            else if (t < 0.28) pulse = 0.15;
            else if (t < 0.42 && L.pulses > 1) pulse = 0.85;
            else if (t < 0.7 && L.pulses > 2) pulse = 0.35 + 0.5 * Math.random();
            else pulse = Math.max(0, 1 - t) * 0.2;

            fx.boltMat.opacity = pulse * 0.95;
            fx.flashLight.intensity = pulse * (28 + rainMmH * 0.25);
            fx.flashLight.distance = 180 + rainMmH;

            if (scene.background && scene.background.isColor && L.bgSave) {
                scene.background.copy(L.bgSave).lerp(new THREE.Color(0xf1f5f9), pulse * 0.55);
            }
            if (scene.fog && scene.fog.color && L.fogSave) {
                scene.fog.color.copy(L.fogSave).lerp(new THREE.Color(0xe2e8f0), pulse * 0.4);
            }
            if (typeof keyLight !== 'undefined' && keyLight && L.keySave != null) {
                keyLight.intensity = L.keySave + pulse * 2.8;
            }

            if (L.age >= L.life) {
                L.active = false;
                fx.boltMat.opacity = 0;
                fx.flashLight.intensity = 0;
                if (scene.background && scene.background.isColor && L.bgSave) {
                    scene.background.copy(L.bgSave);
                }
                if (scene.fog && scene.fog.color && L.fogSave) {
                    scene.fog.color.copy(L.fogSave);
                }
                if (typeof keyLight !== 'undefined' && keyLight && L.keySave != null) {
                    keyLight.intensity = L.keySave;
                }
                L.bgSave = null;
                L.fogSave = null;
                L.keySave = null;
            }
        }

        function updateWeatherAtmosphere(rainMmH, windSpd) {
            if (!scene || !scene.fog || !scene.fog.isFog) return;
            const wet = Math.min(1, rainMmH / 50);
            const windy = Math.min(1, Math.max(0, windSpd - 1) / 18);
            if (wet < 0.02 && windy < 0.05) return;
            const target = new THREE.Color(0x1e293b).lerp(new THREE.Color(0x334155), wet * 0.55 + windy * 0.2);
            scene.fog.color.lerp(target, 0.035);
            scene.fog.near = THREE.MathUtils.lerp(scene.fog.near || 80, 42 - wet * 12, 0.03);
            scene.fog.far = THREE.MathUtils.lerp(scene.fog.far || 220, 135 - wet * 35, 0.03);
        }

        function updateWeatherFx(dt) {
            if (!scene || typeof THREE === 'undefined') return;
            const wx = (typeof weatherConfig === 'function') ? weatherConfig() : (state.weather || {});
            const rainMmH = Math.max(0, wx.rainMmH || wx.rainBaseMmH || 0);
            const windLive = (phy.windField && phy.windField.vec && phy.windField.vec.lengthSq() > 1e-6)
                ? phy.windField.vec.clone()
                : ((phy.wind && phy.wind.vector) ? phy.wind.vector.clone() : new THREE.Vector3());
            let windSpd = windLive.length();
            if (windSpd < 0.05 && state.wind && state.wind.enabled !== false) {
                const V = state.wind.speedMps || state.wind.baseSpeedMps || 0;
                if (V > 0.05) {
                    const dir = THREE.MathUtils.degToRad(state.wind.dirDeg || 0);
                    windLive.set(Math.cos(dir) * V, 0, Math.sin(dir) * V);
                    windSpd = V;
                }
            }

            const wantRain = Math.min(WEATHER_RAIN_MAX, Math.floor(rainMmH * 48 + (rainMmH > 0.5 ? 180 : 0)));
            // Sparse high wisps near hook — fewer so cargo stays clear
            const wantWind = windSpd < 1.2
                ? 0
                : Math.min(WEATHER_WIND_MAX, Math.floor(3 + (windSpd - 1.2) * 1.4));

            if (wantRain < 4 && wantWind < 2 && rainMmH < 1) {
                if (phy._weatherFx && phy._weatherFx.root) {
                    phy._weatherFx.root.visible = false;
                    if (phy._weatherFx.arrow) phy._weatherFx.arrow.visible = false;
                    if (phy._weatherFx.flashLight) phy._weatherFx.flashLight.intensity = 0;
                    if (phy._weatherFx.boltMat) phy._weatherFx.boltMat.opacity = 0;
                    if (phy._weatherFx.windWisps) {
                        for (const w of phy._weatherFx.windWisps) {
                            if (w.spr) w.spr.visible = false;
                        }
                    }
                }
                return;
            }

            const fx = ensureWeatherFx();
            fx.root.visible = true;
            const anchor = weatherFxAnchor();
            const windAnchor = weatherWindAnchor();
            const step = Math.max(1e-3, Math.min(0.05, dt || 0.016));
            const groundY = (typeof supportY === 'function')
                ? supportY(anchor.x, anchor.z) - 0.2
                : -0.2;

            // --- Slanted rain ---
            if (fx.rainCount < wantRain) {
                for (let i = fx.rainCount; i < wantRain; i++) {
                    seedRainDrop(fx, i, anchor, windLive, rainMmH);
                }
            }
            fx.rainCount = wantRain;
            // Short fine needles — keep rain visually thinner than blue wind streams
            const wh = Math.hypot(windLive.x, windLive.z);
            const streak = THREE.MathUtils.clamp(0.28 + rainMmH / 180 + wh * 0.02, 0.28, 0.72);
            if (fx.rain?.material?.color) fx.rain.material.color.setHex(0xd8dee9);
            for (let i = 0; i < fx.rainCount; i++) {
                // Continuously re-aim drops with live wind so slant stays correct
                if ((i & 7) === 0) {
                    const v = rainVelocityFromWind(windLive, rainMmH);
                    fx.rainVel[i * 3] = THREE.MathUtils.lerp(fx.rainVel[i * 3], v.vx, 0.35);
                    fx.rainVel[i * 3 + 1] = THREE.MathUtils.lerp(fx.rainVel[i * 3 + 1], v.vy, 0.25);
                    fx.rainVel[i * 3 + 2] = THREE.MathUtils.lerp(fx.rainVel[i * 3 + 2], v.vz, 0.35);
                }
                fx.rainOrigin[i * 3] += fx.rainVel[i * 3] * step;
                fx.rainOrigin[i * 3 + 1] += fx.rainVel[i * 3 + 1] * step;
                fx.rainOrigin[i * 3 + 2] += fx.rainVel[i * 3 + 2] * step;
                if (fx.rainOrigin[i * 3 + 1] < groundY
                    || Math.abs(fx.rainOrigin[i * 3] - anchor.x) > 28
                    || Math.abs(fx.rainOrigin[i * 3 + 2] - anchor.z) > 28) {
                    seedRainDrop(fx, i, anchor, windLive, rainMmH);
                }
                const ox = fx.rainOrigin[i * 3];
                const oy = fx.rainOrigin[i * 3 + 1];
                const oz = fx.rainOrigin[i * 3 + 2];
                const vx = fx.rainVel[i * 3];
                const vy = fx.rainVel[i * 3 + 1];
                const vz = fx.rainVel[i * 3 + 2];
                const vlen = Math.hypot(vx, vy, vz) || 1;
                const o = i * 6;
                fx.rainPos[o] = ox;
                fx.rainPos[o + 1] = oy;
                fx.rainPos[o + 2] = oz;
                fx.rainPos[o + 3] = ox + (vx / vlen) * streak;
                fx.rainPos[o + 4] = oy + (vy / vlen) * streak;
                fx.rainPos[o + 5] = oz + (vz / vlen) * streak;
            }
            fx.rain.geometry.attributes.position.needsUpdate = true;
            fx.rain.geometry.setDrawRange(0, fx.rainCount * 2);
            fx.rain.material.opacity = THREE.MathUtils.clamp(0.35 + rainMmH / 120, 0.35, 0.62);
            fx.rain.visible = wantRain > 0;

            // --- Soft smoke / drifting cloud wisps (high near hook) ---
            if (fx.windCount < wantWind) {
                for (let i = fx.windCount; i < wantWind; i++) seedWindWisp(fx, i, windAnchor, windLive);
            }
            // Hide surplus if wind dropped
            for (let i = wantWind; i < fx.windCount; i++) {
                const w = fx.windWisps[i];
                if (w && w.spr) w.spr.visible = false;
            }
            fx.windCount = wantWind;
            const peakOp = THREE.MathUtils.clamp(0.10 + windSpd / 50, 0.10, 0.22);
            const minSmokeY = windAnchor.y - 1.2; // don't drift down over the cargo face
            for (let i = 0; i < fx.windCount; i++) {
                const w = fx.windWisps[i];
                if (!w) continue;
                w.age += step;
                // Slow swirl / bob so clouds feel alive, not rigid
                const bob = Math.sin(w.age * 0.7 + w.phase) * 0.2;
                const sway = Math.sin(w.age * 0.45 + w.phase * 1.3) * 0.3;
                w.x += w.vx * step + sway * step;
                w.y += (w.vy + bob * 0.12) * step;
                w.z += w.vz * step;
                if (w.y < minSmokeY) w.y = minSmokeY + Math.random() * 0.4;
                // Billow: grow while fading out
                const t = w.age / Math.max(1e-3, w.life);
                const grow = 1 + t * 1.1;
                const fade = t < 0.12
                    ? (t / 0.12)
                    : (t > 0.55 ? Math.max(0, 1 - (t - 0.55) / 0.45) : 1);
                w.spr.position.set(w.x, w.y, w.z);
                w.spr.scale.set(w.scale * w.stretch * grow, w.scale * grow * 0.72, 1);
                w.spr.material.opacity = peakOp * fade;
                w.spr.material.color.setHex(0xbae6fd);
                w.spr.visible = fade > 0.02;

                if (t >= 1
                    || Math.abs(w.x - windAnchor.x) > 16
                    || Math.abs(w.z - windAnchor.z) > 16
                    || w.y > windAnchor.y + 8) {
                    seedWindWisp(fx, i, windAnchor, windLive);
                }
            }
            if (fx.windSmoke) fx.windSmoke.visible = wantWind > 0;

            if (fx.arrow && windSpd > 0.8) {
                fx.arrow.visible = true;
                const dir = windLive.clone();
                dir.y = 0;
                if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
                else dir.normalize();
                fx.arrow.setDirection(dir);
                fx.arrow.setLength(2.0 + Math.min(3.2, windSpd * 0.18), 0.4, 0.24);
                fx.arrow.position.set(windAnchor.x, windAnchor.y + 0.8, windAnchor.z);
            } else if (fx.arrow) {
                fx.arrow.visible = false;
            }

            updateLightning(fx, step, rainMmH, windSpd, anchor, windLive);
            updateWeatherAtmosphere(rainMmH, windSpd);
        }

        if (typeof window !== 'undefined') {
            window.updateWeatherFx = updateWeatherFx;
        }
