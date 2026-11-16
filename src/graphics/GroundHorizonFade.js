// @purpose: Hòa mượt mép ngoài đĩa mặt đất vào màu sương mù chân trời không lộ đường cắt
/**
 * Patches a Three.js surface material so radial distance beyond `fadeStartM`
 * converges smoothly to 100% scene fog at `fadeEndM`, removing any visible disc seam.
 */
export function applyGroundHorizonFade(material, fadeStartM = 200, fadeEndM = 540) {
  if (!material || typeof material !== 'object') return material;
  const startVal = Number.isFinite(fadeStartM) ? Math.max(20, fadeStartM) : 200;
  const endVal = Number.isFinite(fadeEndM) ? Math.max(startVal + 20, fadeEndM) : 540;
  const cacheKey = `ground_horizon_fade_${startVal.toFixed(0)}_${endVal.toFixed(0)}`;
  if (material.userData && material.userData.__groundHorizonFadeKey === cacheKey) {
    return material;
  }

  material.userData = material.userData || {};
  material.userData.__groundHorizonFadeKey = cacheKey;
  const prevOnBeforeCompile = typeof material.onBeforeCompile === 'function'
    ? material.onBeforeCompile
    : null;
  const prevCacheKeyFn = typeof material.customProgramCacheKey === 'function'
    ? material.customProgramCacheKey
    : null;

  material.customProgramCacheKey = function customProgramCacheKey() {
    const base = prevCacheKeyFn ? prevCacheKeyFn.call(this) : '';
    return `${base}|${cacheKey}`;
  };

  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    if (prevOnBeforeCompile) prevOnBeforeCompile.call(this, shader, renderer);
    if (!shader || typeof shader.vertexShader !== 'string') return;
    if (shader.vertexShader.includes('#include <fog_vertex>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
#ifdef USE_FOG
  float _groundRadialM = length((modelMatrix * vec4(transformed, 1.0)).xz);
  float _horizonPull = smoothstep(${startVal.toFixed(1)}, ${endVal.toFixed(1)}, _groundRadialM);
  vFogDepth = max(vFogDepth, _horizonPull * 100000.0);
#endif`
      );
    }
  };
  material.needsUpdate = true;
  return material;
}
