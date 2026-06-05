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

## GAS-DEBT-01 — GAS local files chưa sync với deployed version (CRITICAL — 7 files pending)

**Mô tả:** 7 file GAS đã sửa/tạo local nhưng chưa deploy lên GAS Editor (blocked by GAS-MYSTERY-01):
- `UserService.gs` (NEW v3.10.0) — toàn bộ user management
- `Code.gs` (v3.10.0) — 5 user endpoints + next-id route
- `Config.gs` (v3.10.0) — SHEETS.USERS + USERS_HEADERS
- `Utils.gs` (v3.10.0) — sanitizeStr_ + toSheetValue_() + USERS support
- `UseCaseService.gs` (v3.7.1) — ID collision fix + timeout optimization
- `LookupService.gs` (v2.x) — rewrite
- `DashboardService.gs` (v3.5.1) — recent_submissions full fields

**Rủi ro:** Production GAS không có user management, không có formula injection protection, không có ID collision fix.

**Fix:** Resolve GAS-MYSTERY-01 trước. Sau đó paste 7 files → Edit deployment → New version → Deploy.

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

## GAS-MYSTERY-01 — GAS URL active không tìm thấy trong deployment history

**Mô tả:** URL `AKfycbwe0eo3X3KWxGdJ8ZWLjAgx3FVvcSOxTA5KVJGYVV3_Skbn0eXAVouzKaZOgDaDcUupew` đang hoạt động nhưng không xuất hiện trong GAS deployment history của user. Có thể thuộc GAS project khác (bị quên hoặc tạo từ lần deploy cũ).

**Rủi ro:** Nếu project đó bị xóa hoặc Google account mất access → toàn bộ backend down không khôi phục được; không thể update GAS code vì không biết project nào.

**Fix:** Duyệt tất cả GAS projects tại `script.google.com` → tìm deployment có URL trên → đổi tên + ghi chú. Xem TODO_NEXT P0.

---

---

## GAS-DEBT-03 — `DashboardService.gs` local fix chưa deploy (v3.6, 2026-06-03)

**Mô tả:** `computeDashboardSummary_()` đã được update local để push thêm `record_id`, `status`, `owner_name` vào `recent_submissions`. Chưa deploy vào GAS (vì GAS-MYSTERY-01).

**Ảnh hưởng:** `renderRecentTable` vẫn phải enrich từ `_allList` (FE workaround). Sau khi deploy GAS, FE workaround vẫn hoạt động bình thường (harmless double-key).

**Fix:** Paste `DashboardService.gs` vào GAS Editor sau khi resolve GAS-MYSTERY-01.

---

## FILTER-01 — `_populateTeamFilter` stale state sau refresh (v3.6, 2026-06-03)

**Mô tả:** Khi refresh data, `_populateTeamFilter()` re-render options nhưng không sync `_filterAll.team` với giá trị thực của `<select>`. Nếu team đang chọn bị xóa khỏi list mới (UC của team đó bị xóa/archive) → dropdown về option đầu nhưng `_filterAll.team` vẫn giữ giá trị cũ → filter sai.

**Fix (1 dòng):** Thêm sau `teamSel.innerHTML = ...` trong `_populateTeamFilter()`:
```js
_filterAll.team = teamSel.value; // sync state với DOM value sau re-render
```

**File:** `assets/js/dashboard.js` — hàm `_populateTeamFilter`

---

## GAS-DEBT-04 — `UseCaseService.gs` v3.6.3 chưa deploy (2026-06-03)

**Mô tả:** `_assignUseCaseId_(hint)` và `_ensureCounterAhead_()` — 2 hàm mới xử lý ID hint từ FE trong LockService scope — chỉ tồn tại local. GAS deployed hiện tại vẫn dùng `generateUseCaseId_()` trực tiếp trong `createUseCase_()`, bỏ qua hint.

**Ảnh hưởng:** FE gửi `UseCase_ID` hint trong payload nhưng GAS cũ ignore → fallback về generate server-side (không tệ hơn trước, nhưng chưa đạt full fix race condition).

**Fix:** Paste `UseCaseService.gs` vào GAS Editor sau khi resolve GAS-MYSTERY-01 → deploy new version.

---

## PERF-02 — `_loadTabData('my')` vẫn fetch API riêng sau startup

**Mô tả:** Sau khi `_loadStartupData()` đã populate `_myList`, user click tab "My Cases" vẫn gọi `_loadMyUseCases()` (không có guard) → thêm 1 API request không cần thiết.

**Hiện tại:** Harmless về functionality, chỉ lãng phí 1 request mỗi lần click.

**Fix:** Thêm guard `if (_myList.length === 0)` vào `_loadTabData` case 'my'. File: `assets/js/dashboard.js` dòng `} else if (tab === 'my') {`.

---

## GAS-DEBT-05 — `Utils.gs` + `UseCaseService.gs` v3.7.0 chưa deploy (2026-06-03)

**Mô tả:** 6 bug fixes ký tự đặc biệt (v3.7.0) đã merge vào `Utils.gs` và `UseCaseService.gs` nhưng chưa deploy lên GAS vì GAS-MYSTERY-01 chưa resolved.

**Ảnh hưởng khi chưa deploy:**
- Formula injection (SPECIAL-02): giá trị bắt đầu `=` có thể bị Sheets interpret làm formula → data corruption
- Null byte (SPECIAL-03): nếu ai paste text có `\0` → `setValues` fail → save failure
- JSON_Backup overflow (SPECIAL-05): form fill đầy nhiều field dài → `setValues` throw → save failure

**Fix:** Paste `Utils.gs` và `UseCaseService.gs` (v3.7.0) vào GAS Editor sau khi resolve GAS-MYSTERY-01 → deploy new version.

---

## DEAD-CODE-01 — `renderBreakdownChart` + `_renderBreakdownChartCSS` không còn được gọi (2026-06-05)

**Mô tả:** Hai hàm này bị thay bởi `renderStackedChart` + `_renderStackedChartCSS` cho team/category charts (v3.8.0). Hàm cũ vẫn còn trong `dashboard.js` nhưng không có call site nào.

**Rủi ro:** Dead code tăng kích thước file, gây nhầm lẫn khi đọc.

**Fix:** Xóa `renderBreakdownChart` và `_renderBreakdownChartCSS` (khoảng 25 dòng). CSS fallback vẫn hoạt động qua `_renderStackedChartCSS` và các public API `Dashboard._openListByTeam/Category` không thay đổi.

---

## KPI-SPINNER-01 — KPI tab không có loading spinner khi lazy-fetch users (v3.10.1, 2026-06-05)

**Mô tả:** Khi user click tab KPI lần đầu và `_usersList` chưa có, `_loadTabData('kpi')` gọi `Api.getUsers()` trước khi render. Trong thời gian GAS trả lời (~0.5–2s), tab KPI hiển thị nội dung cũ (hoặc trống). Không có spinner/loading state.

**Rủi ro:** Cosmetic — user có thể nghĩ tab bị lỗi nếu GAS chậm.

**Fix:** Thêm `container.innerHTML = '<div class="empty-state"><p>Đang tải...</p></div>'` ở đầu branch `if (!_usersList.length)` trong `_loadTabData('kpi')`. File: `assets/js/dashboard.js`.

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
