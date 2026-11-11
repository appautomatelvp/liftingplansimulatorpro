/**
 * ============================================================================
 * ASSET SPECIFICATIONS & TOLERANCE REGISTRY (AssetSpecs.js)
 * Architecture: CAE / Industrial WebGL Digital Twin Pipeline
 * Standard Reference: ISO 668, ISO 1161, ISO 1496-1, ASME B30.20, ASME B30.26
 * ============================================================================
 */

export const ASSET_SPECS = {
    // ------------------------------------------------------------------------
    // ISO SHIPPING CONTAINERS (STRICT GEOMETRIC TOLERANCES)
    // ------------------------------------------------------------------------
    'container_20ft': {
        id: 'container_20ft',
        category: 'cargo',
        name: 'ISO 22G1 20ft Shipping Container',
        standard: 'ISO 668 / ISO 1496-1',
        verified: true,
        // Metric dimensions in meters: Length (X), Height (Y), Width (Z)
        targetDimensions: { x: 6.058, y: 2.591, z: 2.438 },
        tolerance: 0.05, // 5% max deviation for strict ISO compliance
        pivot: 'center',
        tareMassKg: 2200,
        grossMassKg: 24000,
        cogOffset: { x: 0, y: -0.10, z: 0 },
        // Standard ISO 1161 Corner Castings pad-eye centers
        padEyes: [
            { id: 'top_fr', localPos: { x:  2.935, y: 1.245, z:  1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_fl', localPos: { x: -2.935, y: 1.245, z:  1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_rl', localPos: { x: -2.935, y: 1.245, z: -1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_rr', localPos: { x:  2.935, y: 1.245, z: -1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 }
        ]
    },

    'container_40ft': {
        id: 'container_40ft',
        category: 'cargo',
        name: 'ISO 42G1 40ft Shipping Container',
        standard: 'ISO 668 / ISO 1496-1',
        verified: true,
        targetDimensions: { x: 12.192, y: 2.591, z: 2.438 },
        tolerance: 0.05,
        pivot: 'center',
        tareMassKg: 3800,
        grossMassKg: 30480,
        cogOffset: { x: 0, y: -0.10, z: 0 },
        padEyes: [
            { id: 'top_fr', localPos: { x:  6.002, y: 1.245, z:  1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_fl', localPos: { x: -6.002, y: 1.245, z:  1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_rl', localPos: { x: -6.002, y: 1.245, z: -1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_rr', localPos: { x:  6.002, y: 1.245, z: -1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 }
        ]
    },

    'container_40fthc': {
        id: 'container_40fthc',
        category: 'cargo',
        name: 'ISO 45G1 40ft High Cube Container',
        standard: 'ISO 668 High Cube (9ft 6in)',
        verified: true,
        targetDimensions: { x: 12.192, y: 2.896, z: 2.438 },
        tolerance: 0.05,
        pivot: 'center',
        tareMassKg: 3950,
        grossMassKg: 30480,
        cogOffset: { x: 0, y: -0.12, z: 0 },
        padEyes: [
            { id: 'top_fr', localPos: { x:  6.002, y: 1.398, z:  1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_fl', localPos: { x: -6.002, y: 1.398, z:  1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_rl', localPos: { x: -6.002, y: 1.398, z: -1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 },
            { id: 'top_rr', localPos: { x:  6.002, y: 1.398, z: -1.129 }, normal: { x: 0, y: 1, z: 0 }, type: 'iso1161', wllT: 17.0 }
        ]
    },

    'container_20fthc': {
        id: 'container_20fthc', category: 'cargo', name: 'ISO 25G1 20ft High Cube',
        standard: 'ISO 668', verified: true,
        targetDimensions: { x: 6.058, y: 2.896, z: 2.438 }, tolerance: 0.05, pivot: 'center',
        tareMassKg: 2350, grossMassKg: 30480, cogOffset: { x: 0, y: -0.08, z: 0 }
    },
    'container_45fthc': {
        id: 'container_45fthc', category: 'cargo', name: 'ISO L5G1 45ft High Cube',
        standard: 'ISO 668', verified: true,
        targetDimensions: { x: 13.716, y: 2.896, z: 2.438 }, tolerance: 0.05, pivot: 'center',
        tareMassKg: 4800, grossMassKg: 30480, cogOffset: { x: 0, y: -0.10, z: 0 }
    },
    'container_10ft': {
        id: 'container_10ft', category: 'cargo', name: 'ISO 12G1 10ft Mini / Offshore',
        standard: 'ISO 668', verified: true,
        targetDimensions: { x: 2.991, y: 2.591, z: 2.438 }, tolerance: 0.06, pivot: 'center',
        tareMassKg: 1300, grossMassKg: 10160, cogOffset: { x: 0, y: -0.10, z: 0 }
    },
    'container_53fthc': {
        id: 'container_53fthc', category: 'cargo', name: '53ft HC Intermodal Overhang',
        standard: 'AAR / ISO intermodal', verified: true,
        targetDimensions: { x: 16.154, y: 2.896, z: 2.591 }, tolerance: 0.08, pivot: 'center',
        tareMassKg: 6200, grossMassKg: 30480, cogOffset: { x: 0, y: -0.10, z: 0 }
    },
    'container_halfheight': {
        id: 'container_halfheight', category: 'cargo', name: 'ISO 28U1 20ft Half-Height',
        standard: 'ISO 1496-1', verified: true,
        targetDimensions: { x: 6.058, y: 1.295, z: 2.438 }, tolerance: 0.08, pivot: 'center',
        tareMassKg: 2400, grossMassKg: 30480, cogOffset: { x: 0, y: -0.05, z: 0 }
    },
    'container_drybulk': {
        id: 'container_drybulk', category: 'cargo', name: 'ISO 22B0 20ft Dry Bulk',
        standard: 'ISO 1496-4', verified: true,
        targetDimensions: { x: 6.058, y: 2.591, z: 2.438 }, tolerance: 0.08, pivot: 'center',
        tareMassKg: 2800, grossMassKg: 30480, cogOffset: { x: 0, y: -0.05, z: 0 }
    },
    'container_reefer20': {
        id: 'container_reefer20', category: 'cargo', name: 'ISO 22R1 20ft Reefer',
        standard: 'ISO 1496-2', verified: true,
        targetDimensions: { x: 6.058, y: 2.591, z: 2.438 }, tolerance: 0.08, pivot: 'center',
        tareMassKg: 3000, grossMassKg: 30480, cogOffset: { x: -0.25, y: 0.05, z: 0 }
    },
    'container_opentop40': {
        id: 'container_opentop40', category: 'cargo', name: 'ISO 42U1 40ft Open Top',
        standard: 'ISO 1496-1', verified: true,
        targetDimensions: { x: 12.192, y: 2.591, z: 2.438 }, tolerance: 0.08, pivot: 'center',
        tareMassKg: 4000, grossMassKg: 30480, cogOffset: { x: 0, y: -0.15, z: 0 }
    },
    'container_flatrack20': {
        id: 'container_flatrack20', category: 'cargo', name: 'ISO 22P3 20ft Flat Rack',
        standard: 'ISO 1496-5', verified: true,
        targetDimensions: { x: 6.058, y: 2.591, z: 2.438 }, tolerance: 0.10, pivot: 'center',
        tareMassKg: 2750, grossMassKg: 34000, cogOffset: { x: 0, y: -0.45, z: 0 }
    },
    'container_platform20': {
        id: 'container_platform20', category: 'cargo', name: 'ISO 29P0 20ft Platform',
        standard: 'ISO 1496-5', verified: true,
        targetDimensions: { x: 6.058, y: 0.335, z: 2.438 }, tolerance: 0.12, pivot: 'center',
        tareMassKg: 2200, grossMassKg: 30480, cogOffset: { x: 0, y: 0, z: 0 }
    },

    // ------------------------------------------------------------------------
    // BELOW-THE-HOOK RIGGING (SPREADERS & HARDWARE)
    // ------------------------------------------------------------------------
    'sts_spreader_20': {
        id: 'sts_spreader_20',
        category: 'beam',
        name: 'STS Telescopic Spreader 20ft Retracted',
        standard: 'ISO 3874 / RAM SingFlex style',
        verified: true,
        targetDimensions: { x: 6.058, y: 1.20, z: 2.438 },
        tolerance: 0.20,
        pivot: 'center',
        tareMassKg: 9200,
        wllT: 41.0
    },
    'sts_spreader_40': {
        id: 'sts_spreader_40',
        category: 'beam',
        name: 'STS Telescopic Spreader 40ft Master',
        standard: 'ISO 3874 / RAM SingFlex style',
        verified: true,
        targetDimensions: { x: 12.192, y: 1.20, z: 2.438 },
        tolerance: 0.20,
        pivot: 'center',
        tareMassKg: 10500,
        wllT: 41.0
    },
    'sts_spreader_45': {
        id: 'sts_spreader_45',
        category: 'beam',
        name: 'STS Telescopic Spreader 45ft Extended',
        standard: 'ISO 3874 / Bromma STS45 style',
        verified: true,
        targetDimensions: { x: 13.716, y: 1.20, z: 2.438 },
        tolerance: 0.20,
        pivot: 'center',
        tareMassKg: 11200,
        wllT: 41.0
    },
    'sts_spreader_twin': {
        id: 'sts_spreader_twin',
        category: 'beam',
        name: 'STS Twin-Lift Spreader 2×20ft',
        standard: 'ISO 3874 Twin-Lift',
        verified: true,
        targetDimensions: { x: 12.192, y: 1.20, z: 2.438 },
        tolerance: 0.20,
        pivot: 'center',
        tareMassKg: 11800,
        wllT: 2 * 25.0
    },

    'modulift_spreader': {
        id: 'modulift_spreader',
        category: 'beam',
        name: 'Telescopic 20-40ft Container Spreader Frame',
        standard: 'ASME B30.20 Category B (Illustrated specs)',
        verified: false,
        targetDimensions: { x: 6.058, y: 0.65, z: 2.438 },
        tolerance: 0.15,
        pivot: 'center',
        tareMassKg: 9500,
        wllT: 50.0,
        anchors: {
            topSheaves: [
                { id: 'top_0', localPos: { x:  0.6, y: 0.95, z:  0.5 } },
                { id: 'top_1', localPos: { x: -0.6, y: 0.95, z:  0.5 } },
                { id: 'top_2', localPos: { x: -0.6, y: 0.95, z: -0.5 } },
                { id: 'top_3', localPos: { x:  0.6, y: 0.95, z: -0.5 } }
            ],
            lowerTwistlocks: [
                { id: 'tl_0', localPos: { x:  2.935, y: -0.32, z:  1.129 }, wllT: 17.0 },
                { id: 'tl_1', localPos: { x: -2.935, y: -0.32, z:  1.129 }, wllT: 17.0 },
                { id: 'tl_2', localPos: { x: -2.935, y: -0.32, z: -1.129 }, wllT: 17.0 },
                { id: 'tl_3', localPos: { x:  2.935, y: -0.32, z: -1.129 }, wllT: 17.0 }
            ]
        }
    },

    'crosby_shackle_17t': {
        id: 'crosby_shackle_17t',
        category: 'hardware',
        name: 'Crosby G-2130 Bolt-Type Safety Shackle 17T',
        standard: 'ASME B30.26 / Crosby General Catalog',
        verified: true,
        targetDimensions: { x: 0.18, y: 0.28, z: 0.14 },
        tolerance: 0.10,
        pivot: 'center',
        tareMassKg: 8.5,
        wllT: 17.0
    },

    // ------------------------------------------------------------------------
    // HEAVY PORT CRANES (BOTTOM PIVOT AT QUAY LEVEL)
    // ------------------------------------------------------------------------
    'sts_gantry_crane': {
        id: 'sts_gantry_crane',
        category: 'crane',
        name: 'ZPMC Post-Panamax STS Container Gantry Crane',
        standard: 'EN 13000 / ISO 8686 (Typical specs)',
        verified: false,
        targetDimensions: { x: 28.0, y: 56.0, z: 88.0 },
        tolerance: 0.25,
        pivot: 'bottom', // Min Y must sit flush at quay apron elevation (Y = 0)
        wllT: 65.0,
        anchors: {
            trolleyRunwayY: 32.5,
            pylonApexY: 56.0,
            railSpanX: 16.0
        }
    },

    'liebherr_lhm550': {
        id: 'liebherr_lhm550',
        category: 'crane',
        name: 'Liebherr LHM 550 Mobile Harbour Crane',
        standard: 'Liebherr Technical Brochure (Typical specs)',
        verified: false,
        targetDimensions: { x: 18.0, y: 48.0, z: 14.0 },
        tolerance: 0.25,
        pivot: 'bottom',
        wllT: 144.0
    },

    // ------------------------------------------------------------------------
    // SPECIALIZED CONTAINERS & HEAVY LIFT / OOG PAYLOADS
    // ------------------------------------------------------------------------
    'flatrack_container': {
        id: 'flatrack_container',
        category: 'cargo',
        name: 'Flat Rack Container — Container mặt bằng (ISO 45P3)',
        standard: 'ISO 668 / ISO 1496-5',
        verified: true,
        targetDimensions: { x: 12.192, y: 2.896, z: 2.438 },
        tolerance: 0.15,
        pivot: 'center',
        tareMassKg: 5200,
        grossMassKg: 45000,
        cogOffset: { x: 0, y: -0.55, z: 0 }
    },

    'container_platform40': {
        id: 'container_platform40',
        category: 'cargo',
        name: 'ISO 49P0 40ft Platform Deck',
        standard: 'ISO 1496-5',
        verified: true,
        targetDimensions: { x: 12.192, y: 0.610, z: 2.438 },
        tolerance: 0.12,
        pivot: 'center',
        tareMassKg: 5500,
        grossMassKg: 30480,
        cogOffset: { x: 0, y: 0, z: 0 }
    },

    'opentop_container': {
        id: 'opentop_container',
        category: 'cargo',
        name: 'Open Top Container — Container hở mái (ISO 22U1)',
        standard: 'ISO 668 / ISO 1496-1',
        verified: true,
        targetDimensions: { x: 6.058, y: 2.591, z: 2.438 },
        tolerance: 0.12,
        pivot: 'center',
        tareMassKg: 2350,
        grossMassKg: 30480,
        cogOffset: { x: 0, y: -0.15, z: 0 }
    },

    'tank_container': {
        id: 'tank_container',
        category: 'cargo',
        name: 'Tank Container (ISO Tank) — Container bồn chứa (ISO 22K2)',
        standard: 'ISO 1496-3 / ASME VIII',
        verified: true,
        targetDimensions: { x: 6.058, y: 2.591, z: 2.438 },
        tolerance: 0.08,
        pivot: 'center',
        tareMassKg: 3800,
        grossMassKg: 36000,
        cogOffset: { x: 0, y: 0.05, z: 0 }
    },

    'reefer_container': {
        id: 'reefer_container',
        category: 'cargo',
        name: 'Reefer Container — Container lạnh (ISO 45R1)',
        standard: 'ISO 1496-2',
        verified: true,
        targetDimensions: { x: 12.192, y: 2.896, z: 2.438 },
        tolerance: 0.08,
        pivot: 'center',
        tareMassKg: 4800,
        grossMassKg: 34000,
        cogOffset: { x: -0.35, y: 0.05, z: 0 }
    },

    'transformer': {
        id: 'transformer',
        category: 'cargo',
        name: 'Transformer — Máy biến áp công suất lớn',
        standard: 'IEC 60076 / ASME P30.1 Critical Lift',
        verified: false,
        targetDimensions: { x: 5.2, y: 3.2, z: 2.8 },
        tolerance: 0.35,
        pivot: 'center',
        tareMassKg: 65000,
        grossMassKg: 65000,
        cogOffset: { x: 0.65, y: 0.15, z: 0.20 }
    },

    'pressure_vessel': {
        id: 'pressure_vessel',
        category: 'cargo',
        name: 'Pressure Vessel — Bồn áp lực công nghiệp',
        standard: 'ASME Boiler & Pressure Vessel Code Sec. VIII',
        verified: false,
        targetDimensions: { x: 7.5, y: 2.6, z: 2.6 },
        tolerance: 0.35,
        pivot: 'center',
        tareMassKg: 41500,
        grossMassKg: 41500,
        cogOffset: { x: 0, y: 0.05, z: 0 }
    },

    'wind_turbine_nacelle': {
        id: 'wind_turbine_nacelle',
        category: 'cargo',
        name: 'Wind Turbine Nacelle — Tua-bin điện gió',
        standard: 'DNV-ST-N001 Offshore Heavy Lift',
        verified: false,
        targetDimensions: { x: 8.5, y: 3.6, z: 3.4 },
        tolerance: 0.35,
        pivot: 'center',
        tareMassKg: 80000,
        grossMassKg: 80000,
        cogOffset: { x: 0.55, y: 0.10, z: 0 }
    },

    'excavator': {
        id: 'excavator',
        category: 'cargo',
        name: 'Excavator / Heavy Machinery — Máy xúc / Xe cơ giới nặng',
        standard: 'ISO 6165 Earth-Moving Machinery',
        verified: false,
        targetDimensions: { x: 6.4, y: 3.1, z: 3.0 },
        tolerance: 0.35,
        pivot: 'center',
        tareMassKg: 29500,
        grossMassKg: 29500,
        cogOffset: { x: -0.35, y: -0.10, z: 0 }
    },

    'tugboat_hull': {
        id: 'tugboat_hull',
        category: 'cargo',
        name: 'Tugboat / Vessel Hull — Tàu kéo / Vỏ tàu thủy',
        standard: 'DNV-ST-N001 Marine Lifting',
        verified: false,
        targetDimensions: { x: 12.0, y: 3.2, z: 3.4 },
        tolerance: 0.35,
        pivot: 'center',
        tareMassKg: 33500,
        grossMassKg: 33500,
        cogOffset: { x: -0.55, y: -0.20, z: 0 }
    },

    'lifting_beam_h': {
        id: 'lifting_beam_h',
        category: 'beam',
        name: 'Lifting Beam / H-Beam Spreader — Dầm nâng chữ H',
        standard: 'ASME B30.20 / BTH-1',
        verified: false,
        targetDimensions: { x: 6.0, y: 0.48, z: 0.32 },
        tolerance: 0.25,
        pivot: 'center',
        tareMassKg: 850,
        wllT: 40.0
    },

    // ------------------------------------------------------------------------
    // GENERIC PROJECT CARGO FALLBACK (HEAVY LIFT / OUT OF GAUGE - OOG)
    // ------------------------------------------------------------------------
    'generic_cargo': {
        id: 'generic_cargo',
        category: 'cargo',
        name: 'Heavy Lift / Out of Gauge (OOG) — Hàng siêu trường siêu trọng',
        standard: 'ASME P30.1 General Handling',
        verified: false,
        targetDimensions: { x: 4.5, y: 2.4, z: 2.6 },
        tolerance: 0.60,
        pivot: 'center',
        tareMassKg: 1000,
        grossMassKg: 16000,
        cogOffset: { x: 0, y: 0, z: 0 }
    }
};

/**
 * Finds the closest matching standard specification for a given asset ID or category.
 */
export function getAssetSpec(specKey) {
    if (ASSET_SPECS[specKey]) return ASSET_SPECS[specKey];
    // Category-based fallback
    if (specKey && specKey.includes('container_40')) return ASSET_SPECS['container_40ft'];
    if (specKey && specKey.includes('container')) return ASSET_SPECS['container_20ft'];
    if (specKey && specKey.includes('spreader')) return ASSET_SPECS['modulift_spreader'];
    if (specKey && specKey.includes('crane')) return ASSET_SPECS['sts_gantry_crane'];
    if (specKey && specKey.includes('shackle')) return ASSET_SPECS['crosby_shackle_17t'];
    return ASSET_SPECS['generic_cargo'];
}
