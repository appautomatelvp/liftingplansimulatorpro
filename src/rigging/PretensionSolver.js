// @purpose: Giải cao độ móc cẩu và dầm ngáng tại trạng thái Nhớm Cáp (kiện chạm đất, toàn bộ cáp căng đúng chiều dài thực)
import * as THREE from 'three';

function maxPullNeedDy(pA, pB, L0) {
  const dx = pB.x - pA.x;
  const dz = pB.z - pA.z;
  const h2 = dx * dx + dz * dz;
  const len = Math.max(0.04, L0 || 0.04);
  return Math.sqrt(Math.max(0.0004, len * len - h2));
}

/**
 * Đặt móc cẩu và các thân dầm ngáng về đúng vị trí hình học kéo căng toàn bộ hệ cáp
 * theo chiều dài làm việc thực (`c.L0`), trong khi kiện hàng vẫn nằm chắc trên mặt đất.
 */
export function solveGroundedTautPose(ctx) {
  const {
    phy, state, hookMasterOffsetY = -0.56,
    attachWorld, cableIsBroken, supportY, cargoCeilingUnderBeam, getRigSpec,
    syncCableRest, syncHookToRigTaut, seedBeamsFromKinematic,
    clampBeamAboveCargoRoof, seatStsSpreaderToCargo, alignBasketBars,
    applyLockedPose, resetHoistDynamicState,
    isStsDirect = false, isLbDirectBot = false, isLbDirectTop = false
  } = ctx;

  if (!phy || !state || typeof attachWorld !== 'function') return { tookUp: false };

  const prevHookY = phy.hookPos ? phy.hookPos.y : 0;
  const prevBeamYs = (phy.beams || []).map((b) => (b && b.x ? b.x.y : 0));
  const prevHadSlack = (phy.cables || []).some((c) => {
    if (cableIsBroken && cableIsBroken(c)) return false;
    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
    return !!(c.slack || span < (c.L0 || 0) - 0.02);
  });

  // 1. Khóa kiện hàng nằm chắc trên đất, triệt tiêu vận tốc
  phy.autoHoistActive = false;
  phy.hoistSpeed = 0;
  phy._trialLiftActive = false;
  phy._setDownActive = false;
  if (phy.hookVel) phy.hookVel.set(0, 0, 0);
  if (phy.cargoVel) phy.cargoVel.set(0, 0, 0);
  if (phy.cargoOmega) phy.cargoOmega.set(0, 0, 0);
  (phy.beams || []).forEach((b) => {
    if (b.v) b.v.set(0, 0, 0);
    if (b.w) b.w.set(0, 0, 0);
  });

  state.poseLock = true;
  if (typeof applyLockedPose === 'function') applyLockedPose();
  else if (typeof supportY === 'function' && phy.cargoPos) {
    phy.cargoPos.y = supportY(phy.cargoPos.x, phy.cargoPos.z) + (state.H || 2.5) * 0.5;
  }
  phy.groundClearance = 0;

  // 2. Bỏ khóa rút ngắn tạm của Nhớm cũ, khôi phục chiều dài cáp thực tế của phương án
  state.holdCableLength = false;
  state.heldCableL0 = null;
  phy._nhomFreezeSpreader = false;
  if (typeof syncCableRest === 'function') syncCableRest(false);

  // Tâm phương án móc cẩu trên mặt bằng (tính cả pullRadius nếu kỹ sư đặt)
  const lugs = Array.isArray(state.lugs) && state.lugs.length ? state.lugs : [new THREE.Vector3()];
  const centroid = new THREE.Vector3();
  lugs.forEach((p) => {
    centroid.add(p.clone().applyQuaternion(phy.cargoQuat || new THREE.Quaternion()).add(phy.cargoPos || new THREE.Vector3()));
  });
  centroid.multiplyScalar(1 / lugs.length);
  const azRad = THREE.MathUtils.degToRad(state.pullAzimuthDeg || 0);
  const pullR = state.pullRadius || 0;
  const targetHookX = isStsDirect && phy.cargoPos ? phy.cargoPos.x : centroid.x + pullR * Math.cos(azRad);
  const targetHookZ = isStsDirect && phy.cargoPos ? phy.cargoPos.z : centroid.z + pullR * Math.sin(azRad);
  if (phy.hookPos) {
    phy.hookPos.x = targetHookX;
    phy.hookPos.z = targetHookZ;
  }

  // 3. Đặt móc & dầm theo từng kiểu kết cấu ngáng
  if (isStsDirect) {
    if (typeof seatStsSpreaderToCargo === 'function') seatStsSpreaderToCargo();
    const b0 = (phy.beams || [])[0];
    if (b0) {
      b0.isRestingOnCargo = true;
      const ups = (phy.cables || []).filter((c) => c.role === 'upper' && !(cableIsBroken && cableIsBroken(c)));
      if (ups.length && phy.hookPos) {
        let minDy = Infinity;
        ups.forEach((c) => {
          const pA = attachWorld(c.a);
          const pB = attachWorld(c.b);
          minDy = Math.min(minDy, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
        });
        if (Number.isFinite(minDy)) phy.hookPos.y += minDy;
      } else if (phy.hookPos) {
        phy.hookPos.y = b0.x.y + 0.22;
      }
    }
  } else if (isLbDirectBot) {
    const b0 = (phy.beams || [])[0];
    const gY = typeof supportY === 'function' ? supportY(centroid.x, centroid.z) : 0;
    const roofY = gY + (state.H || 2.591);
    if (b0) {
      b0.x.set(phy.cargoPos.x, roofY + 0.34, phy.cargoPos.z);
      if (phy.cargoQuat) b0.q.copy(phy.cargoQuat);
      b0.isRestingOnCargo = true;
      if (isLbDirectTop && phy.hookPos) {
        const up0 = (phy.cables || []).find((c) => c.role === 'upper' && !(cableIsBroken && cableIsBroken(c)));
        phy.hookPos.set(b0.x.x, b0.x.y + 0.30 + (up0 ? up0.L0 : 0.04) - hookMasterOffsetY, b0.x.z);
      } else if (phy.hookPos) {
        if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
        const ups = (phy.cables || []).filter((c) => c.role === 'upper' && !(cableIsBroken && cableIsBroken(c)));
        if (ups.length) {
          let minDy = Infinity;
          ups.forEach((c) => {
            const pA = attachWorld(c.a);
            const pB = attachWorld(c.b);
            minDy = Math.min(minDy, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
          });
          if (Number.isFinite(minDy)) phy.hookPos.y += minDy;
        }
      }
    }
  } else {
    if (typeof syncHookToRigTaut === 'function') syncHookToRigTaut();
    if (phy.hookPos) {
      phy.hookPos.x = targetHookX;
      phy.hookPos.z = targetHookZ;
    }
    if (typeof seedBeamsFromKinematic === 'function') seedBeamsFromKinematic();
    if (state.beamType === 'basket' && typeof alignBasketBars === 'function') {
      (phy.cables || []).forEach((c) => {
        if (c.role === 'leg' && !(cableIsBroken && cableIsBroken(c))) {
          c.slack = false;
          c.tensionT = 0.14;
        }
      });
      alignBasketBars();
    }

    // Hội tụ hình học 4 vòng (< 0.5 ms) để toàn bộ leg -> hanger -> upper khớp đúng L0 (±1 mm)
    const spec = typeof getRigSpec === 'function' ? getRigSpec() : null;
    for (let pass = 0; pass < 4; pass++) {
      if (state.beamType === 'basket' && typeof alignBasketBars === 'function') {
        alignBasketBars();
        const ups = (phy.cables || []).filter((c) => c.role === 'upper' && !(cableIsBroken && cableIsBroken(c)));
        const legs = (phy.cables || []).filter((c) => c.role === 'leg' && !(cableIsBroken && cableIsBroken(c)));
        let errY = 0;
        let upErr = Infinity;
        ups.forEach((c) => {
          const pA = attachWorld(c.a);
          const pB = attachWorld(c.b);
          upErr = Math.min(upErr, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
        });
        let legErr = Infinity;
        legs.forEach((c) => {
          const pA = attachWorld(c.a);
          const pB = attachWorld(c.b);
          legErr = Math.min(legErr, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
        });
        if (Number.isFinite(upErr)) errY += upErr;
        if (Number.isFinite(legErr)) errY += legErr;
        if (phy.hookPos) phy.hookPos.y += errY;
        alignBasketBars();
        continue;
      }
      if (!phy.beams || !phy.beams.length) {
        const legs = (phy.cables || []).filter((c) => c.role === 'leg' && !(cableIsBroken && cableIsBroken(c)));
        let minDy = Infinity;
        legs.forEach((c) => {
          const pA = attachWorld(c.a);
          const pB = attachWorld(c.b);
          minDy = Math.min(minDy, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
        });
        if (Number.isFinite(minDy) && phy.hookPos) phy.hookPos.y += minDy;
        continue;
      }

      // 3a. Tầng dưới: đẩy từng thân dầm sở hữu leg lên đúng L0 của nhánh căng nhất
      const legGroups = new Map();
      (phy.cables || []).forEach((c) => {
        if (c.role !== 'leg' || (cableIsBroken && cableIsBroken(c))) return;
        const body = c.a && c.a.body ? c.a.body : null;
        if (!body) return;
        if (!legGroups.has(body)) legGroups.set(body, []);
        legGroups.get(body).push(c);
      });
      legGroups.forEach((list, body) => {
        let minDy = Infinity;
        list.forEach((c) => {
          const pA = attachWorld(c.a);
          const pB = attachWorld(c.b);
          minDy = Math.min(minDy, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
        });
        if (Number.isFinite(minDy)) {
          body.x.y += minDy;
          if (typeof clampBeamAboveCargoRoof === 'function') clampBeamAboveCargoRoof(body);
        }
      });

      // 3b. Tầng giữa (hanger, ví dụ inline4): nâng dầm chính theo 2 dầm phụ
      const hangerGroups = new Map();
      (phy.cables || []).forEach((c) => {
        if (c.role !== 'hanger' || (cableIsBroken && cableIsBroken(c))) return;
        const body = c.a && c.a.body ? c.a.body : null;
        if (!body) return;
        if (!hangerGroups.has(body)) hangerGroups.set(body, []);
        hangerGroups.get(body).push(c);
      });
      hangerGroups.forEach((list, body) => {
        let minDy = Infinity;
        list.forEach((c) => {
          const pA = attachWorld(c.a);
          const pB = attachWorld(c.b);
          minDy = Math.min(minDy, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
        });
        if (Number.isFinite(minDy)) {
          body.x.y += minDy;
          if (typeof clampBeamAboveCargoRoof === 'function') clampBeamAboveCargoRoof(body);
        }
      });

      // 3c. Tầng trên (upper / direct_hook): kéo móc cẩu đúng cao độ làm căng upper
      const b0 = phy.beams[0];
      if (isLbDirectTop && b0 && phy.hookPos) {
        const up0 = (phy.cables || []).find((c) => c.role === 'upper' && !(cableIsBroken && cableIsBroken(c)));
        phy.hookPos.set(b0.x.x, b0.x.y + 0.30 + (up0 ? up0.L0 : 0.04) - hookMasterOffsetY, b0.x.z);
      } else {
        const ups = (phy.cables || []).filter((c) => c.role === 'upper' && !(cableIsBroken && cableIsBroken(c)));
        let minDy = Infinity;
        ups.forEach((c) => {
          const pA = attachWorld(c.a);
          const pB = attachWorld(c.b);
          minDy = Math.min(minDy, pB.y + maxPullNeedDy(pA, pB, c.L0) - pA.y);
        });
        if (Number.isFinite(minDy) && phy.hookPos) phy.hookPos.y += minDy;
      }

      if (state.beamType === 'basket' && typeof alignBasketBars === 'function') {
        alignBasketBars();
      }
    }

    (phy.beams || []).forEach((b) => {
      const floorY = (typeof cargoCeilingUnderBeam === 'function')
        ? cargoCeilingUnderBeam(b.x.x, b.x.z, spec, b)
        : ((phy.cargoPos ? phy.cargoPos.y : 0) + (state.H || 2.5) * 0.5 + 0.18);
      b.isRestingOnCargo = b.x.y <= floorY + 0.03;
    });
  }

  // 4. Đồng bộ tời, khóa vị trí Nhớm và cập nhật trạng thái căng thực cho từng dây
  if (phy.hookPos && phy.hookTarget) phy.hookTarget.copy(phy.hookPos);
  if (phy.hoist) {
    if (typeof resetHoistDynamicState === 'function') resetHoistDynamicState(phy.hoist);
    if (phy.hoist.kin && phy.hookPos) phy.hoist.kin.copy(phy.hookPos);
  }
  (phy.beams || []).forEach((b) => {
    if (b.v) b.v.set(0, 0, 0);
    if (b.w) b.w.set(0, 0, 0);
    if (b.group) {
      b.group.position.copy(b.x);
      if (b.q) b.group.quaternion.copy(b.q);
    }
  });

  if (Array.isArray(phy.legSlacks)) phy.legSlacks.fill(true);
  if (Array.isArray(phy.legTensions)) phy.legTensions.fill(0);
  if (Array.isArray(phy.upperTensions)) phy.upperTensions.fill(0);

  let tautCount = 0;
  (phy.cables || []).forEach((c) => {
    if (cableIsBroken && cableIsBroken(c)) {
      c.slack = true;
      c.tensionT = 0;
      return;
    }
    const span = attachWorld(c.a).distanceTo(attachWorld(c.b));
    const isTaut = span >= (c.L0 || 0) - 0.025;
    c.slack = !isTaut;
    c.tensionT = isTaut ? 0.12 : 0;
    c._sum = c.tensionT * 9.81 * 1000;
    if (isTaut) tautCount++;
    if (c.role === 'leg' && c.index != null) {
      if (Array.isArray(phy.legSlacks)) phy.legSlacks[c.index] = !isTaut;
      if (Array.isArray(phy.legTensions)) phy.legTensions[c.index] = c.tensionT;
    } else if (c.role === 'upper' && c.index != null) {
      if (Array.isArray(phy.upperTensions)) phy.upperTensions[c.index] = c.tensionT;
    }
  });

  phy._nhomFreezeSpreader = true;
  const hookMoved = phy.hookPos ? Math.abs(phy.hookPos.y - prevHookY) > 0.008 : false;
  const beamMoved = (phy.beams || []).some((b, i) => Math.abs((b && b.x ? b.x.y : 0) - (prevBeamYs[i] || 0)) > 0.008);
  const tookUp = prevHadSlack || hookMoved || beamMoved;

  return { tookUp, tautCount };
}
