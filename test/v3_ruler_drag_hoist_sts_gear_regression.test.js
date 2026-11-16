// @purpose: Kiểm thử hồi quy 6 nâng cấp mới: bỏ cục tời khi tắt cẩu 3D, kéo đặt thước 3D & bắt Điểm Đỏ cáp/ma ní, dblclick Hạ/Kéo, mở khóa chỉnh cáp, hết giật STS Direct.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createElevationRulerTool } from '../src/graphics/ElevationRulerTool.js';
import { pickBestElevationHoverPoint, buildRulerHoverInputs } from '../src/graphics/ElevationRulerMath.js';
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
});
