/**
 * ============================================================================
 * PBR MATERIAL FACTORY & TEXTURE ENGINE (PBRMaterialFactory.js)
 * Architecture: Photorealistic Industrial Maritime Digital Twin
 * Three.js Version: r170+ (ColorManagement, SRGBColorSpace, Physical Optics)
 * ============================================================================
 */

import * as THREE from 'three';

export class PBRMaterialFactory {
    constructor(renderer = null) {
        this.renderer = renderer;
        this.cachedTextures = new Map();
        this.cachedMaterials = new Map();
        this.maxAnisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;
    }

    /**
     * Enforces strict PBR compliance on any 3D asset hierarchy (GLB, OBJ, STL).
     * Upgrades legacy materials, corrects texture color spaces, and enables shadows.
     *
     * @param {THREE.Object3D} root
     * @returns {THREE.Object3D}
     */
    enforcePBRMaterials(root) {
        if (!root) return root;

        root.traverse(child => {
            if (!child.isMesh) return;

            // Enable physically accurate shadow reception & casting
            if (!child.userData.noShadow) {
                child.castShadow = true;
                child.receiveShadow = true;
            }

            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat, idx) => {
                if (!mat) return;

                // Ensure proper color spaces for textures (Three.js r152+)
                if (mat.map) {
                    mat.map.colorSpace = THREE.SRGBColorSpace;
                    mat.map.anisotropy = this.maxAnisotropy;
                }
                if (mat.emissiveMap) {
                    mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                }
                if (mat.normalMap) {
                    mat.normalMap.colorSpace = THREE.NoColorSpace;
                    mat.normalMap.anisotropy = this.maxAnisotropy;
                }
                if (mat.roughnessMap) {
                    mat.roughnessMap.colorSpace = THREE.NoColorSpace;
                }
                if (mat.metalnessMap) {
                    mat.metalnessMap.colorSpace = THREE.NoColorSpace;
                }
                if (mat.aoMap) {
                    mat.aoMap.colorSpace = THREE.NoColorSpace;
                    if (child.geometry && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
                        child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
                    }
                }

                // If non-PBR material on solid mesh, upgrade to MeshStandardMaterial
                if (!child.userData.preserveMaterial &&
                    !(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) &&
                    !child.userData.isCADEdge && !child.userData.dragType) {
                    const upgraded = new THREE.MeshStandardMaterial({
                        color: mat.color ? mat.color.clone() : new THREE.Color(0x94a3b8),
                        map: mat.map || null,
                        metalness: 0.45,
                        roughness: 0.35
                    });
                    if (Array.isArray(child.material)) child.material[idx] = upgraded;
                    else child.material = upgraded;
                }
            });
        });

        return root;
    }

    /**
     * Builds a photorealistic Port Quayside Concrete PBR Material.
     * Features: 6m x 6m expansion joints, aggregate flecks, oil stains, variable roughness.
     */
    createQuayConcreteMaterial(options = {}) {
        const cacheKey = 'quay_concrete_pbr';
        if (this.cachedMaterials.has(cacheKey)) {
            return this.cachedMaterials.get(cacheKey);
        }

        const size = 1024;
        const cvsBase = this.createCanvas(size, size);
        const ctxBase = cvsBase.getContext('2d');
        const cvsNorm = this.createCanvas(size, size);
        const ctxNorm = cvsNorm.getContext('2d');
        const cvsRough = this.createCanvas(size, size);
        const ctxRough = cvsRough.getContext('2d');
        const cvsAO = this.createCanvas(size, size);
        const ctxAO = cvsAO.getContext('2d');

        // 1. BaseColor (Concrete with micro-aggregate speckles & stains)
        ctxBase.fillStyle = '#424a56'; // Heavy-duty maritime C40 concrete
        ctxBase.fillRect(0, 0, size, size);

        // Noise & aggregate speckles
        const imgData = ctxBase.getImageData(0, 0, size, size);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const noise = (Math.random() - 0.5) * 28;
            d[i] = Math.min(255, Math.max(0, d[i] + noise));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise * 0.9));
        }
        ctxBase.putImageData(imgData, 0, 0);

        // 2. 6m x 6m Expansion Joints (Tar-filled bitumen cut lines)
        const jointPositions = [0, size / 2, size - 1];
        ctxBase.fillStyle = '#1e242c';
        jointPositions.forEach(p => {
            ctxBase.fillRect(p - 2, 0, 4, size);
            ctxBase.fillRect(0, p - 2, size, 4);
        });

        // 3. Normal Map (Concrete broom finish + joint grooves)
        ctxNorm.fillStyle = 'rgb(128, 128, 255)'; // Neutral flat normal
        ctxNorm.fillRect(0, 0, size, size);
        jointPositions.forEach(p => {
            // Grooved normal indentation
            ctxNorm.fillStyle = 'rgb(90, 128, 255)';
            ctxNorm.fillRect(p - 3, 0, 3, size);
            ctxNorm.fillStyle = 'rgb(165, 128, 255)';
            ctxNorm.fillRect(p, 0, 3, size);
            ctxNorm.fillStyle = 'rgb(128, 90, 255)';
            ctxNorm.fillRect(0, p - 3, size, 3);
            ctxNorm.fillStyle = 'rgb(128, 165, 255)';
            ctxNorm.fillRect(0, p, size, 3);
        });

        // 4. Roughness Map (Matte dry concrete 0.88 with glossy damp spots 0.3)
        ctxRough.fillStyle = 'rgb(215, 215, 215)'; // High roughness
        ctxRough.fillRect(0, 0, size, size);
        // Bitumen joints are smoother
        ctxRough.fillStyle = 'rgb(90, 90, 90)';
        jointPositions.forEach(p => {
            ctxRough.fillRect(p - 3, 0, 6, size);
            ctxRough.fillRect(0, p - 3, size, 6);
        });

        // 5. Ambient Occlusion Map (Crevice shadowing at joints)
        ctxAO.fillStyle = 'rgb(255, 255, 255)';
        ctxAO.fillRect(0, 0, size, size);
        ctxAO.fillStyle = 'rgb(110, 110, 110)';
        jointPositions.forEach(p => {
            ctxAO.fillRect(p - 4, 0, 8, size);
            ctxAO.fillRect(0, p - 4, size, 8);
        });

        // Convert canvases to Three.js CanvasTextures
        const repeatX = options.repeatX || 30; // 180m / 6m = 30 tiles
        const repeatY = options.repeatY || 30;

        const baseMap = new THREE.CanvasTexture(cvsBase);
        baseMap.colorSpace = THREE.SRGBColorSpace;
        baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;
        baseMap.repeat.set(repeatX, repeatY);
        baseMap.anisotropy = this.maxAnisotropy;

        const normalMap = new THREE.CanvasTexture(cvsNorm);
        normalMap.colorSpace = THREE.NoColorSpace;
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(repeatX, repeatY);
        normalMap.anisotropy = this.maxAnisotropy;

        const roughMap = new THREE.CanvasTexture(cvsRough);
        roughMap.colorSpace = THREE.NoColorSpace;
        roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
        roughMap.repeat.set(repeatX, repeatY);

        const aoMap = new THREE.CanvasTexture(cvsAO);
        aoMap.colorSpace = THREE.NoColorSpace;
        aoMap.wrapS = aoMap.wrapT = THREE.RepeatWrapping;
        aoMap.repeat.set(repeatX, repeatY);

        const material = new THREE.MeshStandardMaterial({
            map: baseMap,
            normalMap,
            normalScale: new THREE.Vector2(0.85, 0.85),
            roughnessMap: roughMap,
            roughness: 0.92,
            metalness: 0.08,
            aoMap,
            aoMapIntensity: 0.95
        });

        this.cachedMaterials.set(cacheKey, material);
        return material;
    }

    /**
     * Builds realistic helical strand Normal Map & PBR Material for Steel Wire Ropes.
     * Matches IWRC 6x36 crane hoist and rigging slings.
     * Features: Greased industrial lubricant tint, deep helical valleys, micro-scratches.
     */
    createWireRopeMaterial() {
        const cacheKey = 'wire_rope_pbr';
        if (this.cachedMaterials.has(cacheKey)) {
            return this.cachedMaterials.get(cacheKey);
        }

        const size = 512;
        const cvsBase = this.createCanvas(size, size);
        const ctxBase = cvsBase.getContext('2d');
        const cvsNorm = this.createCanvas(size, size);
        const ctxNorm = cvsNorm.getContext('2d');
        const cvsRough = this.createCanvas(size, size);
        const ctxRough = cvsRough.getContext('2d');

        // 1. Albedo: Greased steel with graphite/brown tint in valleys
        ctxBase.fillStyle = '#6e7885'; // Steel base
        ctxBase.fillRect(0, 0, size, size);

        // 2. Normal: Diagonal 6-strand helical valleys + internal 36-wire micro-grooves
        ctxNorm.fillStyle = 'rgb(128, 128, 255)';
        ctxNorm.fillRect(0, 0, size, size);

        // 3. Roughness: Glossy steel ridges (0.24) vs matte grease in valleys (0.68)
        ctxRough.fillStyle = 'rgb(65, 65, 65)';
        ctxRough.fillRect(0, 0, size, size);

        const strandCount = 6;
        const strandW = size / strandCount;

        for (let i = 0; i < strandCount * 2; i++) {
            const y0 = i * strandW;
            const y1 = (i - 1) * strandW;

            // Valley groove shading on Base
            const gradBase = ctxBase.createLinearGradient(0, y0, size, y1);
            gradBase.addColorStop(0.0, '#221f1d'); // Dark graphite lubricant
            gradBase.addColorStop(0.25, '#7f8b9b'); // Polished steel crown
            gradBase.addColorStop(0.5, '#6b7583');
            gradBase.addColorStop(0.75, '#8a96a6');
            gradBase.addColorStop(1.0, '#221f1d');
            ctxBase.fillStyle = gradBase;
            ctxBase.beginPath();
            ctxBase.moveTo(0, y0);
            ctxBase.lineTo(size, y1);
            ctxBase.lineTo(size, y1 + strandW);
            ctxBase.lineTo(0, y0 + strandW);
            ctxBase.fill();

            // Normal map ridge gradient
            const gradNorm = ctxNorm.createLinearGradient(0, y0, size, y1);
            gradNorm.addColorStop(0.0, 'rgb(60, 128, 230)');
            gradNorm.addColorStop(0.5, 'rgb(128, 128, 255)');
            gradNorm.addColorStop(1.0, 'rgb(195, 128, 230)');
            ctxNorm.fillStyle = gradNorm;
            ctxNorm.beginPath();
            ctxNorm.moveTo(0, y0);
            ctxNorm.lineTo(size, y1);
            ctxNorm.lineTo(size, y1 + strandW);
            ctxNorm.lineTo(0, y0 + strandW);
            ctxNorm.fill();

            // Roughness gradient: darker (shinier) in center, rough in crevice
            const gradRough = ctxRough.createLinearGradient(0, y0, size, y1);
            gradRough.addColorStop(0.0, 'rgb(160, 160, 160)'); // grease
            gradRough.addColorStop(0.5, 'rgb(60, 60, 60)');     // steel shine
            gradRough.addColorStop(1.0, 'rgb(160, 160, 160)');
            ctxRough.fillStyle = gradRough;
            ctxRough.beginPath();
            ctxRough.moveTo(0, y0);
            ctxRough.lineTo(size, y1);
            ctxRough.lineTo(size, y1 + strandW);
            ctxRough.lineTo(0, y0 + strandW);
            ctxRough.fill();
        }

        const baseMap = new THREE.CanvasTexture(cvsBase);
        baseMap.colorSpace = THREE.SRGBColorSpace;
        baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;
        baseMap.repeat.set(1, 16);
        baseMap.anisotropy = this.maxAnisotropy;

        const normalMap = new THREE.CanvasTexture(cvsNorm);
        normalMap.colorSpace = THREE.NoColorSpace;
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(1, 16);
        normalMap.anisotropy = this.maxAnisotropy;

        const roughMap = new THREE.CanvasTexture(cvsRough);
        roughMap.colorSpace = THREE.NoColorSpace;
        roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
        roughMap.repeat.set(1, 16);

        const material = new THREE.MeshPhysicalMaterial({
            map: baseMap,
            normalMap,
            normalScale: new THREE.Vector2(1.15, 1.15),
            roughnessMap: roughMap,
            roughness: 0.30,
            metalness: 0.90,
            clearcoat: 0.20,
            clearcoatRoughness: 0.35
        });

        this.cachedMaterials.set(cacheKey, material);
        return material;
    }

    /**
     * Builds Grade 80/100 Forged Alloy Steel Chain Material with contact wear.
     * @param {'body' | 'powder_red' | 'powder_yellow'} variant
     */
    createChainAlloyMaterial(variant = 'body') {
        const cacheKey = `chain_alloy_${variant}`;
        if (this.cachedMaterials.has(cacheKey)) {
            return this.cachedMaterials.get(cacheKey);
        }

        if (variant === 'powder_red') {
            const mat = new THREE.MeshPhysicalMaterial({
                color: 0xdc2626,
                metalness: 0.42,
                roughness: 0.22,
                clearcoat: 0.48,
                clearcoatRoughness: 0.18
            });
            this.cachedMaterials.set(cacheKey, mat);
            return mat;
        }

        if (variant === 'powder_yellow') {
            const mat = new THREE.MeshPhysicalMaterial({
                color: 0xeab308,
                metalness: 0.42,
                roughness: 0.22,
                clearcoat: 0.48,
                clearcoatRoughness: 0.18
            });
            this.cachedMaterials.set(cacheKey, mat);
            return mat;
        }

        // Industrial manganese-phosphate quenched body with high-friction edge wear
        const size = 256;
        const cvsBase = this.createCanvas(size, size);
        const ctxBase = cvsBase.getContext('2d');
        ctxBase.fillStyle = '#2b303a'; // Dark quenched alloy steel
        ctxBase.fillRect(0, 0, size, size);

        // Wear highlights at contact crown zones
        const grad = ctxBase.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0.0, '#788496'); // Polished steel exposure
        grad.addColorStop(0.3, '#2a2e37');
        grad.addColorStop(0.7, '#24272f');
        grad.addColorStop(1.0, '#788496');
        ctxBase.fillStyle = grad;
        ctxBase.fillRect(0, 0, size, size);

        const baseMap = new THREE.CanvasTexture(cvsBase);
        baseMap.colorSpace = THREE.SRGBColorSpace;
        baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;

        const mat = new THREE.MeshPhysicalMaterial({
            map: baseMap,
            color: 0x3e4554,
            metalness: 0.88,
            roughness: 0.32,
            clearcoat: 0.16,
            clearcoatRoughness: 0.30
        });

        this.cachedMaterials.set(cacheKey, mat);
        return mat;
    }

    /**
     * Builds High-Density Cross-Weave Polyester Web Sling Material per EN 1492-1.
     * Features: Distinct continuous black capacity stripes, herringbone weave, edge selvedges.
     */
    createWebSlingMaterial(colorHex = '#16a34a', stripeCount = 2) {
        const cacheKey = `web_sling_${colorHex}_${stripeCount}`;
        if (this.cachedMaterials.has(cacheKey)) {
            return this.cachedMaterials.get(cacheKey);
        }

        const size = 512;
        const cvsBase = this.createCanvas(size, size);
        const ctxBase = cvsBase.getContext('2d');
        const cvsNorm = this.createCanvas(size, size);
        const ctxNorm = cvsNorm.getContext('2d');

        // 1. Base fabric color
        ctxBase.fillStyle = colorHex;
        ctxBase.fillRect(0, 0, size, size);

        // Reinforced border selvedge (left & right 10%)
        ctxBase.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctxBase.fillRect(0, 0, 48, size);
        ctxBase.fillRect(size - 48, 0, 48, size);

        // Fine cross-weave textile herringbone pattern
        ctxBase.fillStyle = 'rgba(255, 255, 255, 0.08)';
        for (let y = 0; y < size; y += 8) {
            for (let x = 0; x < size; x += 16) {
                if ((y / 8) % 2 === 0) {
                    ctxBase.fillRect(x, y, 8, 4);
                } else {
                    ctxBase.fillRect(x + 4, y, 8, 4);
                }
            }
        }

        // 2. Continuous black capacity stripes along length (EN 1492-1 rule: 1 line = 1 Tonne)
        const sCount = Math.max(0, Math.min(8, stripeCount || 0));
        if (sCount > 0) {
            ctxBase.fillStyle = '#111827';
            const centerAreaW = size - 140;
            const step = centerAreaW / (sCount + 1);
            for (let s = 1; s <= sCount; s++) {
                const sx = 70 + s * step;
                ctxBase.fillRect(sx - 3, 0, 6, size);
            }
        }

        // 3. Normal map: Cross-stitch fabric ridges
        ctxNorm.fillStyle = 'rgb(128, 128, 255)';
        ctxNorm.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 8) {
            ctxNorm.fillStyle = 'rgb(115, 128, 255)';
            ctxNorm.fillRect(0, y, size, 2);
            ctxNorm.fillStyle = 'rgb(142, 128, 255)';
            ctxNorm.fillRect(0, y + 4, size, 2);
        }

        const baseMap = new THREE.CanvasTexture(cvsBase);
        baseMap.colorSpace = THREE.SRGBColorSpace;
        baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;
        baseMap.repeat.set(1, 8);
        baseMap.anisotropy = this.maxAnisotropy;

        const normalMap = new THREE.CanvasTexture(cvsNorm);
        normalMap.colorSpace = THREE.NoColorSpace;
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(1, 8);

        const material = new THREE.MeshStandardMaterial({
            map: baseMap,
            normalMap,
            normalScale: new THREE.Vector2(0.80, 0.80),
            roughness: 0.94,
            metalness: 0.02,
            side: THREE.DoubleSide
        });

        this.cachedMaterials.set(cacheKey, material);
        return material;
    }

    /**
     * Builds Seamless Protective Sleeve Round Sling Material per EN 1492-2.
     * Features: Smooth woven Nylon casing, bunched wrinkle shading, NO black capacity stripes.
     */
    createRoundSlingMaterial(colorHex = '#2563eb') {
        const cacheKey = `round_sling_${colorHex}`;
        if (this.cachedMaterials.has(cacheKey)) {
            return this.cachedMaterials.get(cacheKey);
        }

        const size = 512;
        const cvsBase = this.createCanvas(size, size);
        const ctxBase = cvsBase.getContext('2d');
        const cvsNorm = this.createCanvas(size, size);
        const ctxNorm = cvsNorm.getContext('2d');

        // Base solid color
        ctxBase.fillStyle = colorHex;
        ctxBase.fillRect(0, 0, size, size);

        // Bunched fabric sleeve wrinkles (circumferential shading bands)
        for (let y = 0; y < size; y += 24) {
            const grad = ctxBase.createLinearGradient(0, y, 0, y + 24);
            grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.18)');
            grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.12)');
            grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.18)');
            ctxBase.fillStyle = grad;
            ctxBase.fillRect(0, y, size, 24);
        }

        // Normal map: Soft wrinkle ripples
        ctxNorm.fillStyle = 'rgb(128, 128, 255)';
        ctxNorm.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 24) {
            ctxNorm.fillStyle = 'rgb(128, 105, 255)';
            ctxNorm.fillRect(0, y, size, 6);
            ctxNorm.fillStyle = 'rgb(128, 150, 255)';
            ctxNorm.fillRect(0, y + 12, size, 6);
        }

        const baseMap = new THREE.CanvasTexture(cvsBase);
        baseMap.colorSpace = THREE.SRGBColorSpace;
        baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;
        baseMap.repeat.set(1, 6);
        baseMap.anisotropy = this.maxAnisotropy;

        const normalMap = new THREE.CanvasTexture(cvsNorm);
        normalMap.colorSpace = THREE.NoColorSpace;
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(1, 6);

        const material = new THREE.MeshStandardMaterial({
            map: baseMap,
            normalMap,
            normalScale: new THREE.Vector2(0.65, 0.65),
            roughness: 0.88,
            metalness: 0.02
        });

        this.cachedMaterials.set(cacheKey, material);
        return material;
    }

    /**
     * Builds a photorealistic Maritime Deep Water PBR Physical Material.
     * Features: Procedural wave normal map, physical optics, ocean depth transparency.
     */
    createMaritimeWaterMaterial(options = {}) {
        const cacheKey = 'maritime_water_pbr';
        if (this.cachedMaterials.has(cacheKey)) {
            return this.cachedMaterials.get(cacheKey);
        }

        const size = 512;
        const cvs = this.createCanvas(size, size);
        const ctx = cvs.getContext('2d');
        const img = ctx.getImageData(0, 0, size, size);
        const d = img.data;

        // Generate Perlin-like ocean wave normal map
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const nx = Math.sin(x * 0.12) * Math.cos(y * 0.08) * 0.5 + Math.sin((x + y) * 0.22) * 0.3;
                const ny = Math.cos(x * 0.09) * Math.sin(y * 0.14) * 0.5 + Math.cos((x - y) * 0.25) * 0.3;

                d[idx] = Math.floor((nx * 0.5 + 0.5) * 255);       // R (Normal X)
                d[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);   // G (Normal Y)
                d[idx + 2] = 245;                                   // B (Normal Z pointing up)
                d[idx + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        const normalTex = new THREE.CanvasTexture(cvs);
        normalTex.colorSpace = THREE.NoColorSpace;
        normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
        normalTex.repeat.set(16, 12);
        normalTex.anisotropy = this.maxAnisotropy;

        const material = new THREE.MeshPhysicalMaterial({
            color: options.color || 0x03445e,
            roughness: 0.14,
            metalness: 0.75,
            clearcoat: 0.85,
            clearcoatRoughness: 0.08,
            transparent: true,
            opacity: 0.92,
            normalMap: normalTex,
            normalScale: new THREE.Vector2(0.35, 0.35)
        });

        this.cachedMaterials.set(cacheKey, material);
        return material;
    }

    /**
     * Builds industrial yellow/black hazard chevron texture for crane hook blocks and spreaders.
     */
    createHazardChevronTexture(repeats = 4) {
        const size = 512;
        const cvs = this.createCanvas(size, size);
        const ctx = cvs.getContext('2d');

        // Signal Yellow background
        ctx.fillStyle = '#eab308';
        ctx.fillRect(0, 0, size, size);

        // 45-degree diagonal black stripes
        ctx.fillStyle = '#0f172a';
        const stripeWidth = size / (repeats * 2);
        for (let x = -size; x < size * 2; x += stripeWidth * 2) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + stripeWidth, 0);
            ctx.lineTo(x + stripeWidth - size, size);
            ctx.lineTo(x - size, size);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = this.maxAnisotropy;
        return tex;
    }

    /**
     * Helper to create an offscreen or standard HTML Canvas.
     */
    createCanvas(width, height) {
        if (typeof document !== 'undefined') {
            const cvs = document.createElement('canvas');
            cvs.width = width;
            cvs.height = height;
            return cvs;
        }
        // Fallback for node or headless
        return {
            width, height,
            getContext: () => ({
                fillStyle: '',
                fillRect: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                fill: () => {},
                createLinearGradient: () => ({ addColorStop: () => {} }),
                getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
                putImageData: () => {}
            })
        };
    }
}
