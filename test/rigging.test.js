import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE_NS from 'three';
import * as CANNON from 'cannon-es';
import * as CAE from '../src/core/index.js';
import * as GFX from '../src/graphics/index.js';

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
            getWaterMesh: () => waterMesh,
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
            setCrane(c) {
                state.craneType = c;
                buildCraneVehicle();
                updateCraneKinematics();
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
            setCargoType(type, L = 6.0, W = 2.4, H = 2.6) {
                resetAllToFactoryDefaults();
                state.cargoType = type;
                state.L = L;
                state.W = W;
                state.H = H;
                rebuildCargoAndRig(true);
                for (let i = 0; i < 15; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            stepSim(frames = 1) {
                for (let i = 0; i < frames; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            getSlingPool: () => sling3DPool,
            getCargoVisual: () => activeCargoVisual,
            getLibraryCatalog: () => libraryCatalog,
            getSpreaderGroup: () => spreaderRootGroup,
            getHookGroup: () => hookAssemblyGroup,
            getDunnageGroup: () => dunnageGroup,
            getScene: () => scene,
            mountBeamBodies: () => mountBeamBodies(),
            getBeamSegments: (beam) => beamSegments(beam),
            getBeamSamples: (beam, count) => beamContactSamples(beam, count),
            getBeamCollisionRadius: (beam) => beamCollisionRadius(beam),
            snapCable(role, index) {
                const cable = (phy.cables || []).find(c => c.role === role && c.index === index);
                if (cable) noteCableSnap(cable, 'Test cable cut.');
            },
            cutSelectedRiggingCables: () => cutSelectedRiggingCables(),
            beginHookDrag(target, pointerSpeed = 6.0) {
                state.poseLock = false;
                dragTarget = {
                    type: 'hook',
                    pointerSpeed,
                    lastWorld: target.clone(),
                    lastMoveMs: 0
                };
                phy.dragHookSpeed = 0;
                phy.hookTarget.copy(target);
            },
            endHookDrag() {
                phy.hookTarget.copy(phy.hookPos);
                phy.dragHookSpeed = 0;
                phy.dragHookLoadCoupling = 0;
                dragTarget = null;
            },
            getHookDragCoupling: () => hookDragLoadCoupling(),
            routeRopeAroundBeams: (points, radius, allowA = [], allowB = []) => routeRopeAroundBeams(points, radius, allowA, allowB),
            ropeBeamClearance(points, beam) {
                let minimum = Infinity;
                const rails = beamSegments(beam);
                for (let i = 0; i < points.length - 1; i++) {
                    rails.forEach(([a, b]) => {
                        const hit = closestOnSegments(points[i], points[i + 1], a, b);
                        minimum = Math.min(minimum, hit.pa.distanceTo(hit.pb));
                    });
                }
                return minimum;
            },
            attachWorld: (end) => attachWorld(end),
            pushOutOfCargo: (p, rad) => pushOutOfCargoShellWorld(p, rad),
            buildHwMesh: (type) => buildHardwareMesh(type),
            buildSlingPreviewMesh: (id) => buildSlingLibraryPreviewMesh(id),
            rebuildCargo: (reset = false) => rebuildCargoAndRig(reset),
            solveRope: (a, b, L, r) => solveDrapedRopePath(a, b, L, r),
            getCargoShellTopY: (x, z) => cargoShellTopWorldY(x, z, 0.15),
            getPadEyeRing: (i) => padEyeRingWorld(i).ring,
            getCrownOffset: (hw, scale) => hardwareCrownOffset(hw, scale),
            getCargoShackleScale: (i) => cargoShackleScale(i),
            dentCargo: (speed) => dentCargo(speed),
            buildLiftPlanModel: () => buildCurrentLiftPlanModel(),
            saveUserInitialBaselineState: () => saveUserInitialBaselineState(),
            resetToUserInitialBaselineState: () => resetToUserInitialBaselineState(),
            openCompliance: () => {
                const panel = document.getElementById('compliance-hud-panel');
                panel.classList.contains = () => false;
                updateComplianceHUD();
                return panel.innerHTML || document.getElementById('comp-hud-list').innerHTML;
            }
        };`
    ].join('\n');

    const factory = new Function(bundleSource);
    simApi = factory();
    simApi.bootHeadless();
});

describe('3D Rigging Testbed, Hardware Geometry & Mass Deductions', () => {
    it('1. Removes all seaport water/harbour clutter and boots on flat studio testbed', () => {
        const st = simApi.getState();
        expect(simApi.getWaterMesh()).toBeNull();
        expect(st.sceneId).toBe('studio');
        expect(st.groundId).toBe('flat');
        expect(simApi.getHookMasterOffsetY()).toBeCloseTo(-0.56, 3);
    });

    it('2. Computes realistic physical rigging mass breakdown (never hardcoded 9.5T)', () => {
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        const phy = simApi.getPhy();
        const mb = phy.massBreakdown;
        expect(mb).toBeTruthy();
        // Modulift tubular spreader + slings + shackles should be ~0.3T - 1.2T, NOT 9.5T
        expect(mb.belowHookRiggingT).toBeGreaterThan(0.15);
        expect(mb.belowHookRiggingT).toBeLessThan(1.5);
        expect(mb.grossCraneLoadT).toBeCloseTo(mb.cargoNetT + mb.belowHookRiggingT + mb.hookBlockT, 3);

        // H-section lifting beam is heavier in bending than tubular compression spreader of same span
        const spreaderBeamT = mb.beamMassT;
        simApi.setRigging('lifting_beam', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        const liftingBeamT = simApi.getPhy().massBreakdown.beamMassT;
        expect(liftingBeamT).toBeGreaterThan(spreaderBeamT);
    });

    it('3. Builds all 4 crane modes and all beam/sling/shackle/turnbuckle combinations without NaN', () => {
        for (const c of ['hook_only', 'mobile_telescopic', 'crawler', 'gantry']) {
            simApi.setCrane(c);
        }
        for (const beam of ['spreader', 'lifting_beam', 'cascaded', 'frame', 'modular_truss', 'basket', 'none', 'container_spreader']) {
            for (const sling of ['wire', 'chain', 'web']) {
                simApi.setRigging(beam, sling, 'bow_shackle', [0.08, -0.05, 0, 0]);
                const phy = simApi.getPhy();
                expect(Number.isNaN(phy.maxAngleVert)).toBe(false);
                expect(Number.isNaN(phy.beamCompression)).toBe(false);
                for (const t of phy.legTensions) {
                    expect(Number.isNaN(t)).toBe(false);
                }
            }
        }
    });

    it('4. Suspended lift develops equilibrium hook load equal to cargo + below-hook rigging weight', () => {
        simApi.setCargoType('crate', 4.5, 2.6, 2.4);
        const st = simApi.getState();
        st.weight = 16.0;
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.2, 950, false);

        const phy = simApi.getPhy();
        expect(phy.groundClearance).toBeGreaterThan(0.8);
        const totalLegTension = phy.legTensions.slice(0, 4).reduce((s, v) => s + v, 0);
        expect(totalLegTension).toBeGreaterThan(st.weight * 0.98);
        expect(phy.beamCompression).toBeGreaterThan(2.0);

        const compHtml = simApi.openCompliance();
        expect(compHtml).not.toContain('NaN');

        const planModel = simApi.buildLiftPlanModel();
        const planJson = JSON.parse(planModel.exportJSON());
        expect(planJson.cargo.grossWeightKg).toBe(16000);
        expect(planJson.rigging.spreaderMassKg).toBeGreaterThan(150);
        expect(planJson.rigging.spreaderMassKg).toBeLessThan(1500);
    });

    it('5. Hook and Spreader stop strictly on the outer 3D shell of the cargo when lowered (never penetrating cargo center)', () => {
        for (const cargoType of ['container', 'vessel', 'crate']) {
            simApi.setCargoType(cargoType, 6.0, 2.5, 2.6);
            const st = simApi.getState();
            const phy = simApi.getPhy();

            // Attempt to drive hook all the way down to y = 0.5m (into the center of the cargo) in both poseLock=true and poseLock=false
            for (const lockMode of [true, false]) {
                st.poseLock = lockMode;
                phy.hookTarget.set(0, 0.5, 0);
                phy.hoistSpeed = -0.65;
                simApi.stepSim(120);
                phy.hoistSpeed = 0;

                const shellTopY = simApi.getCargoShellTopY(0, 0);
                const masterBottomY = phy.hookPos.y - 0.58;
                // Master Link bottom must remain at or above the cargo's outer shell top
                expect(masterBottomY).toBeGreaterThanOrEqual(shellTopY - 0.01);
            }
        }
    });

    it('6. Releasing hoist button arrests cargo smoothly with zero upward catapult bounce', () => {
        simApi.setCargoType('container', 6.1, 2.44, 2.59);
        const st = simApi.getState();
        const phy = simApi.getPhy();
        st.poseLock = false;

        // Simulate holding the Hoist Up button for 90 frames
        phy.autoHoistActive = false;
        phy.hookTarget.copy(phy.hookPos);
        phy.hoistSpeed = 0.65;
        simApi.stepSim(90);

        // Release Hoist Up button (same as pointerup handler)
        phy.hoistSpeed = 0;
        phy.hookTarget.copy(phy.hookPos);
        phy.hookVel.set(0, 0, 0);

        const yAtRelease = phy.cargoPos.y;
        let maxUpwardVelAfterRelease = -Infinity;
        let maxOvershootY = 0;
        for (let f = 0; f < 30; f++) {
            simApi.stepSim(1);
            if (phy.cargoVel.y > maxUpwardVelAfterRelease) maxUpwardVelAfterRelease = phy.cargoVel.y;
            if (phy.cargoPos.y - yAtRelease > maxOvershootY) maxOvershootY = phy.cargoPos.y - yAtRelease;
        }
        expect(maxUpwardVelAfterRelease).toBeLessThanOrEqual(0.04);
        expect(maxOvershootY).toBeLessThanOrEqual(0.015);
    });

    it('7. Slings on cylindrical vessel & crate remain 100% locked to shackle crowns at both ends without mid-air box kinks', () => {
        simApi.setCargoType('vessel', 6.8, 2.6, 2.8);
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        const st = simApi.getState();
        const phy = simApi.getPhy();

        // Lower hook so slings drape over the cylindrical vessel (keep chord long enough for eye thimbles)
        phy.hookTarget.y = 5.4;
        simApi.stepSim(80);

        const pool = simApi.getSlingPool();
        for (let i = 0; i < 4; i++) {
            const legSling = pool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === i);
            expect(legSling).toBeTruthy();
            expect(legSling.endEyeB.visible).toBe(true);

            // Verify shackle pin + shackleDirB * crownOffset equals the exact rendered sling end visB
            const ring = simApi.getPadEyeRing(i);
            const insetB = simApi.getCrownOffset(st.hwType || 'bow_shackle', simApi.getCargoShackleScale(i));
            const expectedCrownB = ring.clone().addScaledVector(legSling.shackleDirB, insetB);
            expect(legSling.visB.distanceTo(expectedCrownB)).toBeLessThan(0.005);
            expect(legSling.endEyeB.position.distanceTo(expectedCrownB)).toBeLessThan(0.005);
        }
    });

    it('8. Symmetric slack cables (LP1 vs LP4, LP2 vs LP3) hang with identical sag depth and zero wavy buckling', () => {
        simApi.setCargoType('crate', 4.8, 2.8, 2.5);
        const phy = simApi.getPhy();
        // Lower spreader close to cargo top so all 4 lower legs have significant slack
        phy.hookTarget.y = 3.9;
        simApi.stepSim(80);

        const a1 = new THREE_NS.Vector3(2.2, 2.85, 1.3);
        const b1 = new THREE_NS.Vector3(2.2, 2.65, 1.3);
        const a4 = new THREE_NS.Vector3(2.2, 2.85, -1.3);
        const b4 = new THREE_NS.Vector3(2.2, 2.65, -1.3);

        const pts1 = simApi.solveRope(a1, b1, 4.5, 0.025);
        const pts4 = simApi.solveRope(a4, b4, 4.5, 0.025);

        const minY1 = Math.min(...pts1.map(p => p.y));
        const minY4 = Math.min(...pts4.map(p => p.y));
        expect(Math.abs(minY1 - minY4)).toBeLessThan(0.01);

        // Free-air long slack: single-valley catenary (no ~~ wavy buckling)
        simApi.setCargoType('flatrack', 12.19, 2.44, 2.59);
        const st = simApi.getState();
        st.oogHasCargo = false;
        simApi.rebuildCargo(false);
        const phyFar = simApi.getPhy();
        phyFar.cargoPos.set(0, 40, 0); // keep cargo clear of the free-air span
        phyFar.cargoQuat.identity();
        const pLeft = new THREE_NS.Vector3(-5.9, 2.7, 1.1);
        const pMid = new THREE_NS.Vector3(0.0, 3.2, 0.0);
        const longPts = simApi.solveRope(pLeft, pMid, 7.6, 0.025);
        let signChanges = 0;
        let prevDy = 0;
        for (let i = 1; i < longPts.length; i++) {
            const dy = longPts[i].y - longPts[i - 1].y;
            if (Math.abs(dy) > 1e-3) {
                if (prevDy !== 0 && Math.sign(dy) !== Math.sign(prevDy)) signChanges++;
                prevDy = dy;
            }
        }
        expect(signChanges).toBeLessThanOrEqual(1);
    });

    it('8b. Slack upper cable covers the roof then hangs down the cargo body; taut clears the hang', () => {
        simApi.setCargoType('crate', 6.0, 2.2, 2.4);
        const st = simApi.getState();
        const phy = simApi.getPhy();
        phy.cargoPos.set(0, st.H * 0.5, 0);
        phy.cargoQuat.identity();
        const hook = new THREE_NS.Vector3(0.0, st.H + 1.2, 0.0);
        const lp = new THREE_NS.Vector3(st.L * 0.5 + 0.4, st.H + 0.9, st.W * 0.5 + 0.3);
        const chord = hook.distanceTo(lp);
        const L0 = chord + 5.0;
        const slackPts = simApi.solveRope(hook, lp, L0, 0.025);
        const roofY = phy.cargoPos.y + st.H * 0.5 + 0.03;
        const minY = Math.min(...slackPts.map(p => p.y));
        expect(minY).toBeLessThan(roofY - 0.55);
        const sideHug = slackPts.some(p => {
            const lx = p.x - phy.cargoPos.x;
            const lz = p.z - phy.cargoPos.z;
            const outside = Math.abs(lx) > st.L * 0.5 - 0.02 || Math.abs(lz) > st.W * 0.5 - 0.02;
            return outside && p.y < roofY - 0.35;
        });
        expect(sideHug).toBe(true);

        const tautPts = simApi.solveRope(hook, lp, chord, 0.025);
        const tautMin = Math.min(...tautPts.map(p => p.y));
        expect(tautMin).toBeGreaterThan(minY + 0.35);
    });

    it('8d. Slack path arc length stays within ~3% of L0 (no 2m sling drawn as 4m S-curve)', () => {
        simApi.setCargoType('crate', 6.0, 2.2, 2.4);
        const st = simApi.getState();
        const phy = simApi.getPhy();
        phy.cargoPos.set(0, st.H * 0.5, 0);
        phy.cargoQuat.identity();
        const A = new THREE_NS.Vector3(2.8, st.H + 0.9, 0.9);
        const B = new THREE_NS.Vector3(3.1, st.H * 0.5 + 0.15, 1.05);
        const chord = A.distanceTo(B);
        const L0 = 2.0;
        expect(chord).toBeLessThan(L0);
        const pts = simApi.solveRope(A, B, L0, 0.025);
        let arc = 0;
        for (let i = 1; i < pts.length; i++) arc += pts[i].distanceTo(pts[i - 1]);
        expect(arc).toBeGreaterThan(L0 * 0.92);
        expect(arc).toBeLessThan(L0 * 1.06);
        expect(pts[0].distanceTo(A)).toBeLessThan(0.01);
        expect(pts[pts.length - 1].distanceTo(B)).toBeLessThan(0.01);
    });

    it('8c. Soft rope gradually straightens with tautness; free-air slack forms a single catenary belly', () => {
        simApi.setCargoType('crate', 4.0, 2.0, 2.0);
        const phy = simApi.getPhy();
        phy.cargoPos.set(0, 20, 0); // cargo far away — free-air path
        phy.cargoQuat.identity();
        const A = new THREE_NS.Vector3(-2.0, 4.0, 0);
        const B = new THREE_NS.Vector3(2.0, 4.0, 0);
        const chord = A.distanceTo(B);
        const L0 = chord + 2.0;
        const soft = simApi.solveRope(A, B, L0, 0.025);
        const softMin = Math.min(...soft.map(p => p.y));
        expect(softMin).toBeLessThan(4.0 - 0.55);
        // Single valley (down then up)
        let flips = 0;
        let prev = 0;
        for (let i = 1; i < soft.length; i++) {
            const dy = soft[i].y - soft[i - 1].y;
            if (Math.abs(dy) > 1e-3) {
                if (prev !== 0 && Math.sign(dy) !== Math.sign(prev)) flips++;
                prev = dy;
            }
        }
        expect(flips).toBeLessThanOrEqual(1);

        // Near-taut length → belly almost gone
        const near = simApi.solveRope(A, B, chord + 0.04, 0.025);
        const nearMin = Math.min(...near.map(p => p.y));
        expect(nearMin).toBeGreaterThan(softMin + 0.35);
    });

    it('9. Open Top & Flat Rack support adjustable internal/OOG cargo (Over-Height, Over-Width, Over-Length) and tented tarpaulin', () => {
        simApi.setCargoType('opentop', 6.06, 2.44, 2.59);
        const st = simApi.getState();
        st.oogHasCargo = true;
        st.oogTarp = true;
        st.oogCargoL = 5.1;
        st.oogCargoW = 2.15;
        st.oogCargoH = 2.20;
        simApi.rebuildCargo(false);
        const topStandard = simApi.getCargoShellTopY(0, 0);

        // Increase internal cargo height to 3.25m (Over-Height by +0.66m) -> tarpaulin and collision shell must tent upward
        st.oogCargoH = 3.25;
        simApi.rebuildCargo(false);
        const topOverHeight = simApi.getCargoShellTopY(0, 0);
        expect(topOverHeight).toBeGreaterThan(topStandard + 0.5);
        expect(simApi.getCargoVisual().getObjectByName('openTopTarpaulin')).toBeTruthy();

        // Flat Rack: toggle between empty (no cargo) and OOG cargo (Over-Width / Over-Length / Over-Height)
        simApi.setCargoType('flatrack', 12.19, 2.44, 2.59);
        st.oogHasCargo = false;
        simApi.rebuildCargo(false);
        const topEmptyDeck = simApi.getCargoShellTopY(0, 0);
        expect(simApi.getCargoVisual().getObjectByName('flatRackOogCargo')).toBeFalsy();

        st.oogHasCargo = true;
        st.oogCargoL = 13.0; // Over-Length front & rear
        st.oogCargoW = 3.20; // Over-Width left & right
        st.oogCargoH = 3.10; // Over-Height
        simApi.rebuildCargo(false);
        const topLoadedOog = simApi.getCargoShellTopY(0, 0);
        expect(topLoadedOog).toBeGreaterThan(topEmptyDeck + 2.5);
        expect(simApi.getCargoVisual().getObjectByName('flatRackOogCargo')).toBeTruthy();
    });

    it('10. High-detail ISO Tank, Cabin Cruiser Boat, and SUV Car build cleanly with accurate structural rigging mounts', () => {
        for (const [type, L, W, H] of [
            ['isotank', 6.06, 2.44, 2.59],
            ['boat', 9.2, 3.0, 3.1],
            ['car', 4.85, 1.92, 1.88]
        ]) {
            simApi.setCargoType(type, L, W, H);
            const vis = simApi.getCargoVisual();
            expect(vis).toBeTruthy();
            expect(vis.children.length).toBeGreaterThan(15);
            const st = simApi.getState();
            for (const lug of st.lugs) {
                expect(Number.isFinite(lug.x)).toBe(true);
                expect(Number.isFinite(lug.y)).toBe(true);
                expect(Number.isFinite(lug.z)).toBe(true);
            }
        }
    });

    it('11. Standardized Rigging & Lifting Dictionary builds all 5 categories with English mesh names and bilingual UI catalog', () => {
        // 1. Dictionary structure
        expect(CAE.RIGGING_DICTIONARY).toBeTruthy();
        expect(Object.keys(CAE.RIGGING_DICTIONARY.cargo).length).toBeGreaterThanOrEqual(11);
        expect(Object.keys(CAE.RIGGING_DICTIONARY.hardware).length).toBeGreaterThanOrEqual(13);
        expect(Object.keys(CAE.RIGGING_DICTIONARY.slings).length).toBeGreaterThanOrEqual(7);
        expect(Object.keys(CAE.RIGGING_DICTIONARY.spreaders).length).toBeGreaterThanOrEqual(6);
        expect(Object.keys(CAE.RIGGING_DICTIONARY.technicalTerms).length).toBeGreaterThanOrEqual(9);

        // 2. All 13 Hardware 3D Meshes build with canonical English mesh names
        const expectedHwNames = [
            ['bow_shackle', 'Bow_Shackle'],
            ['d_shackle', 'D_Shackle'],
            ['clevis_hook', 'Clevis_Hook'],
            ['eye_hook', 'Eye_Hook'],
            ['swivel_hook', 'Swivel_Hook'],
            ['master_link', 'Master_Link'],
            ['turnbuckle', 'Turnbuckle'],
            ['wire_rope_clip', 'Wire_Rope_Clip_UBolt'],
            ['eye_bolt', 'Eye_Bolt'],
            ['thimble', 'Thimble'],
            ['ferrule', 'Ferrule_Wire_Rope_Sleeve'],
            ['plate_clamp', 'Lifting_Clamp_Plate_Clamp'],
            ['load_cell', 'Load_Cell_Dynamometer']
        ];
        for (const [hwId, englishMeshName] of expectedHwNames) {
            const mesh = simApi.buildHwMesh(hwId);
            expect(mesh).toBeTruthy();
            expect(mesh.name).toBe(englishMeshName);
            expect(mesh.children.length).toBeGreaterThanOrEqual(1);
        }

        // 3. All 7 Sling / Bridle / Tagline 3D Library Preview Meshes build with canonical English mesh names
        const expectedSlingPreviews = [
            ['sling_wire_rope', 'Wire_Rope_Sling'],
            ['sling_chain', 'Chain_Sling'],
            ['sling_web', 'Synthetic_Web_Sling'],
            ['sling_round', 'Round_Sling'],
            ['sling_grommet', 'Grommet_Sling'],
            ['preset_direct_4leg', 'Bridle_Sling'],
            ['sling_tagline', 'Tagline']
        ];
        for (const [presetId, englishMeshName] of expectedSlingPreviews) {
            const preview = simApi.buildSlingPreviewMesh(presetId);
            expect(preview).toBeTruthy();
            expect(preview.name).toBe(englishMeshName);
            expect(preview.children.length).toBeGreaterThan(0);
        }

        // 4. Cargo, Spreader, Hook Block, Master Link, Thimble, Ferrule & Dunnage English mesh names
        simApi.setCargoType('transformer', 5.2, 2.8, 3.2);
        simApi.setRigging('spreader', 'round_sling', 'swivel_hook', [0.06, 0.06, 0.06, 0.06]);
        expect(simApi.getCargoVisual().name).toBe('Transformer');
        expect(simApi.getSpreaderGroup().name).toBe('Modular_Spreader_Beam');
        expect(simApi.getHookGroup().name).toBe('Crane_Hook_Block');
        expect(simApi.getHookGroup().getObjectByName('Master_Link')).toBeTruthy();
        expect(simApi.getDunnageGroup().name).toBe('Timber_Dunnage');
        expect(simApi.getSlingPool()[0].group.name).toBe('Round_Sling');
        expect(simApi.getSlingPool()[0].endEyeA.getObjectByName('Thimble')).toBeTruthy();
        expect(simApi.getSlingPool()[0].endEyeA.getObjectByName('Ferrule_Wire_Rope_Sleeve')).toBeTruthy();

        const cat = simApi.getLibraryCatalog();
        expect(cat.hardware.length).toBeGreaterThanOrEqual(13);
        expect(cat.rig_preset.length).toBeGreaterThanOrEqual(11);
    });

    it('12. Basket Spreader Cradle pulls transverse bars inward collinearly (zero mid-air kink) and never orphans beam meshes', () => {
        simApi.setCargoType('flatrack', 12.2, 2.4, 2.6);
        simApi.setRigging('basket', 'grommet', 'bow_shackle', [0, 0, 0, 0]);
        // Repeatedly call mountBeamBodies() directly to verify self-healing cleanup leaves zero orphaned groups
        simApi.mountBeamBodies();
        simApi.mountBeamBodies();
        simApi.testLift(1.6, 1400, false);

        const phy = simApi.getPhy();
        const scene = simApi.getScene();
        const beamGroupsInScene = scene.children.filter(ch => ch.userData && ch.userData.beamId);
        expect(beamGroupsInScene.length).toBe(2);

        const barPos = phy.beams.find(b => b.id === 'barPos');
        const barNeg = phy.beams.find(b => b.id === 'barNeg');
        expect(barPos).toBeTruthy();
        expect(barNeg).toBeTruthy();

        const lug0 = simApi.getPadEyeRing(0);
        // Without a longitudinal H-beam, both transverse bars must pull inward toward the hook (|x| < 0.78 * |lug.x|)
        expect(Math.abs(barPos.x.x)).toBeLessThan(Math.abs(lug0.x) * 0.78);
        expect(Math.abs(barNeg.x.x)).toBeLessThan(Math.abs(lug0.x) * 0.78);

        // Upper sling and lower sling must be collinear in the XY plane (zero kink / < 2 deg)
        const cUp0 = phy.cables.find(c => c.role === 'upper' && c.index === 0);
        const cLeg0 = phy.cables.find(c => c.role === 'leg' && c.index === 0);
        const upVec = simApi.attachWorld(cUp0.b).sub(simApi.attachWorld(cUp0.a));
        const legVec = simApi.attachWorld(cLeg0.b).sub(simApi.attachWorld(cLeg0.a));
        const upXY = Math.atan2(upVec.y, upVec.x) * (180 / Math.PI);
        const legXY = Math.atan2(legVec.y, legVec.x) * (180 / Math.PI);
        expect(Math.abs(upXY - legXY)).toBeLessThan(1.5);
        // True physical sling angle (~55-68 deg from horizontal, not fake 88 deg vertical)
        expect(phy.legAngleDeg[0]).toBeLessThan(72);
        expect(phy.legAngleDeg[0]).toBeGreaterThan(45);
    });

    it('12a. Uses all four outer rails as collision solids for an open frame spreader', () => {
        simApi.setCargoType('crate', 6.0, 2.4, 2.6);
        simApi.setRigging('frame', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        const frame = simApi.getPhy().beams.find(b => b.axis === 'frame');
        expect(frame).toBeTruthy();
        const rails = simApi.getBeamSegments(frame);
        expect(rails).toHaveLength(4);
        rails.forEach(([a, b]) => expect(a.distanceTo(b)).toBeGreaterThan(1.0));
    });

    it('12aa. Keeps a spreader above the actual open-top tarpaulin surface', () => {
        simApi.setCargoType('opentop', 12.192, 2.438, 2.591);
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.4, 1400, false);

        const beam = simApi.getPhy().beams.find(b => b.id === 'main');
        expect(beam).toBeTruthy();
        // The contact proxy must cover the mesh that is actually visible.
        expect(simApi.getBeamCollisionRadius(beam)).toBeGreaterThanOrEqual(beam.radius);
        const radius = simApi.getBeamCollisionRadius(beam) + 0.012;
        let deepest = 0;
        simApi.getBeamSamples(beam, 24).forEach(point => {
            const cleared = simApi.pushOutOfCargo(point, radius);
            deepest = Math.max(deepest, cleared.distanceTo(point));
        });
        expect(deepest).toBeLessThan(0.02);
    });

    it('12ab. Routes a chain segment over a beam instead of drawing through its tube', () => {
        simApi.setCargoType('crate', 6.0, 2.4, 2.6);
        simApi.setRigging('spreader', 'chain', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.3, 1200, false);
        const beam = simApi.getPhy().beams.find(b => b.id === 'main');
        expect(beam).toBeTruthy();

        // Deliberately send a chain straight through the middle of the beam.
        const acrossA = beam.x.clone().add(new globalThis.THREE.Vector3(0, 0, -1.2));
        const acrossB = beam.x.clone().add(new globalThis.THREE.Vector3(0, 0, 1.2));
        const chainRadius = 0.022;
        const routed = simApi.routeRopeAroundBeams([acrossA, acrossB], chainRadius);
        expect(routed.length).toBeGreaterThan(2);
        expect(simApi.ropeBeamClearance(routed, beam)).toBeGreaterThanOrEqual(simApi.getBeamCollisionRadius(beam) + chainRadius - 0.01);
    });

    it('12ac. Keeps every supported sling style outside every beam design', () => {
        simApi.setCargoType('crate', 6.0, 2.4, 2.6);
        const beamTypes = ['spreader', 'lifting_beam', 'cascaded', 'modular_truss', 'frame', 'basket', 'container_spreader', 'inline4', 'inline8', 'spatial8'];
        const slingRadii = {
            wire: 0.014,
            chain: 0.022,
            web: 0.008,
            round_sling: 0.018,
            grommet: 0.018
        };

        beamTypes.forEach(beamType => {
            simApi.setRigging(beamType, 'wire', 'bow_shackle', [0, 0, 0, 0]);
            const beams = simApi.getPhy().beams;
            expect(beams.length).toBeGreaterThan(0);
            beams.forEach(beam => {
                const [railA, railB] = simApi.getBeamSegments(beam)[0];
                const mid = railA.clone().lerp(railB, 0.5);
                const along = railB.clone().sub(railA).normalize();
                const cross = new globalThis.THREE.Vector3().crossVectors(along, new globalThis.THREE.Vector3(0, 1, 0));
                if (cross.lengthSq() < 1e-8) cross.set(0, 0, 1);
                cross.normalize();
                const approach = simApi.getBeamCollisionRadius(beam) + 0.8;

                Object.values(slingRadii).forEach(radius => {
                    const route = simApi.routeRopeAroundBeams([
                        mid.clone().addScaledVector(cross, -approach),
                        mid.clone().addScaledVector(cross, approach)
                    ], radius);
                    expect(simApi.ropeBeamClearance(route, beam), `${beamType}:${beam.id}`).toBeGreaterThanOrEqual(simApi.getBeamCollisionRadius(beam) + radius - 0.01);
                });
            });
        });
    });

    it('12c. After sling snap, basket bars rest on cargo shell and never ghost through it', () => {
        simApi.setCargoType('crate', 6.0, 2.4, 2.6);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.5, 1200, false);

        const st = simApi.getState();
        const phy = simApi.getPhy();
        st.gear.legs[0].broken = true;
        phy.hookTarget.x = -1.8;
        phy.hookTarget.z = 1.0;
        simApi.stepSim(90);

        const beams = phy.beams || [];
        expect(beams.length).toBeGreaterThanOrEqual(2);
        let maxPen = 0;
        for (const b of beams) {
            const axis = new globalThis.THREE.Vector3(b.axis === 'z' ? 0 : 1, 0, b.axis === 'z' ? 1 : 0).applyQuaternion(b.q);
            const half = Math.max(0.05, b.length * 0.5);
            const a = b.x.clone().addScaledVector(axis, -half);
            const c = b.x.clone().addScaledVector(axis, half);
            const rad = (b.radius || 0.12) + 0.02;
            for (let i = 0; i <= 10; i++) {
                const p = a.clone().lerp(c, i / 10);
                const cleared = simApi.pushOutOfCargo(p, rad);
                maxPen = Math.max(maxPen, cleared.distanceTo(p));
            }
        }
        // Soft contact pad allowed; deep ghosting through the crate is not
        expect(maxPen).toBeLessThan(0.08);
    });

    it('12b. Snapped cable splits into upper+lower stubs; lower hangs on cargo, upper on beam, zero A↔B tension', () => {
        simApi.setCargoType('crate', 6.0, 2.4, 2.6);
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.4, 1200, false);

        const st = simApi.getState();
        const phy = simApi.getPhy();
        const leg = (phy.cables || []).find(c => c.role === 'leg' && c.index === 0);
        expect(leg).toBeTruthy();
        expect(leg.tensionT).toBeGreaterThan(0.05);

        st.gear.legs[0].broken = true;
        simApi.stepSim(30);

        expect(leg.break).toBeTruthy();
        expect(leg.break.upperLen).toBeGreaterThan(0.1);
        expect(leg.break.lowerLen).toBeGreaterThan(0.1);
        expect(leg.tensionT).toBeLessThan(0.02);

        const pinA = simApi.attachWorld(leg.a);
        const pinB = simApi.attachWorld(leg.b);
        // Upper stub stays near the beam/hook attachment; lower stub near the cargo lug
        expect(leg.break.tipU.distanceTo(pinA)).toBeLessThan(leg.break.upperLen + 0.08);
        expect(leg.break.tipL.distanceTo(pinB)).toBeLessThan(leg.break.lowerLen + 0.08);
        // The two free tips must separate — no continuous load path
        expect(leg.break.tipU.distanceTo(leg.break.tipL)).toBeGreaterThan(0.25);

        const pool = simApi.getSlingPool();
        const stubs = pool.filter(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === 0 && s.drawMeta.broken);
        expect(stubs.length).toBe(2);
        const halves = stubs.map(s => s.drawMeta.brokenHalf).sort();
        expect(halves).toEqual(['lower', 'upper']);
    });

    it('12ba. Cutting a suspended frame bridle releases a locked pose into a physical tilt', () => {
        simApi.setCargoType('container', 12.2, 2.44, 2.59);
        simApi.setRigging('frame', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.4, 1400, false);

        const st = simApi.getState();
        const phy = simApi.getPhy();
        const frame = (phy.beams || []).find(b => b.axis === 'frame');
        expect(frame).toBeTruthy();
        const initialFrameQ = frame.q.clone();
        const initialCargoQ = phy.cargoQuat.clone();

        // Reproduce the UI failure path: a user cuts a cable while the model is
        // still showing a placed/locked pose rather than after pressing Hoist.
        st.poseLock = true;
        simApi.snapCable('upper', 3);
        expect(st.poseLock).toBe(false);
        simApi.stepSim(150);

        expect(frame.q.angleTo(initialFrameQ)).toBeGreaterThan(0.002);
        expect(phy.cargoQuat.angleTo(initialCargoQ)).toBeGreaterThan(0.002);
    });

    it('12bb. A top-bridle failure transmits an off-centre CoG moment through the beams to the cargo', () => {
        simApi.setCargoType('container', 12.2, 2.44, 2.59);
        const st = simApi.getState();
        st.cogX = 0.42;
        st.cogZ = 0.18;
        simApi.setRigging('frame', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.4, 1400, false);

        const phy = simApi.getPhy();
        const before = phy.cargoQuat.clone();
        simApi.snapCable('upper', 3);
        simApi.stepSim(150);

        const pairedLower = (phy.cables || []).find(c => c.role === 'leg' && c.index === 3);
        expect(pairedLower.slack).toBe(true);
        expect(phy.cargoQuat.angleTo(before)).toBeGreaterThan(0.008);
    });

    it('12bc. A severed free end falls onto/around the cargo shell instead of being launched or ghosting through it', () => {
        simApi.setCargoType('container', 12.2, 2.44, 2.59);
        simApi.setRigging('frame', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.2, 1400, false);

        const phy = simApi.getPhy();
        simApi.snapCable('upper', 0);
        const cable = (phy.cables || []).find(c => c.role === 'upper' && c.index === 0);
        expect(cable.break).toBeTruthy();
        // Severing an inextensible cable must not manufacture a high recoil.
        expect(cable.break.velU.length()).toBeLessThan(0.35);
        expect(cable.break.velL.length()).toBeLessThan(0.35);

        // Each visual remnant must use its own post-break length.  Rendering
        // the original whole-cable length here would make a severed line grow.
        simApi.stepSim(1);
        const lowerRemnant = simApi.getSlingPool().find(s => s.drawMeta
            && s.drawMeta.role === 'upper' && s.drawMeta.index === 0
            && s.drawMeta.brokenHalf === 'lower');
        expect(lowerRemnant).toBeDefined();
        expect(lowerRemnant.drawMeta.L0).toBeCloseTo(cable.break.lowerLen, 3);

        const lowerY0 = cable.break.tipL.y;
        simApi.stepSim(240);
        expect(cable.break.tipL.y).toBeLessThan(lowerY0 + 0.08);

        // A second shell projection must make no material correction: the live
        // tip is at the exterior contact surface, never within the container.
        const cleared = simApi.pushOutOfCargo(cable.break.tipL, 0.024);
        expect(cleared.distanceTo(cable.break.tipL)).toBeLessThan(0.035);
    });

    it('12bd. A basket-spreader bar whose two upper bridles are cut is released from its presentation pose and falls', () => {
        simApi.setCargoType('container', 12.2, 2.44, 2.59);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.6, 1400, false);

        const phy = simApi.getPhy();
        const releasedBar = (phy.beams || []).find(b => b.id === 'barNeg');
        expect(releasedBar).toBeTruthy();
        const yBeforeCut = releasedBar.x.y;

        // barNeg is carried solely by upper bridles 1 and 2.  Cutting both must
        // disable basket's kinematic presentation code and release the actual
        // rigid bar under gravity, instead of leaving it suspended in mid-air.
        simApi.snapCable('upper', 1);
        simApi.snapCable('upper', 2);
        simApi.stepSim(30);
        expect(releasedBar.x.y).toBeLessThan(yBeforeCut - 0.03);

        simApi.stepSim(150);
        expect(releasedBar.x.y).toBeLessThan(yBeforeCut - 0.18);

        // The bar may land on the roof or ground, but it must finish on the
        // outside of solid cargo rather than pass through the container shell.
        let maxPenetration = 0;
        simApi.getBeamSamples(releasedBar, 12).forEach(point => {
            const cleared = simApi.pushOutOfCargo(point, (releasedBar.radius || 0.12) + 0.02);
            maxPenetration = Math.max(maxPenetration, cleared.distanceTo(point));
        });
        expect(maxPenetration).toBeLessThan(0.08);
    });

    it('12be. A fully detached heavy load follows gravity instead of an artificial slow-motion speed cap', () => {
        simApi.setCargoType('container', 12.2, 2.44, 2.59);
        simApi.setRigging('frame', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(5.5, 1800, false);

        const phy = simApi.getPhy();
        const yBeforeFailure = phy.cargoPos.y;
        [0, 1, 2, 3].forEach(i => simApi.snapCable('upper', i));

        // 0.5 s from rest at g falls about 1.23 m.  A modest margin allows
        // load-path release and solver damping, but rejects the old 1.8 m/s cap.
        simApi.stepSim(30);
        const fallDistance = yBeforeFailure - phy.cargoPos.y;
        expect(fallDistance).toBeGreaterThan(0.90);
        expect(phy.cargoVel.y).toBeLessThan(-3.2);
        expect(Math.abs(phy.cargoVel.y)).toBeLessThan(6.4);
    });

    it('12bf. A detached container has an inelastic landing: it settles instead of bouncing or jittering', () => {
        simApi.setCargoType('container', 6.0, 2.44, 2.59);
        simApi.setRigging('frame', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.45, 1400, false);

        const phy = simApi.getPhy();
        [0, 1, 2, 3].forEach(i => simApi.snapCable('upper', i));
        simApi.stepSim(240);
        const settledY = phy.cargoPos.y;
        const settledSpeed = phy.cargoVel.length();
        const settledSpin = phy.cargoOmega.length();
        expect(phy.groundClearance).toBeLessThan(0.05);

        simApi.stepSim(90);
        expect(phy.cargoPos.y).toBeLessThanOrEqual(settledY + 0.06);
        expect(settledSpeed).toBeLessThan(0.70);
        expect(settledSpin).toBeLessThan(1.15);
    });

    it('12bg. An intact 2 m sling never becomes a visual 10 m cable after a neighbouring bridle failure', () => {
        simApi.setCargoType('container', 12.2, 2.44, 2.59);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        const st = simApi.getState();
        st.gear.legs.forEach(leg => { leg.lengthM = 2.0; });
        simApi.rebuildCargo(false);
        simApi.testLift(1.8, 1500, false);

        const phy = simApi.getPhy();
        simApi.snapCable('upper', 1);
        simApi.snapCable('upper', 2);
        simApi.stepSim(180);

        const intactLegs = (phy.cables || []).filter(c => c.role === 'leg' && !st.gear.legs[c.index].broken);
        expect(intactLegs.length).toBeGreaterThan(0);
        intactLegs.forEach(c => {
            const chord = simApi.attachWorld(c.a).distanceTo(simApi.attachWorld(c.b));
            expect(chord).toBeLessThanOrEqual(c.L0 + 0.08);
        });

        const renderedLegs = simApi.getSlingPool().filter(s => s.group.visible && s.drawMeta
            && s.drawMeta.role === 'leg' && !s.drawMeta.broken);
        renderedLegs.forEach(s => {
            expect(s.drawMeta.renderedLength).toBeLessThanOrEqual(s.drawMeta.L0 * 1.07 + 0.06);
        });
    });

    it('12bh. A break flag written outside the cut button releases pose-lock and lets a detached load land', () => {
        simApi.setCargoType('container', 6.0, 2.44, 2.59);
        simApi.setRigging('frame', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.6, 1400, false);

        const st = simApi.getState();
        const phy = simApi.getPhy();
        // Mimics a saved/imported/UI state that has set `broken` directly
        // rather than dispatching the cut-button callback.
        st.poseLock = true;
        [0, 1, 2, 3].forEach(i => { st.gear.uppers[i].broken = true; });

        simApi.stepSim(1);
        expect(st.poseLock).toBe(false);
        expect((phy.cables || []).filter(c => c.role === 'upper').every(c => c.break)).toBe(true);

        simApi.stepSim(300);
        expect(phy.groundClearance).toBeLessThan(0.05);
        expect(phy.cargoVel.length()).toBeLessThan(0.75);
    });

    it('12bi. A fully severed Flat Rack never gains upward flight and settles on the ground', () => {
        simApi.setCargoType('flatrack', 12.2, 2.44, 2.59);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(2.0, 1600, false);

        const phy = simApi.getPhy();
        const initialY = phy.cargoPos.y;
        (phy.cables || []).forEach(c => simApi.snapCable(c.role, c.index));

        let highestY = phy.cargoPos.y;
        for (let frame = 0; frame < 360; frame++) {
            simApi.stepSim(1);
            highestY = Math.max(highestY, phy.cargoPos.y);
        }

        // No remaining load path may inject lift into a fully severed rack.
        expect(highestY).toBeLessThanOrEqual(initialY + 0.06);
        expect(phy.groundClearance).toBeLessThan(0.05);
        expect(phy.cargoVel.length()).toBeLessThan(0.85);
    });

    it('12bj. Cutting every lower sling leaves the upper beam hanging but releases the Flat Rack downward', () => {
        simApi.setCargoType('flatrack', 12.2, 2.44, 2.59);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(2.0, 1600, false);

        const phy = simApi.getPhy();
        const yBefore = phy.cargoPos.y;
        const upperYBefore = (phy.beams || []).reduce((sum, b) => sum + b.x.y, 0) / Math.max(1, (phy.beams || []).length);
        (phy.cables || []).filter(c => c.role === 'leg').forEach(c => simApi.snapCable(c.role, c.index));
        let highestRackY = phy.cargoPos.y;
        for (let frame = 0; frame < 360; frame++) {
            simApi.stepSim(1);
            highestRackY = Math.max(highestRackY, phy.cargoPos.y);
        }

        const upperYAfter = (phy.beams || []).reduce((sum, b) => sum + b.x.y, 0) / Math.max(1, (phy.beams || []).length);
        expect(upperYAfter).toBeGreaterThan(upperYBefore - 0.75);
        expect(highestRackY).toBeLessThanOrEqual(yBefore + 0.06);
        expect(phy.groundClearance).toBeLessThan(0.05);
        expect(new globalThis.THREE.Vector3(0, 1, 0).applyQuaternion(phy.cargoQuat).y).toBeGreaterThan(0.97);
    });

    it('12bk. The cargo-panel Cut command severs all supporting lower legs, rather than only playing a snap effect', () => {
        simApi.setCargoType('flatrack', 12.2, 2.44, 2.59);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(2.0, 1600, false);

        const st = simApi.getState();
        const phy = simApi.getPhy();
        const yBefore = phy.cargoPos.y;
        st.gear.selection = [{ kind: 'cargo' }];

        // This is the same code path now used by the generic Cut button while
        // the user has selected the load panel.
        expect(simApi.cutSelectedRiggingCables()).toBe(4);
        const supportingLegs = (phy.cables || []).filter(c => c.role === 'leg' && c.b && c.b.kind === 'cargo');
        expect(supportingLegs).toHaveLength(4);
        expect(supportingLegs.every(c => st.gear.legs[c.index].broken)).toBe(true);

        let highestY = phy.cargoPos.y;
        for (let frame = 0; frame < 360; frame++) {
            simApi.stepSim(1);
            highestY = Math.max(highestY, phy.cargoPos.y);
        }
        expect(highestY).toBeLessThanOrEqual(yBefore + 0.06);
        expect(phy.groundClearance).toBeLessThan(0.05);
        expect(new globalThis.THREE.Vector3(0, 1, 0).applyQuaternion(phy.cargoQuat).y).toBeGreaterThan(0.97);
    });

    it('12bl. Mouse hook drag follows a fast hand command while legs are slack, then rate-limits after the load is taut', () => {
        simApi.setCargoType('container', 6.0, 2.44, 2.59);
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);

        // Give the lower legs real surplus length; this is the user-facing
        // "cáp chưa căng" state rather than a line that is already at L0.
        const slackState = simApi.getState();
        slackState.gear.legs.forEach(leg => { leg.lengthM = 12.0; });
        simApi.rebuildCargo(false);
        simApi.stepSim(5);
        const phy = simApi.getPhy();
        const slackStart = phy.hookPos.clone();
        expect(simApi.getHookDragCoupling()).toBeLessThan(0.20);
        simApi.beginHookDrag(slackStart.clone().add(new globalThis.THREE.Vector3(3.0, 0, 0)), 7.5);
        simApi.stepSim(30);
        const slackTravel = phy.hookPos.distanceTo(slackStart);
        simApi.endHookDrag();

        simApi.setCargoType('container', 6.0, 2.44, 2.59);
        simApi.setRigging('spreader', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.5, 1500, false);
        const tautStart = phy.hookPos.clone();
        const tautCoupling = simApi.getHookDragCoupling();
        expect(tautCoupling).toBeGreaterThan(0.35);
        simApi.beginHookDrag(tautStart.clone().add(new globalThis.THREE.Vector3(3.0, 0, 0)), 7.5);
        simApi.stepSim(30);
        const tautTravel = phy.hookPos.distanceTo(tautStart);

        // The same fast pointer command has a materially slower physical
        // response once the legs have started transmitting the cargo load.
        expect(slackTravel).toBeGreaterThan(tautTravel * 1.8);
        expect(phy.dragHookSpeed).toBeLessThanOrEqual(0.70);
        simApi.endHookDrag();
    });

    it('13. Upper slings stay 100% taut when suspended, corners never enlarge on sling snap/impact, and tilted Flat Rack snaps lashings & drops OOG cargo', () => {
        simApi.setCargoType('flatrack', 12.2, 2.4, 2.6);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.6, 1200, false);

        const st = simApi.getState();
        const phy = simApi.getPhy();
        const pool = simApi.getSlingPool();

        // 1. All 4 upper slings must be 100% taut and straight (zero slack belly)
        const upperSlings = pool.filter(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'upper');
        expect(upperSlings.length).toBe(4);
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
        for (const s of upperSlings) {
            expect(maxDeviationFromLine(s)).toBeLessThan(0.005);
        }

        // 2. Break LP4 (index 3) and pull off-center to create a steep tilt (> 16 deg)
        st.gear.legs[3].broken = true;
        phy.hookTarget.x = -2.2;
        phy.hookTarget.z = 1.1;
        simApi.stepSim(45);

        // Upper slings must remain 100% straight even after LP4 snaps
        for (const s of upperSlings) {
            expect(maxDeviationFromLine(s)).toBeLessThan(0.005);
        }

        // Corner yield/sag must remain strictly 0 in mid-air (never enlarges corner geometry)
        for (const sag of phy.cornerSag) {
            expect(sag).toBe(0);
        }

        // 3. Advance simulation so lashing straps snap and OOG cargo slides & falls off the tilted Flat Rack
        simApi.stepSim(220);
        expect(phy.oogState).toBeTruthy();
        expect(phy.oogState.strapsBroken).toBe(true);
        expect(['sliding', 'falling', 'grounded']).toContain(phy.oogState.status);

        const vis = simApi.getCargoVisual();
        const intactStraps = vis.getObjectByName('flatRackLashingStraps');
        const brokenStraps = vis.getObjectByName('flatRackBrokenStraps');
        expect(intactStraps.visible).toBe(false);
        expect(brokenStraps.visible).toBe(true);

        // 4. Verify ground impact dentCargo only crumples inward and never enlarges outer bounds
        simApi.setCargoType('crate', 4.5, 2.6, 2.4);
        const crateVis = simApi.getCargoVisual();
        const boxBefore = new globalThis.THREE.Box3().setFromObject(crateVis);
        const sizeBefore = boxBefore.getSize(new globalThis.THREE.Vector3());
        simApi.dentCargo(8.5);
        const boxAfter = new globalThis.THREE.Box3().setFromObject(crateVis);
        const sizeAfter = boxAfter.getSize(new globalThis.THREE.Vector3());
        expect(sizeAfter.x).toBeLessThanOrEqual(sizeBefore.x + 1e-4);
        expect(sizeAfter.y).toBeLessThanOrEqual(sizeBefore.y + 1e-4);
        expect(sizeAfter.z).toBeLessThanOrEqual(sizeBefore.z + 1e-4);
    });

    it('13b. OOG crate obeys static friction when subcritical, otherwise falls as a separate solid without ghosting', () => {
        simApi.setCargoType('flatrack', 12.2, 2.4, 2.6);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        simApi.testLift(1.6, 1200, false);

        const st = simApi.getState();
        const phy = simApi.getPhy();
        st.gear.legs[3].broken = true;
        phy.hookTarget.x = -2.4;
        phy.hookTarget.z = 1.3;
        simApi.stepSim(320);

        expect(phy.oogState).toBeTruthy();
        expect(phy.oogState.strapsBroken).toBe(true);

        // Drive until the OOG is a free body on/near the ground.  A shallow
        // rack slope may be below the static-friction angle after the lashing
        // has failed; that is a valid stopped-on-deck result, not a failure.
        let guard = 0;
        while (guard < 400 && phy.oogState.status !== 'grounded' && phy.oogState.status !== 'falling') {
            simApi.stepSim(10);
            guard += 10;
        }
        expect(['sliding', 'falling', 'grounded']).toContain(phy.oogState.status);
        if (phy.oogState.status === 'sliding') {
            expect(phy.oogState.localVel.length()).toBeLessThan(0.08);
            expect(phy.oogState.strapsBroken).toBe(true);
            return;
        }
        expect(phy.effectiveCargoWeightT).toBeTruthy();
        expect(phy.effectiveCargoWeightT).toBeLessThanOrEqual((st.tareT || 5) + 0.05);
        expect(phy.oogState.half.hx).toBeCloseTo((st.oogCargoL || phy.oogState.half.hx * 2) * 0.5, 2);

        // Keep simulating until grounded if still falling
        guard = 0;
        while (guard < 300 && phy.oogState.status === 'falling') {
            simApi.stepSim(10);
            guard += 10;
        }

        // Try to drag empty Flat Rack through the fallen crate — must catch/slide, not ghost
        phy.hookTarget.x = phy.oogState.worldPos.x;
        phy.hookTarget.z = phy.oogState.worldPos.z;
        phy.hookTarget.y = Math.max(3.5, phy.oogState.worldPos.y + 1.2);
        simApi.stepSim(120);
        // Settle contacts after the yank so deepest-first separation finishes
        phy.hookTarget.copy(phy.hookPos);
        simApi.stepSim(40);

        const half = phy.oogState.half;
        expect(half).toBeTruthy();
        let maxPen = 0;
        const deckY = -st.H * 0.5 + 0.30;
        const samples = [];
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
            samples.push(new globalThis.THREE.Vector3(sx * st.L * 0.48, deckY, sz * st.W * 0.48));
            samples.push(new globalThis.THREE.Vector3(sx * (st.L * 0.5 - 0.1), st.H * 0.4, sz * st.W * 0.4));
        }));
        for (const local of samples) {
            const w = local.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos);
            const invQ = phy.oogState.worldQuat.clone().invert();
            const loc = w.clone().sub(phy.oogState.worldPos).applyQuaternion(invQ);
            const dx = Math.abs(loc.x) - half.hx;
            const dy = Math.abs(loc.y) - half.hy;
            const dz = Math.abs(loc.z) - half.hz;
            if (dx < 0 && dy < 0 && dz < 0) {
                maxPen = Math.max(maxPen, Math.min(-dx, -dy, -dz));
            }
        }
        expect(maxPen).toBeLessThan(0.10);

        // Lift clear — empty Flat Rack mass law remains (OOG already off)
        phy.hookTarget.y += 6;
        simApi.stepSim(60);
        expect(phy.effectiveCargoWeightT).toBeLessThan(st.weight * 0.55);
        expect(['falling', 'grounded']).toContain(phy.oogState.status);
    });

    it('manages user initial baseline state correctly: inactive before set, saved on demand, and restored cleanly', () => {
        const st = simApi.getState();
        const phy = simApi.getPhy();

        // 1. Initially no baseline state exists
        st.userBaselineState = null;
        const initialWeight = st.weight;

        // Calling reset without baseline should do nothing / not throw
        simApi.resetToUserInitialBaselineState();
        expect(st.weight).toBe(initialWeight);

        // 2. Configure a custom setup
        st.cargoType = 'transformer';
        st.L = 7.5;
        st.W = 3.2;
        st.H = 3.6;
        st.weight = 42.0;
        st.cogX = 0.35;
        st.cogY = -0.2;
        st.cogZ = -0.15;
        st.beamType = 'lifting_beam';
        st.slingType = 'chain';
        st.hwType = 'dee_shackle';
        st.slingLength = 4.5;
        st.wllPerLeg = 25.0;

        // 3. Save baseline
        simApi.saveUserInitialBaselineState();
        expect(st.userBaselineState).toBeTruthy();
        expect(st.userBaselineState.cargoType).toBe('transformer');
        expect(st.userBaselineState.weight).toBe(42.0);
        expect(st.userBaselineState.beamType).toBe('lifting_beam');
        expect(st.userBaselineState.slingType).toBe('chain');
        expect(st.userBaselineState.slingLength).toBe(4.5);

        // 4. Mutate state drastically during simulation / accidental changes
        st.cargoType = 'container';
        st.weight = 99.0;
        st.beamType = 'none';
        st.slingType = 'synthetic';
        st.slingLength = 2.0;
        phy.damagePct = 75;

        // 5. Reset back to user initial baseline
        simApi.resetToUserInitialBaselineState();

        // 6. Verify full restoration
        expect(st.cargoType).toBe('transformer');
        expect(st.weight).toBe(42.0);
        expect(st.beamType).toBe('lifting_beam');
        expect(st.slingType).toBe('chain');
        expect(st.slingLength).toBe(4.5);
        expect(st.wllPerLeg).toBe(25.0);
        expect(phy.damagePct).toBe(0);
    });

    it('21. Proportional Rig Spec enforces ASME B30.9 geometric minimums, synchronizes upper & lower sling lengths to actual 3D physical meters, and computes live angles', () => {
        const st = simApi.getState();
        const phy = simApi.getPhy();

        // 1. Configure 12.2m Flatrack container (H = 2.591m, L = 12.192m) with basket cradle and bottom corner lifting
        simApi.setCargoType('flatrack', 12.192, 2.438, 2.591);
        st.lugElevPreset = 'bottom';
        st.oogHasCargo = true;
        simApi.rebuildCargo(true);
        simApi.setRigging('basket', 'wire', 'bow_shackle', [0, 0, 0, 0]);
        st.upperSlingLength = null;
        st.lowerSlingLength = null;

        const spec = simApi.getRigSpec();
        expect(spec).toBeTruthy();

        // HorizU must be hypot(12.192/2, 2.438/2) ~ 6.22m
        expect(spec.horizU).toBeGreaterThan(5.8);

        // ASME B30.9 minUpper must be >= horizU / cos(30 deg) ~ 7.1m
        expect(spec.minUpper).toBeGreaterThanOrEqual(7.0);
        expect(spec.topLeg).toBeGreaterThanOrEqual(spec.minUpper);

        // minLower for bottom corner lifting must clear cargo height (H = 2.591m)
        expect(spec.minLower).toBeGreaterThanOrEqual(2.5);

        // 2. Setting impossible lengths (e.g. 1.0m upper, 0.5m lower) must clamp to real geometric minimums
        st.upperSlingLength = 1.0;
        st.lowerSlingLength = 0.5;

        const clampedSpec = simApi.getRigSpec();
        expect(st.upperSlingLength).toBe(clampedSpec.minUpper);
        expect(clampedSpec.topLeg).toBe(clampedSpec.minUpper);
        expect(st.lowerSlingLength).toBe(clampedSpec.minLower);
        expect(clampedSpec.lower).toBe(clampedSpec.minLower);

        // 3. Test lift step updates live angles
        simApi.testLift(1.5, 600, false);
        expect(phy.upperAngleDeg).toBeTruthy();
        expect(phy.upperAngleDeg.length).toBeGreaterThan(0);
        expect(phy.upperAngleDeg[0]).toBeGreaterThanOrEqual(28);
    });
});
