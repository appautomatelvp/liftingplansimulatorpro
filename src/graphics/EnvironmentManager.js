// @purpose: Quản lý ánh sáng IBL, sương mù chân trời, HDR và đồng bộ thời gian thực cho cảnh 3D
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import {
  LIGHTING_PRESETS,
  createHorizonSkyDome,
  getVietnamHorizonBand,
  getVietnamTimeInfo,
  resolveAtmosphereConfig,
  updateHorizonSkyDome
} from './HorizonSkyDome.js';

export { LIGHTING_PRESETS, getVietnamTimeInfo, getVietnamHorizonBand };

const STUDIO_SKY_BAND_OVERRIDES = {
  day: [0x6299cb, 0xe4e2d8],
  golden: [0x3d281e, 0xd49258],
  dawn: [0x484b65, 0xc8a296],
  night: [0x090d16, 0x0f172a]
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
    this.skyDome = null;
    this.initLights();
    this.ensureSkyDome();
    this.applyPreset('liebherr_studio');
    this.startRealtimeClock();
  }

  ensureSkyDome() {
    if (!this.skyDome) this.skyDome = createHorizonSkyDome(this.scene);
    return this.skyDome;
  }

  updateSkyDome(opts) {
    updateHorizonSkyDome(this.ensureSkyDome(), this.scene, this.sunLight, opts);
  }

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

  initLights() {
    this.sunLight = new THREE.DirectionalLight(0xfff6dc, 2.75);
    this.sunLight.position.set(28, 44, 24);
    this.sunLight.castShadow = true;
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

    this.fillLight = new THREE.DirectionalLight(0x9ec8f5, 0.85);
    this.fillLight.position.set(-24, 22, -18);
    this.scene.add(this.fillLight);

    this.ambientLight = new THREE.AmbientLight(0xfffcf2, 0.70);
    this.scene.add(this.ambientLight);
  }

  updateShadowFrustum(focusPoint) {
    if (!this.sunLight || !focusPoint) return;
    if (this.sunLight.target.position.distanceToSquared(focusPoint) > 0.09) {
      this.sunLight.target.position.copy(focusPoint);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  applyMatchedHorizonFog(bgColor, near = 68, far = 205, opts) {
    const fogColor = (bgColor && bgColor.isColor)
      ? bgColor.clone()
      : new THREE.Color(bgColor != null ? bgColor : 0xe4e2d8);
    if (!(opts && opts.setBackground === false)) this.scene.background = fogColor;
    if (this.scene.fog && this.scene.fog.isFog) {
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.near = near;
      this.scene.fog.far = far;
    } else {
      this.scene.fog = new THREE.Fog(fogColor.getHex(), near, far);
    }
    if (this.skyDome?.material?.uniforms?.uHorizonColor) {
      this.skyDome.material.uniforms.uHorizonColor.value = this.scene.fog.color;
    }
    return this.scene.fog;
  }

  applyVietnamHorizonAtmosphere(basePreset) {
    const preset = basePreset || LIGHTING_PRESETS[this.currentPresetId] || LIGHTING_PRESETS.liebherr_studio;
    if (preset.id === 'print_plan') {
      this.applyMatchedHorizonFog(preset.solidBackground || 0xeef2f6, preset.fogNear || 110, preset.fogFar || 260);
      this.updateSkyDome({ horizonColor: 0xeef2f6, midSkyColor: 0xebf0f5, skyColor: 0xe5ebf2, sunGlow: 0.0, horizonHaze: 0.40, visible: true });
      return 'day';
    }
    const timeInfo = getVietnamTimeInfo();
    const cfg = resolveAtmosphereConfig(preset, timeInfo);
    const applyLight = (light, spec) => {
      if (!light || !spec) return;
      light.color.setHex(spec[0]);
      light.intensity = spec[1];
      if (spec[2]) light.position.set(...spec[2]);
    };
    applyLight(this.sunLight, cfg.sun);
    applyLight(this.fillLight, cfg.fill);
    applyLight(this.ambientLight, cfg.amb);
    this.renderer.toneMappingExposure = cfg.exposure;

    const fogColor = new THREE.Color(cfg.fog);
    this.applyMatchedHorizonFog(fogColor, cfg.near, cfg.far);
    this.updateSkyDome({
      horizonColor: fogColor,
      midSkyColor: cfg.mid,
      skyColor: cfg.sky,
      sunGlow: cfg.glow,
      horizonHaze: cfg.haze,
      visible: true
    });
    this._vietnamHorizonBand = timeInfo.band;
    return timeInfo.band;
  }

  applyPreset(presetKey) {
    const preset = LIGHTING_PRESETS[presetKey] || LIGHTING_PRESETS.overcast;
    this.currentPresetId = preset.id;
    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunLight.position.set(...preset.sunPosition);
    this.fillLight.color.setHex(preset.fillColor);
    this.fillLight.intensity = preset.fillIntensity;
    this.renderer.toneMappingExposure = preset.exposure;
    this.scene.environmentIntensity = preset.envIntensity;

    if (!this.currentHDREnvMap) {
      this.generateProceduralSkyHDR(preset);
    } else if (preset.solidBackground === undefined) {
      if (this.skyDome) this.skyDome.visible = false;
      this.scene.background = this.currentHDREnvMap;
      this.scene.backgroundBlurriness = preset.backgroundBlur || 0.0;
    }
    this.applyVietnamHorizonAtmosphere(preset);
  }

  async loadHDREnvironment(source, options = {}) {
    let url = source;
    let isBlobUrl = false;
    const fileName = typeof source === 'string' ? source : source.name || 'custom.hdr';
    if (source instanceof Blob || source instanceof File) {
      url = URL.createObjectURL(source);
      isBlobUrl = true;
    }
    const ext = fileName.split('?')[0].split('.').pop().toLowerCase();
    try {
      const texture = await (ext === 'exr' ? this.exrLoader : this.rgbeLoader).loadAsync(url);
      const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      if (isBlobUrl) URL.revokeObjectURL(url);
      this.currentHDREnvMap = envMap;
      this.scene.environment = envMap;

      const preset = LIGHTING_PRESETS[this.currentPresetId];
      if (preset && preset.solidBackground !== undefined) {
        this.applyVietnamHorizonAtmosphere(preset);
      } else {
        if (this.skyDome) this.skyDome.visible = false;
        this.scene.background = envMap;
        this.scene.backgroundBlurriness = options.blurriness || (preset && preset.backgroundBlur) || 0.0;
        if (preset) {
          this.applyMatchedHorizonFog(preset.horizonColor || 0xe4e2d8, preset.fogNear ?? 68, preset.fogFar ?? 205, { setBackground: false });
        }
      }
      console.info(`[EnvironmentManager] HDR Environment "${fileName}" loaded and filtered successfully.`);
      return envMap;
    } catch (err) {
      if (isBlobUrl) URL.revokeObjectURL(url);
      console.warn(`[EnvironmentManager] Failed to load external HDR "${fileName}":`, err.message);
      this.generateProceduralSkyHDR(LIGHTING_PRESETS[this.currentPresetId]);
      throw err;
    }
  }

  generateProceduralSkyHDR(preset) {
    const cvs = document.createElement('canvas');
    cvs.width = 1024;
    cvs.height = 512;
    const ctx = cvs.getContext('2d');
    const { band } = getVietnamTimeInfo();
    const skyGrad = ctx.createLinearGradient(0, 0, 0, cvs.height);
    const hexToStr = (h) => '#' + new THREE.Color(h).getHexString();

    let skyTop = preset.skyColor;
    let skyHorizon = preset.horizonColor;
    if (preset.id === 'liebherr_studio' && STUDIO_SKY_BAND_OVERRIDES[band]) {
      [skyTop, skyHorizon] = STUDIO_SKY_BAND_OVERRIDES[band];
    }
    skyGrad.addColorStop(0.0, hexToStr(skyTop));
    skyGrad.addColorStop(0.48, hexToStr(skyHorizon));
    skyGrad.addColorStop(0.50, '#334155');
    skyGrad.addColorStop(0.52, '#1e293b');
    skyGrad.addColorStop(1.0, '#0f172a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, cvs.width, cvs.height);

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
    if (preset.solidBackground !== undefined) {
      this.applyVietnamHorizonAtmosphere(preset);
    } else {
      this.scene.background = envMap;
      this.scene.backgroundBlurriness = preset.backgroundBlur || 0.0;
      this.applyMatchedHorizonFog(preset.horizonColor || 0xe4e2d8, preset.fogNear ?? 85, preset.fogFar ?? 230, { setBackground: false });
    }
    return envMap;
  }
}
