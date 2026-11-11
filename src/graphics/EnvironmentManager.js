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
        // Linear fog: clear lift zone, grid gone by ~edge of 100 m helper
        fogNear: 30,
        fogFar: 54,
        fogDensity: 0.0005, // legacy Exp2 fallback
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
        fogNear: 34,
        fogFar: 60,
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
        fogNear: 42,
        fogFar: 95,
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
        fogNear: 28,
        fogFar: 52,
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
        fogNear: 24,
        fogFar: 48,
        fogDensity: 0.0008,
        exposure: 1.22,
        envIntensity: 0.95,
        backgroundBlur: 0.2,
        solidBackground: 0x090d16
    }
};

/**
 * Vietnam local clock (Asia/Ho_Chi_Minh, UTC+7, no DST) → atmospheric band.
 * Used to soften the horizon tint without fighting the active lighting preset.
 */
export function getVietnamHorizonBand(date = new Date()) {
    let hour = 12;
    let minute = 0;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(date);
        hour = parseInt(parts.find(p => p.type === 'hour')?.value || '12', 10);
        minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    } catch (_) {
        const vn = new Date(date.getTime() + (7 * 60 - date.getTimezoneOffset()) * 60000);
        hour = vn.getUTCHours();
        minute = vn.getUTCMinutes();
    }
    const t = hour + minute / 60;
    // Approx. Ho Chi Minh photoperiod (Nov): sunrise ~05:47, sunset ~17:27
    if (t >= 5.4 && t < 6.5) return 'dawn';
    if (t >= 6.5 && t < 16.5) return 'day';
    if (t >= 16.5 && t < 18.0) return 'golden';
    if (t >= 18.0 && t < 19.2) return 'dusk';
    return 'night';
}

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

        // Default 1024 for 1080p interactive; SceneRenderer.setQuality can raise for Ultra/Studio
        this.sunLight.shadow.mapSize.set(1024, 1024);
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
     * Linear fog color === exact scene background → soft infinite floor / no hard horizon cut.
     * near: lifting gear stays crisp; far: 100 m grid fully dissolves into the void.
     */
    applyMatchedHorizonFog(bgColor, near = 30, far = 54, opts) {
        const fogColor = (bgColor && bgColor.isColor)
            ? bgColor.clone()
            : new THREE.Color(bgColor != null ? bgColor : 0x131924);
        const setBackground = !(opts && opts.setBackground === false);
        if (setBackground) this.scene.background = fogColor;
        if (this.scene.fog && this.scene.fog.isFog) {
            this.scene.fog.color.copy(fogColor);
            this.scene.fog.near = near;
            this.scene.fog.far = far;
        } else {
            this.scene.fog = new THREE.Fog(fogColor.getHex(), near, far);
        }
        return this.scene.fog;
    }

    /**
     * Tint background+fog from Vietnam local time (UTC+7) for a living horizon feel.
     * Keeps the same hex on fog & background so the fade stays seamless.
     */
    applyVietnamHorizonAtmosphere(basePreset) {
        const preset = basePreset || LIGHTING_PRESETS[this.currentPresetId] || LIGHTING_PRESETS.liebherr_studio;
        // CAD sheet stays neutral white — no TOD wash
        if (preset.id === 'print_plan') {
            this.applyMatchedHorizonFog(preset.solidBackground, preset.fogNear, preset.fogFar);
            return getVietnamHorizonBand();
        }

        const band = getVietnamHorizonBand();
        const base = new THREE.Color(preset.solidBackground);
        const wash = new THREE.Color();
        let near = preset.fogNear != null ? preset.fogNear : 30;
        let far = preset.fogFar != null ? preset.fogFar : 54;

        if (band === 'dawn') {
            wash.setHex(0x3b455c);
            base.lerp(wash, 0.22);
            near = Math.max(26, near - 2);
            far = Math.min(58, far + 2);
        } else if (band === 'day') {
            wash.setHex(0x243044);
            base.lerp(wash, 0.08);
        } else if (band === 'golden') {
            wash.setHex(0x3a2a22);
            base.lerp(wash, 0.28);
            near = Math.max(24, near - 3);
            far = Math.min(56, far + 1);
        } else if (band === 'dusk') {
            wash.setHex(0x1a2233);
            base.lerp(wash, 0.2);
            near = Math.max(24, near - 2);
        } else {
            // night (current VN evening) — deeper void, tighter fade for infinite pad
            wash.setHex(0x080c14);
            base.lerp(wash, 0.35);
            near = Math.max(22, near - 4);
            far = Math.min(50, far - 2);
        }

        this.applyMatchedHorizonFog(base, near, far);
        this._vietnamHorizonBand = band;
        return band;
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

        // Configure Exposure & Environment Intensity
        this.renderer.toneMappingExposure = preset.exposure;
        this.scene.environmentIntensity = preset.envIntensity;

        // If no external HDR loaded yet, generate high-fidelity procedural IBL
        if (!this.currentHDREnvMap) {
            this.generateProceduralSkyHDR(preset);
        } else if (preset.solidBackground === undefined) {
            this.scene.background = this.currentHDREnvMap;
            this.scene.backgroundBlurriness = preset.backgroundBlur || 0.0;
        }

        // Fog color must equal background — Vietnam TOD softens the horizon wash
        this.applyVietnamHorizonAtmosphere(preset);
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
                this.applyVietnamHorizonAtmosphere(preset);
            } else {
                this.scene.background = envMap;
                this.scene.backgroundBlurriness = options.blurriness || (preset && preset.backgroundBlur) || 0.0;
                if (preset) {
                    this.applyMatchedHorizonFog(
                        preset.horizonColor || 0x131924,
                        preset.fogNear != null ? preset.fogNear : 30,
                        preset.fogFar != null ? preset.fogFar : 54,
                        { setBackground: false }
                    );
                }
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
        // Solid studio void (not HDR sky) so linear fog can match 1:1 and erase the hard horizon
        if (preset.solidBackground !== undefined) {
            this.applyVietnamHorizonAtmosphere(preset);
        } else {
            this.scene.background = envMap;
            this.scene.backgroundBlurriness = preset.backgroundBlur || 0.0;
            this.applyMatchedHorizonFog(
                preset.horizonColor || 0x131924,
                preset.fogNear != null ? preset.fogNear : 30,
                preset.fogFar != null ? preset.fogFar : 54,
                { setBackground: false }
            );
        }

        return envMap;
    }
}
