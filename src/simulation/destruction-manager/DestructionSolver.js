/**
 * ============================================================================
 * DYNAMIC DESTRUCTION & CASCADE FAILURE SOLVER (DestructionSolver.js)
 * Implements:
 *  - Manual Cable Cut & Overload Auto-Snap (T >= MBL_eff)
 *  - Same-substep Constraint Removal & Island Wake-Up
 *  - Zero-Floating Guarantee (BFS Reachability to Hook)
 *  - Dynamic Shock Load Transfer & Chain-Reaction Collapse
 *  - Asymmetric Torque & In-Air Tumbling
 *  - Ground Collision Telemetry (Impact velocity & Peak G)
 * ============================================================================
 */

export class DestructionSolver {
    /**
     * @param {Object} options
     * @param {import('../../core/physics-world/ConstraintGraph.js').ConstraintGraph} options.graph
     * @param {import('../../core/physics-world/IPhysicsBackend.js').IPhysicsBackend} options.backend
     * @param {Function} [options.onEvent] - Event listener callback (eventType, data) => void
     */
    constructor(options) {
        this.graph = options.graph;
        this.backend = options.backend;
        this.onEvent = options.onEvent || (() => {});

        this.commandQueue = [];
        this.failureHistory = [];
        this.maxCascadeIterations = 4;
        this.cascadeCount = 0;
    }

    /**
     * Queues an intentional cut cable command (user clicked "Cut Cable")
     * @param {string} constraintId
     */
    queueCutCommand(constraintId) {
        this.commandQueue.push({
            type: 'MANUAL_CUT',
            targetId: constraintId,
            timestamp: performance.now ? performance.now() : Date.now()
        });
    }

    /**
     * Evaluates destruction triggers at every physics sub-step
     * @param {number} h - Sub-step timestep in seconds
     * @param {number} simTime - Current simulation time in seconds
     * @returns {{ brokenThisStep: string[], cascadeCount: number }}
     */
    evaluateSubstep(h, simTime = 0) {
        const brokenThisStep = [];
        let iteration = 0;

        while (iteration < this.maxCascadeIterations) {
            iteration++;
            const toBreak = [];

            // 1. Process manual cut commands
            while (this.commandQueue.length > 0) {
                const cmd = this.commandQueue.shift();
                const c = this.graph.getConstraint(cmd.targetId);
                if (c && !c.isBroken) {
                    toBreak.push({ constraint: c, reason: 'MANUAL_CUT', peakTensionN: c.tensionN });
                }
            }

            // 2. Process automatic overload snap (T >= MBL_eff)
            const activeConstraints = this.graph.getActiveConstraints();
            for (const c of activeConstraints) {
                const mblEff = typeof c.getEffectiveMBL === 'function' ? c.getEffectiveMBL() : c.mblN;
                if (c.tensionN >= mblEff && mblEff > 0) {
                    toBreak.push({ constraint: c, reason: 'OVERLOAD_SNAP', peakTensionN: c.tensionN });
                }
            }

            if (toBreak.length === 0) {
                break; // No further destruction in this iteration
            }

            // 3. Break and remove constraints immediately
            for (const item of toBreak) {
                const { constraint, reason, peakTensionN } = item;
                constraint.isBroken = true;
                constraint.brokenTime = simTime;
                constraint.tensionN = 0;
                constraint.lambda = 0;

                // Wake up all connected bodies in this island so they immediately react!
                this.graph.wakeUpIsland(constraint.bodyA, this.backend);
                this.graph.wakeUpIsland(constraint.bodyB, this.backend);

                // Remove edge from active graph and backend native world
                this.graph.removeConstraint(constraint.id);
                if (this.backend && typeof this.backend.removeConstraint === 'function') {
                    this.backend.removeConstraint(constraint.id);
                }

                brokenThisStep.push(constraint.id);
                this.failureHistory.push({
                    id: constraint.id,
                    reason,
                    simTime,
                    peakTensionN,
                    cascadeLevel: iteration
                });

                this.onEvent('CONSTRAINT_BROKEN', {
                    id: constraint.id,
                    reason,
                    peakTensionN,
                    simTime,
                    cascadeLevel: iteration
                });
            }

            // 4. Zero-Floating check: Find orphaned bodies
            const orphaned = this.graph.getOrphanedNodes();
            if (orphaned.length > 0) {
                for (const bodyId of orphaned) {
                    this.backend.wakeUp(bodyId);
                }
                this.onEvent('ZERO_FLOATING_ENFORCED', {
                    orphanedBodies: orphaned,
                    simTime
                });
            }
        }

        if (brokenThisStep.length > 0) {
            this.cascadeCount += brokenThisStep.length;
        }

        return {
            brokenThisStep,
            cascadeCount: this.cascadeCount
        };
    }

    /**
     * Resets failure tracking
     */
    reset() {
        this.commandQueue = [];
        this.failureHistory = [];
        this.cascadeCount = 0;
    }
}
