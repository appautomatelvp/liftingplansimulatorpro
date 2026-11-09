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

    // ------------------------------------------------------------------------
    // BELOW-THE-HOOK RIGGING (SPREADERS & HARDWARE)
    // ------------------------------------------------------------------------
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
        targetDimensions: { x: 12.192, y: 2.591, z: 2.438 },
        tolerance: 0.15,
        pivot: 'center',
        tareMassKg: 5200,
        grossMassKg: 45000,
        cogOffset: { x: 0, y: -0.45, z: 0 }
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
