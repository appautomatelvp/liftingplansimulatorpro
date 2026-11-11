/**
 * ============================================================================
 * HYPER-REALISTIC SCENE RENDERER & EFFECT COMPOSER (SceneRenderer.js)
 * Architecture: AAA Photorealism & Real-Time CAE Industrial Post-Processing
 * Three.js Version: r170+ (EffectComposer, GTAOPass, UnrealBloomPass, OutputPass, SMAA)
 * ============================================================================
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { PBRMaterialFactory } from './PBRMaterialFactory.js';

export const QUALITY_TIERS = {
    ultra: {
        id: 'ultra',
        name: 'Ultra (AAA Photoreal)',
        shadowMapSize: 4096,
        shadowType: 'soft',
        aoEnabled: true,
        aoType: 'gtao',
        bloomEnabled: true,
        smaaEnabled: true,
        msaaSamples: 4,
        maxDPR: 2.0
    },
    // Default interactive tier — 1080p ~60 FPS + native MSAA (no răng cưa)
    high: {
        id: 'high',
        name: 'High (1080p / Cân bằng)',
        shadowMapSize: 4096,
        shadowType: 'pcf',
        aoEnabled: false,
        aoType: 'gtao',
        bloomEnabled: false,
        smaaEnabled: false,
        antialias: true,
        msaaSamples: 0,
        maxDPR: 1.0,
        bypassComposer: true
    },
    studio: {
        id: 'studio',
        name: 'CAD / Liebherr Studio (Sắc Nét)',
        shadowMapSize: 2048,
        shadowType: 'pcf',
        aoEnabled: false,
        bloomEnabled: false,
        smaaEnabled: false,
        antialias: true,
        msaaSamples: 4,
        maxDPR: 2.0,
        bypassComposer: true
    },
    performance: {
        id: 'performance',
        name: 'Performance (Tiết Kiệm Pin / 60 FPS)',
        shadowMapSize: 1024,
        shadowType: 'basic',
        aoEnabled: false,
        bloomEnabled: false,
        smaaEnabled: false,
        antialias: true,
        msaaSamples: 0,
        maxDPR: 1.0,
        bypassComposer: true
    }
};

export class SceneRenderer {
    /**
     * @param {HTMLElement} container DOM element to append canvas to
     * @param {THREE.Scene} scene
     * @param {THREE.PerspectiveCamera} camera
     * @param {Object} [options]
     */
    constructor(container, scene, camera, options = {}) {
        this.container = container;
        this.scene = scene;
        this.camera = camera;
        this.options = options;

        this.currentQuality = options.quality || 'high';

        // 1. Initialize WebGLRenderer
        this.initRenderer();

        // 2. Initialize PBR Engine & Environment Manager
        this.pbrFactory = new PBRMaterialFactory(this.renderer);
        this.envManager = new EnvironmentManager(this.scene, this.renderer);
        // Align shadow map with selected quality tier (EnvironmentManager defaults are overridden)
        if (this.envManager.sunLight) {
            const q0 = QUALITY_TIERS[this.currentQuality] || QUALITY_TIERS.high;
            this.envManager.sunLight.shadow.mapSize.set(q0.shadowMapSize, q0.shadowMapSize);
        }

        // 3. Initialize Post-Processing EffectComposer
        this.composer = null;
        this.renderPass = null;
        this.aoPass = null;
        this.bloomPass = null;
        this.outputPass = null;
        this.smaaPass = null;

        this.initComposer();
    }

    /**
     * Configures the main WebGLRenderer with modern color spaces and tone mapping.
     */
    initRenderer() {
        const quality = QUALITY_TIERS[this.currentQuality] || QUALITY_TIERS.high;

        this.renderer = new THREE.WebGLRenderer({
            // Native MSAA keeps cables/edges smooth (no răng cưa). Cheap at DPR≤1 / 1080p.
            antialias: quality.antialias !== false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: false
        });

        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxDPR));

        // Color Management & Tone Mapping (Three.js r152+)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.18;

        // Shadow Map Setup — soft shadows only on Ultra; high/1080p uses cheaper PCF
        this.renderer.shadowMap.enabled = true;
        this.applyShadowType(quality.shadowType || 'pcf');

        this.container.appendChild(this.renderer.domElement);
    }

    applyShadowType(shadowType) {
        if (shadowType === 'soft') this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        else if (shadowType === 'basic') this.renderer.shadowMap.type = THREE.BasicShadowMap;
        else this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.shadowMap.needsUpdate = true;
    }

    /**
     * Sets up the 16-bit Linear Half-Float Post-Processing Pipeline.
     */
    initComposer() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;
        const quality = QUALITY_TIERS[this.currentQuality] || QUALITY_TIERS.high;

        if (quality.bypassComposer) {
            this.composer = null;
            return;
        }

        // 16-bit Half-Float HDR RenderTarget with optional MSAA
        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            colorSpace: THREE.LinearSRGBColorSpace,
            samples: quality.msaaSamples || 0,
            depthBuffer: true
        });

        this.composer = new EffectComposer(this.renderer, renderTarget);

        // Pass 1: RenderPass (Base Scene in Linear HDR)
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        // Pass 2: Ambient Occlusion Pass (GTAO or SSAO)
        if (quality.aoEnabled) {
            try {
                this.aoPass = new GTAOPass(this.scene, this.camera, width, height);
                this.aoPass.blendIntensity = 0.42;
                if (typeof this.aoPass.updateGtaoMaterial === 'function') {
                    this.aoPass.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.5, thickness: 1.0 });
                }
                this.composer.addPass(this.aoPass);
            } catch (err) {
                console.warn('[SceneRenderer] GTAOPass fallback to SSAOPass:', err);
                this.aoPass = new SSAOPass(this.scene, this.camera, width, height);
                this.aoPass.kernelRadius = 1.2;
                this.aoPass.minDistance = 0.005;
                this.aoPass.maxDistance = 0.15;
                this.composer.addPass(this.aoPass);
            }
        }

        // Pass 3: UnrealBloomPass (HDR Glare for crane floodlights and reflections)
        if (quality.bloomEnabled) {
            // High threshold (1.05) ensures only true HDR emitters and hot reflections bloom
            this.bloomPass = new UnrealBloomPass(
                new THREE.Vector2(width, height),
                0.22,  // strength
                0.38,  // radius
                1.05   // threshold (> 1.0 for true HDR highlights only)
            );
            this.composer.addPass(this.bloomPass);
        }

        // Pass 4: OutputPass (Final ACES Filmic Tone Mapping + sRGB transfer)
        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);

        // Pass 5: SMAAPass (Subpixel Morphological Anti-Aliasing for thin cables)
        if (quality.smaaEnabled) {
            const pixelRatio = this.renderer.getPixelRatio();
            this.smaaPass = new SMAAPass(width * pixelRatio, height * pixelRatio);
            this.composer.addPass(this.smaaPass);
        }
    }

    /**
     * Executes the rendering loop for each frame.
     * Automatically handles gizmo layer isolation to avoid ambient occlusion artifacts.
     */
    render(dt = 0.016) {
        const quality = QUALITY_TIERS[this.currentQuality] || QUALITY_TIERS.high;
        const useComposer = Boolean(this.composer && !quality.bypassComposer);
        const needGizmoMask = Boolean(useComposer && quality.aoEnabled);

        if (needGizmoMask) this.isolateNonPhysicalGizmos(true);

        if (useComposer) {
            this.composer.render(dt);
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        if (needGizmoMask) this.isolateNonPhysicalGizmos(false);
    }

    /**
     * Hides invisible interaction hit-spheres (e.g. hook grabSphere, hookPick)
     * during normal/depth pass so they don't produce dark floating shadows.
     */
    isolateNonPhysicalGizmos(maskOut) {
        this.scene.traverse(node => {
            if (node.isMesh && node.material) {
                const mat = Array.isArray(node.material) ? node.material[0] : node.material;
                if (mat && (mat.visible === false || (mat.transparent && mat.opacity === 0))) {
                    if (maskOut) {
                        node.userData._prevVisible = node.visible;
                        node.visible = false;
                    } else if (node.userData._prevVisible !== undefined) {
                        node.visible = node.userData._prevVisible;
                    }
                }
            }
        });
    }

    /**
     * Resizes renderer, camera, composer, and all post-processing passes.
     */
    setSize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);

        if (this.composer) {
            this.composer.setSize(width, height);
            const pr = this.renderer.getPixelRatio();
            if (this.smaaPass) {
                this.smaaPass.setSize(width * pr, height * pr);
            }
        }
    }

    /**
     * Changes graphics quality preset dynamically without page refresh.
     */
    setQuality(qualityKey) {
        if (!QUALITY_TIERS[qualityKey]) return;
        this.currentQuality = qualityKey;
        const q = QUALITY_TIERS[qualityKey];

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxDPR));
        this.applyShadowType(q.shadowType || 'pcf');
        if (this.envManager && this.envManager.sunLight) {
            this.envManager.sunLight.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
            if (this.envManager.sunLight.shadow.map) {
                this.envManager.sunLight.shadow.map.dispose();
                this.envManager.sunLight.shadow.map = null;
            }
        }

        // Rebuild composer pipeline with new passes
        this.initComposer();
        console.info(`[SceneRenderer] Graphics Quality Tier set to: ${q.name}`);
    }

    /**
     * Captures high-resolution clean screenshot for 3D Lift Plan ASME P30.1 report.
     */
    captureScreenshot(width = 1920, height = 1080) {
        const curW = this.renderer.domElement.width;
        const curH = this.renderer.domElement.height;

        this.setSize(width, height);
        this.render(0.016);
        const dataUrl = this.renderer.domElement.toDataURL('image/jpeg', 0.95);

        // Restore original dimensions
        this.setSize(curW, curH);
        return dataUrl;
    }
}
