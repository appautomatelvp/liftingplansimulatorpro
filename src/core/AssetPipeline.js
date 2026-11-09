/**
 * ============================================================================
 * ASSET PIPELINE & METRIC SCALE NORMALIZER (AssetPipeline.js)
 * Architecture: Industrial Digital Twin & CAE Physics Standard
 * Metric Scale: Strict 1 Three.js Unit = 1.0 Real-World Meter (SI Metric)
 * Replaces: Arbitrary 3.2m clamping and non-uniform stretching
 * ============================================================================
 */

import * as THREE from 'three';
import { getAssetSpec } from './AssetSpecs.js';
import { HullOptimizer } from './HullOptimizer.js';

export const UNIT_FACTORS = {
    'm': 1.0,
    'mm': 0.001,
    'cm': 0.01,
    'in': 0.0254,
    'ft': 0.3048
};

export class AssetPipeline {
    /**
     * Normalizes an imported 3D Object (GLB/GLTF/OBJ/STL) into strict SI metric scale (1 unit = 1 meter),
     * aligns the coordinate system (Y-up), centers the pivot, and extracts or synthesizes rigging anchors.
     *
     * @param {THREE.Object3D} rootObject Loaded Three.js 3D hierarchy
     * @param {Object} [options]
     * @param {string} [options.specKey] Asset specification identifier (e.g. 'container_20ft', 'sts_gantry_crane')
     * @param {'auto'|'cad_strict'|'ai_fit'} [options.mode='auto'] Scaling strategy
     * @param {'auto'|'m'|'mm'|'cm'|'in'|'ft'} [options.unit='auto'] Source file measurement unit
     * @param {'auto'|'Y'|'Z'} [options.upAxis='auto'] Source file vertical axis
     * @param {boolean} [options.allowAmbiguous=true]
     * @returns {{ root: THREE.Group, report: Object }}
     */
    static normalizeAsset(rootObject, options = {}) {
        const spec = getAssetSpec(options.specKey || 'container_20ft');
        const mode = options.mode || 'auto';
        const requestedUnit = options.unit || 'auto';
        const requestedUpAxis = options.upAxis || 'auto';

        const warnings = [];

        // 1. Audit raw geometry and mesh hierarchy
        rootObject.updateMatrixWorld(true);
        let triCount = 0;
        let meshCount = 0;
        rootObject.traverse(child => {
            if (child.isMesh) {
                meshCount++;
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.geometry) {
                    if (child.geometry.index) {
                        triCount += child.geometry.index.count / 3;
                    } else if (child.geometry.attributes && child.geometry.attributes.position) {
                        triCount += child.geometry.attributes.position.count / 3;
                    }
                }
            }
        });

        if (triCount > 250000) {
            warnings.push(`Mô hình chứa ${Math.round(triCount).toLocaleString()} tam giác (vượt khuyến nghị 250.000 tris). Có thể ảnh hưởng FPS.`);
        }

        // 2. Measure raw unscaled bounding box
        const rawBox = new THREE.Box3().setFromObject(rootObject);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);

        if (rawSize.lengthSq() < 1e-6) {
            return {
                root: rootObject,
                report: {
                    status: 'FAIL',
                    message: 'Mô hình 3D rỗng hoặc không có đỉnh hình học.',
                    warnings
                }
            };
        }

        let targetDim = spec.targetDimensions;
        if (options.targetDimensions) {
            const td = options.targetDimensions;
            targetDim = {
                x: td.x != null ? td.x : (td.L != null ? td.L : targetDim.x),
                y: td.y != null ? td.y : (td.H != null ? td.H : targetDim.y),
                z: td.z != null ? td.z : (td.W != null ? td.W : targetDim.z)
            };
        } else if (options.customDimensions) {
            const cd = options.customDimensions;
            targetDim = {
                x: cd.L != null ? cd.L : targetDim.x,
                y: cd.H != null ? cd.H : targetDim.y,
                z: cd.W != null ? cd.W : targetDim.z
            };
        }

        // 3. Auto-detect Unit and Up-Axis
        const unitCandidates = requestedUnit !== 'auto' ? [requestedUnit] : ['m', 'mm', 'cm', 'in', 'ft'];
        const upCandidates = requestedUpAxis !== 'auto' ? [requestedUpAxis] : ['Y', 'Z'];

        let bestCandidate = null;
        let lowestScore = Infinity;
        let secondLowestScore = Infinity;

        unitCandidates.forEach(u => {
            const factor = UNIT_FACTORS[u];
            upCandidates.forEach(up => {
                // If Z-up, dimensions map: X->X, Y->Z, Z->Y (or X->Z depending on rotation)
                const candidateDims = [
                    // Case A: normal orientation
                    {
                        x: rawSize.x * factor,
                        y: (up === 'Z' ? rawSize.z : rawSize.y) * factor,
                        z: (up === 'Z' ? rawSize.y : rawSize.z) * factor,
                        rotX: up === 'Z' ? -Math.PI / 2 : 0,
                        rotY: 0
                    },
                    // Case B: 90 deg horizontal yaw rotation (swapping length and width)
                    {
                        x: (up === 'Z' ? rawSize.y : rawSize.z) * factor,
                        y: (up === 'Z' ? rawSize.z : rawSize.y) * factor,
                        z: rawSize.x * factor,
                        rotX: up === 'Z' ? -Math.PI / 2 : 0,
                        rotY: Math.PI / 2
                    }
                ];

                candidateDims.forEach(cd => {
                    // Logarithmic error against target dimensions
                    const errX = Math.abs(Math.log(Math.max(1e-4, cd.x) / targetDim.x));
                    const errY = Math.abs(Math.log(Math.max(1e-4, cd.y) / targetDim.y));
                    const errZ = Math.abs(Math.log(Math.max(1e-4, cd.z) / targetDim.z));
                    const score = errX + errY + errZ;

                    if (score < lowestScore) {
                        secondLowestScore = lowestScore;
                        lowestScore = score;
                        bestCandidate = { unit: u, factor, up, rotX: cd.rotX, rotY: cd.rotY, size: cd };
                    } else if (score < secondLowestScore) {
                        secondLowestScore = score;
                    }
                });
            });
        });

        let confidence = 'HIGH';
        if (Math.abs(secondLowestScore - lowestScore) < 0.12 && unitCandidates.length > 1) {
            confidence = 'AMBIGUOUS';
            warnings.push(`Độ tin cậy tự động nhận diện tỷ lệ ở mức trung bình (${bestCandidate.unit} vs khả dĩ khác). Khuyến nghị người dùng xác nhận đơn vị.`);
        }

        // 4. Create Normalized Root Wrapper Group
        const wrapperGroup = new THREE.Group();
        wrapperGroup.name = `normalized_${spec.id}`;

        // Apply rotation to correct up-axis and orientation
        if (bestCandidate.rotX !== 0) {
            rootObject.rotation.x += bestCandidate.rotX;
        }
        if (bestCandidate.rotY !== 0) {
            rootObject.rotation.y += bestCandidate.rotY;
        }

        // Determine uniform scale multiplier
        let appliedUniformScale = bestCandidate.factor;
        const effectiveMode = mode === 'auto'
            ? ((lowestScore < 0.25 || (spec.id === 'generic_cargo' && !options.targetDimensions)) ? 'cad_strict' : 'ai_fit')
            : mode;

        if (effectiveMode === 'ai_fit') {
            // Uniformly scale based on principal axis to preserve geometric aspect ratio (ZERO NON-UNIFORM DISTORTION)
            const sx = targetDim.x / Math.max(1e-4, bestCandidate.size.x / bestCandidate.factor);
            const sy = targetDim.y / Math.max(1e-4, bestCandidate.size.y / bestCandidate.factor);
            const sz = targetDim.z / Math.max(1e-4, bestCandidate.size.z / bestCandidate.factor);
            appliedUniformScale = (sx + sy + sz) / 3;
            warnings.push('Áp dụng chế độ AI_FIT: Chuẩn hóa theo một hệ số đồng dạng duy nhất, giữ nguyên tỷ lệ khung hình thực tế của mô hình.');
        }

        // 4b. Exterior Hull Optimization & Anti-Lag Decimation
        let optStats = null;
        if (options.optimizeHull !== false) {
            const maxTris = options.maxTris !== undefined ? options.maxTris : 'strip_interior_only';
            const optRes = HullOptimizer.optimizeHierarchy(rootObject, {
                maxTris,
                stripInteriorOnly: options.stripInteriorOnly || maxTris === 'strip_interior_only',
                cullInterior: options.cullInterior !== false,
                insetMargin: options.insetMargin != null ? options.insetMargin : 0.04
            });
            optStats = optRes.stats;
            if (optStats && optStats.reductionPct > 0) {
                warnings.push(`⚡ Tối ưu vỏ ngoài: giảm ${optStats.reductionPct}% lưới (${optStats.initialTris.toLocaleString()} ➔ ${optStats.finalTris.toLocaleString()} tris), lọc bỏ ${optStats.culledCount} chi tiết ngầm chống lag.`);
            }
        }

        // Apply scale multiplier
        if (options.forceExactDimensions && bestCandidate.size) {
            const curX = Math.max(1e-4, (bestCandidate.size.x / bestCandidate.factor) * appliedUniformScale);
            const curY = Math.max(1e-4, (bestCandidate.size.y / bestCandidate.factor) * appliedUniformScale);
            const curZ = Math.max(1e-4, (bestCandidate.size.z / bestCandidate.factor) * appliedUniformScale);
            rootObject.scale.set(
                appliedUniformScale * (targetDim.x / curX),
                appliedUniformScale * (targetDim.y / curY),
                appliedUniformScale * (targetDim.z / curZ)
            );
        } else {
            rootObject.scale.set(appliedUniformScale, appliedUniformScale, appliedUniformScale);
        }
        wrapperGroup.add(rootObject);
        wrapperGroup.updateMatrixWorld(true);

        // 5. Measure Final Scaled Dimensions & Align Pivot
        const finalBox = new THREE.Box3().setFromObject(wrapperGroup);
        const finalSize = new THREE.Vector3();
        finalBox.getSize(finalSize);

        const center = new THREE.Vector3();
        finalBox.getCenter(center);

        if (spec.pivot === 'bottom') {
            // For cranes, buildings, towers: bottom sits flush at Y = 0 (quay apron elevation)
            rootObject.position.set(-center.x, -finalBox.min.y, -center.z);
        } else {
            // For cargo, spreaders, shackles: centered at geometric center
            rootObject.position.set(-center.x, -center.y, -center.z);
        }
        wrapperGroup.updateMatrixWorld(true);

        // 6. Compute Residual Deviations Against Target Standard
        const devX = Math.abs(finalSize.x - targetDim.x) / targetDim.x;
        const devY = Math.abs(finalSize.y - targetDim.y) / targetDim.y;
        const devZ = Math.abs(finalSize.z - targetDim.z) / targetDim.z;
        const maxDevPct = Math.round(Math.max(devX, devY, devZ) * 1000) / 10;

        let status = 'PASS';
        if (maxDevPct > spec.tolerance * 100 * 3) {
            status = 'FAIL';
            warnings.push(`Sai lệch kích thước ${maxDevPct}% vượt quá giới hạn an toàn (${(spec.tolerance * 100).toFixed(0)}%).`);
        } else if (maxDevPct > spec.tolerance * 100) {
            status = 'WARNING';
            warnings.push(`Kích thước lệch ${maxDevPct}% so với chuẩn danh định.`);
        }

        // 7. Extract or Synthesize Rigging / Crane Anchors
        const anchors = [];
        rootObject.traverse(node => {
            if (node.name && node.name.toUpperCase().startsWith('ANCHOR_')) {
                const worldPos = new THREE.Vector3();
                node.getWorldPosition(worldPos);
                // Express anchor position relative to wrapper group center
                const localPos = wrapperGroup.worldToLocal(worldPos.clone());
                anchors.push({
                    id: node.name,
                    localPos: { x: Math.round(localPos.x * 1000) / 1000, y: Math.round(localPos.y * 1000) / 1000, z: Math.round(localPos.z * 1000) / 1000 },
                    source: 'model_empty_node'
                });
            }
        });

        // If no explicit model nodes, synthesize from standard spec
        if (anchors.length === 0 && spec.padEyes) {
            spec.padEyes.forEach(pe => {
                // Scale pad-eye positions proportionally to actual dimensions
                const sx = (finalSize.x / targetDim.x);
                const sy = (finalSize.y / targetDim.y);
                const sz = (finalSize.z / targetDim.z);
                anchors.push({
                    id: pe.id,
                    localPos: {
                        x: Math.round(pe.localPos.x * sx * 1000) / 1000,
                        y: Math.round(pe.localPos.y * sy * 1000) / 1000,
                        z: Math.round(pe.localPos.z * sz * 1000) / 1000
                    },
                    type: pe.type,
                    wllT: pe.wllT,
                    source: 'synthesized_standard'
                });
            });
        }

        const finalTriCount = optStats ? optStats.finalTris : HullOptimizer.getTriCount(wrapperGroup);

        // Store normalization metadata on the wrapper group
        wrapperGroup.userData = {
            isNormalizedAsset: true,
            specKey: spec.id,
            finalDimensions: { x: finalSize.x, y: finalSize.y, z: finalSize.z },
            anchors,
            report: {
                status,
                detectedUnit: bestCandidate.unit,
                detectedUpAxis: bestCandidate.up,
                confidence,
                appliedScaleFactor: appliedUniformScale,
                maxDeviationPct: maxDevPct,
                triCount: Math.round(finalTriCount),
                meshCount,
                hullOptimization: optStats
            }
        };

        return {
            root: wrapperGroup,
            report: {
                specId: spec.id,
                specName: spec.name,
                standard: spec.standard,
                status,
                confidence,
                detectedUnit: bestCandidate.unit,
                detectedUpAxis: bestCandidate.up,
                appliedScaleFactor: appliedUniformScale,
                dimensionsRaw: { x: rawSize.x, y: rawSize.y, z: rawSize.z },
                dimensionsNormalized: {
                    x: Math.round(finalSize.x * 1000) / 1000,
                    y: Math.round(finalSize.y * 1000) / 1000,
                    z: Math.round(finalSize.z * 1000) / 1000
                },
                dimensionsTarget: targetDim,
                maxDeviationPct: maxDevPct,
                triCount: Math.round(finalTriCount),
                meshCount,
                hullOptimization: optStats,
                anchorsCount: anchors.length,
                anchors,
                caeHeader: options.caeHeader || null,
                warnings
            }
        };
    }
}
