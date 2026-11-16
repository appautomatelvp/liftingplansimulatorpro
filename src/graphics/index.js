/**
 * ============================================================================
 * GRAPHICS & RENDERING MODULE INDEX (src/graphics/index.js)
 * Architecture: Photorealistic AAA CAE Digital Twin Rendering Pipeline
 * ============================================================================
 */

export { SceneRenderer, QUALITY_TIERS } from './SceneRenderer.js';
export { EnvironmentManager, LIGHTING_PRESETS } from './EnvironmentManager.js';
export { PBRMaterialFactory } from './PBRMaterialFactory.js';
export { computeMechanicalStressVisual, resolveStressTintedMaterial } from './pbr/StressPBRMaterials.js';
export { applyGroundHorizonFade } from './GroundHorizonFade.js';
export { buildSteelPipeCargoMesh, buildProceduralCoachBusMesh } from './SpecialtyCargoMeshes.js';
export { sealSolidCargoShell } from './SolidShellSealer.js';
