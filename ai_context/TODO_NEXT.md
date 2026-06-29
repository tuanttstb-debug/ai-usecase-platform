# TODO NEXT

Thứ tự ưu tiên cho session tiếp theo.

---

## ✅ Đã hoàn thành trong session 2026-06-29 (Part 2)

- [x] **BUG FIX: KPI duplicate user row** (v3.11.2, commit `a5ff7fd`) — `_buildKPIData()` Step 2a chỉ `claimed[uKey]` không `claimed[dnKey]` → byEmail[dnKey] lọt qua Step 2b tạo ghost row thứ 2. Fix: claim cả `dnKey`, merge `byEmail[uKey] + byEmail[dnKey]` qua `mergeKPIStats_()`. Disjoint buckets (một UC có một owner_email) → không double-count. Đây cũng là root cause AIUS-0157 không hiện đúng row.
- [x] **Unit test `test-kpi-data.js`** — Đồng bộ `buildKPIData` với `mergeKPIStats_` + claim dnKey. Thêm Suite G (G1–G5). **30/30 PASS**.
- [x] **Playwright regression** — 85/85 PASS, không có regression.

---

## ✅ Đã hoàn thành trong session 2026-06-29 (Part 1)

- [x] **BUG FIX: KPI inactive user** (v3.11.1, commit `158a9e6`) — `dashboard.js _buildKPIData()`: inactive user (active=false) bị skip ở Step 2a mà không vào `claimed` → Step 2b thêm UC của họ từ `byEmail` vào result. Fix: ghi `inactiveKeys` trong Step 2a, filter `if (inactiveKeys[eKey]) return` trong Step 2b. Cả username lẫn display_name đều được ghi vào inactiveKeys. EVD: `evd/kpi-inactive-fix/` (5 screenshots).
- [x] **Unit test `test-kpi-data.js`** — Cập nhật filter sang `status !== 'Approved'` (đồng bộ dashboard.js). Thêm inactive UC vào fixture ALL_LIST để A9 test đúng bug. Thêm Suite F (5 tests) kiểm tra trực tiếp bug + edge case display_name. **25/25 PASS**.
- [x] **Playwright regression** — 85/85 PASS, không có regression.

---

## ✅ Đã hoàn thành trong session 2026-06-22

- [x] **GAS redeploy** — AdminService.gs (submitWeeklyUpdate_ numeric TEXT/NUM split + review_comment leaderboard) + UseCaseService.gs (_getAllUseCaseIds_ N×1 optimization). URL giữ nguyên. Confirmed by user.
- [x] **UC Picker Modal (`weekly-update.html`)** — Thay thế `<select>` dropdown bằng modal table có search + stage filter. Role-based: admin=all, champion=own team, user=own email match. `display:none/flex` pattern (Playwright compatible). `_pickerBuilt` lazy flag. Commit `26820c4`.
- [x] **Stage lifecycle S1→S4 (`weekly-update.html`)** — Stage upgrade toggle + checklist gate + S4 special fields. WEEKLY_LOG timeline sau submit. `_safeNum()` guard cho numeric prefill. Stage key: `uc.stage || uc.current_stage || 'S1 - Idea'`. Commit `26820c4`.
- [x] **Playwright weekly-update test suite** — `tests/weekly-update.spec.js` 11 tests (T01–T11). `test.setTimeout(90000)` inside describe block (giữ nguyên 20s global). T09/T11 skip gracefully khi UC ở S4 max. 85/85 PASS. Commit `13fe01c`.
- [x] **HDSD_CapNhatTuan_AI_USSPTD.docx** — Word 1.7MB, 11 phần, 14 EVD screenshots từ `evd/weekly-update/`. Script `scripts/gen_hdsd_capnhattuan.py` (python-docx). Gửi cho Champion confirmed by user. Commit `a673f47`.
- [x] **FILTER-01** — `dashboard.js _populateTeamFilter()`: thêm `_filterAll.team = teamSel.value` sau khi rebuild innerHTML → sync stale state khi team biến mất khỏi data. Commit `a673f47`.
- [x] **PERF-02** — `dashboard.js _loadTabData('my')`: thêm guard `if (_myList.length === 0)` → không double-fetch sau khi startup đã populate `_myList`. Commit `a673f47`.
- [x] **NAV-01** — `manager-review.html`: full Pattern A sidebar sync (Trang chủ first, Hệ thống section removed, navUsers/navReviewQueue added, sidebarUserRole fixed từ hardcode 'Admin' → 'Người dùng'). Commit `a673f47`.
- [x] **Champion E2E test** — Confirmed working by user 2026-06-22.
- [x] **HDSD Champion gửi xong** — Confirmed by user 2026-06-22.

---

## P0 — Smoke test weekly-update với champion thật

Cần verify weekly-update feature với real champion credentials (không phải admin test account):

- [ ] Login champion → `weekly-update.html` → picker modal chỉ hiện UC của team champion đó
- [ ] Chọn UC → form prefill đúng (progress, stage)
- [ ] Submit weekly update → WEEKLY_LOG ghi đúng
- [ ] Timeline hiện sau submit

---

## P1 — End-to-end smoke test toàn hệ thống (regression)

Checklist:
- [ ] `GAS_URL?action=health` → `{"success":true}`
- [ ] Login regular user → dashboard → tab **Khám phá** hiển thị Approved UCs
- [ ] Click UC trong Khám phá → detail modal mở → **Copy Prompt** hiện → click → toast "Đã copy"
- [ ] Login admin → tất cả tabs load ngay (không cần click từng tab)
- [ ] Admin: tab "Chờ duyệt" → xem chi tiết → Duyệt → toast + reload
- [ ] Submit use case mới từ register.html → không lỗi

---

## P2 — Nâng cấp auth (security)

**Hiện tại (v3.3):** Username tự nhập, không verify. SEC-01 vẫn tồn tại.

Option A — Whitelist username (quick win):
- `AuthService.login()`: check username trong whitelist trước khi cho login

Option B — Google Sign-In (proper fix):
- `google.accounts.oauth2.initTokenClient()`

**PO cần confirm:**
- [ ] BUG-03: `Status="Draft"` khi tạo mới — design intent hay bug?
- [ ] Whitelist toàn bộ user hay chỉ admin?

---

## P1 — Quản lý KPI_EXCLUDED_USERS qua USERS sheet (thay env.js)

Hiện tại: `KPI_EXCLUDED_USERS: ['cuongvm1']` hardcode trong `config/env.js` → cần deploy frontend mỗi khi thêm/xóa.

Cải tiến: Thêm column `KPI_Exempt` (TRUE/FALSE) vào USERS sheet → `_buildKPIData()` đọc từ `_usersList` để exclude → admin tự quản lý qua tab Người dùng, không cần sửa code.

**Effort:** Low — 1 column GAS + 1 condition FE. **Blocking:** GAS-MYSTERY-01 phải xong trước.

---

## P3 — Feature backlog

- [ ] Explore tab: show empty state với CTA "Chưa có UC nào được duyệt — hãy là người đầu tiên!" thay vì text thuần
- [ ] Pagination cho dashboard (giới hạn 200 records hiện tại) — ảnh hưởng rejected card + filter
- [ ] "Under Review" status transition cho workflow
- [ ] Export to CSV từ dashboard (tab Tất cả + filter state)
- [ ] Line chart (submission trend) — cần `trend_data` từ GAS API
- [ ] Filter tab Tất cả: thêm nút "Reset tất cả filter" (1 click reset status + team + search)
- [ ] weekly-update.html: thêm spinner khi GAS đang ghi WEEKLY_LOG (hiện không có loading state sau khi submit)

---

## P4 — Tech debt

- [ ] Migrate JS từ global var sang ES Modules (MAINT-01)
- [ ] Add `Content-Security-Policy` header (SEC-02)
- [ ] Fill `assets/docs/` với deployment guide thực tế (MAINT-07)

---

## P5 — UI Polish

- [x] SVG icon library — Heroicons 2.0 (done 2026-05-29)
- [x] Chart.js integration (done 2026-05-29)
- [x] Full UC detail view modal — 4 sections (done 2026-06-02)
- [ ] Dark mode — tokens sẵn sàng, thêm `@media (prefers-color-scheme: dark)` vào `variables.css`
- [ ] Logo SVG thay sparkles trong sidebar brand

---

## ✅ Đã hoàn thành trong session 2026-06-20

- [x] **GAS write-ops optimization**: `_getAllUseCaseIds_()` đọc chỉ cột UseCase_ID (N×1 thay vì N×99). Giảm ~90% data read per createUseCase. `appendRowFromObject_()` header-only read đã có sẵn. Commit pending GAS deploy.
- [x] **FE timeout 90s**: `api.js` `createUseCase`/`updateUseCase` timeout 45s → 90s. Buffer cho GAS cold start (5–15s) + LockService + 2 sheet ops. Commit pushed.
- [x] **playwright.config.js cwd fixed**: `D:\\Workspace\\Production\\ai-usecase-platform`. PLAYWRIGHT-01 (cwd portion) CLOSED.
- [x] **New test suite `tests/05-create-write-ops.spec.js`** — 15 tests: payload size guard (A), duplicate check (B), GAS timeout recovery 48s delay (C), create/update full flow mock (D). Fixed 3 root causes during debug: MOCK_LOOKUP keys mismatch, viText undersize, select options race condition.
- [x] **74/74 Playwright tests pass** — 59 existing (spec 01–04) + 15 new (spec 05).

---

## ✅ Đã hoàn thành trong session 2026-06-19 (Part 2)

- [x] **Leaderboard score columns + click-to-detail**: Thay cột "Điểm (100)" bằng Auto/70 · Champion/30 · Tổng/100 · Comment. Tất cả rows clickable → `#lbDetailModal` self-contained (4 sections + score section, read-only). Category tab rows cũng clickable. `_lbCache` pattern. `review_comment` thêm vào GAS mapItem (cần redeploy). Commit `ac50eaf`.

---

## ✅ Đã hoàn thành trong session 2026-06-18 (Part 2)

- [x] **Scoring display — KPI tab (v3.10.4)**: `_openKPIScoreList()` replaces `openListModal` for KPI user drill-down. Columns: Auto/Champion/Tổng/Rank/Nhận xét. Unscored UCs show "chưa thực hiện chấm điểm". Rank chip with rank-color background. Commit `6f6f774`.
- [x] **Scoring display — detail popup (v3.10.4)**: `_renderDetailBody()` new "★ Đánh giá & Điểm số" section. Shows rank badge, Auto breakdown, Champion breakdown (chất lượng/giá trị KD/sáng tạo), reviewer, comment. `_normalizeFullData()` maps 7 score fields. Commit `6f6f774`.
- [x] **GAS listUseCases_ score fields (v3.10.4)**: `AdminService.gs` returns 5 new fields per UC: `review_comment`, `reviewer_email`, `quality_score`, `business_value_score`, `innovation_score`. Deployed by user. URL unchanged. Commit `6f6f774`.
- [x] **Review queue filter (v3.10.4)**: Filter bar on review-queue.html — search (250ms debounce), team dropdown (admin only), section pills, result counter. `_filterState`, `_applyFilters()`, `_bindFilters()` in review-queue.js. Commit `6f6f774`.
- [x] **Home page service cards (v3.10.4)**: PORTAL_SERVICES 2→8 items (2 sections); all role-appropriate; champion included in roles arrays; bug fix `role` undefined → `var userRole`. Commit `6f6f774`.
- [x] **Sidebar nav order (v3.10.4)**: "Trang chủ" first in sidebar on 7 pages; "Hệ thống" section removed. Commit `6f6f774`.
- [x] **Bugs fixed**: `.score-chip color:#fff`; dead code `var k = _cache(uc)`; PORTAL_SERVICES role bug; champion exclusion from portal. Commit `6f6f774`.

---

## ✅ Đã hoàn thành trong session 2026-06-18

- [x] **GAS-MYSTERY-01 CLOSED**: User tìm được đúng GAS project, deploy tất cả 9 files. URL giữ nguyên. GAS đã live với champion-review, user endpoints, UserService.gs, toàn bộ fixes.
- [x] **Fix champion role không lưu DB (v3.10.3)**: `UserService.gs _buildUserRow_` ternary `admin?'admin':'user'` → `(admin||champion)?normRole:'user'`. `validateUserLogin_` cùng fix cho login path. Root cause: silent downgrade — GAS trả `{success:true}` nhưng ghi 'user' vào sheet.
- [x] **Sidebar UI sync toàn bộ pages (v3.10.3)**:
  - `leaderboard.html` + `weekly-update.html`: thêm `navUsers` + `navReviewQueue` vào section Quản lý; xóa `navManagerReview`; thay inline `initAuth()`/`initSidebar()` bằng `AuthService.requireAuth()` + `populateSidebarUser()` + `setupNav()` → champion role hiển thị đúng label
  - `users.html` + `review-queue.html`: Pattern B → A sidebar brand ("Bình dân hóa AI / TT SPTD"); `nav role="menu"` → `role="menubar"`; thêm section label "Quản lý"; topbar class `topbar-user` → `topbar-user-chip`, `topbar-avatar` → `topbar-user-avatar`, `topbar-username` → `topbar-user-name`
- [x] **59/59 Playwright tests PASS** — sau tất cả fixes
- [x] **Commit `c4a53ec`** pushed to main — 5 files changed, 80 insertions/80 deletions

---

## ✅ Đã hoàn thành trong session 2026-06-17

- [x] **Champion role (v3.10.2)**: New role between admin and user. Role resolution: USERS sheet primary (Role=champion, Active=TRUE, Team set) → `APP_CONFIG.CHAMPION_USERS` FE fallback. `AuthService.isChampion()`, `isChampionOrAdmin()`, `requireChampionOrAdmin()` in auth.js. Commit `c6eca78`.
- [x] **Standalone users.html (v3.10.2)**: Separate admin-only page (not dashboard tab). Table render + add/edit modal + role color badges. `assets/js/users.js` (UsersPage IIFE). Commit `c6eca78`.
- [x] **Review queue page (v3.10.2)**: `review-queue.html` accessible to admin + champion. 3 sections: Chờ đánh giá (Submitted) / Đang review (Under Review) / Đã hoàn thành (Approved + scored). Slide-in review panel with Quality/BV/Innovation sliders, projected score display, rank chip. `assets/js/review-queue.js`. Champion filter: only shows team's UCs. Commit `c6eca78`.
- [x] **Scoring preview in register.html (v3.10.2)**: Live score ring + bar chart while filling wizard. Self-assessment sliders: BV + Innovation (0–10, default 5). Quality=0 (set by champion later). Slider values submitted with UC payload. `assets/js/scoring.js` (ScoringEngine client-side). Commit `c6eca78`.
- [x] **GAS: isChampionForTeam_() + submitChampionReview_()**: `AdminService.gs` additions. Authorization: admin OR champion for matching team. Calculates final score via `scoreUseCase_()`. Commit `c6eca78` (local only — NOT deployed yet).
- [x] **59/59 Playwright tests PASS**: 4 spec files across auth/users/review-queue/scoring-preview. JSONP mock via `page.route()`. Session inject via `page.addInitScript()`. Commit `c6eca78`.

---

## P0 — [UNBLOCKING] Champion end-to-end test after GAS deploy

After deploying GAS, test the full champion flow:
- [ ] Add champion row to USERS sheet: `Username=<username>`, `Role=champion`, `Active=TRUE`, `Team=<exact team name>`
- [ ] Login as champion → verify `navReviewQueue` visible, `navUsers` NOT visible, role label shows "Champion"
- [ ] Navigate to `review-queue.html` → verify only team's UCs appear in queues
- [ ] Click "Review" → slide-in panel opens → UC ID displayed correctly
- [ ] Set Quality slider to 8, BV to 7, Inn to 6 → projected score updates correctly
- [ ] Click submit → verify toast "Review đã được ghi nhận" + queue reloads
- [ ] Check MASTER sheet: `Quality_Score=8`, `Business_Value_Score=7`, `Innovation_Score=6`, `Total_Score` recalculated

---

## ✅ Đã hoàn thành trong session 2026-06-08

- [x] **KPI week navigation (v3.10.2)**: Nút ‹/› trong header cho phép xem lại KPI các tuần trước. "›" disabled khi đang ở tuần hiện tại. Label tự động "Tuần này" / "N tuần trước". Section title thay đổi theo tuần xem. `Dashboard._kpiNav(dir)` trong public API. Streak tính relative theo tuần đang xem. Commit `4e48d17`.
- [x] **KPI excluded users (v3.10.2)**: `KPI_EXCLUDED_USERS: ['cuongvm1']` trong `config/env.js`. `_buildKPIData()` skip excluded users tại tất cả paths (USERS sheet, byEmail fallback, byName fallback). Giám đốc Trung Tâm không xuất hiện trong bảng KPI.
- [x] **KPI Approved-only (v3.10.2)**: Filter đổi từ `!== 'Draft'` → `=== 'Approved'`. UC Rejected/Submitted/Under Review không tính KPI. Goal text: "1 UC được duyệt / người / tuần".
- [x] **FIX KPI-SPINNER-01 (v3.10.2)**: `_loadTabData('kpi')` render ngay với data có sẵn thay vì chờ `getUsers()`. `getUsers()` vẫn chạy background + re-render sau khi xong. Nav buttons xuất hiện ngay khi click tab.
- [x] **15/15 Playwright tests PASS** — verified trên local server.

---

## ✅ Đã hoàn thành trong session 2026-06-05 (Part 14)

- [x] **KPI tab — users với 0 UC (v3.10.1)**: `_buildKPIData()` rewrite: primary source `_usersList` (USERS sheet). Users chưa nộp UC hiện với badge "⏳ Chưa". Case-insensitive via `_norm()` (Tuantt4=TuanTT4=tuantt4 → 1 entry). Lazy load `Api.getUsers()` khi click KPI tab nếu chưa có; fail-silently → fallback `_allList`. "isMe" dùng `u.username === curUserKey`. 20/20 tests pass. Commit `e3c2922`.

---

## ✅ Đã hoàn thành trong session 2026-06-05 (Part 13)

- [x] **USERS sheet + User management (v3.10.0)**: GAS `UserService.gs` (new) với `normalizeUser_()` case-insensitive (Tuantt4=tuantt4=TUANTT4), `upsertUser_`, `syncUsersFromMasterData_`, `validateUserLogin_`. Login async (GAS validates role → local fallback). Dashboard tab "Người dùng" (admin-only): bảng users, modal add/edit, nút Đồng bộ. 30/30 Playwright tests PASS. Commit `cc8420c`.

---

## ✅ Đã hoàn thành trong session 2026-06-05 (Part 12)

- [x] **fix: KPI week range date format**: `toLocaleDateString('vi-VN')` trả về "01-06" thay vì "01/06" trên một số Chromium build. Fix dùng `padStart` thủ công, luôn ra `DD/MM`. Commit `91c4a00`.
- [x] **KPI & Tiến độ tab (v3.9.0)**: Tab mới hiển thị cho tất cả users. (1) Header bar tuần hiện tại + % đạt; (2) Bảng tiến độ tuần: mỗi user, highlight row của chính mình; (3) Bar chart KPI 6 tháng; (4) Bảng xếp hạng tổng; (5) Leaderboard streak chuỗi tuần. Logic: chỉ tính non-Draft UCs, tuần ISO Thứ 2→CN, strict streak (không UC tuần này = 0). Toàn bộ tính client-side từ _allList. Commit `afcdf44`.

---

## ✅ Đã hoàn thành trong session 2026-06-05 (Part 11)

- [x] **Stacked breakdown charts (v3.8.0)**: "Phân bổ theo Team" và "Phân bổ theo Lĩnh vực nghiệp vụ" nay hiển thị stacked bar phân màu theo 6 trạng thái (Approved/Under Review/Submitted/Draft/Rejected/Archived). Data tính client-side từ `_allList`. Click vào segment mở list popup lọc đúng team/category + status đó. CSS fallback hiện badge trạng thái dưới mỗi row. Commit `9e15471`.
- [x] **Tài liệu nhập liệu**: `HUONG_DAN_NHAP_LIEU.txt` — hướng dẫn đầy đủ 32 trường + lưu ý chung cho người dùng. Commit `9e15471`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 10)

- [x] **FIX HTTP 400 UPDATE workaround (v3.7.3)**: Root cause xác nhận qua URL thực tế: user_content_key trong googleusercontent redirect URL dài 10,000+ chars (GAS nhúng full merged object). FE fix: mở rộng _handleSubmitError để cả isScriptError ("script load thất bại") trigger auto-verify bằng getUseCase. Fix vĩnh viễn cần deploy GAS minimal response (UseCaseService.gs đã có trong repo). Commit `d52c756`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 9)

- [x] **FIX HTTP 400 Prompt_Context (v3.7.2)**: Root cause: tiếng Việt expand 4× sau base64url → GET URL vượt GAS ~8KB limit (CREATE); updateUseCase_ trả full merged object ~7000+ chars → JSONP redirect URL quá lớn (UPDATE). Fix: strip empty fields cho create payload, minimal update response ({record_id, usecase_id, updated_at}), đổi payload limit check sang post-encode 7500 chars. Commit `006bae5`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 8)

- [x] **FIX Timeout false-failure create/update (v3.7.1)**: Root cause: GAS đọc MASTER_DATA nhiều lần → execution >20s → FE timeout nhưng GAS vẫn ghi xong. Fix 3 lớp: (1) FE timeout tăng 20s→45s cho write ops; (2) smart recovery: update auto-verify bằng getUseCase, create hiện warning với hint ID; (3) GAS updateUseCase_ đọc MASTER 1 lần thay vì 2 bằng findRowByField_(). Commit `e83f16b`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 7)

- [x] **FIX Special chars toàn diện (v3.7.0)**: Tìm và fix 6 bugs trong encoding pipeline FE → GAS → Google Sheets. Bao gồm: formula injection (SPECIAL-02 HIGH), null byte save failure (SPECIAL-03 CRITICAL), JSON_Backup cell overflow (SPECIAL-05 CRITICAL), lone surrogate encode failure (SPECIAL-06 CRITICAL), CRLF normalization (SPECIAL-01/04 MINOR). Test: 62/62 pass. Commit `76b0242`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 6)

- [x] **FIX Duplicate UseCase_ID (v3.6.3)**: Chuyển gen mã từ page-load sang submit-time. FE gắn fresh ID hint vào payload; GAS `_assignUseCaseId_()` validate trong lock, dùng nếu còn free, fallback generate nếu collision. 8/8 local tests pass. Commit `3780bf6`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 5)

- [x] **BUG-CONFIRM-BTN (v3.6.2)**: Fix confirm button frozen sau approve/reject đầu tiên. Root cause: `disabled=true` chỉ reset trong `catch`, không reset trong success path. Fix 2 lớp: `openDetail()` + `_showActionArea()`. Commit `4bc33bc`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 4)

- [x] **BUG-AUTH-URL (v3.6.1)**: Fix URL duplicate `ai-usecase-platform` sau khi login khi truy cập trailing-slash URL. Fix 2 lớp: `auth.js` validate `.html` extension + `login.html` `safeReturnUrl()` helper. Commit `2a5a2af`.

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 3)

- [x] **Filter tab Tất cả (v3.6)**: Multi-select status pills + team dropdown + search kết hợp, count badge real-time
- [x] **Box Từ chối (v3.6)**: Rejected card trong tab Tổng quan, preview 5 UC + Xem tất cả list popup, Chi tiết đầy đủ

---

## ✅ Đã hoàn thành trong session 2026-06-03 (Part 2)

- [x] **Fix đồng bộ recentTable chi tiết (v3.5.1)**: Enrich recent_submissions từ _allList trước khi cache; openDetail safety net; DashboardService.gs fix tại nguồn

---

## ✅ Đã hoàn thành trong session 2026-06-03

- [x] **Drill-down list popup (v3.5)**: Click KPI cards / chart segments / chart bars → popup bảng use case lọc theo ngữ cảnh, mỗi row có nút "Chi tiết" mở detail modal chồng lên
- [x] **recentTable đồng bộ**: Thêm cột "Chi tiết" vào bảng "Nộp gần đây" (tab Tổng quan)

---

## ✅ Đã hoàn thành trong session 2026-06-02

- [x] BUG-GAS-01: URL sai → restore đúng URL
- [x] BUG-GAS-02: OAuth authorized
- [x] BUG-CSS-01: modal footer bị đẩy xuống khi nội dung dài
- [x] Auto-load tất cả tabs khi login (`_loadStartupData`)
- [x] Tab Khám phá (all approved UCs, searchable, all users)
- [x] Copy Prompt (8 fields, clipboard API + fallback)
- [x] Approve/Reject confirmed working end-to-end
- [x] **Unique UseCase ID (v3.4)**: `generateUseCaseId_()` sync MASTER_DATA + collision loop + `?action=next-id` preview endpoint + badge trên wizard form

---

## Quy trình deploy GAS chuẩn (bắt buộc đọc trước khi deploy)

**KHÔNG** nhấn "New Deployment" → URL thay đổi + mất OAuth + phải update `env.js`.

**Quy trình đúng:**
```
GAS Editor → Deploy → Manage Deployments
  → Chọn deployment đang dùng → Edit (bút chì)
  → Version: "New version" → Deploy
```
URL không đổi, không cần redo OAuth, không cần update `env.js`.
