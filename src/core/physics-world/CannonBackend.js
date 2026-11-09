/**
 * ============================================================================
 * CANNON-ES ADAPTER (CannonBackend.js)
 * Implements IPhysicsBackend contract for Cannon-es
 * ============================================================================
 */

import * as CANNON from 'cannon-es';
import { IPhysicsBackend } from './IPhysicsBackend.js';
import { G_ACCEL } from './Units.js';

export class CannonBackend extends IPhysicsBackend {
    constructor(options = {}) {
        super();
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, options.gravityY !== undefined ? options.gravityY : -G_ACCEL, 0)
        });
        this.world.allowSleep = options.allowSleep !== undefined ? options.allowSleep : false;
        this.world.defaultContactMaterial.friction = 0.4;
        this.world.defaultContactMaterial.restitution = 0.05;

        /** @type {Map<string, CANNON.Body>} */
        this.bodies = new Map();
        /** @type {Map<string, any>} */
        this.constraints = new Map();
    }

    async init() {
        return Promise.resolve();
    }

    createBody(desc) {
        let type = CANNON.Body.DYNAMIC;
        if (desc.type === 'kinematicPosition' || desc.type === 'kinematicVelocity' || desc.type === 'kinematic') {
            type = CANNON.Body.KINEMATIC;
        } else if (desc.type === 'fixed' || desc.type === 'static') {
            type = CANNON.Body.STATIC;
        }

        const body = new CANNON.Body({
            mass: type === CANNON.Body.DYNAMIC ? (desc.mass || 1.0) : 0,
            type: type,
            allowSleep: desc.canSleep || false
        });

        if (desc.position) {
            body.position.set(desc.position.x || 0, desc.position.y || 0, desc.position.z || 0);
        }
        if (desc.rotation) {
            body.quaternion.set(
                desc.rotation.x || 0,
                desc.rotation.y || 0,
                desc.rotation.z || 0,
                desc.rotation.w !== undefined ? desc.rotation.w : 1
            );
        }

        // Add default inertia box shape if dynamic and no collider specified yet
        if (type === CANNON.Body.DYNAMIC && !desc.skipDefaultCollider) {
            const hx = (desc.width || 2) / 2;
            const hy = (desc.height || 2) / 2;
            const hz = (desc.depth || 2) / 2;
            body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
            body.updateMassProperties();
        }

        body.userData = { id: desc.id, desc };
        this.world.addBody(body);
        this.bodies.set(desc.id, body);
        return desc.id;
    }

    addCollider(bodyId, shapeDesc) {
        const body = this.bodies.get(bodyId);
        if (!body) return;

        let shape = null;
        const offset = shapeDesc.offset ? new CANNON.Vec3(shapeDesc.offset.x || 0, shapeDesc.offset.y || 0, shapeDesc.offset.z || 0) : undefined;
        const orientation = shapeDesc.orientation ? new CANNON.Quaternion(shapeDesc.orientation.x || 0, shapeDesc.orientation.y || 0, shapeDesc.orientation.z || 0, shapeDesc.orientation.w !== undefined ? shapeDesc.orientation.w : 1) : undefined;

        if (shapeDesc.type === 'box') {
            const hx = (shapeDesc.hx !== undefined ? shapeDesc.hx : (shapeDesc.width || 1) / 2);
            const hy = (shapeDesc.hy !== undefined ? shapeDesc.hy : (shapeDesc.height || 1) / 2);
            const hz = (shapeDesc.hz !== undefined ? shapeDesc.hz : (shapeDesc.depth || 1) / 2);
            shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
        } else if (shapeDesc.type === 'sphere') {
            shape = new CANNON.Sphere(shapeDesc.radius || 0.5);
        } else if (shapeDesc.type === 'cylinder') {
            shape = new CANNON.Cylinder(
                shapeDesc.radiusTop || 0.5,
                shapeDesc.radiusBottom || 0.5,
                shapeDesc.height || 1.0,
                shapeDesc.segments || 16
            );
        } else if (shapeDesc.type === 'plane') {
            shape = new CANNON.Plane();
        }

        if (shape) {
            body.addShape(shape, offset, orientation);
            body.updateMassProperties();
        }
    }

    addConstraint(id, constraint) {
        this.world.addConstraint(constraint);
        this.constraints.set(id, constraint);
    }

    removeConstraint(id) {
        const c = this.constraints.get(id);
        if (c) {
            this.world.removeConstraint(c);
            this.constraints.delete(id);
        }
    }

    removeBody(bodyId) {
        const body = this.bodies.get(bodyId);
        if (body) {
            this.world.removeBody(body);
            this.bodies.delete(bodyId);
        }
    }

    wakeUp(bodyId) {
        const body = this.bodies.get(bodyId);
        if (body) {
            body.wakeUp();
        }
    }

    applyImpulseAtPoint(bodyId, impulse, worldPoint) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type !== CANNON.Body.DYNAMIC) return;

        const impVec = new CANNON.Vec3(impulse.x, impulse.y, impulse.z);
        const ptVec = new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z);
        body.applyImpulse(impVec, ptVec);
    }

    setKinematicTarget(bodyId, position, quaternion) {
        const body = this.bodies.get(bodyId);
        if (!body) return;
        if (position) {
            body.position.set(position.x, position.y, position.z);
        }
        if (quaternion) {
            body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        }
    }

    step(h) {
        this.world.step(h);
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
        return {
            position: { x: body.position.x, y: body.position.y, z: body.position.z },
            quaternion: { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w },
            linvel: { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z },
            angvel: { x: body.angularVelocity.x, y: body.angularVelocity.y, z: body.angularVelocity.z }
        };
    }

    dispose() {
        for (const [id] of this.constraints) {
            this.removeConstraint(id);
        }
        for (const [id] of this.bodies) {
            this.removeBody(id);
        }
        this.bodies.clear();
        this.constraints.clear();
    }
}
