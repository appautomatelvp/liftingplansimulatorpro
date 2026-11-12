/**
 * Domain standards — single entry that re-exports CAE standards.
 * Keeps sim/UI from importing deep core paths.
 */
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
  BLOCKED_CHAIN_GRADES,
  RiggingRuleEngine
} from '../../core/standards/index.js';
