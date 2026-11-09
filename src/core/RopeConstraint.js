/**
 * ============================================================================
 * ROPE CONSTRAINT (RopeConstraint.js)
 * Architecture: CAE / Industrial Multibody Dynamics (Vortex Grade)
 * Engine: Cannon-es Unilateral Inextensible Distance Constraint
 * Solves: Accurate pivot-to-pivot distance constraints with critical damping
 * ============================================================================
 */

import * as CANNON from 'cannon-es';

export class RopeConstraint extends CANNON.Constraint {
    /**
     * Creates an inextensible, tension-only cable constraint between two local anchor points.
     *
     * @param {CANNON.Body} bodyA Upper body (e.g. Crane Hook or Spreader Beam)
     * @param {CANNON.Vec3} pivotA Local anchor point on bodyA
     * @param {CANNON.Body} bodyB Lower body (e.g. Spreader Beam or Cargo)
     * @param {CANNON.Vec3} pivotB Local anchor point on bodyB
     * @param {number} [restLength] Natural cable length L0 (if omitted, computed from initial world positions)
     * @param {number} [breakingForceN] Maximum tensile strength before failure (e.g. 5 x WLL x g)
     */
    constructor(bodyA, pivotA, bodyB, pivotB, restLength, breakingForceN = 2e6) {
        super(bodyA, bodyB);

        this.pivotA = pivotA.clone();
        this.pivotB = pivotB.clone();

        const pAWorld = new CANNON.Vec3();
        const pBWorld = new CANNON.Vec3();
        bodyA.pointToWorldFrame(this.pivotA, pAWorld);
        bodyB.pointToWorldFrame(this.pivotB, pBWorld);

        this.distance = restLength != null ? restLength : pAWorld.distanceTo(pBWorld);
        this.breakingForceN = breakingForceN;
        this.isBroken = false;

        // ContactEquation in Cannon-es enforces: (x_B + r_j - (x_A + r_i)) . n >= 0
        // For a cable in tension, when distance exceeds L0, it must pull bodies together.
        // In Cannon-es solver, a negative impulse (-lambda) pulls bodies together.
        // Therefore, minForce = -breakingForceN and maxForce = 0.
        const eq = this.distanceEquation = new CANNON.ContactEquation(bodyA, bodyB);
        this.equations.push(eq);

        eq.minForce = -breakingForceN;
        eq.maxForce = 0; // Pure tension: Cable cannot resist compression (goes slack)

        // High stiffness k = 1e8 N/m, critical damping relaxation = 0.05, dt = 1/60
        eq.setSpookParams(1e8, 0.05, 1 / 60);

        // Pre-allocated vectors for performance
        this._pA = new CANNON.Vec3();
        this._pB = new CANNON.Vec3();
        this._delta = new CANNON.Vec3();
        this._scaledNormal = new CANNON.Vec3();
    }

    /**
     * Updates cable normal and relative moment arms (ri, rj) each physics sub-step.
     */
    update() {
        if (this.isBroken) {
            this.distanceEquation.enabled = false;
            return;
        }

        const bodyA = this.bodyA;
        const bodyB = this.bodyB;
        const eq = this.distanceEquation;

        // Transform local pivot points to world space
        bodyA.pointToWorldFrame(this.pivotA, this._pA);
        bodyB.pointToWorldFrame(this.pivotB, this._pB);

        // Vector from pivotA to pivotB
        this._pB.vsub(this._pA, this._delta);
        const currentDist = this._delta.length();
        const normal = eq.ni;

        if (currentDist > 1e-5) {
            this._delta.scale(1 / currentDist, normal);
        } else {
            normal.set(0, 1, 0);
        }

        // Half rest-length vector along cable
        const halfL0 = this.distance * 0.5;

        // ri = (pivotA - bodyA.position) + halfL0 * normal
        this._pA.vsub(bodyA.position, eq.ri);
        normal.scale(halfL0, this._scaledNormal);
        eq.ri.vadd(this._scaledNormal, eq.ri);

        // rj = (pivotB - bodyB.position) - halfL0 * normal
        this._pB.vsub(bodyB.position, eq.rj);
        eq.rj.vsub(this._scaledNormal, eq.rj);
    }

    /**
     * Extracts physical tension in Newtons directly from the constraint multiplier.
     * In Cannon-es, equation.multiplier is already lambda * invDt (Force in Newtons).
     * @returns {number} Tension force in Newtons
     */
    getTensionN() {
        if (this.isBroken || !this.distanceEquation.enabled) return 0;
        // In Cannon-es, multiplier is already lambda * invDt (force in Newtons)
        const forceN = Math.abs(this.distanceEquation.multiplier || 0);
        if (forceN > this.breakingForceN * 1.05) {
            this.isBroken = true;
            this.distanceEquation.enabled = false;
            return 0;
        }
        return forceN;
    }
}
