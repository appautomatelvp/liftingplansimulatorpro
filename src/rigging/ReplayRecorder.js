// @purpose: Ghi và phát lại toàn bộ trạng thái mô phỏng (Hook, Ngáng dầm, Kiện, Cáp đứt/chùng, Lashing/OOG rơi, Cẩu) tối đa 60 giây.

const MAX_REPLAY_FRAMES = 1200; // 60s @ 20Hz
const SAMPLE_INTERVAL_S = 0.05;

function cloneVecArray(v) {
  return v && typeof v.toArray === 'function' ? v.toArray() : null;
}

function gearRecForCable(state, c) {
  if (!state?.gear || !c) return null;
  if (c.role === 'leg') return state.gear.legs?.[c.index] || null;
  if (c.role === 'upper') return state.gear.uppers?.[c.index] || null;
  if (c.role === 'hanger') return state.gear.hangers?.[c.index] || null;
  if (c.role === 'extra') return state.gear.extraCables?.[c.index] || null;
  return null;
}

function snapshotOogVisual(phy, activeCargoVisual) {
  if (!phy?.oogState && !activeCargoVisual) return null;
  const oogGroup = activeCargoVisual?.getObjectByName?.('flatRackOogCargo');
  const lashingGroup = activeCargoVisual?.getObjectByName?.('flatRackLashingStraps');
  const brokenGroup = activeCargoVisual?.getObjectByName?.('flatRackBrokenStraps');
  const nodes = oogGroup?.userData?.lashingNodes;
  return {
    status: phy?.oogState?.status || 'secured',
    broken: !!phy?.oogState?.strapsBroken,
    intact: !phy?.oogState?.lashing || !!phy.oogState.lashing.isIntact,
    impacted: !!phy?.oogState?.impactedGround,
    localPos: cloneVecArray(phy?.oogState?.localPos),
    pos: cloneVecArray(phy?.oogState?.worldPos),
    quat: cloneVecArray(phy?.oogState?.worldQuat),
    slipFrac: Number(phy?.oogState?.slipFrac || 0),
    oogPos: cloneVecArray(oogGroup?.position),
    oogQuat: cloneVecArray(oogGroup?.quaternion),
    lashingVis: lashingGroup ? !!lashingGroup.visible : true,
    brokenVis: brokenGroup ? !!brokenGroup.visible : false,
    straps: Array.isArray(nodes) ? nodes.map((n) => !!n.snapped) : null
  };
}

function applyOogReplay({ THREE, phy, activeCargoVisual, oa, ob, t }) {
  if (!oa) return;
  const src = t < 0.5 ? oa : ob;
  if (phy?.oogState) {
    phy.oogState.status = src.status || 'secured';
    phy.oogState.strapsBroken = !!src.broken;
    phy.oogState.impactedGround = !!src.impacted;
    if (phy.oogState.lashing) phy.oogState.lashing.isIntact = !!src.intact;
    if (oa.localPos && ob.localPos && phy.oogState.localPos) {
      phy.oogState.localPos.fromArray(oa.localPos).lerp(new THREE.Vector3().fromArray(ob.localPos), t);
    }
    if (oa.pos && ob.pos && phy.oogState.worldPos) {
      phy.oogState.worldPos.fromArray(oa.pos).lerp(new THREE.Vector3().fromArray(ob.pos), t);
    }
    if (oa.quat && ob.quat && phy.oogState.worldQuat) {
      phy.oogState.worldQuat.fromArray(oa.quat).slerp(new THREE.Quaternion().fromArray(ob.quat), t);
    }
  }
  const oogGroup = activeCargoVisual?.getObjectByName?.('flatRackOogCargo');
  if (oogGroup) {
    if (oa.oogPos && ob.oogPos) oogGroup.position.fromArray(oa.oogPos).lerp(new THREE.Vector3().fromArray(ob.oogPos), t);
    if (oa.oogQuat && ob.oogQuat) oogGroup.quaternion.fromArray(oa.oogQuat).slerp(new THREE.Quaternion().fromArray(ob.oogQuat), t);
    const nodes = oogGroup.userData?.lashingNodes;
    if (Array.isArray(nodes) && Array.isArray(src.straps)) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const snapped = !!src.straps[i];
        node.snapped = snapped;
        if (node.intactNode) node.intactNode.visible = !snapped;
        for (const tail of node.sideTails || []) {
          if (tail.botPivot) {
            tail.botPivot.visible = snapped;
            if (snapped) tail.botPivot.rotation.set(tail.sz * 1.28, 0, (tail.sideSeed - 0.5) * 0.45);
          }
          if (tail.topPivot) {
            tail.topPivot.visible = snapped;
            if (snapped) tail.topPivot.rotation.set(-tail.sz * 0.42, 0, (tail.sideSeed - 0.5) * 0.35);
          }
        }
      }
    }
  }
  const lashingGroup = activeCargoVisual?.getObjectByName?.('flatRackLashingStraps');
  const brokenGroup = activeCargoVisual?.getObjectByName?.('flatRackBrokenStraps');
  if (lashingGroup) lashingGroup.visible = src.lashingVis !== false;
  if (brokenGroup) brokenGroup.visible = !!src.brokenVis;
}

export function captureReplayFrame({ replay, state, phy, activeCargoVisual, nowSec, force = false } = {}) {
  if (!replay || !replay.recording || !phy?.hookPos || !phy?.cargoPos) return null;
  const elapsed = Number.isFinite(nowSec) ? nowSec : (performance.now() / 1000 - (replay.t0 || 0));
  if (elapsed > 60.0 || replay.frames.length >= MAX_REPLAY_FRAMES) {
    replay.recording = false;
    return { full: true, t: Math.min(60.0, elapsed) };
  }
  const last = replay.frames[replay.frames.length - 1];
  if (!force && last && elapsed - last.t < SAMPLE_INTERVAL_S) return null;

  const frame = {
    t: elapsed,
    h: phy.hookPos.toArray(),
    c: phy.cargoPos.toArray(),
    q: phy.cargoQuat.toArray(),
    clr: Number(phy.groundClearance || 0),
    effW: phy.effectiveCargoWeightT != null ? Number(phy.effectiveCargoWeightT) : null,
    poseLock: Boolean(state?.poseLock),
    rigLive: Boolean(phy.rigLive),
    slewDeg: Number(state?.slewDeg || 0),
    craneAngleDeg: Number(state?.craneAngleDeg || 0),
    beams: (phy.beams || []).map((b) => ({
      id: b.id,
      x: b.x ? b.x.toArray() : [0, 0, 0],
      q: b.q ? b.q.toArray() : [0, 0, 0, 1],
      rest: !!b.isRestingOnCargo
    })),
    cables: (phy.cables || []).map((c) => {
      const rec = gearRecForCable(state, c);
      return {
        role: c.role,
        index: c.index,
        L0: Number(c.L0 || 1),
        tensionT: Number(c.tensionT || 0),
        slack: !!c.slack,
        broken: !!(c.broken || rec?.broken),
        frac: Number(c.break?.frac ?? 0.5),
        tipU: c.break?.tipU ? cloneVecArray(c.break.tipU) : null,
        tipL: c.break?.tipL ? cloneVecArray(c.break.tipL) : null,
        uLen: Number(c.break?.upperLen || 0),
        lLen: Number(c.break?.lowerLen || 0)
      };
    }),
    legSlacks: [...(phy.legSlacks || [])],
    legTensions: [...(phy.legTensions || [])],
    upperTensions: [...(phy.upperTensions || [])],
    oog: snapshotOogVisual(phy, activeCargoVisual)
  };

  replay.frames.push(frame);
  return { full: false, t: elapsed, frame };
}

export function startReplayRecording({ replay, state, phy, activeCargoVisual, nowSec } = {}) {
  if (!replay) return;
  const now = Number.isFinite(nowSec) ? nowSec : (performance.now() / 1000);
  replay.recording = true;
  replay.playing = false;
  replay.frames = [];
  replay.t0 = now;
  replay.cursor = 0;
  captureReplayFrame({ replay, state, phy, activeCargoVisual, nowSec: 0, force: true });
}

export function applyReplayFrame({ THREE, replay, state, phy, activeCargoVisual, a, b, u } = {}) {
  if (!THREE || !phy || !a) return;
  const end = b || a;
  const t = THREE.MathUtils.clamp(Number.isFinite(u) ? u : 0, 0, 1);

  phy.hookPos.fromArray(a.h).lerp(new THREE.Vector3().fromArray(end.h), t);
  phy.hookTarget.copy(phy.hookPos);
  phy.cargoPos.fromArray(a.c).lerp(new THREE.Vector3().fromArray(end.c), t);
  phy.cargoQuat.fromArray(a.q).slerp(new THREE.Quaternion().fromArray(end.q), t);
  if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
  if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
  if (phy.hookVel) phy.hookVel.set(0, 0, 0);

  phy.rigLive = true;
  phy.effectiveCargoWeightT = t < 0.5 ? a.effW : end.effW;
  if (state) {
    state.poseLock = false;
    state.slewDeg = THREE.MathUtils.lerp(a.slewDeg || 0, end.slewDeg || 0, t);
    state.craneAngleDeg = THREE.MathUtils.lerp(a.craneAngleDeg || 0, end.craneAngleDeg || 0, t);
  }
  phy.groundClearance = THREE.MathUtils.lerp(a.clr || 0, end.clr || 0, t);

  if (Array.isArray(a.beams) && Array.isArray(phy.beams)) {
    const tmpPos = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    phy.beams.forEach((beam, idx) => {
      const ba = a.beams[idx];
      const bb = (end.beams && end.beams[idx]) || ba;
      if (!ba || !beam) return;
      beam.x.fromArray(ba.x).lerp(tmpPos.fromArray(bb.x), t);
      beam.q.fromArray(ba.q).slerp(tmpQ.fromArray(bb.q), t);
      beam.isRestingOnCargo = t < 0.5 ? !!ba.rest : !!bb.rest;
      if (beam.v) beam.v.set(0, 0, 0);
      if (beam.w) beam.w.set(0, 0, 0);
      if (beam.group) {
        beam.group.position.copy(beam.x);
        beam.group.quaternion.copy(beam.q);
      }
    });
  }

  if (Array.isArray(a.legTensions) && Array.isArray(phy.legTensions)) {
    for (let i = 0; i < phy.legTensions.length; i++) {
      phy.legTensions[i] = THREE.MathUtils.lerp(a.legTensions[i] || 0, end.legTensions?.[i] || 0, t);
      if (Array.isArray(phy.legSlacks) && i < (a.legSlacks?.length || 0)) {
        phy.legSlacks[i] = t < 0.5 ? !!a.legSlacks[i] : !!(end.legSlacks?.[i] ?? a.legSlacks[i]);
      }
    }
  }
  if (Array.isArray(a.upperTensions) && Array.isArray(phy.upperTensions)) {
    for (let i = 0; i < phy.upperTensions.length; i++) {
      phy.upperTensions[i] = THREE.MathUtils.lerp(a.upperTensions[i] || 0, end.upperTensions?.[i] || 0, t);
    }
  }

  if (Array.isArray(a.cables) && Array.isArray(phy.cables)) {
    const tmpTip = new THREE.Vector3();
    phy.cables.forEach((c, idx) => {
      const ca = a.cables[idx];
      const cb = (end.cables && end.cables[idx]) || ca;
      if (!ca || !c) return;
      c.L0 = THREE.MathUtils.lerp(ca.L0 || 1, cb.L0 || 1, t);
      c.tensionT = THREE.MathUtils.lerp(ca.tensionT || 0, cb.tensionT || 0, t);
      c.slack = t < 0.5 ? !!ca.slack : !!cb.slack;
      const brokenNow = t < 0.5 ? !!ca.broken : !!cb.broken;
      c.broken = brokenNow;
      c._failureProcessed = brokenNow;
      const rec = gearRecForCable(state, c);
      if (rec) rec.broken = brokenNow;
      if (!brokenNow) {
        c.break = null;
      } else if (ca.tipU || cb.tipU) {
        const srcA = ca.broken ? ca : cb;
        const srcB = cb.broken ? cb : ca;
        c.break = c.break || { frac: srcA.frac ?? 0.5, upperLen: srcA.uLen || 1, lowerLen: srcA.lLen || 1, tipU: new THREE.Vector3(), tipL: new THREE.Vector3(), velU: new THREE.Vector3(), velL: new THREE.Vector3() };
        c.break.upperLen = srcA.uLen || c.break.upperLen;
        c.break.lowerLen = srcA.lLen || c.break.lowerLen;
        if (srcA.tipU && srcB.tipU) c.break.tipU.fromArray(srcA.tipU).lerp(tmpTip.fromArray(srcB.tipU), t);
        if (srcA.tipL && srcB.tipL) c.break.tipL.fromArray(srcA.tipL).lerp(tmpTip.fromArray(srcB.tipL), t);
      }
    });
  }

  applyOogReplay({ THREE, phy, activeCargoVisual, oa: a.oog, ob: end.oog || a.oog, t });
}

export function stepReplayPlayback({ THREE, replay, state, phy, activeCargoVisual, dt } = {}) {
  const frames = replay?.frames || [];
  if (!frames.length) {
    if (replay) replay.playing = false;
    return { done: true, t: 0 };
  }
  replay.cursor += Math.max(0, Number(dt) || 0);
  const endT = frames[frames.length - 1].t;
  if (replay.cursor >= endT) {
    const lastFrame = frames[frames.length - 1];
    applyReplayFrame({ THREE, replay, state, phy, activeCargoVisual, a: lastFrame, b: lastFrame, u: 1 });
    replay.playing = false;
    return { done: true, t: endT };
  }
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1].t < replay.cursor) i++;
  const a = frames[i];
  const b = frames[Math.min(i + 1, frames.length - 1)];
  const u = (b.t - a.t) > 1e-4 ? (replay.cursor - a.t) / (b.t - a.t) : 0;
  applyReplayFrame({ THREE, replay, state, phy, activeCargoVisual, a, b, u });
  return { done: false, t: replay.cursor };
}
