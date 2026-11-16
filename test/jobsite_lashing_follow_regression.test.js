// @purpose: Kiểm thử hồi quy 3D đà gỗ/độ dốc/tấm lót Tab 6, dây chằng Flat Rack ôm sát & đứt tự nhiên, và Camera Follow.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  CRANE_MAT_PRESETS,
  rebuildDunnageVisual3D,
  syncCraneOutriggerMats3D
} from '../src/graphics/JobsiteSiteVisuals.js';
import {
  computeTightStrapGeometry,
  computeStrapFailureOrder,
  buildTightFlatRackLashingVisuals,
  stepStaggeredLashingBreakPhysics,
  resetFlatRackLashingNodes
} from '../src/rigging/FlatRackLashingPhysics.js';
import { createHeadlessSim } from './sim_test_harness.js';

describe('Jobsite Tab 6 3D visuals (Timber Dunnage, Slope, Outrigger Mats)', () => {
  it('builds distinct 3D cribbing for qty 2/4/mat, wood/steel sections, soil pad and slope degrees', () => {
    const dunnageGroup = new THREE.Group();
    const state = { L: 6.06, W: 2.44, groundId: 'flat', dunnageQty: '2', dunnageSection: '200x200', dunnageWood: 'hardwood', dunnageLengthM: 3.0, cargoSoilType: 'concrete', groundSlopeDeg: 0 };

    rebuildDunnageVisual3D({ THREE, dunnageGroup, state, MATS: {} });
    expect(dunnageGroup.visible).toBe(true);
    const meshes2 = [];
    dunnageGroup.traverse(o => { if (o.isMesh) meshes2.push(o); });

    state.dunnageQty = 'mat';
    state.dunnageWood = 'steel_beam';
    state.groundId = 'rough';
    state.groundSlopeDeg = 4.5;
    rebuildDunnageVisual3D({ THREE, dunnageGroup, state, MATS: {} });
    const meshesMat = [];
    dunnageGroup.traverse(o => { if (o.isMesh) meshesMat.push(o); });
    expect(meshesMat.length).toBeGreaterThan(meshes2.length + 10);

    const asm = dunnageGroup.getObjectByName('DunnageSiteAssembly');
    expect(asm).toBeTruthy();
    expect(asm.rotation.z).toBeCloseTo(-THREE.MathUtils.degToRad(4.5), 4);
  });

  it('updates 4 crane outrigger mats dynamically for dish_only, timber and steel presets', () => {
    const craneVehicleGroup = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Group();
      slot.userData.isOutriggerMatSlot = true;
      craneVehicleGroup.add(slot);
    }

    expect(syncCraneOutriggerMats3D({ THREE, craneVehicleGroup, presetId: 'dish_only', MATS: {} })).toBe(4);
    expect(craneVehicleGroup.children.every(c => c.visible === false)).toBe(true);

    syncCraneOutriggerMats3D({ THREE, craneVehicleGroup, presetId: 'steel_mat_2_4x3', MATS: {} });
    expect(craneVehicleGroup.children.every(c => c.visible === true)).toBe(true);
    const box = new THREE.Box3().setFromObject(craneVehicleGroup.children[0]);
    const sz = box.getSize(new THREE.Vector3());
    expect(sz.x).toBeGreaterThanOrEqual(CRANE_MAT_PRESETS.steel_mat_2_4x3.w);
    expect(sz.z).toBeGreaterThanOrEqual(CRANE_MAT_PRESETS.steel_mat_2_4x3.l);
  });
});

describe('Flat Rack lashing tight hug & organic staggered rupture physics', () => {
  it('never protrudes horizontally beyond outer crate/deck rail and yields distinct staggered break thresholds', () => {
    const strapCount = 6;
    const W = 2.44;
    const cW = 2.38;
    for (let k = 0; k < strapCount; k++) {
      const g = computeTightStrapGeometry({
        cL: 11.4, cW, cH: 2.2, offsetX: 0, offsetZ: 0,
        cargoBottomY: 0.42, cargoTopY: 2.62, deckTopY: 0.30, W, strapCount, k
      });
      for (const s of g.sides) {
        expect(Math.abs(s.wallZ)).toBeLessThanOrEqual(cW * 0.5 + 0.04);
        expect(Math.abs(s.anchorZ)).toBeLessThanOrEqual(W * 0.5 - 0.04);
      }
    }

    const order = computeStrapFailureOrder({
      strapCount: 6,
      sxList: [-4, -2.4, -0.8, 0.8, 2.4, 4],
      gLocalX: 2.5,
      gLocalZ: 1.0,
      seed: 3.14
    });
    const thresholds = order.map(o => o.threshold);
    const uniqueCount = new Set(thresholds.map(t => t.toFixed(4))).size;
    expect(uniqueCount).toBeGreaterThanOrEqual(5);
  });

  it('snaps straps organically over progressive ticks rather than all on a single frame, then hides intact group', () => {
    const group = new THREE.Group();
    const oogGroup = new THREE.Group();
    oogGroup.name = 'flatRackOogCargo';
    group.add(oogGroup);
    const mat = new THREE.MeshStandardMaterial();
    const nodes = buildTightFlatRackLashingVisuals({
      THREE, oogGroup, group, MATS: { galvSteel: mat },
      dims: { cL: 10, cW: 2.35, cH: 2.0, offsetX: 0, offsetZ: 0, cargoBottomY: 0.4, cargoTopY: 2.4, deckTopY: 0.3, W: 2.44 }
    });
    expect(nodes.length).toBeGreaterThanOrEqual(4);

    const st = { status: 'sliding', strapsBroken: true, strapStress: 1.0, ruptureCascadeTimer: 0 };
    const snapEvents = [];
    const first = stepStaggeredLashingBreakPhysics({
      st, oogGroup, gLocal: { x: 2.2, y: -9.5, z: 0.4 }, dt: 0.016,
      lashingDemandN: 50000, lashingCapacityN: 40000,
      onStrapSnap: (n) => snapEvents.push(n.index)
    });
    expect(first.snappedCount).toBeGreaterThanOrEqual(1);
    expect(first.snappedCount).toBeLessThan(nodes.length);

    for (let i = 0; i < 30; i++) {
      stepStaggeredLashingBreakPhysics({
        st, oogGroup, gLocal: { x: 2.2, y: -9.5, z: 0.4 }, dt: 0.016,
        lashingDemandN: 50000, lashingCapacityN: 40000
      });
    }
    expect(oogGroup.getObjectByName('flatRackLashingStraps').visible).toBe(false);
    expect(group.getObjectByName('flatRackBrokenStraps').visible).toBe(true);

    resetFlatRackLashingNodes(group);
    expect(nodes.every(n => !n.snapped)).toBe(true);
    expect(group.getObjectByName('flatRackBrokenStraps').visible).toBe(false);
  });

  it('keeps headless Flat Rack lashing meshes tight within frame bounds without spikes', () => {
    const simApi = createHeadlessSim();
    const st = simApi.getState();
    st.cargoType = 'flatrack';
    st.L = 12.192;
    st.W = 2.438;
    st.H = 2.591;
    simApi.rebuildCargoAndRig(true);
    const vis = simApi.getCargoVisual();
    const oogGroup = vis.getObjectByName('flatRackOogCargo');
    const lash = vis.getObjectByName('flatRackLashingStraps');
    expect(lash).toBeTruthy();
    const meta = oogGroup.userData.oogMeta;
    const box = new globalThis.THREE.Box3().setFromObject(lash);
    const zHalf = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
    // Straps hug the OOG polyHood/cargo face flush without any horizontal outward bar protruding past cW/2 + 0.055
    expect(zHalf).toBeLessThanOrEqual(meta.cW * 0.5 + 0.075);
  });
});

describe('Camera Follow UI rename & pure tracking without unwanted zoom-in', () => {
  it('renames Auto camera button and labels to Follow and removes wantDist auto-zoom', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toContain('>Follow</button>');
    expect(html).not.toContain('id="btn-cam-cinema" type="button" class="pendant-btn !py-0.5 !px-1.5 text-[10px] font-bold whitespace-nowrap !bg-sky-700 !border-sky-400 !text-white" title="Auto');

    const camJs = fs.readFileSync(path.join(root, 'src/sim/library/reconstruction_export.js'), 'utf8');
    expect(camJs).not.toContain('Keep the baked boot/user angle — only very gentle distance breathe while hoisting');
    expect(camJs).toContain('track cargo world displacement cleanly without changing user zoom or angle');
    expect(camJs).toContain("if (behavior === 'lock' || behavior === 'cinema' || !cf.enabled) return false;");
  });
});
