/**
 * ============================================================================
 * ASSET LOADERS (AssetLoaders.js)
 * Supports: .GLB, .GLTF, .OBJ, .STL with standard Three.js loaders
 * ============================================================================
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { AssetPipeline } from './AssetPipeline.js';
import { AssemblyEngine } from './AssemblyEngine.js';

export class AssetLoaders {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.stlLoader = new STLLoader();
        this.objLoader = new OBJLoader();
        this.mtlLoader = new MTLLoader();
    }

    async _loadObjMaterials(objText, basePath) {
        const match = objText.match(/^\s*mtllib\s+(.+?)\s*$/m);
        if (!match) return null;
        const mtlFile = match[1].trim().replace(/\\/g, '/').split('/').pop();
        if (!mtlFile) return null;
        const mtlUrl = `${basePath}${mtlFile}`;
        // Prefetch via fetch so a missing MTL does not spam console 404 from MTLLoader
        try {
            const res = await fetch(mtlUrl);
            if (!res.ok) return null;
            const mtlText = await res.text();
            const materials = this.mtlLoader.parse(mtlText, basePath);
            try { materials.preload(); } catch (_) { /* ignore */ }
            return materials;
        } catch (_) {
            return null;
        }
    }

    /**
     * Parses an ArrayBuffer or string into a normalized Three.js Group.
     *
     * @param {ArrayBuffer|string} content
     * @param {string} format 'glb' | 'gltf' | 'obj' | 'stl'
     * @param {Object} [pipelineOptions] Passed to AssetPipeline.normalizeAsset
     * @returns {Promise<{ root: THREE.Group, report: Object }>}
     */
    async parseData(content, format, pipelineOptions = {}) {
        const fmt = (format || 'glb').toLowerCase();
        let rawObject = null;

        if (fmt === 'glb' || fmt === 'gltf') {
            rawObject = await new Promise((resolve, reject) => {
                this.gltfLoader.parse(content, '', gltf => {
                    resolve(gltf.scene || gltf.scenes[0]);
                }, reject);
            });
        } else if (fmt === 'stl') {
            const geometry = this.stlLoader.parse(content);
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({
                color: 0x94a3b8,
                roughness: 0.35,
                metalness: 0.65
            });
            const mesh = new THREE.Mesh(geometry, material);
            rawObject = new THREE.Group();
            rawObject.add(mesh);
        } else if (fmt === 'obj') {
            const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
            rawObject = this.objLoader.parse(text);
            const caeHeader = AssemblyEngine.parseCAEHeader(text);
            if (caeHeader) {
                if (!pipelineOptions.targetDimensions && caeHeader.dimensions) {
                    pipelineOptions.targetDimensions = {
                        x: caeHeader.dimensions.L,
                        y: caeHeader.dimensions.H,
                        z: caeHeader.dimensions.W
                    };
                }
                pipelineOptions.caeHeader = caeHeader;
            }
        } else {
            throw new Error(`Unsupported 3D asset format: "${format}". Supported formats are: glb, gltf, obj, stl.`);
        }

        // Run AssetPipeline normalization
        return AssetPipeline.normalizeAsset(rawObject, pipelineOptions);
    }

    /**
     * Loads a 3D model from a browser File object (e.g. from <input type="file">).
     */
    async loadFromFile(file, pipelineOptions = {}) {
        const ext = file.name.split('.').pop().toLowerCase();
        const buffer = await file.arrayBuffer();
        const result = await this.parseData(buffer, ext, pipelineOptions);
        result.report.fileName = file.name;
        result.report.fileSizeBytes = file.size;
        return result;
    }

    /**
     * Loads a 3D model from a URL.
     */
    async loadFromUrl(url, pipelineOptions = {}) {
        const cleanUrl = url.split('?')[0];
        const ext = cleanUrl.split('.').pop().toLowerCase();
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load asset from ${url}: HTTP ${res.status}`);

        // OBJ + companion MTL (e.g. ISO Realistic V2 material library)
        if (ext === 'obj') {
            const text = await res.text();
            const basePath = cleanUrl.slice(0, cleanUrl.lastIndexOf('/') + 1);
            const materials = await this._loadObjMaterials(text, basePath);
            if (materials) this.objLoader.setMaterials(materials);
            else this.objLoader.setMaterials(null);
            let rawObject;
            try {
                rawObject = this.objLoader.parse(text);
            } finally {
                this.objLoader.setMaterials(null);
            }
            const caeHeader = AssemblyEngine.parseCAEHeader(text);
            const opts = { ...pipelineOptions };
            if (caeHeader) {
                if (!opts.targetDimensions && caeHeader.dimensions) {
                    opts.targetDimensions = {
                        x: caeHeader.dimensions.L,
                        y: caeHeader.dimensions.H,
                        z: caeHeader.dimensions.W
                    };
                }
                opts.caeHeader = caeHeader;
            }
            const result = AssetPipeline.normalizeAsset(rawObject, opts);
            result.report.sourceUrl = url;
            result.report.hasMtl = !!materials;
            return result;
        }

        const buffer = await res.arrayBuffer();
        const result = await this.parseData(buffer, ext, pipelineOptions);
        result.report.sourceUrl = url;
        return result;
    }
}
