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
        name: 'Engineering Studio (Thời Gian Thực Việt Nam)',
        skyColor: 0x6299cb,
        horizonColor: 0xe4e2d8,
        sunColor: 0xfff6dc,
        sunIntensity: 2.75,
        sunPosition: [28, 44, 24],
        fillColor: 0x9ec8f5,
        fillIntensity: 0.85,
        // Linear fog pushed far away: cargo & lifting area are 100% crisp & clear
        fogNear: 85,
        fogFar: 230,
        fogDensity: 0.0001, // legacy Exp2 fallback
        exposure: 1.18,
        envIntensity: 1.18,
        backgroundBlur: 0.25,
        solidBackground: 0xe4e2d8
    },
    overcast: {
        id: 'overcast',
        name: 'Daylight Test Pad (Sân Bê Tông Ban Ngày)',
        skyColor: 0x64748b,
        horizonColor: 0xdde3ea,
        sunColor: 0xfffbeb,
        sunIntensity: 2.5,
        sunPosition: [24, 46, 28],
        fillColor: 0x93c5fd,
        fillIntensity: 0.8,
        fogNear: 85,
        fogFar: 230,
        fogDensity: 0.0001,
        exposure: 1.16,
        envIntensity: 1.1,
        backgroundBlur: 0.15,
        solidBackground: 0xdde3ea
    },
    print_plan: {
        id: 'print_plan',
        name: 'Lift Plan CAD Sheet (Bản Vẽ ASME Nền Sáng)',
        skyColor: 0xf1f5f9,
        horizonColor: 0xeef2f6,
        sunColor: 0xffffff,
        sunIntensity: 1.75,
        sunPosition: [20, 52, 22],
        fillColor: 0xcbd5e1,
        fillIntensity: 0.85,
        fogNear: 120,
        fogFar: 280,
        fogDensity: 0.00005,
        exposure: 1.08,
        envIntensity: 0.95,
        backgroundBlur: 0.0,
        solidBackground: 0xeef2f6
    },
    sunset: {
        id: 'sunset',
        name: 'Warm Industrial Bay (Ánh Sáng Xưởng Ấm / Hoàng Hôn)',
        skyColor: 0x3d281e,
        horizonColor: 0xd49258,
        sunColor: 0xff9e44,
        sunIntensity: 2.8,
        sunPosition: [34, 20, 26],
        fillColor: 0x38bdf8,
        fillIntensity: 0.6,
        fogNear: 80,
        fogFar: 220,
        fogDensity: 0.0001,
        exposure: 1.2,
        envIntensity: 1.15,
        backgroundBlur: 0.2,
        solidBackground: 0x2d1f18
    },
    night: {
        id: 'night',
        name: 'High-Contrast Inspection (Xưởng Đêm Chiếu Sáng)',
        skyColor: 0x090d16,
        horizonColor: 0x0f172a,
        sunColor: 0xdbe8fa,
        sunIntensity: 2.1,
        sunPosition: [-20, 38, 22],
        fillColor: 0x38bdf8,
        fillIntensity: 0.52,
        fogNear: 75,
        fogFar: 200,
        fogDensity: 0.0001,
        exposure: 1.22,
        envIntensity: 0.95,
        backgroundBlur: 0.2,
        solidBackground: 0x0c121e
    }
};

/**
 * Vietnam local clock (Asia/Ho_Chi_Minh, UTC+7, no DST) detailed time info.
 */
export function getVietnamTimeInfo(date = new Date()) {
    let hour = 12;
    let minute = 0;
    let second = 0;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(date);
        hour = parseInt(parts.find(p => p.type === 'hour')?.value || '12', 10);
        minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
        second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
    } catch (_) {
        const vn = new Date(date.getTime() + (7 * 60 - date.getTimezoneOffset()) * 60000);
        hour = vn.getUTCHours();
        minute = vn.getUTCMinutes();
        second = vn.getUTCSeconds();
    }
    const t = hour + minute / 60 + second / 3600;
    let band = 'night';
    // Vietnam photoperiod:
    // Dawn ~05:15 - 06:30
    // Daytime ~06:30 - 16:30 (bright warm golden sunshine)
    // Golden hour / Sunset ~16:30 - 18:00
    // Dusk ~18:00 - 19:15
    // Night ~19:15 - 05:15
    if (t >= 5.25 && t < 6.5) band = 'dawn';
    else if (t >= 6.5 && t < 16.5) band = 'day';
    else if (t >= 16.5 && t < 18.0) band = 'golden';
    else if (t >= 18.0 && t < 19.25) band = 'dusk';
    else band = 'night';

    return { hour, minute, second, t, band };
}

/**
 * Vietnam local clock (Asia/Ho_Chi_Minh, UTC+7, no DST) → atmospheric band.
 */
export function getVietnamHorizonBand(date = new Date()) {
    return getVietnamTimeInfo(date).band;
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
        this.startRealtimeClock();
    }

    /**
     * Periodically syncs atmospheric conditions with Vietnam real-time clock.
     */
    startRealtimeClock() {
        if (this._realtimeTimer) clearInterval(this._realtimeTimer);
        this._realtimeTimer = setInterval(() => {
            const preset = LIGHTING_PRESETS[this.currentPresetId];
            if (preset && preset.solidBackground !== undefined) {
                const prevBand = this._vietnamHorizonBand;
                const newBand = this.applyVietnamHorizonAtmosphere(preset);
                if (prevBand && prevBand !== newBand && !this.currentHDREnvMap) {
                    this.generateProceduralSkyHDR(preset);
                }
            }
        }, 30000);
    }

    /**
     * Initializes Primary Sun DirectionalLight with 4096px PCFSoft Shadow Map.
     */
    initLights() {
        // 1. Primary Directional Sun / Key Light
        this.sunLight = new THREE.DirectionalLight(0xfff6dc, 2.75);
        this.sunLight.position.set(28, 44, 24);
        this.sunLight.castShadow = true;

        // Default 1024 for 1080p interactive; SceneRenderer.setQuality can raise for Ultra/Studio
        this.sunLight.shadow.mapSize.set(1024, 1024);
        this.sunLight.shadow.camera.near = 2.0;
        this.sunLight.shadow.camera.far = 180.0;
        this.sunLight.shadow.camera.left = -30;
        this.sunLight.shadow.camera.right = 30;
        this.sunLight.shadow.camera.top = 30;
        this.sunLight.shadow.camera.bottom = -30;
        this.sunLight.shadow.bias = -0.00012;
        this.sunLight.shadow.normalBias = 0.016;

        this.scene.add(this.sunLight);

        // 2. Secondary Ambient / Fill Light
        this.fillLight = new THREE.DirectionalLight(0x9ec8f5, 0.85);
        this.fillLight.position.set(-24, 22, -18);
        this.scene.add(this.fillLight);

        // 3. Subtle Base Ambient Light
        this.ambientLight = new THREE.AmbientLight(0xfffcf2, 0.70);
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
     * near: lifting gear & cargo stay 100% crisp; far: distant grid dissolves smoothly into the sky.
     */
    applyMatchedHorizonFog(bgColor, near = 85, far = 230, opts) {
        const fogColor = (bgColor && bgColor.isColor)
            ? bgColor.clone()
            : new THREE.Color(bgColor != null ? bgColor : 0xe4e2d8);
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
     * Tint background+fog and update lighting based on Vietnam local time (UTC+7, Asia/Ho_Chi_Minh).
     * During daytime, creates a bright atmosphere with a warm golden sunlit hue ("sáng màu hơi vàng nắng").
     */
    applyVietnamHorizonAtmosphere(basePreset) {
        const preset = basePreset || LIGHTING_PRESETS[this.currentPresetId] || LIGHTING_PRESETS.liebherr_studio;
        // CAD sheet stays neutral white — no TOD wash
        if (preset.id === 'print_plan') {
            this.applyMatchedHorizonFog(preset.solidBackground || 0xeef2f6, preset.fogNear || 120, preset.fogFar || 280);
            return 'day';
        }

        const timeInfo = getVietnamTimeInfo();
        const band = timeInfo.band;
        const t = timeInfo.t;

        let fogColorHex = 0xe4e2d8;
        let near = preset.fogNear != null ? preset.fogNear : 85;
        let far = preset.fogFar != null ? preset.fogFar : 230;

        if (preset.id === 'night') {
            fogColorHex = 0x0c121e;
            near = 75; far = 200;
            if (this.sunLight) {
                this.sunLight.color.setHex(0xdbe8fa);
                this.sunLight.intensity = 2.05;
                this.sunLight.position.set(-20, 38, 22);
            }
            if (this.fillLight) {
                this.fillLight.color.setHex(0x38bdf8);
                this.fillLight.intensity = 0.52;
            }
            if (this.ambientLight) {
                this.ambientLight.color.setHex(0x182236);
                this.ambientLight.intensity = 0.36;
            }
            this.renderer.toneMappingExposure = 1.22;
        } else if (preset.id === 'sunset') {
            fogColorHex = 0xd49258;
            near = 80; far = 220;
            if (this.sunLight) {
                this.sunLight.color.setHex(0xff9e44);
                this.sunLight.intensity = 2.8;
                this.sunLight.position.set(34, 20, 26);
            }
            if (this.fillLight) {
                this.fillLight.color.setHex(0x38bdf8);
                this.fillLight.intensity = 0.60;
            }
            if (this.ambientLight) {
                this.ambientLight.color.setHex(0xfdecd2);
                this.ambientLight.intensity = 0.58;
            }
            this.renderer.toneMappingExposure = 1.20;
        } else if (preset.id === 'overcast') {
            fogColorHex = 0xdde3ea;
            near = 85; far = 230;
            if (this.sunLight) {
                this.sunLight.color.setHex(0xfffbeb);
                this.sunLight.intensity = 2.5;
                this.sunLight.position.set(24, 46, 28);
            }
            if (this.fillLight) {
                this.fillLight.color.setHex(0x93c5fd);
                this.fillLight.intensity = 0.8;
            }
            if (this.ambientLight) {
                this.ambientLight.color.setHex(0xffffff);
                this.ambientLight.intensity = 0.65;
            }
            this.renderer.toneMappingExposure = 1.16;
        } else {
            // Default: Real-time Vietnam Time-Of-Day atmosphere
            if (band === 'dawn') {
                fogColorHex = 0xc8a296; // Soft morning rose-gold dawn
                near = 80; far = 220;
                if (this.sunLight) {
                    this.sunLight.color.setHex(0xffd4a8);
                    this.sunLight.intensity = 2.2;
                    this.sunLight.position.set(-28, 18, 24);
                }
                if (this.fillLight) {
                    this.fillLight.color.setHex(0x60a5fa);
                    this.fillLight.intensity = 0.65;
                }
                if (this.ambientLight) {
                    this.ambientLight.color.setHex(0xf5e4dc);
                    this.ambientLight.intensity = 0.52;
                }
                this.renderer.toneMappingExposure = 1.15;
            } else if (band === 'golden') {
                fogColorHex = 0xd49258; // Rich warm amber sunset
                near = 80; far = 220;
                if (this.sunLight) {
                    this.sunLight.color.setHex(0xff9e44);
                    this.sunLight.intensity = 2.8;
                    this.sunLight.position.set(34, 20, 26);
                }
                if (this.fillLight) {
                    this.fillLight.color.setHex(0x38bdf8);
                    this.fillLight.intensity = 0.60;
                }
                if (this.ambientLight) {
                    this.ambientLight.color.setHex(0xfdecd2);
                    this.ambientLight.intensity = 0.58;
                }
                this.renderer.toneMappingExposure = 1.20;
            } else if (band === 'dusk') {
                fogColorHex = 0x1e2438; // Dusk twilight
                near = 75; far = 200;
                if (this.sunLight) {
                    this.sunLight.color.setHex(0xa07c6f);
                    this.sunLight.intensity = 1.1;
                }
                if (this.fillLight) {
                    this.fillLight.color.setHex(0x334155);
                    this.fillLight.intensity = 0.45;
                }
                if (this.ambientLight) {
                    this.ambientLight.color.setHex(0x1f293d);
                    this.ambientLight.intensity = 0.42;
                }
                this.renderer.toneMappingExposure = 1.16;
            } else if (band === 'night') {
                fogColorHex = 0x0c121e; // Night void
                near = 75; far = 200;
                if (this.sunLight) {
                    this.sunLight.color.setHex(0xdbe8fa);
                    this.sunLight.intensity = 2.05;
                    this.sunLight.position.set(-20, 38, 22);
                }
                if (this.fillLight) {
                    this.fillLight.color.setHex(0x38bdf8);
                    this.fillLight.intensity = 0.52;
                }
                if (this.ambientLight) {
                    this.ambientLight.color.setHex(0x182236);
                    this.ambientLight.intensity = 0.36;
                }
                this.renderer.toneMappingExposure = 1.22;
            } else {
                // Daytime (06:30 - 16:30, including morning ~09:00 AM)
                // "sáng màu hơi vàng nắng vì đang ban ngày"
                fogColorHex = 0xe4e2d8; // Bright daylight with subtle warm golden sunlit hue
                near = 85; far = 230;

                const sunPos = (t < 11.5)
                    ? [28, 44, 24] // Morning ascending sun (East-South-East)
                    : (t <= 14.0 ? [14, 52, 16] : [30, 38, -24]); // Noon overhead vs afternoon

                if (this.sunLight) {
                    this.sunLight.color.setHex(0xfff6dc); // Warm golden sunlight
                    this.sunLight.intensity = 2.75;
                    this.sunLight.position.set(...sunPos);
                }
                if (this.fillLight) {
                    this.fillLight.color.setHex(0x9ec8f5); // Soft blue ambient sky fill
                    this.fillLight.intensity = 0.85;
                    this.fillLight.position.set(-24, 22, -18);
                }
                if (this.ambientLight) {
                    this.ambientLight.color.setHex(0xfffcf2); // Warm daylight bounce
                    this.ambientLight.intensity = 0.70;
                }
                this.renderer.toneMappingExposure = 1.18;
            }
        }

        const fogColor = new THREE.Color(fogColorHex);
        this.applyMatchedHorizonFog(fogColor, near, far);
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
                        preset.horizonColor || 0xe4e2d8,
                        preset.fogNear != null ? preset.fogNear : 85,
                        preset.fogFar != null ? preset.fogFar : 230,
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

        const timeInfo = getVietnamTimeInfo();
        const band = timeInfo.band;

        // Vertical Sky Gradient (Zenith to Horizon to Sea/Ground reflection)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, cvs.height);
        const hexToStr = (h) => '#' + new THREE.Color(h).getHexString();

        let skyTop = preset.skyColor;
        let skyHorizon = preset.horizonColor;

        if (preset.id === 'liebherr_studio') {
            if (band === 'day') {
                skyTop = 0x6299cb; // Crisp daytime blue
                skyHorizon = 0xe4e2d8; // Bright warm sunlit horizon
            } else if (band === 'golden') {
                skyTop = 0x3d281e;
                skyHorizon = 0xd49258;
            } else if (band === 'dawn') {
                skyTop = 0x484b65;
                skyHorizon = 0xc8a296;
            } else if (band === 'night') {
                skyTop = 0x090d16;
                skyHorizon = 0x0f172a;
            }
        }

        skyGrad.addColorStop(0.0, hexToStr(skyTop));
        skyGrad.addColorStop(0.48, hexToStr(skyHorizon));
        skyGrad.addColorStop(0.50, '#334155'); // Horizon line transition
        skyGrad.addColorStop(0.52, '#1e293b'); // Quayside ground reflection
        skyGrad.addColorStop(1.0, '#0f172a');

        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, cvs.width, cvs.height);

        // Radiant Sun Disc & Atmospheric Flare
        const sunPos = this.sunLight ? this.sunLight.position.toArray() : preset.sunPosition;
        const sunX = (sunPos[0] / 50 + 0.5) * cvs.width;
        const sunY = (1.0 - (sunPos[1] / 60)) * (cvs.height * 0.5);

        const sunColor = this.sunLight ? this.sunLight.color.getHex() : preset.sunColor;
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 180);
        sunGlow.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        sunGlow.addColorStop(0.08, hexToStr(sunColor));
        sunGlow.addColorStop(0.35, 'rgba(254, 215, 170, 0.45)');
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
                preset.horizonColor || 0xe4e2d8,
                preset.fogNear != null ? preset.fogNear : 85,
                preset.fogFar != null ? preset.fogFar : 230,
                { setBackground: false }
            );
        }

        return envMap;
    }
}
