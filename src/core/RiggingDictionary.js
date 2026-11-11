/**
 * ============================================================================
 * STANDARDIZED RIGGING & LIFTING DICTIONARY (RiggingDictionary.js)
 * Bilingual Industry Terminology (English - Vietnamese) & Canonical 3D Mesh Names
 * Standards: ASME B30.9, ASME B30.20, ASME B30.26, ASME P30.1, ISO 668, ISO 3874
 * ============================================================================
 */

export const RIGGING_DICTIONARY = {
    // 1. HÀNG HÓA & KIỆN HÀNG (CARGO & LOAD TYPES)
    cargo: {
        iso_container_20ft: {
            id: 'container',
            meshName: 'ISO_Container_20ft',
            en: 'ISO Container 20ft',
            vi: 'Container tiêu chuẩn 20ft',
            label: 'ISO Container 20ft — Container tiêu chuẩn',
            sub: 'ISO 668 / 22G1 · Standard Dry Cargo Container'
        },
        iso_container_40ft: {
            id: 'iso40',
            meshName: 'ISO_Container_40ft',
            en: 'ISO Container 40ft',
            vi: 'Container tiêu chuẩn 40ft',
            label: 'ISO Container 40ft — Container tiêu chuẩn',
            sub: 'ISO 668 / 42G1 · 40ft Dry Cargo Container'
        },
        iso_container_40hc: {
            id: 'iso40hc',
            meshName: 'ISO_Container_40ft_HC',
            en: 'ISO Container 40ft HC',
            vi: 'Container tiêu chuẩn 40ft Cao (High Cube)',
            label: 'ISO Container 40ft HC — Container tiêu chuẩn cao',
            sub: 'ISO 668 / 45G1 · High Cube Container'
        },
        flat_rack_container: {
            id: 'flatrack',
            meshName: 'Flat_Rack_Container',
            en: 'Flat Rack Container',
            vi: 'Container mặt bằng (không vách)',
            label: 'Flat Rack Container — Container mặt bằng (không vách)',
            sub: 'ISO 45P3 · Heavy I-Beam Deck & End Bulkheads (OOG Ready)'
        },
        open_top_container: {
            id: 'opentop',
            meshName: 'Open_Top_Container',
            en: 'Open Top Container',
            vi: 'Container hở mái',
            label: 'Open Top Container — Container hở mái',
            sub: 'ISO 22U1 · Removable Roof Bows & Deformable Tarpaulin Sheet'
        },
        tank_container: {
            id: 'isotank',
            meshName: 'Tank_Container_ISO_Tank',
            en: 'Tank Container (ISO Tank)',
            vi: 'Container bồn chứa',
            label: 'Tank Container (ISO Tank) — Container bồn chứa',
            sub: 'ISO 22K2 / T11 · Stainless Pressure Tank in 20ft ISO Frame'
        },
        reefer_container: {
            id: 'reefer',
            meshName: 'Reefer_Container',
            en: 'Reefer Container',
            vi: 'Container lạnh',
            label: 'Reefer Container — Container lạnh',
            sub: 'ISO 45R1 · Refrigerated Container with Thermo Unit'
        },
        heavy_lift_oog: {
            id: 'crate',
            meshName: 'Heavy_Lift_OOG_Cargo',
            en: 'Heavy Lift / Out of Gauge (OOG)',
            vi: 'Hàng siêu trường siêu trọng',
            label: 'Heavy Lift / Out of Gauge (OOG) — Hàng siêu trường siêu trọng',
            sub: 'Breakbulk Machinery Case on Reinforced Steel Skid'
        },
        transformer: {
            id: 'transformer',
            meshName: 'Transformer',
            en: 'Transformer',
            vi: 'Máy biến áp',
            label: 'Transformer — Máy biến áp',
            sub: '110kV Substation Power Transformer (Eccentric CoG)'
        },
        pressure_vessel: {
            id: 'vessel',
            meshName: 'Pressure_Vessel',
            en: 'Pressure Vessel',
            vi: 'Bồn áp lực',
            label: 'Pressure Vessel — Bồn áp lực',
            sub: 'ASME Section VIII Cylindrical Process Vessel on Saddles'
        },
        wind_turbine_nacelle: {
            id: 'wind_nacelle',
            meshName: 'Wind_Turbine_Nacelle',
            en: 'Wind Turbine Nacelle',
            vi: 'Tua-bin điện gió',
            label: 'Wind Turbine Nacelle — Tua-bin điện gió',
            sub: 'Offshore Wind Turbine Nacelle & Rotor Hub Assembly'
        },
        excavator_heavy_machinery: {
            id: 'excavator',
            meshName: 'Excavator_Heavy_Machinery',
            en: 'Excavator / Heavy Machinery',
            vi: 'Máy xúc / Xe cơ giới nặng',
            label: 'Excavator / Heavy Machinery — Máy xúc / Xe cơ giới nặng',
            sub: 'Tracked Hydraulic Excavator & Heavy Construction Plant'
        },
        tugboat_vessel_hull: {
            id: 'boat',
            meshName: 'Tugboat_Vessel_Hull',
            en: 'Tugboat / Vessel Hull',
            vi: 'Tàu kéo / Vỏ tàu thủy',
            label: 'Tugboat / Vessel Hull — Tàu kéo / Vỏ tàu thủy',
            sub: 'Deep-V Workboat / Vessel Hull on Marine Lifting Cradle'
        },
        vehicle: {
            id: 'car',
            meshName: 'Vehicle',
            en: 'Vehicle',
            vi: 'Xe bus / Xe cơ giới',
            label: 'Vehicle — Xe bus / Xe cơ giới',
            sub: '3D CAD 1:1 bus / motor-vehicle body for exterior sling wrap'
        }
    },

    // 2. DỤNG CỤ NÂNG HẠ / PHỤ KIỆN KẾT NỐI (RIGGING HARDWARE & GEARS)
    hardware: {
        shackle: {
            id: 'shackle',
            meshName: 'Shackle',
            en: 'Shackle',
            vi: 'Ma ní (gọi chung)',
            label: 'Shackle — Ma ní'
        },
        bow_shackle: {
            id: 'bow_shackle',
            meshName: 'Bow_Shackle',
            en: 'Bow Shackle / Anchor Shackle',
            vi: 'Ma ní móng ngựa / Ma ní chữ O (Safety pin)',
            label: 'Bow Shackle / Anchor Shackle — Ma ní móng ngựa / chữ O',
            sub: 'Crosby G-2130 Bolt-Type Anchor Shackle with Safety Cotter Pin'
        },
        d_shackle: {
            id: 'd_shackle',
            meshName: 'D_Shackle',
            en: 'D-Shackle / Dee Shackle',
            vi: 'Ma ní chữ D',
            label: 'D-Shackle / Dee Shackle — Ma ní chữ D',
            sub: 'Crosby G-2150 Bolt-Type Chain / Dee Shackle for In-Line Loads'
        },
        hook: {
            id: 'hook',
            meshName: 'Hook',
            en: 'Hook',
            vi: 'Móc cẩu (gọi chung)',
            label: 'Hook — Móc cẩu'
        },
        clevis_hook: {
            id: 'clevis_hook',
            meshName: 'Clevis_Hook',
            en: 'Clevis Hook',
            vi: 'Móc cẩu chốt xỏ',
            label: 'Clevis Hook — Móc cẩu chốt xỏ',
            sub: 'Grade 100 Forged Alloy Clevis Sling Hook with Safety Latch'
        },
        eye_hook: {
            id: 'eye_hook',
            meshName: 'Eye_Hook',
            en: 'Eye Hook',
            vi: 'Móc cẩu khuyên tròn',
            label: 'Eye Hook — Móc cẩu khuyên tròn',
            sub: 'Crosby A-323 Forged Alloy Eye Hoist Hook with Safety Latch'
        },
        swivel_hook: {
            id: 'swivel_hook',
            meshName: 'Swivel_Hook',
            en: 'Swivel Hook',
            vi: 'Móc cẩu xoay (360 độ)',
            label: 'Swivel Hook — Móc cẩu xoay (360°)',
            sub: 'Ball-Bearing 360° Swivel Hoist Hook with Safety Latch'
        },
        master_link: {
            id: 'master_link',
            meshName: 'Master_Link',
            en: 'Master Link / Oblong Link',
            vi: 'Vòng khuyên chính / Khuyên tròn',
            label: 'Master Link / Oblong Link — Vòng khuyên chính (gom cáp)',
            sub: 'Crosby A-342 Forged Alloy Oblong Master Link for Multi-Leg Bridles'
        },
        turnbuckle: {
            id: 'turnbuckle',
            meshName: 'Turnbuckle',
            en: 'Turnbuckle',
            vi: 'Tăng đơ',
            label: 'Turnbuckle — Tăng đơ căn chỉnh độ căng cáp',
            sub: 'Crosby HG-228 Jaw & Jaw Forged Open-Body Rigging Turnbuckle'
        },
        wire_rope_clip: {
            id: 'wire_rope_clip',
            meshName: 'Wire_Rope_Clip_UBolt',
            en: 'Wire Rope Clip / U-Bolt',
            vi: 'Khóa cáp / Cóc cáp',
            label: 'Wire Rope Clip / U-Bolt — Khóa cáp / Cóc cáp',
            sub: 'Crosby G-450 Forged Red-U-Bolt Wire Rope Clamp ("Never Saddle a Dead Horse")'
        },
        eye_bolt: {
            id: 'eye_bolt',
            meshName: 'Eye_Bolt',
            en: 'Eye Bolt',
            vi: 'Bu-lông vòng / Tai cẩu ren',
            label: 'Eye Bolt — Bu-lông vòng / Tai cẩu ren',
            sub: 'DIN 580 / ASME B18.15 Forged Shoulder Machinery Eye Bolt'
        },
        thimble: {
            id: 'thimble',
            meshName: 'Thimble',
            en: 'Thimble',
            vi: 'Bẹn cáp / Lót cáp',
            label: 'Thimble — Bẹn cáp / Lót cáp hình giọt nước',
            sub: 'Heavy-Duty Galvanized Wire Rope Eye Thimble Liner (G-414)'
        },
        ferrule: {
            id: 'ferrule',
            meshName: 'Ferrule_Wire_Rope_Sleeve',
            en: 'Ferrule / Wire Rope Sleeve',
            vi: 'Ống ép chì / Ống bấm chì',
            label: 'Ferrule / Wire Rope Sleeve — Ống ép chì / Ống bấm chì',
            sub: 'EN 13411-3 Swaged Mechanical Splice Ferrule Termination Sleeve'
        },
        plate_clamp: {
            id: 'plate_clamp',
            meshName: 'Lifting_Clamp_Plate_Clamp',
            en: 'Lifting Clamp / Plate Clamp',
            vi: 'Kẹp tôn (Kẹp đứng hoặc Kẹp ngang)',
            label: 'Lifting Clamp / Plate Clamp — Kẹp tôn (đứng / ngang)',
            sub: 'Articulated Serrated-Cam Steel Plate & Girder Lifting Clamp'
        },
        load_cell: {
            id: 'load_cell',
            meshName: 'Load_Cell_Dynamometer',
            en: 'Load Cell / Dynamometer',
            vi: 'Cân cẩu / Cảm biến đo lực căng',
            label: 'Load Cell / Dynamometer — Cân cẩu / Cảm biến đo lực căng',
            sub: 'Wireless Telemetry Digital Crane Tension Dynamometer Load Cell'
        }
    },

    // 3. DÂY CÁP & BỘ DÂY CẨU (SLINGS, ROPES & TETHERS)
    slings: {
        wire_rope_sling: {
            id: 'wire',
            meshName: 'Wire_Rope_Sling',
            en: 'Wire Rope Sling',
            vi: 'Dây cáp thép',
            label: 'Wire Rope Sling — Dây cáp thép',
            sub: '6×36 IWRC Steel Wire Rope Sling with Thimble & Swaged Ferrule'
        },
        chain_sling: {
            id: 'chain',
            meshName: 'Chain_Sling',
            en: 'Chain Sling',
            vi: 'Dây xích cẩu',
            label: 'Chain Sling — Dây xích cẩu',
            sub: 'Grade 80 / Grade 100 Alloy Steel Short-Link Lifting Chain'
        },
        synthetic_web_sling: {
            id: 'web',
            meshName: 'Synthetic_Web_Sling',
            en: 'Synthetic Web Sling',
            vi: 'Dây cáp vải bản dẹt (Polyester)',
            label: 'Synthetic Web Sling — Dây cáp vải bản dẹt',
            sub: 'EN 1492-1 Flat Woven Polyester Webbing Sling with Reinforced Eyes'
        },
        round_sling: {
            id: 'round_sling',
            meshName: 'Round_Sling',
            en: 'Round Sling',
            vi: 'Dây cáp vải bản tròn',
            label: 'Round Sling — Dây cáp vải bản tròn',
            sub: 'EN 1492-2 Endless High-Tenacity Polyester/HMPE Tubular Round Sling'
        },
        grommet_sling: {
            id: 'grommet',
            meshName: 'Grommet_Sling',
            en: 'Grommet Sling',
            vi: 'Cáp thép vòng tròn khép kín',
            label: 'Grommet Sling — Cáp thép vòng tròn khép kín',
            sub: 'IMCA M 179 Endless Cable-Laid Heavy Lift Wire Rope Grommet'
        },
        bridle_sling: {
            id: 'bridle',
            meshName: 'Bridle_Sling',
            en: 'Bridle Sling (2-Leg, 3-Leg, 4-Leg)',
            vi: 'Chùm cáp / Xích đa nhánh (2 nhánh, 3 nhánh, 4 nhánh)',
            label: 'Bridle Sling (2-Leg, 3-Leg, 4-Leg) — Chùm cáp đa nhánh',
            sub: 'ASME B30.9 Multi-Leg Bridle Assembly Collected at Oblong Master Link'
        },
        tagline: {
            id: 'tagline',
            meshName: 'Tagline',
            en: 'Tagline',
            vi: 'Dây mồi / Dây thừng neo',
            label: 'Tagline — Dây mồi / Dây thừng neo chống xoay',
            sub: 'Anti-Spin Ground Control Tether Rope Attached to Load Corners'
        }
    },

    // 4. DẦM NGÁNG & ĐÒN GÁNH (SPREADERS & LIFTING BEAMS)
    spreaders: {
        spreader_beam: {
            id: 'spreader',
            meshName: 'Modular_Spreader_Beam',
            en: 'Modular Spreader Beam (Spreader Beam)',
            vi: 'Dầm ngáng lắp ghép chịu nén (Modulift)',
            label: 'Modular Spreader Beam — Dầm ngáng lắp ghép (Chịu nén)',
            sub: 'Pure Axial Compression Tubular Strut with Top & Bottom Slings'
        },
        lifting_beam: {
            id: 'lifting_beam',
            meshName: 'H_Beam_Lifting_Beam',
            en: 'Lifting Beam / H-Beam Spreader',
            vi: 'Dầm nâng / Dầm ngáng chữ H (Chịu uốn)',
            label: 'Lifting Beam (H-Beam Spreader) — Dầm nâng chữ H (Chịu uốn)',
            sub: 'Bending-Resistant Wide-Flange Steel H-Beam with Center Bail Eye'
        },
        iso_container_spreader: {
            id: 'container_spreader',
            meshName: 'ISO_Container_Spreader',
            en: 'ISO Container Spreader',
            vi: 'Khung chụp cẩu Container (Twistlocks)',
            label: 'ISO Container Spreader — Khung chụp cẩu Container',
            sub: 'ISO 3874 Telescopic Spreader Frame with 4 Automatic Twistlocks & Flippers'
        },
        cascaded_spreader_system: {
            id: 'cascaded',
            meshName: 'Cascaded_Spreader_System',
            en: 'Cascaded Spreader System',
            vi: 'Hệ dầm ngáng nhiều tầng',
            label: 'Cascaded Spreader System — Hệ dầm ngáng nhiều tầng',
            sub: 'Multi-Tier 1-over-2 Modular Spreader Tree for 4-Point / 8-Point Lifts'
        },
        box_spreader_frame: {
            id: 'frame',
            meshName: 'Box_Spreader_Frame',
            en: '4-Point Box Spreader Frame',
            vi: 'Khung dầm ngáng hộp 4 góc',
            label: 'Box Spreader Frame — Khung dầm ngáng 4 góc',
            sub: 'Rectangular 4-Corner Spreader Frame Providing Vertical 0° Lower Slings'
        },
        lattice_truss_spreader: {
            id: 'modular_truss',
            meshName: 'Lattice_Truss_Spreader_Beam',
            en: 'Lattice Truss Spreader Beam',
            vi: 'Dầm ngáng giàn không gian',
            label: 'Lattice Truss Spreader — Dầm ngáng giàn không gian',
            sub: 'Heavy-Duty Long-Span Space-Frame Truss Spreader System'
        },
        basket_cradle_spreader: {
            id: 'basket',
            meshName: 'Basket_Cradle_Spreader',
            en: 'Basket Cradle Spreader',
            vi: 'Dầm ngáng cáp vòng ôm đáy',
            label: 'Basket Cradle Spreader — Dầm ngáng cáp vòng ôm đáy',
            sub: 'Twin Spreader Bars with Under-Belly Basket Slings for Cylindrical Vessels'
        }
    },

    // 5. THUẬT NGỮ KỸ THUẬT & THÔNG SỐ (TECHNICAL & PHYSICS TERMS)
    technicalTerms: {
        liftingPoint: {
            id: 'lifting_point',
            meshName: 'Lifting_Point',
            en: 'Lifting Point',
            vi: 'Điểm nâng',
            label: 'Lifting Point (LP) — Điểm nâng'
        },
        padEye: {
            id: 'pad_eye',
            meshName: 'Pad_Eye_Lug_Plate',
            en: 'Pad-eye / Lug Plate',
            vi: 'Tai cẩu / Bích cẩu',
            label: 'Pad-eye / Lug Plate — Tai cẩu / Bích cẩu'
        },
        centerOfGravity: {
            id: 'cog',
            meshName: 'Center_of_Gravity_CoG',
            en: 'Center of Gravity (CoG)',
            vi: 'Trọng tâm của kiện hàng',
            label: 'Center of Gravity (CoG) — Trọng tâm kiện hàng'
        },
        slingAngle: {
            id: 'sling_angle',
            en: 'Sling Angle',
            vi: 'Góc nghiêng của dây cáp',
            label: 'Sling Angle (α / β) — Góc nghiêng dây cáp'
        },
        workingLoadLimit: {
            id: 'wll_swl',
            en: 'Working Load Limit (WLL) / Safe Working Load (SWL)',
            vi: 'Giới hạn tải trọng làm việc / Tải trọng an toàn',
            label: 'WLL / SWL — Giới hạn tải trọng làm việc an toàn'
        },
        minimumBreakingLoad: {
            id: 'mbl',
            en: 'Minimum Breaking Load (MBL)',
            vi: 'Tải trọng phá hủy nhỏ nhất',
            label: 'Minimum Breaking Load (MBL) — Tải trọng phá hủy nhỏ nhất'
        },
        tensionForce: {
            id: 'tension_force',
            meshName: 'Tension_Force_Vector',
            en: 'Tension Force',
            vi: 'Lực căng',
            label: 'Tension Force (T) — Lực căng dọc sợi cáp'
        },
        dynamicAmplificationFactor: {
            id: 'daf',
            en: 'Dynamic Amplification Factor (DAF)',
            vi: 'Hệ số động lực',
            label: 'Dynamic Amplification Factor (DAF) — Hệ số động lực'
        },
        timberDunnage: {
            id: 'timber_dunnage',
            meshName: 'Timber_Dunnage',
            en: 'Timber Dunnage',
            vi: 'Đà gỗ / Thanh kê hàng',
            label: 'Timber Dunnage — Đà gỗ / Thanh kê hàng'
        }
    }
};

export function getDictionaryEntry(section, key) {
    return RIGGING_DICTIONARY[section]?.[key] || null;
}
