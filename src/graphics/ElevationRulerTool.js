// @purpose: Vẽ cây thước đo cao độ 3D so với mặt đất (Hook, Spreader, Đỉnh/Đáy kiện) và điểm đỏ theo chuột trên chi tiết 3D.

export function computeElevationMarkers({ THREE, state = {}, phy = {} }) {
  const hookY = phy.hookPos ? Math.max(0, phy.hookPos.y) : 0;
  let spreaderY = null;
  if (state.beamType && state.beamType !== 'none' && Array.isArray(phy.beams) && phy.beams.length > 0) {
    let sum = 0;
    let cnt = 0;
    for (const b of phy.beams) {
      if (b && b.x && Number.isFinite(b.x.y)) { sum += b.x.y; cnt++; }
    }
    if (cnt > 0) spreaderY = Math.max(0, sum / cnt);
  }

  let cargoTopY = 0;
  let cargoBottomY = 0;
  if (phy.cargoPos) {
    const hx = (state.L || 6.0) * 0.5;
    const hy = (state.H || 2.5) * 0.5;
    const hz = (state.W || 2.4) * 0.5;
    const q = phy.cargoQuat;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          let wy = sy * hy;
          if (q) {
            const v = THREE ? new THREE.Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(q) : null;
            if (v) wy = v.y;
          }
          const y = phy.cargoPos.y + wy;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    cargoBottomY = Math.max(0, Number.isFinite(minY) ? minY : phy.cargoPos.y - hy);
    cargoTopY = Math.max(cargoBottomY, Number.isFinite(maxY) ? maxY : phy.cargoPos.y + hy);
  }

  return { hookY, spreaderY, cargoTopY, cargoBottomY };
}

function makeSpriteLabel(THREE, borderColor = '#38bdf8') {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 68;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.3, 0.49, 1);
  sprite.renderOrder = 25;
  sprite.userData._lastText = '';
  sprite.userData._redraw = (text, accent = borderColor) => {
    if (sprite.userData._lastText === text && sprite.userData._lastAccent === accent) return;
    sprite.userData._lastText = text;
    sprite.userData._lastAccent = accent;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.5 + 1);
    tex.needsUpdate = true;
  };
  return sprite;
}

export function createElevationRulerTool({ THREE, scene }) {
  const rulerGroup = new THREE.Group();
  rulerGroup.name = 'Elevation_Ruler_3D';
  rulerGroup.userData.isElevationRuler = true;
  rulerGroup.visible = false;
  if (scene) scene.add(rulerGroup);

  const poleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78 });
  const tickMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.72 });
  const minorMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 });
  const basePlate = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.34, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  basePlate.rotation.x = -Math.PI / 2;
  basePlate.position.y = 0.015;
  rulerGroup.add(basePlate);

  const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1, 12), poleMat);
  rulerGroup.add(poleMesh);

  const ticksGroup = new THREE.Group();
  rulerGroup.add(ticksGroup);
  let builtMaxM = 0;

  const ensureTicks = (maxM) => {
    const targetM = Math.max(12, Math.ceil(maxM));
    poleMesh.scale.set(1, targetM, 1);
    poleMesh.position.y = targetM * 0.5;
    if (builtMaxM === targetM) return;
    builtMaxM = targetM;
    while (ticksGroup.children.length > 0) {
      const c = ticksGroup.children[0];
      ticksGroup.remove(c);
      c.geometry?.dispose?.();
    }
    for (let y = 0; y <= targetM * 2; y++) {
      const meters = y * 0.5;
      const isMajor = y % 2 === 0;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(isMajor ? 0.34 : 0.16, 0.02, 0.025),
        isMajor ? tickMat : minorMat
      );
      tick.position.set(isMajor ? 0.17 : 0.08, Math.max(0.01, meters), 0);
      ticksGroup.add(tick);
      if (isMajor && meters > 0 && meters % 2 === 0) {
        const numSpr = makeSpriteLabel(THREE, '#38bdf8');
        if (numSpr) {
          numSpr.scale.set(0.95, 0.24, 1);
          numSpr.position.set(-0.62, meters, 0);
          numSpr.userData._redraw(`${meters.toFixed(0)}m`, '#38bdf8');
          ticksGroup.add(numSpr);
        }
      }
    }
  };

  const makeMarker = (colorHex, cssColor) => {
    const grp = new THREE.Group();
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 14, 14),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.025, 0.025), new THREE.MeshBasicMaterial({ color: colorHex }));
    bar.position.x = 0.32;
    const spr = makeSpriteLabel(THREE, cssColor);
    if (spr) spr.position.set(1.65, 0, 0);
    grp.add(dot, bar);
    if (spr) grp.add(spr);
    grp.userData.sprite = spr;
    grp.userData.cssColor = cssColor;
    rulerGroup.add(grp);
    return grp;
  };

  const mHook = makeMarker(0xfacc15, '#facc15');
  const mSpreader = makeMarker(0xf97316, '#f97316');
  const mTop = makeMarker(0x22c55e, '#22c55e');
  const mBottom = makeMarker(0x38bdf8, '#38bdf8');

  const hoverDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  hoverDot.visible = false;
  hoverDot.renderOrder = 30;
  rulerGroup.add(hoverDot);

  const hoverLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const hoverLine = new THREE.Line(
    hoverLineGeo,
    new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9 })
  );
  hoverLine.visible = false;
  hoverLine.renderOrder = 29;
  if (scene) scene.add(hoverLine);

  const hoverSprite = makeSpriteLabel(THREE, '#ef4444');
  if (hoverSprite) {
    hoverSprite.visible = false;
    hoverSprite.scale.set(2.5, 0.52, 1);
    rulerGroup.add(hoverSprite);
  }

  let hoverWorld = null;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  const updateHover = ({ clientX, clientY, domElement, camera, targets }) => {
    if (!rulerGroup.visible || !domElement || !camera) { hoverWorld = null; return null; }
    const rect = domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const list = [];
    (targets || []).forEach(root => {
      if (!root || !root.visible || root.userData?.isElevationRuler) return;
      list.push(root);
    });
    const hits = raycaster.intersectObjects(list, true).filter(h => h.object && h.object.visible && !h.object.userData?.isElevationRuler);
    if (!hits.length) { hoverWorld = null; return null; }
    hoverWorld = hits[0].point.clone();
    return hoverWorld;
  };

  const update = ({ visible, state, phy }) => {
    rulerGroup.visible = !!visible;
    if (!rulerGroup.visible) {
      hoverDot.visible = false;
      hoverLine.visible = false;
      if (hoverSprite) hoverSprite.visible = false;
      return null;
    }
    const cx = phy?.cargoPos ? phy.cargoPos.x : 0;
    const cz = phy?.cargoPos ? phy.cargoPos.z : 0;
    const rx = cx - Math.max(2.4, (state?.L || 6) * 0.5) - 1.35;
    const rz = cz + Math.max(1.4, (state?.W || 2.4) * 0.5) + 0.55;
    rulerGroup.position.set(rx, 0, rz);

    const marks = computeElevationMarkers({ THREE, state, phy });
    ensureTicks(Math.max(12, marks.hookY + 2, marks.cargoTopY + 2));

    const place = (grp, yVal, label) => {
      if (yVal == null) { grp.visible = false; return; }
      grp.visible = true;
      grp.position.set(0, yVal, 0);
      grp.userData.sprite?.userData?._redraw(label, grp.userData.cssColor);
    };
    place(mHook, marks.hookY, `Hook: ${marks.hookY.toFixed(2)} m`);
    place(mSpreader, marks.spreaderY, marks.spreaderY != null ? `Ngáng: ${marks.spreaderY.toFixed(2)} m` : '');
    place(mTop, marks.cargoTopY, `Đỉnh: ${marks.cargoTopY.toFixed(2)} m`);
    place(mBottom, marks.cargoBottomY, `Đáy: ${marks.cargoBottomY.toFixed(2)} m`);

    if (hoverWorld) {
      const hy = Math.max(0, hoverWorld.y);
      hoverDot.visible = true;
      hoverDot.position.set(0, hy, 0);
      const posArr = hoverLineGeo.attributes.position.array;
      posArr[0] = rx; posArr[1] = hy; posArr[2] = rz;
      posArr[3] = hoverWorld.x; posArr[4] = hoverWorld.y; posArr[5] = hoverWorld.z;
      hoverLineGeo.attributes.position.needsUpdate = true;
      hoverLine.visible = true;
      if (hoverSprite) {
        hoverSprite.visible = true;
        hoverSprite.position.set(-1.65, hy, 0);
        hoverSprite.userData?._redraw(`Điểm đỏ: ${hy.toFixed(2)} m`, '#ef4444');
      }
    } else {
      hoverDot.visible = false;
      hoverLine.visible = false;
      if (hoverSprite) hoverSprite.visible = false;
    }
    return marks;
  };

  return { group: rulerGroup, update, updateHover, clearHover: () => { hoverWorld = null; } };
}
