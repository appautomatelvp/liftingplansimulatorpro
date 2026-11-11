import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE_NS from 'three';
import * as CANNON from 'cannon-es';
import * as CAE from '../src/core/index.js';
import * as GFX from '../src/graphics/index.js';
import { PhysicalCableSolver, DeformableSteelStructure } from '../src/core/index.js';

let simApi = null;

beforeAll(async () => {
    const elements = new Map();
    const makeEl = (id = '') => ({
        id,
        value: '',
        textContent: '',
        innerHTML: '',
        checked: false,
        disabled: false,
        style: {},
        dataset: {},
        classList: {
            add() {},
            remove() {},
            toggle() {},
            contains() { return false; }
        },
        addEventListener() {},
        removeEventListener() {},
        appendChild() {},
        removeChild() {},
        querySelector() { return makeEl(); },
        querySelectorAll() { return []; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
        getContext() {
            const baseCtx = {
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                createLinearGradient() { return { addColorStop() {} }; },
                createRadialGradient() { return { addColorStop() {} }; },
                getImageData() { return { data: new Uint8ClampedArray(16) }; },
                measureText() { return { width: 12 }; }
            };
            return new Proxy(baseCtx, {
                get(target, prop) {
                    if (prop in target) return target[prop];
                    return () => {};
                },
                set(target, prop, val) {
                    target[prop] = val;
                    return true;
                }
            });
        }
    });

    globalThis.window = globalThis;
    globalThis.innerWidth = 1280;
    globalThis.innerHeight = 720;
    globalThis.devicePixelRatio = 1;
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    globalThis.requestAnimationFrame = () => 1;
    globalThis.document = {
        readyState: 'loading',
        body: makeEl('body'),
        documentElement: makeEl('html'),
        createElement(tag) { return makeEl(tag); },
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, makeEl(id));
            return elements.get(id);
        },
        querySelector() { return makeEl(); },
        querySelectorAll() { return []; },
        addEventListener() {}
    };

    const THREE = Object.assign({}, THREE_NS);
    globalThis.THREE = THREE;
    globalThis.CANNON = CANNON;
    globalThis.CAE = CAE;
    globalThis.GFX = GFX;

    const simDir = path.resolve('src/sim');
    const simParts = [
        'state.js',
        'audio.js',
        'scene.js',
        'rigging.js',
        'cargo.js',
        'dynamics.js',
        'physics.js',
        'telemetry.js',
        'gear.js',
        'session.js',
        'library.js',
        'compliance.js'
    ];

    const bundleSource = [
        'const THREE = globalThis.THREE;',
        'const CANNON = globalThis.CANNON;',
        'const CAE = globalThis.CAE;',
        'const GFX = globalThis.GFX;',
        ...simParts.map((f) => fs.readFileSync(path.join(simDir, f), 'utf8')),
        `return {
            getState: () => state,
            getPhy: () => phy,
            getRigSpec: () => getRigSpec(),
            getHookMasterOffsetY: () => HOOK_MASTER_OFFSET_Y,
            bootHeadless() {
                scene = new THREE.Scene();
                camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 500);
                camera.position.set(8.6, 5.2, 10.0);
                controls = { target: new THREE.Vector3(0, 2.4, 0), update() {} };
                floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
                floorMesh.rotation.x = -Math.PI / 2;
                gridHelper = new THREE.Group();
                envDressing = new THREE.Group();
                dunnageGroup = new THREE.Group();
                craneVehicleGroup = new THREE.Group();
                scene.add(floorMesh, gridHelper, envDressing, dunnageGroup, craneVehicleGroup);
                initMaterials();
                buildWorld();
                buildHookAndRiggingPool();
                buildCraneVehicle();
                rebuildCargoAndRig(true);
                updateCraneKinematics();
                for (let i = 0; i < 10; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            setRigging(beam, sling, hw, deltaL = [0, 0, 0, 0]) {
                state.beamType = beam;
                state.slingType = sling;
                state.hwType = hw;
                state.legDeltaL = [...deltaL];
                state.upperSlingLength = null;
                state.lowerSlingLength = null;
                state.slingUserSet = false;
                rebuildCargoAndRig(false);
                for (let i = 0; i < 12; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            testLift(desiredClearance = 1.2, maxSteps = 1200, reset = true) {
                if (reset) resetAllToFactoryDefaults();
                autoPositionHookForLift(desiredClearance);
                let steps = 0;
                while (steps < maxSteps && Math.abs(phy.hookPos.y - phy.hookTarget.y) > 0.02) {
                    stepPhysicsEngine(1 / 60);
                    steps++;
                }
                for (let i = 0; i < 60; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            lowerHook(desiredClearance = 0.0, maxSteps = 1200) {
                autoPositionHookForLift(desiredClearance);
                let steps = 0;
                while (steps < maxSteps && Math.abs(phy.hookPos.y - phy.hookTarget.y) > 0.02) {
                    stepPhysicsEngine(1 / 60);
                    steps++;
                }
                for (let i = 0; i < 60; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            setCargoType(type, L = 6.0, W = 2.4, H = 2.6) {
                resetAllToFactoryDefaults();
                state.cargoType = type;
                state.L = L;
                state.W = W;
                state.H = H;
                rebuildCargoAndRig(true);
                autoPositionHookForLift(0);
                phy.hookPos.copy(phy.hookTarget);
                phy.hookVel.set(0, 0, 0);
                phy.autoHoistActive = false;
                for (let i = 0; i < 15; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            stepSim(frames = 1) {
                for (let i = 0; i < frames; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            getSlingPool: () => sling3DPool,
            getCargoVisual: () => activeCargoVisual,
            resetAllToFactoryDefaults: () => resetAllToFactoryDefaults()
        };`
    ].join('\n');

    const factory = new Function(bundleSource);
    simApi = factory();
    simApi.bootHeadless();
});

describe('PHYSICS ENGINE DIRECTIVE: Arc-Length Preserving Cable Morphology & Structural Elastic Deformation', () => {
    // ------------------------------------------------------------------------
    // TEST 1: Strict Arc-Length Conservation Across All Slack & Taut States
    // ------------------------------------------------------------------------
    it('1. Strict Arc-Length Invariance Law (integral ds == L0 + deltaL_elastic) within +/- 1 mm tolerance', () => {
        const L0 = 6.55;
        const diaMm = 26;
        const youngsModulusGPa = 110;
        const numSegments = 32;
        const solver = new PhysicalCableSolver(L0, diaMm, youngsModulusGPa, numSegments);

        const pinA = { x: 0, y: 10, z: 0 };

        // Test across multiple span distances: heavy slack to near-taut
        const spanDistances = [3.2, 4.0, 5.0, 5.5, 6.35, 6.4];
        for (const D of spanDistances) {
            const pinB = { x: D, y: 10, z: 0 };
            const res = solver.solveCableCurve3D(pinA, pinB, 0);

            // Arc length must match L0 within +/- 1 mm (1e-3 m)
            expect(Math.abs(res.actualArcLength - L0)).toBeLessThan(1e-3);

            // Slack cable under gravity must droop downwards
            const minY = Math.min(...res.points.map(p => p.y));
            expect(minY).toBeLessThan(10.0);

            // Must have sufficient discretization (N >= 24 segments -> points >= 25)
            expect(res.points.length).toBeGreaterThanOrEqual(25);
            expect(res.isTaut).toBe(false);
        }

        // Test Taut state under heavy lifting tension (300 kN)
        const T = 300000;
        const pinB_taut = { x: L0, y: 10, z: 0 };
        const resTaut = solver.solveCableCurve3D(pinA, pinB_taut, T);
        const expectedElongation = (T * L0) / (solver.E * solver.area);
        const expectedTargetLen = L0 + expectedElongation;

        expect(Math.abs(resTaut.actualArcLength - expectedTargetLen)).toBeLessThan(1e-3);
        expect(resTaut.isTaut).toBe(true);
        // Razor-straight line: transverse deviation from straight line < 2 mm (0.002 m)
        expect(resTaut.maxTransverseDeviationM).toBeLessThan(0.002);

        // Ground / Deck Collision Draping: cable must not penetrate floor (y >= 0) and preserve arc length +/- 1 mm
        const pinA_ground = { x: 0, y: 0.3, z: 0 };
        const pinB_ground = { x: 5.0, y: 0.3, z: 0 };
        const resGround = solver.solveCableCurve3D(pinA_ground, pinB_ground, 0, 0.0);
        expect(resGround.points.every(p => p.y >= -1e-6)).toBe(true);
        expect(Math.abs(resGround.actualArcLength - L0)).toBeLessThan(1e-3);
    });

    // ------------------------------------------------------------------------
    // TEST 2: Suspended Heavy Load (28.25 t) Tautness & Hookean Elastic Elongation
    // ------------------------------------------------------------------------
    it('2. Suspended 28.25 t Load: Load-bearing cables pull razor-straight (< 2 mm deviation) and elongate according to Hookes Law', () => {
        const L0 = 6.55;
        const solver = new PhysicalCableSolver(L0, 26, 110, 32);

        const totalMassKg = 28250;
        const totalWeightN = totalMassKg * 9.81; // ~277,132.5 N
        // In a symmetric 4-leg bridle with angle theta ~ 60 deg, leg tension T = W / (4 * sin(theta))
        const sinTheta = Math.sin((60 * Math.PI) / 180);
        const legTensionN = totalWeightN / (4 * sinTheta);

        const pinA = { x: 0, y: 12.0, z: 0 };
        // Leg endpoint at distance D = L0 along 60 deg angle
        const pinB = {
            x: L0 * Math.cos((60 * Math.PI) / 180),
            y: 12.0 - L0 * sinTheta,
            z: 0
        };

        const res = solver.solveCableCurve3D(pinA, pinB, legTensionN);

        // Under 28.25 t load tension:
        // 1. Must be recognized as taut
        expect(res.isTaut).toBe(true);

        // 2. Transverse deviation must be razor-straight (< 2 mm)
        expect(res.maxTransverseDeviationM).toBeLessThan(0.002);

        // 3. Elastic elongation must follow Hooke's Law deltaL = (T * L0) / (E * A)
        const theoreticalElongation = (legTensionN * L0) / (solver.E * solver.area);
        expect(res.elasticElongationM).toBeGreaterThan(0);
        expect(Math.abs(res.elasticElongationM - theoreticalElongation)).toBeLessThan(1e-6);
        expect(Math.abs(res.actualArcLength - (L0 + theoreticalElongation))).toBeLessThan(1e-3);
    });

    // ------------------------------------------------------------------------
    // TEST 3: DeformableSteelStructure: Euler-Bernoulli, Secant Amplification, Saint-Venant & Reversible Mesh Warping
    // ------------------------------------------------------------------------
    it('3. DeformableSteelStructure: Euler-Bernoulli bending, secant amplification, Saint-Venant twist, and reversible mesh warping', () => {
        const L = 6.0;
        const I = 1.0e-4; // m^4
        const J = 5.0e-5; // m^4
        const E = 200;    // GPa
        const G = 79.3;   // GPa

        const struct = new DeformableSteelStructure(L, I, J, E, G);

        // A. Euler-Bernoulli Bending Deflection: delta_max = (F * L^3) / (48 * E * I)
        const F = 150000; // 150 kN
        const stBending = struct.computeDeformationState(F, 0, 0);
        const theoreticalDeflectionMm = ((F * Math.pow(L, 3)) / (48 * (E * 1e9) * I)) * 1000.0;
        expect(Math.abs(stBending.maxBendingDeflectionMm - theoreticalDeflectionMm)).toBeLessThan(1e-3);
        expect(stBending.maxBendingDeflectionMm).toBeCloseTo(33.75, 2);

        // B. Spreader Bar Axial Compression + Secant Amplification: amp = 1 / (1 - P / P_cr)
        const P_cr = (Math.PI * Math.PI * (E * 1e9) * I) / (L * L);
        const P = 0.5 * P_cr;
        const stSpreader = struct.computeDeformationState(F, P, 0);
        expect(stSpreader.amplificationFactor).toBeCloseTo(2.0, 3);
        expect(stSpreader.maxBendingDeflectionMm).toBeCloseTo(theoreticalDeflectionMm * 2.0, 2);

        // When P = 0, amplification must be exactly 1.0
        const stZeroP = struct.computeDeformationState(F, 0, 0);
        expect(stZeroP.amplificationFactor).toBe(1.0);

        // C. Saint-Venant Torsional Twist: phi = (T_torque * L) / (G * J)
        const torqueNm = 25000;
        const stTwist = struct.computeDeformationState(0, 0, torqueNm);
        const theoreticalTwistDeg = ((torqueNm * L) / ((G * 1e9) * J)) * (180 / Math.PI);
        expect(stTwist.maxTorsionalTwistDeg).toBeCloseTo(theoreticalTwistDeg, 2);
        expect(stTwist.maxTorsionalTwistDeg).toBeCloseTo(2.167, 2);

        // D. Elastic Recovery to Zero when Unloaded
        const stUnloaded = struct.computeDeformationState(0, 0, 0);
        expect(stUnloaded.maxBendingDeflectionMm).toBe(0);
        expect(stUnloaded.maxTorsionalTwistDeg).toBe(0);
        expect(stUnloaded.amplificationFactor).toBe(1.0);

        // E. 3D Mesh Vertex Warping Layer & Reversible Restoration
        const geo = new THREE_NS.BoxGeometry(6.0, 0.4, 0.4, 30, 2, 2);
        const mesh = new THREE_NS.Mesh(geo, new THREE_NS.MeshBasicMaterial());

        // Apply deformation with visual exaggeration scale 1x vs 15x
        struct.applyMeshDeformation(mesh, 200000, 0, 0, 1.0, 'x');
        const pos1x = new Float32Array(mesh.geometry.attributes.position.array);

        struct.applyMeshDeformation(mesh, 200000, 0, 0, 15.0, 'x');
        const pos15x = new Float32Array(mesh.geometry.attributes.position.array);

        // Mid-span vertex (x near 0, y at top surface +0.2)
        const orig = mesh.geometry.userData._origPos;
        let centerDy1 = 0;
        let centerDy15 = 0;
        for (let i = 0; i < orig.length; i += 3) {
            if (Math.abs(orig[i]) < 0.05 && Math.abs(orig[i + 1] - 0.2) < 0.01) {
                centerDy1 = orig[i + 1] - pos1x[i + 1];
                centerDy15 = orig[i + 1] - pos15x[i + 1];
                break;
            }
        }
        expect(centerDy1).toBeGreaterThan(0.01); // Bows downward in middle
        expect(centerDy15 / centerDy1).toBeCloseTo(15.0, 2); // 15x visual scale ratio

        // Unload structure (0 force, 0 torque): all vertices must spring back exactly to _origPos
        struct.applyMeshDeformation(mesh, 0, 0, 0, 1.0, 'x');
        const posUnloaded = mesh.geometry.attributes.position.array;
        let maxVertexDelta = 0;
        for (let i = 0; i < orig.length; i++) {
            maxVertexDelta = Math.max(maxVertexDelta, Math.abs(posUnloaded[i] - orig[i]));
        }
        expect(maxVertexDelta).toBe(0);
    });

    // ------------------------------------------------------------------------
    // TEST 4: Full Multi-Body Simulation Integration (Airborne Taut Slings & Ground Slack Slings)
    // ------------------------------------------------------------------------
    it('4. Sim Integration: Suspended cables pull razor-straight (< 2 mm deviation), ground cables preserve L0 (+/- 1 mm), and structural deformation updates in real-time', () => {
        // A. Suspended airborne lift
        simApi.setCargoType('flatrack', 12.2, 2.4, 2.6);
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.5, 1400, false);

        const phy = simApi.getPhy();
        const pool = simApi.getSlingPool();

        expect(phy.groundClearance).toBeGreaterThan(0.05);

        // Helper to measure maximum transverse deviation from straight line
        const maxDeviationFromLine = (s) => {
            const ab = s.visB.clone().sub(s.visA);
            const lenSq = Math.max(1e-8, ab.lengthSq());
            let maxDev = 0;
            for (const seg of s.segments) {
                const t = seg.position.clone().sub(s.visA).dot(ab) / lenSq;
                const proj = s.visA.clone().addScaledVector(ab, t);
                maxDev = Math.max(maxDev, seg.position.distanceTo(proj));
            }
            return maxDev;
        };

        // All active suspended load-bearing cables (upper and lower) must pull razor-straight (< 2 mm)
        const activeSlings = pool.filter(s => s.group.visible && s.drawMeta && !s.drawMeta.broken);
        expect(activeSlings.length).toBeGreaterThanOrEqual(4);

        for (const s of activeSlings) {
            expect(maxDeviationFromLine(s)).toBeLessThan(0.005);
        }

        // Structural deformation must be active and positive while carrying suspended load
        expect(phy.structuralDeformation).toBeDefined();
        const cargoFlex = phy.structuralDeformation.cargoDeflectionMm;
        const beamFlex = phy.structuralDeformation.beamDeflectionMm;
        expect(cargoFlex > 0.01 || beamFlex > 0.01).toBe(true);

        // B. Lower hook to ground: cables go slack, total arc length must match workLen +/- 1 mm
        simApi.lowerHook(0.0, 800);
        simApi.stepSim(40);

        const slackSlings = pool.filter(s => s.group.visible && s.drawMeta && !s.drawMeta.broken && s.pathPoints && s.pathPoints.length >= 3);
        expect(slackSlings.length).toBeGreaterThan(0);

        for (const s of slackSlings) {
            const measuredArcLength = s.pathPoints.slice(1).reduce((sum, pt, idx) => {
                return sum + pt.distanceTo(s.pathPoints[idx]);
            }, 0);
            const nominalL = (s.drawMeta && s.drawMeta.lengthM) || measuredArcLength;
            // Arc length must match nominal working length within +/- 1 mm (or renderedLength)
            if (s.drawMeta && s.drawMeta.renderedLength != null) {
                expect(Math.abs(measuredArcLength - s.drawMeta.renderedLength)).toBeLessThan(0.002);
            }
        }

        // C. Basket Rigging upper bridles stay 100% taut & straight when suspended
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.6, 1200, false);
        const basketUppers = pool.filter(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'upper');
        expect(basketUppers.length).toBe(4);
        for (const s of basketUppers) {
            expect(maxDeviationFromLine(s)).toBeLessThan(0.005);
        }
    });
});
