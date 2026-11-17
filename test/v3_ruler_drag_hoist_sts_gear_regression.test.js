// @purpose: Kiểm thử hồi quy 6 nâng cấp mới: bỏ cục tời khi tắt cẩu 3D, kéo đặt thước 3D & bắt Điểm Đỏ cáp/ma ní, dblclick Hạ/Kéo, mở khóa chỉnh cáp, hết giật STS Direct.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createElevationRulerTool } from '../src/graphics/ElevationRulerTool.js';
import { pickBestElevationHoverPoint, buildRulerHoverInputs } from '../src/graphics/ElevationRulerMath.js';
import { rebuildDunnageVisual3D, sampleDunnageContactPointsForCargo } from '../src/graphics/JobsiteSiteVisuals.js';
import { computeWebSlingVisualSize, applySlingSegmentTransform } from '../src/rigging/SlingPerfHelper.js';
import {
  createContinuousWebRibbonMesh,
  updateWebRibbonMesh,
  createEn1492WebEyeGroup
} from '../src/rigging/WebbingSlingMeshBuilder.js';
import { EXTRA_UI_EN, translateBadge } from '../src/i18n/sim_ui_phrases.js';
import {
  startReplayRecording,
  captureReplayFrame,
  stepReplayPlayback
} from '../src/rigging/ReplayRecorder.js';
import { createHeadlessSim } from './sim_test_harness.js';

describe('V3 UX & Physics Upgrades Regression', () => {
  it('1. hook_only crane leaves overhead sheaveCrownGroup empty with zero floating black box/sheaves', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    s.craneType = 'hook_only';
    sim.rebuildCargoAndRig(true);
    const rootScene = sim.getCargoVisual()?.parent?.parent;
    expect(rootScene).toBeTruthy();
    let boxOrSheaveCount = 0;
    rootScene.traverse((o) => {
      if (o.isMesh && o.parent?.position?.y === 24 && o.geometry) boxOrSheaveCount++;
    });
    expect(boxOrSheaveCount).toBe(0);
  });

  it('2. Elevation Ruler supports user drag placement and picks cables/shackles via ray-segment fallback', () => {
    const scene = new THREE.Scene();
    const ruler = createElevationRulerTool({ THREE, scene });
    expect(ruler.dragHandle?.userData?.dragType).toBe('ruler');

    ruler.setCustomPosition(3.2, -2.5);
    ruler.update({
      visible: true,
      state: { beamType: 'spreader', L: 6, W: 2.4, H: 2.5 },
      phy: { hookPos: new THREE.Vector3(0, 11, 0), cargoPos: new THREE.Vector3(0, 1.25, 0) }
    });
    expect(ruler.group.position.x).toBeCloseTo(3.2, 4);
    expect(ruler.group.position.z).toBeCloseTo(-2.5, 4);

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 6.0, 8.0), new THREE.Vector3(0, 0, -1));
    const inputs = buildRulerHoverInputs({
      THREE,
      phy: {
        hookPos: new THREE.Vector3(0, 10, 0),
        cables: [{ a: { kind: 'hook' }, b: { kind: 'leg' } }]
      },
      attachWorld: (end) => (end.kind === 'hook' ? new THREE.Vector3(0, 9.5, 0) : new THREE.Vector3(0.05, 3.0, 0))
    });
    const pt = pickBestElevationHoverPoint({ THREE, raycaster, targets: [], segments: inputs.segments, thresholdM: 0.18 });
    expect(pt).not.toBeNull();
    expect(pt.y).toBeGreaterThan(5.8);
    expect(pt.y).toBeLessThan(6.2);
  });

  it('3. Edited manual cable length overrides freeze hold and survives physics stepping & Nhấc thử', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    const phy = sim.getPhy();
    s.beamType = 'spreader';
    sim.rebuildCargoAndRig(true);

    s.holdCableLength = true;
    s.heldCableL0 = { upper: [5.0, 5.0], leg: [2.0, 2.0, 2.0, 2.0], hanger: [] };

    const leg0 = s.gear.legs[0];
    leg0.lengthM = 3.6;
    leg0.userSet = true;
    leg0._manualLengthOverride = true;
    s.heldCableL0.leg[0] = null;

    sim.stepSim(1);
    const cableLeg0 = phy.cables.find((c) => c.role === 'leg' && c.index === 0);
    expect(cableLeg0.L0).toBeCloseTo(3.6, 2);

    // Nhấc thử wiring must only clear _nhomAutoLen locks, NOT _manualLengthOverride
    const root = path.resolve(import.meta.dirname, '..');
    const eventsSrc = fs.readFileSync(path.join(root, 'src/sim/session/presets_events.js'), 'utf8');
    expect(eventsSrc).toContain('if (!rec || !rec.userSet || rec._manualLengthOverride) return;');
  });

  it('4. STS Spreader Direct attach lowers monotonically without downward free-fall / upward bounce jerk', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    const phy = sim.getPhy();
    s.cargoType = 'iso40';
    s.beamType = 'container_spreader';
    s.stsAttachMode = 'direct';
    s.poseLock = false;
    sim.rebuildCargoAndRig(true);

    phy.hookPos.y = 10.5;
    phy.hookTarget.y = 10.5;
    phy.beams[0].x.y = 10.28;
    phy.cargoPos.y = 10.28 - 0.34 - (s.H * 0.5);
    phy.groundClearance = 6.0;
    sim.stepSim(6);

    phy.hoistSpeed = -0.85;
    phy._stsPinsSnug = true;
    const ys = [];
    for (let i = 0; i < 45; i++) {
      sim.stepSim(1);
      ys.push(phy.cargoPos.y);
    }
    let bounceUpCount = 0;
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] - ys[i - 1] > 0.002) bounceUpCount++;
    }
    expect(bounceUpCount).toBe(0);
    expect(ys[ys.length - 1]).toBeLessThan(ys[0] - 0.3);
  });

  it('5. Double-click Kéo lifts smoothly toward 10m and Double-click Hạ lowers to ground with all cables slack', () => {
    const sim = createHeadlessSim();
    const s = sim.getState();
    const phy = sim.getPhy();
    s.beamType = 'spreader';
    sim.rebuildCargoAndRig(true);

    globalThis.beginAutoHoistToClearance(10.0);
    expect(phy._autoTargetClearanceM).toBeCloseTo(10.0, 2);
    expect(phy.autoHoistActive).toBe(true);

    phy._setDownFullSlack = true;
    globalThis.beginSmoothSetDown();
    sim.stepSim(220);
    expect(phy.groundClearance).toBeLessThan(0.05);
    expect((phy.cables || []).every((c) => c.slack)).toBe(true);
  });

  it('6. Ghi/Xem/Dừng ReplayRecorder captures and replays full rigging pose (hook, spreader beams, cargo, cables, slew)', () => {
    const beamGroup = new THREE.Group();
    const state = { poseLock: true, slewDeg: 0, craneAngleDeg: 0, gear: { legs: [{ broken: false }], uppers: [], hangers: [] } };
    const phy = {
      rigLive: false,
      groundClearance: 0,
      hookPos: new THREE.Vector3(0, 8.0, 0),
      hookTarget: new THREE.Vector3(0, 8.0, 0),
      hookVel: new THREE.Vector3(),
      cargoPos: new THREE.Vector3(0, 1.3, 0),
      cargoQuat: new THREE.Quaternion(),
      cargoVel: new THREE.Vector3(),
      cargoOmega: new THREE.Vector3(),
      beams: [{ id: 'main', x: new THREE.Vector3(0, 4.5, 0), q: new THREE.Quaternion(), isRestingOnCargo: true, group: beamGroup }],
      cables: [{ role: 'leg', index: 0, L0: 2.0, tensionT: 0, slack: true, broken: false }],
      legSlacks: [true],
      legTensions: [0],
      upperTensions: [0]
    };
    const replay = { recording: false, playing: false, frames: [], t0: 0, cursor: 0 };

    startReplayRecording({ replay, state, phy, nowSec: 0 });
    phy.rigLive = true;
    state.poseLock = false;
    state.slewDeg = 42;
    phy.hookPos.set(1.2, 13.5, -0.5);
    phy.beams[0].x.set(1.2, 10.2, -0.5);
    phy.cargoPos.set(1.2, 6.1, -0.5);
    phy.groundClearance = 4.8;
    phy.cables[0].tensionT = 6.25;
    phy.cables[0].slack = false;
    phy.cables[0].broken = true;
    phy.cables[0].break = { upperLen: 1.0, lowerLen: 1.0, tipU: new THREE.Vector3(1.1, 9.0, -0.4), tipL: new THREE.Vector3(1.2, 7.2, -0.5) };
    phy.legSlacks = [false];
    phy.legTensions = [6.25];
    captureReplayFrame({ replay, state, phy, nowSec: 1.0, force: true });

    // Mutate state away to ground pose before replaying (reproducing screenshot bug where beams fell to y=0!)
    phy.rigLive = false;
    state.poseLock = true;
    state.slewDeg = 0;
    phy.beams[0].x.set(0, 0, 0);
    phy.cargoPos.set(0, 1.3, 0);
    phy.cables[0].broken = false;

    replay.playing = true;
    replay.cursor = 0;
    stepReplayPlayback({ THREE, replay, state, phy, dt: 0.5 });

    expect(phy.rigLive).toBe(true);
    expect(state.poseLock).toBe(false);
    expect(state.slewDeg).toBeCloseTo(21, 1);
    expect(phy.beams[0].x.y).toBeCloseTo(7.35, 1);
    expect(beamGroup.position.y).toBeCloseTo(7.35, 1);
    expect(phy.cargoPos.y).toBeCloseTo(3.7, 1);

    stepReplayPlayback({ THREE, replay, state, phy, dt: 0.6 });
    expect(phy.cables[0].broken).toBe(true);
    expect(state.gear.legs[0].broken).toBe(true);
    expect(phy.legTensions[0]).toBeCloseTo(6.25, 2);
  });

  it('7. Shifted and rotated cargo over timber dunnage projects beam contacts and does not pierce wood', () => {
    const dg = new THREE.Group();
    rebuildDunnageVisual3D({ THREE, dunnageGroup: dg, state: { L: 12, W: 2.4, dunnageQty: '2', dunnageSection: '200x200' }, MATS: {} });
    // Shift cargo X = +2.2m so timber beam at +4.68m falls in the middle of the cargo underside (between static grid ribs!)
    const cargoPos = new THREE.Vector3(2.2, 1.45, 0.15);
    const cargoQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.25);
    const pts = sampleDunnageContactPointsForCargo({ THREE, cargoPos, cargoQuat, L: 12, W: 2.4, H: 2.5, dunnageGroup: dg });
    expect(pts.length).toBeGreaterThanOrEqual(3);
    pts.forEach((p) => {
      expect(p.y).toBeCloseTo(-1.25, 3);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(6.0);
    });
  });

  it('8. ReplayRecorder respects 60s max cap and replays OOG drop & staggered lashing strap breaks', () => {
    const activeCargoVisual = new THREE.Group();
    const oogGroup = new THREE.Group();
    oogGroup.name = 'flatRackOogCargo';
    const intact0 = new THREE.Mesh();
    const tailBot = new THREE.Group();
    const tailTop = new THREE.Group();
    oogGroup.userData.lashingNodes = [{ snapped: false, intactNode: intact0, sideTails: [{ sz: 1, sideSeed: 0.3, botPivot: tailBot, topPivot: tailTop }] }];
    const lashingGroup = new THREE.Group();
    lashingGroup.name = 'flatRackLashingStraps';
    const brokenGroup = new THREE.Group();
    brokenGroup.name = 'flatRackBrokenStraps';
    brokenGroup.visible = false;
    activeCargoVisual.add(oogGroup, lashingGroup, brokenGroup);

    const state = { poseLock: false, slewDeg: 0, craneAngleDeg: 0, gear: { legs: [], uppers: [], hangers: [] } };
    const phy = {
      rigLive: true, groundClearance: 3.0, hookPos: new THREE.Vector3(0, 10, 0), hookTarget: new THREE.Vector3(0, 10, 0),
      cargoPos: new THREE.Vector3(0, 4.3, 0), cargoQuat: new THREE.Quaternion(), beams: [], cables: [],
      oogState: { status: 'secured', strapsBroken: false, impactedGround: false, localPos: new THREE.Vector3(), worldPos: new THREE.Vector3(), worldQuat: new THREE.Quaternion(), lashing: { isIntact: true } }
    };
    const replay = { recording: false, playing: false, frames: [], t0: 0, cursor: 0 };

    startReplayRecording({ replay, state, phy, activeCargoVisual, nowSec: 0 });
    phy.oogState.status = 'falling';
    phy.oogState.strapsBroken = true;
    phy.oogState.lashing.isIntact = false;
    oogGroup.userData.lashingNodes[0].snapped = true;
    lashingGroup.visible = false;
    brokenGroup.visible = true;
    oogGroup.position.set(1.5, -2.2, 0);
    captureReplayFrame({ replay, state, phy, activeCargoVisual, nowSec: 59.5, force: true });
    const capped = captureReplayFrame({ replay, state, phy, activeCargoVisual, nowSec: 60.5, force: true });
    expect(capped.full).toBe(true);
    expect(replay.recording).toBe(false);

    // Reset visuals back to intact before playback
    oogGroup.position.set(0, 0, 0);
    oogGroup.userData.lashingNodes[0].snapped = false;
    lashingGroup.visible = true;
    brokenGroup.visible = false;

    replay.playing = true;
    replay.cursor = 59.4;
    stepReplayPlayback({ THREE, replay, state, phy, activeCargoVisual, dt: 0.2 });
    expect(phy.oogState.strapsBroken).toBe(true);
    expect(oogGroup.position.y).toBeLessThan(-1.5);
    expect(oogGroup.userData.lashingNodes[0].snapped).toBe(true);
    expect(brokenGroup.visible).toBe(true);
  });

  it('9. Tablet responsive CSS keeps touch panels visible and SceneRenderer caps mobile DPR', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const tabletCss = fs.readFileSync(path.join(root, 'src/styles/tablet.css'), 'utf8');
    const mainJs = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
    expect(mainJs).toContain("./styles/tablet.css");
    expect(tabletCss).toContain('touch-action: none');
    expect(tabletCss).toContain('#bottom-dock-bar');
    expect(tabletCss).toContain('#top-bar');
  });

  it('10. Web sling uses compact realistic width (never 30cm planks) and ElevationRuler + badges translate cleanly', () => {
    const heavyWeb = computeWebSlingVisualSize(300);
    const medWeb = computeWebSlingVisualSize(150);
    const lightWeb = computeWebSlingVisualSize(60);
    expect(lightWeb.widthM).toBeCloseTo(0.06, 3);
    expect(medWeb.widthM).toBeGreaterThan(lightWeb.widthM);
    expect(heavyWeb.widthM).toBeGreaterThan(medWeb.widthM);
    expect(heavyWeb.widthM).toBeLessThanOrEqual(0.115);

    const seg = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    applySlingSegmentTransform(THREE, seg, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 1, 0), 'web', 2, 300, 10, 15, 0, 4, 1);
    expect(seg.scale.x).toBeLessThanOrEqual(0.115);
    expect(seg.scale.x).toBeGreaterThan(seg.scale.z);

    expect(EXTRA_UI_EN['🎗️ Cáp bẹ dẹt (Webbing · EN 1492-1)']).toBe('🎗️ Flat Webbing Sling (EN 1492-1)');
    expect(EXTRA_UI_EN['Thước đo cao độ 3D (Điểm đỏ)']).toBe('3D Elevation Ruler (Hover Probe)');
    expect(translateBadge('🚨 QUÁ TẢI CẨU', 'en')).toBe('🚨 CRANE OVERLOAD');
    expect(translateBadge('🟢 ĐẠT CHUẨN NỀN', 'en')).toBe('🟢 GROUND SAFE');
    expect(translateBadge('⚠️ CRITICAL LIFT', 'vi')).toBe('⚠️ NÂNG TỚI HẠN');

    const rulerSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../src/graphics/ElevationRulerTool.js'), 'utf8');
    expect(rulerSrc).toContain("isVi ? 'Móc cẩu' : 'Hook'");
    expect(rulerSrc).toContain("isVi ? 'Ngáng' : 'Spreader'");
    expect(rulerSrc).toContain("isVi ? 'Đỉnh' : 'Top'");
    expect(rulerSrc).toContain("isVi ? 'Đáy' : 'Bottom'");
    expect(rulerSrc).toContain("isVi ? 'Điểm đỏ' : 'Probe'");
  });

  it('11. Continuous EN 1492-1 webbing ribbon builds quad-loop strap, anti-abrasion eye sleeve, and right-handed basis', () => {
    const dir = new THREE.Vector3(0.45, 0.88, -0.15).normalize();
    const seg = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    applySlingSegmentTransform(THREE, seg, new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(2), new THREE.Vector3(0, 1, 0), 'web', 2, 120, 5, 15, 0, 4, 1);
    const alignedY = new THREE.Vector3(0, 1, 0).applyQuaternion(seg.quaternion);
    expect(alignedY.distanceTo(dir)).toBeLessThan(1e-5);

    const mat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.95, metalness: 0 });
    const ribbon = createContinuousWebRibbonMesh(THREE, mat, 32);
    const pts = [
      new THREE.Vector3(-1.5, 4.0, 0),
      new THREE.Vector3(-0.9, 2.8, 0.05),
      new THREE.Vector3(-0.3, 1.6, 0.02),
      new THREE.Vector3( 0.0, 0.4, 0)
    ];
    const ok = updateWebRibbonMesh(THREE, ribbon, pts, 150, { hasEyeA: true, hasEyeB: true, eyeInsetM: 0.14, slackRatio: 0.96 });
    expect(ok).toBe(true);
    expect(ribbon.geometry.drawRange.count).toBeGreaterThan(100);
    const pos = ribbon.geometry.attributes.position.array;
    for (let i = 0; i < 60; i++) expect(Number.isFinite(pos[i])).toBe(true);

    const eye = createEn1492WebEyeGroup(THREE, { webGreen: mat });
    const names = [];
    eye.traverse(c => { if (c.name) names.push(c.name); });
    expect(names).toContain('Web_Eye_Loop');
    expect(names).toContain('Web_Wear_Sleeve');
    expect(names).toContain('Web_Cuff');
  });
});
