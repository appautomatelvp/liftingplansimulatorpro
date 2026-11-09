/**
 * ============================================================================
 * ENVIRONMENT & ADVANCED LIGHTING MANAGER (EnvironmentManager.js)
 * Architecture: Photorealistic IBL (Image-Based Lighting) & Atmospheric Port Engine
 * Three.js Version: r170+ (RGBELoader, EXRLoader, PMREMGenerator, Physical Optics)
 * ============================================================================
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export const LIGHTING_PRESETS = {
    liebherr_studio: {
        id: 'liebherr_studio',
        name: 'Engineering Studio (Phòng Thử Tải Kỹ Thuật)',
        skyColor: 0x161d29,
        horizonColor: 0x1e293b,
        sunColor: 0xffffff,
        sunIntensity: 2.35,
        sunPosition: [20, 38, 24],
        fillColor: 0x60a5fa,
        fillIntensity: 0.72,
        fogDensity: 0.0005,
        exposure: 1.18,
        envIntensity: 1.18,
        backgroundBlur: 0.25,
        solidBackground: 0x131924
    },
    overcast: {
        id: 'overcast',
        name: 'Daylight Test Pad (Sân Bê Tông Ban Ngày)',
        skyColor: 0x64748b,
        horizonColor: 0x94a3b8,
        sunColor: 0xfffbeb,
        sunIntensity: 2.4,
        sunPosition: [24, 44, 28],
        fillColor: 0x93c5fd,
        fillIntensity: 0.78,
        fogDensity: 0.0006,
        exposure: 1.16,
        envIntensity: 1.1,
        backgroundBlur: 0.15,
        solidBackground: 0x1e293b
    },
    print_plan: {
        id: 'print_plan',
        name: 'Lift Plan CAD Sheet (Bản Vẽ ASME Nền Sáng)',
        skyColor: 0xf1f5f9,
        horizonColor: 0xe2e8f0,
        sunColor: 0xffffff,
        sunIntensity: 1.65,
        sunPosition: [20, 48, 22],
        fillColor: 0xcbd5e1,
        fillIntensity: 0.85,
        fogDensity: 0.0002,
        exposure: 1.06,
        envIntensity: 0.95,
        backgroundBlur: 0.0,
        solidBackground: 0xeef2f6
    },
    sunset: {
        id: 'sunset',
        name: 'Warm Industrial Bay (Ánh Sáng Xưởng Ấm)',
        skyColor: 0x292524,
        horizonColor: 0x44403c,
        sunColor: 0xfed7aa,
        sunIntensity: 2.6,
        sunPosition: [32, 26, 28],
        fillColor: 0x38bdf8,
        fillIntensity: 0.55,
        fogDensity: 0.0008,
        exposure: 1.2,
        envIntensity: 1.15,
        backgroundBlur: 0.2,
        solidBackground: 0x1c1917
    },
    night: {
        id: 'night',
        name: 'High-Contrast Inspection (Tương Phản Cao)',
        skyColor: 0x090d16,
        horizonColor: 0x0f172a,
        sunColor: 0xe2e8f0,
        sunIntensity: 1.9,
        sunPosition: [-18, 36, 22],
        fillColor: 0x38bdf8,
        fillIntensity: 0.5,
        fogDensity: 0.0008,
        exposure: 1.22,
        envIntensity: 0.95,
        backgroundBlur: 0.2,
        solidBackground: 0x090d16
    }
};

export class EnvironmentManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        this.rgbeLoader = new RGBELoader();
        this.exrLoader = new EXRLoader();
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();

        this.currentPresetId = 'liebherr_studio';
        this.currentHDREnvMap = null;
        this.sunLight = null;
        this.fillLight = null;
        this.nightSpotlights = [];

        this.initLights();
        this.applyPreset('liebherr_studio');
    }

    /**
     * Initializes Primary Sun DirectionalLight with 4096px PCFSoft Shadow Map.
     */
    initLights() {
        // 1. Primary Directional Sun / Key Light
        this.sunLight = new THREE.DirectionalLight(0xffffff, 2.35);
        this.sunLight.position.set(20, 38, 24);
        this.sunLight.castShadow = true;

        // Ultra High-Resolution 4096px Soft Shadows focused tightly on Rigging & Load
        this.sunLight.shadow.mapSize.set(4096, 4096);
        this.sunLight.shadow.camera.near = 2.0;
        this.sunLight.shadow.camera.far = 140.0;
        this.sunLight.shadow.camera.left = -26;
        this.sunLight.shadow.camera.right = 26;
        this.sunLight.shadow.camera.top = 26;
        this.sunLight.shadow.camera.bottom = -26;
        this.sunLight.shadow.bias = -0.00012;
        this.sunLight.shadow.normalBias = 0.016;

        this.scene.add(this.sunLight);

        // 2. Secondary Ambient / Fill Light
        this.fillLight = new THREE.DirectionalLight(0x60a5fa, 0.6);
        this.fillLight.position.set(-25, 20, -20);
        this.scene.add(this.fillLight);

        // 3. Subtle Base Ambient Light
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(this.ambientLight);
    }

    /**
     * Dynamically shifts shadow camera frustum center to focus on active lifting area.
     * Keeps 4096px resolution concentrated around the crane hook, load, and slings.
     *
     * @param {THREE.Vector3} focusPoint
     */
    updateShadowFrustum(focusPoint) {
        if (!this.sunLight || !focusPoint) return;
        if (this.sunLight.target.position.distanceToSquared(focusPoint) > 0.09) {
            this.sunLight.target.position.copy(focusPoint);
            this.sunLight.target.updateMatrixWorld();
        }
    }

    /**
     * Applies a predefined industrial lighting and atmospheric preset.
     */
    applyPreset(presetKey) {
        const preset = LIGHTING_PRESETS[presetKey] || LIGHTING_PRESETS.overcast;
        this.currentPresetId = preset.id;

        // Configure Sun & Fill
        this.sunLight.color.setHex(preset.sunColor);
        this.sunLight.intensity = preset.sunIntensity;
        this.sunLight.position.set(...preset.sunPosition);

        this.fillLight.color.setHex(preset.fillColor);
        this.fillLight.intensity = preset.fillIntensity;

        // Configure Atmospheric Fog
        this.scene.fog = new THREE.FogExp2(preset.horizonColor, preset.fogDensity);

        // Configure Exposure & Environment Intensity
        this.renderer.toneMappingExposure = preset.exposure;
        this.scene.environmentIntensity = preset.envIntensity;

        // If no external HDR loaded yet, generate high-fidelity procedural IBL
        if (!this.currentHDREnvMap) {
            this.generateProceduralSkyHDR(preset);
        } else {
            if (preset.solidBackground !== undefined) {
                this.scene.background = new THREE.Color(preset.solidBackground);
            } else {
                this.scene.background = this.currentHDREnvMap;
                this.scene.backgroundBlurriness = preset.backgroundBlur || 0.0;
            }
        }
    }

    /**
     * Loads an external .hdr or .exr file from URL or File/Blob object.
     *
     * @param {string|File|Blob} source URL path or browser File/Blob
     * @param {Object} [options]
     * @returns {Promise<THREE.Texture>}
     */
    async loadHDREnvironment(source, options = {}) {
        let url = source;
        let isBlobUrl = false;
        let fileName = typeof source === 'string' ? source : source.name || 'custom.hdr';

        if (source instanceof Blob || source instanceof File) {
            url = URL.createObjectURL(source);
            isBlobUrl = true;
        }

        const ext = fileName.split('?')[0].split('.').pop().toLowerCase();

        try {
            let texture;
            if (ext === 'exr') {
                texture = await this.exrLoader.loadAsync(url);
            } else {
                texture = await this.rgbeLoader.loadAsync(url);
            }

            const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
            texture.dispose();
            if (isBlobUrl) URL.revokeObjectURL(url);

            this.currentHDREnvMap = envMap;
            this.scene.environment = envMap;

            const preset = LIGHTING_PRESETS[this.currentPresetId];
            if (preset && preset.solidBackground !== undefined) {
                this.scene.background = new THREE.Color(preset.solidBackground);
            } else {
                this.scene.background = envMap;
                this.scene.backgroundBlurriness = options.blurriness || preset.backgroundBlur || 0.0;
            }

            console.info(`[EnvironmentManager] HDR Environment "${fileName}" loaded and filtered successfully.`);
            return envMap;
        } catch (err) {
            if (isBlobUrl) URL.revokeObjectURL(url);
            console.warn(`[EnvironmentManager] Failed to load external HDR "${fileName}":`, err.message);
            // Fall back gracefully to procedural HDR
            this.generateProceduralSkyHDR(LIGHTING_PRESETS[this.currentPresetId]);
            throw err;
        }
    }

    /**
     * Generates a high-dynamic-range (HDR) Equirectangular Studio/Port Sky Map procedurally.
     * Guarantees realistic metallic IBL reflections even if external HDR files are absent.
     */
    generateProceduralSkyHDR(preset) {
        const cvs = document.createElement('canvas');
        cvs.width = 1024;
        cvs.height = 512;
        const ctx = cvs.getContext('2d');

        // Vertical Sky Gradient (Zenith to Horizon to Sea/Ground reflection)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, cvs.height);
        const hexToStr = (h) => '#' + new THREE.Color(h).getHexString();

        skyGrad.addColorStop(0.0, hexToStr(preset.skyColor));
        skyGrad.addColorStop(0.48, hexToStr(preset.horizonColor));
        skyGrad.addColorStop(0.50, '#1a202c'); // Sea horizon line
        skyGrad.addColorStop(0.52, '#0f172a'); // Quayside dark ground reflection
        skyGrad.addColorStop(1.0, '#020617');

        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, cvs.width, cvs.height);

        // Radiant Sun Disc & Atmospheric Flare
        const sunX = (preset.sunPosition[0] / 50 + 0.5) * cvs.width;
        const sunY = (1.0 - (preset.sunPosition[1] / 60)) * (cvs.height * 0.5);

        const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 180);
        sunGlow.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        sunGlow.addColorStop(0.08, hexToStr(preset.sunColor));
        sunGlow.addColorStop(0.35, 'rgba(254, 215, 170, 0.4)');
        sunGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, cvs.width, cvs.height);

        const canvasTexture = new THREE.CanvasTexture(cvs);
        canvasTexture.mapping = THREE.EquirectangularReflectionMapping;
        canvasTexture.colorSpace = THREE.SRGBColorSpace;

        const envMap = this.pmremGenerator.fromEquirectangular(canvasTexture).texture;
        canvasTexture.dispose();

        this.scene.environment = envMap;
        if (preset.solidBackground !== undefined) {
            this.scene.background = new THREE.Color(preset.solidBackground);
        } else {
            this.scene.background = envMap;
            this.scene.backgroundBlurriness = preset.backgroundBlur || 0.0;
        }

        return envMap;
    }
}
