// @purpose: Dựng dây chằng Flat Rack ôm khít kiện hàng (không lòi ngang) và mô phỏng đứt tuần tự tự nhiên theo vật lý.

function seededUnit(seed, k) {
  const raw = Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

/** Compute tight anchor Z inside/at Flat Rack side rail so no bar protrudes into open air. */
export function computeTightStrapGeometry({ cL, cW, cH, offsetX, offsetZ, cargoBottomY, cargoTopY, deckTopY, W, strapCount, k }) {
  const sx = offsetX + (strapCount <= 1 ? 0 : (-cL * 0.42 + (k / (strapCount - 1)) * (cL * 0.84)));
  const outerFaceOffset = cW * 0.5 + 0.032; // flush outside 30mm polyHood & 20mm wooden studs
  const maxDeckRailHalfW = Math.max(0.4, W * 0.5 - 0.045);

  const sides = [-1, 1].map(sz => {
    const wallZ = offsetZ + sz * outerFaceOffset;
    // Anchor stays strictly inside deck frame rail (diagonal inward leg if OOG overhangs deck)
    const rawRailZ = sz * maxDeckRailHalfW;
    const anchorZ = Math.abs(wallZ) <= maxDeckRailHalfW ? wallZ - sz * 0.012 : rawRailZ;
    const clampedZ = Math.abs(anchorZ) > Math.max(maxDeckRailHalfW, Math.abs(wallZ)) ? wallZ : anchorZ;
    return {
      sz,
      wallZ,
      anchorZ: clampedZ,
      ratchetY: cargoBottomY + cH * 0.24,
      sideBottomY: Math.max(deckTopY + 0.03, cargoBottomY + 0.02),
      strapTopY: cargoTopY + 0.020
    };
  });

  return { sx, outerFaceOffset, strapTopY: cargoTopY + 0.020, topSpanW: cW + 0.072, sides };
}

/** Compute per-strap normalized failure thresholds (0.42..1.05) with natural random asymmetry. */
export function computeStrapFailureOrder({ strapCount, sxList, gLocalX = 0, gLocalZ = 0, seed = 1 }) {
  const maxSpan = Math.max(1.0, ...sxList.map(x => Math.abs(x)));
  return sxList.map((sx, k) => {
    const edgeLoad = 1.0 + 0.16 * (sx / maxSpan) * Math.sign(gLocalX || 1) + 0.08 * Math.abs(gLocalZ > 0 ? 1 : -1);
    const randomFactor = 0.82 + seededUnit(seed, k) * 0.36; // 0.82 .. 1.18
    const threshold = Math.max(0.36, Math.min(1.0, (0.72 * randomFactor) / Math.max(0.75, edgeLoad)));
    return { index: k, sx, threshold, randomFactor };
  });
}

export function buildTightFlatRackLashingVisuals({ THREE, oogGroup, group, MATS, dims }) {
  const { cL, cW, cH, offsetX, offsetZ, cargoBottomY, cargoTopY, deckTopY, W } = dims;
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0xff5500, roughness: 0.55, metalness: 0.08,
    polygonOffset: true, polygonOffsetFactor: -2.0, polygonOffsetUnits: -4.0
  });
  const brokenMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.62, metalness: 0.06 });

  const lashingGroup = new THREE.Group();
  lashingGroup.name = 'flatRackLashingStraps';
  const brokenLashingGroup = new THREE.Group();
  brokenLashingGroup.name = 'flatRackBrokenStraps';
  brokenLashingGroup.visible = true;

  const strapCount = Math.max(4, Math.min(8, Math.floor(cL * 0.85)));
  const seed = Math.abs((cL * 7.31 + cW * 3.17) % 97) + 1.37;
  const strapNodes = [];

  for (let k = 0; k < strapCount; k++) {
    const geo = computeTightStrapGeometry({
      cL, cW, cH, offsetX, offsetZ, cargoBottomY, cargoTopY, deckTopY, W, strapCount, k
    });
    const intactNode = new THREE.Group();
    intactNode.name = `strapIntact_${k}`;

    const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.014, geo.topSpanW), strapMat);
    topStrap.position.set(geo.sx, geo.strapTopY, offsetZ);
    topStrap.castShadow = true;
    intactNode.add(topStrap);

    const sideTails = [];
    geo.sides.forEach(side => {
      const { sz, wallZ, anchorZ, ratchetY, sideBottomY, strapTopY } = side;
      const sideH = Math.max(0.25, strapTopY - sideBottomY);
      const sideStrap = new THREE.Mesh(new THREE.BoxGeometry(0.062, sideH, 0.014), strapMat);
      sideStrap.position.set(geo.sx, sideBottomY + sideH * 0.5, wallZ);
      sideStrap.castShadow = true;
      intactNode.add(sideStrap);

      // Diagonal tie-down leg strictly from cargo corner down inside deck rail D-ring
      const dz = anchorZ - wallZ;
      const dy = (deckTopY + 0.018) - sideBottomY;
      const legLen = Math.max(0.08, Math.hypot(dz, dy));
      const tieLeg = new THREE.Mesh(new THREE.BoxGeometry(0.052, legLen, 0.014), strapMat);
      tieLeg.position.set(geo.sx, (sideBottomY + deckTopY + 0.018) * 0.5, (wallZ + anchorZ) * 0.5);
      tieLeg.rotation.x = Math.atan2(dz, -dy);
      intactNode.add(tieLeg);

      const dRing = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.032, 0.045), MATS.galvSteel);
      dRing.position.set(geo.sx, deckTopY + 0.016, anchorZ);
      intactNode.add(dRing);

      const ratchet = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.13, 0.038), MATS.galvSteel);
      ratchet.position.set(geo.sx, ratchetY, wallZ + sz * 0.016);
      intactNode.add(ratchet);

      // Recoil tail on the deck D-ring + upper whip tail on cargo top corner
      const botTailLen = 0.28 + (k % 2) * 0.10;
      const botPivot = new THREE.Group();
      botPivot.position.set(geo.sx, deckTopY + 0.02, anchorZ);
      const botMesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, botTailLen, 0.014), brokenMat);
      botMesh.position.y = botTailLen * 0.5;
      botPivot.add(botMesh);
      botPivot.visible = false;
      brokenLashingGroup.add(botPivot);

      const topTailLen = 0.34 + ((k + 1) % 3) * 0.08;
      const topPivot = new THREE.Group();
      topPivot.position.set(geo.sx, strapTopY - 0.02, wallZ);
      const topMesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, topTailLen, 0.014), brokenMat);
      topMesh.position.y = -topTailLen * 0.5;
      topPivot.add(topMesh);
      topPivot.visible = false;
      intactNode.parent?.add?.(topPivot);
      oogGroup.add(topPivot);

      sideTails.push({ sz, botPivot, topPivot, sideSeed: seededUnit(seed + 4.1, k * 2 + (sz > 0 ? 1 : 0)) });
    });

    lashingGroup.add(intactNode);
    strapNodes.push({
      index: k,
      sx: geo.sx,
      seed,
      intactNode,
      sideTails,
      snapped: false,
      whipAge: 0
    });
  }

  oogGroup.add(lashingGroup);
  brokenLashingGroup.traverse(o => { o.userData.noLugWeld = true; });
  group.add(brokenLashingGroup);
  oogGroup.userData.lashingNodes = strapNodes;
  return strapNodes;
}

export function resetFlatRackLashingNodes(activeCargoVisual) {
  if (!activeCargoVisual) return;
  const oogGroup = activeCargoVisual.getObjectByName('flatRackOogCargo');
  const lashingGroup = activeCargoVisual.getObjectByName('flatRackLashingStraps');
  const brokenGroup = activeCargoVisual.getObjectByName('flatRackBrokenStraps');
  if (lashingGroup) lashingGroup.visible = true;
  if (brokenGroup) brokenGroup.visible = true;
  const nodes = oogGroup?.userData?.lashingNodes;
  if (!Array.isArray(nodes)) return;
  for (const n of nodes) {
    n.snapped = false;
    n.whipAge = 0;
    if (n.intactNode) n.intactNode.visible = true;
    for (const tail of n.sideTails || []) {
      if (tail.botPivot) { tail.botPivot.visible = false; tail.botPivot.rotation.set(0, 0, 0); }
      if (tail.topPivot) { tail.topPivot.visible = false; tail.topPivot.rotation.set(0, 0, 0); }
    }
  }
}

export function stepStaggeredLashingBreakPhysics({
  st, oogGroup, gLocal, dt, lashingDemandN, lashingCapacityN, onStrapSnap
}) {
  const nodes = oogGroup?.userData?.lashingNodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return { anySnappedNow: false, allSnapped: st.strapsBroken };

  const order = computeStrapFailureOrder({
    strapCount: nodes.length,
    sxList: nodes.map(n => n.sx),
    gLocalX: gLocal?.x || 0,
    gLocalZ: gLocal?.z || 0,
    seed: nodes[0].seed || 1
  });

  if (!st.ruptureCascadeTimer) st.ruptureCascadeTimer = 0;
  const overloadRatio = lashingCapacityN > 0 ? (lashingDemandN / lashingCapacityN) : 0;
  const driveStress = st.strapsBroken ? 2.0 : Math.max(st.strapStress || 0, overloadRatio * 0.72);
  if (st.strapsBroken) st.ruptureCascadeTimer += dt;

  let anySnappedNow = false;
  let snappedCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const ord = order[i];
    const staggeredThreshold = st.strapsBroken ? (ord.threshold - st.ruptureCascadeTimer * 2.4) : ord.threshold;
    if (!node.snapped && (driveStress >= staggeredThreshold || (st.strapsBroken && st.ruptureCascadeTimer >= i * 0.055))) {
      node.snapped = true;
      node.whipAge = 0;
      anySnappedNow = true;
      if (node.intactNode) node.intactNode.visible = false;
      for (const tail of node.sideTails || []) {
        if (tail.botPivot) tail.botPivot.visible = true;
        if (tail.topPivot) tail.topPivot.visible = true;
      }
      if (typeof onStrapSnap === 'function') onStrapSnap(node, i);
    }

    if (node.snapped) {
      snappedCount++;
      node.whipAge += dt;
      const damp = Math.exp(-node.whipAge * 3.8);
      for (const tail of node.sideTails || []) {
        const phase = node.whipAge * 18.0 + tail.sideSeed * 6.28;
        if (tail.botPivot) {
          tail.botPivot.rotation.x = tail.sz * (1.28 - 0.42 * damp * Math.cos(phase));
          tail.botPivot.rotation.z = (tail.sideSeed - 0.5) * 0.45 + 0.18 * damp * Math.sin(phase);
        }
        if (tail.topPivot) {
          tail.topPivot.rotation.x = -tail.sz * (0.42 + 0.55 * damp * Math.sin(phase));
          tail.topPivot.rotation.z = (tail.sideSeed - 0.5) * 0.35;
        }
      }
    }
  }

  return { anySnappedNow, snappedCount, totalStraps: nodes.length };
}
