// @purpose: Gizmo 3D cung góc dây cáp tương tác (hover/chọn): đường ngang đứt nét, vector dây, quạt cung xanh/vàng/đỏ, nhãn độ
const ARC_SEGMENTS = 24;

export function classifySlingAngleZone(angleDeg) {
  const a = Number.isFinite(Number(angleDeg)) ? Number(angleDeg) : 0;
  if (a >= 45) return { zone: 'safe', hex: 0x10b981, css: '#10b981' };
  if (a >= 30) return { zone: 'warn', hex: 0xf59e0b, css: '#f59e0b' };
  return { zone: 'danger', hex: 0xef4444, css: '#ef4444' };
}

/**
 * Pure math builder for the horizontal angle gizmo frame between lower anchor
 * `origin` (cargo/beam end) and upper anchor `upper` (hook/beam end).
 */
export function computeSlingAngleArcData(pointA, pointB, radiusM = 1.15) {
  if (!pointA || !pointB) return null;
  const ax = Number(pointA.x) || 0;
  const ay = Number(pointA.y) || 0;
  const az = Number(pointA.z) || 0;
  const bx = Number(pointB.x) || 0;
  const by = Number(pointB.y) || 0;
  const bz = Number(pointB.z) || 0;

  // Always place the vertex at the lower end so the horizontal plane fans upward along the sling
  const low = ay <= by ? { x: ax, y: ay, z: az } : { x: bx, y: by, z: bz };
  const high = ay <= by ? { x: bx, y: by, z: bz } : { x: ax, y: ay, z: az };

  const dx = high.x - low.x;
  const dy = high.y - low.y;
  const dz = high.z - low.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return null;

  const horizLen = Math.hypot(dx, dz);
  const rad = Math.atan2(Math.max(0, dy), Math.max(1e-6, horizLen));
  const angleDeg = (rad * 180) / Math.PI;
  const r = Math.min(Math.max(0.45, radiusM), len * 0.55);

  // Horizontal unit direction in XZ; fallback +X when sling is strictly vertical (90°)
  const hx = horizLen > 1e-4 ? dx / horizLen : 1;
  const hz = horizLen > 1e-4 ? dz / horizLen : 0;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;

  const arcVertices = [];
  arcVertices.push(low.x, low.y, low.z);
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = (i / ARC_SEGMENTS) * rad;
    const c = Math.cos(t);
    const s = Math.sin(t);
    arcVertices.push(
      low.x + (hx * c) * r,
      low.y + s * r,
      low.z + (hz * c) * r
    );
  }

  const midT = rad * 0.55;
  const labelPos = {
    x: low.x + hx * Math.cos(midT) * (r * 1.18),
    y: low.y + Math.sin(midT) * (r * 1.18) + 0.08,
    z: low.z + hz * Math.cos(midT) * (r * 1.18)
  };

  return {
    origin: low,
    upper: high,
    horizEnd: { x: low.x + hx * r * 1.12, y: low.y, z: low.z + hz * r * 1.12 },
    slingEnd: { x: low.x + ux * r * 1.12, y: low.y + uy * r * 1.12, z: low.z + uz * r * 1.12 },
    angleDeg,
    angleRad: rad,
    color: classifySlingAngleZone(angleDeg),
    arcVertices,
    labelPos
  };
}

function createAngleSprite(THREE) {
  if (typeof document === 'undefined') {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    spr.scale.set(0.9, 0.45, 1);
    return { sprite: spr, setLabel: () => {}, dispose: () => spr.material.dispose() };
  }
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.95, 0.44, 1);
  sprite.renderOrder = 998;
  let lastText = '';
  const setLabel = (text, cssColor) => {
    const key = `${text}|${cssColor}`;
    if (key === lastText || !ctx) return;
    lastText = key;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = cssColor;
    ctx.lineWidth = 3;
    ctx.fillRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    tex.needsUpdate = true;
  };
  return {
    sprite,
    setLabel,
    dispose: () => {
      tex.dispose();
      mat.dispose();
    }
  };
}

export function createSlingAngleGizmo({ THREE, scene }) {
  const group = new THREE.Group();
  group.name = 'Sling_Angle_Gizmo_3D';
  group.visible = false;
  group.renderOrder = 995;

  const hGeo = new THREE.BufferGeometry();
  const hPos = new Float32Array(6);
  hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  const hMat = new THREE.LineDashedMaterial({ color: 0xe2e8f0, dashSize: 0.14, gapSize: 0.08, depthTest: false, transparent: true, opacity: 0.9 });
  const hLine = new THREE.Line(hGeo, hMat);
  hLine.renderOrder = 996;

  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(6);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sMat = new THREE.LineBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
  const sLine = new THREE.Line(sGeo, sMat);
  sLine.renderOrder = 997;

  const arcGeo = new THREE.BufferGeometry();
  const arcPos = new Float32Array((ARC_SEGMENTS + 2) * 3);
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
  const indices = [];
  for (let i = 1; i <= ARC_SEGMENTS; i++) indices.push(0, i, i + 1);
  arcGeo.setIndex(indices);
  const arcMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthTest: false });
  const arcMesh = new THREE.Mesh(arcGeo, arcMat);
  arcMesh.renderOrder = 995;

  const lbl = createAngleSprite(THREE);
  group.add(hLine, sLine, arcMesh, lbl.sprite);
  if (scene) scene.add(group);

  let disposed = false;

  function update({ visible = true, qualityTier = 'high', pointA = null, pointB = null } = {}) {
    if (disposed || !visible || qualityTier === 'performance' || !pointA || !pointB) {
      group.visible = false;
      return null;
    }
    const data = computeSlingAngleArcData(pointA, pointB);
    if (!data) {
      group.visible = false;
      return null;
    }
    hPos[0] = data.origin.x; hPos[1] = data.origin.y; hPos[2] = data.origin.z;
    hPos[3] = data.horizEnd.x; hPos[4] = data.horizEnd.y; hPos[5] = data.horizEnd.z;
    hGeo.attributes.position.needsUpdate = true;
    if (typeof hLine.computeLineDistances === 'function') hLine.computeLineDistances();

    sPos[0] = data.origin.x; sPos[1] = data.origin.y; sPos[2] = data.origin.z;
    sPos[3] = data.slingEnd.x; sPos[4] = data.slingEnd.y; sPos[5] = data.slingEnd.z;
    sGeo.attributes.position.needsUpdate = true;

    for (let i = 0; i < data.arcVertices.length; i++) arcPos[i] = data.arcVertices[i];
    arcGeo.attributes.position.needsUpdate = true;

    sMat.color.setHex(data.color.hex);
    arcMat.color.setHex(data.color.hex);
    lbl.sprite.position.set(data.labelPos.x, data.labelPos.y, data.labelPos.z);
    lbl.setLabel(`α ${data.angleDeg.toFixed(1)}°`, data.color.css);
    group.visible = true;
    return data;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (scene) scene.remove(group);
    hGeo.dispose(); hMat.dispose();
    sGeo.dispose(); sMat.dispose();
    arcGeo.dispose(); arcMat.dispose();
    lbl.dispose();
  }

  return { group, arcMesh, hLine, sLine, update, dispose };
}
