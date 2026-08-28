# TECH DEBT

Các vấn đề kỹ thuật đã biết, chưa ưu tiên xử lý ngay.

---

## UC-DETAIL-DUP-01 — dashboard.js chưa dùng chung uc-detail-view.js (2026-08-28)
CR review-panel (Mục tiêu 2) tách bộ render chi tiết UC ra **module dùng chung `assets/js/uc-detail-view.js`** (`UCDetailView.render/normalize/hasPrompt/copyPrompt`) cho `review-queue` dùng. Nhưng `dashboard.js` **vẫn giữ bản `_renderDetailBody` + `_normalizeFullData` + helpers riêng** (không refactor để giảm blast radius phiên này) → **trùng lặp logic render** ở 2 nơi; sửa layout chi tiết phải sửa 2 chỗ. **Hướng:** cho `dashboard.js` gọi `UCDetailView.render` (mục Điểm US/nút duyệt vẫn ở dashboard vì gắn action), gỡ bản nhân bản. Ưu tiên thấp — 2 bản hiện đồng bộ (cùng nguồn copy).

## WEEKLY-PROMPT-01 — Cập nhật prompt/luồng ở tuần: "để trống giữ nguyên" (2026-08-28)
Mục tiêu 1: prompt/luồng chỉ gửi khi user **mở accordion** (`_promptTouched`) VÀ đã prefill (`_fullDetailLoaded`) → an toàn không ghi đè rỗng. Hệ quả cố ý: nếu user mở accordion rồi **xóa trắng 1 ô** và gửi → ghi đè MASTER thành rỗng (đúng ý "sửa"). Không có xác nhận diff trước khi ghi. Snapshot WEEKLY_LOG giữ lịch sử nên hồi phục được. **Nếu cần**: thêm cảnh báo khi ô prefill-có-giá-trị bị xóa trắng. Ưu tiên thấp.

## WRITE-TRANSPORT-01 — Đường iframe-POST create/update chưa xác định vì sao hỏng trên live (2026-08-26)

**Bối cảnh (CR#1):** Đăng ký US báo "timeout" + không ghi. Truy gốc LIVE: **không US nào ghi được từ ~16/08** (đúng mốc v3.15.0 chuyển create/update sang **hidden-iframe POST**), nhưng **backend create OK** (probe payload hợp lệ qua **GET-JSONP** → ghi thành công `AIUS-0337`). `_submitViaPost` không đọc được response iframe → mọi lỗi bị che thành "Timeout".

**Đã sửa (v3.16.0):** transport **HYBRID** (`Api._writeHybrid`) — ưu tiên **GET-JSONP** (payload ≤7500, đọc được lỗi thật) cho đa số US; **fallback iframe-POST khi payload >7500** (link demo dài). Đa số ca đăng ký nay dùng đường GET đã-proven.

**Còn tồn (thấp, residual):**
- **Chưa xác định 100% vì sao iframe-POST không hoàn tất write trên live** (curl không tái hiện được vì Google trả interstitial cho client không-phải-browser + 411 khi redirect POST). Cần **reproduce trong browser thật** (Claude-in-Chrome, cần [TT] cấp tài khoản test) để soi doPost nhận payload/CSP/redirect.
- **Ca payload >7500** (link demo cực dài) vẫn đi iframe-POST → nếu POST hỏng thật thì ca hiếm này *có thể* còn lỗi. Giảm nhẹ: nay `_handleSubmitError` hiện **cảnh báo rõ + mã dự kiến** thay vì im lặng. Nếu cần đóng hẳn: nâng ngưỡng GET (rủi ro URL-limit) HOẶC sửa dứt điểm doPost.
- **Guard `Owner_Email`** (app.js) là vá phòng thủ: FE `Validator.all` không kiểm `Owner_Email` dù server REQUIRED_FIELDS_CREATE bắt buộc — đã inject từ session + chặn sớm nếu thiếu.

## SHEET-SPAM-01 — GAS sinh nhiều sheet rỗng "SheetN" (2026-08-26) — ĐÃ VÁ PHÒNG THỦ

**Triệu chứng:** [TT] thấy GG Sheet sinh liên tục sheet rỗng tên mặc định (đến "Sheet65").
**Gốc:** Toàn backend chỉ có 1 chỗ tạo sheet — `Utils.gs getOrCreateSheet_` → `ss.insertSheet(sheetName)`.
Nếu `sheetName` rỗng/undefined, `insertSheet()` đặt tên mặc định 'SheetN' và `getSheetByName(undefined)`
không bao giờ khớp → **mỗi request lại đẻ 1 sheet mới** (counter toàn cục nên số tăng dần).
Trong repo mọi lời gọi đều truyền `SHEETS.*` hợp lệ → nguyên nhân gần chắc là **DEPLOY LỆCH**:
code (ScoringServiceH2/Code) tham chiếu `SHEETS.UC_REUSE`/`PERSONAL` mà `Config.gs` đang deploy là bản
CŨ thiếu key → `SHEETS.X = undefined`. `ensureScoringH2Sheets_()` chạy ở đầu mọi route chấm điểm → đẻ sheet.
**Vá (repo):** (1) `getOrCreateSheet_` **ném lỗi rõ** khi sheetName rỗng/undefined (không tạo sheet mặc định).
(2) Hàm dọn `cleanupEmptyDefaultSheets()`/`dryRunCleanupEmptySheets()` (chạy tay GAS Editor) xóa sheet
'SheetN' rỗng (an toàn: không đụng tên nghiệp vụ, không xóa sheet cuối).
**[TT] cần:** redeploy **TẤT CẢ** .gs cùng lúc (đảm bảo Config.gs mới nhất → SHEETS đủ key + guard active),
rồi chạy `cleanupEmptyDefaultSheets()` dọn 65 sheet rác. Sau redeploy đủ, lỗi không tái phát.

---

## H1-CLEANUP-01 — Dọn dẹp mô hình H1 (2026-08-26) — ĐÃ GỠ, GIỮ GHI CHÚ Ở archive/h1

**Đã làm:** tách toàn bộ dấu vết H1 khỏi code chạy → `archive/h1/` (README giải thích H2 thay H1). Gỡ: routes GAS `manager-review`/`champion-review`/`score-recalc`/`rank-recalc`; hàm `submitManagerReview_`/`submitChampionReview_`; toàn bộ `ScoringEngine.gs` (auto-score 70/30) + mọi call `scoreUseCase_`; tab/CSS-JS SPTD ở dashboard; FE `scoring.js`/`sptd-scoring.js`/`manager-review.html`; test/HDSD/capture H1.

**Còn tồn (nhẹ, không chặn):**
- **[TT] redeploy GAS** để áp việc gỡ (routes + ScoringEngine + call site). Trước khi redeploy, GAS live cũ vẫn có route H1 (vô hại, FE không gọi).
- **Thay đổi hành vi (chủ đích):** cập nhật tuần → milestone CHỈ theo đổi stage (bỏ "auto-score tăng"). Nếu [TT] muốn giữ cơ chế milestone-theo-điểm thì cần thiết kế lại trên nền H2 (không dùng auto-score H1).
- **CSS lớp `.sptd-*`** trong `dashboard.css` còn (dead, vô hại) — gỡ dần nếu muốn gọn.
- **Role `champion`**: shim `champion→teamlead` giữ ở `auth.js` (tương thích session/dữ liệu cũ) — giữ, không phải nợ.
- Trường `Auto_Score`/`Manual_Score` trong MASTER_DATA nay không được ghi mới (UC mới để trống → hội đồng H2 ghi `Total_Score`). Không xóa cột (tương thích dữ liệu cũ).

## SCORING-H2-MONTHLY-01 — Nợ nhẹ sau CR chấm điểm theo tháng (2026-08-26)

- **Nguồn nhập `Evidence_Link` (EVD ổ share) CHƯA có** — panel cá nhân chỉ **hiển thị** cột `Evidence_Link` (đọc-only); chưa có nơi để member/teamlead nhập link. Backend đã hỗ trợ nhận `Evidence_Link` trong `personal-score-submit` (giữ giá trị cũ nếu không gửi). **Hướng:** khi [TT] chốt nguồn (member tự nhập ở đâu / link cố định theo team) → thêm 1 input ghi vào cột này. (CR#4 chủ đích chỉ hiển thị.)
- **KPI khác (khóa học/lan tỏa/milestone) lưu lặp trên mỗi dòng tháng**, backend đọc **dòng tháng mới nhất** ("nhập 1 lần, mới nhất áp dụng"). Nếu sau này cần lịch sử theo tháng cho các mục này → tách sang bản ghi period riêng. Ưu tiên thấp.
- **Dòng `PERSONAL_SCORE` cũ (trước CR)** có `Month` rỗng → `_normMonthLabel_('')=''`, `_monthKey_=0`; vẫn tính là 1 "tháng đã chấm" (tương thích ngược, không mất điểm). Nếu muốn gắn kỳ cho dữ liệu cũ → migration set `Month` (không bắt buộc).
- **Migration cột:** cần chạy `setupScoringH2Sheets()` sau deploy để thêm `Month` + `Evidence_Link` vào `PERSONAL_SCORE` (idempotent; append cột, đọc theo header-name nên vị trí không ảnh hưởng).

## SCORING-H2-RESIDUAL-01 — Nợ dọn dẹp sau Giai đoạn 3 (2026-08-25) — PHẦN LỚN ĐÃ DỌN

**Đã dọn (2026-08-25):**
- ✅ **Playwright 03/04/06 rewrite** theo model mới: `03` hội đồng chấm 3 tiêu chí + tiến độ n/4; `04` ScoringH2 fixture (`tests/scoring-h2-test.html`) thay ScoringEngine cũ; `06` leaderboard KPI tabs + PM card + SPTD-tab-hidden. **42/42 PASS** (03+04+06). Unit `test-scoring-h2.js` 62/62.
- ✅ **Register auto-score preview GỠ:** bỏ `scoring.js` include + panel `#scoringPreview` (ring/bars/self-assessment) khỏi `register.html`; gỡ `_updateScoringPreview`/`_bindScoringPreview` + inject BV/Innovation khỏi `app.js`.
- ✅ **Breakdown 70/30 DỌN** ở chỗ user thấy: `leaderboard.html` detail modal + `dashboard.js` KPI drill-down (`_openKPIScoreList`) + detail popup (`_renderDetailBody`) → hiển thị **Điểm US (hội đồng) /100** thay Auto/Champion (rank tính inline `_dsRankOf` vì dashboard không chắc có ScoringEngine).

**Còn tồn (thấp):**
- **dashboard.js SPTD code** (`_renderSPTDMyUCs` + bảng SPTD leaderboard, cột Auto/70·Champion/30) còn nguyên nhưng **sau tab SPTD đã ẩn** → dormant, không reachable. Xóa hẳn khi chắc không cần đối chiếu.
- **`scoring.js`** vẫn được `dashboard.html`/`review-queue`(cũ đã đổi)/... include ở vài trang — vô hại; gỡ dần.
- **`champion-review` route + `ScoringEngine.gs` auto-score** giữ lại (không route mới trỏ tới); gỡ khi ổn định.
- **A3 (PM milestone Action Plan)** vẫn nhập tay — nối tự động từ SHTD/hub `binh-dan-hoa-ai-H2` sau. Ưu tiên thấp.

## SCORING-H2-AUTH-01 — Council/personal auth tin token FE hoặc reviewer_email (2026-08-25)

**Mô tả:** `submitCouncilScore_`/`submitPersonalScore_` xác định reviewer qua `_resolveReviewer_`: ưu tiên `token` (HMAC verify server-side) → **fallback `reviewer_email`** (không verify) nếu thiếu token, giống pattern `approve/reject`/`champion-review` sẵn có. Nếu client cố tình bỏ token + giả `reviewer_email` = 1 council/teamlead khác → có thể mạo danh. Rủi ro thấp (nội bộ, đã đăng nhập; FE luôn gửi token). **Hướng:** siết bắt buộc token cho các thao tác ghi điểm (bỏ fallback) khi toàn hệ đã dùng token ổn định. Ưu tiên thấp.

---

## USERMASTER-CONCURRENCY-01 — 2 GAS project ghi chung sheet User_Master (H2, 2026-08-17) — GIẢM MẠNH 2026-08-18

**Mô tả:** Auth H2 cho AI US đọc/ghi `User_Master` trên spreadsheet SHTD. Lock `LockService.getScriptLock()` chỉ **per-project** — không loại trừ lẫn nhau giữa 2 GAS project khi cùng ghi.

**Cập nhật 2026-08-18 (dọn rác):** AI US đã **gỡ mọi thao tác GHI user** (userUpsert/reset/sync removed) — quản lý user chỉ làm ở SHTD. Đường ghi User_Master từ AI US chỉ còn `authChangePassword_` (user tự đổi mật khẩu, ghi đúng 1 cell Password_Hash của chính mình). Rủi ro concurrency **gần như triệt tiêu**.

**Rủi ro:** Rất thấp. Có thể để mở hoặc đóng.

**File:** `assets/gas-backend/AuthTokenService.gs` (`authChangePassword_`).

---

## CHAMPION-TERM-01 — review-queue.js còn dùng thuật ngữ "champion" (H2, 2026-08-17)

**Mô tả:** H2 đổi role `champion` → `teamlead`. `auth.js` giữ alias (isChampion→isTeamlead, requireChampionOrAdmin→requireTeamleadOrAdmin) nên các trang cũ chạy được, nhưng `review-queue.js` (+ route GAS `champion-review`, `submitChampionReview_`) vẫn dùng tên champion nội bộ. Fixtures test cũng còn role `champion`.

**Rủi ro:** Thấp — chạy đúng nhờ alias. Chỉ là nợ thuật ngữ/độ rõ ràng.

**Fix đề xuất:** Dọn khi rewrite scoring (Item 3): đổi review-queue + route + fixtures sang teamlead, bỏ alias champion.

**File:** `assets/js/review-queue.js`, `assets/gas-backend/AdminService.gs` (`submitChampionReview_`), `tests/helpers.js`.

---

## USERS-LEGACY-01 — Sheet USERS nội bộ — ✅ CLOSED 2026-08-18

**Mô tả (đã đóng):** Nguồn user chuyển hẳn sang `User_Master`. Phiên 2026-08-18 (dọn rác) đã **xóa** `UserService.gs` + `MigrationService.gs` + `FixOwnerNameMigration.gs`, bỏ `SHEETS.USERS`/`USERS_HEADERS`, gỡ route `user-login`/`user-init`/`user-upsert`/`user-reset-password`/`user-sync`, bỏ Priority-1b USERS-nội-bộ trong `getAdminEmails_`. `normalizeUser_` chuyển sang `Utils.gs`. Nguồn user DUY NHẤT = User_Master (SHTD); AI US chỉ ĐỌC. Commit `97939fd`.

**Còn lại:** Cần **redeploy GAS** để bản gỡ có hiệu lực live.

---

## ADMIN-FALLBACK-INERT-01 — env.js ADMIN_EMAILS không còn được FE đọc (2026-08-18)

**Mô tả:** Sau khi gỡ `AuthService.login()`/`_resolveRole`, FE resolve role 100% từ token User_Master. `APP_CONFIG.ADMIN_EMAILS` (env.js) giữ lại theo yêu cầu "fallback tối thiểu" nhưng thực tế FE không còn đọc. Fallback admin thật sự nằm ở GAS `Config.gs ADMIN_EMAILS` (getAdminEmails_ Priority 3, khi User_Master offline).

**Rủi ro:** Không — chỉ là hằng số inert ở FE.

**Fix đề xuất:** Có thể xóa `ADMIN_EMAILS` khỏi env.js nếu muốn sạch tuyệt đối; giữ Config.gs làm cứu hộ. Để lại có chú thích cũng chấp nhận được.

**File:** `config/env.js`, `assets/gas-backend/Config.gs`.

---

## AUTH-PASSWORD-IN-URL-01 — Mật khẩu đi trong payload base64url của JSONP GET (H2, 2026-08-17)

**Mô tả:** `Api.authLogin` gửi `{username,password}` qua `_request` → base64url trong query param `payload` của JSONP GET (HTTPS). Password bị base64 (không mã hóa) → có thể xuất hiện trong log server/proxy dù đường truyền TLS.

**Rủi ro:** Trung bình-thấp — TLS bảo vệ trên đường truyền; rủi ro chủ yếu ở log. Mô hình hệ thống nội bộ, mật khẩu SHA-256 tại rest.

**Fix đề xuất:** Chuyển login sang POST body (đã có `doPost` + `_submitViaPost`) để password không nằm trên URL; hoặc dùng `google.script.run` như SHTD nếu nhúng cùng origin.

**File:** `assets/js/api.js` (`authLogin`), `login.html`.

---

## CREATE-VALIDATION-MSG-01 — Lỗi validate GAS khi create không hiện message cụ thể (v3.15.0, 2026-08-02)

**Mô tả:** Create/update chuyển sang hidden-iframe FORM POST (fix link demo dài). FE **không đọc được response iframe** (cross-origin) → nếu GAS trả `success:false` (vd validate thiếu field), FE không lấy được message; thay vào đó verify `getUseCase` không xác nhận → sau timeout (90s) hiện cảnh báo chung "Dữ liệu CÓ THỂ đã lưu — kiểm tra dashboard".

**Rủi ro:** UX — user không thấy lý do lỗi chính xác từ server; phải chờ tới timeout. `Validator.all()` client-side đã chặn phần lớn lỗi validate trước khi gửi nên ít gặp.

**Fix đề xuất (chưa quyết):** (a) GAS ghi kết quả create/update ra 1 sheet/cache theo `client_nonce` FE gửi kèm, verify đọc nonce để lấy cả trạng thái lỗi + message; hoặc (b) rút ngắn timeout khi verify liên tiếp trả record-không-đổi. Cần cân nhắc.

**File:** `assets/js/api.js` (`_submitViaPost`), `assets/js/app.js` (`_handleSubmitError`).

---

## UPDATE-VERIFY-01 — Verify update chỉ xác nhận record tồn tại, không chắc write đã áp (v3.15.0, 2026-08-02)

**Mô tả:** `updateUseCase` (POST iframe) verify bằng `getUseCase(Record_ID)`. Vì record đã tồn tại từ trước, verify resolve ngay cả khi bản update chưa/không được ghi (vd POST rớt giữa chừng) → false-positive "thành công".

**Rủi ro:** Thấp — GAS thực thi write đồng bộ trước khi trả response; chỉ rủi ro khi POST rớt mạng giữa chừng (hiếm). Create không dính (verify theo UseCase_ID mới + khớp owner).

**Fix đề xuất:** So khớp `Updated_At` trả về với mốc client gửi kèm (cần xử lý lệch giờ), hoặc dùng `client_nonce` như CREATE-VALIDATION-MSG-01.

**File:** `assets/js/api.js` — `updateUseCase` verifyFn.

---

## LEADERBOARD-DEMO-NOTEST-01 — Link demo leaderboard chưa có test tự động (v3.15.0, 2026-08-02)

**Mô tả:** `leaderboard.html` thêm `_lbDemoLinkHtml`/`_lbDemoField`/`lbCopyB64` mirror y hệt dashboard.js nhưng không có spec Playwright cho leaderboard trong suite. Dashboard đã có T06.

**Rủi ro:** Thấp — logic copy-paste từ dashboard (đã test). Nên xác nhận mắt thường sau deploy.

**Fix đề xuất:** Thêm spec leaderboard hoặc test đơn vị cho `_lbDemoLinkHtml`.

**File:** `leaderboard.html`.

---

## WEEKLYLOG-COL-01 — WEEKLY_LOG thiếu Active_User_Count từ v3.13.0 (phát hiện 2026-07-31)

**Mô tả:** Khi chạy `migrateWeeklyLogSchema()` (v3.14.0), migration phải thêm cả cột `Active_User_Count` → chứng tỏ sheet WEEKLY_LOG prod **chưa từng có cột này**. Do đó từ v3.13.0, `submitWeeklyUpdate_` ghi `Active_User_Count` vào WEEKLY_LOG đã bị `appendRowFromObject_` **âm thầm rớt** (map theo header, header không tồn tại → bỏ).

**Rủi ro:** Chỉ lịch sử — các dòng WEEKLY_LOG tạo giữa v3.13.0 và v3.14.0 không lưu số người dùng thực tế tại thời điểm đó. **KHÔNG** ảnh hưởng Adoption score ở MASTER_DATA (cột MASTER riêng, vẫn ghi đúng). Nay cột đã có → các submit mới ghi đúng.

**Fix:** Đã tự khắc phục bởi migration (cột đã thêm). Không cần hành động thêm. Bài học: sheet tạo trước khi thêm header mới cần chạy `ensureSheetColumns_` — nay submitWeeklyUpdate_ tự gọi mỗi lần.

---

## MILESTONE-THRESH-01 — Mọi mức nâng điểm đều thành milestone cần duyệt (v3.14.0)

**Mô tả:** `submitWeeklyUpdate_` coi bất kỳ `proposedScore > prevScore` là milestone → cần Admin duyệt. Usage tăng nhẹ (vd Active_User_Count 1→2) cũng tạo milestone chờ duyệt → có thể tạo nhiều milestone vụn cho Admin.

**Rủi ro:** UX/workload — Admin có thể phải duyệt nhiều milestone điểm tăng nhỏ.

**Fix đề xuất (chưa quyết):** Thêm ngưỡng (vd chỉ pending khi Δđiểm ≥ N, hoặc chỉ khi đổi bậc Rank), hoặc chỉ gate stage-change còn score tăng thì auto-apply. Cần PO xác nhận policy.

**File:** `assets/gas-backend/AdminService.gs` — `submitWeeklyUpdate_` (`scoreRaised`).

---

## ~~MILESTONE-PROMPT-01~~ — Reject milestone dùng window.prompt ✅ RESOLVED (v3.15.0, 2026-08-02)

**Đã đóng:** Duyệt/từ chối milestone nay dùng modal chi tiết US inline (ô comment `#detailActionComment` + confirm) qua `_confirmDetailAction` nhánh milestone. Không còn `window.prompt`. `_rejectMilestone` cũ vẫn tồn tại (không dùng trên UI, giữ làm fallback).

---

## SCORE-BACKFILL-01 — UC cũ có Adoption = 0 tới khi recalc (v3.13.0, 2026-07-30)

**Mô tả:** v3.13.0 nối trường `Active_User_Count` (nguồn điểm Adoption, max 20đ) vào UI. Từ nay UC tạo/cập nhật đều tự chấm Adoption đúng. Nhưng UC **lịch sử** (tạo trước 2026-07-30) có `Active_User_Count` rỗng → Adoption của chúng vẫn = 0 và Total_Score bị thấp hơn thực tế.

**Rủi ro:** Data — leaderboard/KPI/Điểm SPTD của UC cũ thấp hơn đúng cho tới khi backfill. Không phải bug code.

**Fix:** (1) Nhập `Active_User_Count` thực cho UC cũ qua "Cập nhật tuần" hoặc sửa trực tiếp MASTER sheet; (2) GAS Editor → Run `recalculateAllScores_()` → chấm lại toàn bộ. Lưu ý: recalc ghi lại scoring fields cho **toàn bộ** MASTER (auto + manual hiện có) → một số Total_Score sẽ tăng.

**File:** `assets/gas-backend/ScoringEngine.gs` — `recalculateAllScores_()`.

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

## ~~DATA-LIMIT-01~~ — CLOSED (2026-07-27, deployed) — `_allList`/`_pendingList` giới hạn 200 records

**Đã fix (2026-07-27, commit `3c7463e`, GAS deployed):** Tổng UC đã vượt 200 → cap cắt mất mọi UC cũ hơn UC thứ-200 (≈20/06) TRƯỚC khi lọc owner → nhiều user mất UC cũ dù DB còn. Đây là hiện tượng "Use case của tôi thiếu US nộp trước 20/06".

**Cách sửa:**
- GAS `listUseCases_`: thêm filter `owner_login`/`owner_name` áp dụng TRƯỚC khi slice (My Cases); `limit<=0` = không cắt (org-wide loads); có owner filter → luôn trả full owner set.
- FE org-wide loads (`_allList`, pending, review-queue, manager-review) đổi sang `limit:0`; My Cases fetch theo owner ở server (`_myList = all`).
- Vì `limit:0` trả toàn bộ dataset qua slim view → KPI/SPTD/Khám phá/Tất cả/Chờ duyệt nay đầy đủ.

**Note tương lai (chưa blocking):** `limit:0` tải toàn bộ MASTER mỗi lần → khi data lên nhiều nghìn UC sẽ chậm dần (JSONP response size). Lúc đó mới cần pagination server-side thật (P3 backlog). Data hiện tại vài trăm UC → chấp nhận được.

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

## ~~PLAYWRIGHT-01~~ (cwd) — CLOSED (2026-06-20)

`cwd` đã cập nhật thành `'D:\\Workspace\\Production\\ai-usecase-platform'` trong `playwright.config.js`. 74/74 tests pass.

**Còn lại (không blocking):** `webServer.command` vẫn dùng `python -m http.server 8787` — Python 3 only, không HTTPS. Nếu cần CI/CD: thay bằng `npx serve -s . -l 8787` + `path.resolve(__dirname)` thay cwd hardcode.

**File:** `playwright.config.js` — `webServer.command` (cosmetic, không ảnh hưởng local test).

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

## LB-GAS-01 — `review_comment` trong Leaderboard chưa deploy (2026-06-19)

**Mô tả:** `AdminService.gs getLeaderboard_()` mapItem đã có `review_comment: uc.Review_Comment || ''` trong local repo (commit `ac50eaf`) nhưng chưa được paste vào GAS Editor + deploy. Cột Comment trong Leaderboard table sẽ trống cho đến khi deploy.

**Rủi ro:** Cosmetic only. Detail popup (dùng `getUseCase`) vẫn hiển thị `review_comment` đúng.

**Fix:** GAS Editor → paste `AdminService.gs` → Edit deployment → New version → Deploy. URL không đổi.

**File:** `assets/gas-backend/AdminService.gs` line 248 — `review_comment: uc.Review_Comment || ''`

---

## GAS-OPT-01 — `_getAllUseCaseIds_()` optimization chưa deploy (2026-06-20)

**Mô tả:** `UseCaseService.gs` local đã có `_getAllUseCaseIds_()` đọc chỉ cột UseCase_ID (N×1 thay vì N×99). Chưa deploy lên GAS Editor. Đến khi deploy: mỗi `createUseCase` call vẫn đọc toàn bộ MASTER_DATA để lấy IDs → chậm hơn cần thiết với sheet lớn.

**Rủi ro:** Không có bug — chỉ là performance. GAS vẫn hoạt động đúng. FE timeout 90s đủ buffer.

**Fix:** Deploy `UseCaseService.gs` mới vào GAS (cùng lần với AdminService.gs). Xem TODO_NEXT P0-B.

**File:** `assets/gas-backend/UseCaseService.gs` — `_getAllUseCaseIds_()`.

---

## DEAD-CODE-02 — `debug_sidebar.js` untracked file trong repo root (2026-06-18)

**Mô tả:** File `debug_sidebar.js` tồn tại trong repo root nhưng không được tracked bởi git (untracked). Nội dung không rõ.

**Fix:** Kiểm tra nội dung → nếu là debug/temp script thì xóa hoặc thêm vào `.gitignore`.

---

## WORDING-01 — Viết hoa "Use Case" vs "Use case" không nhất quán (2026-07-29)

**Mô tả:** Nhãn điều hướng lệch cách viết hoa giữa sidebar và portal service card:
- Sidebar (`index.html` + các trang khác): "**Use Case** của tôi", "Đăng ký **Use Case**"
- Portal card (`index.html` PORTAL_SERVICES): "**Use case** của tôi", "Đăng ký **AI Use Case**"

**Rủi ro:** Cosmetic only — không sai nghĩa. Thuần vấn đề nhất quán thương hiệu.

**Fix:** Chọn 1 chuẩn ("Use Case" hoặc "Use case") → normalize toàn bộ nhãn hiển thị. User chưa quyết định phiên 2026-07-29 (chỉ yêu cầu sửa tên Trung tâm).

**File:** `index.html` (sidebar nav + PORTAL_SERVICES); kiểm tra thêm sidebar các trang khác nếu chuẩn hóa.
