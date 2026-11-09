/**
 * Canonical 8-group rigging data model.  UI library entries may add vendor
 * meshes, but every physical item resolves to one of these stable IDs.
 */
export const RIGGING_EQUIPMENT_CATALOG = {
    slings_and_lines: {
        group: 1,
        ids: ['wire_rope_sling', 'webbing_sling', 'round_sling', 'chain_sling', 'grommet_sling'],
        mechanics: 'tension_only'
    },
    shackles_and_connectors: {
        group: 2,
        ids: ['bow_shackle', 'dee_shackle', 'screw_pin_shackle', 'safety_bolt_shackle', 'master_link', 'connecting_link', 'swivel'],
        mechanics: 'pinned_connection'
    },
    lifting_points: {
        group: 3,
        ids: ['shoulder_eyebolt', 'swivel_hoist_ring', 'lifting_lug', 'weld_on_lifting_point'],
        mechanics: 'load_attachment'
    },
    hooks_and_clamps: {
        group: 4,
        ids: ['crane_hook', 'self_locking_hook', 'grab_hook', 'plate_lifting_clamp', 'container_lifting_lug'],
        mechanics: 'hook_or_friction_clamp'
    },
    beams_and_spreaders: {
        group: 5,
        ids: ['spreader_beam', 'lifting_beam', 'modular_spreader_beam', 'equalizer_beam'],
        mechanics: {
            spreader_beam: 'axial_compression',
            lifting_beam: 'bending',
            modular_spreader_beam: 'axial_compression',
            equalizer_beam: 'load_sharing_by_lever_arm'
        }
    },
    corner_protection: {
        group: 6,
        ids: ['corner_protector', 'magnetic_corner_protector', 'sling_sleeve'],
        mechanics: 'edge_capacity_protection'
    },
    cargo_and_containers: {
        group: 7,
        ids: ['iso_container', 'flat_rack_container', 'open_top_container', 'tank_container', 'heavy_lift_oog', 'specialized_machinery'],
        mechanics: 'mass_and_cog'
    },
    container_lifting_gear: {
        group: 8,
        ids: ['container_spreader', 'overheight_spreader', 'lifting_frame'],
        mechanics: 'twistlock_or_frame_support'
    }
};

export function getRiggingEquipmentGroup(id) {
    return Object.values(RIGGING_EQUIPMENT_CATALOG).find(group => group.ids.includes(id)) || null;
}
