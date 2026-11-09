/**
 * ============================================================================
 * MODULE 1: ASSET & 3D LIBRARY MANAGER (AssetManager.js)
 * Architecture: CAE / Industrial Grade WebGL Physics Simulator
 * Metric Scale: Strict 1 Three.js Unit = 1.0 Real-World Meter (SI Metric)
 * ============================================================================
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetPipeline } from './AssetPipeline.js';
import { getAssetSpec } from './AssetSpecs.js';

export class AssetManager {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map(); // id -> THREE.Group (clonable prototype)
        this.manifest = new Map(); // id -> metadata
        this.loadingPromises = new Map();

        // Built-in placeholder registry for external GLB models
        this.registerDefaultManifest();
    }

    /**
     * Registers standard industrial gear and assets with their expected real-world dimensions.
     */
    registerDefaultManifest() {
        this.manifest.set('container_20ft', {
            name: 'ISO 22G1 20ft Shipping Container',
            url: '/assets/models/container_20ft.glb',
            category: 'cargo',
            targetDimensions: { x: 6.058, y: 2.591, z: 2.438 },
            tareMassKg: 2300,
            grossMassKg: 24000,
            cogOffset: { x: 0, y: -0.1, z: 0 },
            padEyes: [
                { id: 'top_fl', pos: { x:  2.94, y: 1.295, z:  1.13 } },
                { id: 'top_fr', pos: { x: -2.94, y: 1.295, z:  1.13 } },
                { id: 'top_rr', pos: { x: -2.94, y: 1.295, z: -1.13 } },
                { id: 'top_rl', pos: { x:  2.94, y: 1.295, z: -1.13 } }
            ]
        });

        this.manifest.set('container_40ft', {
            name: 'ISO 42G1 40ft Shipping Container',
            url: '/assets/models/container_40ft.glb',
            category: 'cargo',
            targetDimensions: { x: 12.192, y: 2.591, z: 2.438 },
            tareMassKg: 3800,
            grossMassKg: 30480,
            cogOffset: { x: 0, y: -0.1, z: 0 },
            padEyes: [
                { id: 'top_fl', pos: { x:  6.00, y: 1.295, z:  1.13 } },
                { id: 'top_fr', pos: { x: -6.00, y: 1.295, z:  1.13 } },
                { id: 'top_rr', pos: { x: -6.00, y: 1.295, z: -1.13 } },
                { id: 'top_rl', pos: { x:  6.00, y: 1.295, z: -1.13 } }
            ]
        });

        this.manifest.set('modulift_spreader', {
            name: 'Modulift Spreader / Telescopic Spreader 20-40ft',
            url: '/assets/models/modulift_spreader.glb',
            category: 'rigging',
            targetDimensions: { x: 6.058, y: 0.65, z: 2.438 },
            tareMassKg: 9500,
            wllT: 50.0
        });

        this.manifest.set('crosby_shackle', {
            name: 'Crosby G-2130 Bolt-Type Safety Shackle 17T',
            url: '/assets/models/crosby_shackle.glb',
            category: 'hardware',
            targetDimensions: { x: 0.18, y: 0.28, z: 0.14 },
            tareMassKg: 8.5,
            wllT: 17.0
        });

        this.manifest.set('liebherr_crane', {
            name: 'Liebherr LHM 550 Mobile Harbour Crane',
            url: '/assets/models/liebherr_crane.glb',
            category: 'crane',
            targetDimensions: { x: 18.0, y: 48.0, z: 14.0 },
            wllT: 144.0
        });

        this.manifest.set('sts_post_panamax', {
            name: 'ZPMC Post-Panamax STS Container Gantry Crane',
            url: '/assets/models/sts_crane.glb',
            category: 'crane',
            targetDimensions: { x: 28.0, y: 56.0, z: 88.0 },
            wllT: 65.0
        });
    }

    /**
     * Asynchronously loads a .GLB/.GLTF model. If file is missing or offline,
     * gracefully builds a high-precision procedural fallback matching the exact metric dimensions.
     *
     * @param {string} id Asset identifier from manifest or custom key
     * @param {string} [customUrl] Optional direct URL to .glb file
     * @param {Object} [customDim] Optional target dimensions {x, y, z} in meters
     * @returns {Promise<THREE.Group>}
     */
    async loadAsset(id, customUrl = null, customDim = null) {
        if (this.cache.has(id)) {
            return this.instantiate(id);
        }

        if (this.loadingPromises.has(id)) {
            await this.loadingPromises.get(id);
            return this.instantiate(id);
        }

        const meta = this.manifest.get(id) || {};
        const url = customUrl || meta.url;
        const targetDim = customDim || meta.targetDimensions;

        const loadPromise = new Promise(async (resolve) => {
            if (url) {
                try {
                    const gltf = await this.loadGLTPromise(url);
                    const rawModel = gltf.scene || gltf.scenes[0];
                    const { root } = AssetPipeline.normalizeAsset(rawModel, {
                        specKey: id,
                        mode: 'auto'
                    });
                    this.cache.set(id, root);
                    resolve(root);
                    return;
                } catch (err) {
                    console.warn(`[AssetManager] External model "${url}" not reachable. Generating high-precision procedural CAD fallback for "${id}".`);
                }
            }

            // Fallback generation: 1:1 Metric CAE Geometric Representation
            const fallbackModel = this.generateProceduralFallback(id, targetDim);
            const { root } = AssetPipeline.normalizeAsset(fallbackModel, { specKey: id, mode: 'auto' });
            this.cache.set(id, root);
            resolve(root);
        });

        this.loadingPromises.set(id, loadPromise);
        await loadPromise;
        this.loadingPromises.delete(id);
        return this.instantiate(id);
    }

    /**
     * Promise wrapper for Three.js GLTFLoader.
     */
    loadGLTPromise(url) {
        return new Promise((resolve, reject) => {
            this.loader.load(url, resolve, undefined, reject);
        });
    }

    /**
     * Normalizes an external 3D asset so that 1 Three.js unit = 1 Real-World Meter
     * using the unified AssetPipeline.
     */
    normalizeModel(model, targetDim) {
        return AssetPipeline.normalizeAsset(model, {
            specKey: 'generic_cargo',
            mode: 'auto'
        });
    }

    /**
     * Creates a high-fidelity procedural engineering mesh when external .glb is loading or unavailable.
     */
    generateProceduralFallback(id, targetDim) {
        const group = new THREE.Group();
        group.name = `fallback_${id}`;

        const dim = targetDim || { x: 2.0, y: 2.0, z: 2.0 };
        const { x: L, y: H, z: W } = dim;

        if (id.includes('container')) {
            // High-precision ISO Container with corrugated ribs, corner castings & door locking bars
            const bodyMat = new THREE.MeshStandardMaterial({
                color: id.includes('40ft') ? 0x8b1d1d : 0x1e3a8a, // Maroon for 40ft, Deep Navy Blue for 20ft
                roughness: 0.45,
                metalness: 0.35
            });
            const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.8 });
            const chromeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.9 });

            // Core box
            const core = new THREE.Mesh(new THREE.BoxGeometry(L - 0.16, H - 0.16, W - 0.16), bodyMat);
            core.castShadow = true; core.receiveShadow = true;
            group.add(core);

            // Trapezoidal corrugation ribs along side walls
            const ribCount = Math.max(8, Math.floor(L * 3.8));
            const ribGeo = new THREE.BoxGeometry(0.065, H - 0.24, W - 0.04);
            for (let i = 0; i < ribCount; i++) {
                const rx = -L / 2 + 0.35 + (i / (ribCount - 1)) * (L - 0.7);
                const rib = new THREE.Mesh(ribGeo, bodyMat);
                rib.position.x = rx;
                group.add(rib);
            }

            // 8 ISO Corner Castings (Forged steel with twistlock apertures)
            const ccGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
                const cc = new THREE.Mesh(ccGeo, steelMat);
                cc.position.set(sx * (L / 2 - 0.09), sy * (H / 2 - 0.09), sz * (W / 2 - 0.09));
                group.add(cc);
            })));

            // 4 Door locking rods on front wall (+X)
            const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, H - 0.3, 12);
            [-0.32, -0.12, 0.12, 0.32].forEach(zf => {
                const rod = new THREE.Mesh(rodGeo, chromeMat);
                rod.position.set(L / 2 - 0.03, 0, zf * W);
                group.add(rod);
            });

        } else if (id.includes('spreader')) {
            // Automatic Telescopic Container Spreader (Mainframe, sliding arms, twistlocks & headblock)
            const safetyYellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.4 });
            const darkSteel = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.8 });

            const mainBox = new THREE.Mesh(new THREE.BoxGeometry(Math.min(L * 0.75, 5.4), 0.58, 0.78), safetyYellow);
            mainBox.castShadow = true;
            group.add(mainBox);

            [-1, 1].forEach(sx => {
                const extLen = Math.max(0.8, L / 2 - 2.7 / 2);
                const extArm = new THREE.Mesh(new THREE.BoxGeometry(extLen, 0.44, 0.62), darkSteel);
                extArm.position.set(sx * (2.7 / 2 + extLen / 2), 0, 0);

                const endBeam = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, W + 0.2), safetyYellow);
                endBeam.position.set(sx * (L / 2), 0, 0);

                [-1, 1].forEach(sz => {
                    const cornerX = sx * (L / 2);
                    const cornerZ = sz * (W / 2);

                    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.32), darkSteel);
                    housing.position.set(cornerX, -0.06, cornerZ);

                    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.25, 12), darkSteel);
                    pin.position.set(cornerX, -0.32, cornerZ);

                    // 45 deg Flipper guide arm
                    const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.18), safetyYellow);
                    flipper.position.set(cornerX + sx * 0.22, -0.3, cornerZ + sz * 0.16);
                    flipper.rotation.z = -sx * 0.42;
                    flipper.rotation.x = sz * 0.42;

                    group.add(housing, pin, flipper);
                });

                group.add(extArm, endBeam);
            });

            // Headblock tower on top
            const tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.3), darkSteel);
            tower.position.set(0, 0.85, 0);
            group.add(tower);

        } else if (id.includes('shackle')) {
            // Crosby Bolt-Type Anchor Shackle (Forged bow body + alloy steel red bolt pin)
            const galvMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.85 });
            const redPinMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.7 });

            const bowGeo = new THREE.TorusGeometry(0.075, 0.024, 16, 28, Math.PI * 1.35);
            const bow = new THREE.Mesh(bowGeo, galvMat);
            bow.rotation.z = -Math.PI * 0.675;
            bow.position.set(0, 0.06, 0);
            bow.castShadow = true;

            const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 16);
            pinGeo.rotateZ(Math.PI / 2);
            const pin = new THREE.Mesh(pinGeo, redPinMat);
            pin.position.set(0, -0.05, 0);
            pin.castShadow = true;

            group.add(bow, pin);

        } else {
            // General industrial equipment box fallback
            const geo = new THREE.BoxGeometry(L, H, W);
            const mat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true; mesh.receiveShadow = true;
            group.add(mesh);
        }

        return group;
    }

    /**
     * Clones an asset prototype from cache to create an independent instance in the scene.
     */
    instantiate(id) {
        const proto = this.cache.get(id);
        if (!proto) {
            console.error(`[AssetManager] Asset "${id}" is not loaded in cache.`);
            return new THREE.Group();
        }
        const clone = proto.clone(true);
        clone.name = `${id}_inst_${THREE.MathUtils.generateUUID().slice(0, 6)}`;
        return clone;
    }

    /**
     * Disposes geometry and materials to free WebGL memory.
     */
    disposeAsset(id) {
        const proto = this.cache.get(id);
        if (proto) {
            proto.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else if (child.material) child.material.dispose();
                }
            });
            this.cache.delete(id);
        }
    }
}
