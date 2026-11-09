import fs from 'node:fs';
import path from 'node:path';
import * as THREE_NS from 'three';
import * as CANNON from 'cannon-es';
import * as CAE from '../src/core/index.js';
import * as GFX from '../src/graphics/index.js';

export function createHeadlessSim() {
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
            rebuildCargoAndRig: (reset) => rebuildCargoAndRig(reset),
            stepPhysicsEngine: (dt) => stepPhysicsEngine(dt),
            stepFlatRackPayloadPhysics: (dt) => stepFlatRackPayloadPhysics(dt || 1 / 60),
            updateSceneAndTelemetry: () => updateSceneAndTelemetry(),
            autoPositionHookForLift: (h) => autoPositionHookForLift(h),
            resetAllToFactoryDefaults: () => resetAllToFactoryDefaults(),
            setRigging(beam, sling, hardware, deltaL = [0, 0, 0, 0]) {
                state.beamType = beam;
                state.slingType = sling;
                state.hwType = hardware;
                state.legDeltaL = [...deltaL];
                state.upperSlingLength = null;
                state.lowerSlingLength = null;
                state.slingUserSet = false;
                rebuildCargoAndRig(false);
            },
            testLift(clearance = 1.2, maxSteps = 1200) {
                autoPositionHookForLift(clearance);
                let steps = 0;
                while (steps < maxSteps && Math.abs(phy.hookPos.y - phy.hookTarget.y) > 0.02) {
                    stepPhysicsEngine(1 / 60);
                    steps++;
                }
                for (let i = 0; i < 60; i++) stepPhysicsEngine(1 / 60);
            },
            stepSim(frames = 1) {
                for (let i = 0; i < frames; i++) stepPhysicsEngine(1 / 60);
            },
            snapCable(role, index, message = 'Headless test cable cut') {
                const cable = (phy.cables || []).find(c => c.role === role && c.index === index);
                if (!cable) throw new Error('Cable not found: ' + role + ':' + index);
                noteCableSnap(cable, message);
            },
            getCargoVisual: () => activeCargoVisual,
            getSlingPool: () => sling3DPool,
            attachWorld: (end) => attachWorld(end),
            getSupportY: (x, z) => supportY(x, z),
            getFlatRackSolidBoxesWorld: () => flatRackSolidBoxesLocal().map(box => ({
                center: box.c.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos),
                half: box.h.clone(),
                quat: phy.cargoQuat.clone()
            })),
            getOogWorldCorners: () => {
                const st = phy.oogState;
                if (!st || !st.half) return [];
                const out = [];
                [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                    out.push(new THREE.Vector3(sx * st.half.hx, sy * st.half.hy, sz * st.half.hz)
                        .applyQuaternion(st.worldQuat).add(st.worldPos));
                })));
                return out;
            },
            setOogFreeBody(config = {}) {
                const oogGroup = activeCargoVisual && activeCargoVisual.getObjectByName('flatRackOogCargo');
                const meta = oogGroup && oogGroup.userData && oogGroup.userData.oogMeta;
                if (!oogGroup || !meta) throw new Error('Flat Rack OOG cargo is not available');
                const st = phy.oogState || (resetFlatRackPayloadState(), phy.oogState);
                st.status = config.status || 'falling';
                st.strapsBroken = true;
                if (st.lashing) st.lashing.isIntact = false;
                st.massKg = config.massKg || Math.max(600, ((state.weight || 22) - (state.tareT || 4.8)) * 1000);
                st.half = { hx: meta.half.hx, hy: meta.half.hy, hz: meta.half.hz };
                st.worldPos.copy(config.position || new THREE.Vector3(0, meta.half.hy + 2, 0));
                st.worldQuat.copy(config.quaternion || new THREE.Quaternion());
                st.worldVel.copy(config.velocity || new THREE.Vector3());
                st.worldOmega.copy(config.omega || new THREE.Vector3());
                st.impactedGround = !!config.impactedGround;
                phy.effectiveCargoWeightT = Math.min(state.weight || 22, state.tareT || 4.8);
                return st;
            },
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
            }
        };`
    ].join('\n');

    const factory = new Function(bundleSource);
    const api = factory();
    api.bootHeadless();
    return api;
}
