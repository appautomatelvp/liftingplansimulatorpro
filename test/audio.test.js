import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Procedural Audio Engine (LiftingAudioEngine)', () => {
    let AudioModule;
    let mockContext;
    let createdNodes;

    beforeEach(() => {
        createdNodes = {
            oscillators: [],
            gains: [],
            filters: [],
            bufferSources: []
        };

        const createMockParam = (defaultVal = 0) => {
            let val = defaultVal;
            return {
                get value() { return val; },
                set value(v) { val = v; },
                setValueAtTime: vi.fn((v) => { val = v; }),
                setTargetAtTime: vi.fn((v) => { val = v; }),
                linearRampToValueAtTime: vi.fn((v) => { val = v; }),
                exponentialRampToValueAtTime: vi.fn((v) => { val = v; })
            };
        };

        const createMockNode = (type, extra = {}) => {
            const node = {
                type,
                connect: vi.fn(),
                disconnect: vi.fn(),
                ...extra
            };
            return node;
        };

        mockContext = {
            currentTime: 0.1,
            sampleRate: 44100,
            state: 'running',
            destination: createMockNode('destination'),
            createGain: vi.fn(() => {
                const g = createMockNode('gain', {
                    gain: createMockParam(1.0)
                });
                createdNodes.gains.push(g);
                return g;
            }),
            createOscillator: vi.fn(() => {
                const osc = createMockNode('oscillator', {
                    type: 'sine',
                    frequency: createMockParam(440),
                    start: vi.fn(),
                    stop: vi.fn()
                });
                createdNodes.oscillators.push(osc);
                return osc;
            }),
            createBiquadFilter: vi.fn(() => {
                const f = createMockNode('biquadFilter', {
                    type: 'lowpass',
                    frequency: createMockParam(350),
                    Q: createMockParam(1)
                });
                createdNodes.filters.push(f);
                return f;
            }),
            createBufferSource: vi.fn(() => {
                const src = createMockNode('bufferSource', {
                    buffer: null,
                    loop: false,
                    start: vi.fn(),
                    stop: vi.fn()
                });
                createdNodes.bufferSources.push(src);
                return src;
            }),
            createWaveShaper: vi.fn(() => {
                const ws = createMockNode('waveShaper', {
                    curve: null
                });
                return ws;
            }),
            createBuffer: vi.fn((channels, length, sampleRate) => {
                const data = new Float32Array(length);
                return {
                    numberOfChannels: channels,
                    length,
                    sampleRate,
                    getChannelData: vi.fn(() => data)
                };
            }),
            resume: vi.fn().mockResolvedValue(undefined)
        };

        globalThis.window = globalThis;
        // A native constructor stub is more portable across Vitest major versions
        // than constructing a vi.fn() whose implementation returns an object.
        globalThis.window.AudioContext = class MockAudioContext {
            constructor() {
                return mockContext;
            }
        };
        globalThis.localStorage = {
            store: {},
            getItem(key) { return this.store[key] || null; },
            setItem(key, val) { this.store[key] = String(val); },
            removeItem(key) { delete this.store[key]; }
        };

        // Load audio.js code into execution scope
        const audioSrc = fs.readFileSync(path.resolve('src/sim/audio.js'), 'utf8');
        const evalFn = new Function(audioSrc);
        evalFn();
    });

    it('1. Initializes safely and sets up master gain and noise buffers', () => {
        const engine = new globalThis.LiftingAudioEngine();
        expect(engine).toBeDefined();
        expect(engine.isMuted()).toBe(false);
        expect(engine.getVolume()).toBeCloseTo(0.85);

        const ctx = engine.initContext();
        expect(ctx).toBe(mockContext);
        expect(engine.noiseBuffer).toBeDefined();
        expect(engine.winchNodes).toBeDefined();
        expect(engine.fallNodes).toBeDefined();
    });

    it('2. Controls master volume and mute with persistence', () => {
        const engine = new globalThis.LiftingAudioEngine();
        engine.initContext();

        // Mute
        const isMuted = engine.toggleMute();
        expect(isMuted).toBe(true);
        expect(globalThis.localStorage.getItem('lifting_sim_audio_muted')).toBe('true');

        // Unmute
        const unmuted = engine.toggleMute();
        expect(unmuted).toBe(false);
        expect(globalThis.localStorage.getItem('lifting_sim_audio_muted')).toBe('false');

        // Volume clamping
        engine.setVolume(1.5);
        expect(engine.getVolume()).toBe(1.0);
        engine.setVolume(-0.5);
        expect(engine.getVolume()).toBe(0.0);
        engine.setVolume(0.65);
        expect(engine.getVolume()).toBe(0.65);
        expect(globalThis.localStorage.getItem('lifting_sim_audio_vol')).toBe('0.65');
    });

    it('3. Modulates winch sound dynamically with speed and load ratio', () => {
        const engine = new globalThis.LiftingAudioEngine();
        engine.initContext();

        // When idle (speed = 0)
        engine.updateWinch(0, false, 0.2);
        expect(engine.winchNodes.master.gain.setTargetAtTime).toHaveBeenCalledWith(0.0001, expect.any(Number), expect.any(Number));

        // When hoisting
        engine.updateWinch(0.65, false, 0.8);
        const [gainVal] = engine.winchNodes.master.gain.setTargetAtTime.mock.calls.at(-1);
        expect(gainVal).toBeGreaterThan(0.1);
        // High load hoist has higher motor pitch
        const [freqVal] = engine.winchNodes.motorOsc.frequency.setTargetAtTime.mock.calls.at(-1);
        expect(freqVal).toBeGreaterThan(45);

        // When lowering
        engine.updateWinch(-0.65, false, 0.4);
        // Lowering has deeper motor frequency (~32 Hz)
        const [lowerFreqVal] = engine.winchNodes.motorOsc.frequency.setTargetAtTime.mock.calls.at(-1);
        expect(lowerFreqVal).toBe(32);
    });

    it('4. Free-fall wind whoosh activates only when vertical descent is fast', () => {
        const engine = new globalThis.LiftingAudioEngine();
        engine.initContext();

        // Low speed: muted
        engine.updateFallWind(0.4);
        expect(engine.fallNodes.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.0001, expect.any(Number), expect.any(Number));

        // High fall speed: opens filter cutoff and raises volume
        engine.updateFallWind(6.5);
        const [fallGainVal] = engine.fallNodes.gain.gain.setTargetAtTime.mock.calls.at(-1);
        expect(fallGainVal).toBeGreaterThan(0.2);
        const [fallFreqVal] = engine.fallNodes.filter.frequency.setTargetAtTime.mock.calls.at(-1);
        expect(fallFreqVal).toBeGreaterThan(1000);
    });

    it('5. Cable snap plays supersonic crack, high-frequency whip ping, and sub-bass thump', () => {
        const engine = new globalThis.LiftingAudioEngine();
        engine.initContext();

        const oscCountBefore = createdNodes.oscillators.length;
        engine.playCableSnap({ type: 'wire', role: 'leg' });
        const oscCountAfter = createdNodes.oscillators.length;

        // Must have created high-Q steel ringing oscillators and sub-bass thump
        expect(oscCountAfter).toBeGreaterThan(oscCountBefore);

        // Chain sling snap uses square oscillator for link fracture
        engine.playCableSnap({ type: 'chain', role: 'leg' });
        const chainOscs = createdNodes.oscillators.filter(o => o.type === 'square');
        expect(chainOscs.length).toBeGreaterThan(0);
    });

    it('6. Cable reeve plays 3-stage mechanical clink and lock sequence', () => {
        const engine = new globalThis.LiftingAudioEngine();
        engine.initContext();

        const oscCountBefore = createdNodes.oscillators.length;
        engine.playCableReeve();
        const oscCountAfter = createdNodes.oscillators.length;

        // Reeve sequence schedules multiple tactile clink oscillators
        expect(oscCountAfter - oscCountBefore).toBeGreaterThanOrEqual(4);
    });

    it('7. Cargo impact scales acoustic severity from gentle touchdown to high-energy crash', () => {
        const engine = new globalThis.LiftingAudioEngine();
        engine.initContext();

        // Speed under threshold is ignored
        const oscCount0 = createdNodes.oscillators.length;
        engine.playImpact(0.1, 50);
        expect(createdNodes.oscillators.length).toBe(oscCount0);

        // Soft touchdown (0.5 m/s)
        engine.playImpact(0.5, 2500, 'touchdown');
        const oscCountSoft = createdNodes.oscillators.length;
        expect(oscCountSoft).toBeGreaterThan(oscCount0);

        // Violent crash (5.0 m/s, 250 kJ)
        engine.playImpact(5.0, 250000, 'ground');
        const oscCountCrash = createdNodes.oscillators.length;
        // Severe crash triggers additional resonant hull ring oscillators
        expect(oscCountCrash - oscCountSoft).toBeGreaterThan(oscCountSoft - oscCount0);
    });

    it('8. Safe in headless environment without Web Audio support', () => {
        // Remove AudioContext
        delete globalThis.window.AudioContext;
        delete globalThis.window.webkitAudioContext;

        const headlessEngine = new globalThis.LiftingAudioEngine();
        expect(headlessEngine.initContext()).toBeNull();

        // All calls must be safe no-ops
        expect(() => {
            headlessEngine.updateWinch(1.0, false, 0.5);
            headlessEngine.updateFallWind(5.0);
            headlessEngine.playCableSnap();
            headlessEngine.playCableReeve();
            headlessEngine.playImpact(4.0, 100000);
            headlessEngine.toggleMute();
            headlessEngine.setVolume(0.5);
        }).not.toThrow();
    });
});
