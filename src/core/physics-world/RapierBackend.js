/**
 * ============================================================================
 * RAPIER3D WASM BACKEND (RapierBackend.js)
 * High-performance WASM Rigid Body & Contact Dynamics
 * ============================================================================
 */

import { IPhysicsBackend } from './IPhysicsBackend.js';
import { G_ACCEL } from './Units.js';

let RAPIER = null;

export class RapierBackend extends IPhysicsBackend {
    constructor(options = {}) {
        super();
        this.gravityY = options.gravityY !== undefined ? options.gravityY : -G_ACCEL;
        this.allowSleep = options.allowSleep !== undefined ? options.allowSleep : false;
        this.world = null;

        /** @type {Map<string, any>} */
        this.bodies = new Map();
        /** @type {Map<string, any[]>} */
        this.colliders = new Map();
        this.isInitialized = false;
    }

    async init() {
        if (!RAPIER) {
            const rapierModule = await import('@dimforge/rapier3d-compat');
            RAPIER = rapierModule.default || rapierModule;
            await RAPIER.init();
        }
        this.world = new RAPIER.World({ x: 0, y: this.gravityY, z: 0 });
        this.isInitialized = true;
    }

    createBody(desc) {
        if (!this.world) throw new Error('RapierBackend not initialized. Call await init() first.');

        let bodyDesc;
        if (desc.type === 'kinematicPosition' || desc.type === 'kinematic') {
            bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        } else if (desc.type === 'fixed' || desc.type === 'static') {
            bodyDesc = RAPIER.RigidBodyDesc.fixed();
        } else {
            bodyDesc = RAPIER.RigidBodyDesc.dynamic();
            if (desc.mass !== undefined) {
                bodyDesc.setMass(desc.mass);
            }
        }

        if (desc.position) {
            bodyDesc.setTranslation(desc.position.x || 0, desc.position.y || 0, desc.position.z || 0);
        }
        if (desc.rotation) {
            bodyDesc.setRotation({
                x: desc.rotation.x || 0,
                y: desc.rotation.y || 0,
                z: desc.rotation.z || 0,
                w: desc.rotation.w !== undefined ? desc.rotation.w : 1
            });
        }

        bodyDesc.setCanSleep(desc.canSleep || false);
        if (desc.ccdEnabled) {
            bodyDesc.setCcdEnabled(true);
        }

        const body = this.world.createRigidBody(bodyDesc);
        body.userData = { id: desc.id, desc };
        this.bodies.set(desc.id, body);
        this.colliders.set(desc.id, []);
        return desc.id;
    }

    addCollider(bodyId, shapeDesc) {
        const body = this.bodies.get(bodyId);
        if (!body) return;

        let colDesc = null;
        if (shapeDesc.type === 'box') {
            const hx = (shapeDesc.hx !== undefined ? shapeDesc.hx : (shapeDesc.width || 1) / 2);
            const hy = (shapeDesc.hy !== undefined ? shapeDesc.hy : (shapeDesc.height || 1) / 2);
            const hz = (shapeDesc.hz !== undefined ? shapeDesc.hz : (shapeDesc.depth || 1) / 2);
            colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
        } else if (shapeDesc.type === 'sphere') {
            colDesc = RAPIER.ColliderDesc.ball(shapeDesc.radius || 0.5);
        } else if (shapeDesc.type === 'cylinder') {
            colDesc = RAPIER.ColliderDesc.cylinder((shapeDesc.height || 1.0) / 2, shapeDesc.radius || 0.5);
        }

        if (colDesc) {
            if (shapeDesc.friction !== undefined) colDesc.setFriction(shapeDesc.friction);
            if (shapeDesc.restitution !== undefined) colDesc.setRestitution(shapeDesc.restitution);
            if (shapeDesc.offset) {
                colDesc.setTranslation(shapeDesc.offset.x || 0, shapeDesc.offset.y || 0, shapeDesc.offset.z || 0);
            }
            if (shapeDesc.orientation) {
                colDesc.setRotation({
                    x: shapeDesc.orientation.x || 0,
                    y: shapeDesc.orientation.y || 0,
                    z: shapeDesc.orientation.z || 0,
                    w: shapeDesc.orientation.w !== undefined ? shapeDesc.orientation.w : 1
                });
            }

            const collider = this.world.createCollider(colDesc, body);
            const list = this.colliders.get(bodyId) || [];
            list.push(collider);
            this.colliders.set(bodyId, list);
        }
    }

    removeBody(bodyId) {
        const body = this.bodies.get(bodyId);
        if (body && this.world) {
            this.world.removeRigidBody(body);
            this.bodies.delete(bodyId);
            this.colliders.delete(bodyId);
        }
    }

    wakeUp(bodyId) {
        const body = this.bodies.get(bodyId);
        if (body) {
            body.wakeUp(true);
        }
    }

    applyImpulseAtPoint(bodyId, impulse, worldPoint) {
        const body = this.bodies.get(bodyId);
        if (!body || !body.isDynamic()) return;

        body.applyImpulseAtPoint(
            { x: impulse.x, y: impulse.y, z: impulse.z },
            { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z },
            true
        );
    }

    setKinematicTarget(bodyId, position, quaternion) {
        const body = this.bodies.get(bodyId);
        if (!body) return;

        if (position) {
            body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
        }
        if (quaternion) {
            body.setNextKinematicRotation({
                x: quaternion.x,
                y: quaternion.y,
                z: quaternion.z,
                w: quaternion.w
            });
        }
    }

    step(h) {
        if (this.world) {
            this.world.timestep = h;
            this.world.step();
        }
    }

    getTransform(bodyId) {
        const body = this.bodies.get(bodyId);
        if (!body) {
            return {
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
                linvel: { x: 0, y: 0, z: 0 },
                angvel: { x: 0, y: 0, z: 0 }
            };
        }

        const t = body.translation();
        const r = body.rotation();
        const lv = body.linvel();
        const av = body.angvel();

        return {
            position: { x: t.x, y: t.y, z: t.z },
            quaternion: { x: r.x, y: r.y, z: r.z, w: r.w },
            linvel: { x: lv.x, y: lv.y, z: lv.z },
            angvel: { x: av.x, y: av.y, z: av.z }
        };
    }

    dispose() {
        if (this.world) {
            this.world.free();
            this.world = null;
        }
        this.bodies.clear();
        this.colliders.clear();
    }
}
