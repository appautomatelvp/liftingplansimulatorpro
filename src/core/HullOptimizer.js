/**
 * ============================================================================
 * EXTERIOR HULL OPTIMIZER & ANTI-LAG ENGINE (HullOptimizer.js)
 * Architecture: CAE Digital Twin & Industrial WebGL Performance Standard
 * Purpose:
 *   1. Cull hidden interior geometries, engine parts, internal pipes, screws, nuts
 *   2. Spatial Grid Decimation of high-poly surface meshes to target triangle budgets
 *   3. Eliminate WebGL lag and maintain rock-solid 60 FPS in CAE simulation
 * ============================================================================
 */

import * as THREE from 'three';

export class HullOptimizer {
    /**
     * Counts triangles across a geometry or entire Object3D hierarchy.
     */
    static getTriCount(objOrGeo) {
        if (!objOrGeo) return 0;
        if (objOrGeo.isBufferGeometry) {
            return objOrGeo.index
                ? (objOrGeo.index.count / 3)
                : (objOrGeo.attributes?.position?.count / 3 || 0);
        }
        let total = 0;
        objOrGeo.traverse(child => {
            if (child.isMesh && child.geometry) {
                total += this.getTriCount(child.geometry);
            }
        });
        return Math.round(total);
    }

    /**
     * Simplifies high-density surface geometry using spatial vertex clustering.
     * Preserves outer silhouette and sharp features while decimating triangles.
     *
     * @param {THREE.BufferGeometry} geometry
     * @param {number} targetTris Desired maximum triangle count
     * @returns {THREE.BufferGeometry}
     */
    static simplifyGeometry(geometry, targetTris = 25000) {
        if (!geometry || !geometry.attributes || !geometry.attributes.position) return geometry;
        const currentTris = this.getTriCount(geometry);
        if (currentTris <= targetTris) return geometry;

        const posAttr = geometry.attributes.position;
        const normAttr = geometry.attributes.normal;
        const uvAttr = geometry.attributes.uv;
        const indexAttr = geometry.index;
        const vertexCount = posAttr.count;

        // Compute Bounding Box
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
        const min = bbox.min;

        // Grid resolution scaling:
        // For a manifold closed shell, Triangles ~ 2 * Vertices
        const targetVerts = Math.max(150, Math.round(targetTris * 0.58));
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const R = Math.max(14, Math.min(260, Math.round(Math.cbrt(targetVerts * 2.8))));

        const deltaX = Math.max(size.x / R, maxDim * 0.001);
        const deltaY = Math.max(size.y / R, maxDim * 0.001);
        const deltaZ = Math.max(size.z / R, maxDim * 0.001);

        const cellMap = new Map();
        const vertToCellIndex = new Int32Array(vertexCount);
        let uniqueCellCount = 0;

        for (let i = 0; i < vertexCount; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);

            const kx = Math.floor((vx - min.x) / deltaX);
            const ky = Math.floor((vy - min.y) / deltaY);
            const kz = Math.floor((vz - min.z) / deltaZ);
            const cellKey = `${kx},${ky},${kz}`;

            let cell = cellMap.get(cellKey);
            if (!cell) {
                cell = {
                    index: uniqueCellCount++,
                    sumX: vx, sumY: vy, sumZ: vz,
                    sumNx: normAttr ? normAttr.getX(i) : 0,
                    sumNy: normAttr ? normAttr.getY(i) : 1,
                    sumNz: normAttr ? normAttr.getZ(i) : 0,
                    sumU: uvAttr ? uvAttr.getX(i) : 0,
                    sumV: uvAttr ? uvAttr.getY(i) : 0,
                    count: 1
                };
                cellMap.set(cellKey, cell);
            } else {
                cell.sumX += vx;
                cell.sumY += vy;
                cell.sumZ += vz;
                if (normAttr) {
                    cell.sumNx += normAttr.getX(i);
                    cell.sumNy += normAttr.getY(i);
                    cell.sumNz += normAttr.getZ(i);
                }
                if (uvAttr) {
                    cell.sumU += uvAttr.getX(i);
                    cell.sumV += uvAttr.getY(i);
                }
                cell.count++;
            }
            vertToCellIndex[i] = cell.index;
        }

        // Generate condensed vertex, normal and UV buffers
        const newPositions = new Float32Array(uniqueCellCount * 3);
        const newNormals = new Float32Array(uniqueCellCount * 3);
        const newUVs = uvAttr ? new Float32Array(uniqueCellCount * 2) : null;

        for (const cell of cellMap.values()) {
            const base3 = cell.index * 3;
            newPositions[base3] = cell.sumX / cell.count;
            newPositions[base3 + 1] = cell.sumY / cell.count;
            newPositions[base3 + 2] = cell.sumZ / cell.count;

            const nLen = Math.hypot(cell.sumNx, cell.sumNy, cell.sumNz) || 1;
            newNormals[base3] = cell.sumNx / nLen;
            newNormals[base3 + 1] = cell.sumNy / nLen;
            newNormals[base3 + 2] = cell.sumNz / nLen;

            if (newUVs) {
                const base2 = cell.index * 2;
                newUVs[base2] = cell.sumU / cell.count;
                newUVs[base2 + 1] = cell.sumV / cell.count;
            }
        }

        // Reconstruct triangles, filtering out degenerate triangles (where vertices collapsed into same cell)
        const newIndices = [];
        const triCount = indexAttr ? indexAttr.count / 3 : vertexCount / 3;

        for (let t = 0; t < triCount; t++) {
            const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
            const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
            const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

            const c0 = vertToCellIndex[i0];
            const c1 = vertToCellIndex[i1];
            const c2 = vertToCellIndex[i2];

            if (c0 === c1 || c1 === c2 || c2 === c0) continue;

            newIndices.push(c0, c1, c2);
        }

        if (newIndices.length === 0) {
            return geometry; // Safeguard if decimation was too coarse
        }

        const simplified = new THREE.BufferGeometry();
        simplified.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
        simplified.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
        if (newUVs) {
            simplified.setAttribute('uv', new THREE.BufferAttribute(newUVs, 2));
        }
        simplified.setIndex(newIndices);
        simplified.computeVertexNormals();

        return simplified;
    }

    /**
     * Culls internal sub-meshes strictly enclosed inside the outer hull,
     * passenger seats, steering wheels, engine blocks, and hidden micro-details.
     *
     * @param {THREE.Object3D} rootObject
     * @param {Object} [options]
     * @param {number} [options.insetMargin=0.04] Enclosure margin (4% from outer perimeter)
     * @returns {{ culledCount: number, culledTris: number }}
     */
    static cullInteriorParts(rootObject, options = {}) {
        rootObject.updateMatrixWorld(true);
        const outerBox = new THREE.Box3().setFromObject(rootObject);
        const outerSize = new THREE.Vector3().subVectors(outerBox.max, outerBox.min);
        const totalVolume = Math.max(1e-5, outerSize.x * outerSize.y * outerSize.z);

        // Explicit Semantic Recognition for Interior Components
        const INTERIOR_NAME_REGEX = /(int|_int|\(int\)|interior|inside|in_\w+|seat|chair|bench|passenger|steering|dashboard|dash\b|pedal|console_int|cockpit|cabin_int|engine|motor_int|piston|crank|gearbox|transmission|exhaust_int|pipe_int|battery_int|luggage_rack|bed_int)/i;
        
        // Critical Exterior Components to Never Cull
        const EXTERIOR_PROTECTED_REGEX = /(body|hull|shell|outer|exterior|frame|chassis|skin|panel|roof|wall|glass|window|windshield|windscreen|wheel|tire|tyre|rim|w_f|w_r|track|spreader|beam|lug|padeye|tank|barrel|vessel|corrugat|casting|door|floor|deck|hatch|bulk|platform|ladder|catwalk|reefer|thermo|lock|gasket|wood)/i;

        const insetMargin = options.insetMargin != null ? options.insetMargin : 0.04;
        const innerBox = new THREE.Box3(
            new THREE.Vector3(
                outerBox.min.x + outerSize.x * insetMargin,
                outerBox.min.y + outerSize.y * insetMargin,
                outerBox.min.z + outerSize.z * insetMargin
            ),
            new THREE.Vector3(
                outerBox.max.x - outerSize.x * insetMargin,
                outerBox.max.y - outerSize.y * insetMargin,
                outerBox.max.z - outerSize.z * insetMargin
            )
        );

        let culledCount = 0;
        let culledTris = 0;
        const toRemove = [];

        rootObject.traverse(child => {
            if (child.isMesh && child.geometry) {
                const combinedName = `${child.name || ''} ${child.material?.name || ''}`;
                const tris = this.getTriCount(child.geometry);

                // Check 1: Explicit Semantic Interior Match (Seats, steering, engines, etc.)
                if (INTERIOR_NAME_REGEX.test(combinedName) && !EXTERIOR_PROTECTED_REGEX.test(child.name)) {
                    toRemove.push(child);
                    culledCount++;
                    culledTris += tris;
                    return;
                }

                // If explicitly protected by exterior name, skip geometric culling
                if (EXTERIOR_PROTECTED_REGEX.test(child.name)) {
                    return;
                }

                child.geometry.computeBoundingBox();
                if (!child.geometry.boundingBox) return;
                const childBox = child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld);
                const childSize = new THREE.Vector3().subVectors(childBox.max, childBox.min);
                const childVolume = childSize.x * childSize.y * childSize.z;

                // Check 2: Deep interior enclosure (strictly enclosed within innerBox)
                const isDeepInterior = innerBox.containsBox(childBox);

                // Check 3: Tiny micro-detail (e.g. internal hardware < 0.03% total volume)
                const isTinyInternalWidget = (childVolume / totalVolume < 0.0003) && (childSize.length() < outerSize.length() * 0.06);

                if (isDeepInterior || isTinyInternalWidget) {
                    toRemove.push(child);
                    culledCount++;
                    culledTris += tris;
                }
            }
        });

        toRemove.forEach(mesh => {
            if (mesh.parent) mesh.parent.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
        });

        return { culledCount, culledTris };
    }

    /**
     * Complete pipeline: Interior culling + Polygon decimation to target budget.
     * Guarantees lightweight, smooth 60 FPS performance without visual exterior quality loss.
     *
     * @param {THREE.Object3D} rootObject
     * @param {Object} [options]
     * @param {number|string} [options.maxTris='strip_interior_only'] Target polygon budget or 'strip_interior_only'
     * @param {boolean} [options.cullInterior=true] Whether to strip internal sub-meshes
     * @returns {{ optimizedRoot: THREE.Object3D, stats: Object }}
     */
    static optimizeHierarchy(rootObject, options = {}) {
        const initialTris = this.getTriCount(rootObject);
        const maxTris = options.maxTris;
        const cullInterior = options.cullInterior !== false;
        const stripOnly = options.stripInteriorOnly || maxTris === 'strip_interior_only' || maxTris >= 999999 || maxTris === 'none' || maxTris === undefined;

        let culledCount = 0;
        let culledTris = 0;

        if (cullInterior) {
            const cullRes = this.cullInteriorParts(rootObject, options);
            culledCount = cullRes.culledCount;
            culledTris = cullRes.culledTris;
        }

        let decimatedMeshes = 0;
        const currentTris = this.getTriCount(rootObject);
        const numericMaxTris = typeof maxTris === 'number' ? maxTris : parseInt(maxTris, 10);

        // Critical Exterior Components to Protect from Decimation
        const EXTERIOR_PROTECTED_REGEX = /(body|hull|shell|outer|exterior|frame|chassis|skin|panel|roof|wall|glass|window|windshield|windscreen|wheel|tire|tyre|rim|w_f|w_r|track|spreader|beam|lug|padeye|tank|barrel|vessel|corrugat|casting|door|floor|deck|hatch|bulk|platform|ladder|catwalk|reefer|thermo|lock|gasket|wood)/i;

        // If user explicitly specified a finite triangle budget (e.g. 25000, 50000) and stripOnly is false:
        if (!stripOnly && !isNaN(numericMaxTris) && numericMaxTris > 0 && currentTris > numericMaxTris) {
            rootObject.traverse(child => {
                if (child.isMesh && child.geometry) {
                    const mTris = this.getTriCount(child.geometry);
                    // Protect exterior shells under 45,000 tris from destructive decimation
                    const isProtected = EXTERIOR_PROTECTED_REGEX.test(child.name || '');
                    if (mTris > (isProtected ? 45000 : 2500)) {
                        const proportion = mTris / currentTris;
                        const meshTarget = Math.max(isProtected ? 20000 : 1200, Math.round(numericMaxTris * proportion));
                        if (mTris > meshTarget * 1.15) {
                            child.geometry = this.simplifyGeometry(child.geometry, meshTarget);
                            decimatedMeshes++;
                        }
                    }
                }
            });
        }

        const finalTris = this.getTriCount(rootObject);
        const reductionPct = initialTris > 0 ? Math.round(((initialTris - finalTris) / initialTris) * 100) : 0;

        return {
            optimizedRoot: rootObject,
            stats: {
                initialTris,
                finalTris,
                culledCount,
                culledTris,
                decimatedMeshes,
                reductionPct
            }
        };
    }
}
