/**
 * ============================================================================
 * FIXED TIMESTEP & SUB-STEPPING LOOP (FixedStepLoop.js)
 * Separates Render Frame (60 FPS with Alpha Interpolation) from
 * High-Frequency Physics Solver (120Hz - 240Hz with Sub-stepping)
 * ============================================================================
 */

export class FixedStepLoop {
    /**
     * @param {Object} options
     * @param {number} [options.fixedDt=1/120] - Outer physics timestep (e.g. 1/120 s)
     * @param {number} [options.substeps=6] - Number of sub-steps per physics step (h = fixedDt / substeps)
     * @param {number} [options.maxAccumulator=0.1] - Clamping to avoid spiral of death
     * @param {Function} options.onSubstep - Callback (substepDt, substepIndex) => void
     * @param {Function} [options.onStepComplete] - Callback (fixedDt) => void
     */
    constructor(options = {}) {
        this.fixedDt = options.fixedDt || (1 / 120);
        this.substeps = Math.max(1, options.substeps || 6);
        this.maxAccumulator = options.maxAccumulator || 0.1;
        this.onSubstep = options.onSubstep || (() => {});
        this.onStepComplete = options.onStepComplete || (() => {});

        this.accumulator = 0;
        this.stepCount = 0;
        this.substepDt = this.fixedDt / this.substeps;
    }

    setFrequency(hz, substeps = 6) {
        this.fixedDt = 1 / hz;
        this.substeps = Math.max(1, substeps);
        this.substepDt = this.fixedDt / this.substeps;
    }

    /**
     * Advances physics by real wall-clock delta time
     * @param {number} frameDt - Real time elapsed since last render frame (in seconds)
     * @returns {number} alpha - Interpolation factor in range [0, 1) for render interpolation
     */
    advance(frameDt) {
        // Clamp frame time to prevent spiral of death
        const clampedDt = Math.min(frameDt, this.maxAccumulator);
        this.accumulator += clampedDt;

        let stepsRun = 0;
        const maxSteps = 10; // safety ceiling

        while (this.accumulator >= this.fixedDt && stepsRun < maxSteps) {
            for (let s = 0; s < this.substeps; s++) {
                this.onSubstep(this.substepDt, s);
            }
            this.onStepComplete(this.fixedDt);
            this.accumulator -= this.fixedDt;
            this.stepCount++;
            stepsRun++;
        }

        // If lagging too badly, reset accumulator
        if (this.accumulator > this.fixedDt) {
            this.accumulator = 0;
        }

        // Alpha for rendering interpolation: [0, 1)
        const alpha = Math.max(0, Math.min(1, this.accumulator / this.fixedDt));
        return alpha;
    }

    reset() {
        this.accumulator = 0;
        this.stepCount = 0;
    }
}
