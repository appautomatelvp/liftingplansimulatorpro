import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PBRMaterialFactory } from '../src/graphics/PBRMaterialFactory.js';
import { EnvironmentManager, LIGHTING_PRESETS } from '../src/graphics/EnvironmentManager.js';
import { createHorizonSkyDome, updateHorizonSkyDome } from '../src/graphics/HorizonSkyDome.js';
import { QUALITY_TIERS } from '../src/graphics/SceneRenderer.js';

describe('AAA Graphics Pipeline & PBR Material Engine', () => {
    let factory;

    beforeEach(() => {
        factory = new PBRMaterialFactory();
    });

    it('creates procedural Quay Concrete PBR material with expansion joints & correct color spaces', () => {
        const mat = factory.createQuayConcreteMaterial();
        expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(mat.map).toBeDefined();
        expect(mat.map.colorSpace).toBe(THREE.SRGBColorSpace);
        expect(mat.normalMap).toBeDefined();
        expect(mat.normalMap.colorSpace).toBe(THREE.NoColorSpace);
        expect(mat.roughnessMap).toBeDefined();
        expect(mat.aoMap).toBeDefined();
        expect(mat.roughness).toBeGreaterThanOrEqual(0.8);
    });

    it('creates procedural Wire Rope PBR material with helical IWRC steel strand normal map', () => {
        const ropeMat = factory.createWireRopeMaterial();
        expect(ropeMat).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(ropeMat.metalness).toBeGreaterThanOrEqual(0.85);
        expect(ropeMat.normalMap).toBeDefined();
        expect(ropeMat.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    });

    it('creates procedural Maritime Water PBR material with wave normal map', () => {
        const waterMat = factory.createMaritimeWaterMaterial();
        expect(waterMat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
        expect(waterMat.transparent).toBe(true);
        expect(waterMat.normalMap).toBeDefined();
        expect(waterMat.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    });

    it('generates 45-degree yellow/black hazard chevron texture', () => {
        const tex = factory.createHazardChevronTexture(6);
        expect(tex).toBeInstanceOf(THREE.CanvasTexture);
        expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
        expect(tex.wrapS).toBe(THREE.RepeatWrapping);
        expect(tex.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('enforces strict PBR compliance and shadows on arbitrary mesh hierarchies', () => {
        const group = new THREE.Group();
        const legacyMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0x334455 })
        );
        group.add(legacyMesh);

        factory.enforcePBRMaterials(group);

        expect(legacyMesh.castShadow).toBe(true);
        expect(legacyMesh.receiveShadow).toBe(true);
        expect(legacyMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    });

    it('exposes 5 photorealistic lighting & atmospheric presets with correct physical units', () => {
        const expectedPresets = ['overcast', 'sunset', 'night', 'liebherr_studio', 'print_plan'];
        expectedPresets.forEach(key => {
            const p = LIGHTING_PRESETS[key];
            expect(p).toBeDefined();
            expect(typeof p.sunIntensity).toBe('number');
            expect(typeof p.exposure).toBe('number');
            expect(Array.isArray(p.sunPosition)).toBe(true);
            expect(p.sunPosition.length).toBe(3);
        });
    });

    it('defines 4 graphics quality tiers covering ultra, high, studio, and performance', () => {
        expect(QUALITY_TIERS.ultra).toBeDefined();
        expect(QUALITY_TIERS.ultra.shadowMapSize).toBe(4096);
        expect(QUALITY_TIERS.ultra.aoEnabled).toBe(true);

        expect(QUALITY_TIERS.high).toBeDefined();
        expect(QUALITY_TIERS.high.shadowMapSize).toBe(4096);

        expect(QUALITY_TIERS.studio).toBeDefined();
        expect(QUALITY_TIERS.studio.maxDPR).toBe(2.0);

        expect(QUALITY_TIERS.performance).toBeDefined();
        expect(QUALITY_TIERS.performance.bypassComposer).toBe(true);
    });

    it('creates HorizonSkyDome with distant cumulus/cirrus cloud shader uniforms and updates atmosphere colors', () => {
        const scene = new THREE.Scene();
        const dome = createHorizonSkyDome(scene);
        expect(dome.material.uniforms.uCloudLightColor).toBeDefined();
        expect(dome.material.uniforms.uCloudShadeColor).toBeDefined();
        expect(dome.material.uniforms.uCloudOpacity.value).toBeGreaterThan(0.5);
        expect(dome.material.fragmentShader).toContain('fbm4');

        updateHorizonSkyDome(dome, scene, null, {
            skyColor: 0x163b7a,
            midSkyColor: 0xc26e52,
            horizonColor: 0xf08c36,
            cloudLightColor: 0xffc478,
            cloudShadeColor: 0x48567d,
            cloudOpacity: 0.86
        });
        expect(dome.material.uniforms.uSkyColor.value.getHex()).toBe(0x163b7a);
        expect(dome.material.uniforms.uCloudLightColor.value.getHex()).toBe(0xffc478);
        expect(dome.material.uniforms.uCloudOpacity.value).toBeCloseTo(0.86, 2);
    });
});
