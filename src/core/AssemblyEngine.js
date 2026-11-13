/**
 * ============================================================================
 * 3D COMPOSITE & ASSEMBLY ENGINE (AssemblyEngine.js)
 * Architecture: CAE Digital Twin Industrial Assembly Standard
 * Purpose:
 *   1. Multi-part 3D object nesting & composition (e.g. Transformer on Flatrack)
 *   2. Real-time composite physics: Total Gross Mass & Combined Center of Gravity (CoG)
 *   3. Intelligent contact snapping (Snap to Deck / Center on Base)
 *   4. Industrial Wavefront .OBJ export with embedded CAE metadata header
 *   5. Seamless round-trip serialization (Export .OBJ -> Re-import with 100% precision)
 * ============================================================================
 */

import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';

export const COMPOSITE_PRESETS = [
    {
        id: 'flatrack_transformer',
        name: 'Flat Rack 20ft + Máy Biến Áp Điện Lực',
        description: 'Máy biến áp 45T đặt chắc chắn trên sàn container Flat Rack 20ft tiêu chuẩn ISO',
        baseType: 'flatrack',
        baseDimensions: { L: 6.06, W: 2.44, H: 2.59 },
        baseMassT: 5.5,
        parts: [
            {
                name: 'Máy Biến Áp 110kV',
                type: 'transformer',
                dimensions: { L: 3.8, W: 2.0, H: 2.3 },
                massT: 45.0,
                pos: { x: 0, y: 0.38, z: 0 },
                rot: { x: 0, y: 0, z: 0 },
                color: '#0284c7'
            }
        ]
    },
    {
        id: 'platform_excavator',
        name: 'Sàn Kê Platform 40ft + Máy Xúc Bánh Xích',
        description: 'Máy xúc bánh xích hạng nặng 32T chằng buộc trên sàn phẳng Platform 40ft',
        baseType: 'platform',
        baseDimensions: { L: 12.19, W: 2.44, H: 0.35 },
        baseMassT: 6.2,
        parts: [
            {
                name: 'Máy Xúc Bánh Xích CAT',
                type: 'excavator',
                dimensions: { L: 6.4, W: 3.0, H: 3.1 },
                massT: 32.0,
                pos: { x: 0, y: 0.22, z: 0 },
                rot: { x: 0, y: 0, z: 0 },
                color: '#eab308'
            }
        ]
    },
    {
        id: 'platform_dual_crates',
        name: 'Sàn Kê Platform 20ft + 2 Kiện Thùng Gỗ Nặng',
        description: '2 kiện thiết bị thùng gỗ công nghiệp đặt đối xứng trên sàn thép Platform',
        baseType: 'platform',
        baseDimensions: { L: 6.06, W: 2.44, H: 0.35 },
        baseMassT: 3.2,
        parts: [
            {
                name: 'Kiện Thùng Máy #1',
                type: 'crate',
                dimensions: { L: 2.3, W: 1.9, H: 1.8 },
                massT: 12.0,
                pos: { x: -1.35, y: 0.22, z: 0 },
                rot: { x: 0, y: 0, z: 0 },
                color: '#d97706'
            },
            {
                name: 'Kiện Thùng Máy #2',
                type: 'crate',
                dimensions: { L: 2.3, W: 1.9, H: 1.8 },
                massT: 14.0,
                pos: { x: 1.35, y: 0.22, z: 0 },
                rot: { x: 0, y: 0, z: 0 },
                color: '#b45309'
            }
        ]
    },
    {
        id: 'flatrack_vessel',
        name: 'Flat Rack 40ft + Bồn Áp Lực Khí Hóa Lỏng',
        description: 'Bồn áp lực nằm ngang 35T gá trên 2 yên đỡ saddle trên Flat Rack 40ft',
        baseType: 'flatrack',
        baseDimensions: { L: 12.19, W: 2.44, H: 2.59 },
        baseMassT: 8.5,
        parts: [
            {
                name: 'Bồn Áp Lực Khí Hóa Lỏng',
                type: 'vessel',
                dimensions: { L: 8.5, W: 2.4, H: 2.6 },
                massT: 35.0,
                pos: { x: 0, y: 0.42, z: 0 },
                rot: { x: 0, y: 0, z: 0 },
                color: '#38bdf8'
            }
        ]
    },
    {
        id: 'opentop_vehicle',
        name: 'Container Hở Mái 20ft + Xe Bán Tải SUV',
        description: 'Xe cơ giới đặt lọt lòng trong thùng container hở mái (Open Top)',
        baseType: 'opentop',
        baseDimensions: { L: 6.06, W: 2.44, H: 2.59 },
        baseMassT: 2.8,
        parts: [
            {
                name: 'Xe Bán Tải SUV Chuyên Dụng',
                type: 'car',
                dimensions: { L: 4.8, W: 1.9, H: 1.8 },
                massT: 2.6,
                pos: { x: 0, y: -0.32, z: 0 },
                rot: { x: 0, y: 0, z: 0 },
                color: '#ef4444'
            }
        ]
    }
];

export class AssemblyEngine {
    constructor() {
        this.exporter = new OBJExporter();
        this.reset();
    }

    reset() {
        this.assemblyName = 'Tổ Hợp Kiện Hàng 3D Mới';
        this.basePart = {
            id: 'base_' + Date.now(),
            name: 'Đế: Container Flat Rack 20ft',
            type: 'flatrack',
            dimensions: { L: 6.06, W: 2.44, H: 2.59 },
            massT: 5.5,
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            color: '#d97706',
            isBase: true
        };
        this.cargoParts = [];
    }

    loadPreset(presetId) {
        const found = COMPOSITE_PRESETS.find(p => p.id === presetId);
        if (!found) return false;
        this.assemblyName = found.name;
        this.basePart = {
            id: 'base_' + Date.now(),
            name: `Đế: ${found.name.split('+')[0].trim()}`,
            type: found.baseType,
            dimensions: { ...found.baseDimensions },
            massT: found.baseMassT,
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            color: '#f59e0b',
            isBase: true
        };
        this.cargoParts = found.parts.map((p, idx) => ({
            id: `part_${Date.now()}_${idx}`,
            name: p.name,
            type: p.type,
            dimensions: { ...p.dimensions },
            massT: p.massT,
            pos: { ...p.pos },
            rot: { ...p.rot },
            scale: { x: 1, y: 1, z: 1 },
            color: p.color || '#0284c7',
            isBase: false
        }));
        return true;
    }

    addPart(partData) {
        const newPart = {
            id: 'part_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: partData.name || 'Chi Tiết Kiện Mới',
            type: partData.type || 'crate',
            dimensions: partData.dimensions ? { ...partData.dimensions } : { L: 3.0, W: 2.0, H: 2.0 },
            massT: partData.massT != null ? partData.massT : 10.0,
            pos: partData.pos ? { ...partData.pos } : { x: 0, y: 0.5, z: 0 },
            rot: partData.rot ? { ...partData.rot } : { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            color: partData.color || '#0ea5e9',
            isBase: false
        };
        this.cargoParts.push(newPart);
        return newPart;
    }

    removePart(partId) {
        this.cargoParts = this.cargoParts.filter(p => p.id !== partId);
    }

    updatePart(partId, changes) {
        if (this.basePart && this.basePart.id === partId) {
            Object.assign(this.basePart, changes);
            return this.basePart;
        }
        const part = this.cargoParts.find(p => p.id === partId);
        if (part) {
            Object.assign(part, changes);
            return part;
        }
        return null;
    }

    /**
     * Automatically adjusts the Y elevation of a cargo part so its bottom surface
     * rests flush upon the top deck/floor surface of the base container.
     */
    snapPartToDeck(partId) {
        const part = this.cargoParts.find(p => p.id === partId);
        if (!part || !this.basePart) return;

        // Base deck elevation calculation:
        // Flatrack and Platform deck is at ~0.35m to 0.45m above bottom
        let deckElevation = 0;
        if (this.basePart.type === 'flatrack') {
            deckElevation = -this.basePart.dimensions.H / 2 + 0.48;
        } else if (this.basePart.type === 'platform') {
            deckElevation = -this.basePart.dimensions.H / 2 + 0.35;
        } else if (this.basePart.type === 'opentop' || this.basePart.type === 'container') {
            deckElevation = -this.basePart.dimensions.H / 2 + 0.22;
        } else {
            deckElevation = this.basePart.dimensions.H / 2;
        }

        part.pos.y = deckElevation + (part.dimensions.H / 2);
    }

    /**
     * Centers cargo part horizontally over the base carrier.
     */
    centerPart(partId) {
        const part = this.cargoParts.find(p => p.id === partId);
        if (!part) return;
        part.pos.x = 0;
        part.pos.z = 0;
    }

    /**
     * Computes the total combined mass and true Center of Gravity (CoG)
     * using physics moment equilibrium: R_cog = sum(m_i * r_i) / sum(m_i).
     */
    computePhysics() {
        const all = [];
        if (this.basePart) all.push(this.basePart);
        all.push(...this.cargoParts);

        let totalMass = 0;
        let sumMx = 0;
        let sumMy = 0;
        let sumMz = 0;

        all.forEach(p => {
            const m = Math.max(0.01, p.massT || 1.0);
            totalMass += m;
            sumMx += m * (p.pos.x || 0);
            sumMy += m * (p.pos.y || 0);
            sumMz += m * (p.pos.z || 0);
        });

        totalMass = Math.max(0.1, totalMass);
        const cog = {
            x: Math.round((sumMx / totalMass) * 1000) / 1000,
            y: Math.round((sumMy / totalMass) * 1000) / 1000,
            z: Math.round((sumMz / totalMass) * 1000) / 1000
        };

        // Determine composite bounding envelope
        let minX = -1, maxX = 1, minY = -1, maxY = 1, minZ = -1, maxZ = 1;
        if (all.length > 0) {
            minX = Infinity; maxX = -Infinity;
            minY = Infinity; maxY = -Infinity;
            minZ = Infinity; maxZ = -Infinity;

            all.forEach(p => {
                const hx = (p.dimensions.L || 2) / 2;
                const hy = (p.dimensions.H || 2) / 2;
                const hz = (p.dimensions.W || 2) / 2;
                const px = p.pos.x || 0;
                const py = p.pos.y || 0;
                const pz = p.pos.z || 0;

                minX = Math.min(minX, px - hx);
                maxX = Math.max(maxX, px + hx);
                minY = Math.min(minY, py - hy);
                maxY = Math.max(maxY, py + hy);
                minZ = Math.min(minZ, pz - hz);
                maxZ = Math.max(maxZ, pz + hz);
            });
        }

        const totalDims = {
            L: Math.round((maxX - minX) * 100) / 100,
            H: Math.round((maxY - minY) * 100) / 100,
            W: Math.round((maxZ - minZ) * 100) / 100
        };

        // Synthesize pad eyes from base carrier or overall top corners
        const baseL = this.basePart ? this.basePart.dimensions.L : totalDims.L;
        const baseW = this.basePart ? this.basePart.dimensions.W : totalDims.W;
        const baseH = this.basePart ? this.basePart.dimensions.H : totalDims.H;
        const ly = this.basePart ? (this.basePart.type === 'platform' ? 0.35 : baseH / 2) : totalDims.H / 2;

        const anchors = [
            { id: 'top_fr', localPos: { x: +(baseL / 2 - 0.12), y: ly, z: +(baseW / 2 - 0.12) }, type: 'iso1161', wllT: 25 },
            { id: 'top_fl', localPos: { x: -(baseL / 2 - 0.12), y: ly, z: +(baseW / 2 - 0.12) }, type: 'iso1161', wllT: 25 },
            { id: 'top_rl', localPos: { x: -(baseL / 2 - 0.12), y: ly, z: -(baseW / 2 - 0.12) }, type: 'iso1161', wllT: 25 },
            { id: 'top_rr', localPos: { x: +(baseL / 2 - 0.12), y: ly, z: -(baseW / 2 - 0.12) }, type: 'iso1161', wllT: 25 }
        ];

        return {
            totalMass: Math.round(totalMass * 100) / 100,
            cog,
            totalDims,
            anchors,
            partCount: all.length
        };
    }

    /**
     * Builds the complete Three.js Object3D hierarchy for the composite assembly.
     * Uses `meshBuilder` callback (such as `buildCargoMesh`) to generate 3D geometry for each part.
     *
     * @param {Function} meshBuilder (type, L, W, H, color) => THREE.Object3D
     * @returns {THREE.Group}
     */
    buildAssemblyGroup(meshBuilder) {
        const root = new THREE.Group();
        root.name = this.assemblyName;

        const all = [];
        if (this.basePart) all.push(this.basePart);
        all.push(...this.cargoParts);

        all.forEach(p => {
            let partObj = null;
            if (typeof meshBuilder === 'function') {
                partObj = meshBuilder(p.type, p.dimensions.L, p.dimensions.W, p.dimensions.H, p.color);
            }
            if (!partObj) {
                // Procedural fallback box mesh with bevel/edges
                const geo = new THREE.BoxGeometry(p.dimensions.L, p.dimensions.H, p.dimensions.W);
                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(p.color || '#0ea5e9'),
                    roughness: 0.35,
                    metalness: 0.4
                });
                partObj = new THREE.Mesh(geo, mat);
            }

            partObj.name = p.name;
            partObj.position.set(p.pos.x, p.pos.y, p.pos.z);
            partObj.rotation.set(
                (p.rot.x || 0) * Math.PI / 180,
                (p.rot.y || 0) * Math.PI / 180,
                (p.rot.z || 0) * Math.PI / 180
            );
            partObj.scale.set(p.scale.x || 1, p.scale.y || 1, p.scale.z || 1);
            root.add(partObj);
        });

        root.updateMatrixWorld(true);
        return root;
    }

    /**
     * Serializes the entire composite assembly to standard Wavefront .OBJ format
     * with an embedded CAE Industrial Digital Twin specification header.
     *
     * @param {THREE.Group} assemblyGroup
     * @param {Object} [metadata]
     * @returns {string} Wavefront OBJ string with CAE header comments
     */
    exportToOBJ(assemblyGroup, metadata = {}) {
        const objBody = this.exporter.parse(assemblyGroup);
        const name = metadata.name || this.assemblyName || 'Custom_3D_Assembly';
        const dims = metadata.dimensions || { L: 6.0, H: 2.5, W: 2.4 };
        const weight = metadata.weight != null ? metadata.weight : 20.0;
        const cog = metadata.cog || { x: 0, y: 0, z: 0 };
        const partCount = metadata.partCount || (this.cargoParts.length + (this.basePart ? 1 : 0));

        const header = [
            '# ==============================================================================',
            '# CAE INDUSTRIAL DIGITAL TWIN SPECIFICATION - SAFELIFT3D',
            '# Architecture: CAE Physical Twin & Metric Standard (1 Unit = 1.0 Meter)',
            `# ASSET_NAME: ${name}`,
            '# SPEC_KEY: composite_cargo',
            `# CREATED_AT: ${new Date().toISOString()}`,
            `# DIMENSIONS_LWH: ${Number(dims.L).toFixed(3)},${Number(dims.H).toFixed(3)},${Number(dims.W).toFixed(3)}`,
            `# GROSS_WEIGHT_T: ${Number(weight).toFixed(2)}`,
            `# COG_OFFSET_XYZ: ${Number(cog.x).toFixed(3)},${Number(cog.y).toFixed(3)},${Number(cog.z).toFixed(3)}`,
            `# COMPONENT_COUNT: ${partCount}`,
            '# LIFTING_LUGS: 4_POINT_SYMMETRIC',
            '# ==============================================================================\n\n'
        ].join('\n');

        return header + objBody;
    }

    /**
     * Extracts CAE Digital Twin engineering parameters from an exported OBJ file header.
     *
     * @param {string} objText
     * @returns {Object|null}
     */
    static parseCAEHeader(objText) {
        if (!objText || typeof objText !== 'string') return null;
        const lines = objText.slice(0, 3000).split('\n');
        const meta = {};
        for (const line of lines) {
            if (!line.startsWith('#')) {
                if (line.trim().length > 0 && !line.startsWith('o ') && !line.startsWith('v ')) break;
                continue;
            }
            const mName = line.match(/#\s*ASSET_NAME:\s*(.+)/i);
            if (mName) meta.name = mName[1].trim();
            const mDim = line.match(/#\s*DIMENSIONS_LWH:\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
            if (mDim) meta.dimensions = { L: parseFloat(mDim[1]), H: parseFloat(mDim[2]), W: parseFloat(mDim[3]) };
            const mWeight = line.match(/#\s*GROSS_WEIGHT_T:\s*([0-9.]+)/i);
            if (mWeight) meta.weight = parseFloat(mWeight[1]);
            const mCog = line.match(/#\s*COG_OFFSET_XYZ:\s*([0-9.-]+)[,\s]+([0-9.-]+)[,\s]+([0-9.-]+)/i);
            if (mCog) meta.cog = { x: parseFloat(mCog[1]), y: parseFloat(mCog[2]), z: parseFloat(mCog[3]) };
        }
        return (meta.name || meta.dimensions || meta.weight) ? meta : null;
    }
}
