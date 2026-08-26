# PROJECT STATE

**CR BỎ VALIDATE URL cho Demo_Link (free text) — CODE XONG 2026-08-26. ⚠️ CẦN [TT] REDEPLOY GAS.**
[TT] báo khi đăng ký US, nhập link demo ổ chung/nội bộ (không phải https://) bị server chặn: *"Lỗi gửi: Demo_Link phải là URL hợp lệ (bắt đầu bằng https://)"*.
- **Gốc:** validate **server-side** ở `assets/gas-backend/ValidationService.gs` (`validateCreate_` + `validateUpdate_`) gọi `isValidUrl_` — FE không hề validate (đã là free text).
- **Sửa:** gỡ 2 khối validate Demo_Link (create + update) → link demo là **free text** (chấp nhận `\\server\...`, localhost, SharePoint, ghi chú). Hiển thị vẫn do FE `_demoLinkHtml` lo (http → bấm được; non-web → hiện + nút Copy). `isValidUrl_` (Utils.gs) nay dead code (không caller) — dọn sau.
- **⚠️ [TT] cần redeploy GAS** (dán lại **ValidationService.gs**; nên dán TẤT CẢ .gs cùng lúc theo bài học `SHEET-SPAM-01`). Thuần backend — FE không đổi. Syntax check OK; không test unit nào cho validate (không vỡ).

---

**CR ĐĂNG KÝ US + REVIEW-QUEUE — CODE XONG + PUSH 2026-08-26 (main `73bfde1`).**
Sửa 3 CR do [TT] báo (sau khi [TT] đã deploy GAS):
- **CR#1 — Đăng ký US "timeout giả" + KHÔNG ghi được.** Gốc: đường ghi **hidden-iframe POST (v3.15.0)** KHÔNG đọc được response → mọi lỗi create/update phía server (validate/lock/…) bị che thành **"Timeout"** và US không được ghi. Kiểm chứng LIVE: **không US nào ghi được từ ~16/08**; backend create thực tế **OK** (probe ghi thành công `AIUS-0337` qua GET). **Sửa: transport HYBRID (v3.16.0)** — ưu tiên **GET-JSONP** (đọc được success/lỗi THẬT của GAS) cho payload nhỏ (đa số US); chỉ fallback iframe-POST khi payload >7500 (link demo dài, giữ fix URL-limit). + **guard `Owner_Email`** ở app.js (server REQUIRED_FIELDS_CREATE bắt buộc nhưng FE Validator không kiểm) → chặn sớm với thông báo rõ.
- **CR#2 — Tên US thành hyperlink** mở popup chi tiết ở bảng "Use case của tôi" + Explore (`.uc-name-link`).
- **CR#3 — Filter theo Người đăng ký (Owner)** ở hàng đợi review (droplist `rqOwnerFilter`).
- **FE-only — KHÔNG cần redeploy GAS** (backend đã chạy tốt); [TT] chỉ hard-refresh.
- **[TT] cần:** hard-refresh + nghiệm thu đăng ký (US hiện ở "Của tôi") + **xoá tay dòng probe `AIUS-0337`** (`__CC_PROBE_DELETE_ME__`) trong Google Sheet.
- **Verify:** Playwright **102/102** (viết lại `05-create-write-ops` cho hybrid GET-nhỏ/POST-lớn + test lõi: lỗi server hiện **message THẬT**, không "timeout" giả). **Residual:** payload >7500 vẫn đi POST — nếu POST hỏng thật trên live thì ca link-demo-dài hiếm *có thể* còn lỗi (nay hiện cảnh báo rõ); cần reproduce browser để đóng hẳn → TECH_DEBT `WRITE-TRANSPORT-01`.

---

**DỌN DẸP H1 (cũ) — tách khỏi H2, giữ ghi chú — CODE XONG 2026-08-26 (main).**
Mục tiêu: gỡ dấu vết mô hình H1 khỏi code đang chạy, lưu ghi chú ở `archive/h1/` (không deploy), không lẫn với H2.
- **Archive** (`archive/h1/` + README): `ScoringEngine.gs` (auto-score 70/30), `scoring.js`, `sptd-scoring.js`, `manager-review.html`, HDSD H1 (`HDSD_Champion_*`, `HDSD_CapNhatTuan_*`, `HUONG_DAN_NHAP_LIEU.txt`), builder/capture H1 + `screenshots/` (9 ảnh), test H1 (`test-sptd-scoring.js`, `test-governance-ui.js`, `scoring-test.html`).
- **Gỡ code đang chạy:** routes GAS `manager-review`/`champion-review`/`score-recalc`/`rank-recalc` + hàm `submitManagerReview_`/`submitChampionReview_` (AdminService) + toàn bộ `ScoringEngine.gs`; **ngừng gọi `scoreUseCase_`** khi tạo/sửa UC + cập nhật tuần + duyệt milestone. Dashboard: gỡ tab "Điểm SPTD" (ẩn) + `renderSPTDTab`/`_renderSPTD*`/`_exportSPTDCSV` + include `sptd-scoring.js`. FE api/routes bỏ entry H1.
- **⚠️ Thay đổi hành vi (chủ đích, theo lựa chọn "gỡ hẳn"):** milestone khi cập nhật tuần nay CHỈ theo **đổi stage** (bỏ "điểm auto tăng"); UC mới có `Total_Score` rỗng đến khi hội đồng H2 chấm (đúng H2). Role `champion` vẫn nhận như `teamlead` (giữ shim `auth.js`).
- **⚠️ [TT] cần redeploy GAS** (đã gỡ ScoringEngine.gs + routes + call site). Verify: unit scoring-h2 **71/71** + Playwright full (chạy lại sau dọn). Chi tiết: TECH_DEBT `H1-CLEANUP-01` + `archive/h1/README.md`.

---

**CR chấm điểm cá nhân theo THÁNG + rà soát UI chấm điểm — CODE XONG 2026-08-26 (main).**
Theo yêu cầu [TT] (4 CR):
- **CR#1 — Điểm năng lực (M-KPI-2) chấm THEO THÁNG.** `PERSONAL_SCORE` +cột `Month`; upsert theo **(Username, Month)** (nhiều dòng/member). M-KPI-2 cuối kỳ = **TRUNG BÌNH các tháng ĐÃ chấm** (tháng trống bỏ qua). Khóa học/lan tỏa/điểm trừ **không theo tháng** (đọc dòng tháng mới nhất). Kỳ H2 = **08–12/2026** (droplist). `_memberKpiFor_`/`listPersonalScores_`/`_buildKpiContext_` gộp theo member.
- **CR#2 — Panel chấm cá nhân hiện RÕ từng nhóm điểm.** Route mới **`member-kpi-preview`** trả M1(US)/M2/M3/M4/trừ/final. Panel bố cục 4 nhóm: **M-KPI-1 US** (hội đồng — chỉ đọc) · **M-KPI-2** (teamlead chấm theo tháng) · **KPI khác** · **KPI tổng hợp dự kiến**.
- **CR#3 — Chuẩn hóa slider (cả chấm cá nhân + hội đồng).** Component chung `assets/js/score-slider.js`: **mặc định 0** khi chấm mới, **giữ điểm đã lưu** khi sửa; **giá trị hiện NGAY TRÊN thanh** (bubble theo núm) — bỏ label giá trị chiếm dòng.
- **CR#4 — Dòng EVD (link bằng chứng ổ share, chỉ hiển thị).** Panel cá nhân: cột mới `Evidence_Link` (đọc-only, nguồn nhập sau). Review-queue: dòng EVD = `Demo_Link` của UC (bấm được).
- **Việc thủ công [TT] trước live:** deploy GAS (New version) + chạy lại **`setupScoringH2Sheets()`** (thêm cột `Month` + `Evidence_Link` vào `PERSONAL_SCORE`). Sau đó hard-refresh.
- **Verify:** unit `test-scoring-h2.js` **71/71** (+TB tháng/h2Months); Playwright `03` +2 (slider-0/bubble + EVD), `09-personal-score` **4/4** (droplist tháng · US · slider · submit-Month). *(chi tiết H2_PLAN §9)*

---

**H2 Giai đoạn 3 — Mô hình chấm điểm mới — CODE XONG 2026-08-25 (branch `feat/h2-scoring`).**
Thay auto-score 70/30 + SPTD 80-10-10 bằng bộ KPI H2 đầy đủ.
- **Đợt 1 (lõi member scoring) — ĐÃ DEPLOY GAS + MERGE main + PUSH:** **Điểm US** (hội đồng 4 teamlead, 3 tiêu chí 0–10, 30/40/30, điểm cuối = bình quân) + **Điểm cá nhân** (teamlead, 4 tiêu chí 0–10, 30/20/30/20). GAS `ScoringServiceH2.gs` (sheets `UC_COUNCIL_SCORE`+`PERSONAL_SCORE`); FE review-queue viết lại + `personal-score.html` mới + leaderboard 2 tab + ẩn tab SPTD.
- **Đợt 2 (KPI tổng hợp) — CHỜ DEPLOY GAS + MERGE main:** **Member KPI** = M1(US·40) + M2(năng lực·30) + M3(khóa học·15) + M4(lan tỏa·15) − trừ milestone (−2%/mốc, cap 10). **Teamlead** = T1(60) + T2(% team ≥70%·40). **PM bản A** = A1/A2 tự động + A3/A4 nhập tay. `PERSONAL_SCORE` +4 cột (teamlead nhập khóa học/lan tỏa/milestone cùng lúc); route `kpi-leaderboard`; leaderboard +2 tab (KPI tổng hợp/KPI Teamlead) + PM card. `scoring-h2.js` unit test **62/62**.
- **KPI PM chốt bản A (30/20/30/20) tại hub AIOS** (D10/D11). **Việc thủ công trước live (Đợt 2):** deploy GAS (New version) + chạy lại `setupScoringH2Sheets()` (thêm 4 cột `PERSONAL_SCORE`) → smoke test → merge main. Chi tiết: `AI_CONTEXT/H2_PLAN.md §8`. Quản trị chương trình: AIOS hub `binh-dan-hoa-ai-H2/`.

**Last updated:** 2026-08-18
**H2 Giai đoạn 1 — ĐÃ MERGE `main` + PUSH (2026-08-18):** **Auth dùng chung user/mật khẩu với SHTD-Dashboard** đã merge vào `main` (fast-forward `fc894b5..2e14332`) và push `origin/main`. Login đổi từ username-only → **username+password** (SHA-256 + token HMAC), nguồn user = sheet `User_Master` trên spreadsheet SHTD `1cpg1p…`; role `champion`→`teamlead`; quản lý user + đổi/đặt-lại mật khẩu qua User_Master; `change-password.html` mới. GAS đã deploy (AUTH_SECRET, URL không đổi). Test local: Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14. Kế hoạch đầy đủ: `AI_CONTEXT/H2_PLAN.md`.
> ✅ **Login thật đã chạy trên LIVE (2026-08-18).** Lỗi login lúc đầu do **quên set `AUTH_SECRET` trong Script Properties của project GAS AI US** (per-project — set bên SHTD không tự sang AI US); đã bổ sung → OK. Còn nợ (không chặn): smoke test change-password + admin user-mgmt + verify token ở approve/reject để chắc `AUTH_SECRET` hai bên khớp tuyệt đối.

**Dọn rác nguồn user (2026-08-18, Part 3) — nguồn user DUY NHẤT = `User_Master` (SHTD).** Gỡ hẳn quản lý user khỏi AI US (users.html/js + tab dashboard + routes user-upsert/reset/sync + hàm ghi User_Master) + sheet USERS nội bộ + `UserService.gs`/`MigrationService.gs`/`FixOwnerNameMigration.gs`. AI US chỉ ĐỌC User_Master (login/role/KPI) + đổi mật khẩu tự phục vụ (`change-password.html`, nav mới "Đổi mật khẩu"). `normalizeUser_`→Utils.gs. Fallback admin tối thiểu giữ (Config/env ADMIN_EMAILS); bỏ CHAMPION_USERS. Test 88/88 · unit đủ. **⚠️ Cần redeploy GAS.** (Team Số split: script `WorkflowSeedTeamSo.gs` committed nhưng DORMANT — chờ duyệt WF/US + chạy `seedTeamSoWorkflows()`.)

**H2 Giai đoạn 2 — Nhập liệu theo Workflow: ĐÃ DEPLOY GAS + MERGE main + PUSH (2026-08-18).** GAS deployed (URL không đổi). Đã merge `feat/h2-workflow-input` → `main` + push. ⚠️ **Kiểm tra đã chạy `seedWorkflowCatalog()` chưa** — nếu chưa, `WORKFLOW_CATALOG` rỗng → droplist Workflow trống (FE fallback US nhập tự do, không vỡ). Còn nợ (không chặn): smoke test đăng ký theo Workflow trên live + trang `workflow-catalog.html`. Wizard Step 1 thêm droplist **Workflow (bắt buộc) → Use case (dependent, từ danh mục) + "Khác — nhập tự do"**; nguồn = sheet `WORKFLOW_CATALOG` (69 US) lọc theo Team qua `TEAM_GROUP_MAP`; MASTER_DATA thêm cột `Workflow`/`Workflow_Group`. Kèm **trang Admin `workflow-catalog.html`** (thêm/sửa/xóa/đổi-tên Workflow+US, admin-only). GAS mới: `WorkflowService.gs` + `WorkflowSeedData.gs`, routes `workflow-catalog`(public)/`workflow-list|upsert|delete|rename`(admin). Test local: Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14. **Việc thủ công trước khi live: deploy GAS + chạy `seedWorkflowCatalog()` + smoke test → merge main** (xem H2_PLAN §8 / TODO_NEXT).
**Version (main):** 3.15.0 — (1) Duyệt milestone dùng chung modal chi tiết US 4 section + khối "Nội dung điều chỉnh" trước khi duyệt; (2) Link demo bấm được + Copy trong mọi popup duyệt/chi tiết US; (3) Fix triệt để lỗi link demo dài (ổ chung) làm hỏng create — chuyển create/update sang **hidden-iframe POST + verify** (bỏ giới hạn URL ~8KB). ✅ **LIVE** — GAS deployed 3 file (URL không đổi) + FE pushed `main` (`fc894b5`).
**Prev:** 3.14.0 — Milestone cập nhật tuần → KPI có phê duyệt Admin (2026-07-31, LIVE `8a786a4`) · 3.13.0 — nối `Active_User_Count` (Adoption) end-to-end (2026-07-30) · 3.12.3 (Wording login, 2026-07-29) · 3.12.2 (DATA-LIMIT-01, 2026-07-27) · 3.12.0 (Điểm SPTD tab)
**Org name (chuẩn):** Trung tâm Sản phẩm & Giải pháp Tín dụng — short form hiển thị = "TT SPTD"
**Data migration:** ✅ Team BL1 + BL2 → Team BL hoàn tất (2026-07-07) — LOOKUP + MASTER_DATA + USERS + DASHBOARD cache cleared
**Project location:** `D:\Workspace\Production\ai-usecase-platform` (moved from `D:\Công việc\Vibecode\` on 2026-06-19)

---

## Architecture Overview

### Pages & Routes
| URL | File | Auth | Description |
|-----|------|------|-------------|
| `/login.html` | `login.html` | Public | Login page — username only |
| `/index.html` | `index.html` | User+ | Portal home (service cards) |
| `/register.html` | `register.html` | User+ | Wizard 4-step + scoring preview + self-assessment sliders |
| `/dashboard.html` | `dashboard.html` | User+ | Dashboard (admin: all tabs; user: My/Explore/KPI) |
| `/users.html` | `users.html` | Admin only | Standalone user management page |
| `/review-queue.html` | `review-queue.html` | Champion+ | Champion review queue — 3 sections + slide-in panel |
| `/manager-review.html` | `manager-review.html` | Champion+ | Legacy review page — sidebar Pattern A synced (NAV-01 2026-06-22) |

### Auth Flow
```
Any page → AuthService.requireAuth()
  → not logged in → login.html?return=<page>
  → login form submit → AuthService.login(username)
    → GAS ?action=user-login → role from USERS sheet
    → fallback: role = 'admin' if username in APP_CONFIG.ADMIN_EMAILS
    →           role = 'champion' if username in APP_CONFIG.CHAMPION_USERS
    →           else role = 'user'
    → store to sessionStorage['ai_user_session']
  → redirect to return URL or index.html

users.html → AuthService.requireAdmin()
  → not logged in → login.html
  → logged in but not admin → index.html

review-queue.html → AuthService.requireChampionOrAdmin()
  → not logged in → login.html
  → logged in but role is 'user' → index.html
  → admin or champion → show review queue
```

### Session Storage Keys
| Key | Type | Owner | Notes |
|-----|------|-------|-------|
| `ai_user_session` | JSON object | `auth.js` | `{email, displayName, role, loginAt}` |
| `ai_admin_email` | string | legacy + `auth.js` | Written for dashboard.js backward compat |

### Script Load Order (register.html)
```
env.js → auth.js → [auth guard inline] → routes.js → constants.js
→ helpers.js → storage.js → api.js → validation.js → toast.js
→ duplicate-check.js → form-mapper.js → wizard.js → scoring.js → app.js
```

### Script Load Order (users.html)
```
env.js → auth.js → [requireAdmin inline] → routes.js → toast.js → api.js → users.js
```

### Script Load Order (review-queue.html)
```
env.js → auth.js → [requireChampionOrAdmin inline] → routes.js → toast.js → api.js → scoring.js → review-queue.js
```

### Script Load Order (dashboard.html)
```
env.js → auth.js → routes.js → api.js → sptd-scoring.js → dashboard.js
```

### Script Load Order (index.html / portal)
```
env.js → auth.js → [inline portal script]
```

---

## Frontend — ✅ Hoàn chỉnh

| Area | Status | Notes |
|---|---|---|
| Login page | ✅ | Username-based (no email validation), `type="text"`; URL redirect fix v3.6.1 |
| Portal home | ✅ | Sidebar layout, SVG icons, same shell as dashboard |
| Register/Wizard | ✅ | Sidebar layout; auto-fill Owner_Name (editable); Owner_Email ẩn — inject silent; UseCase_ID fetched fresh tại submit time (v3.6.3); special chars fully handled (v3.7.0); timeout 45s + smart recovery (v3.7.1); HTTP 400 Prompt_Context fix (v3.7.2) |
| AuthService | ✅ | Username login; no regex; `ADMIN_EMAILS` = username list |
| Auth guard | ✅ | All pages redirect to login if not authenticated |
| Auth logout | ✅ | Sidebar logout button trên tất cả pages |
| Backward compat `?edit=` | ✅ | `index.html` redirects `?edit=` → `register.html` |
| Wizard 4-step | ✅ | `register.html` |
| Auto-fill owner fields | ✅ | Owner_Name auto-fill (editable); Owner_Email hidden + silent inject khi submit |
| Unique UseCase ID | ✅ | v3.6.3 — ID fetched fresh tại submit; GAS `_assignUseCaseId_()` validate trong lock; fallback generate nếu collision |
| Dashboard (admin) | ✅ | Auto-load tất cả tabs khi login; approve/reject confirmed working |
| Dashboard (user) | ✅ | My Cases + Khám phá tabs |
| My US feature | ✅ | Tab trong dashboard; **v3.12.2 (2026-07-27)**: fetch theo owner ở server (`owner_login`+`owner_name`, GAS lọc TRƯỚC slice) → luôn đủ UC kể cả cũ; hết lệ thuộc global cap 200 |
| Data completeness (DATA-LIMIT-01) | ✅ | **NEW v3.12.2 (2026-07-27)** — org-wide loads (`_allList`, pending, review-queue, manager-review) dùng `limit:0`=tất cả; GAS `listUseCases_` `limit<=0`→không cắt + owner filter trả full. KPI/SPTD/Khám phá/Tất cả nay đầy đủ data cũ. Commit `3c7463e`, GAS deployed |
| Explore (Khám phá) | ✅ | NEW v3.3 — All approved UCs from org; searchable; all users |
| US Detail popup | ✅ | 4-section view; progressive load; approve/reject inline; Copy Prompt button |
| Drill-down list popup | ✅ | NEW v3.5 — Click KPI cards / chart segments/bars → popup bảng lọc → Chi tiết |
| recentTable Chi tiết | ✅ | NEW v3.5 — Nút Chi tiết đồng bộ với các bảng khác |
| Filter tab Tất cả | ✅ | NEW v3.6 — Multi-select status pills + team dropdown + search kết hợp + count badge |
| Box Từ chối | ✅ | NEW v3.6 — Rejected card trong tab Tổng quan; preview 5 + Xem tất cả; Chi tiết đầy đủ |
| Copy Prompt | ✅ | NEW v3.3 — 8 prompt fields → clipboard; hiện sau khi full data load |
| Approval flow | ✅ | Confirmed working; confirm button re-enable fix v3.6.2 |
| Auto-load on startup | ✅ | NEW v3.3 — _loadStartupData() thay lazy tab-click loading |
| Sidebar UI sync | ✅ | v3.10.3 (2026-06-18) — Đồng bộ Pattern A sidebar trên toàn bộ pages: leaderboard/weekly-update thêm navUsers+navReviewQueue, xóa navManagerReview, thay inline JS bằng AuthService; users/review-queue Pattern B → A brand, role="menubar", section label Quản lý, topbar CSS class chuẩn |
| Scoring display (KPI + detail) | ✅ | NEW v3.10.4 (2026-06-18) — KPI tab drill-down shows score columns (Auto/Champion/Tổng/Rank/Nhận xét); unscored UCs get "chưa thực hiện chấm điểm" badge; detail popup has "★ Đánh giá & Điểm số" section with rank badge + champion breakdown |
| Leaderboard score columns | ✅ | NEW 2026-06-19 — 3 separate columns Auto/70 · Champion/30 · Tổng/100 + Comment replacing old progress bar; rows clickable → full detail popup (4 sections + score, read-only); Category tab also clickable; `review_comment` deployed in GAS 2026-06-22 |
| Review queue filter | ✅ | NEW v3.10.4 (2026-06-18) — Filter bar on review-queue.html: search, team dropdown (admin only), section pills, result counter |
| UC Picker Modal (weekly-update) | ✅ | NEW v3.11 (2026-06-22) — `weekly-update.html` replaces `<select>` dropdown with full modal table; search + stage filter; role-based: admin=all, champion=own team, user=own email/name; `display:none/flex` pattern for Playwright; `_pickerBuilt` lazy-build flag |
| Stage lifecycle S1→S4 | ✅ | NEW v3.11 (2026-06-22) — weekly-update.html stage upgrade toggle + checklist gate + S4 special fields (scalePlan, scaleRisks); WEEKLY_LOG sheet append-only history; timeline view after submit |
| FILTER-01 fix | ✅ | 2026-06-22 — `dashboard.js _populateTeamFilter()`: added `_filterAll.team = teamSel.value` after innerHTML rebuild to sync stale state |
| PERF-02 fix | ✅ | 2026-06-22 — `dashboard.js _loadTabData('my')`: added `if (_myList.length === 0)` guard; prevents double-fetch after startup |
| NAV-01 fix | ✅ | 2026-06-22 — `manager-review.html`: full Pattern A sidebar (Trang chủ first, Hệ thống removed, navUsers/navReviewQueue added, sidebarUserRole fixed) |
| Home page service cards | ✅ | NEW v3.10.4 (2026-06-18) — PORTAL_SERVICES expanded 2→8 items (2 sections); role-aware; champion included |
| Sidebar "Trang chủ" first | ✅ | NEW v3.10.4 (2026-06-18) — Trang chủ nav item moved to first position; "Hệ thống" section removed from 7 pages |
| TPBank sidebar UI | ✅ | Tất cả pages dùng sidebar — consistent layout, Pattern A (sidebar-brand + Bình dân hóa AI) |
| Heroicons SVG | ✅ | Tất cả emoji → SVG inline (dashboard, register, index) |
| Chart.js charts | ✅ | doughnut + stacked horizontal bar (Team & Category); CSS fallback nếu CDN fail |
| Stacked breakdown charts | ✅ | NEW v3.8.0 — Team & Category bars phân tách màu theo trạng thái UC; click segment → popup lọc đúng group + status |
| KPI & Tiến độ tab | ✅ | v3.10.2 — Week nav ‹/› xem lại tuần trước; chỉ đếm Approved UCs; `KPI_EXCLUDED_USERS` loại directors (cuongvm1); render ngay không chờ getUsers(); 15/15 Playwright PASS. BUG FIX 2026-06-29: inactive user (active=false) bị loại kể cả khi có UC cũ trong _allList |
| User management | ✅ | NEW v3.10.0 — Sheet USERS trong GAS; case-insensitive (normalizeUser_); login async validates GAS; admin tab quản lý users; sync từ MASTER_DATA |
| Standalone users.html | ✅ | NEW v3.10.2 (2026-06-17) — Separate page (not dashboard tab); admin-only; table + add/edit modal; champion role option |
| Champion role | ✅ | NEW v3.10.2 (2026-06-17) — New role between admin and user; team-scoped UC review; scores Quality/BV/Innovation 0–10; USERS sheet is source of truth |
| Review queue page | ✅ | NEW v3.10.2 (2026-06-17) — review-queue.html; 3 queues: Chờ đánh giá/Đang review/Đã hoàn thành; slide-in review panel with sliders + projected score |
| Scoring preview (register) | ✅ | NEW v3.10.2 (2026-06-17) — Live scoring ring + bars while filling wizard; self-assessment BV + Innovation sliders; Quality shown as 0 (TBD) |
| Score display (explore) | ✅ | NEW v3.10.2 (2026-06-17) — Score chip on approved UCs in Explore tab; rank color badge |
| ScoringEngine JS module | ✅ | NEW v3.10.2 (2026-06-17) — assets/js/scoring.js; mirrors GAS ScoringEngine.gs; used by register.html preview + review-queue.html panel |
| Adoption scoring input | ✅ | NEW v3.13.0 (2026-07-30) — trường `Active_User_Count` ("Số người dùng thực tế") nối end-to-end: register wizard + cập nhật tuần → nguồn điểm Adoption (max 20đ). Trước đây không có ô nhập → Adoption luôn=0. GAS deployed. UC cũ cần `recalculateAllScores_()` (SCORE-BACKFILL-01) |
| Milestone cập nhật tuần → KPI | ✅ | NEW v3.14.0 (2026-07-31) — weekly-update chuyển Stage/nâng điểm = "milestone" → giữ pending, Admin duyệt ở tab "Chờ duyệt" (section riêng) mới áp Stage/điểm + tính KPI (+1 Owner ở tuần Log_Date, cộng dồn). SPTD cộng số lượng + tuần đạt. `_buildKPIData` + `sptd-scoring.js` cộng milestone đã duyệt. 13 unit test + 5 E2E mới |
| Duyệt milestone = xem chi tiết US | ✅ | NEW v3.15.0 (2026-08-02) — card milestone → 1 nút "Xem chi tiết & Duyệt" mở `openDetail(uc, milestone)` = modal 4 section US + khối "Nội dung điều chỉnh chờ duyệt" (Stage/Điểm cũ→mới, ghi chú tuần). Duyệt/Từ chối inline (bỏ `window.prompt`). Đóng MILESTONE-PROMPT-01 |
| Link demo bấm được + Copy | ✅ | NEW v3.15.0 (2026-08-02) — modal chi tiết US, popup duyệt milestone, leaderboard detail, cột Demo list drill-down. `http(s)` → `<a target=_blank>`; ổ chung/UNC/`file://` → text + Copy (base64 onclick). `_demoLinkHtml`/`_demoField` (dashboard) + `_lbDemoField` (leaderboard) |
| Write transport (create/update) | ✅ | CHANGED v3.15.0 (2026-08-02) — create/update chuyển từ JSONP GET (giới hạn URL ~8KB) sang **hidden-iframe FORM POST + verify `getUseCase`**. Fix triệt để lỗi link demo dài (ổ chung) → HTTP 400. Bỏ ngưỡng 7500 cho write (giữ cho GET nhỏ). ⚠️ Cần GAS `doPost` mới (decode payload field) |
| Điểm SPTD tab | ✅ | NEW v3.12 (2026-07-08) — Tab "Điểm SPTD" trên dashboard; công thức 80-10-10 (quality avg/qty/weeks); T0=2026-06-01; leaderboard public + my card + formula box + UC list + timeline + CSV export (admin); SPTDScoring IIFE module; 29/29 unit tests + 10/10 Playwright |
| Playwright test suite | ✅ | 95/95 pass (2026-07-08) — 7 spec files; +10 SPTD tests (06-sptd-tab.spec.js) |
| KPI week date format | ✅ | fix `91c4a00` — manual `DD/MM` formatter thay `toLocaleDateString` (locale inconsistency trên Chromium/Windows) |
| Responsive | ✅ | Sidebar collapse 1024px áp dụng toàn bộ pages |

## Backend (GAS) — ✅ Deployed

**Active deployment URL:** `AKfycbypN8afAl2zQwpR7K6k1-699g3HAhFAIqAOtDn3qY1nJWzuN1bd8n99bzRUzaV8ZMyTCw`
**OAuth:** ✅ Authorized | **GAS code sync:** ✅ Đã deploy đủ — v3.15.0 deployed 2026-08-02, URL không đổi.

**Last redeploy (v3.15.0, 2026-08-02):** `Code.gs` (`doPost` decode `payload` base64url form field — nhận create/update từ FE iframe POST), `UseCaseService.gs` (`getUseCaseById_` fallback tra `UseCase_ID` — verify create), `AdminService.gs` (`listUseCases_` trả `demo_status`+`demo_link`). Edit deployment → New version, URL không đổi. FE pushed `main` `fc894b5`.

**Last redeploy (2026-07-31, v3.14.0):** `Config.gs` (WEEKLY_LOG +8 cột milestone + MILESTONE_STATUS), `Utils.gs` (ensureSheetColumns_ + updateRowByField_), `AdminService.gs` (submitWeeklyUpdate_ milestone gate + listMilestones_/approveMilestone_/rejectMilestone_ + migrateWeeklyLogSchema()), `Code.gs` (routes milestone-list/approve/reject). URL không đổi. `migrateWeeklyLogSchema()` đã chạy. — commit `8a786a4`

**Prev redeploy (2026-07-27):** `AdminService.gs` (listUseCases_ owner filter + `limit<=0`=full) + `Code.gs` (list route owner params). URL không đổi. Confirmed deployed by user. — commit `3c7463e`

**Prev redeploy (2026-06-22):**

| File | Thay đổi chính | Deployed |
|---|---|---|
| `AdminService.gs` | isChampionForTeam_() + submitChampionReview_() + listUseCases_() returns 5 score fields + review_comment in leaderboard mapItem + submitWeeklyUpdate_() (numeric fields TEXT/NUM split, WEEKLY_LOG route) | ✅ 2026-06-22 |
| `Code.gs` | Routes: next-id + 5 user endpoints + champion-review + weekly-update | ✅ 2026-06-18 |
| `UserService.gs` | USERS sheet, normalizeUser_(), validateUserLogin_(), syncUsersFromMasterData_(); fix champion role save | ✅ 2026-06-18 |
| `Config.gs` | SHEETS.USERS + USERS_HEADERS + SHEETS.WEEKLY_LOG + usernames ADMIN_EMAILS | ✅ 2026-06-22 |
| `Utils.gs` | sanitizeStr_ + toSheetValue_() + findRowByField_() + USERS case | ✅ 2026-06-18 |
| `UseCaseService.gs` | _assignUseCaseId_() + single-read update + JSON_Backup cap + _getAllUseCaseIds_() N×1 column read | ✅ 2026-06-22 |
| `LookupService.gs` | Rewrite hoàn toàn | ✅ 2026-06-18 |
| `DashboardService.gs` | record_id + status + owner_name trong recent_submissions | ✅ 2026-06-18 |

**Khởi tạo sau deploy (nếu USERS sheet chưa có):**
```
GAS_URL?action=user-init&admin_email=tuantt4
```
Rồi Dashboard → tab Người dùng → **Đồng bộ từ UC** → import owners từ MASTER_DATA.

| Feature | Status | Notes |
|---|---|---|
| createUseCase | ✅ | Live |
| getUseCase | ✅ | Live |
| updateUseCase | ✅ | Live |
| listUseCases | ✅ | Live |
| approveUseCase | ✅ | Confirmed working |
| rejectUseCase | ✅ | Confirmed working |
| duplicateCheck | ✅ | Live |
| lookupData | ✅ | Live |
| dashboard API | ✅ | Live |
| user-login / users / user-upsert / user-sync | ✅ | Deployed 2026-06-18 |
| champion-review | ✅ | Deployed 2026-06-18 |
| weekly-update / weekly-log | ✅ | Deployed 2026-06-22 — submitWeeklyUpdate_ (TEXT/NUM split, WEEKLY_LOG append) + getWeeklyLog_ (timeline history). **v3.14.0 (2026-07-31):** submitWeeklyUpdate_ phát hiện milestone (stage/nâng điểm) → gate Stage/điểm pending |
| milestone-list / approve / reject | ✅ | NEW v3.14.0 (2026-07-31) — listMilestones_(filter) join owner/team; approveMilestone_ áp Stage/điểm + re-score; rejectMilestone_ (bắt buộc lý do). Admin-only |
| Authentication | ❌ | Username-based FE only, no real auth (SEC-01) |

## Auth Architecture Notes (v3.10.2)

**Roles:** `admin` | `champion` (new 2026-06-17) | `user`

- **Login:** Async — gọi GAS `?action=user-login` lấy role từ USERS sheet; fallback về local nếu GAS offline
- **Role resolution priority:** USERS sheet (Active=TRUE) → `APP_CONFIG.ADMIN_EMAILS` (admin fallback) → `APP_CONFIG.CHAMPION_USERS` (champion fallback)
- **Admin list:** GAS USERS sheet (Role=admin) → `Config.gs` ADMIN_EMAILS → `config/env.js` ADMIN_EMAILS
- **Champion detection:** GAS USERS sheet (Role=champion, Active=TRUE, Team=<team>) → `APP_CONFIG.CHAMPION_USERS` (FE-only fallback list, currently `[]`)
- **Session:** sessionStorage `ai_user_session` = `{email: username, displayName, role, team, loginAt}`
- **Page access matrix:**
  - `dashboard.html` — all logged-in users (admin: full tabs; user: My/Explore/KPI)
  - `users.html` — admin only
  - `review-queue.html` — admin OR champion
- **Champion team scope:** `review-queue.js _filter()` compares `uc.team.toLowerCase() === user.team.toLowerCase()`; GAS also enforces in `isChampionForTeam_()`
- **Owner fields:** Auto-filled from session on register; readonly after fill
- **CAVEAT:** Khi GAS offline, fallback local không check `Active=FALSE` → deactivated user vẫn login được (USER-OFFLINE-01 in TECH_DEBT)

## Scoring Architecture (v3.10.2)

**Total = 100pt:**
- Auto Score (70pt max): Efficiency 20 + Adoption 20 + Reuse 20 + Frequency 15 + Docs 5
- Manual Score (30pt max): Quality 10 (champion) + Business_Value 10 + Innovation 10

**Rank thresholds:** ≥85 TOP_PERFORMER (#7B2CBF) · ≥70 STRONG_CONTRIBUTOR (#4CAF50) · ≥50 AVERAGE (#F6B100) · <50 BOTTOM_PERFORMER (#F44336)

**Self-assessment flow:**
1. User fills wizard → adjusts BV + Innovation sliders (0–10, default 5)
2. Register.html preview shows live score (Quality=0 since unknown)
3. Sliders submitted with UC payload → stored on MASTER sheet
4. Champion opens review panel → sets Quality/BV/Innovation sliders → submits
5. GAS `submitChampionReview_()` calls `scoreUseCase_()` → overwrites Total_Score + Rank_Category

## Data Layer — ✅ Unchanged
Google Sheets structure unchanged. API contract (field names) unchanged. localStorage key unchanged.

## CSS Design System (v3.0.0)

**Primary:** `#7B2CBF` (purple) — Google Blue eliminated  
**Sidebar gradient:** `linear-gradient(180deg, #7B2CBF 0%, #6622B4 100%)`  
**Card radius:** 20px | **Button/Input radius:** 12px | **Shadow:** `0 2px 10px rgba(0,0,0,.03)`

Key tokens (all in `variables.css`):
```
--color-primary:         #7B2CBF
--sidebar-gradient:      linear-gradient(180deg, #7B2CBF 0%, #6622B4 100%)
--color-bg:              #F5F5F7
--color-surface:         #FFFFFF
--color-border:          #E9E9EF
--color-text:            #1F1F2C
--color-text-secondary:  #6D6D7A
--color-text-muted:      #A4A4B2
--radius-md:             12px   (buttons, inputs)
--radius-xl:             20px   (cards, modals)
--shadow-card:           0 2px 10px rgba(0,0,0,.03)
--sidebar-width:         252px
```

## Layout Architecture (v3.0.0)
| Page | Layout | Sidebar |
|---|---|---|
| `dashboard.html` | `.app-layout` → sidebar + topbar | ✅ Yes (252px purple) — Pattern A |
| `users.html` | `.app-layout` → sidebar + topbar | ✅ Yes — Pattern A (fixed v3.10.3) |
| `review-queue.html` | `.app-layout` → sidebar + topbar | ✅ Yes — Pattern A (fixed v3.10.3) |
| `leaderboard.html` | `.app-layout` → sidebar + topbar | ✅ Yes — Pattern A |
| `weekly-update.html` | `.app-layout` → sidebar + topbar | ✅ Yes — Pattern A |
| `manager-review.html` | `.app-layout` → sidebar + topbar | ✅ Yes — Pattern A (fixed NAV-01 2026-06-22) |
| `index.html` | `.portal-header` + `.portal-main` | ❌ Top-header only |
| `register.html` | `.app-header` + `.app-container` | ❌ Top-header only |
| `login.html` | `.login-page` centered card | ❌ Auth page |

**Sidebar Pattern A (chuẩn — tất cả pages phải tuân theo):**
- `<aside aria-label="Điều hướng chính">` → `<a href="index.html" class="sidebar-brand">` → `.sidebar-brand-logo` + `.sidebar-brand-text` (name: "Bình dân hóa AI", sub: "TT SPTD")
- `<nav role="menubar">` → `<span class="sidebar-section-label">Quản lý</span>` trước group đầu tiên
- Topbar: `.topbar-user-chip` / `.topbar-user-avatar` / `.topbar-user-name`
- Inline JS: `AuthService.requireAuth()` (hoặc requireAdmin/requireChampionOrAdmin) + `populateSidebarUser()` + `setupNav()`

Sidebar collapses at **1024px** (off-canvas, `.is-open` toggle).

## Design Docs (new in v3.0)
- `DESIGN_TOKENS.md` — all token values
- `DESIGN_SYSTEM.md` — component HTML patterns + CSS architecture
- `UIUX_SYSTEM.md` — design philosophy, anti-patterns
- `LAYOUT_SYSTEM.md` — layout diagram + spacing rules
- `THEME_ARCHITECTURE.md` — token inheritance model, dark mode readiness
- `RESPONSIVE_GUIDE.md` — breakpoint table + sidebar behavior
- `COMPONENT_GUIDELINES.md` — copy-paste patterns for each component
- `CHANGELOG_UI_REFACTOR.md` — full delta of this refactor
