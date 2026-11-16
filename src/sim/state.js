/**
 * state — part of the lifting simulator.
 * These files are assembled into one module so they share state, physics and the scene.
 */
        // Floor cribbing removed: static cargo rests flush on the quay / ground plane.
        const DUNNAGE_H = 0;
        const HOOK_MASTER_OFFSET_Y = -0.56; // Hook-block origin → master-link LOWER bearing crown (m)

        // --- 1. ENGINEERING CONFIGURATION STATE ---
        const state = {
            cargoType: 'flatrack',
            L: 12.192,
            W: 2.438,
            H: 2.591,
            weight: 24.0,

            // Out-of-Gauge (OOG) Cargo & Tarpaulin Cover state for Open Top / Flat Rack
            // Flat Rack / Platform: UI stores DELTAS vs ISO frame (OH / OW L·R / OL F·R).
            // Derived absolute crate size is written to oogCargo* by resolveDeckOogGeometry().
            // Open Top still edits oogCargo* as absolute tire/bay dimensions.
            oogHasCargo: true,
            oogTarp: true,
            oogOh: 0.30,       // Over-Height above container highest point (m)
            oogOwL: 0.33,      // Over-Width past −Z (left) side (m)
            oogOwR: 0.33,      // Over-Width past +Z (right) side (m)
            // Flat Rack: ≤ −0.40 (≥40 cm clear of each end wing). Platform: free OL.
            oogOlF: -0.40,
            oogOlR: -0.40,
            oogCargoOffsetX: 0,
            oogCargoOffsetZ: 0,
            oogCargoL: 11.39,  // derived: L − 0.40 − 0.40 (end-wing clear)
            oogCargoW: 3.10,
            oogCargoH: 2.78,

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
            hookCount: 1,           // 1 = single hook, 2 = tandem / dual-crane hooks
            planLugCount: 4,        // guided wizard: 2 / 4 / 8 lift points on cargo
            stsSizeFt: 40,          // STS telescopic container spreader: 20 | 40 | 45
            stsTwinLift: false,     // true → 2×20ft twin-lift CAD spreader
            stsAttachMode: 'direct', // 'direct' = twistlock on container roof; 'cable' = shackles + sling/chain to cargo lugs (single cont only — never twin)
            stsSizeLinked: true,    // true = auto-match spreader ↔ container (direct only); cable mode always forces false
            hoistSpeedScale: 1.0,   // bottom-dock winch rate multiplier (0.25× … 2.0×)
            beamType: 'spreader',   // 'spreader' (Modular Spreader Beam), 'lifting_beam', 'cascaded', 'frame', 'modular_truss', 'basket', 'container_spreader', 'none'
            slingType: 'chain',             // 'wire', 'chain', 'web'
            slingUserSet: true,             // false = auto calculated from span; true = explicit length
            weightUserSet: true,            // false = industrial band from type and size
            hwType: 'bow_shackle',          // 'bow_shackle', 'd_shackle', 'hook'
            slingLength: 8.00,
            upperSlingLength: 8.00,
            lowerSlingLength: 2.00,
            hangerSlingLength: 2.00, // cascaded / truss middle tier (even int)
            cableAdjustMode: false, // show Auto-balance after user edits cable params
            unitSystem: 'metric', // 'metric' (m, mm, kg, t) | 'imperial' (ft, in, lbs)
            wllPerLeg: 16.0,
            // Scissors cut tool: click a sling in the 3D view to sever it at the hit point
            cutToolActive: false,
            gear: {
                selection: [],
                legs: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ lengthM: null, swlT: 16, diaMm: 22, massKg: null, sf: 5, mblT: 80, grade: 'chain_g80', broken: false, slingType: null, parts: 1 })),
                uppers: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ lengthM: null, swlT: 26, diaMm: 26, massKg: null, sf: 5, mblT: 130, grade: 'chain_g80', broken: false, slingType: null, parts: 1 })),
                hangers: [0, 1, 2, 3, 4, 5].map(() => ({ lengthM: null, swlT: 16, diaMm: 22, massKg: null, sf: 5, mblT: 80, grade: 'chain_g80', broken: false, slingType: null, parts: 1 })),
                shackles: [0, 1, 2, 3].map(() => ({ swlT: 26, massKg: null, pinMm: 38, jawMm: 54, sf: 6, mblT: 156 })),
                beam: { swlT: 32, massT: null, lengthM: null, widthM: null, depthM: 0.24, sf: 4, mblT: 128 },
                hook: { swlT: 40, massKg: 380, sf: 4, mblT: 160 },
                members: {},
                extraCables: []
            },
            rigFit: 'fixed',
            lang: (typeof window !== 'undefined' && window.__SAFELIFT_BOOT_LANG__) || 'vi',

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
                enabled: true,
                // Boot cinema (stable) — drawer opens on startup; Fly button starts orbit when wanted
                // Buttons: cinema=Auto | lock=Giữ | angleCycle=Góc | flycam=Fly
                behavior: 'cinema', // 'cinema' | 'lock' | 'angleCycle' | 'flycam'
                mode: 'auto', // focus subject: 'auto' | 'cog' | 'center' | 'top' | 'hook' | 'lp*' | 'custom'
                smart: true,
                customOffset: new THREE.Vector3(0, 0, 0),
                lockedOffset: null, // Vector3 camera−target when locked/cycled
                angleIndex: 0, // 0..11 for clockwise orbit shots
                flycamPhase: 0, // continuous orbit angle (rad)
                flycamPitch: 0.34,
                flycamDist: 22,
                flycamSeeded: false,
                flycamYawRate: 0.12, // rad/s clockwise (~52s / rev) — calm cinematic
                orbiting: false,
                paused: false,
                // Menu settle: pause spin / tab reframes (buttons still work)
                suppressUiReframe: true,
                stableView: true,
                // True after user mouse-drags the view — all auto modes off until a cam button is pressed
                userManual: false,
                // One-shot: after first drawer open, play left-third boot framing
                bootThirdsPending: true,
                focusOverride: null
            },

            // Detailed Orientation, Rotation & Pulling Vector State
            cargoYawDeg: 0,
            cargoPitchTrimDeg: 0,
            cargoRollTrimDeg: 0,
            pullAzimuthDeg: 0,
            pullRadius: 0.0,
            spreaderYawDeg: 0,
            spreaderAlignWithCargo: false,
            // true = móc/master có thể xoay theo mặt phẳng cáp trên (swivel);
            // false = khóa hướng móc theo boom, dao động xoắn truyền xuống cáp
            hookSwivelEnabled: true,
            showGroundAngleIndicator: true,

            // Adaptive render budget for ~60 FPS @ 1080p (level: 0=low, 1=mid, 2=high)
            renderPerf: { level: 2, emaMs: 16.7, burstUntil: 0 },

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
            isRigidPayload: true,
            visualExaggerationScale: 5.0,

            // Site wind field (drives real aerodynamic forces in the solver, see dynamics.js)
            wind: {
                enabled: true,
                speedMps: 3.5,             // mean speed at 10 m reference height (UI: rng-wind-speed)
                dirDeg: 0,                 // 0° blows along +X (cargo length), 90° along +Z
                gust: false,               // coherent +30 % gust envelope (UI: chk-wind-gust)
                turbulenceIntensity: 0.16, // σ_u / V
                baseSpeedMps: 3.5,         // slider setpoint (live speed may wander when vary=true)
                vary: true                 // auto weather: wind/rain intensity drifts over time
            },
            // Site rain (visual + momentum load on cargo roof / windward faces)
            weather: {
                rainMmH: 0,                // 0 = khô, 15 = mưa vừa, 40+ = mưa lớn, 80+ = rất lớn
                rainBaseMmH: 0,
                wetFactor: 0,              // 0..1 surface wetness (ramps with rain)
                liftForceGain: 5.5         // amplify aero on suspended cargo so sway is readable
            },
            // Elastic hoist (wire rope EA + boom compliance + hook block mass) — see dynamics.js
            hoistDynamics: {
                elastic: 'auto',           // rope + boom compliance on real cranes; hook_only = rigid test crown (true/false to force)
                sway: 'auto',              // pendulum sway under the boom nose on real cranes only
                dampingRatio: 0.06,
                swayDampingRatio: 0.05
            },
            rigSolver: {
                enabled: true,
                skl: 1.25,
                hitch: 'Vertical',
                topologyOverride: null
            }
        };

        // --- 1B. EXTENSIBLE 3D ASSET LIBRARY REGISTRY (Built-in + User Uploaded STL/OBJ/GLB & Image-to-3D) ---
        const customCargoMeshes = {}; // id -> THREE.Group prototype
        const customBeamMeshes = {};  // id -> THREE.Group prototype
        const customCraneMeshes = {}; // id -> THREE.Group prototype
        const customHwMeshes = {};    // id -> THREE.Group prototype

        const libraryCatalog = {
            cargo: [
                { id: 'container', meshName: 'ISO_Container_20ft', name: 'ISO Container 20ft DC — Dry Standard 22G1', sub: 'ISO 668 22G1 · 6058×2438×2591 · CAD Realistic V2 · Twistlock 5853×2259', L: 6.058, W: 2.438, H: 2.591, weight: 22, tareT: 2.2, maxPayloadT: 21.77, maxGrossT: 24.00, isoCode: '22G1', cogX: 0, cogY: -0.1, cogZ: 0, badge: 'ISO 22G1' },
                { id: 'iso20hc', meshName: 'ISO_Container_20ft_HC', name: 'ISO Container 20ft HC — High Cube 25G1', sub: 'ISO 668 25G1 · 6058×2438×2896 · CAD Realistic V2', L: 6.058, W: 2.438, H: 2.896, weight: 24, tareT: 2.4, maxPayloadT: 28.13, maxGrossT: 30.48, isoCode: '25G1', cogX: 0, cogY: -0.08, cogZ: 0, badge: 'ISO 25G1' },
                { id: 'iso40', meshName: 'ISO_Container_40ft', name: 'ISO Container 40ft DC — Dry Standard 42G1', sub: 'ISO 668 42G1 · 12192×2438×2591 · CAD Realistic V2 · Twistlock 11985×2259', L: 12.192, W: 2.438, H: 2.591, weight: 26, tareT: 3.8, maxPayloadT: 26.68, maxGrossT: 30.48, isoCode: '42G1', cogX: 0, cogY: -0.1, cogZ: 0, badge: 'ISO 42G1' },
                { id: 'iso40hc', meshName: 'ISO_Container_40ft_HC', name: 'ISO Container 40ft HC — High Cube 45G1', sub: 'ISO 668 45G1 · 12192×2438×2896 · CAD Realistic V2', L: 12.192, W: 2.438, H: 2.896, weight: 28, tareT: 4, maxPayloadT: 26.53, maxGrossT: 30.48, isoCode: '45G1', cogX: 0, cogY: -0.05, cogZ: 0, badge: 'ISO 45G1' },
                { id: 'iso45hc', meshName: 'ISO_Container_45ft_HC', name: 'ISO Container 45ft HC — High Cube L5G1', sub: 'ISO 668 L5G1 · 13716×2438×2896 · 16 castings (40+45 pitch)', L: 13.716, W: 2.438, H: 2.896, weight: 28, tareT: 4.8, maxPayloadT: 25.68, maxGrossT: 30.48, isoCode: 'L5G1', cogX: 0, cogY: -0.08, cogZ: 0, badge: 'ISO L5G1' },
                { id: 'container10', meshName: 'ISO_Container_10ft', name: 'ISO Container 10ft Mini — Dry 12G1', sub: 'ISO 668 12G1 · 2991×2438×2591 · Offshore / mini box', L: 2.991, W: 2.438, H: 2.591, weight: 10, tareT: 1.4, maxPayloadT: 8.86, maxGrossT: 10.16, isoCode: '12G1', cogX: 0, cogY: -0.1, cogZ: 0, badge: 'ISO 12G1' },
                { id: 'iso53hc', meshName: 'ISO_Container_53ft_HC', name: '53ft HC Intermodal — Overhang', sub: '16154×2591×2896 · 40ft spreader castings 11985×2259', L: 16.154, W: 2.591, H: 2.896, weight: 28, tareT: 6.2, maxPayloadT: 24.28, maxGrossT: 30.48, isoCode: '53HC', cogX: 0, cogY: -0.1, cogZ: 0, badge: '53ft HC' },
                { id: 'opentop', meshName: 'Open_Top_Container', name: 'Open Top 20ft — 22U1', sub: 'ISO 1496-1 22U1 · 6058×2438×2591 · CAD Realistic V2', L: 6.058, W: 2.438, H: 2.591, weight: 20, tareT: 2.4, maxPayloadT: 21.60, maxGrossT: 24.00, isoCode: '22U1', cogX: 0, cogY: -0.15, cogZ: 0, badge: 'ISO 22U1' },
                { id: 'opentop40', meshName: 'Open_Top_Container_40ft', name: 'Open Top 40ft — 42U1', sub: 'ISO 1496-1 42U1 · 12192×2438×2591 · CAD Realistic V2', L: 12.192, W: 2.438, H: 2.591, weight: 24, tareT: 4, maxPayloadT: 26.48, maxGrossT: 30.48, isoCode: '42U1', cogX: 0, cogY: -0.15, cogZ: 0, badge: 'ISO 42U1' },
                { id: 'flatrack', meshName: 'Flat_Rack_Container', name: 'Flat Rack 40ft HC — 45P3', sub: 'ISO 1496-5 45P3 · 12192×2438×2896 · CAD Realistic V2', L: 12.192, W: 2.438, H: 2.896, weight: 24, tareT: 5.2, maxPayloadT: 39.80, maxGrossT: 45.00, isoCode: '45P3', cogX: 0, cogY: -0.55, cogZ: 0, badge: 'ISO 45P3' },
                { id: 'flatrack20', meshName: 'Flat_Rack_Container_20ft', name: 'Flat Rack 20ft — 22P3', sub: 'ISO 1496-5 22P3 · 6058×2438×2591 · CAD Realistic V2', L: 6.058, W: 2.438, H: 2.591, weight: 20, tareT: 2.8, maxPayloadT: 31.25, maxGrossT: 34.00, isoCode: '22P3', cogX: 0, cogY: -0.55, cogZ: 0, badge: 'ISO 22P3' },
                { id: 'isotank', meshName: 'Tank_Container_ISO_Tank', name: 'ISO Tank 20ft — 22K2 Liquid/Gas', sub: 'ISO 1496-3 22K2 · 6058×2438×2591 · CAD Realistic V2', L: 6.058, W: 2.438, H: 2.591, weight: 28, tareT: 3.8, maxPayloadT: 32.20, maxGrossT: 36.00, isoCode: '22K2', cogX: 0, cogY: 0.05, cogZ: 0, badge: 'ISO 22K2' },
                { id: 'reefer', meshName: 'Reefer_Container', name: 'Reefer 40ft HC — 45R1', sub: 'ISO 1496-2 45R1 · 12192×2438×2896 · CAD Realistic V2', L: 12.192, W: 2.438, H: 2.896, weight: 26, tareT: 4.6, maxPayloadT: 25.88, maxGrossT: 30.48, isoCode: '45R1', cogX: -0.35, cogY: 0.05, cogZ: 0, badge: 'ISO 45R1' },
                { id: 'reefer20', meshName: 'Reefer_Container_20ft', name: 'Reefer 20ft — 22R1', sub: 'ISO 1496-2 22R1 · 6058×2438×2591 · CAD Realistic V2', L: 6.058, W: 2.438, H: 2.591, weight: 22, tareT: 3, maxPayloadT: 27.48, maxGrossT: 30.48, isoCode: '22R1', cogX: -0.25, cogY: 0.05, cogZ: 0, badge: 'ISO 22R1' },
                { id: 'platform', meshName: 'Platform_Container', name: 'Platform 40ft — 49P0', sub: 'ISO 1496-5 49P0 · 12192×2438×610 · CAD Realistic V2', L: 12.192, W: 2.438, H: 0.610, weight: 20, tareT: 5.6, maxPayloadT: 24.98, maxGrossT: 30.48, isoCode: '49P0', cogX: 0, cogY: 0, cogZ: 0, badge: 'ISO 49P0' },
                { id: 'platform20', meshName: 'Platform_Container_20ft', name: 'Platform 20ft — 29P0', sub: 'ISO 1496-5 29P0 · 6058×2438×335 · CAD Realistic V2', L: 6.058, W: 2.438, H: 0.335, weight: 16, tareT: 2.2, maxPayloadT: 28.28, maxGrossT: 30.48, isoCode: '29P0', cogX: 0, cogY: 0, cogZ: 0, badge: 'ISO 29P0' },
                { id: 'halfheight', meshName: 'Half_Height_Container', name: 'Half-Height 20ft — 28U1', sub: 'ISO 1496-1 28U1 · 6058×2438×1295 · Heavy bulk', L: 6.058, W: 2.438, H: 1.295, weight: 22, tareT: 2.4, maxPayloadT: 28.08, maxGrossT: 30.48, isoCode: '28U1', cogX: 0, cogY: -0.05, cogZ: 0, badge: 'ISO 28U1' },
                { id: 'drybulk', meshName: 'Dry_Bulk_Container', name: 'Dry Bulk 20ft — 22B0 Top Hatches', sub: 'ISO 1496-4 22B0 · 6058×2438×2591 · CAD Realistic V2', L: 6.058, W: 2.438, H: 2.591, weight: 24, tareT: 2.8, maxPayloadT: 27.68, maxGrossT: 30.48, isoCode: '22B0', cogX: 0, cogY: -0.05, cogZ: 0, badge: 'ISO 22B0' },
                { id: 'crate', meshName: 'Heavy_Lift_OOG_Cargo', name: 'Heavy Lift / Out of Gauge (OOG) — Hàng siêu trường siêu trọng', sub: 'Kiện máy công nghiệp đóng khung dầm thép gia cường', L: 4.5, W: 2.8, H: 2.6, weight: 20, cogX: 0, cogY: 0, cogZ: 0, badge: 'OOG Heavy' },
                { id: 'transformer', meshName: 'Transformer', name: 'Transformer — Máy biến áp', sub: 'Máy biến áp lực 110kV có cánh tản nhiệt & sứ cách điện', L: 5.2, W: 2.8, H: 3.2, weight: 66, cogX: 0.65, cogY: 0.15, cogZ: 0.20, badge: 'IEC 60076' },
                { id: 'vessel', meshName: 'Pressure_Vessel', name: 'Pressure Vessel — Bồn áp lực', sub: 'Bồn trụ ngang ASME có tai cẩu hàn trên thân vỏ tròn', L: 7.5, W: 2.6, H: 2.6, weight: 42, cogX: 0, cogY: 0.05, cogZ: 0, badge: 'ASME VIII' },
                { id: 'wind_nacelle', meshName: 'Wind_Turbine_Nacelle', name: 'Wind Turbine Nacelle — Tua-bin điện gió', sub: 'Cụm máy phát điện gió nặng, lệch tâm CoG về phía Hub', L: 8.5, W: 3.4, H: 3.6, weight: 80, cogX: 0.55, cogY: 0.1, cogZ: 0.0, badge: 'IEC 61400' },
                { id: 'excavator', meshName: 'Excavator_Heavy_Machinery', name: 'Excavator / Heavy Machinery — Máy xúc / Xe cơ giới nặng', sub: 'Máy xúc đào bánh xích công trường, cần gầu vươn', L: 6.4, W: 3.0, H: 3.1, weight: 30, cogX: -0.35, cogY: -0.1, cogZ: 0.0, badge: 'ISO 6016' },
                { id: 'boat', meshName: 'Tugboat_Vessel_Hull', name: 'Tugboat / Vessel Hull — Tàu kéo / Vỏ tàu thủy', sub: 'Thân tàu chữ V có sống mũi, cabin lái & đệm chống va', L: 12.0, W: 3.4, H: 3.2, weight: 34, cogX: -0.55, cogY: -0.2, cogZ: 0, badge: 'DNV Marine' },
                { id: 'offshore_skid', meshName: 'Heavy_Lift_OOG_Cargo', name: 'Offshore Process Skid (OOG) — Cụm bơm dầu khí siêu trọng', sub: 'Khung skid thép I-beam, đường ống mặt bích & cụm bơm đôi', L: 6.2, W: 3.2, H: 2.8, weight: 36, cogX: 0.30, cogY: -0.15, cogZ: -0.20, badge: 'DNV 2.7-3' },
                { id: 'car', meshName: 'Vehicle', name: 'Vehicle — Xe bus / Xe cơ giới', sub: 'Mô hình 3D CAD 1:1 thân xe bus, trọng tâm thấp gần sàn', L: 9.0, W: 2.38, H: 2.80, weight: 10, cogX: 0.0, cogY: -0.35, cogZ: 0, badge: '3D CAD 1:1' },
                { id: 'container_20ft_glb', meshName: 'ISO_Container_20ft', name: 'ISO Container 20ft (alias)', sub: 'Maps to Realistic V2 22G1 CAD', L: 6.058, W: 2.438, H: 2.591, weight: 22, cogX: 0, cogY: -0.1, cogZ: 0, badge: 'CAD V2', verified: true },
                { id: 'container_40ft_glb', meshName: 'ISO_Container_40ft', name: 'ISO Container 40ft (alias)', sub: 'Maps to Realistic V2 42G1 CAD', L: 12.192, W: 2.438, H: 2.591, weight: 26, cogX: 0, cogY: -0.1, cogZ: 0, badge: 'CAD V2', verified: true }
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
                { id: 'container_spreader', meshName: 'ISO_Container_Spreader', name: 'STS Container Spreader — Ngáng chụp cẩu STS/RTG', sub: 'Telescopic ISO 20/40/45ft · Headblock + twistlock · Không móc/cáp bridle', weight: 9.50, badge: 'STS ISO' },
                { id: 'none', meshName: 'Bridle_Sling', name: 'Bridle Sling (Direct 4-Leg) — Chùm cáp đa nhánh trực tiếp', sub: 'Gom trực tiếp 4 nhánh cáp vào vòng khuyên chính (Master Link)', weight: 0.08, badge: 'ASME B30.9' },
                { id: 'basket', meshName: 'Spreader_Beam', name: 'Basket Spreader Cradle — Hệ dầm ngáng cáp vòng ôm đáy', sub: '2 thanh ngang · mỗi thanh 2 cáp trên (không treo 1 điểm giữa) + 2 nhánh dưới ôm đáy', weight: 0.90, badge: '2×2 upper' },
                { id: 'inline4', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader (4-Pt Inline) — Hệ dầm ngáng 4 điểm thẳng hàng', sub: '1 dầm chính + 2 dầm phụ dọc + 4 nhánh cáp phân bố đều tải', weight: 1.30, badge: '4-Line' },
                { id: 'spatial8', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader System (8-Pt) — Hệ dầm ngáng nhiều tầng 8 điểm', sub: 'Hệ 3 tầng dầm ngáng (1 + 2 + 4 dầm) cho 8 điểm neo thiết bị dài', weight: 2.40, badge: '8-Point Tree' },
                { id: 'inline8', meshName: 'Cascaded_Spreader_System', name: 'Cascaded Spreader (8-Pt Inline) — Hệ dầm ngáng 8 điểm dọc', sub: 'Hệ 3 tầng dầm ngáng dọc cho 8 tai cẩu thẳng hàng', weight: 2.20, badge: '8-Line' },
                { id: 'modulift_spreader_glb', meshName: 'Modular_Spreader_Beam', name: 'Modular Spreader Beam (GLB) — Dầm ngáng lắp ghép 1:1', sub: 'ASME B30.20 Digital Twin Spreader Asset', weight: 2.20, badge: 'Digital Twin', verified: true }
            ],
            rig_preset: [
                { id: 'sling_wire_rope', meshName: 'Wire_Rope_Sling', name: 'Wire Rope Sling — Dây cáp thép', sub: 'Cáp thép 6x36 IWRC ép ống chì (Ferrule) & lót bẹn cáp (Thimble)', beam: 'spreader', sling: 'wire', hw: 'bow_shackle', slingL: 8.0, elev: 'top', badge: 'ASME B30.9', verified: true },
                { id: 'sling_chain', meshName: 'Chain_Sling', name: 'Chain Sling — Dây xích cẩu', sub: 'Xích thép hợp kim Grade 80 / Grade 100 chịu mài mòn & nhiệt độ cao', beam: 'none', sling: 'chain', hw: 'clevis_hook', slingL: 8.0, elev: 'top', badge: 'EN 818-4', verified: true },
                { id: 'sling_web', meshName: 'Synthetic_Web_Sling', name: 'Synthetic Web Sling — Dây cáp vải bản dẹt (Polyester)', sub: 'Cáp vải dẹt hai đầu mắt mềm bảo vệ bề mặt sơn thiết bị', beam: 'spreader', sling: 'web', hw: 'bow_shackle', slingL: 8.0, elev: 'top', badge: 'EN 1492-1', verified: true },
                { id: 'sling_round', meshName: 'Round_Sling', name: 'Round Sling — Dây cáp vải bản tròn', sub: 'Cáp vải tròn sợi tổng hợp chịu tải siêu trọng, mềm dẻo ôm sát', beam: 'basket', sling: 'round_sling', hw: 'bow_shackle', slingL: 8.0, elev: 'bottom', badge: 'EN 1492-2', verified: true },
                { id: 'sling_grommet', meshName: 'Grommet_Sling', name: 'Grommet Sling — Cáp thép vòng tròn khép kín', sub: 'Cáp thép bện vòng tròn không mối nối (Endless Grommet) cho Heavy Lift', beam: 'spreader', sling: 'grommet', hw: 'bow_shackle', slingL: 8.0, elev: 'top', badge: 'IMCA M179', verified: true },
                { id: 'preset_direct_4leg', meshName: 'Bridle_Sling', name: 'Bridle Sling (2-Leg, 3-Leg, 4-Leg) — Chùm cáp / Xích đa nhánh', sub: 'Chùm 4 nhánh gom vào vòng khuyên chính (Master Link) trên đầu Hook', beam: 'none', sling: 'wire', hw: 'bow_shackle', slingL: 8.0, elev: 'top', badge: 'ASME B30.9', verified: true },
                { id: 'sling_tagline', meshName: 'Tagline', name: 'Tagline — Dây mồi / Dây thừng neo chống xoay lắc', sub: 'Buộc ở góc kiện hàng, do công nhân cầm kéo dưới đất để định hướng', beam: 'spreader', sling: 'wire', hw: 'bow_shackle', slingL: 8.0, elev: 'top', badge: 'Field Control', verified: true },
                { id: 'preset_modulift_iso', meshName: 'Modular_Spreader_Beam', name: 'Modular Spreader + Wire Rope + Bow Shackle — Bộ ngáng ống chuẩn', sub: 'Phương án tiêu chuẩn: Dầm ngáng Modulift + Cáp thép + Ma ní móng ngựa', beam: 'spreader', sling: 'wire', hw: 'bow_shackle', slingL: 8.0, elev: 'top', badge: 'ASME B30.20' },
                { id: 'preset_hbeam_low', meshName: 'Lifting_Beam', name: 'Lifting Beam + Turnbuckle — Dầm nâng trần thấp & Tăng đơ cân CoG', sub: 'Dầm nâng chịu uốn + Tăng đơ (Turnbuckle) tự động cân bằng trọng tâm', beam: 'lifting_beam', sling: 'wire', hw: 'bow_shackle', slingL: 8.0, elev: 'top', autoLevel: true, badge: 'Low Headroom' },
                { id: 'preset_basket_cradle', meshName: 'Round_Sling', name: 'Basket Cradle + Web/Round Sling — Cáp vải ôm đáy bồn tròn', sub: 'Ngáng đôi + Cáp vải bản dẹt/tròn ôm đáy bảo vệ vỏ bồn áp lực', beam: 'basket', sling: 'web', hw: 'd_shackle', slingL: 8.0, elev: 'bottom', badge: 'Basket Rig' }
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

            cargoPos: new THREE.Vector3(0, 1.2955, 0), // ~H/2 — flush on ground (no cribbing)
            cargoVel: new THREE.Vector3(0, 0, 0),
            cargoQuat: new THREE.Quaternion(),
            cargoOmega: new THREE.Vector3(0, 0, 0),

            legTensions: [0, 0, 0, 0, 0, 0, 0, 0],
            upperTensions: [0, 0, 0, 0, 0, 0, 0, 0],
            tensionImpulse: [0, 0, 0, 0, 0, 0, 0, 0],
            legSlacks: [true, true, true, true, true, true, true, true],
            legAngleDeg: [90, 90, 90, 90, 90, 90, 90, 90],
            upperAngleDeg: [50, 50, 50, 50, 50, 50, 50, 50],
            legFactor: [1, 1, 1, 1, 1, 1, 1, 1],
            breakHold: [0, 0, 0, 0, 0, 0, 0, 0],
            upperBreakHold: [0, 0, 0, 0, 0, 0, 0, 0],
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
            yieldApplied: false,
            structuralDeformation: {
                cargoDeflectionMm: 0,
                cargoTwistDeg: 0,
                beamDeflectionMm: 0,
                beamTwistDeg: 0,
                spreaderAmplification: 1.0,
                eccentricTorqueNm: 0
            }
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

        function splashText(key, fallbackVi, fallbackEn) {
            const i18n = (typeof window !== 'undefined' && window.SafeLift && window.SafeLift.i18n) ? window.SafeLift.i18n : null;
            if (i18n && typeof i18n.t === 'function') return i18n.t(key, state.lang);
            return state.lang === 'en' ? (fallbackEn || fallbackVi) : fallbackVi;
        }

        function updateLoadingProgress(percent, message) {
            const bar = document.getElementById('app-loading-bar');
            const txt = document.getElementById('app-loading-status');
            const pct = document.getElementById('app-loading-pct');
            const stream = document.getElementById('app-loading-stream');
            if (bar) bar.style.width = percent + '%';
            if (txt && message) txt.textContent = message;
            if (pct) pct.textContent = Math.round(percent) + '%';
            if (stream) {
                const lanes = ['sys://physics', 'xpbd-solver', 'rigging-catalog', 'asme-compliance', 'viewport'];
                const idx = Math.min(lanes.length - 1, Math.floor((percent / 100) * lanes.length));
                stream.textContent = lanes.slice(0, idx + 1).join(' · ');
            }
        }

        function finishLoadingScreen(opts) {
            const holdMs = (opts && opts.holdMs != null) ? opts.holdMs : 520;
            const fadeMs = (opts && opts.fadeMs != null) ? opts.fadeMs : 700;
            updateLoadingProgress(100, (opts && opts.message) || splashText('splashReady',
                'Sẵn sàng — SafeLift3D đã khởi tạo.',
                'Ready — SafeLift3D is initialized.'));
            setTimeout(() => {
                document.body.classList.add('app-ready');
                const loader = document.getElementById('app-loading-screen');
                if (loader) {
                    loader.classList.add('loaded');
                    setTimeout(() => {
                        if (loader.parentNode) loader.parentNode.removeChild(loader);
                    }, fadeMs);
                }
            }, holdMs);
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
            state.hangerSlingLength = 2.00;
            state.slingUserSet = true;
            state.cableAdjustMode = false;
            state.oogHasCargo = true;
            state.oogTarp = true;
            state.oogOh = 0.30;
            state.oogOwL = 0.33;
            state.oogOwR = 0.33;
            state.oogOlF = -0.40;
            state.oogOlR = -0.40;
            state.oogCargoOffsetX = 0;
            state.oogCargoOffsetZ = 0;
            state.oogCargoL = 11.39;
            state.oogCargoW = 3.10;
            state.oogCargoH = 2.78;
            // CoG at geometric centre of combined FR + OOG envelope (Y rises with OH)
            setDimAndCoG({ L: 12.192, W: 2.438, H: 2.591, weight: 24, cogX: 0.0, cogY: 0.21, cogZ: 0.0 });
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
            if (typeof autoSizeGearForLoad === 'function') {
                autoSizeGearForLoad(24, { betaWorstDeg: 40 });
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
            const yearEl = document.getElementById('app-loading-year');
            if (yearEl) yearEl.textContent = String(new Date().getFullYear());
            const tagline = document.getElementById('app-loading-tagline');
            if (tagline) {
                tagline.textContent = state.lang === 'en'
                    ? 'HEAVY RIGGING & LIFT PLANNER · CAE DIGITAL TWIN'
                    : 'MÔ PHỎNG NÂNG HẠ & LẬP PHƯƠNG ÁN · DIGITAL TWIN CAE';
            }

            updateLoadingProgress(8, splashText('splashPhysics', 'Đang tải Physics Engine…', 'Loading Physics Engine…'));
            updateLoadingProgress(15, splashText('splashMaterials',
                'Khởi tạo vật liệu PBR, cáp IWRC & sàn thử tải…',
                'Initializing PBR steel, IWRC rope & test deck…'));
            initMaterials();
            updateLoadingProgress(35, splashText('splashScene',
                'Thiết lập mặt bằng kỹ thuật & ánh sáng Studio…',
                'Setting up engineering ground plane & studio lighting…'));
            initScene();
            updateLoadingProgress(55, splashText('splashHook',
                'Lắp ráp Puli Hook, Master Link, ma ní & tai cẩu…',
                'Assembling hook block, master link, shackles & pad-eyes…'));
            buildHookAndRiggingPool();
            updateLoadingProgress(75, splashText('splashGear',
                'Khởi tạo thiết bị nâng, dầm Spreader & giải tích lực…',
                'Initializing lifting gear, spreader beams & force analysis…'));
            applyStartupAssemblyPreset();
            buildCraneVehicle();
            rebuildCargoAndRig(true);
            updateLoadingProgress(82, splashText('splashCatalog',
                'Khởi tạo Rigging Catalog…',
                'Initializing Rigging Catalog…'));
            updateLoadingProgress(88, splashText('splashCompliance',
                'Nạp quy tắc kiểm tra ASME B30.9 / B30.20 / P30.1…',
                'Loading ASME B30.9 / B30.20 / P30.1 compliance checks…'));
            init3DLibraryStudio();
            initComplianceUI();
            setupUIEvents();
            resetToInitialPreLiftState();
            if (typeof pretensionRig === 'function') pretensionRig();
            if (typeof saveUserInitialBaselineState === 'function') saveUserInitialBaselineState();
            if (typeof window.bootstrapCameraFollow === 'function') {
                window.bootstrapCameraFollow();
            } else if (state.cameraFollow && camera && controls) {
                state.cameraFollow.behavior = 'cinema';
                state.cameraFollow.stableView = true;
                state.cameraFollow.suppressUiReframe = true;
                state.cameraFollow.lockedOffset = camera.position.clone().sub(controls.target);
            }
            if (typeof openRightDrawer === 'function') openRightDrawer('rig');

            // Keep the loading screen up while drawer layout settles and the hero
            // camera is snapped under the overlay — first visible frame must already be cinematic.
            updateLoadingProgress(92, splashText('splashCamera',
                'Canh khung hình cinematic…',
                'Framing cinematic camera…'));
            const warmAndReveal = () => {
                updateLoadingProgress(96, splashText('splashWarm',
                    'Ổn định góc máy & làm nóng khung hình…',
                    'Stabilizing view & warming frames…'));
                if (typeof window.invalidateUiSafeNdcCache === 'function') {
                    window.invalidateUiSafeNdcCache();
                }
                if (typeof window.frameCinematicHeroShot === 'function') {
                    window.frameCinematicHeroShot({ immediate: true, force: true });
                }
                if (state.cameraFollow) state.cameraFollow.bootThirdsPending = false;

                // Warm a few renders behind the loader so shaders/shadows don't hitch on reveal
                let warmLeft = 4;
                const warmTick = () => {
                    try {
                        if (typeof updateSceneAndTelemetry === 'function') updateSceneAndTelemetry();
                        if (controls) controls.update();
                        if (sceneRenderer && typeof sceneRenderer.render === 'function') {
                            sceneRenderer.render(1 / 60);
                        } else if (renderer && scene && camera) {
                            renderer.render(scene, camera);
                        }
                    } catch (e) { /* ignore warm errors */ }
                    warmLeft -= 1;
                    if (warmLeft > 0) {
                        requestAnimationFrame(warmTick);
                        return;
                    }
                    const readyMsg = splashText('splashReady',
                        'Sẵn sàng — SafeLift3D đã khởi tạo.',
                        'Ready — SafeLift3D is initialized.');
                    updateLoadingProgress(100, readyMsg);
                    animate();
                    finishLoadingScreen({
                        holdMs: 640,
                        fadeMs: 850,
                        message: readyMsg
                    });
                };
                requestAnimationFrame(warmTick);
            };
            // Allow CSS drawer slide + layout to finish before measuring free-stage 1/3
            setTimeout(() => requestAnimationFrame(warmAndReveal), 520);
        }
