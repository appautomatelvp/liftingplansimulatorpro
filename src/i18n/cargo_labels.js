/**
 * Pure formatters for OOG cargo derived dimension & CoG labels (EN / VI).
 */

/**
 * Format the derived OOG cargo envelope summary and optional flat-rack end-stop clearances.
 */
export function formatCargoDerivedLabel({
  lang = 'vi',
  geom,
  state,
  isFlatRack = false,
  gapF = null,
  gapR = null
} = {}) {
  if (!geom || !state) return '— × — × — m';
  const isEn = lang === 'en';
  const cL = Number(geom.cL || 0).toFixed(2);
  const cW = Number(geom.cW || 0).toFixed(2);
  const cH = Number(geom.cH || 0).toFixed(2);
  const cogX = Number(state.cogX || 0).toFixed(2);
  const cogY = Number(state.cogY || 0).toFixed(2);
  const cogZ = Number(state.cogZ || 0).toFixed(2);

  const base = isEn
    ? `Derived crate ${cL}×${cW}×${cH} m · Envelope CoG (${cogX}, ${cogY}, ${cogZ})`
    : `Kiện quy đổi ${cL}×${cW}×${cH} m · CoG bao (${cogX}, ${cogY}, ${cogZ})`;

  const hasGaps = isFlatRack && gapF != null && gapR != null;
  if (!hasGaps) return base;

  const gF = Number(gapF).toFixed(2);
  const gR = Number(gapR).toFixed(2);
  return base + (isEn ? ` · End gaps ${gF} / ${gR} m` : ` · Khe cánh ${gF} / ${gR} m`);
}

/**
 * Format the compact OOG cargo crate summary shown inside the cargo/gear editor.
 */
export function formatCargoCrateLabel({ lang = 'vi', geom } = {}) {
  if (!geom) return '— × — × — m';
  const cL = Number(geom.cL || 0).toFixed(2);
  const cW = Number(geom.cW || 0).toFixed(2);
  const cH = Number(geom.cH || 0).toFixed(2);
  return lang === 'en'
    ? `Cargo crate ${cL}×${cW}×${cH} m`
    : `Kiện quy đổi ${cL}×${cW}×${cH} m`;
}
