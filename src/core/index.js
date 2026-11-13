/**
 * ============================================================================
 * SAFELIFT3D - CAE INDUSTRIAL PHYSICS ARCHITECTURE
 * Core Four-Module System Architecture Entry Point
 * ============================================================================
 */

export { AssetManager } from './AssetManager.js';
export { RiggingPlanner } from './RiggingPlanner.js';
export { SimulationEngine } from './SimulationEngine.js';
export { AnalysisHUD } from './AnalysisHUD.js';
export { EngineeringEngine } from './EngineeringEngine.js';
export { RopeConstraint } from './RopeConstraint.js';
export { LiftPlanModel } from './LiftPlanModel.js';
export { ASSET_SPECS, getAssetSpec } from './AssetSpecs.js';
export { AssetPipeline } from './AssetPipeline.js';
export { AssetLoaders } from './AssetLoaders.js';
export { HullOptimizer } from './HullOptimizer.js';
export { AssemblyEngine, COMPOSITE_PRESETS } from './AssemblyEngine.js';
export { CraneLoadChartEngine, CRANE_MODELS } from './CraneLoadChartEngine.js';
export { GroundPressureEngine, SOIL_BEARING_LIBRARY, COMMERCIAL_MAT_PRESETS } from './GroundPressureEngine.js';
export { ElasticSlingEngine, SLING_MATERIALS, EN1492_COLOR_TABLE, getEN1492ColorSpec, getSlingPhysicalSpec } from './ElasticSlingEngine.js';
export { PhysicalCableSolver } from './PhysicalCableSolver.js';
export { DeformableSteelStructure } from './DeformableSteelStructure.js';
export { RIGGING_DICTIONARY, getDictionaryEntry } from './RiggingDictionary.js';
export { RIGGING_EQUIPMENT_CATALOG, getRiggingEquipmentGroup } from './RiggingEquipmentCatalog.js';

// Physics Engine Modern Architecture — QUARANTINED (ADR-003). Live solver = src/sim/physics.
export {
    PhysicsWorldManager,
    FixedStepLoop,
    ConstraintGraph,
    IPhysicsBackend,
    CannonBackend,
    loadRapierBackend,
    G_ACCEL,
    TONNE,
    E_MODULUS,
    MATERIAL_DAMPING,
    SAFETY_FACTOR
} from './physics-world/index.js';
export const __experimental = Object.freeze({
    physicsWorld: true,
    note: 'PhysicsWorldManager / Rapier / Cannon are not the live UI step loop. See docs/architecture/adr/ADR-003-physics-quarantine.md'
});


export { UnilateralCableConstraint } from '../rigging/constraints/UnilateralCableConstraint.js';
export {
    ShackleConstraint,
    EyeboltConstraint,
    PlateClampConstraint,
    ContainerTwistlockConstraint,
    BeamMechanicsModel
} from '../rigging/constraints/HardwareConstraint.js';
export { CornerProtectorModel } from '../rigging/constraints/CornerProtectorModel.js';
export { DestructionSolver } from '../simulation/destruction-manager/DestructionSolver.js';
export { SensorEngine } from '../telemetry/sensor-engine/SensorEngine.js';

// International Standards & Engineering Rule Engine
export * as Standards from './standards/index.js';
export {
    resolveSling,
    migrateSlingRecord,
    normalizeGrade,
    normalizeSlingType,
    getSlingDiameterCatalog,
    computeWireRopeSpec,
    computeChainSpec,
    computeSyntheticSlingSpec,
    computeShackleSideDerate,
    computeShackleMassKg,
    validateShackleGeometry,
    checkLiftingBeam,
    checkSpreaderBar,
    evaluateAngleStatus,
    lafOf,
    STEEL_GRADES,
    DESIGN_CATEGORIES,
    CHAIN_GRADES,
    BLOCKED_CHAIN_GRADES
} from './standards/index.js';
