// src/rigging/riggingUIStore.js
import { ZONE } from './riggingConstants.js';

const _state = {
  // Per-leg display data
  legs: [], // [{ id, index, angleDeg, angleZone, canLift, isTaut, T_actual, SWL_effective, MBL, pctSWL, zone }]

  // Overall status
  overallZone: ZONE.SAFE,
  canLift: true,
  topology: 'Direct_Hook',
  minAngleDeg: 90.0,

  // HUD and Siren state
  hudBorderClass: 'border-green-500',
  sirenActive: false,

  // DNV notice
  dnvNotice: null,

  // DAF / Kdyn
  Kdyn: 1.0,

  // Cascade events
  cascadeEvents: [],

  // Normalized stress uniforms (0.0 to 1.0 for WebGL shader)
  stressUniforms: {}
};

const _subscribers = new Set();

export function subscribe(fn) {
  if (typeof fn === 'function') {
    _subscribers.add(fn);
    return () => _subscribers.delete(fn);
  }
  return () => {};
}

function _emit() {
  _subscribers.forEach(fn => {
    try {
      fn(_state);
    } catch (e) {
      console.warn('[riggingUIStore] Subscriber error:', e);
    }
  });
}

export function sync(phy, state) {
  if (!phy || !phy.rigging) return;
  const r = phy.rigging;

  _state.legs = r.legs || [];
  _state.overallZone = r.overallZone || ZONE.SAFE;
  _state.canLift = r.canLift !== false;
  _state.topology = r.topology || 'Direct_Hook';
  _state.minAngleDeg = r.minAngleDeg || 90.0;
  _state.dnvNotice = r.dnvNotice || null;
  _state.Kdyn = r.Kdyn || 1.0;
  _state.cascadeEvents = r.cascadeEvents || [];

  _state.angleWarning = !!r.angleWarning;
  _state.angleCritical = !!r.angleCritical;
  _state.hitchFactor = r.hitchFactor || 1;
  _state.zoneLabel = r.zoneLabel || 'SAFE';

  // 3-zone UI: green = safe; red pulse = overload (Zone 2, no snap); red ping = snap
  if (_state.overallZone === ZONE.SNAP || _state.angleCritical) {
    _state.hudBorderClass = 'border-red-600 animate-ping';
    _state.sirenActive = true;
  } else if (_state.overallZone === ZONE.OVERLOAD || _state.angleWarning) {
    _state.hudBorderClass = 'border-red-500 animate-pulse';
    _state.sirenActive = true;
  } else {
    _state.hudBorderClass = 'border-green-500';
    _state.sirenActive = false;
  }

  // Calculate stress uniforms for 3D visual rendering
  _state.stressUniforms = {};
  for (const leg of _state.legs) {
    const swl = leg.SWL_effective || 1.0;
    const mbl = leg.MBL || (swl * 5.0);
    const T = leg.T_actual || 0.0;
    if (T > swl) {
      // Linear ramp from 0.0 (at SWL) to 1.0 (at MBL)
      _state.stressUniforms[leg.id] = Math.min(1.0, Math.max(0.0, (T - swl) / (mbl - swl)));
    } else {
      _state.stressUniforms[leg.id] = 0.0;
    }
  }

  _emit();
}

export function getState() {
  return Object.freeze({ ..._state });
}
