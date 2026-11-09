/**
 * ============================================================================
 * IPHYSICS BACKEND INTERFACE (IPhysicsBackend.js)
 * Clean Architecture Contract for Multibody Rigid-Body Engines (Rapier / Cannon)
 * ============================================================================
 */

export class IPhysicsBackend {
    /**
     * Initializes the physics world WASM or engine core
     * @returns {Promise<void>}
     */
    async init() {
        throw new Error('Not implemented: init()');
    }

    /**
     * Creates a rigid body
     * @param {Object} desc - Body descriptor
     * @param {string} desc.id - Unique ID
     * @param {'dynamic'|'kinematicPosition'|'kinematicVelocity'|'fixed'} desc.type
     * @param {number} desc.mass - Mass in kg
     * @param {{x: number, y: number, z: number}} [desc.position]
     * @param {{x: number, y: number, z: number, w: number}} [desc.rotation]
     * @param {boolean} [desc.canSleep] - Default false for rigging chains
     * @param {boolean} [desc.ccdEnabled] - Continuous collision detection
     * @returns {string} Body ID
     */
    createBody(desc) {
        throw new Error('Not implemented: createBody()');
    }

    /**
     * Adds a collider shape to a body
     * @param {string} bodyId
     * @param {Object} shapeDesc - Shape description (box, sphere, cylinder, etc.)
     */
    addCollider(bodyId, shapeDesc) {
        throw new Error('Not implemented: addCollider()');
    }

    /**
     * Removes a body and all its attached colliders
     * @param {string} bodyId
     */
    removeBody(bodyId) {
        throw new Error('Not implemented: removeBody()');
    }

    /**
     * Wakes up a rigid body
     * @param {string} bodyId
     */
    wakeUp(bodyId) {
        throw new Error('Not implemented: wakeUp()');
    }

    /**
     * Applies an impulse (N*s) at a world-space point
     * @param {string} bodyId
     * @param {{x: number, y: number, z: number}} impulse
     * @param {{x: number, y: number, z: number}} worldPoint
     */
    applyImpulseAtPoint(bodyId, impulse, worldPoint) {
        throw new Error('Not implemented: applyImpulseAtPoint()');
    }

    /**
     * Sets kinematic target (position and orientation)
     * @param {string} bodyId
     * @param {{x: number, y: number, z: number}} position
     * @param {{x: number, y: number, z: number, w: number}} [quaternion]
     */
    setKinematicTarget(bodyId, position, quaternion) {
        throw new Error('Not implemented: setKinematicTarget()');
    }

    /**
     * Steps the physical simulation for time h (substep)
     * @param {number} h
     */
    step(h) {
        throw new Error('Not implemented: step()');
    }

    /**
     * Gets current transform and motion state
     * @param {string} bodyId
     * @returns {{
     *   position: {x: number, y: number, z: number},
     *   quaternion: {x: number, y: number, z: number, w: number},
     *   linvel: {x: number, y: number, z: number},
     *   angvel: {x: number, y: number, z: number}
     * }}
     */
    getTransform(bodyId) {
        throw new Error('Not implemented: getTransform()');
    }

    /**
     * Resets or disposes the backend
     */
    dispose() {
        throw new Error('Not implemented: dispose()');
    }
}
