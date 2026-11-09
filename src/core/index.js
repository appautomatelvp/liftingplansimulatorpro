/**
 * ============================================================================
 * LIFTING PLAN SIMULATOR PRO - CAE INDUSTRIAL PHYSICS ARCHITECTURE
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
export { ElasticSlingEngine, SLING_MATERIALS } from './ElasticSlingEngine.js';
export { RIGGING_DICTIONARY, getDictionaryEntry } from './RiggingDictionary.js';
export { RIGGING_EQUIPMENT_CATALOG, getRiggingEquipmentGroup } from './RiggingEquipmentCatalog.js';

// Physics Engine Modern Architecture
export { PhysicsWorldManager } from './physics-world/PhysicsWorldManager.js';
export { FixedStepLoop } from './physics-world/FixedStepLoop.js';
export { ConstraintGraph } from './physics-world/ConstraintGraph.js';
export { IPhysicsBackend } from './physics-world/IPhysicsBackend.js';
export { CannonBackend } from './physics-world/CannonBackend.js';
export { RapierBackend } from './physics-world/RapierBackend.js';
export { G_ACCEL, TONNE, E_MODULUS, MATERIAL_DAMPING, SAFETY_FACTOR } from './physics-world/Units.js';
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
