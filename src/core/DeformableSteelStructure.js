/**
 * DeformableSteelStructure.js — Real-Time Structural Elastic Bending & Torsional Deformation Engine
 *
 * Implements Continuum Mechanics for Deformable Elasto-Plastic 3D Steel Structures:
 *   1. Euler-Bernoulli Beam Bending Deflection:
 *        EI * d^2w/dx^2 = M(x)  =>  delta_max = (F * L^3) / (48 * E * I)
 *   2. Spreader Bar Axial Compression + Beam-Column Secant Amplification:
 *        Amplification = 1 / (1 - P / P_cr), where P_cr = (pi^2 * E * I) / L_eff^2
 *   3. Saint-Venant Torsional Twist under Eccentric CoG / Asymmetric Sling Tension:
 *        phi(x) = (T_torque * x) / (G * J)
 *   4. 3D Mesh Vertex Warping Layer with Configurable Visual Exaggeration Scale (1x to 15x)
 *      alongside true 1:1 physical telemetry in millimeters, returning to 0 when unloaded.
 */

export class DeformableSteelStructure {
  /**
   * @param {number} lengthM - Structural span length L (m)
   * @param {number} inertiaI_m4 - Second moment of area I_xx (m^4)
   * @param {number} polarJ_m4 - Torsional constant J (m^4)
   * @param {number} [youngsModulusGPa=200] - Young's Modulus E (GPa), default 200 GPa (structural steel)
   * @param {number} [shearModulusGPa=79.3] - Shear Modulus G (GPa), default 79.3 GPa
   */
  constructor(lengthM, inertiaI_m4, polarJ_m4, youngsModulusGPa = 200, shearModulusGPa = 79.3) {
    this.L = lengthM;
    this.I = inertiaI_m4;
    this.J = polarJ_m4;
    this.E = youngsModulusGPa * 1e9; // Pa
    this.G = shearModulusGPa * 1e9;  // Pa
  }

  /**
   * Computes Euler-Bernoulli bending deflection curve w(x), Spreader Beam axial compression
   * amplification, and Saint-Venant torsional twist phi(x).
   *
   * @param {number} verticalLoadN - Total vertical bending force F (N)
   * @param {number} axialCompressionN - Axial compressive force P (N) for spreader bars
   * @param {number} eccentricTorqueNm - Longitudinal torsional moment T_torque (N*m)
   * @param {number} [numNodes=21] - Number of longitudinal spine nodes
   */
  computeDeformationState(verticalLoadN, axialCompressionN = 0, eccentricTorqueNm = 0, numNodes = 21) {
    // 1. Euler critical buckling load P_cr = (pi^2 * E * I) / L^2
    const P_cr = (Math.PI * Math.PI * this.E * this.I) / (this.L * this.L);
    const P = Math.max(0, Math.min(axialCompressionN, 0.95 * P_cr));
    const amplificationFactor = P > 0 ? 1.0 / (1.0 - P / P_cr) : 1.0;

    // 2. Maximum mid-span bending deflection (Euler-Bernoulli: delta_max = F * L^3 / (48 * E * I))
    const rawDeltaMaxM = (verticalLoadN * Math.pow(this.L, 3)) / (48 * this.E * this.I);
    const totalDeltaMaxM = rawDeltaMaxM * amplificationFactor;

    // 3. Maximum torsional twist angle (Saint-Venant: phi_max = (T_torque * L) / (G * J))
    const maxTwistRad = (eccentricTorqueNm * this.L) / (this.G * this.J);

    // 4. Longitudinal spine node deformation profile
    const spineNodes = [];
    for (let i = 0; i < numNodes; i++) {
      const xi = i / (numNodes - 1); // 0 -> 1
      const x = (xi - 0.5) * this.L; // -L/2 -> +L/2
      // Smooth Euler-Bernoulli beam deflection shape function sin(pi * xi)
      const deflectionY = -totalDeltaMaxM * Math.sin(Math.PI * xi);
      const twistAngleRad = maxTwistRad * (xi - 0.5);
      spineNodes.push({ x, deflectionY, twistAngleRad });
    }

    return {
      maxBendingDeflectionMm: totalDeltaMaxM * 1000.0,
      maxTorsionalTwistDeg: maxTwistRad * (180 / Math.PI),
      amplificationFactor,
      criticalBucklingLoadN: P_cr,
      spineNodes
    };
  }

  /**
   * Evaluates vertical bending deflection w(x) (in meters) and torsional twist phi(x) (in radians)
   * at a local longitudinal coordinate x in [-L/2, +L/2].
   *
   * @param {number} localX - Position along longitudinal axis [-L/2, +L/2]
   * @param {number} maxDeflectionM - Physical maximum mid-span deflection (m)
   * @param {number} maxTwistRad - Physical total end-to-end twist (rad)
   * @param {number} [visualExaggerationScale=1.0] - Visual amplification scale (1x to 15x)
   */
  evaluateAtLocalX(localX, maxDeflectionM, maxTwistRad, visualExaggerationScale = 1.0) {
    const halfL = Math.max(0.05, this.L * 0.5);
    const u = Math.max(-1, Math.min(1, localX / halfL)); // -1 .. +1
    const xi = 0.5 * (u + 1.0); // 0 .. 1
    const scale = Math.max(0, visualExaggerationScale);
    const wY = -maxDeflectionM * scale * Math.sin(Math.PI * xi);
    const phiRad = maxTwistRad * scale * (xi - 0.5);
    return { wY, phiRad };
  }

  /**
   * Applies reversible elastic bending and torsional vertex deformation to a Three.js Object3D
   * hierarchy (storing pristine original vertex positions in geometry.userData._origPos).
   * When verticalLoadN == 0 and eccentricTorqueNm == 0, vertices spring back to 0 deformation.
   *
   * @param {object} rootObject - Three.js Group / Mesh
   * @param {number} verticalLoadN - Vertical bending load F (N)
   * @param {number} [axialCompressionN=0] - Axial compression P (N)
   * @param {number} [eccentricTorqueNm=0] - Longitudinal torsional moment T_torque (N*m)
   * @param {number} [visualExaggerationScale=5.0] - Visual scale factor (1x to 15x)
   * @param {'x'|'z'} [longitudinalAxis='x'] - Local longitudinal axis of the structure
   */
  applyMeshDeformation(
    rootObject,
    verticalLoadN,
    axialCompressionN = 0,
    eccentricTorqueNm = 0,
    visualExaggerationScale = 5.0,
    longitudinalAxis = 'x'
  ) {
    const state = this.computeDeformationState(verticalLoadN, axialCompressionN, eccentricTorqueNm, 21);
    if (!rootObject || typeof rootObject.traverse !== 'function') {
      return state;
    }

    const maxDeflectionM = state.maxBendingDeflectionMm / 1000.0;
    const maxTwistRad = state.maxTorsionalTwistDeg * (Math.PI / 180.0);
    const isUnloaded = Math.abs(maxDeflectionM) < 1e-9 && Math.abs(maxTwistRad) < 1e-9;

    // Prevent double-deforming shared BufferGeometries in a single pass
    const visitedGeometries = new Set();

    // Ensure matrices are current so nested meshes (pad-eyes, bulkheads, OOG case)
    // get the correct offset relative to the structural root — not just their local parent.
    if (typeof rootObject.updateWorldMatrix === 'function') {
      rootObject.updateWorldMatrix(true, true);
    }
    const rootInv = rootObject.matrixWorld.clone().invert();
    const tmpMat = rootObject.matrixWorld.clone();

    const isNonStructural = (obj) => {
      let p = obj;
      while (p && p !== rootObject) {
        const n = (p.name || '').toLowerCase();
        const ud = p.userData || {};
        if (
          ud.noStructuralDeform ||
          ud.gearKind === 'shackle' ||
          ud.gearKind === 'hook' ||
          ud.isLug ||
          n === 'lugmarker' ||
          n === 'cogmarker' ||
          n === 'flatrackoogcargo' ||
          n === 'flatracklashingsstraps' ||
          n === 'flatrackbrokenstraps' ||
          n.includes('lashing') ||
          n.includes('strap') ||
          n.includes('shackle') ||
          n.includes('pad_eye') ||
          n.includes('pad-eye') ||
          n.includes('center_of_gravity') ||
          n.includes('cog') ||
          n.includes('edge')
        ) {
          return true;
        }
        p = p.parent;
      }
      return false;
    };

    rootObject.traverse((child) => {
      if (!child.isMesh || !child.geometry || !child.geometry.attributes || !child.geometry.attributes.position) {
        return;
      }
      if (isNonStructural(child)) {
        // Still restore any previously warped non-structural mesh
        const geomSkip = child.geometry;
        if (geomSkip.userData && geomSkip.userData._isDeformed && geomSkip.userData._origPos) {
          geomSkip.attributes.position.array.set(geomSkip.userData._origPos);
          geomSkip.attributes.position.needsUpdate = true;
          geomSkip.userData._isDeformed = false;
        }
        return;
      }

      const geom = child.geometry;
      if (visitedGeometries.has(geom.uuid)) return;
      visitedGeometries.add(geom.uuid);

      const posAttr = geom.attributes.position;
      if (!geom.userData._origPos || geom.userData._origPos.length !== posAttr.array.length) {
        geom.userData._origPos = new Float32Array(posAttr.array);
      }
      const orig = geom.userData._origPos;

      if (isUnloaded) {
        if (geom.userData._isDeformed) {
          posAttr.array.set(orig);
          posAttr.needsUpdate = true;
          geom.userData._isDeformed = false;
        }
        return;
      }

      // Mesh origin in root-local space (handles nested groups correctly)
      tmpMat.copy(child.matrixWorld);
      tmpMat.premultiply(rootInv);
      const childOffsetLong = longitudinalAxis === 'z' ? tmpMat.elements[14] : tmpMat.elements[12];
      const childOffsetTrans = longitudinalAxis === 'z' ? tmpMat.elements[12] : tmpMat.elements[14];
      const childOffsetY = tmpMat.elements[13];

      const arr = posAttr.array;
      const halfL = Math.max(0.05, this.L * 0.5);

      for (let i = 0; i < arr.length; i += 3) {
        const ox = orig[i];
        const oy = orig[i + 1];
        const oz = orig[i + 2];

        const worldLong = longitudinalAxis === 'z' ? (oz + childOffsetLong) : (ox + childOffsetLong);
        const worldTrans = longitudinalAxis === 'z' ? (ox + childOffsetTrans) : (oz + childOffsetTrans);
        const worldY = oy + childOffsetY;

        const u = Math.max(-1, Math.min(1, worldLong / halfL));
        const xi = 0.5 * (u + 1.0);
        // Allow up to 15× for analysis visualization (UI / unit tests); clamp negatives
        const vis = Math.max(0, Math.min(visualExaggerationScale, 15.0));
        const wY = -maxDeflectionM * vis * Math.sin(Math.PI * xi);
        const phi = maxTwistRad * vis * (xi - 0.5);

        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);
        const twistedY = worldY * cosP - worldTrans * sinP + wY;
        const twistedTrans = worldY * sinP + worldTrans * cosP;

        if (longitudinalAxis === 'z') {
          arr[i] = twistedTrans - childOffsetTrans;
          arr[i + 1] = twistedY - childOffsetY;
          arr[i + 2] = oz;
        } else {
          arr[i] = ox;
          arr[i + 1] = twistedY - childOffsetY;
          arr[i + 2] = twistedTrans - childOffsetTrans;
        }
      }

      posAttr.needsUpdate = true;
      geom.userData._isDeformed = true;
    });

    return state;
  }
}
