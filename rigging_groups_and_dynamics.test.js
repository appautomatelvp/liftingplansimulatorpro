import { describe, test, expect } from 'vitest';
import {
    RIGGING_EQUIPMENT_CATALOG,
    getRiggingEquipmentGroup,
    ElasticSlingEngine,
    EngineeringEngine
} from './src/core/index.js';
import { RiggingPlanner } from './src/core/RiggingPlanner.js';
import { SimulationEngine } from './src/core/SimulationEngine.js';

describe('Eight rigging groups and lifting dynamics', () => {
    test('1. All eight standardized groups are present in the production data model', () => {
        const groups = Object.values(RIGGING_EQUIPMENT_CATALOG);
        expect(groups).toHaveLength(8);
        expect(getRiggingEquipmentGroup('wire_rope_sling').group).toBe(1);
        expect(getRiggingEquipmentGroup('safety_bolt_shackle').group).toBe(2);
        expect(getRiggingEquipmentGroup('swivel_hoist_ring').group).toBe(3);
        expect(getRiggingEquipmentGroup('grab_hook').group).toBe(4);
        expect(getRiggingEquipmentGroup('equalizer_beam').group).toBe(5);
        expect(getRiggingEquipmentGroup('corner_protector').group).toBe(6);
        expect(getRiggingEquipmentGroup('tank_container').group).toBe(7);
        expect(getRiggingEquipmentGroup('overheight_spreader').group).toBe(8);
    });

    test('2. Spreader and lifting beam retain different mechanical roles', () => {
        const mechanics = RIGGING_EQUIPMENT_CATALOG.beams_and_spreaders.mechanics;
        expect(mechanics.spreader_beam).toBe('axial_compression');
        expect(mechanics.lifting_beam).toBe('bending');
        expect(mechanics.equalizer_beam).toBe('load_sharing_by_lever_arm');
    });

    test('3. Sling elasticity follows ΔL = T·L/(E·A), with webbing stretching more than IWRC', () => {
        const engine = new ElasticSlingEngine();
        const wire = engine.calculateElongation(12, 6, 'wire_rope_sling', 22);
        const web = engine.calculateElongation(12, 6, 'webbing_sling', 60);
        expect(wire.deltaL_mm).toBeGreaterThan(0);
        expect(web.deltaL_mm).toBeGreaterThan(wire.deltaL_mm);
        expect(wire.stretchedLengthM).toBeGreaterThan(wire.nominalLengthM);
    });

    test('4. Eccentric CoG load shares asymmetrically and an equalizer/grab-hook trim identifies the heavy side', () => {
        const balance = ElasticSlingEngine.calculateEqualizerBalance(40, 0.6, 6);
        expect(balance.rightShareT).toBeGreaterThan(balance.leftShareT);
        expect(balance.heavySide).toBe('right');
        expect(balance.grabHookTrimM).toBeCloseTo(1.2, 6);
        expect(balance.isWithinPickSpan).toBe(true);
    });

    test('5. Angle, dynamic factor and SWL utilization generate the required warnings', () => {
        expect(ElasticSlingEngine.evaluateSlingAngle(25).severity).toBe('CRITICAL');
        expect(ElasticSlingEngine.evaluateSlingAngle(40).severity).toBe('WARNING');
        expect(ElasticSlingEngine.dynamicLoadFactor(4, 0.8)).toBeGreaterThan(1);

        const overload = EngineeringEngine.evaluateRiggingSafety({
            grossWeight: 40, nominalLegs: 2, alphaDeg: 35, ratedWllPerLeg: 15, isRigidLoad: false
        });
        expect(overload.isOverloaded).toBe(true);
        expect(overload.utilizationPct).toBeGreaterThan(100);
    });

    test('6. An unprotected sharp edge derates web/round slings in the actual constraint MBL', () => {
        const bare = ElasticSlingEngine.evaluateSharpEdgeProtection('webbing_sling', false, true);
        const protectedSling = ElasticSlingEngine.evaluateSharpEdgeProtection('webbing_sling', true, true);
        expect(bare.effectiveMblFactor).toBeLessThan(1);
        expect(bare.isCritical).toBe(true);
        expect(protectedSling.effectiveMblFactor).toBe(1);

        const planner = new RiggingPlanner();
        const exposedPlan = planner.exportRiggingPlanJSON();
        exposedPlan.rigging.lowerLegs.forEach(leg => {
            leg.cableType = 'webbing_sling';
            leg.edgeExposed = true;
            leg.hasCornerProtector = false;
        });
        const protectedPlan = structuredClone(exposedPlan);
        protectedPlan.rigging.lowerLegs.forEach(leg => { leg.hasCornerProtector = true; });
        const exposedSim = new SimulationEngine();
        const protectedSim = new SimulationEngine();
        exposedSim.initializeFromPlan(exposedPlan);
        protectedSim.initializeFromPlan(protectedPlan);
        expect(exposedSim.constraints.lowerLegs[0].edgeFactor).toBe(0.35);
        expect(exposedSim.constraints.lowerLegs[0].mblN).toBeCloseTo(protectedSim.constraints.lowerLegs[0].mblN * 0.35, 6);
    });
});
