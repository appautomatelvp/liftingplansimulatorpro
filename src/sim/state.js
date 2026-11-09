/**
 * state — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        const DUNNAGE_H = 0.18; // Timber cribbing height on testbed floor (m)
        const HOOK_MASTER_OFFSET_Y = -0.56; // Exact vertical offset from hook block origin to Master Link lower bearing crown (m)

        // --- 1. ENGINEERING CONFIGURATION STATE ---
        const state = {
            cargoType: 'flatrack',
            L: 12.192,
            W: 2.438,
            H: 2.591,
            weight: 22.0,

            // Out-of-Gauge (OOG) Cargo & Tarpaulin Cover state for Open Top / Flat Rack
            // Flat Rack frame uses state.L/W/H; OOG payload uses oogCargo* — two separate bodies
            oogHasCargo: true,
            oogTarp: true,
            oogCargoL: 10.50,
            oogCargoW: 2.20,
            oogCargoH: 2.85,

            // ISO 668 / 1496 identity (filled from library when a standard unit is selected)
            isoCode: '42P1',
            tareT: 4.80,
            maxPayloadT: 40.20,
            maxGrossT: 45.00,

            // 3D Center of Gravity (CoG) in Cargo Local Coordinates (m)
            cogX: 0.0,
            cogY: -0.55,
            cogZ: 0.0,

            // Individual 4 Lifting Points (LP1..LP4) in Cargo Local Coordinates (m)
            // 0: LP1 (+X,+Z), 1: LP2 (-X,+Z), 2: LP3 (-X,-Z), 3: LP4 (+X,-Z)
            lugs: [
                new THREE.Vector3( 2.05, 1.20,  1.12),
                new THREE.Vector3(-2.05, 1.20,  1.12),
                new THREE.Vector3(-2.05, 1.20, -1.12),
                new THREE.Vector3( 2.05, 1.20, -1.12)
            ],
            // Outward shell normal at each lug (cargo local). Pad-eye +Y lies along this.
            lugNormals: [
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 1, 0)
            ],
            selectedLP: 'all', // 'all', 0, 1, 2, 3
            lugElevPreset: 'top',
            pendingConform: 'nearest', // 'nearest' | 'preset' | 'structural' | 'skip'

            // Individual Turnbuckle Length Adjustments (m) for each of the 4 legs
            legDeltaL: [0, 0, 0, 0],

            // Crane & Rigging Gear Selection
            craneType: 'hook_only', // 'hook_only', 'mobile_telescopic', 'crawler', 'gantry'
            beamType: 'spreader',   // 'spreader' (Modular Spreader Beam), 'lifting_beam', 'cascaded', 'frame', 'modular_truss', 'basket', 'container_spreader', 'none'
            slingType: 'chain',             // 'wire', 'chain', 'web'
            slingUserSet: true,             // false = auto calculated from span; true = explicit length
            weightUserSet: true,            // false = industrial band from type and size
            hwType: 'bow_shackle',          // 'bow_shackle', 'd_shackle', 'hook'
            slingLength: 2.00,
            upperSlingLength: null,
            lowerSlingLength: null,
            unitSystem: 'metric', // 'metric' (m, mm, kg, t) | 'imperial' (ft, in, lbs)
            wllPerLeg: 15.0,
            gear: {
                selection: [],
                legs: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ lengthM: null, swlT: null, diaMm: 22, massKg: null, sf: 5, grade: 'chain_g80', broken: false, slingType: null, parts: 1 })),
                uppers: [0, 1, 2, 3].map(() => ({ lengthM: null, swlT: null, diaMm: 26, massKg: null, sf: 5, grade: 'chain_g80', broken: false, slingType: null, parts: 1 })),
                hangers: [0, 1, 2, 3, 4, 5].map(() => ({ lengthM: null, swlT: null, diaMm: 22, massKg: null, sf: 5, grade: 'chain_g80', broken: false, slingType: null, parts: 1 })),
                shackles: [0, 1, 2, 3].map(() => ({ swlT: 17, massKg: null, pinMm: 35, jawMm: 54, sf: 6 })),
                beam: { swlT: 40, massT: null, lengthM: null, widthM: null, depthM: 0.24, sf: 4 },
                hook: { swlT: 65, massKg: 380, sf: 4 },
                members: {},
                extraCables: []
            },
            rigFit: 'fixed',
            lang: 'vi',

            // Visual & UI Toggles
            xrayCargo: false,
            showCADEdges: true,
            showVectors: false,
            showLPLabels: false,
            showCoGLabel: true,
            leftCollapsed: true,
            rightCollapsed: false,

            // Granular Technical Display Options (Bật/tắt tùy ý theo yêu cầu người dùng)
            // Khởi động: tạm ẩn các thông số trên kiện, chỉ để lại trọng tâm CoG và góc nền
            displayOptions: {
                showForces: false,         // Lực căng từng nhánh cáp (Tạm ẩn)
                showSlingAngles: false,    // Góc giữa các cáp (Tạm ẩn)
                showGroundAngle: true,     // Góc nền, vạch vàng & đỏ, số độ to (HIỂN THỊ)
                showHookLoad: false,       // Chịu lực móc cẩu & cao độ Y (Tạm ẩn)
                showShackleLoads: false,   // Chịu lực ma ní & tai cẩu LP (Tạm ẩn)
                showSlingLengths: false,   // Chiều dài cáp & tăng đơ (Tạm ẩn)
                showCoG: true,             // Trọng tâm CoG & dây dọi (HIỂN THỊ)
                showVectors: false,        // Mũi tên véc-tơ lực 3D (Tạm ẩn)
                showCADEdges: true,        // Nét CAD kỹ thuật
                showHUD: false             // Thanh số liệu HUD (Tạm ẩn)
            },

            // Camera Tracking & Follow Mechanism
            cameraFollow: {
                enabled: false,
                mode: 'cog', // 'cog' | 'center' | 'top' | 'hook' | 'lp1' | 'lp2' | 'lp3' | 'lp4' | 'custom'
                customOffset: new THREE.Vector3(0, 0, 0)
            },

            // Detailed Orientation, Rotation & Pulling Vector State
            cargoYawDeg: 0,
            cargoPitchTrimDeg: 0,
            cargoRollTrimDeg: 0,
            pullAzimuthDeg: 0,
            pullRadius: 0.0,
            spreaderYawDeg: 0,
            spreaderAlignWithCargo: false,
            showGroundAngleIndicator: true,

            sceneId: 'studio',
            groundId: 'flat',
            customBeamLengthMode: false,
            poseLock: true,
            slewDeg: 0,
            userBaselineState: null, // User-defined initial state snapshot for Reset

            // Phase 1: Real-World Crane Load Chart, Ground Pressure & Elastic Rigging State
            craneModelId: 'liebherr_ltm1200', // 'liebherr_ltm1200' | 'liebherr_lr1300' | 'kato_kr500'
            craneBoomLengthM: 35.8,
            craneOutriggerExtensionPct: 100, // 100%, 75%, 50%
            soilType: 'compacted_gravel', // 'concrete_slab', 'compacted_gravel', 'hard_clay', 'soft_soil'
            craneMatPresetId: 'steel_mat_2x2', // mat under outriggers
            slingMaterialType: 'wire', // 'wire', 'chain', 'poly', 'dyneema'
            isRigidPayload: true
        };

        // --- 1B. EXTENSIBLE 3D ASSET LIBRARY REGISTRY (Built-in + User Uploaded STL/OBJ/GLB & Image-to-3D) ---
        const customCargoMeshes = {}; // id -> THREE.Group prototype
        const customBeamMeshes = {};  // id -> THREE.Group prototype
        const customCraneMeshes = {}; // id -> THREE.Group prototype
        const customHwMeshes = {};    // id -> THREE.Group prototype

        const libraryCatalog = {
            cargo: [
                { id: 'container', meshName: 'ISO_Container_20ft', name: 'ISO Container 20ft — Container tiêu chuẩn 20ft', sub: 'ISO 668 22G1 · 6058×2438×2591 mm · Tare 2.23 t · Payload 21.77 t · MGW 24.00 t', L: 6.058, W: 2.438, H: 2.591, weight: 21.0, tareT: 2.23, maxPayloadT: 21.77, maxGrossT: 24.00, isoCode: '22G1', cogX: 0, cogY: -0.1, cogZ: 0, badge: 'ISO 668' },
                { id: 'iso40', meshName: 'ISO_Container_40ft', name: 'ISO Container 40ft — Container tiêu chuẩn 40ft', sub: 'ISO 668 42G1 · 12192×2438×2591 mm · Tare 3.80 t · Payload 26.68 t · MGW 30.48 t', L: 12.192, W: 2.438, H: 2.591, weight: 28.3, tareT: 3.80, maxPayloadT: 26.68, maxGrossT: 30.48, isoCode: '42G1', cogX: 0, cogY: -0.1, cogZ: 0, badge: 'ISO 668' },
                { id: 'iso40hc', meshName: 'ISO_Container_40ft_HC', name: 'ISO Container 40ft HC — Container tiêu chuẩn cao', sub: 'ISO 668 45G1 High Cube · 12192×2438×2896 mm · Tare 3.95 t · Payload 26.53 t · MGW 30.48 t', L: 12.192, W: 2.438, H: 2.896, weight: 28.3, tareT: 3.95, maxPayloadT: 26.53, maxGrossT: 30.48, isoCode: '45G1', cogX: 0, cogY: -0.05, cogZ: 0, badge: 'ISO 668' },
                { id: 'flatrack', meshName: 'Flat_Rack_Container', name: 'Flat Rack Container — Container mặt bằng (không vách)', sub: 'ISO 1496-5 42P1 · Khung 12192×2438×2591 · Tare 4.80 t · Payload 40.20 t · MGW 45.00 t', L: 12.192, W: 2.438, H: 2.591, weight: 22.0, tareT: 4.80, maxPayloadT: 40.20, maxGrossT: 45.00, isoCode: '42P1', cogX: 0, cogY: -0.55, cogZ: 0, badge: 'ISO 1496-5' },
                { id: 'opentop', meshName: 'Open_Top_Container', name: 'Open Top Container — Container hở mái', sub: 'ISO 1496-1 22U1 · 6058×2438×2591 · Tare 2.40 t · Payload 21.60 t · MGW 24.00 t', L: 6.058, W: 2.438, H: 2.591, weight: 16.0, tareT: 2.40, maxPayloadT: 21.60, maxGrossT: 24.00, isoCode: '22U1', cogX: 0, cogY: -0.15, cogZ: 0, badge: 'ISO 1496-1' },
                { id: 'isotank', meshName: 'Tank_Container_ISO_Tank', name: 'Tank Container (ISO Tank) — Container bồn chứa', sub: 'ISO 1496-3 22T1/T11 · Khung 20ft · Tare 3.50 t · Payload 26.00 t · MGW 36.00 t', L: 6.058, W: 2.438, H: 2.591, weight: 29.0, tareT: 3.50, maxPayloadT: 26.00, maxGrossT: 36.00, isoCode: '22T1', cogX: 0, cogY: 0.05, cogZ: 0, badge: 'ISO 1496-3' },
                { id: 'reefer', meshName: 'Reefer_Container', name: 'Reefer Container — Container lạnh', sub: 'ISO 1496-2 45R1 · 40ft HC · Tare 4.60 t · Payload 25.88 t · MGW 30.48 t', L: 12.192, W: 2.438, H: 2.896, weight: 28.3, tareT: 4.60, maxPayloadT: 25.88, maxGrossT: 30.48, isoCode: '45R1', cogX: -0.35, cogY: 0.05, cogZ: 0, badge: 'ISO 1496-2' },
                { id: 'crate', meshName: 'Heavy_Lift_OOG_Cargo', name: 'Heavy Lift / Out of Gauge (OOG) — Hàng siêu trường siêu trọng', sub: 'Kiện máy công nghiệp đóng khung dầm thép gia cường', L: 4.5, W: 2.8, H: 2.6, weight: 16.0, cogX: 0, cogY: 0, cogZ: 0, badge: 'OOG Heavy' },
                { id: 'transformer', meshName: 'Transformer', name: 'Transformer — Máy biến áp', sub: 'Máy biến áp lực 110kV có cánh tản nhiệt & sứ cách điện', L: 5.2, W: 2.8, H: 3.2, weight: 65.0, cogX: 0.65, cogY: 0.15, cogZ: 0.20, badge: 'IEC 60076' },
                { id: 'vessel', meshName: 'Pressure_Vessel', name: 'Pressure Vessel — Bồn áp lực', sub: 'Bồn trụ ngang ASME có tai cẩu hàn trên thân vỏ tròn', L: 7.5, W: 2.6, H: 2.6, weight: 41.5, cogX: 0, cogY: 0.05, cogZ: 0, badge: 'ASME VIII' },
                { id: 'wind_nacelle', meshName: 'Wind_Turbine_Nacelle', name: 'Wind Turbine Nacelle — Tua-bin điện gió', sub: 'Cụm máy phát điện gió nặng, lệch tâm CoG về phía Hub', L: 8.5, W: 3.4, H: 3.6, weight: 80.0, cogX: 0.55, cogY: 0.1, cogZ: 0.0, badge: 'IEC 61400' },
                { id: 'excavator', meshName: 'Excavator_Heavy_Machinery', name: 'Excavator / Heavy Machinery — Máy xúc / Xe cơ giới nặng', sub: 'Máy xúc đào bánh xích công trường, cần gầu vươn', L: 6.4, W: 3.0, H: 3.1, weight: 29.5, cogX: -0.35, cogY: -0.1, cogZ: 0.0, badge: 'ISO 6016' },
                { id: 'boat', meshName: 'Tugboat_Vessel_Hull', name: 'Tugboat / Vessel Hull — Tàu kéo / Vỏ tàu thủy', sub: 'Thân tàu chữ V có sống mũi, cabin lái & đệm chống va', L: 12.0, W: 3.4, H: 3.2, weight: 33.5, cogX: -0.55, cogY: -0.2, cogZ: 0, badge: 'DNV Marine' },
                { id: 'offshore_skid', meshName: 'Heavy_Lift_OOG_Cargo', name: 'Offshore Process Skid (OOG) — Cụm bơm dầu khí siêu trọng', sub: 'Khung skid thép I-beam, đường ống mặt bích & cụm bơm đôi', L: 6.2, W: 3.2, H: 2.8, weight: 36.0, cogX: 0.30, cogY: -0.15, cogZ: -0.20, badge: 'DNV 2.7-3' },
                { id: 'platform', meshName: 'Platform_Container', name: 'Platform Container — Sàn phẳng không vách', sub: 'Sàn thép phẳng 40ft chịu tải điểm cao cho hàng OOG', L: 12.19, W: 2.44, H: 0.70, weight: 8.0, cogX: 0, cogY: 0, cogZ: 0, badge: 'ISO' },
                { id: 'car', meshName: 'SUV_Vehicle', name: 'Heavy Utility Vehicle / SUV — Xe cơ giới / Bán tải', sub: 'Khung gầm 4 bánh độc lập, trọng tâm lệch khoang động cơ', L: 5.2, W: 1.95, H: 1.85, weight: 2.8, cogX: 0.15, cogY: -0.12, cogZ: 0, badge: 'Automotive' },
                { id: 'container_20ft_glb', meshName: 'ISO_Container_20ft', name: 'ISO Container 20ft (GLB) — Container tiêu chuẩn 20ft', sub: 'Digital Twin GLB: Sóng tôn thật, góc đúc ISO 1161', L: 6.058, W: 2.438, H: 2.591, weight: 21.0, cogX: 0, cogY: -0.1, cogZ: 0, badge: 'Digital Twin', verified: true },
                { id: 'container_40ft_glb', meshName: 'ISO_Container_40ft', name: 'ISO Container 40ft (GLB) — Container tiêu chuẩn 40ft', sub: 'Digital Twin GLB: Thép PBR hàng hải, góc đúc ISO 1161', L: 12.192, W: 2.438, H: 2.591, weight: 28.3, cogX: 0, cogY: -0.1, cogZ: 0, badge: 'Digital Twin', verified: true }
            ],
            crane: [
                { id: 'hook_only', meshName: 'Crane_Hook_Block', name: 'Overhead Hook Block — Chế độ cụm móc cẩu thuần túy', sub: 'Tập trung 100% thiết kế bắt cáp, ma ní, tăng đơ & dầm ngáng', badge: 'Rigging Focus', verified: true },
                { id: 'mobile_telescopic', meshName: 'Mobile_Telescopic_Crane', name: 'Mobile Telescopic Crane — Cẩu bánh lốp cần ống lồng LTM 1200', sub: 'All-Terrain Telescopic 200T, 4 chân chống H-Beam & đệm lót tải', badge: 'Mobile 200T', verified: true },
                { id: 'crawler', meshName: 'Lattice_Boom_Crawler_Crane', name: 'Crawler Crane — Cẩu bánh xích cần giàn Liebherr LR 1300', sub: 'Heavy Lattice Boom Crawler 300T trên mặt phẳng thử tải', badge: 'Crawler 300T' },
                { id: 'gantry', meshName: 'Test_Bay_Gantry_Crane', name: 'Gantry Crane — Cầu trục khung giàn thử tải 100T', sub: 'Khung cẩu giàn công nghiệp phục vụ nâng hạ chuẩn xác', badge: 'Test Gantry' }
            ],
            beam: [
                { id: 'spreader', meshName: 'Modular_Spreader_Beam', name: 'Modular Spreader Beam — Dầm ngáng lắp ghép (Modulift)', sub: 'Thiết kế chịu lực nén (Compression), kết hợp cáp trên và cáp dưới', weight: 0.52, badge: 'ASME B30.20', verified: true },
                { id: 'lifting_beam', meshName: 'Lifting_Beam', name: 'Lifting Beam — Dầm nâng (chịu lực uốn - Bending)', sub: 'Móc cẩu móc trực tiếp vào tai treo giữa dầm, tiết kiệm chiều cao', weight: 0.85, badge: 'ASME B30.20' },
                { id: 'frame', meshName: 'H_Beam_Spreader', name: 'H-Beam Spreader — Dầm ngáng chữ H / Khung 4 điểm', sub: 'Phân tải 4 góc thẳng đứng, triệt tiêu lực ép ngang lên kiện hàng', weight: 1.80, badge: 'H-Spreader' },
                { id: 'container_spreader', meshName: 'ISO_Container_Spreader', name: 'ISO Container Spreader — Khung chụp cẩu Container', sub: 'Khung chụp tự động có 4 gù ngàm xoay (Twistlocks) chuẩn ISO 3874', weight: 9.50, badge: 'ISO Twistlock' },
                { id: 'cascaded', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader System — Hệ dầm ngáng nhiều tầng', sub: '1 dầm chính tầng trên + 2 dầm phụ tầng dưới phân đều tải các nhánh', weight: 1.40, badge: 'Cascaded' },
                { id: 'modular_truss', meshName: 'Spreader_Beam', name: 'Spreader Beam (Lattice Truss) — Dầm ngáng giàn không gian', sub: 'Dầm ngáng chịu lực nén tải trọng lớn 100T cho hàng siêu trường', weight: 1.60, badge: 'Compression' },
                { id: 'none', meshName: 'Bridle_Sling', name: 'Bridle Sling (Direct 4-Leg) — Chùm cáp đa nhánh trực tiếp', sub: 'Gom trực tiếp 4 nhánh cáp vào vòng khuyên chính (Master Link)', weight: 0.08, badge: 'ASME B30.9' },
                { id: 'basket', meshName: 'Spreader_Beam', name: 'Basket Spreader Cradle — Hệ dầm ngáng cáp vòng ôm đáy', sub: '2 dầm ngáng + cáp vải bản tròn/dẹt luồn đỡ đáy bồn áp lực / vỏ tàu', weight: 0.90, badge: 'Basket Rig' },
                { id: 'inline4', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader (4-Pt Inline) — Hệ dầm ngáng 4 điểm thẳng hàng', sub: '1 dầm chính + 2 dầm phụ dọc + 4 nhánh cáp phân bố đều tải', weight: 1.30, badge: '4-Line' },
                { id: 'spatial8', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader System (8-Pt) — Hệ dầm ngáng nhiều tầng 8 điểm', sub: 'Hệ 3 tầng dầm ngáng (1 + 2 + 4 dầm) cho 8 điểm neo thiết bị dài', weight: 2.40, badge: '8-Point Tree' },
                { id: 'inline8', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader (8-Pt Inline) — Hệ dầm ngáng 8 điểm dọc', sub: 'Hệ 3 tầng dầm ngáng dọc cho 8 tai cẩu thẳng hàng', weight: 2.20, badge: '8-Line' },
                { id: 'modulift_spreader_glb', meshName: 'Modular_Spreader_Beam', name: 'Modular Spreader Beam (GLB) — Dầm ngáng lắp ghép 1:1', sub: 'ASME B30.20 Digital Twin Spreader Asset', weight: 2.20, badge: 'Digital Twin', verified: true }
            ],
            rig_preset: [
                { id: 'sling_wire_rope', meshName: 'Wire_Rope_Sling', name: 'Wire Rope Sling — Dây cáp thép', sub: 'Cáp thép 6x36 IWRC ép ống chì (Ferrule) & lót bẹn cáp (Thimble)', beam: 'spreader', sling: 'wire', hw: 'bow_shackle', slingL: 4.5, elev: 'top', badge: 'ASME B30.9', verified: true },
                { id: 'sling_chain', meshName: 'Chain_Sling', name: 'Chain Sling — Dây xích cẩu', sub: 'Xích thép hợp kim Grade 80 / Grade 100 chịu mài mòn & nhiệt độ cao', beam: 'none', sling: 'chain', hw: 'clevis_hook', slingL: 4.8, elev: 'top', badge: 'EN 818-4', verified: true },
                { id: 'sling_web', meshName: 'Synthetic_Web_Sling', name: 'Synthetic Web Sling — Dây cáp vải bản dẹt (Polyester)', sub: 'Cáp vải dẹt hai đầu mắt mềm bảo vệ bề mặt sơn thiết bị', beam: 'spreader', sling: 'web', hw: 'bow_shackle', slingL: 4.5, elev: 'top', badge: 'EN 1492-1', verified: true },
                { id: 'sling_round', meshName: 'Round_Sling', name: 'Round Sling — Dây cáp vải bản tròn', sub: 'Cáp vải tròn sợi tổng hợp chịu tải siêu trọng, mềm dẻo ôm sát', beam: 'basket', sling: 'round_sling', hw: 'bow_shackle', slingL: 4.8, elev: 'bottom', badge: 'EN 1492-2', verified: true },
                { id: 'sling_grommet', meshName: 'Grommet_Sling', name: 'Grommet Sling — Cáp thép vòng tròn khép kín', sub: 'Cáp thép bện vòng tròn không mối nối (Endless Grommet) cho Heavy Lift', beam: 'spreader', sling: 'grommet', hw: 'bow_shackle', slingL: 4.5, elev: 'top', badge: 'IMCA M179', verified: true },
                { id: 'preset_direct_4leg', meshName: 'Bridle_Sling', name: 'Bridle Sling (2-Leg, 3-Leg, 4-Leg) — Chùm cáp / Xích đa nhánh', sub: 'Chùm 4 nhánh gom vào vòng khuyên chính (Master Link) trên đầu Hook', beam: 'none', sling: 'wire', hw: 'bow_shackle', slingL: 5.2, elev: 'top', badge: 'ASME B30.9', verified: true },
                { id: 'sling_tagline', meshName: 'Tagline', name: 'Tagline — Dây mồi / Dây thừng neo chống xoay lắc', sub: 'Buộc ở góc kiện hàng, do công nhân cầm kéo dưới đất để định hướng', beam: 'spreader', sling: 'wire', hw: 'bow_shackle', slingL: 4.5, elev: 'top', badge: 'Field Control', verified: true },
                { id: 'preset_modulift_iso', meshName: 'Modular_Spreader_Beam', name: 'Modular Spreader + Wire Rope + Bow Shackle — Bộ ngáng ống chuẩn', sub: 'Phương án tiêu chuẩn: Dầm ngáng Modulift + Cáp thép + Ma ní móng ngựa', beam: 'spreader', sling: 'wire', hw: 'bow_shackle', slingL: 4.5, elev: 'top', badge: 'ASME B30.20' },
                { id: 'preset_cascaded_iso', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader System — Hệ dầm ngáng nhiều tầng 4 góc', sub: 'Ngáng ống 2 tầng SB1/SB2/SB3 + Cáp thép + Ma ní móng ngựa', beam: 'cascaded', sling: 'wire', hw: 'bow_shackle', slingL: 4.5, elev: 'top', badge: 'ASME B30.20' },
                { id: 'preset_hbeam_low', meshName: 'Lifting_Beam', name: 'Lifting Beam + Turnbuckle — Dầm nâng trần thấp & Tăng đơ cân CoG', sub: 'Dầm nâng chịu uốn + Tăng đơ (Turnbuckle) tự động cân bằng trọng tâm', beam: 'lifting_beam', sling: 'wire', hw: 'bow_shackle', slingL: 3.8, elev: 'top', autoLevel: true, badge: 'Low Headroom' },
                { id: 'preset_basket_cradle', meshName: 'Round_Sling', name: 'Basket Cradle + Web/Round Sling — Cáp vải ôm đáy bồn tròn', sub: 'Ngáng đôi + Cáp vải bản dẹt/tròn ôm đáy bảo vệ vỏ bồn áp lực', beam: 'basket', sling: 'web', hw: 'd_shackle', slingL: 4.8, elev: 'bottom', badge: 'Basket Rig' }
            ],
            hardware: [
                { id: 'bow_shackle', meshName: 'Bow_Shackle', name: 'Bow Shackle / Anchor Shackle — Ma ní móng ngựa / Ma ní chữ O', sub: 'Crosby G-2130 dùng chốt an toàn (Safety bolt, nut & cotter pin)', badge: 'ASME B30.26', verified: true },
                { id: 'd_shackle', meshName: 'D_Shackle', name: 'D-Shackle / Dee Shackle — Ma ní chữ D', sub: 'Crosby G-2150 thân hẹp chịu lực kéo thẳng trực tiếp theo phương dọc', badge: 'ASME B30.26', verified: true },
                { id: 'clevis_hook', meshName: 'Clevis_Hook', name: 'Clevis Hook — Móc cẩu chốt xỏ', sub: 'Móc cẩu đầu chữ U có chốt xỏ ngang kết nối trực tiếp mắt xích/cáp', badge: 'ASME B30.10', verified: true },
                { id: 'eye_hook', meshName: 'Eye_Hook', name: 'Eye Hook — Móc cẩu khuyên tròn', sub: 'Móc cẩu thép hợp kim rèn có khuyên tròn cố định & lưỡi gà an toàn', badge: 'ASME B30.10', verified: true },
                { id: 'swivel_hook', meshName: 'Swivel_Hook', name: 'Swivel Hook — Móc cẩu xoay (360 độ)', sub: 'Móc cẩu có khớp bạc đạn xoay 360° chống xoắn cáp khi nâng', badge: 'ASME B30.10', verified: true },
                { id: 'master_link', meshName: 'Master_Link', name: 'Master Link / Oblong Link — Vòng khuyên chính / Khuyên tròn', sub: 'Vòng khuyên thép hợp kim Grade 100 để gom các nhánh cáp vào đầu Hook', badge: 'EN 1677-4', verified: true },
                { id: 'turnbuckle', meshName: 'Turnbuckle', name: 'Turnbuckle — Tăng đơ căn chỉnh độ căng cáp', sub: 'Gồm thân ống ren trái/phải thu ngắn hoặc kéo dài nhánh cáp cân CoG', badge: 'ASTM F1145', verified: true },
                { id: 'wire_rope_clip', meshName: 'Wire_Rope_Clip_UBolt', name: 'Wire Rope Clip / U-Bolt — Khóa cáp / Cóc cáp', sub: 'Cụm bu-lông chữ U, yên tỳ rèn (Forged Saddle) & 2 đai ốc siết cáp', badge: 'ASME B30.26', verified: true },
                { id: 'eye_bolt', meshName: 'Eye_Bolt', name: 'Eye Bolt — Bu-lông vòng / Tai cẩu ren', sub: 'Tai cẩu vòng tròn có vai tỳ (Shoulder) và chân ren vặn vào lốc máy', badge: 'DIN 580 / ASME', verified: true },
                { id: 'thimble', meshName: 'Thimble', name: 'Thimble — Bẹn cáp / Lót cáp', sub: 'Đệm lõi thép hình giọt nước ở mắt cáp chống gập gãy sợi cáp', badge: 'FF-T-276B', verified: true },
                { id: 'ferrule', meshName: 'Ferrule_Wire_Rope_Sleeve', name: 'Ferrule / Wire Rope Sleeve — Ống ép chì / Ống bấm chì', sub: 'Ống hợp kim nhôm/thép ép thủy lực cố định đầu mắt cáp', badge: 'EN 13411-3', verified: true },
                { id: 'plate_clamp', meshName: 'Lifting_Clamp_Plate_Clamp', name: 'Lifting Clamp / Plate Clamp — Kẹp tôn (Đứng / Ngang)', sub: 'Ngàm cam răng cưa tự siết chặt theo tải trọng khi kẹp tấm/dầm thép', badge: 'EN 13155', verified: true },
                { id: 'load_cell', meshName: 'Load_Cell_Dynamometer', name: 'Load Cell / Dynamometer — Cân cẩu / Cảm biến đo lực căng', sub: 'Thiết bị đo lực căng thực tế từng nhánh cáp có màn hình LED hiển thị', badge: 'OIML R60', verified: true },
                { id: 'crosby_shackle_glb', meshName: 'Shackle', name: 'Shackle (Digital Twin GLB) — Ma ní tiêu chuẩn 17T', sub: 'Mô hình chuẩn 1:1 Metric ASME B30.26', badge: 'Digital Twin', verified: true }
            ]
        };

        // --- 2. PHYSICS SIMULATION STATE ---
        const phy = {
            hookTarget: new THREE.Vector3(0, 10.87, 0),
            hookPos: new THREE.Vector3(0, 10.87, 0),
            hookVel: new THREE.Vector3(0, 0, 0),
            hoistSpeed: 0,
            autoHoistActive: false, // True when smooth winch hoisting is running, false when user drags with mouse
            // Mouse-hook controller telemetry.  The command comes from the
            // user's pointer velocity; the physics loop filters it according
            // to whether the lower legs have actually picked up the load.
            dragHookSpeed: 0,
            dragHookLoadCoupling: 0,

            cargoPos: new THREE.Vector3(0, DUNNAGE_H + 1.20, 0),
            cargoVel: new THREE.Vector3(0, 0, 0),
            cargoQuat: new THREE.Quaternion(),
            cargoOmega: new THREE.Vector3(0, 0, 0),

            legTensions: [0, 0, 0, 0, 0, 0, 0, 0],
            upperTensions: [0, 0, 0, 0],
            tensionImpulse: [0, 0, 0, 0, 0, 0, 0, 0],
            legSlacks: [true, true, true, true, true, true, true, true],
            legAngleDeg: [90, 90, 90, 90, 90, 90, 90, 90],
            upperAngleDeg: [60, 60, 60, 60],
            legFactor: [1, 1, 1, 1, 1, 1, 1, 1],
            breakHold: [0, 0, 0, 0, 0, 0, 0, 0],
            upperBreakHold: [0, 0, 0, 0],
            beamCompression: 0,
            damagePct: 0,
            shakeAmp: 0,
            shakeOff: null,
            shockFrames: 0,
            shock: 1,
            rigLive: false,
            beams: [],
            cables: [],
            beamGroups: [],
            maxAngleVert: 0,
            tiltDeg: 0,
            groundClearance: 0,
            gearWeight: 0.65,
            massBreakdown: {
                cargoNetT: 16.0,
                beamMassT: 0.52,
                slingsMassT: 0.08,
                shacklesMassT: 0.05,
                turnbucklesMassT: 0.0,
                hookBlockT: 0.38,
                belowHookRiggingT: 0.65,
                grossHookLoadT: 16.65,
                grossCraneLoadT: 17.03
            },
            slewRate: 0,
            supportLocals: [],
            legForceN: [0, 0, 0, 0],
            cornerSag: [0, 0, 0, 0],
            yieldApplied: false
        };

        const replay = { recording: false, playing: false, t0: 0, cursor: 0, frames: [] };
        const simClock = new THREE.Clock();

        // --- 3. THREE.JS GLOBALS ---
        let scene, camera, renderer, controls, raycaster, mouse, dragPlane;
        let sceneRenderer = null, pbrFactory = null, envManager = null;
        let dragTarget = null; // null | { type: 'hook' | 'cog' | 'lp', index?: number }

        let hookAssemblyGroup, masterLinkMesh, plumbLineMesh;
        let cargoRootGroup, activeCargoVisual, cogIndicatorGroup, cogDropLine, cameraFollowMarker = null;
        let dunnageGroup, craneVehicleGroup, craneDynamicParts = {};
        let keyLight, fillLight, floorMesh, gridHelper, envDressing, waterMesh = null;
        let spreaderRootGroup, pullCompassGroup, pullDirectionArrow;
        let cargoGroundAngleGroup = null, cargoYawGizmoHandle = null;
        const jointLinks = [];
        let padEyeMeshes = [], hwMeshes = [], forceArrows = [], sling3DPool = [];
        let cadEdgeObjects = [];

        // Studio 3D Preview Globals
        let studioScene, studioCamera, studioRenderer, studioControls, studioPreviewGroup;
        let pendingCustomGroup = null;
        let lastUploadedImage = null;
        let activeLibraryCategory = 'cargo';
        let selectedLibraryItem = libraryCatalog.cargo[0];

        const MATS = {};

        function updateLoadingProgress(percent, message) {
            const bar = document.getElementById('app-loading-bar');
            const txt = document.getElementById('app-loading-status');
            const pct = document.getElementById('app-loading-pct');
            if (bar) bar.style.width = percent + '%';
            if (txt && message) txt.textContent = message;
            if (pct) pct.textContent = Math.round(percent) + '%';
        }

        function finishLoadingScreen() {
            updateLoadingProgress(100, 'Sàn mô phỏng Rigging & Lift Plan đã sẵn sàng!');
            setTimeout(() => {
                document.body.classList.add('app-ready');
                const loader = document.getElementById('app-loading-screen');
                if (loader) {
                    loader.classList.add('loaded');
                    setTimeout(() => {
                        if (loader.parentNode) loader.parentNode.removeChild(loader);
                    }, 600);
                }
            }, 260);
        }

        function applyStartupAssemblyPreset() {
            state.cargoType = 'flatrack';
            state.craneType = 'hook_only';
            state.beamType = 'spreader';
            state.slingType = 'chain';
            state.isoCode = '42P1';
            state.tareT = 4.80;
            state.maxPayloadT = 40.20;
            state.maxGrossT = 45.00;
            state.slingLength = 8.00;
            state.upperSlingLength = 8.00;
            state.lowerSlingLength = 2.00;
            state.slingUserSet = true;
            state.oogHasCargo = true;
            state.oogTarp = true;
            state.oogCargoL = 10.50;
            state.oogCargoW = 2.20;
            state.oogCargoH = 2.85;
            setDimAndCoG({ L: 12.192, W: 2.438, H: 2.591, weight: 22.0, cogX: 0.0, cogY: -0.55, cogZ: 0.0 });
            if (state.gear) {
                if (state.gear.beam) state.gear.beam.lengthM = 12.01;
                if (state.gear.uppers) {
                    state.gear.uppers.forEach(u => {
                        u.lengthM = 8.00;
                        // Type is inherited from the global starter preset.
                        // Leave the per-cable override empty so changing the
                        // main sling selector immediately updates the whole
                        // uncustomised tier.
                        u.slingType = null;
                        u.grade = 'chain_g80';
                    });
                }
                if (state.gear.legs) {
                    state.gear.legs.forEach(l => {
                        l.lengthM = 2.00;
                        l.slingType = null;
                        l.grade = 'chain_g80';
                    });
                }
            }
            const activateCard = (selector, attr, val) => {
                document.querySelectorAll(selector).forEach(c => c.classList.toggle('active', c.dataset[attr] === val));
            };
            activateCard('#cargo-library .card-btn', 'cargo', 'flatrack');
            activateCard('#crane-store .card-btn', 'crane', 'hook_only');
            activateCard('#beam-store .card-btn', 'beam', 'spreader');
            activateCard('#sling-store .card-btn', 'sling', 'chain');
            if (typeof syncOogCargoUI === 'function') syncOogCargoUI(true);
        }

        function bootSimulator() {
            updateLoadingProgress(15, 'Khởi tạo vật liệu thép rèn PBR, cáp xoắn IWRC & sàn thử tải...');
            initMaterials();
            updateLoadingProgress(35, 'Thiết lập mặt bằng kỹ thuật phẳng & ánh sáng Studio...');
            initScene();
            updateLoadingProgress(55, 'Lắp ráp cụm Puli Hook, Master Link, Ma ní Crosby & Tai cẩu...');
            buildHookAndRiggingPool();
            updateLoadingProgress(75, 'Khởi tạo thiết bị nâng, dầm ngáng Spreader & giải tích lực...');
            applyStartupAssemblyPreset();
            buildCraneVehicle();
            rebuildCargoAndRig(true);
            updateLoadingProgress(90, 'Đồng bộ kiểm định an toàn ASME B30.9 / B30.20 / P30.1...');
            init3DLibraryStudio();
            initComplianceUI();
            setupUIEvents();
            resetToInitialPreLiftState();
            if (typeof pretensionRig === 'function') pretensionRig();
            if (typeof saveUserInitialBaselineState === 'function') saveUserInitialBaselineState();
            if (typeof openRightDrawer === 'function') openRightDrawer('rig');
            finishLoadingScreen();
            animate();
        }
