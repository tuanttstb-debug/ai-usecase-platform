# TECH DEBT

Các vấn đề kỹ thuật đã biết, chưa ưu tiên xử lý ngay.

---

## SEC-01 — Không có xác thực thật (CRITICAL)

**Mô tả:** Login bằng username tự nhập, không verify. Bất kỳ ai biết username admin đều có thể login với role admin.

**Hiện trạng (v3.10):** Login nay gọi GAS `?action=user-login` → USERS sheet là nguồn truth cho role. Tuy nhiên không có password/token — ai biết username admin vẫn login được. USERS sheet chỉ giải quyết role management, không giải quyết identity verification.

**Rủi ro:** Ai biết username "tuantt4" → vào được dashboard admin.

**Fix đề xuất:** Google Sign-In (`google.accounts.oauth2`) → xác thực Google account thật → so sánh email với USERS sheet. Pending PO decision.

---

## SEC-02 — Thiếu Content-Security-Policy header

**Mô tả:** Không có CSP → XSS attack surface rộng hơn cần thiết.

**Fix:** Thêm `<meta http-equiv="Content-Security-Policy">` vào tất cả HTML pages.

---

## MAINT-01 — JS global variables, không dùng ES Modules

**Mô tả:** Toàn bộ JS dùng IIFE + global `var` (App, Wizard, Dashboard, AuthService...). Không có bundler, không có import/export. Thứ tự load script trong HTML phải đúng thủ công.

**Rủi ro:** Naming collision nếu thêm script mới; khó test từng module độc lập.

**Fix:** Migrate sang ES Modules (`type="module"`). Non-trivial — cần refactor toàn bộ codebase.

---

## MAINT-02 — Script load order không được enforce

**Mô tả:** Script load order (`env.js → auth.js → routes.js → ...`) được ghi trong comment và docs nhưng không có runtime check. Nếu sai thứ tự → silent bug.

**Fix:** Thêm guard ở đầu mỗi script: `if (typeof APP_CONFIG === 'undefined') throw new Error('env.js must load first')`.

---

## ~~GAS-DEBT-01~~ — CLOSED (2026-06-18)

All 9 GAS files deployed. GAS-MYSTERY-01 resolved. URL unchanged.

---

## GAS-DEBT-02 — CONFIG sheet override Config.gs không có documentation rõ

**Mô tả:** `getAdminEmails_()` đọc CONFIG sheet row `ADMIN_EMAILS` trước khi fallback về constant trong `Config.gs`. Đây là feature hữu ích nhưng gây confusion khi debug (fix code không có tác dụng vì sheet override).

**Fix:** Thêm comment rõ trong `AdminService.gs`; document trong README.

---

## PERF-01 — JSONP request mỗi lần mở detail modal

**Mô tả:** `openDetail` gọi `Api.getUseCase(record_id)` mỗi lần mở modal — 1 JSONP request. Không cache.

**Hiện tại:** Acceptable với traffic thấp.

**Fix nếu cần:** Cache `_ucCache[key]` với full data sau lần fetch đầu tiên; bỏ qua fetch nếu đã có.

---

## PORTAL-CSS-01 — portal.css còn references tới `.portal-header` (unused)

**Mô tả:** `portal.css` có responsive rules cho `.portal-header` nhưng `index.html` đã chuyển sang `.app-layout` sidebar. Rules này harmless nhưng dead code.

**Fix:** Xóa `.portal-header` rules khỏi `portal.css`.

---

## ~~GAS-MYSTERY-01~~ — CLOSED (2026-06-18)

User found the correct GAS project. All files deployed. URL unchanged: `AKfycbypN8afAl2zQwpR7K6k1-699g3HAhFAIqAOtDn3qY1nJWzuN1bd8n99bzRUzaV8ZMyTCw`

---

---

## ~~GAS-DEBT-03~~ — CLOSED (2026-06-18, deployed)

---

## FILTER-01 — `_populateTeamFilter` stale state sau refresh (v3.6, 2026-06-03)

**Mô tả:** Khi refresh data, `_populateTeamFilter()` re-render options nhưng không sync `_filterAll.team` với giá trị thực của `<select>`. Nếu team đang chọn bị xóa khỏi list mới (UC của team đó bị xóa/archive) → dropdown về option đầu nhưng `_filterAll.team` vẫn giữ giá trị cũ → filter sai.

**Fix (1 dòng):** Thêm sau `teamSel.innerHTML = ...` trong `_populateTeamFilter()`:
```js
_filterAll.team = teamSel.value; // sync state với DOM value sau re-render
```

**File:** `assets/js/dashboard.js` — hàm `_populateTeamFilter`

---

## ~~GAS-DEBT-04~~ — CLOSED (2026-06-18, deployed)

---

## PERF-02 — `_loadTabData('my')` vẫn fetch API riêng sau startup

**Mô tả:** Sau khi `_loadStartupData()` đã populate `_myList`, user click tab "My Cases" vẫn gọi `_loadMyUseCases()` (không có guard) → thêm 1 API request không cần thiết.

**Hiện tại:** Harmless về functionality, chỉ lãng phí 1 request mỗi lần click.

**Fix:** Thêm guard `if (_myList.length === 0)` vào `_loadTabData` case 'my'. File: `assets/js/dashboard.js` dòng `} else if (tab === 'my') {`.

---

## ~~GAS-DEBT-05~~ — CLOSED (2026-06-18, deployed)

---

## DEAD-CODE-01 — `renderBreakdownChart` + `_renderBreakdownChartCSS` không còn được gọi (2026-06-05)

**Mô tả:** Hai hàm này bị thay bởi `renderStackedChart` + `_renderStackedChartCSS` cho team/category charts (v3.8.0). Hàm cũ vẫn còn trong `dashboard.js` nhưng không có call site nào.

**Rủi ro:** Dead code tăng kích thước file, gây nhầm lẫn khi đọc.

**Fix:** Xóa `renderBreakdownChart` và `_renderBreakdownChartCSS` (khoảng 25 dòng). CSS fallback vẫn hoạt động qua `_renderStackedChartCSS` và các public API `Dashboard._openListByTeam/Category` không thay đổi.

---

## ~~KPI-SPINNER-01~~ — CLOSED (2026-06-08, v3.10.2)

**Đã fix:** `_loadTabData('kpi')` nay render ngay với `_allList` hiện có; `getUsers()` chạy background + re-render sau khi xong. Tab KPI xuất hiện ngay khi click, không còn blank.

---

## KPI-APPROVED-01 — "% đạt" giảm đột ngột sau v3.10.2 (2026-06-08)

**Mô tả:** v3.10.2 đổi KPI filter từ `status !== 'Draft'` → `status === 'Approved'`. UC đang chờ duyệt (Submitted/Under Review) không còn tính KPI. Users nộp UC trong tuần nhưng chưa được admin duyệt sẽ thấy "⏳ Chưa" thay vì "✓ Đạt" cho đến khi UC được approve.

**Rủi ro:** UX — user nộp xong có thể thấy mình "chưa đạt" dù đã nộp. Behavior này là intentional theo yêu cầu ("chỉ theo dõi UC được duyệt") nhưng có thể gây nhầm lẫn.

**Mitigation nếu cần:** Thêm cột "Đã nộp (chờ duyệt)" vào bảng KPI để user thấy trạng thái trung gian. Hiện tại chưa implement.

---

## KPI-PCT-01 — pctAchieved denominator thay đổi sau v3.10.1 (2026-06-05)

**Mô tả:** Trước v3.10.1, mẫu số pctAchieved = số users có UC (tất cả đều ≥1 UC nên % cao). Sau v3.10.1, mẫu số = tất cả active users trong USERS sheet (bao gồm users 0 UC) → % thấp hơn và chính xác hơn. Có thể gây "sốc" nếu team nhìn thấy % giảm đột ngột.

**Rủi ro:** UX/communication. Không phải bug — là correct behavior.

**Action nếu cần:** Thêm tooltip giải thích "X/Y users đã nộp ≥1 UC trong tuần này".

---

## DATA-LIMIT-01 — `_allList` và `_pendingList` giới hạn 200 records

**Mô tả:** `listUseCases` default limit=200. `_pendingList` được derive client-side từ `_allList`. Khi tổng số UC > 200:
- Tab "Chờ duyệt" có thể thiếu UC pending nằm sau row 200
- Tab "Khám phá" có thể thiếu UC Approved cuối list
- Box "Từ chối" có thể thiếu rejected UC

**Hiện tại:** Chấp nhận được với data volume hiện tại (< 200 UC).

**Fix dài hạn:** Implement pagination hoặc tăng limit + infinite scroll.

**Note (2026-06-05):** KPI tab (`_buildKPIData`, `_computeStreak`, `_buildMonthlyKPI`) cũng iterate trên `_allList` → weekly stats, streak, ranking sẽ thiếu data của UC nằm ngoài top 200 khi total > 200.

---

## USER-OFFLINE-01 — Active=FALSE không được enforce khi GAS offline (v3.10.0, 2026-06-05)

**Mô tả:** Khi GAS không available, `login.html` fallback về `AuthService.login()` (local). Local login chỉ check username trong `APP_CONFIG.ADMIN_EMAILS` để xác định role — không check `Active` trong USERS sheet. Người dùng bị deactivate (`Active=FALSE` trong USERS sheet) vẫn có thể login nếu GAS đang offline.

**Rủi ro:** Thấp trong thực tế (GAS ít khi offline), nhưng là security gap tiềm ẩn.

**Fix:** Sau khi login fallback local thành công, store một flag `via_fallback: true` trong session. Khi GAS online trở lại (next page load), re-validate và force logout nếu Active=FALSE. Hoặc đơn giản hơn: implement real auth (Google OAuth) thay local fallback.

**File:** `assets/js/auth.js` — `login()` method và `login.html` catch handler.

---

## USERS-CACHE-01 — Tab Người dùng không tự refresh sau approve/reject (v3.10.0, 2026-06-05)

**Mô tả:** Khi admin approve/reject UC trong detail modal, `_loadStartupData()` được gọi lại để refresh data. Tuy nhiên `_loadUsersTab()` không được gọi lại → nếu admin đang ở tab Người dùng trong một session khác và approve UC, `Last_Login` trong bảng Users sẽ không cập nhật ngay.

**Rủi ro:** Cosmetic only — data vẫn đúng trong sheet, chỉ UI bị stale cho đến khi admin click lại tab.

**Fix:** Thêm `if (currentTab === 'users') _loadUsersTab()` vào `_bindRefresh` handler. File: `assets/js/dashboard.js`.

---

## CHAMPION-01 — `isChampionForTeam_()` O(n) scan USERS sheet per request (v3.10.2, 2026-06-17)

**Mô tả:** `isChampionForTeam_()` trong `AdminService.gs` gọi `getAllUsers_()` và loop qua toàn bộ USERS sheet mỗi lần có `champion-review` request. Không có caching.

**Rủi ro:** Thấp với <100 users. Nếu USERS sheet phát triển lên vài trăm rows, mỗi review request thêm latency đáng kể.

**Fix nếu cần:** Cache kết quả `getAllUsers_()` với `CacheService` trong GAS (expiry 5 phút), hoặc dùng indexed lookup (Map từ email → user object) trong cùng execution context.

**File:** `assets/gas-backend/AdminService.gs` — `isChampionForTeam_()`

---

## CHAMPION-02 — Team name must match exactly between USERS sheet and MASTER_DATA (v3.10.2, 2026-06-17)

**Mô tả:** `isChampionForTeam_()` compare lowercase của `u.Team` (USERS sheet) với lowercase của `existing.Team` (MASTER sheet). Comparison là case-insensitive nhưng nếu có typo ("Team Số" vs "Team So") → champion thấy UCs trong filter (FE dùng `user.team` từ session) nhưng GAS reject khi submit review vì MASTER team không khớp với USERS team.

**Rủi ro:** Champion có thể mở panel, điền điểm, submit → nhận lỗi "Không có quyền champion review cho team: X" vì tên team trong MASTER có dấu còn USERS không (hoặc ngược lại).

**Fix:** Normalize team names khi nhập liệu. Admin nên copy-paste tên team từ MASTER_DATA vào USERS sheet thay vì gõ tay.

---

## CHAMPION-03 — Self-assessment scores overwritten by champion review (v3.10.2, 2026-06-17)

**Mô tả:** Khi user submit UC, `Business_Value_Score` và `Innovation_Score` từ sliders (self-assessment) được ghi vào MASTER sheet. Khi champion review, `submitChampionReview_()` ghi lại `Business_Value_Score` và `Innovation_Score` với giá trị champion chọn, overwriting giá trị user tự đánh giá. Không có audit trail "user nói X, champion nói Y".

**Rủi ro:** Nếu cần so sánh self-assessment vs champion assessment (e.g. cho governance report), dữ liệu đã mất.

**Fix nếu cần:** Thêm columns `User_BV_Self` và `User_Inn_Self` vào MASTER_DATA để lưu riêng giá trị user nhập. Chỉ cần khi có yêu cầu governance/audit. Hiện tại chưa cần.

---

## PLAYWRIGHT-01 — Hardcoded Windows path + Python http.server in playwright.config.js (v3.10.2, 2026-06-17)

**Mô tả:** `playwright.config.js` có `cwd: 'D:\\Công việc\\Vibecode\\...'` hardcoded Windows path. `webServer.command` dùng `python -m http.server 8787` (Python 3 only, không HTTPS, không keep-alive headers).

**Rủi ro:** Tests sẽ fail trên bất kỳ máy nào khác (khác user/path), và sẽ fail trong CI/CD environment.

**Fix khi cần CI/CD:** Dùng `path.resolve(__dirname)` thay hardcoded path; thay `python -m http.server` bằng `npx serve -s . -l 8787` (cross-platform, có proper MIME types).

**File:** `playwright.config.js` — `webServer.cwd` và `webServer.command`.

---

## SCORE-DETAIL-01 — `getUseCase` endpoint chưa verified trả score sub-components (v3.10.4, 2026-06-18)

**Mô tả:** `_renderDetailBody()` đọc `quality_score`, `business_value_score`, `innovation_score` từ kết quả `_fetchFullDetail()` (gọi `getUseCase` endpoint). Chưa xác nhận GAS `getUseCase` trả các field này — nếu không, champion breakdown grid trong detail popup sẽ hiển thị 0/10 cho cả 3 thành phần.

**Note:** Score list popup trong KPI tab dùng `_allList` (từ `listUseCases_`) — đã có 5 score fields mới — nên hiển thị đúng. Chỉ champion breakdown trong detail popup bị ảnh hưởng.

**Fix:** Check `getUseCase` response in GAS. Nếu thiếu → thêm 3 fields vào response object trong `UseCaseService.gs` `getUseCase_()` → deploy new version.

**File:** `assets/gas-backend/UseCaseService.gs` — `getUseCase_()` return object.

---

## NAV-01 — `manager-review.html` sidebar còn "Hệ thống" section + Trang chủ không ở đầu (v3.10.4, 2026-06-18)

**Mô tả:** `manager-review.html` là trang duy nhất chưa được cập nhật theo sidebar Pattern A trong session 2026-06-18 Part 2. Vẫn có "Hệ thống" section divider + label; "Trang chủ" không ở vị trí đầu tiên.

**Rủi ro:** Thấp — trang này ít được truy cập. Nhưng tạo inconsistency.

**Fix:** Áp dụng cùng sidebar pattern như 7 trang khác đã được update.

**File:** `manager-review.html` — `<nav role="menubar">` section.

---

## DEAD-CODE-02 — `debug_sidebar.js` untracked file trong repo root (2026-06-18)

**Mô tả:** File `debug_sidebar.js` tồn tại trong repo root nhưng không được tracked bởi git (untracked). Nội dung không rõ.

**Fix:** Kiểm tra nội dung → nếu là debug/temp script thì xóa hoặc thêm vào `.gitignore`.
