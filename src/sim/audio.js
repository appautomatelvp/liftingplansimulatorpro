/**
 * audio.js — High-Fidelity Procedural Industrial Audio Engine for Lifting Plan Simulator Pro.
 * Synthesizes realistic, physically-accurate, zero-dependency sound effects via Web Audio API:
 * 1. Construction Crane Winch:
 *    - Heavy 6-cylinder diesel engine combustion throb (32–52 Hz) with rhythmic diesel clatter.
 *    - High-pressure hydraulic variable-displacement axial pump whine (340–520 Hz).
 *    - Steel sheave/pulley squeal & wire rope friction groove groan (1.8–2.8 kHz).
 *    - Pneumatic air-brake release hiss ("pssshh-t!") on winch start/stop.
 * 2. Catastrophic Cable Snap ("UỲNH UỲNH như tiếng kim loại bị phá hủy"):
 *    - Explosive primary structural sub-bass detonation (120 Hz -> 24 Hz with saturation).
 *    - Secondary rebound shockwave boom at +80ms as crane boom & counterweight whip back.
 *    - Supersonic highpass whip crack impulse + screaming steel wire singing ring (720, 1480, 2850 Hz).
 *    - Metal shrapnel / debris clatter.
 * 3. Cable Reeve & Latch:
 *    - Heavy Crosby shackle pin sliding, jaw seating chime triad, and ratchet lock thud.
 * 4. Free-Falling in Mid-Air:
 *    - Dynamic aerofoil rushing wind scaled with fall velocity and altitude.
 * 5. Cargo Impact & Metal Destruction ("UỲNH UỲNH như tiếng kim loại bị phá hủy"):
 *    - Ground-shattering seismic sub-bass blast (145 Hz -> 18 Hz).
 *    - Secondary rebound destruction crunch at +110ms ("UỲNH... RẦM!").
 *    - Violent structural steel tearing, girder buckling, and waveshaped plate distortion.
 *    - Cavernous industrial yard echo & hollow metal hull ringing (160, 340, 720, 1280 Hz).
 */

(function (global) {
    'use strict';

    function makeDistortionCurve(amount = 25, n_samples = 512) {
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }

    class LiftingAudioEngine {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.distortionCurve = makeDistortionCurve(28, 512);
            this.muted = false;
            this.volume = 0.85;
            this.initialized = false;

            // Persistent continuous nodes
            this.winchNodes = null;
            this.fallNodes = null;

            // Noise buffer cache
            this.noiseBuffer = null;

            // State tracking for air-brake sound
            this.wasWinchActive = false;

            // Load saved preferences
            try {
                if (typeof localStorage !== 'undefined') {
                    const savedMute = localStorage.getItem('lifting_sim_audio_muted');
                    if (savedMute !== null) this.muted = savedMute === 'true';
                    const savedVol = localStorage.getItem('lifting_sim_audio_vol');
                    if (savedVol !== null) this.volume = Math.max(0, Math.min(1, parseFloat(savedVol)));
                }
            } catch (e) {
                // Ignore localStorage errors
            }

            this.setupUserGestureUnlock();
        }

        setupUserGestureUnlock() {
            if (typeof window === 'undefined' || typeof document === 'undefined' || typeof window.addEventListener !== 'function') return;

            const unlock = () => {
                this.initContext();
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => {});
                }
            };

            const events = ['pointerdown', 'keydown', 'touchstart', 'mousedown'];
            const listenerOpts = { capture: true, passive: true };
            const onGesture = () => {
                unlock();
                events.forEach(evt => window.removeEventListener(evt, onGesture, listenerOpts));
            };
            events.forEach(evt => window.addEventListener(evt, onGesture, listenerOpts));
        }

        initContext() {
            if (this.ctx) return this.ctx;
            if (typeof window === 'undefined') return null;

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;

            try {
                this.ctx = new AudioCtx();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime(this.muted ? 0.0001 : this.volume, this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);

                this.initNoiseBuffer();
                this.initContinuousNodes();
                this.initialized = true;
            } catch (err) {
                this.ctx = null;
                this.masterGain = null;
            }
            return this.ctx;
        }

        initNoiseBuffer() {
            if (!this.ctx || this.noiseBuffer) return;
            const duration = 3.0;
            const sampleRate = this.ctx.sampleRate;
            const length = Math.floor(sampleRate * duration);
            const buffer = this.ctx.createBuffer(1, length, sampleRate);
            const channel = buffer.getChannelData(0);

            // Generate pink/brown integrated noise
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < length; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                channel[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.14;
                b6 = white * 0.115926;
            }
            this.noiseBuffer = buffer;
        }

        initContinuousNodes() {
            if (!this.ctx || !this.masterGain) return;
            const now = this.ctx.currentTime;

            // --- 1. CONSTRUCTION CRANE WINCH AUDIO PIPELINE ---
            const winchMasterGain = this.ctx.createGain();
            winchMasterGain.gain.setValueAtTime(0.0001, now);

            // Layer A: Diesel Engine Power Unit (Low-frequency combustion rumble)
            const dieselOsc = this.ctx.createOscillator();
            dieselOsc.type = 'sawtooth';
            dieselOsc.frequency.setValueAtTime(36, now); // 36 Hz base diesel cylinder firing

            // Diesel combustion pulse LFO (cylinder clatter at ~14 Hz)
            const dieselPulseLFO = this.ctx.createOscillator();
            dieselPulseLFO.type = 'sine';
            dieselPulseLFO.frequency.setValueAtTime(14, now);
            const dieselPulseGain = this.ctx.createGain();
            dieselPulseGain.gain.setValueAtTime(12, now);
            dieselPulseLFO.connect(dieselPulseGain);
            dieselPulseGain.connect(dieselOsc.frequency);

            const dieselFilter = this.ctx.createBiquadFilter();
            dieselFilter.type = 'lowpass';
            dieselFilter.frequency.setValueAtTime(140, now);
            dieselFilter.Q.setValueAtTime(3.2, now);

            const dieselGain = this.ctx.createGain();
            dieselGain.gain.setValueAtTime(0.32, now);

            dieselOsc.connect(dieselFilter);
            dieselFilter.connect(dieselGain);
            dieselGain.connect(winchMasterGain);

            // Layer B: Hydraulic Axial Piston Pump Whine (High-pressure hydraulic motor)
            const hydroPumpOsc = this.ctx.createOscillator();
            hydroPumpOsc.type = 'triangle';
            hydroPumpOsc.frequency.setValueAtTime(260, now);

            const hydroPumpFilter = this.ctx.createBiquadFilter();
            hydroPumpFilter.type = 'bandpass';
            hydroPumpFilter.frequency.setValueAtTime(340, now);
            hydroPumpFilter.Q.setValueAtTime(4.0, now);

            const hydroPumpGain = this.ctx.createGain();
            hydroPumpGain.gain.setValueAtTime(0.24, now);

            hydroPumpOsc.connect(hydroPumpFilter);
            hydroPumpFilter.connect(hydroPumpGain);
            hydroPumpGain.connect(winchMasterGain);

            // Layer C: Heavy Steel Sheave Squeak & Wire Rope Friction Groove Squeal
            const sheaveOsc = this.ctx.createOscillator();
            sheaveOsc.type = 'sine';
            sheaveOsc.frequency.setValueAtTime(2100, now);

            const sheaveFilter = this.ctx.createBiquadFilter();
            sheaveFilter.type = 'bandpass';
            sheaveFilter.frequency.setValueAtTime(2200, now);
            sheaveFilter.Q.setValueAtTime(8.5, now);

            const sheaveGain = this.ctx.createGain();
            sheaveGain.gain.setValueAtTime(0.06, now);

            sheaveOsc.connect(sheaveFilter);
            sheaveFilter.connect(sheaveGain);
            sheaveGain.connect(winchMasterGain);

            // Layer D: Cable Drum Spooling & Wire Strand Texture
            let spoolSource = null;
            let spoolFilter = null;
            let spoolGain = null;
            if (this.noiseBuffer) {
                spoolSource = this.ctx.createBufferSource();
                spoolSource.buffer = this.noiseBuffer;
                spoolSource.loop = true;

                spoolFilter = this.ctx.createBiquadFilter();
                spoolFilter.type = 'bandpass';
                spoolFilter.frequency.setValueAtTime(1450, now);
                spoolFilter.Q.setValueAtTime(2.2, now);

                spoolGain = this.ctx.createGain();
                spoolGain.gain.setValueAtTime(0.12, now);

                spoolSource.connect(spoolFilter);
                spoolFilter.connect(spoolGain);
                spoolGain.connect(winchMasterGain);
            }

            winchMasterGain.connect(this.masterGain);

            try {
                dieselOsc.start(now);
                dieselPulseLFO.start(now);
                hydroPumpOsc.start(now);
                sheaveOsc.start(now);
                if (spoolSource) spoolSource.start(now);
            } catch (e) {}

            this.winchNodes = {
                master: winchMasterGain,
                motorOsc: dieselOsc,
                motorFilter: dieselFilter,
                gearOsc: hydroPumpOsc,
                gearFilter: hydroPumpFilter,
                sheaveOsc: sheaveOsc,
                sheaveGain: sheaveGain,
                spoolGain: spoolGain
            };

            // --- 2. FREE-FALL WIND WHOOSH PIPELINE ---
            let fallSource = null;
            let fallFilter = null;
            let fallGain = null;
            if (this.noiseBuffer) {
                fallSource = this.ctx.createBufferSource();
                fallSource.buffer = this.noiseBuffer;
                fallSource.loop = true;

                fallFilter = this.ctx.createBiquadFilter();
                fallFilter.type = 'lowpass';
                fallFilter.frequency.setValueAtTime(220, now);
                fallFilter.Q.setValueAtTime(1.4, now);

                fallGain = this.ctx.createGain();
                fallGain.gain.setValueAtTime(0.0001, now);

                fallSource.connect(fallFilter);
                fallFilter.connect(fallGain);
                fallGain.connect(this.masterGain);

                try {
                    fallSource.start(now);
                } catch (e) {}

                this.fallNodes = {
                    source: fallSource,
                    filter: fallFilter,
                    gain: fallGain
                };
            }
        }

        /**
         * Dynamic Winch Hoisting & Lowering
         * Realistic Heavy Construction Site Crane Sound (Diesel engine + hydraulic pump + sheave squeal)
         */
        updateWinch(speed, isAuto, loadRatio = 0.3) {
            if (!this.ctx) return;
            if (!this.winchNodes) this.initContinuousNodes();
            if (!this.winchNodes) return;

            const now = this.ctx.currentTime;
            const absSpeed = isAuto ? 0.65 : Math.abs(speed || 0);
            const active = absSpeed > 0.015;

            // Trigger air-brake release hiss when winch starts or stops
            if (active && !this.wasWinchActive) {
                this.playAirBrake(true);
            } else if (!active && this.wasWinchActive) {
                this.playAirBrake(false);
            }
            this.wasWinchActive = active;

            if (!active) {
                this.winchNodes.master.gain.setTargetAtTime(0.0001, now, 0.08);
                return;
            }

            const isHoisting = isAuto || (speed || 0) > 0.01;
            const targetGain = Math.min(0.48, 0.08 + absSpeed * 0.36);
            this.winchNodes.master.gain.setTargetAtTime(targetGain, now, 0.04);

            // Diesel engine revs under hoist load
            const dieselFreq = isHoisting ? (38 + loadRatio * 18) : 32;
            this.winchNodes.motorOsc.frequency.setTargetAtTime(dieselFreq, now, 0.06);
            this.winchNodes.motorFilter.frequency.setTargetAtTime(140 + loadRatio * 160, now, 0.08);

            // Hydraulic pump whine shifts with load pressure
            const pumpFreq = isHoisting ? (280 + loadRatio * 220) : 210;
            this.winchNodes.gearOsc.frequency.setTargetAtTime(pumpFreq, now, 0.06);
            this.winchNodes.gearFilter.frequency.setTargetAtTime(pumpFreq * 1.15, now, 0.08);

            // Sheave squeak intensity increases under heavy wire rope tension
            if (this.winchNodes.sheaveGain) {
                const sheaveAmp = 0.02 + Math.min(0.14, loadRatio * 0.16);
                this.winchNodes.sheaveGain.gain.setTargetAtTime(sheaveAmp, now, 0.08);
                const squeakPitch = 1900 + Math.sin(now * 3.5) * 450 + loadRatio * 500;
                this.winchNodes.sheaveOsc.frequency.setTargetAtTime(squeakPitch, now, 0.06);
            }
        }

        /**
         * Pneumatic Air-Brake Release / Catch Sound
         */
        playAirBrake(isRelease) {
            const ctx = this.initContext();
            if (!ctx || this.muted || !this.noiseBuffer) return;
            const now = ctx.currentTime;

            const noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = this.noiseBuffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(isRelease ? 3200 : 2600, now);
            filter.Q.setValueAtTime(2.2, now);

            const gain = ctx.createGain();
            const dur = isRelease ? 0.18 : 0.22;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

            noiseSrc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            noiseSrc.start(now);
            noiseSrc.stop(now + dur + 0.02);
        }

        /**
         * Dynamic Aerofoil Wind Whoosh for Free-Falling Objects
         */
        updateFallWind(fallSpeed) {
            if (!this.ctx || !this.fallNodes) return;
            const now = this.ctx.currentTime;

            if (!fallSpeed || fallSpeed < 0.9) {
                this.fallNodes.gain.gain.setTargetAtTime(0.0001, now, 0.04);
                return;
            }

            const normalizedSpeed = Math.min(1.0, (fallSpeed - 0.9) / 8.0);
            const targetGain = Math.min(0.55, 0.08 + normalizedSpeed * 0.44);
            const cutoffFreq = Math.min(2400, 240 + normalizedSpeed * 1900);

            this.fallNodes.gain.gain.setTargetAtTime(targetGain, now, 0.03);
            this.fallNodes.filter.frequency.setTargetAtTime(cutoffFreq, now, 0.04);
        }

        /**
         * Catastrophic Cable Snapping & Parting Detonation
         * "Uỳnh uỳnh như tiếng kim loại bị phá hủy":
         * 1. Explosive primary structural sub-bass detonation (120 Hz -> 24 Hz).
         * 2. Secondary rebound shockwave boom at +80ms as crane boom & counterweight whip back.
         * 3. Supersonic highpass whip crack impulse + screaming steel wire singing ring.
         * 4. Metal shrapnel / debris clatter.
         */
        playCableSnap(opts = {}) {
            const ctx = this.initContext();
            if (!ctx || this.muted) return;
            const now = ctx.currentTime;

            const isChain = opts.type === 'chain';
            const isStrap = opts.type === 'web';

            // --- 1. PRIMARY STRUCTURAL SUB-BASS DETONATION (UỲNH 1) ---
            const boom1Osc = ctx.createOscillator();
            boom1Osc.type = 'sawtooth';
            boom1Osc.frequency.setValueAtTime(130, now);
            boom1Osc.frequency.exponentialRampToValueAtTime(24, now + 0.32);

            const boom1Filter = ctx.createBiquadFilter();
            boom1Filter.type = 'lowpass';
            boom1Filter.frequency.setValueAtTime(180, now);

            const shaper = typeof ctx.createWaveShaper === 'function' ? ctx.createWaveShaper() : null;
            if (shaper) shaper.curve = this.distortionCurve;

            const boom1Gain = ctx.createGain();
            boom1Gain.gain.setValueAtTime(0.0001, now);
            boom1Gain.gain.linearRampToValueAtTime(0.92, now + 0.004);
            boom1Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

            boom1Osc.connect(boom1Filter);
            if (shaper) {
                boom1Filter.connect(shaper);
                shaper.connect(boom1Gain);
            } else {
                boom1Filter.connect(boom1Gain);
            }
            boom1Gain.connect(this.masterGain);

            boom1Osc.start(now);
            boom1Osc.stop(now + 0.42);

            // --- 2. SECONDARY REBOUND SHOCKWAVE BOOM (UỲNH 2 at +85ms) ---
            const t2 = now + 0.085;
            const boom2Osc = ctx.createOscillator();
            boom2Osc.type = 'triangle';
            boom2Osc.frequency.setValueAtTime(95, t2);
            boom2Osc.frequency.exponentialRampToValueAtTime(28, t2 + 0.28);

            const boom2Gain = ctx.createGain();
            boom2Gain.gain.setValueAtTime(0.0001, t2);
            boom2Gain.gain.linearRampToValueAtTime(0.68, t2 + 0.005);
            boom2Gain.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.30);

            boom2Osc.connect(boom2Gain);
            boom2Gain.connect(this.masterGain);

            boom2Osc.start(t2);
            boom2Osc.stop(t2 + 0.34);

            // --- 3. SUPERSONIC METAL WHIP CRACK (CHOẢNG!) ---
            if (this.noiseBuffer) {
                const crackSrc = ctx.createBufferSource();
                crackSrc.buffer = this.noiseBuffer;

                const crackFilter = ctx.createBiquadFilter();
                crackFilter.type = isStrap ? 'bandpass' : 'highpass';
                crackFilter.frequency.setValueAtTime(isStrap ? 900 : 1400, now);
                crackFilter.Q.setValueAtTime(2.0, now);

                const crackGain = ctx.createGain();
                crackGain.gain.setValueAtTime(0.0001, now);
                crackGain.gain.linearRampToValueAtTime(0.95, now + 0.002);
                crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

                crackSrc.connect(crackFilter);
                crackFilter.connect(crackGain);
                crackGain.connect(this.masterGain);

                crackSrc.start(now);
                crackSrc.stop(now + 0.09);
            }

            // --- 4. SCREAMING STEEL WIRE SINGING RECOIL (Kim loại bị xé giằng) ---
            const pingFreq1 = isChain ? 880 : 1380;
            const pingFreq2 = isChain ? 2450 : 2240;
            const pingFreq3 = isChain ? 3200 : 2850;

            [pingFreq1, pingFreq2, pingFreq3].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                osc.type = isChain ? 'square' : 'sine';
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.45);

                const gain = ctx.createGain();
                const amp = (idx === 0 ? 0.48 : (idx === 1 ? 0.32 : 0.18)) * (isStrap ? 0.15 : 1.0);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.linearRampToValueAtTime(amp, now + 0.003);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + (isChain ? 0.55 : 0.42));

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(now);
                osc.stop(now + 0.60);
            });
        }

        /**
         * Cable Reeve / Shackle Pin Lock / Repair Effect
         */
        playCableReeve(opts = {}) {
            const ctx = this.initContext();
            if (!ctx || this.muted) return;
            const now = ctx.currentTime;

            const clinks = [
                { delay: 0.00, freq: 960, amp: 0.28, dur: 0.08 },
                { delay: 0.06, freq: 1480, amp: 0.35, dur: 0.09 },
                { delay: 0.14, freq: 2350, amp: 0.42, dur: 0.05 }
            ];

            clinks.forEach(item => {
                const t = now + item.delay;
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(item.freq, t);

                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(item.freq, t);
                filter.Q.setValueAtTime(14, t);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.linearRampToValueAtTime(item.amp, t + 0.002);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + item.dur);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);

                osc.start(t);
                osc.stop(t + item.dur + 0.02);
            });

            // Solid steel closure thud at final latch
            const latchTime = now + 0.14;
            const thudOsc = ctx.createOscillator();
            thudOsc.type = 'triangle';
            thudOsc.frequency.setValueAtTime(320, latchTime);
            thudOsc.frequency.exponentialRampToValueAtTime(110, latchTime + 0.08);

            const thudGain = ctx.createGain();
            thudGain.gain.setValueAtTime(0.0001, latchTime);
            thudGain.gain.linearRampToValueAtTime(0.24, latchTime + 0.003);
            thudGain.gain.exponentialRampToValueAtTime(0.0001, latchTime + 0.09);

            thudOsc.connect(thudGain);
            thudGain.connect(this.masterGain);

            thudOsc.start(latchTime);
            thudOsc.stop(latchTime + 0.1);
        }

        /**
         * Multi-ton Cargo Ground Impact & Metal Destruction Collision
         * "Uỳnh uỳnh như tiếng kim loại bị phá hủy":
         * 1. Ground-shattering seismic sub-bass blast (145 Hz -> 18 Hz).
         * 2. Secondary rebound destruction crunch at +110ms ("UỲNH... RẦM!").
         * 3. Violent structural steel tearing, girder buckling, and waveshaped plate distortion.
         * 4. Cavernous industrial yard echo & hollow metal hull ringing (160, 340, 720, 1280 Hz).
         */
        playImpact(speed, energyJoules = 0, surface = 'ground') {
            const ctx = this.initContext();
            if (!ctx || this.muted) return;
            const absSpeed = Math.abs(speed || 0);
            if (absSpeed < 0.18) return;

            const now = ctx.currentTime;
            const energyKJ = Math.max(0.5, energyJoules / 1000);

            // Severity: 0 = gentle landing, 1 = cataclysmic multi-ton destruction crash
            const severity = Math.min(1.0, Math.max(0.05, (absSpeed - 0.2) / 3.8));
            const masterImpactVol = Math.min(0.96, 0.22 + severity * 0.74);

            // --- 1. SEISMIC GROUND SHOCKWAVE DETONATION (UỲNH 1) ---
            const startFreq = 80 + severity * 65; // 80 Hz -> 145 Hz
            const endFreq = 18 + (1 - severity) * 10; // 18 Hz -> 28 Hz
            const boomDur = 0.22 + severity * 0.48;

            const boomOsc = ctx.createOscillator();
            boomOsc.type = severity > 0.4 ? 'sawtooth' : 'sine';
            boomOsc.frequency.setValueAtTime(startFreq, now);
            boomOsc.frequency.exponentialRampToValueAtTime(endFreq, now + boomDur);

            const boomFilter = ctx.createBiquadFilter();
            boomFilter.type = 'lowpass';
            boomFilter.frequency.setValueAtTime(220 + severity * 180, now);

            const shaper = typeof ctx.createWaveShaper === 'function' ? ctx.createWaveShaper() : null;
            if (shaper) shaper.curve = this.distortionCurve;

            const boomGain = ctx.createGain();
            boomGain.gain.setValueAtTime(0.0001, now);
            boomGain.gain.linearRampToValueAtTime(masterImpactVol * 0.94, now + 0.004);
            boomGain.gain.exponentialRampToValueAtTime(0.0001, now + boomDur);

            boomOsc.connect(boomFilter);
            if (shaper) {
                boomFilter.connect(shaper);
                shaper.connect(boomGain);
            } else {
                boomFilter.connect(boomGain);
            }
            boomGain.connect(this.masterGain);

            boomOsc.start(now);
            boomOsc.stop(now + boomDur + 0.05);

            // --- 2. SECONDARY REBOUND CRUNCH DESTRUCTION (UỲNH 2 at +110ms) ---
            if (severity > 0.25 || energyKJ > 15) {
                const t2 = now + 0.11;
                const reboundOsc = ctx.createOscillator();
                reboundOsc.type = 'triangle';
                reboundOsc.frequency.setValueAtTime(95, t2);
                reboundOsc.frequency.exponentialRampToValueAtTime(22, t2 + 0.35);

                const reboundGain = ctx.createGain();
                reboundGain.gain.setValueAtTime(0.0001, t2);
                reboundGain.gain.linearRampToValueAtTime(masterImpactVol * 0.72, t2 + 0.006);
                reboundGain.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.36);

                reboundOsc.connect(reboundGain);
                reboundGain.connect(this.masterGain);

                reboundOsc.start(t2);
                reboundOsc.stop(t2 + 0.40);
            }

            // --- 3. VIOLENT STEEL DEFORMATION & METAL TEARING CRUNCH ---
            if (this.noiseBuffer && (severity > 0.2 || energyKJ > 8)) {
                const crunchSrc = ctx.createBufferSource();
                crunchSrc.buffer = this.noiseBuffer;

                const crunchFilter = ctx.createBiquadFilter();
                crunchFilter.type = 'bandpass';
                crunchFilter.frequency.setValueAtTime(280 + severity * 360, now);
                crunchFilter.Q.setValueAtTime(2.4, now);

                const crunchShaper = typeof ctx.createWaveShaper === 'function' ? ctx.createWaveShaper() : null;
                if (crunchShaper) crunchShaper.curve = this.distortionCurve;

                const crunchDur = 0.12 + severity * 0.26;
                const crunchGain = ctx.createGain();
                crunchGain.gain.setValueAtTime(0.0001, now);
                crunchGain.gain.linearRampToValueAtTime(masterImpactVol * 0.78, now + 0.005);
                crunchGain.gain.exponentialRampToValueAtTime(0.0001, now + crunchDur);

                crunchSrc.connect(crunchFilter);
                if (crunchShaper) {
                    crunchFilter.connect(crunchShaper);
                    crunchShaper.connect(crunchGain);
                } else {
                    crunchFilter.connect(crunchGain);
                }
                crunchGain.connect(this.masterGain);

                crunchSrc.start(now);
                crunchSrc.stop(now + crunchDur + 0.05);
            }

            // --- 4. CAVERNOUS INDUSTRIAL HULL STEEL RESONANCE & ECHO ---
            if (severity > 0.25 || energyKJ > 12) {
                const ringFreqs = [180, 360, 720, 1280];
                const ringDur = 0.5 + severity * 1.3;

                ringFreqs.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq * (1.0 + (idx - 1) * 0.04), now);

                    const gain = ctx.createGain();
                    const amp = masterImpactVol * (0.42 / (idx + 1));
                    gain.gain.setValueAtTime(0.0001, now);
                    gain.gain.linearRampToValueAtTime(amp, now + 0.006);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + ringDur);

                    osc.connect(gain);
                    gain.connect(this.masterGain);

                    osc.start(now);
                    osc.stop(now + ringDur + 0.05);
                });
            }
        }

        // --- MUTE & VOLUME CONTROLS ---

        toggleMute() {
            this.muted = !this.muted;
            if (this.masterGain && this.ctx) {
                const now = this.ctx.currentTime;
                this.masterGain.gain.setTargetAtTime(this.muted ? 0.0001 : this.volume, now, 0.02);
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('lifting_sim_audio_muted', String(this.muted));
                }
            } catch (e) {}
            return this.muted;
        }

        isMuted() {
            return this.muted;
        }

        setVolume(val) {
            this.volume = Math.max(0, Math.min(1, val));
            if (this.masterGain && this.ctx && !this.muted) {
                this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('lifting_sim_audio_vol', String(this.volume));
                }
            } catch (e) {}
        }

        getVolume() {
            return this.volume;
        }
    }

    const simAudio = new LiftingAudioEngine();

    // Export to global scope
    global.simAudio = simAudio;
    global.LiftingAudioEngine = LiftingAudioEngine;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
