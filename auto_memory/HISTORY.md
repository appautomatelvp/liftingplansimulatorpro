# Nhật ký thay đổi (mới nhất Ở TRÊN CÙNG). Ghi bằng scripts/auto_log.ps1, không sửa tay.
<!-- LOG_START -->

## 2026-11-15 14:56 [refactor] Buoc 8: Tach shader vom bau troi HorizonSkyDome, LIGHTING_PRESETS va bang khi quyen gio Viet Nam sang HorizonSkyDome.js (179 dong), thu gon EnvironmentManager.js tu 763 xuong 258 dong va SceneRenderer.js tu 321 xuong 288 dong.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: dfda219
- File: src/graphics/HorizonSkyDome.js,src/graphics/EnvironmentManager.js,src/graphics/SceneRenderer.js,auto_memory/PLAN.md

## 2026-11-15 14:53 [refactor] Buoc 7: Tach widget tai khoan, banner bao tri, hop thoai lien he nha phat trien va ham gan UI shell sang session_ui_bindings.js (165 dong) va gom chung mountAuthScreen giup session.js giam tu 454 xuong 260 dong.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 29e7c17
- File: src/saas/session_ui_bindings.js,src/saas/session.js,auto_memory/PLAN.md

## 2026-11-15 14:50 [refactor] Buoc 6: Tach cac ham dung giao dien the phuong an, danh sach thiet bi, hop thoai chon va di tru lp-user-rigs qua localDataStore.js sang workspace_views.js (184 dong) giup workspace_dashboard.js giam tu 430 xuong 257 dong.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 50cdf91
- File: src/saas/workspace_views.js,src/saas/workspace_dashboard.js,auto_memory/PLAN.md

## 2026-11-15 14:44 [refactor] Buoc 5: Tach phan dung HTML bang nguoi dung, feature flags, audit log va catalog sang admin_panels.js (148 dong) giup admin_dashboard.js giam tu 388 xuong 253 dong va giu nguyen 100% hanh vi CMS.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 12b6625
- File: src/saas/admin_panels.js,src/saas/admin_dashboard.js,auto_memory/PLAN.md

## 2026-11-15 14:39 [refactor] Upgrade Buoc 4: Tach plan_snapshot.js (170 dong) khoi workspace_data.js (giam con 228 dong), re-export giu tuong thich 100%.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 559b5c8
- File: src/saas/plan_snapshot.js,src/saas/workspace_data.js,auto_memory/PLAN.md

## 2026-11-15 14:38 [refactor] Upgrade Buoc 3: Tach auth_rate_limit.js (85 dong) khoi auth_screen.js (giam con 234 dong, duoi nguong 300).
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 32d2497
- File: src/saas/auth_rate_limit.js,src/saas/auth_screen.js,auto_memory/PLAN.md

## 2026-11-15 14:35 [refactor] Upgrade Buoc 2: Tich hop prepareFirestorePayload vao firebase_data.js va safeReadLocalStore/safeWriteLocalStore vao auth_screen.js, i18n/index.js.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 63b186c
- File: src/saas/firebase_data.js,src/saas/auth_screen.js,src/i18n/index.js,auto_memory/PLAN.md

## 2026-11-15 14:33 [feat] Upgrade Buoc 1: Lap bo giap du lieu V7 (firestoreSanitize.js, localDataStore.js) va sua canh bao gia trong auto_check.ps1.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 68928c3
- File: src/utils/firestoreSanitize.js,src/utils/localDataStore.js,scripts/auto_check.ps1,auto_memory/PLAN.md

## 2026-11-15 14:29 [docs] Kham tong quat du an va lap ke hoach nang cap @upgrade 10 buoc trong auto_memory/PLAN.md
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 68928c3
- File: auto_memory/CONTEXT.md,STATE.md,auto_memory/PLAN.md

## 2026-11-15 14:01 [feat] Nang cap chan troi 3D tu nhien: thay san hinh vuong bang dia tron ban kinh 460m, lam mo luoi do theo hinh tron va them vom bau troi gradient khop 1:1 voi suong mu.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: f0ccc83
- File: src/graphics/EnvironmentManager.js,src/sim/scene.js
