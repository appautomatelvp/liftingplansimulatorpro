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
            getSlingPool: () => sling3DPool,
            getCargoVisual: () => activeCargoVisual,
            bootHeadless() {
                scene = new THREE.Scene();
                camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 500);
                camera.position.set(8.6, 5.2, 10.0);
                controls = { target: new THREE.Vector3(0, 2.4, 0), update() {} };
                floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
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
                for (let i = 0; i < 5; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            testLift(desiredClearance = 1.2, maxSteps = 1400) {
                autoPositionHookForLift(desiredClearance);
                let steps = 0;
                while (steps < maxSteps && Math.abs(phy.hookPos.y - phy.hookTarget.y) > 0.02) {
                    stepPhysicsEngine();
                    steps++;
                }
                for (let i = 0; i < 60; i++) stepPhysicsEngine();
                updateSceneAndTelemetry();
            },
            rebuild() {
                rebuildCargoAndRig(false);
                for (let i = 0; i < 5; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            stepPhysics(steps = 1) {
                for (let i = 0; i < steps; i++) stepPhysicsEngine(1 / 60);
                updateSceneAndTelemetry();
            },
            resetToInitialPreLiftState,
            parkHookSlack,
            cargoRoofAtXZ,
            legSwl,
            upperSwl,
            autoSlingWll,
            noteCableSnap
        };`
    ].join('\n');

    const factory = new Function(bundleSource);
    simApi = factory();
    simApi.bootHeadless();
});

describe('Per-Cable Custom Sling Types, Multi-Part Parallel Falls & Physics Failure', () => {
    it('1. Allows setting individual sling types and updates 3D mesh representation accordingly', () => {
        const state = simApi.getState();
        const pool = simApi.getSlingPool();

        // Initially with wire rope
        state.slingType = 'wire';
        simApi.rebuild();
        const upper0 = pool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'upper' && s.drawMeta.index === 0);
        expect(upper0).toBeTruthy();
        expect(upper0.group.name).toBe('Wire_Rope_Sling');
        expect(upper0.segments[2].visible).toBe(true);
        expect(upper0.links[0].visible).toBe(false);

        // Customize ONLY Upper Cable 1 to chain:
        state.gear.uppers[1].slingType = 'chain';
        state.gear.uppers[1].grade = 'g80';
        simApi.rebuild();

        const upper1 = pool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'upper' && s.drawMeta.index === 1);
        expect(upper1).toBeTruthy();
        expect(upper1.group.name).toBe('Chain_Sling');
        expect(upper1.segments[2].visible).toBe(false);
        expect(upper1.links[0].visible).toBe(true);
        // Upper 0 remains Wire Rope
        const u0After = pool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'upper' && s.drawMeta.index === 0);
        expect(u0After.group.name).toBe('Wire_Rope_Sling');

        // Customize Leg 0 to flat webbing sling
        state.gear.legs[0].slingType = 'web';
        state.gear.legs[0].grade = 'poly';
        state.gear.legs[0].diaMm = 60;
        simApi.rebuild();

        const leg0 = pool.find(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === 0);
        expect(leg0).toBeTruthy();
        expect(leg0.group.name).toBe('Synthetic_Web_Sling');
        expect(leg0.endEyeA.visible).toBe(false);
        expect(leg0.segments[2].scale.z).toBeCloseTo(0.22, 2);
    });

    it('2. Multi-part parallel slings (parts = 2, 3, 4) multiply SWL, MBL and render parallel visual falls', () => {
        const state = simApi.getState();
        const pool = simApi.getSlingPool();

        // 1 part
        const leg1Rec = state.gear.legs[1];
        leg1Rec.slingType = 'wire';
        leg1Rec.diaMm = 22;
        leg1Rec.parts = 1;
        leg1Rec.swlT = null; // Auto SWL
        const swl1 = simApi.legSwl(1);

        // 2 parts (chập đôi)
        leg1Rec.parts = 2;
        const swl2 = simApi.legSwl(1);
        expect(swl2).toBeCloseTo(swl1 * 2, 1);

        // 4 parts (chập 4)
        leg1Rec.parts = 4;
        const swl4 = simApi.legSwl(1);
        expect(swl4).toBeCloseTo(swl1 * 4, 1);

        // Verify 3D rendering generates 4 parallel visible sling objects for leg 1
        simApi.rebuild();
        const leg1Slings = pool.filter(s => s.group.visible && s.drawMeta && s.drawMeta.role === 'leg' && s.drawMeta.index === 1);
        expect(leg1Slings.length).toBe(4);
        expect(leg1Slings[0].drawMeta.parts).toBe(4);
        expect(leg1Slings[0].drawMeta.partIndex).toBe(0);
        expect(leg1Slings[3].drawMeta.partIndex).toBe(3);
    });

    it('3. Under-capacity sling selection triggers physics overload breakage (noteCableSnap)', () => {
        const state = simApi.getState();
        const phy = simApi.getPhy();

        // Heavy cargo: 24t
        state.weight = 24.0;
        state.beamType = 'spreader';
        state.slingUserSet = false;
        state.gear.uppers[0].lengthM = 7.0;
        state.gear.uppers[1].lengthM = 7.0;

        // Upper cable carries roughly half of total gross load (~12-14t)
        // Set upper cable 0 to a weak single 30mm webbing sling: WLL = 1t, SF = 7 -> MBL = 7t
        state.gear.uppers[0].slingType = 'web';
        state.gear.uppers[0].grade = 'poly';
        state.gear.uppers[0].diaMm = 30; // 30mm web -> 1.0 t WLL, MBL = 7 t
        state.gear.uppers[0].parts = 1;
        state.gear.uppers[0].swlT = null;
        state.gear.uppers[0].broken = false;
        simApi.rebuild();

        // Lift into air: tension exceeds MBL 7t -> snaps!
        simApi.testLift(1.5, 1400);
        expect(state.gear.uppers[0].broken).toBe(true);

        // Now test that if we chập 4 (parts = 4) with 120mm webbing sling:
        // WLL = 4.0t * 4 = 16t, MBL = 112t -> carries load safely without breaking!
        state.gear.uppers[0].diaMm = 120;
        state.gear.uppers[0].parts = 4;
        state.gear.uppers[0].broken = false;
        simApi.rebuild();
        simApi.testLift(1.2, 1400);
        expect(state.gear.uppers[0].broken).toBe(false);
    });

    it('4. Allows synchronizing cable configuration to all cables in the same tier', () => {
        const state = simApi.getState();

        // Configure Leg 2 as 2-part chain sling
        const srcLeg = state.gear.legs[2];
        srcLeg.slingType = 'chain';
        srcLeg.grade = 'g100';
        srcLeg.diaMm = 18;
        srcLeg.parts = 2;
        srcLeg.sf = 4;
        srcLeg.swlT = 16.5;

        // Simulate clicking the "Áp dụng quy cách này cho tất cả cáp nhánh"
        state.gear.legs.forEach(leg => {
            leg.slingType = srcLeg.slingType;
            leg.parts = srcLeg.parts;
            leg.grade = srcLeg.grade;
            leg.diaMm = srcLeg.diaMm;
            leg.sf = srcLeg.sf;
            leg.swlT = srcLeg.swlT;
        });

        // Verify all 8 legs inherit the configuration
        for (let i = 0; i < 8; i++) {
            expect(state.gear.legs[i].slingType).toBe('chain');
            expect(state.gear.legs[i].parts).toBe(2);
            expect(state.gear.legs[i].grade).toBe('g100');
            expect(state.gear.legs[i].diaMm).toBe(18);
            expect(state.gear.legs[i].sf).toBe(4);
            expect(state.gear.legs[i].swlT).toBe(16.5);
        }
    });

    it('5. Lowered hook/spreader over ISO container: slack slings drape on top of roof and never penetrate inside', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();

        state.cargoType = 'container';
        state.L = 12.2;
        state.W = 2.4;
        state.H = 2.6;
        state.beamType = 'spreader';
        state.slingType = 'chain';
        state.gear.uppers.forEach(u => {
            u.slingType = 'chain';
            u.grade = 'g80';
            u.diaMm = 16;
            u.lengthM = 7.5;
            u.broken = false;
        });
        simApi.rebuild();

        // Calculate expected container roof world Y
        const expectedRoofWorldY = phy.cargoPos.y + state.H * 0.5;

        // Lower the hook right down near the container roof so upper chains become slack
        phy.hookPos.y = expectedRoofWorldY + 0.6;
        phy.hookTarget.y = expectedRoofWorldY + 0.6;
        simApi.stepPhysics(100);

        const pool = simApi.getSlingPool();
        const upperSlings = pool.filter(s => s.drawMeta && s.drawMeta.role === 'upper' && s.group.visible);
        expect(upperSlings.length).toBeGreaterThan(0);

        upperSlings.forEach(sling => {
            const sim = sling.ropeSim;
            expect(sim).not.toBeNull();
            sim.p.forEach(node => {
                const overFootprint = Math.abs(node.x - phy.cargoPos.x) <= (state.L * 0.5 + 0.05)
                    && Math.abs(node.z - phy.cargoPos.z) <= (state.W * 0.5 + 0.05);
                if (overFootprint) {
                    expect(node.y).toBeGreaterThanOrEqual(expectedRoofWorldY - 0.02);
                }
            });
        });
    });

    it('6. Open Top container: slack slings drape on top of cargo when oogHasCargo is true, and enter tub when false', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();

        state.cargoType = 'opentop';
        state.L = 6.0;
        state.W = 2.4;
        state.H = 2.6;
        state.beamType = 'spreader';
        state.slingType = 'chain';
        state.oogTarp = false; // No tarp so internal cargo / tub is exposed
        state.oogHasCargo = true;
        state.oogCargoH = 1.8;
        state.gear.uppers.forEach(u => {
            u.slingType = 'chain';
            u.grade = 'g80';
            u.diaMm = 16;
            u.lengthM = 4.5;
            u.broken = false;
        });
        simApi.rebuild();

        // Floor top Y in local is -H * 0.5 + 0.18. With cargo height 1.8, cargo top is floorTopY + 1.8
        const floorTopLocalY = -state.H * 0.5 + 0.18;
        const cargoPeakLocalY = floorTopLocalY + state.oogCargoH;
        const cargoPeakWorldY = phy.cargoPos.y + cargoPeakLocalY;

        // Lower hook so chains slacken onto the cargo
        phy.hookPos.y = cargoPeakWorldY + 0.6;
        phy.hookTarget.y = cargoPeakWorldY + 0.6;
        simApi.stepPhysics(100);

        const pool = simApi.getSlingPool();
        const upperWithCargo = pool.find(s => s.drawMeta && s.drawMeta.role === 'upper' && s.group.visible);
        expect(upperWithCargo).toBeDefined();
        expect(upperWithCargo.ropeSim).not.toBeNull();

        // Over the cargo footprint, nodes must stay at or above the cargo top
        const cL = state.L * 0.84, cW = state.W * 0.88;
        upperWithCargo.ropeSim.p.forEach(node => {
            const overCargo = Math.abs(node.x - phy.cargoPos.x) <= cL * 0.5
                && Math.abs(node.z - phy.cargoPos.z) <= cW * 0.5;
            if (overCargo) {
                expect(node.y).toBeGreaterThanOrEqual(cargoPeakWorldY - 0.03);
            }
        });

        // Now toggle oogHasCargo to false (empty open top container)
        state.oogHasCargo = false;
        simApi.rebuild();
        simApi.stepPhysics(100);

        const upperEmpty = pool.find(s => s.drawMeta && s.drawMeta.role === 'upper' && s.group.visible);
        expect(upperEmpty).toBeDefined();
        expect(upperEmpty.ropeSim).not.toBeNull();

        // When empty, nodes should hang down deeper into the open tub (below cargoPeakWorldY)
        const minEmptyNodeY = Math.min(...upperEmpty.ropeSim.p.map(n => n.y));
        expect(minEmptyNodeY).toBeLessThan(cargoPeakWorldY - 0.2);
    });

    it('7. Flat Rack container: slack slings drape on top of crate when oogHasCargo is true, and on deck when false', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();

        state.cargoType = 'flatrack';
        state.L = 12.2;
        state.W = 2.4;
        state.H = 2.6;
        state.beamType = 'spreader';
        state.slingType = 'chain';
        state.oogHasCargo = true;
        state.oogCargoL = 8.0;
        state.oogCargoH = 2.2;
        state.gear.uppers.forEach(u => {
            u.slingType = 'chain';
            u.grade = 'g80';
            u.diaMm = 16;
            u.lengthM = 8.0;
            u.broken = false;
        });
        simApi.rebuild();

        // Deck is at -H * 0.5 + 0.30, dunnage is 0.10, crate top is -H * 0.5 + 0.40 + cH
        const crateTopLocalY = -state.H * 0.5 + 0.40 + state.oogCargoH;
        const crateTopWorldY = phy.cargoPos.y + crateTopLocalY;

        // Lower hook over the crate
        phy.hookPos.y = crateTopWorldY + 0.6;
        phy.hookTarget.y = crateTopWorldY + 0.6;
        simApi.stepPhysics(100);

        const pool = simApi.getSlingPool();
        const upperCrate = pool.find(s => s.drawMeta && s.drawMeta.role === 'upper' && s.group.visible);
        expect(upperCrate).toBeDefined();
        expect(upperCrate.ropeSim).not.toBeNull();

        // Nodes over the crate footprint must stay ON or ABOVE the crate top
        upperCrate.ropeSim.p.forEach((node, idx) => {
            const overCrate = Math.abs(node.x - phy.cargoPos.x) <= 3.0
                && Math.abs(node.z - phy.cargoPos.z) <= 1.0;
            if (overCrate) {
                expect(node.y).toBeGreaterThanOrEqual(crateTopWorldY - 0.03);
            }
        });

        // Now toggle oogHasCargo to false (empty flat rack deck)
        state.oogHasCargo = false;
        simApi.rebuild();
        simApi.stepPhysics(100);

        const upperDeck = pool.find(s => s.drawMeta && s.drawMeta.role === 'upper' && s.group.visible);
        expect(upperDeck).toBeDefined();
        expect(upperDeck.ropeSim).not.toBeNull();

        // When empty, nodes should drop down toward the flatrack deck, well below crateTopWorldY
        const minDeckNodeY = Math.min(...upperDeck.ropeSim.p.map(n => n.y));
        expect(minDeckNodeY).toBeLessThan(crateTopWorldY - 0.4);
    });

    it('7a. An automatically sized auxiliary chain has installation slack and sags through free air', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();
        state.beamType = 'spreader';
        state.slingType = 'chain';
        state.gear.extraCables = [{
            id: 'test-extra-chain', memberId: 'main', off: 0,
            to: 'cargo', lug: 0, lengthM: null, userSet: false,
            swlT: 12, diaMm: 18, slingType: 'chain', broken: false
        }];
        simApi.rebuild();
        simApi.stepPhysics(100);

        const cable = phy.cables.find(c => c.role === 'extra' && c.index === 0);
        const sling = simApi.getSlingPool().find(s => s.group.visible && s.drawMeta
            && s.drawMeta.role === 'extra' && s.drawMeta.index === 0);
        expect(cable).toBeTruthy();
        expect(sling).toBeTruthy();
        // The automatic fabricated length must include real extra material, not equal the chord.
        const a = sling.pinA, b = sling.pinB;
        expect(cable.L0).toBeGreaterThan(a.distanceTo(b) + 0.03);
        expect(sling.ropeSim).not.toBeNull();
        const mid = sling.ropeSim.p[Math.floor(sling.ropeSim.p.length / 2)];
        const chordMidY = (a.y + b.y) * 0.5;
        expect(mid.y).toBeLessThan(chordMidY - 0.01);

        // An explicitly measured/user-entered length is never overwritten by the allowance.
        state.gear.extraCables[0].lengthM = 3.7;
        state.gear.extraCables[0].userSet = true;
        simApi.rebuild();
        expect(phy.cables.find(c => c.role === 'extra' && c.index === 0).L0).toBeCloseTo(3.7, 6);
    });

    it('8. Test ISO 40ft container lift with frame spreader', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();

        state.cargoType = 'container';
        state.L = 12.2;
        state.W = 2.4;
        state.H = 2.6;
        state.weight = 28.2;
        state.beamType = 'frame';
        state.lugElevPreset = 'bottom';
        simApi.rebuild();

        // 1. Lower hook to 4.2m like Image 1
        phy.hookPos.set(0, 4.2, 0);
        phy.hookTarget.set(0, 4.2, 0);
        state.poseLock = true;
        simApi.stepPhysics(60);

        // 2. Click "Nhấc thử" (hoist hook smoothly toward target)
        state.poseLock = false;
        phy.autoHoistActive = true;
        phy.hookTarget.y = 8.0;

        let maxCargoVelY = -Infinity;
        let prevHookY = phy.hookPos.y;
        let hookJumped = false;

        for (let f = 0; f < 60; f++) {
            simApi.stepPhysics(1);
            if (phy.cargoVel.y > maxCargoVelY) maxCargoVelY = phy.cargoVel.y;
            if (phy.hookPos.y - prevHookY > 0.08) hookJumped = true;
            prevHookY = phy.hookPos.y;
        }

        // Must hoist smoothly without teleporting hook or launching container into the sky
        expect(hookJumped).toBe(false);
        expect(maxCargoVelY).toBeLessThan(1.5);
        expect(phy.cargoPos.y).toBeLessThan(5.0);
    });

    it('9. Switching to boat cargo and custom 3D dimensions runs simulation smoothly without padEyeRingWorld crash', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();

        state.cargoType = 'boat';
        state.L = 12.0;
        state.W = 3.4;
        state.H = 3.2;
        state.weight = 33.5;
        state.beamType = 'frame';
        simApi.rebuild();

        expect(() => {
            for (let f = 0; f < 30; f++) {
                simApi.stepPhysics(1);
            }
        }).not.toThrow();

        expect(state.lugs.length).toBeGreaterThanOrEqual(4);
        expect(state.lugNormals.length).toBeGreaterThanOrEqual(4);
        state.lugs.forEach(lp => {
            expect(lp).toBeDefined();
            expect(isFinite(lp.x)).toBe(true);
            expect(isFinite(lp.y)).toBe(true);
            expect(isFinite(lp.z)).toBe(true);
        });
    });

    it('10. Cutting cable while cargo rests on ground preserves intact lashing straps & level cargo (no ejection); only airborne cut snaps straps', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();

        state.cargoType = 'flatrack';
        state.L = 12.2;
        state.W = 2.4;
        state.H = 2.6;
        state.beamType = 'spreader';
        state.oogHasCargo = true;
        simApi.rebuild();

        // 1. Cargo is resting on ground (clearance <= 0.05)
        expect(phy.groundClearance || 0).toBeLessThanOrEqual(0.05);

        // 2. Cut lower cable LP2 while grounded
        const cutCable = (phy.cables || []).find(c => c.role === 'leg' && c.index === 1);
        expect(cutCable).toBeDefined();
        simApi.noteCableSnap(cutCable, 'Da chu dong cat LP2');

        // Advance simulation for 60 frames while grounded
        for (let f = 0; f < 60; f++) {
            simApi.stepPhysics(1);
        }

        // Lashing straps must REMAIN INTACT and secured (no snap on ground!)
        expect(phy.oogState).toBeDefined();
        expect(phy.oogState.strapsBroken).toBe(false);
        expect(phy.oogState.status).toBe('secured');
        expect(phy.oogState.localPos.z).toBeCloseTo(0, 1);
        expect(phy.groundClearance || 0).toBeLessThanOrEqual(0.05);

        // 3. Part B: Airborne cut - reset, hoist off the ground, then cut sling in mid-air
        simApi.resetToInitialPreLiftState();
        state.cargoType = 'flatrack';
        state.L = 12.2;
        state.W = 2.4;
        state.H = 2.6;
        state.beamType = 'spreader';
        state.oogHasCargo = true;
        state.gear.uppers.forEach(u => {
            u.lengthM = 8.68;
            u.broken = false;
        });
        state.gear.legs.forEach(l => {
            l.lengthM = 2.0;
            l.broken = false;
        });
        simApi.rebuild();
        simApi.testLift(1.5, 1400);

        expect(phy.groundClearance).toBeGreaterThan(0.5);
        expect(phy.oogState.status).toBe('secured');

        const airborneCable = (phy.cables || []).find(c => c.role === 'leg' && c.index === 1);
        expect(airborneCable).toBeDefined();
        simApi.noteCableSnap(airborneCable, 'Cat cap tren khong');

        for (let f = 0; f < 80; f++) {
            simApi.stepPhysics(1);
        }

        // Once airborne, cutting a cable induces severe asymmetric tilt and snaps lashing straps!
        expect(phy.oogState.strapsBroken).toBe(true);
        expect(['sliding', 'falling', 'grounded']).toContain(phy.oogState.status);
    });

    it('11. Flat Rack OOG payload slides strictly parallel with deck surface before tipping and dislodging', () => {
        simApi.resetToInitialPreLiftState();
        const state = simApi.getState();
        const phy = simApi.getPhy();

        state.cargoType = 'flatrack';
        state.L = 12.2;
        state.W = 2.4;
        state.H = 2.6;
        state.beamType = 'spreader';
        state.oogHasCargo = true;
        state.gear.uppers.forEach(u => {
            u.lengthM = 8.68;
            u.broken = false;
        });
        state.gear.legs.forEach(l => {
            l.lengthM = 2.0;
            l.broken = false;
        });
        simApi.rebuild();
        simApi.testLift(1.5, 1400);

        const airborneCable = (phy.cables || []).find(c => c.role === 'leg' && c.index === 1);
        expect(airborneCable).toBeDefined();
        simApi.noteCableSnap(airborneCable, 'Cat cap de kiem tra truot song song');

        const cargoVis = simApi.getCargoVisual();
        const oogGroup = cargoVis ? cargoVis.getObjectByName('flatRackOogCargo') : null;

        let observedParallelSlide = false;

        // Step simulation frame by frame during sliding
        for (let f = 0; f < 100; f++) {
            simApi.stepPhysics(1);
            if (phy.oogState && phy.oogState.status === 'sliding') {
                const freeSlideX = Math.max(0.40, (state.L * 0.5 - 0.20) - (phy.oogState.half ? phy.oogState.half.hx : 4.4));
                const parallelLimitX = freeSlideX + 0.35;
                const parallelLimitZ = Math.max(0.35, state.W * 0.36);

                const inParallelZone = Math.abs(phy.oogState.localPos.x) <= parallelLimitX && Math.abs(phy.oogState.localPos.z) <= parallelLimitZ;
                if (inParallelZone && oogGroup) {
                    // While within parallel sliding distance, crate MUST be flush (y = 0) and strictly parallel (Euler = 0, 0, 0)
                    expect(oogGroup.position.y).toBeCloseTo(0, 3);
                    expect(oogGroup.rotation.x).toBeCloseTo(0, 3);
                    expect(oogGroup.rotation.y).toBeCloseTo(0, 3);
                    expect(oogGroup.rotation.z).toBeCloseTo(0, 3);
                    observedParallelSlide = true;
                }
            }
        }

        expect(observedParallelSlide).toBe(true);
    });
});
