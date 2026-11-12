/**
 * Experimental physics-world barrel (quarantined).
 * Prefer live XPBD under src/sim/physics for the product simulator.
 * Rapier is lazy-only so default boot does not pull the WASM chunk.
 */
export { PhysicsWorldManager } from './PhysicsWorldManager.js';
export { FixedStepLoop } from './FixedStepLoop.js';
export { ConstraintGraph } from './ConstraintGraph.js';
export { IPhysicsBackend } from './IPhysicsBackend.js';
export { CannonBackend } from './CannonBackend.js';
export * from './Units.js';

/** Lazy load Rapier backend (ADR-003 / Phase 6 asset cleanup). */
export async function loadRapierBackend() {
  const mod = await import('./RapierBackend.js');
  return mod.RapierBackend;
}
