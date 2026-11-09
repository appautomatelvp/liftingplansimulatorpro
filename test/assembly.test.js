import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AssemblyEngine, COMPOSITE_PRESETS } from '../src/core/AssemblyEngine.js';
import { AssetLoaders } from '../src/core/AssetLoaders.js';

describe('3D Composite & Assembly Engine (CAE Physics & OBJ Standard)', () => {
    it('1. Initializes and loads Flat Rack + Transformer composite preset', () => {
        const engine = new AssemblyEngine();
        const success = engine.loadPreset('flatrack_transformer');

        expect(success).toBe(true);
        expect(engine.basePart).toBeDefined();
        expect(engine.basePart.type).toBe('flatrack');
        expect(engine.cargoParts.length).toBe(1);
        expect(engine.cargoParts[0].type).toBe('transformer');

        const physics = engine.computePhysics();
        // Flatrack 5.5T + Transformer 45T = 50.5T
        expect(physics.totalMass).toBeCloseTo(50.5, 1);
        expect(physics.partCount).toBe(2);
        expect(physics.anchors.length).toBe(4);
    });

    it('2. Computes physics moment equilibrium & combined Center of Gravity (CoG)', () => {
        const engine = new AssemblyEngine();
        engine.reset();

        // Base: Platform Container (Mass: 4T, at Y = 0)
        engine.basePart = {
            id: 'base_1',
            type: 'platform',
            dimensions: { L: 6.0, W: 2.4, H: 0.35 },
            massT: 4.0,
            pos: { x: 0, y: 0, z: 0 }
        };

        // Cargo 1: Heavy crate on left (Mass: 10T, at X = -1.5m, Y = 1.0m)
        engine.addPart({
            name: 'Crate A',
            type: 'crate',
            dimensions: { L: 2.0, W: 2.0, H: 1.5 },
            massT: 10.0,
            pos: { x: -1.5, y: 1.0, z: 0 }
        });

        // Cargo 2: Lighter crate on right (Mass: 6T, at X = +1.5m, Y = 1.0m)
        engine.addPart({
            name: 'Crate B',
            type: 'crate',
            dimensions: { L: 2.0, W: 2.0, H: 1.5 },
            massT: 6.0,
            pos: { x: 1.5, y: 1.0, z: 0 }
        });

        const physics = engine.computePhysics();
        // Total mass = 4 + 10 + 6 = 20T
        expect(physics.totalMass).toBeCloseTo(20.0, 1);

        // Expected CoG X: (4*0 + 10*(-1.5) + 6*(1.5)) / 20 = (-15 + 9) / 20 = -6 / 20 = -0.30m
        expect(physics.cog.x).toBeCloseTo(-0.30, 2);

        // Expected CoG Y: (4*0 + 10*1.0 + 6*1.0) / 20 = 16 / 20 = 0.80m
        expect(physics.cog.y).toBeCloseTo(0.80, 2);
    });

    it('3. Snap to deck sets cargo elevation exactly flush on the carrier surface', () => {
        const engine = new AssemblyEngine();
        engine.basePart = {
            id: 'base_flatrack',
            type: 'flatrack',
            dimensions: { L: 6.06, W: 2.44, H: 2.59 },
            massT: 5.5,
            pos: { x: 0, y: 0, z: 0 }
        };

        const part = engine.addPart({
            name: 'Heavy Trafo',
            type: 'transformer',
            dimensions: { L: 3.5, W: 2.0, H: 2.0 },
            massT: 40.0,
            pos: { x: 0, y: 5.0, z: 0 } // initially floating high in air
        });

        engine.snapPartToDeck(part.id);

        // Deck elevation = -2.59 / 2 + 0.48 = -1.295 + 0.48 = -0.815m
        // Part half height = 2.0 / 2 = 1.0m
        // Expected part.pos.y = -0.815 + 1.0 = 0.185m
        expect(part.pos.y).toBeCloseTo(0.185, 2);
    });

    it('4. Builds Three.js assembly group and exports standard Wavefront .OBJ with CAE Digital Twin header', () => {
        const engine = new AssemblyEngine();
        engine.loadPreset('flatrack_transformer');

        const group = engine.buildAssemblyGroup();
        expect(group.children.length).toBe(2);

        const physics = engine.computePhysics();
        const objText = engine.exportToOBJ(group, {
            name: engine.assemblyName,
            dimensions: physics.totalDims,
            weight: physics.totalMass,
            cog: physics.cog
        });

        expect(objText).toContain('# CAE INDUSTRIAL DIGITAL TWIN SPECIFICATION');
        expect(objText).toContain('# ASSET_NAME: Flat Rack 20ft + Máy Biến Áp Điện Lực');
        expect(objText).toContain('# SPEC_KEY: composite_cargo');
        expect(objText).toContain('# GROSS_WEIGHT_T: 50.50');
        expect(objText).toContain('# COMPONENT_COUNT: 2');
        expect(objText).toContain('v '); // vertex lines
        expect(objText).toContain('f '); // face lines
    });

    it('5. Round-trip header parser correctly recovers engineering parameters from OBJ comment header', () => {
        const sampleOBJ = [
            '# ==============================================================================',
            '# CAE INDUSTRIAL DIGITAL TWIN SPECIFICATION - LIFTING PLAN SIMULATOR PRO',
            '# ASSET_NAME: FlatRack_Loaded_Custom_Skid',
            '# SPEC_KEY: composite_cargo',
            '# DIMENSIONS_LWH: 12.190,3.250,2.440',
            '# GROSS_WEIGHT_T: 48.75',
            '# COG_OFFSET_XYZ: 0.150,0.850,-0.050',
            '# COMPONENT_COUNT: 3',
            '# ==============================================================================',
            'o Mesh_1',
            'v 0 0 0',
            'v 1 0 0',
            'v 1 1 0',
            'f 1 2 3'
        ].join('\n');

        const meta = AssemblyEngine.parseCAEHeader(sampleOBJ);
        expect(meta).not.toBeNull();
        expect(meta.name).toBe('FlatRack_Loaded_Custom_Skid');
        expect(meta.dimensions.L).toBeCloseTo(12.19, 2);
        expect(meta.dimensions.H).toBeCloseTo(3.25, 2);
        expect(meta.dimensions.W).toBeCloseTo(2.44, 2);
        expect(meta.weight).toBeCloseTo(48.75, 2);
        expect(meta.cog.x).toBeCloseTo(0.15, 2);
        expect(meta.cog.y).toBeCloseTo(0.85, 2);
        expect(meta.cog.z).toBeCloseTo(-0.05, 2);
    });

    it('6. Full End-to-End: Exports an assembly to OBJ and loads it back via AssetLoaders with exact metadata', async () => {
        const engine = new AssemblyEngine();
        engine.loadPreset('platform_excavator');
        const group = engine.buildAssemblyGroup();
        const phy = engine.computePhysics();

        const exportedOBJ = engine.exportToOBJ(group, {
            name: engine.assemblyName,
            dimensions: phy.totalDims,
            weight: phy.totalMass,
            cog: phy.cog
        });

        const loaders = new AssetLoaders();
        const loadedResult = await loaders.parseData(exportedOBJ, 'obj', {
            specKey: 'generic_cargo'
        });

        expect(loadedResult).toBeDefined();
        expect(loadedResult.root).toBeDefined();
        expect(loadedResult.report).toBeDefined();
        expect(loadedResult.report.caeHeader).toBeDefined();
        expect(loadedResult.report.caeHeader.name).toBe(engine.assemblyName);
        expect(loadedResult.report.caeHeader.weight).toBeCloseTo(phy.totalMass, 1);
        expect(loadedResult.report.dimensionsNormalized.x).toBeCloseTo(phy.totalDims.L, 0.5);
    });
});
