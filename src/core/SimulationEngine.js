/**
 * ============================================================================
 * MODULE 3: INDUSTRIAL SIMULATION ENGINE (SimulationEngine.js)
 * Architecture: CAE / Industrial Physics Simulation Core (Vortex Grade)
 * Physics Engine: Cannon-es (Discrete RigidBody Mechanics & Constraint Solver)
 * Solves: "Bouncing / Styrofoam Box" bug via Critically Damped Inextensible RopeConstraints
 * Metric System: SI Metric (Meters, Seconds, Kilograms, Newtons, g = 9.80665 m/s²)
 * ============================================================================
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RopeConstraint } from './RopeConstraint.js';
import { EngineeringEngine } from './EngineeringEngine.js';
import { ElasticSlingEngine } from './ElasticSlingEngine.js';

export class SimulationEngine {
    constructor() {
        // 1. Initialize Cannon-es Physics World
        this.world = new CANNON.World();
        this.world.gravity.set(0, -EngineeringEngine.GRAVITY, 0);

        // High-precision solver iterations for rigid rigging constraints (eliminates rubber-band oscillation)
        this.world.solver.iterations = 40;
        this.world.solver.tolerance = 1e-5;

        // Ground / Quay contact physics (low restitution = zero bouncy rubber-ball effect)
        this.world.defaultContactMaterial.friction = 0.65;
        this.world.defaultContactMaterial.restitution = 0.01;
        this.world.defaultContactMaterial.contactEquationStiffness = 1e8;
        this.world.defaultContactMaterial.contactEquationRelaxation = 1;

        // 2. Active Physics Bodies & Constraints Map
        this.bodies = {
            ground: null,
            craneHook: null,
            spreader: null,
            cargo: null
        };

        this.constraints = {
            upperBridles: [],
            lowerLegs: []
        };

        // Directed load path, rebuilt whenever a connector changes state.  This
        // is intentionally independent from the numerical solver: a constraint
        // can have zero instantaneous tension at the exact frame it parts, but
        // it must no longer be considered structural support.
        this.loadGraph = {
            supportedIds: new Set(['hook_main']),
            detachedIds: [],
            linksScanned: 0
        };

        // 3. Three.js Binding Maps (RigidBody -> Three.js Mesh)
        this.meshBindings = [];

        // 4. Crane Winch & Trolley Control State
        this.winch = {
            hookHeight: 12.0,
            targetHeight: 12.0,
            trolleyX: 0.0,
            trolleyZ: 0.0,
            slewAngleRad: 0.0,
            hoistVelocity: 0.0,
            maxSpeedMps: 0.8,
            minSpeedMps: 0.12,
            stallForceN: 650000, // 65-tonne winch motor stall limit
            criticalDamping: 0.99
        };

        // 5. Real-time Telemetry State
        this.telemetry = {
            grossMassKg: 0,
            grossWeightN: 0,
            hoistMotorSpeedMps: 0,
            hoistMotorLoadPct: 0,
            tensions: [], // { id, role, tensionN, tensionT, isOverloaded, wllT }
            cargoPosition: new THREE.Vector3(),
            cargoRotationDeg: { pitch: 0, roll: 0, yaw: 0 },
            groundClearanceM: 0
        };

        this.isSimulating = false;
        this.timeStep = 1 / 60;

        // Build static quayside ground plane
        this.buildGroundPlane();
    }

    /**
     * Builds static ground plane representing the reinforced concrete quay apron.
     */
    buildGroundPlane() {
        const groundBody = new CANNON.Body({
            mass: 0, // Static rigid body
            shape: new CANNON.Plane(),
            material: this.world.defaultMaterial
        });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundBody.position.set(0, 0, 0);
        this.world.addBody(groundBody);
        this.bodies.ground = groundBody;
    }

    /**
     * Resolves the live breaking capacity of a sling.  Synthetic sling capacity
     * is derated before the constraint is created when its plan says it bears on
     * an exposed sharp edge without a protector; the solver therefore snaps at
     * the same MBL that the safety calculation displays.
     */
    resolveBreakingForceN(definition = {}, fallbackWllT = 25) {
        const slingType = definition.cableType || definition.slingType || 'wire_rope_sling';
        const wllT = Math.max(0.05, definition.wllT || fallbackWllT);
        const safetyFactor = Math.max(1.5, definition.safetyFactor || definition.sf
            || (/chain/i.test(slingType) ? 4 : (/web|round|poly/i.test(slingType) ? 7 : 5)));
        const edge = ElasticSlingEngine.evaluateSharpEdgeProtection(
            slingType,
            !!(definition.hasCornerProtector || definition.cornerProtector),
            !!definition.edgeExposed
        );
        return {
            edgeFactor: edge.effectiveMblFactor,
            mblN: wllT * EngineeringEngine.GRAVITY * 1000 * safetyFactor * edge.effectiveMblFactor
        };
    }

    /**
     * Injects the RiggingPlanJSON manifest into the physics engine.
     * Constructs the full rigid body chain with inextensible, critically damped RopeConstraints.
     *
     * Chain:
     * Crane Hook (Kinematic) -> Master Link -> Upper Slings -> Spreader Body -> Lower Legs/Twistlocks -> Cargo Body
     */
    initializeFromPlan(plan) {
        this.resetWorld();

        const { cargo: cargoPlan, rigging: rigPlan, crane: cranePlan } = plan;
        const cargoMass = Math.max(500, cargoPlan.massKg);
        const spreaderMass = Math.max(0, rigPlan.spreaderMassKg || 0);

        this.telemetry.grossMassKg = cargoMass + spreaderMass + 450; // include hook block
        this.telemetry.grossWeightN = this.telemetry.grossMassKg * EngineeringEngine.GRAVITY;

        // ------------------------------------------------------------------------
        // 1. CRANE HOOK RIGID BODY (Kinematic / Controlled Motor)
        // ------------------------------------------------------------------------
        const hookPos = cranePlan.hookPosition || { x: 0, y: 12.0, z: 0 };
        this.winch.hookHeight = hookPos.y;
        this.winch.targetHeight = hookPos.y;
        this.winch.trolleyX = hookPos.x;
        this.winch.trolleyZ = hookPos.z;

        const hookBody = new CANNON.Body({
            mass: 450,
            type: CANNON.Body.KINEMATIC,
            position: new CANNON.Vec3(hookPos.x, hookPos.y, hookPos.z),
            shape: new CANNON.Sphere(0.35)
        });
        this.world.addBody(hookBody);
        this.bodies.craneHook = hookBody;

        // ------------------------------------------------------------------------
        // 2. CARGO RIGID BODY (Dynamic Heavy Payload, e.g. 24,000 kg ISO Container)
        // ------------------------------------------------------------------------
        const { x: L, y: H, z: W } = cargoPlan.dimensions;
        this.cargoH = H;
        this.cargoDimensions = { x: L, y: H, z: W };
        const cog = cargoPlan.cogLocal || { x: 0, y: 0, z: 0 };
        this.cogLocal = cog;
        const cargoShape = new CANNON.Box(new CANNON.Vec3(L / 2, H / 2, W / 2));

        // Initial cargo position resting directly flush on quayside ground plane:
        // The bottom of the shape is at (cog.y - H/2) relative to body position.
        // For bottom to sit exactly at Y = 0.00: initialCargoY = H/2 - cog.y
        const initialCargoY = H / 2 - (cog.y || 0);
        this.initialCargoY = initialCargoY;

        const cargoBody = new CANNON.Body({
            mass: cargoMass,
            position: new CANNON.Vec3(0, initialCargoY, 0),
            linearDamping: 0.05,
            angularDamping: 0.08
        });

        // Apply CoG eccentricity offset inside rigid body
        cargoBody.addShape(cargoShape, new CANNON.Vec3(cog.x, cog.y, cog.z));

        this.world.addBody(cargoBody);
        this.bodies.cargo = cargoBody;

        // ------------------------------------------------------------------------
        // 3. SPREADER BEAM RIGID BODY (Dynamic Below-the-Hook Lifting Gear, e.g. 9,500 kg)
        // ------------------------------------------------------------------------
        let intermediateBody = hookBody;
        let intermediateUpperPivots = [];
        let intermediateLowerPivots = [];

        if (spreaderMass > 0 && rigPlan.type !== 'bridle_4leg') {
            const sDim = rigPlan.spreaderDimensions || { x: L, y: 0.65, z: W };
            const spreaderShape = new CANNON.Box(new CANNON.Vec3(sDim.x / 2, sDim.y / 2, sDim.z / 2));

            // Position spreader sitting right above container corner castings (separated by 0.35m twistlock height)
            const spreaderInitialY = H + 0.35 + sDim.y / 2;
            const spreaderBody = new CANNON.Body({
                mass: spreaderMass,
                position: new CANNON.Vec3(0, spreaderInitialY, 0),
                shape: spreaderShape,
                linearDamping: 0.05,
                angularDamping: 0.08
            });

            this.world.addBody(spreaderBody);
            this.bodies.spreader = spreaderBody;

            // Connect Hook to Spreader via 4 Upper Bridle Slings
            const topBridleLen = rigPlan.topBridle ? (rigPlan.topBridle.lengthM || 3.8) : 3.8;
            const sHalfX = sDim.x / 2;
            const sHalfZ = sDim.z / 2;

            // Upper pad-eyes on top of spreader
            const spreaderTopPads = [
                new CANNON.Vec3( sHalfX * 0.7, sDim.y / 2,  sHalfZ * 0.5),
                new CANNON.Vec3(-sHalfX * 0.7, sDim.y / 2,  sHalfZ * 0.5),
                new CANNON.Vec3(-sHalfX * 0.7, sDim.y / 2, -sHalfZ * 0.5),
                new CANNON.Vec3( sHalfX * 0.7, sDim.y / 2, -sHalfZ * 0.5)
            ];

            const hookMasterPivot = new CANNON.Vec3(0, -0.65, 0);

            spreaderTopPads.forEach((padLocal, idx) => {
                const topStrength = this.resolveBreakingForceN(rigPlan.topBridle || {}, 25.0);
                const breakingForceN = topStrength.mblN;

                // Rest length matches initial geometric distance to guarantee zero initial shock
                const pAWorld = new CANNON.Vec3();
                const pBWorld = new CANNON.Vec3();
                hookBody.pointToWorldFrame(hookMasterPivot, pAWorld);
                spreaderBody.pointToWorldFrame(padLocal, pBWorld);
                const initDist = pAWorld.distanceTo(pBWorld);
                const topBridleLen = (rigPlan.topBridle && rigPlan.topBridle.lengthM != null && Math.abs(rigPlan.topBridle.lengthM - initDist) < 0.05)
                    ? rigPlan.topBridle.lengthM
                    : initDist;

                const rope = new RopeConstraint(
                    hookBody,
                    hookMasterPivot,
                    spreaderBody,
                    padLocal,
                    topBridleLen,
                    breakingForceN
                );
                this.world.addConstraint(rope);
                this.constraints.upperBridles.push({
                    id: `upper_${idx}`,
                    constraint: rope,
                    wllT: rigPlan.topBridle ? rigPlan.topBridle.wllT : 25.0,
                    edgeFactor: topStrength.edgeFactor,
                    mblN: topStrength.mblN,
                    parentId: 'hook_main',
                    childId: 'spreader',
                    isIntact: true
                });
            });

            intermediateBody = spreaderBody;
            intermediateLowerPivots = [
                new CANNON.Vec3( sHalfX - 0.09, -sDim.y / 2,  sHalfZ - 0.09),
                new CANNON.Vec3(-sHalfX + 0.09, -sDim.y / 2,  sHalfZ - 0.09),
                new CANNON.Vec3(-sHalfX + 0.09, -sDim.y / 2, -sHalfZ + 0.09),
                new CANNON.Vec3( sHalfX - 0.09, -sDim.y / 2, -sHalfZ + 0.09)
            ];
        } else {
            // Direct 4-leg bridle from Hook directly to Cargo pad-eyes
            intermediateLowerPivots = [
                new CANNON.Vec3(0, -0.65, 0),
                new CANNON.Vec3(0, -0.65, 0),
                new CANNON.Vec3(0, -0.65, 0),
                new CANNON.Vec3(0, -0.65, 0)
            ];
        }

        // ------------------------------------------------------------------------
        // 4. LOWER LEGS / TWISTLOCK CONSTRAINTS (Spreader -> Cargo Corner Castings)
        // ------------------------------------------------------------------------
        cargoPlan.padEyes.forEach((pe, idx) => {
            const upperAttach = intermediateLowerPivots[idx] || new CANNON.Vec3(0, 0, 0);
            // Cannon's body frame is at the centre of mass. Pad-eye positions in
            // the lift plan are expressed from the cargo geometric centre, so they
            // must be translated into the body frame when the CoG is eccentric.
            const lowerAttach = new CANNON.Vec3(
                pe.localPos.x - (cog.x || 0),
                pe.localPos.y - (cog.y || 0),
                pe.localPos.z - (cog.z || 0)
            );
            const legDef = (rigPlan.lowerLegs && rigPlan.lowerLegs[idx]) ? rigPlan.lowerLegs[idx] : { lengthM: 0.35, wllT: pe.wllT || 17.0 };

            const lowerStrength = this.resolveBreakingForceN(legDef, legDef.wllT || 17.0);
            const breakingForceN = lowerStrength.mblN;

            const pAWorld = new CANNON.Vec3();
            const pBWorld = new CANNON.Vec3();
            intermediateBody.pointToWorldFrame(upperAttach, pAWorld);
            cargoBody.pointToWorldFrame(lowerAttach, pBWorld);
            const initDist = pAWorld.distanceTo(pBWorld);
            const legLen = (legDef.lengthM != null && Math.abs(legDef.lengthM - initDist) < 0.05) ? legDef.lengthM : initDist;

            const rope = new RopeConstraint(
                intermediateBody,
                upperAttach,
                cargoBody,
                lowerAttach,
                legLen,
                breakingForceN
            );

            this.world.addConstraint(rope);
            this.constraints.lowerLegs.push({
                id: `lower_${idx}`,
                constraint: rope,
                wllT: legDef.wllT || 17.0,
                edgeFactor: lowerStrength.edgeFactor,
                mblN: lowerStrength.mblN,
                padEyeId: pe.id,
                parentId: spreaderMass > 0 && rigPlan.type !== 'bridle_4leg' ? 'spreader' : 'hook_main',
                childId: 'cargo',
                isIntact: true
            });
        });

        this.isSimulating = true;
        this.scanLoadBearingGraph();
    }

    /**
     * Resets the Cannon-es physics world and clears constraints.
     */
    resetWorld() {
        this.constraints.upperBridles.forEach(c => this.world.removeConstraint(c.constraint));
        this.constraints.lowerLegs.forEach(c => this.world.removeConstraint(c.constraint));

        this.constraints.upperBridles = [];
        this.constraints.lowerLegs = [];

        if (this.bodies.cargo) this.world.removeBody(this.bodies.cargo);
        if (this.bodies.spreader) this.world.removeBody(this.bodies.spreader);
        if (this.bodies.craneHook) this.world.removeBody(this.bodies.craneHook);

        this.bodies.cargo = null;
        this.bodies.spreader = null;
        this.bodies.craneHook = null;
        this.meshBindings = [];
        this.loadGraph = { supportedIds: new Set(['hook_main']), detachedIds: [], linksScanned: 0 };
    }

    /**
     * Returns all rigging links in one canonical collection.  Keeping the link
     * metadata next to the live Cannon constraints makes UI cuts, auto-breaks,
     * and safety tests share exactly the same source of truth.
     */
    getRiggingLinks() {
        return [...this.constraints.upperBridles, ...this.constraints.lowerLegs];
    }

    /**
     * Breadth-first traversal from the crane hook through intact tension links.
     * A dynamic object not reached here is explicitly awakened so it cannot
     * remain frozen in mid-air after a cable/pin/twistlock failure.
     */
    scanLoadBearingGraph() {
        const links = this.getRiggingLinks();
        const supportedIds = new Set(['hook_main']);
        const queue = ['hook_main'];
        while (queue.length) {
            const parentId = queue.shift();
            for (const link of links) {
                if (!link.isIntact || link.constraint.isBroken || link.parentId !== parentId) continue;
                if (!supportedIds.has(link.childId)) {
                    supportedIds.add(link.childId);
                    queue.push(link.childId);
                }
            }
        }

        const bodyById = { spreader: this.bodies.spreader, cargo: this.bodies.cargo };
        const detachedIds = [];
        Object.entries(bodyById).forEach(([id, body]) => {
            if (!body) return;
            const isSupported = supportedIds.has(id);
            body.isSupported = isSupported;
            if (!isSupported) {
                detachedIds.push(id);
                body.type = CANNON.Body.DYNAMIC;
                body.allowSleep = false;
                body.wakeUp();
            }
        });
        this.loadGraph = { supportedIds, detachedIds, linksScanned: links.length };
        return this.loadGraph;
    }

    /**
     * Cuts one or more live rigging links.  Constraint removal and graph
     * traversal happen atomically so no frame can render a disconnected body as
     * still kinematically supported.
     */
    cutCables(ids) {
        const requested = Array.isArray(ids) ? ids : [ids];
        requested.forEach((id) => {
            const link = this.getRiggingLinks().find(item => item.id === id);
            if (!link) throw new Error(`Unknown rigging link: ${id}`);
            if (!link.isIntact) return;
            link.isIntact = false;
            link.constraint.isBroken = true;
            link.constraint.distanceEquation.enabled = false;
            this.world.removeConstraint(link.constraint);
        });
        return this.scanLoadBearingGraph();
    }

    /**
     * Binds a Three.js visual Object3D to a CANNON.Body for automatic synchronization.
     */
    bindMesh(cannonBody, threeObject, offset = new THREE.Vector3()) {
        this.meshBindings.push({ body: cannonBody, mesh: threeObject, offset });
    }

    /**
     * Applies winch motor control with realistic motor torque-speed curve:
     * Under heavy load (e.g. 24,000 kg + 9,500 kg = 33,500 kg), the winch struggles and hoists
     * slowly (down to 0.15 m/s). When unloaded, it hoists fast (0.8 m/s).
     */
    setWinchCommand(direction, dt) {
        if (!this.bodies.craneHook) return;

        const payloadWeightN = this.telemetry.grossWeightN;
        const stallForceN = this.winch.stallForceN;

        // Motor curve: speed drops linearly with payload weight
        const loadRatio = Math.min(0.92, payloadWeightN / Math.max(1000, stallForceN));
        const actualSpeed = this.winch.maxSpeedMps * Math.max(this.winch.minSpeedMps / this.winch.maxSpeedMps, (1.0 - loadRatio));

        this.winch.hoistVelocity = direction * actualSpeed;
        this.winch.targetHeight += this.winch.hoistVelocity * dt;
        this.winch.targetHeight = Math.max(1.8, Math.min(34.0, this.winch.targetHeight));

        this.telemetry.hoistMotorSpeedMps = actualSpeed;
        this.telemetry.hoistMotorLoadPct = Math.round(loadRatio * 100);
    }

    /**
     * Translates the crane trolley along quay (X) or across container bays (Z).
     */
    setTrolleyCommand(dx, dz) {
        this.winch.trolleyX += dx;
        this.winch.trolleyZ += dz;
    }

    /**
     * Executes one fixed physics simulation step.
     */
    step(dt = 1 / 60) {
        if (!this.isSimulating) return;

        // 1. Update Kinematic Crane Hook Position smoothly toward winch target
        if (this.bodies.craneHook) {
            const hook = this.bodies.craneHook;
            const currentY = hook.position.y;
            const dy = this.winch.targetHeight - currentY;
            hook.position.y += dy * Math.min(1.0, dt * 10.0);
            hook.position.x = this.winch.trolleyX;
            hook.position.z = this.winch.trolleyZ;
        }

        // 2. Step the Cannon-es Physics Solver (substepping for rigid constraint convergence)
        this.world.step(this.timeStep, dt, 5);

        // 3. Synchronize CANNON Rigid Bodies to Three.js Visual Meshes
        this.meshBindings.forEach(({ body, mesh, offset }) => {
            mesh.position.set(body.position.x + offset.x, body.position.y + offset.y, body.position.z + offset.z);
            mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        });

        // 4. Extract Real Physical Tensions and Update Telemetry
        this.updateTelemetry(dt);
    }

    /**
     * Extracts exact cable tensions directly from Cannon's Projected Gauss-Seidel solver multipliers.
     */
    updateTelemetry(dt) {
        const tensions = [];

        const extractTension = (item, role) => {
            const forceN = item.constraint.getTensionN();
            const tensionT = forceN / (EngineeringEngine.GRAVITY * 1000);
            const isOverloaded = tensionT > item.wllT;

            tensions.push({
                id: item.id,
                role,
                tensionN: Math.round(forceN),
                tensionT: Math.round(tensionT * 100) / 100,
                wllT: item.wllT,
                utilizationPct: Math.round((tensionT / item.wllT) * 1000) / 10,
                isOverloaded
            });
        };

        this.constraints.upperBridles.forEach(item => extractTension(item, 'upper'));
        this.constraints.lowerLegs.forEach(item => extractTension(item, 'lower'));

        // RopeConstraint may autonomously mark itself broken on an MBL event.
        // Re-evaluate support in the same frame, before any HUD/render consumer
        // can see an unsupported body as still suspended.
        this.scanLoadBearingGraph();

        this.telemetry.tensions = tensions;

        if (this.bodies.cargo) {
            const cPos = this.bodies.cargo.position;
            const cQuat = this.bodies.cargo.quaternion;

            this.telemetry.cargoPosition.set(cPos.x, cPos.y, cPos.z);

            // Compute pitch and roll angles from quaternion
            const euler = new THREE.Euler().setFromQuaternion(
                new THREE.Quaternion(cQuat.x, cQuat.y, cQuat.z, cQuat.w),
                'YXZ'
            );
            this.telemetry.cargoRotationDeg = {
                pitch: Math.round(euler.x * (180 / Math.PI) * 10) / 10,
                roll: Math.round(euler.z * (180 / Math.PI) * 10) / 10,
                yaw: Math.round(euler.y * (180 / Math.PI) * 10) / 10
            };

            // Ground clearance is the lowest physical corner, not the body centre.
            // This remains correct when an eccentric load rolls or pitches on a sling.
            const dims = this.cargoDimensions || { x: 0, y: this.cargoH || 0, z: 0 };
            const shapeOffset = this.cogLocal || { x: 0, y: 0, z: 0 };
            let lowestY = Infinity;
            for (const sx of [-1, 1]) {
                for (const sy of [-1, 1]) {
                    for (const sz of [-1, 1]) {
                        const local = new CANNON.Vec3(
                            shapeOffset.x + sx * dims.x / 2,
                            shapeOffset.y + sy * dims.y / 2,
                            shapeOffset.z + sz * dims.z / 2
                        );
                        cQuat.vmult(local, local);
                        lowestY = Math.min(lowestY, cPos.y + local.y);
                    }
                }
            }
            this.telemetry.groundClearanceM = Math.max(0, Math.round(lowestY * 100) / 100);
        }
    }
}
