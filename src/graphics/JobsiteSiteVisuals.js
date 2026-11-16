// @purpose: Dựng và đồng bộ hình khối 3D cho đà kê gỗ, đệm địa chất độ dốc và tấm lót chân chống cẩu ở Tab 6.

const SOIL_STYLES = {
  concrete: { color: 0x64748b, roughness: 0.90, metalness: 0.04, border: 0x94a3b8 },
  gravel: { color: 0x78716c, roughness: 0.96, metalness: 0.02, border: 0xa8a29e },
  stiff_clay: { color: 0x855e3c, roughness: 0.92, metalness: 0.01, border: 0xa16207 },
  soft_ground: { color: 0x5c472e, roughness: 0.98, metalness: 0.00, border: 0x785838 }
};

const WOOD_STYLES = {
  hardwood: { color: 0x5c361d, roughness: 0.84, metalness: 0.04 },
  softwood: { color: 0xd6a662, roughness: 0.78, metalness: 0.02 },
  steel_beam: { color: 0x475569, roughness: 0.42, metalness: 0.78 }
};

export const CRANE_MAT_PRESETS = {
  dish_only: { w: 0, l: 0, h: 0, kind: 'dish' },
  timber_small: { w: 1.2, l: 1.2, h: 0.16, kind: 'timber' },
  timber_medium: { w: 1.6, l: 1.6, h: 0.18, kind: 'timber' },
  steel_mat_2x2: { w: 2.0, l: 2.0, h: 0.14, kind: 'steel' },
  steel_mat_2_4x3: { w: 2.4, l: 3.0, h: 0.16, kind: 'steel' }
};

function readDomVal(id, fallback) {
  if (typeof document === 'undefined') return fallback;
  const el = document.getElementById(id);
  return el && el.value != null && el.value !== '' ? el.value : fallback;
}

export function readJobsiteVisualConfig(state = {}) {
  const qtyRaw = String(readDomVal('sel-dunnage-qty', state.dunnageQty || '2'));
  const secStr = String(readDomVal('sel-dunnage-section', state.dunnageSection || '200x200'));
  const secParts = secStr.split('x').map(Number);
  const secW = Math.max(0.10, Math.min(0.45, (secParts[0] || 200) / 1000));
  const secH = Math.max(0.10, Math.min(0.45, (secParts[1] || secParts[0] * 1000 || 200) / 1000));
  const lengthM = Math.max(1.2, Math.min(12.0, parseFloat(readDomVal('inp-dunnage-length', state.dunnageLengthM || 3.0)) || 3.0));
  const woodType = String(readDomVal('sel-dunnage-wood', state.dunnageWood || 'hardwood'));
  const soilType = String(readDomVal('sel-cargo-soil', state.cargoSoilType || 'concrete'));
  const slopeDeg = Math.max(0, Math.min(5, parseFloat(readDomVal('rng-ground-slope', state.groundSlopeDeg || 0)) || 0));
  const groundId = state.groundId || 'flat';
  const craneMatPresetId = String(readDomVal('sel-crane-mat', state.craneMatPresetId || 'steel_mat_2x2'));
  return { qtyRaw, secW, secH, lengthM, woodType, soilType, slopeDeg, groundId, craneMatPresetId };
}

function disposeGroupChildren(THREE, group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.(obj => {
      if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    });
  }
}

function createSleeperBeam({ THREE, lenZ, secW, secH, woodType, beamMat, capMat }) {
  const beamGroup = new THREE.Group();
  if (woodType === 'steel_beam') {
    const flangeT = Math.max(0.018, secH * 0.16);
    const webT = Math.max(0.020, secW * 0.24);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(secW, flangeT, lenZ), beamMat);
    bot.position.y = flangeT * 0.5;
    const web = new THREE.Mesh(new THREE.BoxGeometry(webT, Math.max(0.02, secH - flangeT * 2), lenZ * 0.996), beamMat);
    web.position.y = secH * 0.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(secW, flangeT, lenZ), beamMat);
    top.position.y = secH - flangeT * 0.5;
    beamGroup.add(bot, web, top);
    [-1, 1].forEach(sz => {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(secW + 0.01, secH, 0.03), capMat);
      cap.position.set(0, secH * 0.5, sz * (lenZ * 0.5 - 0.015));
      beamGroup.add(cap);
    });
  } else {
    const timber = new THREE.Mesh(new THREE.BoxGeometry(secW, secH, lenZ), beamMat);
    timber.position.y = secH * 0.5;
    beamGroup.add(timber);
    [-1, 1].forEach(sz => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(secW + 0.012, secH * 0.34, 0.04), capMat);
      band.position.set(0, secH * 0.5, sz * (lenZ * 0.5 - 0.04));
      beamGroup.add(band);
    });
  }
  beamGroup.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.userData.noCADEdge = woodType !== 'steel_beam';
    }
  });
  return beamGroup;
}

export function rebuildDunnageVisual3D({ THREE, dunnageGroup, state, MATS }) {
  if (!THREE || !dunnageGroup) return null;
  disposeGroupChildren(THREE, dunnageGroup);
  dunnageGroup.name = 'Timber_Dunnage';
  dunnageGroup.visible = true;

  const cfg = readJobsiteVisualConfig(state);
  const L = Math.max(1.8, state?.L || 6.0);
  const W = Math.max(1.2, state?.W || 2.4);
  const wood = WOOD_STYLES[cfg.woodType] || WOOD_STYLES.hardwood;
  const soil = SOIL_STYLES[cfg.soilType] || SOIL_STYLES.concrete;

  const beamMat = new THREE.MeshStandardMaterial({
    color: wood.color,
    roughness: wood.roughness,
    metalness: wood.metalness,
    map: cfg.woodType !== 'steel_beam' ? (MATS?.timberWood?.map || null) : null
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: cfg.woodType === 'steel_beam' ? 0xeab308 : 0x1e293b,
    roughness: 0.55,
    metalness: 0.45
  });
  const padMat = new THREE.MeshStandardMaterial({
    color: cfg.groundId === 'soil' ? 0x6b4f32 : soil.color,
    roughness: soil.roughness,
    metalness: soil.metalness
  });

  const siteContainer = new THREE.Group();
  siteContainer.name = 'DunnageSiteAssembly';
  const slopeRad = THREE.MathUtils.degToRad(cfg.slopeDeg);
  siteContainer.rotation.z = -slopeRad;

  const padL = Math.max(L + 1.2, 4.4);
  const padW = Math.max(cfg.lengthM + 1.1, W + 1.2);
  const padH = cfg.groundId === 'soil' ? 0.08 : 0.045;
  const baseTopY = cfg.groundId === 'soil' ? 0.015 : 0.004;
  const sitePad = new THREE.Mesh(new THREE.BoxGeometry(padL, padH, padW), padMat);
  sitePad.position.y = baseTopY - padH * 0.5;
  sitePad.receiveShadow = true;
  sitePad.userData.noCADEdge = true;
  siteContainer.add(sitePad);

  if (cfg.slopeDeg > 0.05) {
    const wedge = new THREE.Mesh(
      new THREE.BoxGeometry(padL, Math.sin(slopeRad) * padL * 0.5 + 0.03, padW * 0.98),
      new THREE.MeshStandardMaterial({ color: soil.border, roughness: 0.9, metalness: 0.1 })
    );
    wedge.position.set(0, -0.025, 0);
    wedge.userData.noCADEdge = true;
    siteContainer.add(wedge);
  }

  const xSpan = L * 0.78;
  const isGridMat = cfg.qtyRaw === 'mat';
  const beamCount = isGridMat ? 4 : Math.max(2, Math.min(4, parseInt(cfg.qtyRaw, 10) || 2));
  const profileBeams = [];

  if (isGridMat) {
    const runnerCount = 3;
    const runnerH = cfg.secH * 0.75;
    for (let r = 0; r < runnerCount; r++) {
      const rz = ((r / (runnerCount - 1)) - 0.5) * Math.max(1.2, cfg.lengthM * 0.76);
      const runner = createSleeperBeam({
        THREE, lenZ: L * 0.94, secW: cfg.secW * 0.9, secH: runnerH,
        woodType: cfg.woodType, beamMat, capMat
      });
      runner.rotation.y = Math.PI * 0.5;
      runner.position.set(0, baseTopY, rz);
      siteContainer.add(runner);
      profileBeams.push({ cx: 0, cz: rz, halfW: L * 0.47, halfL: cfg.secW * 0.46, topY: baseTopY + runnerH });
    }
  }

  const topLayerOffsetY = isGridMat ? cfg.secH * 0.75 : 0;
  for (let i = 0; i < beamCount; i++) {
    const t = beamCount <= 1 ? 0.5 : i / (beamCount - 1);
    const bx = (t - 0.5) * xSpan;
    const beam = createSleeperBeam({
      THREE, lenZ: cfg.lengthM, secW: cfg.secW, secH: cfg.secH,
      woodType: cfg.woodType, beamMat, capMat
    });
    const stepDeltaY = cfg.groundId === 'rough' ? ((i % 2 === 0 ? 0.05 : -0.025) + (t - 0.5) * 0.04) : 0;
    const beamY = baseTopY + topLayerOffsetY + Math.max(-0.02, stepDeltaY);
    beam.position.set(bx, beamY, 0);
    if (cfg.groundId === 'rough') {
      beam.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.022;
      const shim = new THREE.Mesh(new THREE.BoxGeometry(cfg.secW * 1.1, 0.055, cfg.lengthM * 0.92), capMat);
      shim.position.set(bx, baseTopY + 0.025, 0);
      siteContainer.add(shim);
    }
    siteContainer.add(beam);
    profileBeams.push({ cx: bx, cz: 0, halfW: cfg.secW * 0.5 + 0.02, halfL: cfg.lengthM * 0.5 + 0.02, topY: beamY + cfg.secH });
  }

  dunnageGroup.add(siteContainer);
  dunnageGroup.position.set(0, 0, 0);
  dunnageGroup.rotation.y = ((state?.cargoYawDeg || 0) * Math.PI) / 180;
  dunnageGroup.userData.lastSiteConfig = cfg;
  dunnageGroup.userData.siteProfile = {
    padHalfL: padL * 0.5,
    padHalfW: padW * 0.5,
    baseTopY,
    slopeRad,
    beams: profileBeams
  };
  return cfg;
}

export function evaluateDunnageSupportSurface(worldX, worldZ, dunnageGroup, fallbackBaseY = 0) {
  const profile = dunnageGroup?.userData?.siteProfile;
  if (!profile || !dunnageGroup.visible) return { y: fallbackBaseY, normal: null, onBeam: false };
  const yaw = dunnageGroup.rotation?.y || 0;
  const dx = worldX - (dunnageGroup.position?.x || 0);
  const dz = worldZ - (dunnageGroup.position?.z || 0);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const lx = dx * cy - dz * sy;
  const lz = dx * sy + dz * cy;
  if (Math.abs(lx) > profile.padHalfL || Math.abs(lz) > profile.padHalfW) {
    return { y: fallbackBaseY, normal: null, onBeam: false };
  }
  const slope = profile.slopeRad || 0;
  const ySlope = -Math.sin(slope) * lx;
  let bestY = Math.max(fallbackBaseY, profile.baseTopY * Math.cos(slope) + ySlope);
  let onBeam = false;
  for (const b of profile.beams) {
    if (Math.abs(lx - b.cx) <= b.halfW && Math.abs(lz - b.cz) <= b.halfL) {
      const candidateY = b.topY * Math.cos(slope) + ySlope;
      if (candidateY > bestY) { bestY = candidateY; onBeam = true; }
    }
  }
  const nlx = Math.sin(slope);
  const nly = Math.cos(slope);
  return {
    y: bestY,
    normal: slope > 1e-4 ? { x: nlx * cy, y: nly, z: -nlx * sy } : null,
    onBeam
  };
}

export function syncCraneOutriggerMats3D({ THREE, craneVehicleGroup, presetId = 'steel_mat_2x2', MATS }) {
  if (!THREE || !craneVehicleGroup) return 0;
  const spec = CRANE_MAT_PRESETS[presetId] || CRANE_MAT_PRESETS.steel_mat_2x2;
  let updated = 0;

  craneVehicleGroup.traverse(obj => {
    if (!obj || !obj.userData || !obj.userData.isOutriggerMatSlot) return;
    disposeGroupChildren(THREE, obj);
    updated++;
    if (spec.kind === 'dish' || spec.w <= 0) {
      obj.visible = false;
      return;
    }
    obj.visible = true;
    const baseMat = spec.kind === 'steel'
      ? new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.72 })
      : new THREE.MeshStandardMaterial({
          color: 0x7c4a26, roughness: 0.85, metalness: 0.04, map: MATS?.timberWood?.map || null
        });
    const trimMat = new THREE.MeshStandardMaterial({
      color: spec.kind === 'steel' ? 0xeab308 : 0x1e293b, roughness: 0.55, metalness: 0.5
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), baseMat);
    slab.position.y = spec.h * 0.5;
    slab.castShadow = true;
    slab.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.04, spec.h * 0.34, spec.l + 0.04), trimMat);
    rim.position.y = spec.h * 0.17;
    rim.userData.noCADEdge = true;
    obj.add(slab, rim);
  });
  return updated;
}

/** Projects dunnage beam tops onto cargo-local bottom face so shifted/rotated cargos never pierce timber. */
export function sampleDunnageContactPointsForCargo({ THREE, cargoPos, cargoQuat, L, W, H, dunnageGroup } = {}) {
  const profile = dunnageGroup?.userData?.siteProfile;
  if (!THREE || !profile || !dunnageGroup.visible || !cargoPos || !Array.isArray(profile.beams)) return [];
  const halfL = (L || 6) * 0.5, halfW = (W || 2.4) * 0.5, botY = -(H || 2.5) * 0.5;
  const yaw = dunnageGroup.rotation?.y || 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ox = dunnageGroup.position?.x || 0, oz = dunnageGroup.position?.z || 0;
  const invCargoQ = (cargoQuat || new THREE.Quaternion()).clone().invert();
  const out = [];
  for (const b of profile.beams) {
    for (const fx of [-0.85, 0, 0.85]) {
      for (const fz of [-0.85, 0, 0.85]) {
        const lx = b.cx + fx * b.halfW, lz = b.cz + fz * b.halfL;
        const wx = ox + lx * cy + lz * sy, wz = oz - lx * sy + lz * cy;
        const localPt = new THREE.Vector3(wx - cargoPos.x, 0, wz - cargoPos.z).applyQuaternion(invCargoQ);
        if (Math.abs(localPt.x) <= halfL + 0.04 && Math.abs(localPt.z) <= halfW + 0.04) {
          out.push(new THREE.Vector3(THREE.MathUtils.clamp(localPt.x, -halfL, halfL), botY, THREE.MathUtils.clamp(localPt.z, -halfW, halfW)));
        }
      }
    }
  }
  return out;
}
