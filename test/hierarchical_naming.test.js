import { describe, expect, it } from 'vitest';
import {
  assignHierarchicalNames,
  syncHierarchicalNamesToGear,
  resolveCableLabel
} from '../src/rigging/HierarchicalNaming.js';
import { createHeadlessSim } from './sim_test_harness.js';

const hookEnd = () => ({ kind: 'hook' });
const bodyEnd = (id, x, y = 0, z = 0) => ({ kind: 'body', id, local: [x, y, z] });
const cargoEnd = (idx) => ({ kind: 'cargo', index: idx });

describe('Hierarchical Rigging Naming Convention (Load Path Tree)', () => {
  it('(a) names 4-leg direct hook slings sequentially LP1..LP4 with parent HOOK', () => {
    const cables = [0, 1, 2, 3].map((i) => ({ role: 'leg', index: i, a: hookEnd(), b: cargoEnd(i) }));
    assignHierarchicalNames(cables);
    expect(cables.map((c) => c.name)).toEqual(['LP1', 'LP2', 'LP3', 'LP4']);
    cables.forEach((c) => {
      expect(c.parentId).toBe('hook');
      expect(c.parentName).toBe('HOOK');
      expect(c.tier).toBe(1);
    });
  });

  it('(b) Spreader 2+4 gives LP1/LP2 uppers and LP11, LP12 / LP21, LP22 lower legs', () => {
    const cables = [
      { role: 'upper', index: 0, a: hookEnd(), b: bodyEnd('main', -3, 0.2, 0) },
      { role: 'upper', index: 1, a: hookEnd(), b: bodyEnd('main', 3, 0.2, 0) },
      { role: 'leg', index: 0, a: bodyEnd('main', 3, -0.2, 0.06), b: cargoEnd(0) },
      { role: 'leg', index: 1, a: bodyEnd('main', -3, -0.2, 0.06), b: cargoEnd(1) },
      { role: 'leg', index: 2, a: bodyEnd('main', -3, -0.2, -0.06), b: cargoEnd(2) },
      { role: 'leg', index: 3, a: bodyEnd('main', 3, -0.2, -0.06), b: cargoEnd(3) }
    ];
    const res = assignHierarchicalNames(cables);
    expect(res.byRoleIndex['upper:0']).toBe('LP1');
    expect(res.byRoleIndex['upper:1']).toBe('LP2');
    // Left beam end (upper:0 = LP1) owns leg 1 -> LP11 & leg 2 -> LP12
    expect(res.byRoleIndex['leg:1']).toBe('LP11');
    expect(res.byRoleIndex['leg:2']).toBe('LP12');
    // Right beam end (upper:1 = LP2) owns leg 0 -> LP21 & leg 3 -> LP22
    expect(res.byRoleIndex['leg:0']).toBe('LP21');
    expect(res.byRoleIndex['leg:3']).toBe('LP22');

    const leftLeg = cables.find((c) => c.role === 'leg' && c.index === 1);
    expect(leftLeg.parentId).toBe('upper:0');
    expect(leftLeg.parentName).toBe('LP1');
    expect(leftLeg.tier).toBe(2);
  });

  it('(c) handles 3-tier cascaded spreaders (LP1 -> LP11, LP12 -> LP111, LP121)', () => {
    const cables = [
      { role: 'upper', index: 0, a: hookEnd(), b: bodyEnd('top', -4, 0.2, 0) },
      { role: 'upper', index: 1, a: hookEnd(), b: bodyEnd('top', 4, 0.2, 0) },
      { role: 'hanger', index: 0, a: bodyEnd('top', 4, -0.2, 0.06), b: bodyEnd('lowPlus', 0, 0.18, 1.2) },
      { role: 'hanger', index: 1, a: bodyEnd('top', 4, -0.2, -0.06), b: bodyEnd('lowPlus', 0, 0.18, -1.2) },
      { role: 'hanger', index: 2, a: bodyEnd('top', -4, -0.2, 0.06), b: bodyEnd('lowMinus', 0, 0.18, 1.2) },
      { role: 'hanger', index: 3, a: bodyEnd('top', -4, -0.2, -0.06), b: bodyEnd('lowMinus', 0, 0.18, -1.2) },
      { role: 'leg', index: 0, a: bodyEnd('lowPlus', 0, -0.18, 1.2), b: cargoEnd(0) },
      { role: 'leg', index: 1, a: bodyEnd('lowMinus', 0, -0.18, 1.2), b: cargoEnd(1) },
      { role: 'leg', index: 2, a: bodyEnd('lowMinus', 0, -0.18, -1.2), b: cargoEnd(2) },
      { role: 'leg', index: 3, a: bodyEnd('lowPlus', 0, -0.18, -1.2), b: cargoEnd(3) }
    ];
    const res = assignHierarchicalNames(cables);
    expect(res.byRoleIndex['upper:0']).toBe('LP1');
    expect(res.byRoleIndex['hanger:2']).toBe('LP11');
    expect(res.byRoleIndex['hanger:3']).toBe('LP12');
    expect(res.byRoleIndex['leg:1']).toBe('LP111');
    expect(res.byRoleIndex['leg:2']).toBe('LP121');
    expect(res.byRoleIndex['upper:1']).toBe('LP2');
    expect(res.byRoleIndex['hanger:0']).toBe('LP21');
    expect(res.byRoleIndex['hanger:1']).toBe('LP22');
    expect(res.byRoleIndex['leg:0']).toBe('LP211');
    expect(res.byRoleIndex['leg:3']).toBe('LP221');
  });

  it('(d) supports 4-tier inline-8 deep hierarchy (LP1 -> LP11 -> LP111 -> LP1111)', () => {
    const cables = [
      { role: 'upper', index: 0, a: hookEnd(), b: bodyEnd('top', -5, 0.2, 0) },
      { role: 'hanger', index: 0, a: bodyEnd('top', -5, -0.2, 0), b: bodyEnd('midM', 0, 0.2, 0) },
      { role: 'hanger', index: 1, a: bodyEnd('midM', -2, -0.2, 0), b: bodyEnd('subA', 0, 0.2, 0) },
      { role: 'leg', index: 0, a: bodyEnd('subA', -0.8, -0.2, 0), b: cargoEnd(0) },
      { role: 'leg', index: 1, a: bodyEnd('subA', 0.8, -0.2, 0), b: cargoEnd(1) }
    ];
    const res = assignHierarchicalNames(cables);
    expect(res.byRoleIndex['upper:0']).toBe('LP1');
    expect(res.byRoleIndex['hanger:0']).toBe('LP11');
    expect(res.byRoleIndex['hanger:1']).toBe('LP111');
    expect(res.byRoleIndex['leg:0']).toBe('LP1111');
    expect(res.byRoleIndex['leg:1']).toBe('LP1112');
  });

  it('(e) H-Beam direct_hook assigns LP1 center upper and LP11..LP14 lower legs & syncs gear', () => {
    const cables = [
      { role: 'upper', index: 0, a: hookEnd(), b: bodyEnd('main', 0, 0.3, 0) },
      { role: 'leg', index: 0, a: bodyEnd('main', 2, -0.2, 1), b: cargoEnd(0) },
      { role: 'leg', index: 1, a: bodyEnd('main', -2, -0.2, 1), b: cargoEnd(1) },
      { role: 'leg', index: 2, a: bodyEnd('main', -2, -0.2, -1), b: cargoEnd(2) },
      { role: 'leg', index: 3, a: bodyEnd('main', 2, -0.2, -1), b: cargoEnd(3) }
    ];
    assignHierarchicalNames(cables);
    const state = { gear: { uppers: [{}], hangers: [], legs: [{}, {}, {}, {}], shackles: [{}, {}, {}, {}] } };
    syncHierarchicalNamesToGear(cables, state);
    expect(resolveCableLabel('upper', 0, state, { cables })).toBe('LP1');
    expect([0, 1, 2, 3].map((i) => resolveCableLabel('leg', i, state, { cables }))).toEqual(['LP11', 'LP12', 'LP13', 'LP14']);
    expect(state.gear.shackles[2].hierarchicalName).toBe('LP13');
    expect(state.gear.legs[2].parentName).toBe('LP1');
  });

  it('(f) headless 3D sim assigns Spreader & Cascaded hierarchical names to cables and syncs gear state', () => {
    const sim = createHeadlessSim();
    const st = sim.getState();
    const phy = sim.getPhy();

    // 1. Spreader 2 uppers + 4 legs
    st.beamType = 'spreader';
    sim.rebuildCargoAndRig(false);
    const upNames = phy.cables.filter((c) => c.role === 'upper').map((c) => c.name).sort();
    const legNames = phy.cables.filter((c) => c.role === 'leg').map((c) => c.name).sort();
    expect(upNames).toEqual(['LP1', 'LP2']);
    expect(legNames).toEqual(['LP11', 'LP12', 'LP21', 'LP22']);
    expect(st.gear.legs[0].hierarchicalName).toMatch(/^LP[12][12]$/);
    expect(st.gear.legs[0].parentName).toMatch(/^LP[12]$/);

    // 2. Cascaded 3-tier (upper -> hanger -> leg)
    st.beamType = 'cascaded';
    sim.rebuildCargoAndRig(false);
    const casLegs = phy.cables.filter((c) => c.role === 'leg').map((c) => c.name).sort();
    expect(casLegs).toEqual(['LP111', 'LP121', 'LP211', 'LP221']);
  });
});
