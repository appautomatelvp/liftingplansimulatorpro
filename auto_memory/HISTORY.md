# Nhật ký thay đổi (mới nhất Ở TRÊN CÙNG). Ghi bằng scripts/auto_log.ps1, không sửa tay.
<!-- LOG_START -->

## 2026-11-16 09:46 [feat] An hoan toan SDT va email ca nhan khoi man hinh cong khai, HTML tinh va goi dist/, thay bang hop thoai Gui gop y chong bot/spam 5 lop va chi giai ma ban giao email khi khach xac minh gui thanh cong.
- Nhánh: feat/hide-dev-contact-antispam | Commit trước đó: fe8bb18
- File: src/saas/feedback.js,src/saas/contact_dialog.js,src/i18n/contact_keys.js,src/saas/i18n.js,src/saas/saas.css,src/saas/branding.js,src/saas/auth_rate_limit.js,src/saas/auth_screen.js,src/saas/feature_access_ui.js,src/saas/session_ui_bindings.js,index.html,test/feedback_mailto.test.js,test/auth_screen.test.js

## 2026-11-15 17:08 [fix] Ngắt render WebGL khi màn hình đang khóa hoặc mở modal Workspace để giải phóng CPU SwiftShader, cho phép khóa tài khoản tức thì khi Firebase Auth gặp DB_TIMEOUT, sửa pattern regex /v ở Catalog CMS và đồng bộ timeout Playwright Auth CI.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 4864b45
- File: src/graphics/SceneRenderer.js,src/saas/session.js,src/saas/admin_catalog_audit_panels.js,playwright.auth.config.js

## 2026-11-15 16:31 [fix] Tang timeout Playwright tren GitHub CI (180s) de khong bi cat ngang khi SwiftShader render khung hinh 1080p/1440p
- Nhánh: codex/safelift-g0-ci | Commit trước đó: e002cdf
- File: playwright.config.js

## 2026-11-15 16:06 [feat] Buoc 4/4: Dong bo Logo-Icon app-icon.png tai CMS admin, sua main-logo.svg tu chua va nghiem thu DONE qua 309 test, build, anh trinh duyet
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 0264c2a
- File: src/saas/admin_panels.js,src/saas/admin_cms.css,public/safelift3d-icons/branding/main-logo.svg,auto_memory/PLAN.md,STATE.md,auto_memory/CONTEXT.md

## 2026-11-15 15:56 [feat] Buoc 3/4: Hien thi lai Logo-Icon dong bo app-icon.png va cap nhat nen industrial-lifting-bg.png Zoom Out cho man hinh Dang nhap/Xac thuc trong auth_screen.js va saas.css
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 8ffb75a
- File: src/saas/auth_screen.js,src/saas/saas.css,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:55 [feat] Buoc 2/4: Tach brand_splash.css (<40 dong), cap nhat nen industrial-lifting-bg.png co hieu ung Zoom Out va dong bo Logo-Icon app-icon.png cho man hinh khoi dong index.html
- Nhánh: codex/safelift-g0-ci | Commit trước đó: b788b33
- File: index.html,src/styles/brand_splash.css,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:52 [feat] Buoc 1/4: Tao hinh nen nha xuong cau truc cong nghiep ban quyen sach chuan mau SafeLift3D tai public/brand/industrial-lifting-bg.png
- Nhánh: codex/safelift-g0-ci | Commit trước đó: e62123e
- File: public/brand/industrial-lifting-bg.png,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:46 [docs] Lap ke hoach 4 buoc dong bo Logo-Icon va tao background cong nghiep an toan ban quyen co hieu ung Zoom Out khi khoi dong
- Nhánh: codex/safelift-g0-ci | Commit trước đó: e62123e
- File: auto_memory/PLAN.md,STATE.md,auto_memory/CONTEXT.md

## 2026-11-15 15:37 [feat] Buoc 6/6 CMS Enterprise: Ket noi day du tuong tac loc da chieu, chip ly do nhanh, cong tac 7 module, modal chi tiet tai khoan, mau Catalog nhanh va xuat CSV trong admin_dashboard.js; nghiem thu DONE
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 43ed0b7
- File: src/saas/admin_dashboard.js,auto_memory/PLAN.md,STATE.md,auto_memory/CONTEXT.md

## 2026-11-15 15:33 [feat] Buoc 5/6 CMS Enterprise: Tach phan he Catalog 3 cot + 4 mau nhanh, Nhat ky Audit Diff + xuat CSV va Modal Chi tiet User sang admin_catalog_audit_panels.js (89 dong) giup admin_panels.js gon con 159 dong
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 1ed191d
- File: src/saas/admin_catalog_audit_panels.js,src/saas/admin_panels.js,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:28 [feat] Buoc 4/6 CMS Enterprise: Nang cap admin_panels.js (194 dong) voi Header Command Bar dung logo chuan, thanh dieu huong phan he, dai 6 KPI, bang nguoi dung loc da chieu + chip ly do nhanh va cong tac 7 module + bang loi phien
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 4732204
- File: src/saas/admin_panels.js,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:26 [feat] Buoc 3/6 CMS Enterprise: Tao admin_helpers.js (194 dong) tinh 6 chi so KPI, loc da chieu user/catalog/audit, cong tac 7 module, 4 mau Catalog, xuat CSV an toan va bo sung Unit Test trong test/cms_data.test.js
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 100fd5f
- File: src/saas/admin_helpers.js,test/cms_data.test.js,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:23 [feat] Buoc 2/6 CMS Enterprise: Tao stylesheet admin_cms.css (170 dong) va tach CSS admin khoi saas.css (246 dong), sua triet de loi hop den che man hinh, dropdown trang xoa va nut keo gian 100%
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 94d46ed
- File: src/saas/admin_cms.css,src/saas/saas.css,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:16 [feat] Buoc 1/6 CMS Enterprise: Tao tu dien song ngu src/i18n/cms_keys.js (137 dong) cho Command Center, 6 KPI, bo loc da chieu, cong tac module, mau Catalog va xuat CSV
- Nhánh: codex/safelift-g0-ci | Commit trước đó: a16dfc1
- File: src/i18n/cms_keys.js,src/i18n/keys.js,auto_memory/PLAN.md,STATE.md

## 2026-11-15 15:13 [docs] Lap ke hoach 6 buoc nang cap he thong CMS Quan tri (/admin) len chuan Enterprise Command Center quoc te trong auto_memory/PLAN.md
- Nhánh: codex/safelift-g0-ci | Commit trước đó: a16dfc1
- File: auto_memory/PLAN.md,STATE.md,auto_memory/CONTEXT.md

## 2026-11-15 15:00 [docs] Buoc 10: Hoan tat kiem tra bao mat (@secure), chay Golden Test va bo 308 test (@test), khoa LOCK-06 trong STATE.md va nghiem thu ke hoach @upgrade sang DONE.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: cc9fdc2
- File: STATE.md,auto_memory/PLAN.md,auto_memory/CONTEXT.md

## 2026-11-15 14:58 [refactor] Buoc 9: Tach toan bo ham ve canvas texture be tong cang, cap thep, xich, sling, mat nuoc va vach canh bao sang src/graphics/pbr/ProceduralTextures.js (196 dong) va gom chung helper _buildRepeatTexture giup PBRMaterialFactory.js giam tu 659 xuong 199 dong.
- Nhánh: codex/safelift-g0-ci | Commit trước đó: 1893739
- File: src/graphics/pbr/ProceduralTextures.js,src/graphics/PBRMaterialFactory.js,auto_memory/PLAN.md

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
