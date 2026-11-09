import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

class PolyfillFileReader {
    async readAsArrayBuffer(blob) {
        const buf = await blob.arrayBuffer();
        this.result = buf;
        if (this.onloadend) this.onloadend();
    }
    async readAsDataURL(blob) {
        const buf = await blob.arrayBuffer();
        const base64 = Buffer.from(buf).toString('base64');
        this.result = 'data:application/octet-stream;base64,' + base64;
        if (this.onloadend) this.onloadend();
    }
}
global.window = global;
global.FileReader = PolyfillFileReader;

const outputDir = path.resolve('public', 'assets', 'models');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function exportToGLB(sceneOrGroup, filename) {
    const exporter = new GLTFExporter();
    const gltf = await exporter.parseAsync(sceneOrGroup, { binary: true });
    const buffer = Buffer.from(gltf);
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Exported ${filename} (${(buffer.length / 1024).toFixed(1)} KB) -> ${filePath}`);
    return filePath;
}

// ============================================================================
// 1. ISO 668 20FT SHIPPING CONTAINER (6.058m x 2.591m x 2.438m)
// ============================================================================
function createContainer20ft() {
    const L = 6.058; // Length (X)
    const H = 2.591; // Height (Y)
    const W = 2.438; // Width (Z)

    const group = new THREE.Group();
    group.name = 'Container_20ft_ISO668';

    const wallColor = 0xb91c1c; // Rust Red
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.45, metalness: 0.35 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5, metalness: 0.4 });
    const steelCastMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 });
    const lockRodMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });

    const core = new THREE.Mesh(new THREE.BoxGeometry(L - 0.25, H - 0.25, W - 0.08), wallMat);
    group.add(core);

    const fluteCount = 28;
    const flutePitch = (L - 0.5) / fluteCount;
    for (let i = 0; i < fluteCount; i++) {
        const xPos = - (L - 0.5) / 2 + (i + 0.5) * flutePitch;
        [-W / 2 + 0.02, W / 2 - 0.02].forEach(zPos => {
            const flute = new THREE.Mesh(new THREE.BoxGeometry(flutePitch * 0.55, H - 0.28, 0.045), wallMat);
            flute.position.set(xPos, 0, zPos);
            group.add(flute);
        });
        const rFlute = new THREE.Mesh(new THREE.BoxGeometry(flutePitch * 0.55, 0.035, W - 0.3), wallMat);
        rFlute.position.set(xPos, H / 2 - 0.015, 0);
        group.add(rFlute);
    }

    const railThick = 0.12;
    [-W / 2 + railThick / 2, W / 2 - railThick / 2].forEach(z => {
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(L, railThick, railThick), frameMat);
        topRail.position.set(0, H / 2 - railThick / 2, z);
        group.add(topRail);

        const botRail = new THREE.Mesh(new THREE.BoxGeometry(L, railThick * 1.3, railThick), frameMat);
        botRail.position.set(0, -H / 2 + (railThick * 1.3) / 2, z);
        group.add(botRail);
    });

    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, H, 0.14), frameMat);
        post.position.set(sx * (L / 2 - 0.07), 0, sz * (W / 2 - 0.07));
        group.add(post);
    });

    const cSize = { x: 0.178, y: 0.118, z: 0.162 };
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
     [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1]].forEach(([sx, sy, sz]) => {
        const casting = new THREE.Mesh(new THREE.BoxGeometry(cSize.x, cSize.y, cSize.z), steelCastMat);
        casting.position.set(sx * (L / 2 - cSize.x / 2), sy * (H / 2 - cSize.y / 2), sz * (W / 2 - cSize.z / 2));
        group.add(casting);
    });

    const doorX = L / 2 + 0.01;
    [-W * 0.35, -W * 0.14, W * 0.14, W * 0.35].forEach(rz => {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H - 0.35, 16), lockRodMat);
        rod.position.set(doorX + 0.035, 0, rz);
        group.add(rod);
    });

    const anchorMap = [
        { name: 'ANCHOR_PADEYE_1', sx: 1, sz: 1 },
        { name: 'ANCHOR_PADEYE_2', sx: -1, sz: 1 },
        { name: 'ANCHOR_PADEYE_3', sx: -1, sz: -1 },
        { name: 'ANCHOR_PADEYE_4', sx: 1, sz: -1 },
    ];
    anchorMap.forEach(({ name, sx, sz }) => {
        const anchorNode = new THREE.Object3D();
        anchorNode.name = name;
        anchorNode.position.set(sx * (L / 2 - cSize.x / 2), H / 2, sz * (W / 2 - cSize.z / 2));
        group.add(anchorNode);
    });

    const cogNode = new THREE.Object3D();
    cogNode.name = 'ANCHOR_COG';
    cogNode.position.set(0, -0.1, 0);
    group.add(cogNode);

    return group;
}

// ============================================================================
// 2. ISO 668 40FT SHIPPING CONTAINER (12.192m x 2.591m x 2.438m)
// ============================================================================
function createContainer40ft() {
    const L = 12.192;
    const H = 2.591;
    const W = 2.438;

    const group = new THREE.Group();
    group.name = 'Container_40ft_ISO668';

    const wallColor = 0x0284c7; // Ocean Blue
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.45, metalness: 0.35 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.5, metalness: 0.4 });
    const steelCastMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 });
    const lockRodMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });

    const core = new THREE.Mesh(new THREE.BoxGeometry(L - 0.25, H - 0.25, W - 0.08), wallMat);
    group.add(core);

    const fluteCount = 56;
    const flutePitch = (L - 0.5) / fluteCount;
    for (let i = 0; i < fluteCount; i++) {
        const xPos = - (L - 0.5) / 2 + (i + 0.5) * flutePitch;
        [-W / 2 + 0.02, W / 2 - 0.02].forEach(zPos => {
            const flute = new THREE.Mesh(new THREE.BoxGeometry(flutePitch * 0.55, H - 0.28, 0.045), wallMat);
            flute.position.set(xPos, 0, zPos);
            group.add(flute);
        });
        const rFlute = new THREE.Mesh(new THREE.BoxGeometry(flutePitch * 0.55, 0.035, W - 0.3), wallMat);
        rFlute.position.set(xPos, H / 2 - 0.015, 0);
        group.add(rFlute);
    }

    const railThick = 0.12;
    [-W / 2 + railThick / 2, W / 2 - railThick / 2].forEach(z => {
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(L, railThick, railThick), frameMat);
        topRail.position.set(0, H / 2 - railThick / 2, z);
        group.add(topRail);

        const botRail = new THREE.Mesh(new THREE.BoxGeometry(L, railThick * 1.3, railThick), frameMat);
        botRail.position.set(0, -H / 2 + (railThick * 1.3) / 2, z);
        group.add(botRail);
    });

    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, H, 0.14), frameMat);
        post.position.set(sx * (L / 2 - 0.07), 0, sz * (W / 2 - 0.07));
        group.add(post);
    });

    const cSize = { x: 0.178, y: 0.118, z: 0.162 };
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
     [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1]].forEach(([sx, sy, sz]) => {
        const casting = new THREE.Mesh(new THREE.BoxGeometry(cSize.x, cSize.y, cSize.z), steelCastMat);
        casting.position.set(sx * (L / 2 - cSize.x / 2), sy * (H / 2 - cSize.y / 2), sz * (W / 2 - cSize.z / 2));
        group.add(casting);
    });

    const doorX = L / 2 + 0.01;
    [-W * 0.35, -W * 0.14, W * 0.14, W * 0.35].forEach(rz => {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H - 0.35, 16), lockRodMat);
        rod.position.set(doorX + 0.035, 0, rz);
        group.add(rod);
    });

    const anchorMap = [
        { name: 'ANCHOR_PADEYE_1', sx: 1, sz: 1 },
        { name: 'ANCHOR_PADEYE_2', sx: -1, sz: 1 },
        { name: 'ANCHOR_PADEYE_3', sx: -1, sz: -1 },
        { name: 'ANCHOR_PADEYE_4', sx: 1, sz: -1 },
    ];
    anchorMap.forEach(({ name, sx, sz }) => {
        const anchorNode = new THREE.Object3D();
        anchorNode.name = name;
        anchorNode.position.set(sx * (L / 2 - cSize.x / 2), H / 2, sz * (W / 2 - cSize.z / 2));
        group.add(anchorNode);
    });

    const cogNode = new THREE.Object3D();
    cogNode.name = 'ANCHOR_COG';
    cogNode.position.set(0, -0.1, 0);
    group.add(cogNode);

    return group;
}

// ============================================================================
// 3. INDUSTRIAL CONTAINER SPREADER BEAM (6.06m x 0.65m x 2.44m)
// ============================================================================
function createModuliftSpreader() {
    const L = 6.06;
    const H = 0.65;
    const W = 2.44;

    const group = new THREE.Group();
    group.name = 'Modulift_Spreader_20ft';

    const steelYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 });

    // Main Box Girder (H = 0.36m, within 0.65m envelope)
    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(L - 0.4, 0.36, 0.5), steelYellowMat);
    group.add(mainBox);

    // End Cross Beams
    [-L / 2 + 0.2, L / 2 - 0.2].forEach(x => {
        const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, W), steelYellowMat);
        crossBeam.position.set(x, 0, 0);
        group.add(crossBeam);

        // Guide flippers & Twistlocks fitting strictly within H = 0.65m total
        [-W / 2 + 0.1, W / 2 - 0.1].forEach(z => {
            const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.12), darkMat);
            flipper.position.set(x, -0.22, z);
            group.add(flipper);

            const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 16), chromeMat);
            pin.position.set(x, -0.24, z);
            group.add(pin);
        });
    });

    // Central HPU Enclosure
    const hpu = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.42), darkMat);
    hpu.position.set(0, 0.20, 0);
    group.add(hpu);

    // Top Pad-eyes
    const peDistX = 2.5;
    const peDistZ = 0.2;
    const upperAnchors = [
        { name: 'ANCHOR_UPPER_1', x: peDistX, z: peDistZ },
        { name: 'ANCHOR_UPPER_2', x: -peDistX, z: peDistZ },
        { name: 'ANCHOR_UPPER_3', x: -peDistX, z: -peDistZ },
        { name: 'ANCHOR_UPPER_4', x: peDistX, z: -peDistZ }
    ];
    upperAnchors.forEach(({ name, x, z }) => {
        const lug = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.04), steelYellowMat);
        lug.position.set(x, 0.24, z);
        group.add(lug);

        const anc = new THREE.Object3D();
        anc.name = name;
        anc.position.set(x, 0.30, z);
        group.add(anc);
    });

    // Lower Twistlock Anchors
    const lowerAnchors = [
        { name: 'ANCHOR_PADEYE_1', x: L / 2 - 0.1, z: W / 2 - 0.1 },
        { name: 'ANCHOR_PADEYE_2', x: -L / 2 + 0.1, z: W / 2 - 0.1 },
        { name: 'ANCHOR_PADEYE_3', x: -L / 2 + 0.1, z: -W / 2 + 0.1 },
        { name: 'ANCHOR_PADEYE_4', x: L / 2 - 0.1, z: -W / 2 + 0.1 }
    ];
    lowerAnchors.forEach(({ name, x, z }) => {
        const anc = new THREE.Object3D();
        anc.name = name;
        anc.position.set(x, -0.28, z);
        group.add(anc);
    });

    return group;
}

// ============================================================================
// 4. CROSBY G-2130 BOLT-TYPE SAFETY SHACKLE 17T (0.18m x 0.28m x 0.14m)
// ============================================================================
function createCrosbyShackle() {
    const group = new THREE.Group();
    group.name = 'Crosby_G2130_Shackle_17T';

    const bowMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.7 });

    // Shackle dimensions: Width = X (0.18m), Height = Y (0.28m), Depth = Z (0.14m)
    const pinRadius = 0.02;

    // Crosby Red Pin across X axis (length = 0.18m)
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, 0.18, 24), pinMat);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, -0.08, 0);
    group.add(pin);

    // Bolt Head
    const boltHead = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius * 1.4, pinRadius * 1.4, 0.022, 6), pinMat);
    boltHead.rotation.z = Math.PI / 2;
    boltHead.position.set(-0.08, -0.08, 0);
    group.add(boltHead);

    // Nut & Cotter Pin
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius * 1.35, pinRadius * 1.35, 0.022, 6), bowMat);
    nut.rotation.z = Math.PI / 2;
    nut.position.set(0.08, -0.08, 0);
    group.add(nut);

    // Torus crown at top (+Y)
    const bowTorus = new THREE.Mesh(new THREE.TorusGeometry(0.052, pinRadius, 16, 32, Math.PI), bowMat);
    bowTorus.position.set(0, 0.08, 0);
    group.add(bowTorus);

    // Two legs extending downwards
    [-0.052, 0.052].forEach(x => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, 0.16, 16), bowMat);
        leg.position.set(x, 0, 0);
        group.add(leg);

        const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.13, 20), bowMat);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(x, -0.08, 0);
        group.add(eye);
    });

    // Anchors
    const crownAnchor = new THREE.Object3D();
    crownAnchor.name = 'ANCHOR_CROWN';
    crownAnchor.position.set(0, 0.08 + 0.052 + pinRadius, 0);
    group.add(crownAnchor);

    const pinAnchor = new THREE.Object3D();
    pinAnchor.name = 'ANCHOR_PIN';
    pinAnchor.position.set(0, -0.08, 0);
    group.add(pinAnchor);

    return group;
}

// ============================================================================
// 5. POST-PANAMAX SHIP-TO-SHORE (STS) GANTRY CRANE (28m x 56m x 88m)
// ============================================================================
function createSTSGantryCrane() {
    const group = new THREE.Group();
    group.name = 'STS_Gantry_Crane_PostPanamax';

    const craneYellow = 0xeab308;
    const yellowMat = new THREE.MeshStandardMaterial({ color: craneYellow, roughness: 0.4, metalness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.3 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.7 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.85 });

    const railSpanX = 28.0;
    const runwayElevationY = 38.0;
    const totalHeightY = 56.0;
    const boomReachZ = 52.0;
    const backReachZ = 24.0;
    const portalWidthX = 14.0;

    [-railSpanX / 2, railSpanX / 2].forEach(lx => {
        [-portalWidthX / 2, portalWidthX / 2].forEach(lz => {
            const bogie = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 5.0), darkSteelMat);
            bogie.position.set(lx, 0.6, lz);
            group.add(bogie);

            for (let w = -2.0; w <= 2.0; w += 1.0) {
                const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16), darkSteelMat);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(lx, 0.42, lz + w);
                group.add(wheel);
            }

            const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, runwayElevationY, 1.4), yellowMat);
            leg.position.set(lx, runwayElevationY / 2, lz);
            group.add(leg);
        });

        const sill = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, portalWidthX), yellowMat);
        sill.position.set(lx, 4.2, 0);
        group.add(sill);

        const cross = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, portalWidthX), yellowMat);
        cross.position.set(lx, 15.0, 0);
        group.add(cross);
    });

    const totalBoomLengthZ = boomReachZ + backReachZ + portalWidthX;
    const boomCenterZ = (boomReachZ - backReachZ) / 2;

    [-railSpanX / 4, railSpanX / 4].forEach(gx => {
        const girder = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, totalBoomLengthZ), yellowMat);
        girder.position.set(gx, runwayElevationY, boomCenterZ);
        group.add(girder);

        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, totalBoomLengthZ), darkSteelMat);
        rail.position.set(gx, runwayElevationY + 1.15, boomCenterZ);
        group.add(rail);
    });

    [-railSpanX / 4, railSpanX / 4].forEach(ax => {
        const mastHeight = totalHeightY - runwayElevationY;
        const frontStrut = new THREE.Mesh(new THREE.BoxGeometry(1.0, mastHeight, 1.0), yellowMat);
        frontStrut.position.set(ax, runwayElevationY + mastHeight / 2, -4.0);
        frontStrut.rotation.x = -0.22;
        group.add(frontStrut);

        const rearStrut = new THREE.Mesh(new THREE.BoxGeometry(1.0, mastHeight, 1.0), yellowMat);
        rearStrut.position.set(ax, runwayElevationY + mastHeight / 2, 4.0);
        rearStrut.rotation.x = 0.22;
        group.add(rearStrut);

        const apex = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 3.0), yellowMat);
        apex.position.set(ax, totalHeightY, 0);
        group.add(apex);
    });

    const machineHouse = new THREE.Mesh(new THREE.BoxGeometry(railSpanX * 0.7, 3.8, 8.5), whiteMat);
    machineHouse.position.set(0, runwayElevationY + 3.0, -backReachZ * 0.6);
    group.add(machineHouse);

    [-railSpanX / 4, railSpanX / 4].forEach(cx => {
        const stayGeo = new THREE.CylinderGeometry(0.04, 0.04, 52.0, 12);
        const stay = new THREE.Mesh(stayGeo, cableMat);
        stay.position.set(cx, (totalHeightY + runwayElevationY) / 2 + 2, boomReachZ * 0.45);
        stay.rotation.x = Math.PI / 4;
        group.add(stay);
    });

    const trolleyNode = new THREE.Object3D();
    trolleyNode.name = 'ANCHOR_TROLLEY';
    trolleyNode.position.set(0, runwayElevationY - 0.5, 0);
    group.add(trolleyNode);

    const hookNode = new THREE.Object3D();
    hookNode.name = 'ANCHOR_HOOK';
    hookNode.position.set(0, runwayElevationY - 8.0, 0);
    group.add(hookNode);

    const railLNode = new THREE.Object3D();
    railLNode.name = 'ANCHOR_RAIL_LEFT';
    railLNode.position.set(-railSpanX / 2, 0, 0);
    group.add(railLNode);

    const railRNode = new THREE.Object3D();
    railRNode.name = 'ANCHOR_RAIL_RIGHT';
    railRNode.position.set(railSpanX / 2, 0, 0);
    group.add(railRNode);

    return group;
}

async function run() {
    console.log('📦 Starting Industrial 3D Asset Export Pipeline...');
    await exportToGLB(createContainer20ft(), 'container_20ft.glb');
    await exportToGLB(createContainer40ft(), 'container_40ft.glb');
    await exportToGLB(createModuliftSpreader(), 'modulift_spreader.glb');
    await exportToGLB(createCrosbyShackle(), 'crosby_shackle.glb');
    await exportToGLB(createSTSGantryCrane(), 'sts_crane.glb');
    console.log('🎉 All 5 Industrial 3D Assets successfully generated and exported!');
}

run().catch(err => {
    console.error('❌ Pipeline export failed:', err);
    process.exit(1);
});
