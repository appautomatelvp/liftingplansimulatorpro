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
export {
  clampToneSettings,
  buildCanvasFilterCss,
  applyToneSettingsToCanvas,
  bindGraphicsToneControls,
  loadSavedToneSettings,
  saveToneSettings
} from './GraphicsToneHelper.js';
export {
  CRANE_MAT_PRESETS,
  readJobsiteVisualConfig,
  rebuildDunnageVisual3D,
  syncCraneOutriggerMats3D,
  evaluateDunnageSupportSurface,
  sampleDunnageContactPointsForCargo
} from './JobsiteSiteVisuals.js';
export {
  computeElevationMarkers,
  createElevationRulerTool
} from './ElevationRulerTool.js';
export { pickBestElevationHoverPoint, buildRulerHoverInputs } from './ElevationRulerMath.js';
export { classifySlingAngleZone, computeSlingAngleArcData, createSlingAngleGizmo } from './SlingAngleGizmo.js';
export { computeVectorLength, classifyForceColorHex, getSlingAngleTooltip, createForceVectorField } from './ForceVectorField.js';
export { createCoGAxisHandles, buildCogDragPlane, applyCogDragDelta, syncCogDragShiftMode } from './CoGGizmoHelper.js';
export { createCogFaceProjectionGroup, updateCogFaceProjections } from './CoGFaceProjection.js';
export {
  resolveBrandStencilText,
  getOrCreateBrandDecalTexture,
  getOrCreateBrandDecalMaterial,
  stampCraneBrandDecals,
  stampHookBrandDecals,
  stampSpreaderBrandDecals,
  stampCargoBrandPlate
} from './BrandDecalHelper.js';
