# BẢN ĐỒ DỰ ÁN (TỰ SINH — KHÔNG SỬA TAY)
Cập nhật: 2026-11-16 13:36 | Nhánh: feat/horizon-clouds | Commit cuối: 6ef2e08 step 2: wire true 3D surface contact into shell rebuild and sling routing (2 minutes ago)
Tổng: 247 file, 73328 dòng. 🔒 = file [LOCKED]. ⚠️ = file sắp/đã quá 300 dòng.

## ⚠️ Cần tách (quá 300 dòng)
- e2e/layout.spec.js (313 dòng)
- index.html (3122 dòng)
- scripts/generate_port_assets.js (477 dòng)
- src/core/AssemblyEngine.js (433 dòng)
- src/core/AssetManager.js (325 dòng)
- src/core/AssetPipeline.js (333 dòng)
- src/core/AssetSpecs.js (446 dòng)
- src/core/ElasticSlingEngine.js (449 dòng)
- src/core/EngineeringEngine.js (661 dòng)
- src/core/HullOptimizer.js (322 dòng)
- src/core/LiftPlanModel.js (1073 dòng)
- src/core/RiggingDictionary.js (434 dòng)
- src/core/SimulationEngine.js (560 dòng)
- src/i18n/keys.js (598 dòng)
- src/rigging/RiggingPhysicsSolver.js (682 dòng)
- src/sim/audio.js (725 dòng)
- src/sim/cargo/containers_iso.js (1490 dòng)
- src/sim/cargo/shell_rebuild.js (566 dòng)
- src/sim/cargo/specialty_meshes.js (2560 dòng)
- src/sim/compliance.js (625 dòng)
- src/sim/dynamics.js (848 dòng)
- src/sim/gear/editor.js (3539 dòng)
- src/sim/library/core.js (641 dòng)
- src/sim/library/parsers.js (652 dòng)
- src/sim/library/reconstruction_export.js (2136 dòng)
- src/sim/physics/beams_seed.js (2885 dòng)
- src/sim/physics/cables_break.js (1556 dòng)
- src/sim/physics/flatrack_payload.js (629 dòng)
- src/sim/physics/footprint_rig.js (834 dòng)
- src/sim/physics/hoist_contacts.js (1003 dòng)
- src/sim/physics/step_engine.js (774 dòng)
- src/sim/plan_wizard.js (632 dòng)
- src/sim/rigging/draw_update.js (863 dòng)
- src/sim/rigging/hook_pool.js (3118 dòng)
- src/sim/scene.js (1974 dòng)
- src/sim/session/prelift_reset.js (1144 dòng)
- src/sim/session/presets_events.js (3563 dòng)
- src/sim/session/ui_units_bom.js (1906 dòng)
- src/sim/state.js (606 dòng)
- src/sim/telemetry.js (1104 dòng)
- src/sim/weather_fx.js (572 dòng)
- test/cable_morphology_and_deformation.test.js (426 dòng)
- test/custom_slings.test.js (712 dòng)
- test/engineering.test.js (410 dòng)
- test/physics_master_blueprint.test.js (524 dòng)
- test/rigging.test.js (1367 dòng)
- test/rigging_physics_and_alarms.test.js (306 dòng)

## 🔒 File đã khóa [LOCKED]
- src/utils/firestoreSanitize.js
- src/utils/localDataStore.js

## Danh sách file
| File | Dòng | Mục đích |
|---|---|---|
| `docs/architecture/adr/ADR-001-strangler-fig.md` | 25 |  |
| `docs/architecture/adr/ADR-002-no-new-monolith.md` | 29 |  |
| `docs/architecture/adr/ADR-003-physics-quarantine.md` | 21 |  |
| `docs/architecture/adr/ADR-004-content-physics-port.md` | 25 |  |
| `docs/architecture/CONTRIBUTING_ARCHITECTURE.md` | 26 |  |
| `docs/architecture/INVENTORY.md` | 61 |  |
| `docs/architecture/MIGRATION_STATUS.md` | 20 |  |
| `docs/architecture/PERFORMANCE.md` | 31 |  |
| `docs/architecture/ROADMAP.md` | 43 |  |
| `docs/architecture/TARGET.md` | 58 |  |
| `docs/architecture/UI_LAYER.md` | 18 |  |
| `docs/PRODUCT_UPGRADE_PLAN.md` | 282 |  |
| `docs/SECURITY_THREAT_MODEL.md` | 110 |  |
| `docs/ui-id-registry.md` | 453 |  |
| `docs/UPGRADE_PLAN_V2_FOR_FLASH.md` | 269 |  |
| `docs/UPGRADE_PLAN_V3_SUPPLEMENT.md` | 181 |  |
| `e2e/auth.spec.js` | 227 |  |
| `e2e/cms-roles.spec.js` | 106 |  |
| `e2e/emulator_helpers.js` | 65 |  |
| `e2e/layout.spec.js` | 313 | Check that an element is actually visible and not clipped or covered. ⚠️>300 |
| `e2e/saas-accessibility.spec.js` | 148 |  |
| `eslint.config.js` | 23 | Flat ESLint config — architecture gates for app/domain layers (optional eslint install). |
| `firebase.json` | 29 |  |
| `firestore.rules` | 239 |  |
| `index.html` | 3122 |  ⚠️>300 |
| `jsconfig.json` | 19 |  |
| `package.json` | 42 |  |
| `playwright.auth.config.js` | 28 |  |
| `playwright.config.js` | 45 |  |
| `postcss.config.js` | 6 |  |
| `public/loading-screen-init.js` | 28 |  |
| `public/safelift3d-icons/README.md` | 29 |  |
| `README.md` | 81 |  |
| `scripts/architecture-gate.mjs` | 45 |  |
| `scripts/auto_backup.ps1` | 70 | BACKUP KÉP: ZIP (HHmmddMMyyyy) + NHÁNH GIT NHÁP — chạy TRƯỚC khi nhờ AI làm việc lớn |
| `scripts/auto_check.ps1` | 75 | KIỂM TRA SỨC KHỎE DỰ ÁN (AI chạy cuối mỗi việc). Chỉ ĐỌC, không sửa gì. |
| `scripts/auto_log.ps1` | 37 | GHI NHẬT KÝ THAY ĐỔI vào auto_memory/HISTORY.md (mới nhất ở trên) rồi cập nhật MAP. |
| `scripts/auto_map.ps1` | 101 | SINH BẢN ĐỒ DỰ ÁN: auto_memory/MAP.md  (cây file + số dòng + mục đích + file LOCKED) |
| `scripts/capture-screens.js` | 56 |  |
| `scripts/check-dist.mjs` | 29 |  |
| `scripts/generate_port_assets.js` | 477 |  ⚠️>300 |
| `scripts/manual_chot_ban.ps1` | 30 | CHỐT TÍNH NĂNG: commit nhánh nháp -> gộp về main -> gắn tag "stable-..." |
| `src/app/boot.js` | 70 |  |
| `src/app/commands/index.js` | 75 |  |
| `src/app/createRuntime.js` | 39 |  |
| `src/app/index.js` | 5 |  |
| `src/app/scenarios/ScenarioRuntime.js` | 62 |  |
| `src/content/catalog/equipment.json` | 47 |  |
| `src/content/catalog/index.js` | 19 |  |
| `src/content/index.js` | 3 |  |
| `src/content/materials/index.js` | 30 |  |
| `src/content/materials/pbr_defs.json` | 40 |  |
| `src/content/scenarios/default_flatrack.json` | 35 |  |
| `src/content/scenarios/index.js` | 17 |  |
| `src/content/scenarios/sts_container_lift.json` | 35 |  |
| `src/core/AnalysisHUD.js` | 106 |  |
| `src/core/AssemblyEngine.js` | 433 |  ⚠️>300 |
| `src/core/AssetLoaders.js` | 151 |  |
| `src/core/AssetManager.js` | 325 |  ⚠️>300 |
| `src/core/AssetPipeline.js` | 333 |  ⚠️>300 |
| `src/core/AssetSpecs.js` | 446 |  ⚠️>300 |
| `src/core/CraneLoadChartEngine.js` | 292 |  ⚠️>250 |
| `src/core/DeformableSteelStructure.js` | 245 |  |
| `src/core/ElasticSlingEngine.js` | 449 |  ⚠️>300 |
| `src/core/EngineeringEngine.js` | 661 |  ⚠️>300 |
| `src/core/GroundPressureEngine.js` | 238 |  |
| `src/core/HullOptimizer.js` | 322 |  ⚠️>300 |
| `src/core/index.js` | 82 |  |
| `src/core/LiftPlanModel.js` | 1073 |  ⚠️>300 |
| `src/core/PhysicalCableSolver.js` | 199 |  |
| `src/core/physics-world/CannonBackend.js` | 185 |  |
| `src/core/physics-world/ConstraintGraph.js` | 158 |  |
| `src/core/physics-world/FixedStepLoop.js` | 73 |  |
| `src/core/physics-world/index.js` | 17 |  |
| `src/core/physics-world/IPhysicsBackend.js` | 106 |  |
| `src/core/physics-world/PhysicsWorldManager.js` | 210 |  |
| `src/core/physics-world/QUARANTINE.md` | 12 |  |
| `src/core/physics-world/RapierBackend.js` | 197 |  |
| `src/core/physics-world/Units.js` | 46 |  |
| `src/core/RiggingDictionary.js` | 434 |  ⚠️>300 |
| `src/core/RiggingEquipmentCatalog.js` | 55 |  |
| `src/core/RiggingPlanner.js` | 218 |  |
| `src/core/RopeConstraint.js` | 115 |  |
| `src/core/SimulationEngine.js` | 560 |  ⚠️>300 |
| `src/core/standards/belowTheHook.js` | 141 |  |
| `src/core/standards/chain.js` | 160 |  |
| `src/core/standards/hardware.js` | 133 |  |
| `src/core/standards/index.js` | 15 |  |
| `src/core/standards/RiggingRuleEngine.js` | 250 |  |
| `src/core/standards/slingAngle.js` | 81 |  |
| `src/core/standards/steelGrades.js` | 99 |  |
| `src/core/standards/syntheticSling.js` | 112 |  |
| `src/core/standards/wireRope.js` | 101 |  |
| `src/domain/cargo/types.js` | 23 | Cargo domain vocabulary (pure). |
| `src/domain/crane/types.js` | 16 | Crane domain vocabulary (pure). |
| `src/domain/index.js` | 9 |  |
| `src/domain/rigging/types.js` | 25 | Rigging domain vocabulary (pure). |
| `src/domain/site/types.js` | 9 | Site / quay domain vocabulary (pure). |
| `src/domain/standards/index.js` | 26 |  |
| `src/graphics/EnvironmentManager.js` | 280 | Quản lý ánh sáng IBL, sương mù chân trời, HDR và đồng bộ thời gian thực cho cảnh 3D ⚠️>250 |
| `src/graphics/HorizonSkyDome.js` | 284 | Dựng vòm bầu trời HorizonSkyDome với mây chân trời 3D Gradient Quintic mềm mại và màu khí quyển thực tế ⚠️>250 |
| `src/graphics/index.js` | 11 |  |
| `src/graphics/pbr/ProceduralTextures.js` | 196 | Vẽ texture canvas thủ công (bê tông cảng, cáp thép, xích, sling, mặt nước, vạch cảnh báo) |
| `src/graphics/pbr/StressPBRMaterials.js` | 146 | Tạo bản đồ PBR thép sơn công nghiệp, thép rèn mạ kẽm và màu ứng suất căng cơ học thời gian thực |
| `src/graphics/PBRMaterialFactory.js` | 244 | Nhà máy tạo vật liệu PBR chuẩn công nghiệp hàng hải và đồng bộ không gian màu Three.js r170+ |
| `src/graphics/SceneRenderer.js` | 294 |  ⚠️>250 |
| `src/i18n/cargo_labels.js` | 48 |  |
| `src/i18n/cms_keys.js` | 137 | Bộ từ điển song ngữ VI/EN chuyên biệt cho hệ thống CMS Enterprise Command Center |
| `src/i18n/contact_keys.js` | 73 | Bộ từ điển song ngữ VI/EN chuẩn công nghiệp cho hộp thoại Hỗ trợ kỹ thuật & Góp ý |
| `src/i18n/index.js` | 131 |  |
| `src/i18n/keys.js` | 598 |  ⚠️>300 |
| `src/main.js` | 66 |  |
| `src/rigging/BrokenCableWhipXPBD.js` | 212 | Mô phỏng XPBD sóng quật, thu hồi năng lượng đàn hồi và va chạm CCD cho hai nửa cáp đứt hoặc cáp tháo chốt |
| `src/rigging/CableDynamicsXPBD.js` | 264 | Bộ giải động lực học cáp/xích XPBD chịu kéo, tự va chạm và đứt thu hồi đàn hồi ⚠️>250 |
| `src/rigging/CollisionMaterialSolver.js` | 247 | Bộ giải va chạm liên tục (CCD), ma sát cặp vật liệu, độ nảy theo khối lượng và chống xuyên giữa các sợi cáp/xích |
| `src/rigging/constraints/CornerProtectorModel.js` | 51 |  |
| `src/rigging/constraints/HardwareConstraint.js` | 236 |  |
| `src/rigging/constraints/UnilateralCableConstraint.js` | 151 |  |
| `src/rigging/index.js` | 16 | src/rigging/index.js |
| `src/rigging/riggingConstants.js` | 69 | src/rigging/riggingConstants.js |
| `src/rigging/RiggingPhysicsSolver.js` | 682 | src/rigging/RiggingPhysicsSolver.js ⚠️>300 |
| `src/rigging/riggingUIStore.js` | 100 | src/rigging/riggingUIStore.js |
| `src/rigging/RigidInertialDynamics.js` | 207 | Động lực học vật rắn lệch tâm (Steiner-Huygens Inertia Tensor), mô-men xoắn/nghiêng khi cẩu và rơi tự do 9.81 m/s² |
| `src/rigging/TrueMeshSurfaceContact.js` | 220 | Bộ giải tiếp xúc bề mặt 3D thực (0mm khe hở, không xuyên thủng) cho cáp và xích ôm sát kiện hàng 3D |
| `src/saas/access.js` | 48 |  |
| `src/saas/admin_catalog_audit_panels.js` | 89 | Dựng giao diện phân hệ Catalog thiết bị 3 cột, Nhật ký Kiểm toán Diff và Modal chi tiết người dùng |
| `src/saas/admin_cms.css` | 170 | Giao diện CSS chuẩn Enterprise Command Center cho CMS Quản trị (/admin) |
| `src/saas/admin_dashboard.js` | 250 |  |
| `src/saas/admin_helpers.js` | 194 | Các hằng số cấu hình và hàm thuần tính KPI, lọc đa chiều, công tắc module, mẫu Catalog và xuất CSV cho CMS |
| `src/saas/admin_panels.js` | 159 | Các hàm dựng HTML giao diện Enterprise Command Center và đọc dữ liệu form cho bảng quản trị CMS |
| `src/saas/app_check_config.js` | 15 |  |
| `src/saas/auth_rate_limit.js` | 85 | Kiểm soát giới hạn tốc độ thử đăng nhập và chuẩn hóa thông báo lỗi xác thực (VI/EN) |
| `src/saas/auth_screen.js` | 241 |  |
| `src/saas/branding.js` | 49 |  |
| `src/saas/catalog_client.js` | 87 |  |
| `src/saas/cms_data.js` | 247 |  |
| `src/saas/contact_dialog.js` | 267 | Hộp thoại Liên hệ & Góp ý kỹ thuật chuẩn Enterprise với khóa trượt xác nhận hành vi chống bot ⚠️>250 |
| `src/saas/deployment_environment.js` | 22 |  |
| `src/saas/dialog_accessibility.js` | 45 |  |
| `src/saas/feature_access_ui.js` | 196 |  |
| `src/saas/feedback.js` | 194 | Giải mã động địa chỉ nhận góp ý và xác thực hành vi thao tác chống bot/spam đa lớp |
| `src/saas/firebase.js` | 95 |  |
| `src/saas/firebase_data.js` | 82 |  |
| `src/saas/i18n.js` | 15 | Định dạng khóa ngôn ngữ SaaS và hộp thoại góp ý theo ngôn ngữ hiện tại |
| `src/saas/plan_snapshot.js` | 170 | Chuẩn hóa dữ liệu thiết bị và đóng gói/giải mã/di trú snapshot phương án nâng hạ |
| `src/saas/runtime_flags.js` | 63 |  |
| `src/saas/saas.css` | 267 | saas-root[hidden] { display: none !important; } |
| `src/saas/session.js` | 262 |  ⚠️>250 |
| `src/saas/session_ui_bindings.js` | 157 | Gắn kết giao diện header, widget tài khoản, banner bảo trì và hộp thoại liên hệ SaaS |
| `src/saas/telemetry_usage.js` | 143 |  |
| `src/saas/workspace_dashboard.js` | 260 |  ⚠️>250 |
| `src/saas/workspace_data.js` | 228 |  |
| `src/saas/workspace_views.js` | 184 | Các hàm dựng HTML, hộp thoại chọn phụ trợ và di trú dữ liệu rig cũ cho Workspace SaaS |
| `src/shared/events.js` | 31 |  |
| `src/shared/index.js` | 1 |  |
| `src/sim/audio.js` | 725 |  ⚠️>300 |
| `src/sim/cargo.js` | 6 |  |
| `src/sim/cargo/containers_iso.js` | 1490 |  ⚠️>300 |
| `src/sim/cargo/shell_rebuild.js` | 566 | --- 6B. SHELL CONTACT — pad-eyes weld to the real mesh, not the bounding box --- ⚠️>300 |
| `src/sim/cargo/specialty_meshes.js` | 2560 | --- HIGH-FIDELITY 3D REFRIGERATION MACHINERY UNIT (CARRIER TRANSICOLD / THERMO KING) --- ⚠️>300 |
| `src/sim/compliance.js` | 625 |  ⚠️>300 |
| `src/sim/dynamics.js` | 848 |  ⚠️>300 |
| `src/sim/gear.js` | 6 |  |
| `src/sim/gear/editor.js` | 3539 |  ⚠️>300 |
| `src/sim/gear/park_apply.js` | 73 |  |
| `src/sim/library.js` | 6 |  |
| `src/sim/library/core.js` | 641 |  ⚠️>300 |
| `src/sim/library/parsers.js` | 652 | --- HIGH-SPEED BINARY & ASCII .STL / .OBJ / .GLB PARSERS --- ⚠️>300 |
| `src/sim/library/reconstruction_export.js` | 2136 | --- 2D IMAGE TO 3D CONTOUR & RELIEF RECONSTRUCTION ENGINE --- ⚠️>300 |
| `src/sim/manifest.js` | 39 |  |
| `src/sim/physics.js` | 6 |  |
| `src/sim/physics/beams_seed.js` | 2885 |  ⚠️>300 |
| `src/sim/physics/cables_break.js` | 1556 |  ⚠️>300 |
| `src/sim/physics/flatrack_payload.js` | 629 | --- FLAT RACK LASHING RUPTURE, DECK SLIDING & FALLING PAYLOAD PHYSICS --- ⚠️>300 |
| `src/sim/physics/footprint_rig.js` | 834 |  ⚠️>300 |
| `src/sim/physics/hoist_contacts.js` | 1003 |  ⚠️>300 |
| `src/sim/physics/index.js` | 9 | Bounded context index — parts are assembled via src/sim/manifest.js (shared scope). |
| `src/sim/physics/port.js` | 59 |  |
| `src/sim/physics/step_engine.js` | 774 |  ⚠️>300 |
| `src/sim/plan_wizard.js` | 632 |  ⚠️>300 |
| `src/sim/rigging.js` | 6 |  |
| `src/sim/rigging/draw_update.js` | 863 | Slack cable morphology is solved by a persistent material-aware XPBD chain. ⚠️>300 |
| `src/sim/rigging/hook_pool.js` | 3118 |  ⚠️>300 |
| `src/sim/scene.js` | 1974 |  ⚠️>300 |
| `src/sim/session.js` | 6 |  |
| `src/sim/session/prelift_reset.js` | 1144 |  ⚠️>300 |
| `src/sim/session/presets_events.js` | 3563 | --- ASME B30.9 RIGGING SAFETY PRESET ENGINES --- ⚠️>300 |
| `src/sim/session/ui_units_bom.js` | 1906 | --- 12. UI EVENT BINDINGS & COLLAPSIBLE PANELS --- ⚠️>300 |
| `src/sim/state.js` | 606 | Floor cribbing removed: static cargo rests flush on the quay / ground plane. ⚠️>300 |
| `src/sim/telemetry.js` | 1104 | --- 9. UPDATE 3D SCENE, CRANES, CABLES & TELEMETRY --- ⚠️>300 |
| `src/sim/ui-layout.js` | 241 |  |
| `src/sim/weather_fx.js` | 572 |  ⚠️>300 |
| `src/simulation/destruction-manager/DestructionSolver.js` | 147 |  |
| `src/styles/app.css` | 1018 |  |
| `src/styles/brand_splash.css` | 81 | Hiệu ứng nền công nghiệp 2K Cinematic Zoom-In & màn trập Fade-in Đen mở dần hệ thống 3D |
| `src/telemetry/sensor-engine/SensorEngine.js` | 185 |  |
| `src/ui/controllers/index.js` | 35 |  |
| `src/ui/services/index.js` | 48 |  |
| `src/utils/firestoreSanitize.js` | 39 | Bộ lọc làm sạch dữ liệu Firestore, loại bỏ undefined và trường nhạy cảm, giữ nguyên Timestamp/Date 🔒 |
| `src/utils/localDataStore.js` | 46 | Đọc ghi LocalStorage an toàn chống tràn 5MB và tự gọt ảnh DataURL 🔒 |
| `tailwind.config.js` | 12 |  |
| `test/admin_users.test.js` | 56 |  |
| `test/app_check_config.test.js` | 29 |  |
| `test/architecture/characterization_baseline.test.js` | 62 |  |
| `test/architecture/content_and_port.test.js` | 76 |  |
| `test/architecture/domain_facade.test.js` | 26 |  |
| `test/architecture/performance_budget.test.js` | 17 |  |
| `test/architecture/runtime_boot.test.js` | 24 |  |
| `test/assembly.test.js` | 172 |  |
| `test/audio.test.js` | 265 |  ⚠️>250 |
| `test/auth_screen.test.js` | 56 |  |
| `test/cable_dynamics_xpbd.test.js` | 107 |  |
| `test/cable_morphology_and_deformation.test.js` | 426 |  ⚠️>300 |
| `test/cargo_labels.test.js` | 63 |  |
| `test/catalog_client.test.js` | 94 |  |
| `test/cms_data.test.js` | 187 |  |
| `test/cog_tilt_stability.test.js` | 231 |  |
| `test/custom_slings.test.js` | 712 |  ⚠️>300 |
| `test/deployment_environment.test.js` | 21 |  |
| `test/engineering.test.js` | 410 |  ⚠️>300 |
| `test/feedback_mailto.test.js` | 144 |  |
| `test/firestore-rules-emulator.mjs` | 351 |  |
| `test/graphics.test.js` | 113 |  |
| `test/hyper_realistic_physics_pbr.test.js` | 184 | Kiểm thử Vàng 3 trụ cột: Va chạm CCD & Ma sát, Cẩu 20 tấn lệch tâm + Cắt cáp quật XPBD, và Vật liệu PBR Ứng suất |
| `test/i18n_keys.test.js` | 56 |  |
| `test/inclined_lashing_slide.test.js` | 67 |  |
| `test/liftplan.test.js` | 153 |  |
| `test/phase1_core_safety.test.js` | 208 |  |
| `test/physics_destruction.test.js` | 69 |  |
| `test/physics_master_blueprint.test.js` | 524 |  ⚠️>300 |
| `test/pipeline.test.js` | 232 |  |
| `test/rigging.test.js` | 1367 |  ⚠️>300 |
| `test/rigging_alarms_and_tolerances.test.js` | 216 |  |
| `test/rigging_groups_and_dynamics.test.js` | 84 |  |
| `test/rigging_physics_and_alarms.test.js` | 306 | test/rigging_physics_and_alarms.test.js ⚠️>300 |
| `test/runtime_flags.test.js` | 96 |  |
| `test/saas_access.test.js` | 55 |  |
| `test/security_headers.test.js` | 44 |  |
| `test/sim_test_harness.js` | 210 |  |
| `test/simulation.test.js` | 93 |  |
| `test/solid_collision_and_settling.test.js` | 77 |  |
| `test/solid_collision_and_sliding.test.js` | 106 |  |
| `test/standards_compliance_engine.test.js` | 281 |  ⚠️>250 |
| `test/sts_twin_cable_flare.test.js` | 106 |  |
| `test/telemetry_usage.test.js` | 50 |  |
| `test/workspace_data.test.js` | 155 |  |
| `vite.config.js` | 115 |  |
