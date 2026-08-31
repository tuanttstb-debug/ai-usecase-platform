# TODO NEXT

Thứ tự ưu tiên cho session tiếp theo.

---

## 🆕 Verify LIVE production Round 2 T2 (2026-08-31 #3) — PASS
- [x] Test LIVE: dedup create (3→1 record, 0 trùng) · control · dedup update (Edit_Version +1) · latency đo thật.
- [ ] **[TT] xóa tay 2 dòng probe** (đã reject): `AIUS-0341` (`a04e4df3-9d6a-47ad-a39a-2cf8756c2178`) + `71d9b560-c18f-4ec6-aa64-f5ebcaa991fe` (tên `__CC_IDEM_PROBE_DELETE_ME__`).

## 🆕 Round 2 T2 (2026-08-31 #2) — chống timeout/mất/trùng khi ghi — XONG (Playwright 111/111)
- [x] Idempotency `Req_ID`: server dedup hybrid (sheet `REQ_DEDUP` bền + CacheService) — `IdempotencyService.gs`; create lock+dedup, update dedup lock-free.
- [x] Client: reqId theo phiên form + khóa nút Gửi + retry an toàn (GET-JSONP, chỉ khi có reqId).
- [x] Test `tests/10-idempotency.spec.js` (4/4) + full 111/111.
- [ ] **[TT] REDEPLOY GAS** (dán TẤT CẢ .gs — MỚI `IdempotencyService.gs`, `Config.gs` +`REQ_DEDUP`) → chạy `testIdempotencyStore()` + smoke (đăng ký ngắt mạng/bấm nhiều lần → 1 dòng).
- [ ] [CC] (tùy chọn) rút ngắn writeTimeout cho GET-retry (giảm worst-case true-timeout ~270s).

## 🆕 Clear tech debt (2026-08-31) — XONG phần A+B (Playwright 107/107)
- [x] Đóng **UC-DETAIL-DUP-01** (dashboard.js dùng chung `uc-detail-view.js`).
- [x] Gỡ dead code: `isValidUrl_` · CSS `.sptd-*` · doc H1 `SCORING_ENGINE_DESIGN.md`→archive.
- [x] Đóng deploy-gated: H1-CLEANUP-01 + SCORING-H2-MONTHLY migration (sau [TT] redeploy GAS + smoke OK).
- [ ] **[TT] chốt nguồn nhập `Evidence_Link`** (member nhập ở đâu / link cố định theo team) → [CC] thêm input ghi cột.
- [ ] **[CC] Round 2 T2** (idempotency `reqId` server + retry write) — feature, tách phiên riêng (chạm transport hybrid CR#1).
- [ ] **[CC] WRITE-TRANSPORT-01 residual** — cần [TT] cấp tài khoản test → reproduce browser đường iframe-POST payload >7500.

---

## 🆕 CR 2 mục: cập nhật Prompt/Luồng AI ở tuần + Review panel 2 cột (2026-08-28) — CODE XONG + TEST 104/104
- [x] **Mục tiêu 1** — `weekly-update.html` accordion sửa `Flow_Description`+8 `Prompt_*` (prefill full detail; gửi khi `_fullDetailLoaded`&`_promptTouched`); `submitWeeklyUpdate_` ghi MASTER + snapshot WEEKLY_LOG (+10 cột `ensureSheetColumns_` tự thêm); timeline badge ✦.
- [x] **Mục tiêu 2** — `review-queue` panel 2 cột (chi tiết trái + chấm điểm phải, mở rộng 1080px); module mới `uc-detail-view.js` (tách từ dashboard, dùng chung); fetch full detail + copy prompt.
- [x] Verify Playwright **104/104** (03 +1, weekly +T12, + regression).
- [ ] **[P0] [TT] REDEPLOY GAS** (Mục tiêu 1 — dán TẤT CẢ .gs; có `AdminService.gs`+`Config.gs` đổi). Mục tiêu 2 chỉ hard-refresh.
- [ ] **[P1] [TT] nghiệm thu:** (a) cập nhật tuần → mở accordion Prompt/Luồng → sửa → gửi → timeline hiện ✦ + MASTER cập nhật (mở lại UC thấy bản mới); (b) Review panel: bấm US → chi tiết + chấm điểm cùng hiện, cuộn chi tiết mượt, Copy prompt chạy.
- [ ] **[CC]** (tùy chọn) refactor `dashboard.js` dùng chung `uc-detail-view.js` (hiện dashboard vẫn giữ bản `_renderDetailBody` riêng — trùng lặp nhẹ, chưa gộp để giảm blast radius); nguồn nhập `Evidence_Link` (SCORING-H2-MONTHLY-01) vẫn treo.

## 🆕 TUNING BE Round 1 (cache reads theo version + tối ưu lookup ghi) (2026-08-26 #4) — CODE XONG
- [x] **T1** version-gated cache `list`+`dashboard` (`CacheLayer.gs` + bump tập trung doGet/doPost); dashboard bỏ cache lossy 30' → full+tươi+nhanh.
- [x] **T3** `findRowByKeyColumn_` (cột khóa + 1 dòng) cho `updateUseCase_` + `getUseCaseById_` (verify).
- [x] Syntax OK 6/6; backend-only (0 FE) → không đụng Playwright.
- [ ] **[P0] [TT] redeploy GAS** — dán TẤT CẢ .gs cùng lúc (có file MỚI `CacheLayer.gs`).
- [ ] **[P1] [TT] nghiệm thu:** load `list`/`dashboard` lần 2 nhanh hẳn; ghi 1 UC → load kế tươi ngay; update UC nhanh hơn.
- [ ] **[CC] Round 2 — T2:** idempotency `reqId` dedup (server, CacheService) + bật retry write an toàn (create/update GET-JSONP path) → trị timeout/mất/trùng. Cẩn trọng transport hybrid (CR#1).

## 🆕 CR bỏ validate URL Demo_Link (free text) (2026-08-26 #3) — CODE XONG
- [x] Gỡ validate server-side Demo_Link (`ValidationService.gs` create+update) → link demo là free text (ổ chung/localhost/ghi chú).
- [ ] **[P0] [TT] redeploy GAS** (dán lại ValidationService.gs — nên dán tất cả .gs cùng lúc) → thử đăng ký lại với link nội bộ, không còn *"Demo_Link phải là URL hợp lệ"*.
- [ ] **[CC]** (tùy chọn) gỡ `isValidUrl_` dead code (Utils.gs) + rà field link khác nếu cũng bị ép http.

## 🆕 CR đăng ký US + review-queue (2026-08-26) — CODE XONG + PUSH `73bfde1`
- [x] **CR#1** Sửa đăng ký "timeout giả"/không ghi: truy gốc LIVE (không ghi từ ~16/08, backend OK) → transport **HYBRID** (`_writeHybrid`: GET-JSONP ≤7500 / iframe-POST >7500) + guard `Owner_Email`.
- [x] **CR#2** Tên US → hyperlink mở chi tiết (bảng "Của tôi" + Explore).
- [x] **CR#3** Droplist filter theo Người đăng ký (Owner) ở hàng đợi review.
- [x] Verify Playwright **102/102** (05 viết lại + test lõi lỗi-server-hiện-message-thật).
- [ ] **[P0] [TT]** hard-refresh site (GitHub Pages cache) → **đăng ký thử 1 US** → xác nhận hiện ngay ở "Use case của tôi".
- [ ] **[P1] [TT]** xoá tay dòng probe `AIUS-0337` (`__CC_PROBE_DELETE_ME__`) trong Google Sheet (không có route xoá UC).
- [ ] **[P2] [TT]** (tùy chọn, đóng residual) test 1 US **link demo dài** (payload >7500 → đi POST) — nếu vẫn lỗi báo [CC].
- [ ] **[CC]** nếu US link-dài vẫn lỗi → reproduce browser (cần [TT] cấp tài khoản test) soi đường iframe-POST trên live; đóng `WRITE-TRANSPORT-01`.

## 🆕 Dọn dẹp H1 (cũ) — tách khỏi H2, giữ ghi chú (2026-08-26) — CODE XONG
- [x] Archive toàn bộ dấu vết H1 vào `archive/h1/` (+README): ScoringEngine.gs · scoring.js · sptd-scoring.js · manager-review.html · HDSD/builder/capture/screenshots H1 · 3 test H1.
- [x] Gỡ code chạy: routes GAS manager-review/champion-review/score-recalc/rank-recalc + hàm submit*Review_ + ScoringEngine.gs + mọi call scoreUseCase_ (create/update/weekly/approve-milestone); dashboard SPTD tab/JS; FE api/routes bỏ entry H1.
- [ ] **[P0] [TT] redeploy GAS** (áp gỡ routes/ScoringEngine/call site). Trước redeploy: route H1 live cũ vô hại (FE không gọi).
- [ ] **[TT] xác nhận thay đổi hành vi:** cập nhật tuần → milestone CHỈ theo đổi stage (bỏ auto-score-tăng). OK giữ, hay cần thiết kế lại milestone-theo-điểm trên nền H2?
- [ ] (tùy chọn) gỡ dần CSS `.sptd-*` dead trong dashboard.css.

## 🆕 CR chấm điểm cá nhân theo THÁNG + rà soát UI (2026-08-26) — CODE XONG

- [x] **CR#1** Điểm năng lực M-KPI-2 theo tháng (`PERSONAL_SCORE` +`Month`, upsert (Username,Month), M2 cuối kỳ = TB tháng đã chấm; khóa/lan tỏa/trừ lấy tháng mới nhất). Kỳ H2 08–12/2026.
- [x] **CR#2** Route `member-kpi-preview` + panel 4 nhóm điểm rõ (US đọc-only + M2 + KPI khác + tổng hợp).
- [x] **CR#3** `score-slider.js` dùng chung: mặc định 0 (mới), giữ điểm cũ (sửa), giá trị trên thanh (bubble). Áp cả personal + review-queue.
- [x] **CR#4** Dòng EVD đọc-only: personal (cột `Evidence_Link`) + review-queue (`Demo_Link` UC).
- [x] Verify: unit 71/71 · Playwright 03 +2 · 09-personal-score 4/4.
- [ ] **[P0] Deploy GAS + chạy `setupScoringH2Sheets()`** (thêm cột `Month` + `Evidence_Link` vào `PERSONAL_SCORE`) → hard-refresh.
- [ ] **[P1] Smoke test live:** teamlead chấm 1 member cho 2 tháng khác nhau → bảng hiện TB 2 tháng; panel hiện điểm US; slider mặc định 0; đổi tháng → prefill đúng. Nguồn nhập `Evidence_Link` (ổ share) = **để sau** (hiện chỉ hiển thị).

---

## 🔜 H2 — ưu tiên session tiếp theo

- [x] **[P3] Giai đoạn 3 — Scoring mới (Đợt 1: lõi member scoring) — CODE XONG 2026-08-25** (branch `feat/h2-scoring`, chưa deploy/merge). GAS `ScoringServiceH2.gs` (council + personal + h2-leaderboard, sheets `UC_COUNCIL_SCORE`/`PERSONAL_SCORE`); FE review-queue viết lại + `personal-score.html` mới + leaderboard 2 tab + ẩn tab SPTD; `scoring-h2.js` unit test 27/27. Chi tiết: H2_PLAN §8 Giai đoạn 3.
  - [ ] **[P0] Deploy GAS Giai đoạn 3** — Edit deployment → New version (URL không đổi). Sheet mới tự tạo khi gọi route. (Tùy) set Script Property `COUNCIL_USERS`.
  - [ ] **[P0] Smoke test live** — council chấm 1 UC Approved (điểm US = bình quân, tiến độ n/4) · teamlead chấm 1 thành viên (personal-score) · leaderboard 2 tab đúng → merge `feat/h2-scoring` → `main`.
  - [x] **[P1] Đợt 2 — KPI tổng hợp — CODE XONG 2026-08-25** (branch `feat/h2-scoring`). Member KPI (M1·40+M2·30+M3·15+M4·15−trừ) + Teamlead (T1·60+T2·40) + PM card (A1/A2 auto, A3/A4 tay). `PERSONAL_SCORE` +4 cột (khóa học/lan tỏa/milestone teamlead nhập cùng); route `kpi-leaderboard`; leaderboard +2 tab + PM card; `scoring-h2.js` 62/62. Chi tiết H2_PLAN §8 Đợt 2.
    - [ ] **[P0] Deploy GAS Đợt 2** — Edit deployment → New version + chạy lại `setupScoringH2Sheets()` (thêm 4 cột vào `PERSONAL_SCORE`).
    - [ ] **[P0] Smoke test** — teamlead chấm cá nhân (có khóa học/lan tỏa/milestone) → leaderboard tab "KPI tổng hợp" hiện M1..M4−trừ + tab "KPI Teamlead" (T1/T2) + PM card (admin) A1/A2 auto, nhập A3/A4 → final. → merge main.
    - [x] **[P2] Residual (một phần) — 2026-08-25:** ✅ dọn auto-score cũ (gỡ preview register + breakdown 70/30 leaderboard/dashboard → Điểm US hội đồng) · ✅ rewrite Playwright 03/04/06 (42/42; full 85 pass +1 flake weekly-update pass riêng) · ✅ `scoring-h2.js` 62/62.
    - [ ] **[P3] Residual còn lại:** nối A3 (Action Plan) tự động từ SHTD/hub (đang nhập tay); xóa hẳn dashboard.js SPTD dormant code + gỡ `scoring.js`/`champion-review`/`ScoringEngine.gs` khi ổn định.


- [x] **Dọn rác nguồn user (2026-08-18, Part 3)** — gỡ hẳn quản lý user khỏi AI US + sheet USERS nội bộ + script migration cũ. Nguồn user DUY NHẤT = `User_Master` (SHTD); AI US chỉ ĐỌC (login/role/KPI) + đổi mật khẩu tự phục vụ. Test 88/88 (+ unit). Chi tiết: handover Part 3.
- [ ] **[P0] Redeploy GAS cho bản dọn rác** — Edit deployment → New version (đã bỏ routes user-login/init/upsert/reset/sync + file UserService/Migration). URL không đổi.
- [ ] **[P1] Team Số split — CHỜ DUYỆT danh sách WF/US** rồi chạy `seedTeamSoWorkflows()` trong GAS Editor (tách Số khỏi PO + import WF/US nhóm '4. Số hóa tín dụng'). Script đã có (dormant), sửa mảng `TEAM_SO_NEW_WF` nếu cần trước khi chạy.


- [x] **[P1] Merge `feat/h2-shared-auth` → `main` + push** — DONE 2026-08-18 (fast-forward `fc894b5..2e14332`, pushed `origin/main`). Merge theo yêu cầu user, **TRƯỚC khi smoke test** (chấp nhận rủi ro). GitHub Pages nay serve auth mới (hard-refresh vì cache).
- [x] **[P0] Login thật (Giai đoạn 1) TRÊN LIVE — ĐÃ CHẠY (2026-08-18).** Root cause lỗi login ban đầu: **quên set `AUTH_SECRET` trong Script Properties của project GAS AI US** (Script Properties là per-project — set bên SHTD không tự sang AI US). Đã bổ sung → login OK. Đóng vấn đề.
- [ ] **[P1] Smoke test phần còn lại của Giai đoạn 1** (khi tiện): đổi mật khẩu (`change-password.html`); admin tạo/sửa/đặt-lại-mật-khẩu user + sync owner; kiểm token verify ở thao tác sau login (approve/reject) để chắc `AUTH_SECRET` hai bên khớp tuyệt đối.
- [x] **[P2] Giai đoạn 2 — Nhập liệu theo Workflow — CODE XONG (2026-08-18, branch `feat/h2-workflow-input`, chưa deploy/merge).** Sheet `WORKFLOW_CATALOG` + `TEAM_GROUP_MAP`; route `workflow-catalog`; dependent dropdown Workflow→US + "Khác — nhập tự do"; cột `Workflow`/`Workflow_Group` MASTER. **Kèm trang Admin `workflow-catalog.html`** (thêm/sửa/xóa/đổi-tên WF+US). Test local: Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14. Chi tiết + việc thủ công: H2_PLAN §8.
- [x] **Deploy GAS + merge main + push (2026-08-18)** — GAS deployed (URL không đổi); local test PASS (Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14); merged `feat/h2-workflow-input` → `main` + push. (User: push thẳng main, không dùng nhánh riêng — DA chưa thương mại hóa.)
- [ ] **[P1] Xác nhận đã chạy `seedWorkflowCatalog()` + smoke test live** — nếu droplist Workflow trống → mở GAS Editor chạy `seedWorkflowCatalog()` (import 69 US + seed Team→Nhóm + self-heal cột MASTER). Rồi smoke test: đăng ký (Workflow lọc theo Team → US dependent → "Khác") + trang `workflow-catalog.html` (thêm/sửa/xóa/đổi-tên).
- [ ] **[P3] Giai đoạn 3 — Scoring mới** (lớn nhất, thay thế hoàn toàn): Điểm US (hội đồng 4 teamlead, 30/40/30, bình quân) + Điểm cá nhân (teamlead, 30/20/30/20, 0–10, 1 lần cuối kỳ 31/12/2026). Bỏ auto-score + SPTD 80-10-10; rebuild leaderboard/KPI/review. Sheet mới `UC_COUNCIL_SCORE`, `PERSONAL_SCORE`.

### ✅ Đã hoàn thành trong session 2026-08-17 (H2 — Giai đoạn 1: Auth dùng chung)
- [x] **Lập kế hoạch H2** — `AI_CONTEXT/H2_PLAN.md` (3 hạng mục, quyết định §6, nhật ký §8).
- [x] **Auth dùng chung SHTD (phương án A)** — username+password + token HMAC đọc `User_Master`; role champion→teamlead; quản lý user + đổi/đặt-lại mật khẩu qua User_Master; `change-password.html`. GAS `AuthTokenService.gs` (mới) + routes. GAS deployed (URL không đổi). Test local: Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14. Branch `feat/h2-shared-auth` (`50bc341`, pushed), **chưa merge main**.

---

## ✅ Deploy v3.15.0 — HOÀN THÀNH (2026-08-02)

- [x] **Deploy 3 file GAS** — `Code.gs` (doPost decode payload), `UseCaseService.gs` (getUseCaseById_ fallback UseCase_ID), `AdminService.gs` (list demo fields). Edit deployment → New version, URL không đổi.
- [x] **Push FE** — merged `main` (`fc894b5`), branch đã xóa.
- [ ] **[P1] Smoke test live** (hard-refresh vì GitHub Pages cache): (1) tạo US mới với link demo ổ chung dài → lưu OK; (2) tab Chờ duyệt → "Xem chi tiết & Duyệt" milestone → khối "Nội dung điều chỉnh" → duyệt áp Stage/điểm; (3) bấm/Copy link demo trong 4 popup; (4) mắt thường Leaderboard (LEADERBOARD-DEMO-NOTEST-01).

---

## ✅ Đã hoàn thành trong session 2026-08-02 (v3.15.0)

- [x] **Item 1 — Duyệt milestone dùng chung modal chi tiết US** — card → nút "🔍 Xem chi tiết & Duyệt" mở `openDetail(uc, milestone)` (4 section US) + khối "Nội dung điều chỉnh chờ duyệt" (Stage/Điểm cũ→mới, ghi chú tuần). Duyệt/Từ chối inline; từ chối qua ô comment (bỏ `window.prompt`) → đóng **MILESTONE-PROMPT-01**.
- [x] **Item 2 — Link demo bấm được + Copy** — 4 popup (chi tiết US, duyệt milestone, leaderboard detail, cột Demo list drill-down). `http(s)`→hyperlink; ổ chung/UNC→text+Copy.
- [x] **Item 3 — Fix triệt để link demo dài làm hỏng create** — create/update → hidden-iframe FORM POST + verify `getUseCase` (bỏ giới hạn URL ~8KB). Verify create khớp owner chống nhận nhầm. GAS `doPost` decode payload field. Cần redeploy GAS (xem P0 trên).
- [x] **Test** — Playwright 98/98 (spec 05 viết lại POST+verify, spec 07 flow modal + T06 demo-link); Unit SPTD 34/34 · KPI 38/38 · ID 14/14.

---

## ✅ Đã hoàn thành trong session 2026-07-31

- [x] **FEATURE: Milestone cập nhật tuần → KPI có phê duyệt Admin (v3.14.0, commit `8a786a4`)** — weekly-update chuyển Stage/nâng điểm = milestone → giữ pending; Admin duyệt ở tab "Chờ duyệt" mới áp Stage/điểm + tính KPI (+1 Owner tuần Log_Date, cộng dồn). GAS: WEEKLY_LOG +8 cột + submitWeeklyUpdate_ gate + listMilestones_/approve/reject; FE: dashboard queue + `_buildKPIData`/`sptd-scoring.js` cộng milestone; weekly-update pending messaging. Test: SPTD 34/34 + KPI 38/38 unit + Playwright 91/91 (5 mới).
- [x] **GAS deploy + `migrateWeeklyLogSchema()`** — 2026-07-31, URL không đổi. Migration cũng thêm `Active_User_Count` (thiếu từ v3.13.0 → WEEKLYLOG-COL-01).
- [x] **Push FE** `8a786a4`. Verified live (milestone hiển thị ở "Chờ duyệt"; sự cố "không thấy" chỉ do GitHub Pages/cache lên chậm).
- [ ] **[P1] Smoke test trọn vòng duyệt** — bấm ✓ Duyệt AIUS-0301 → UC lên S3, điểm 70, KPI Owner +1 tuần 31/07. Thử ✕ Từ chối (có lý do) → UC không đổi.

---

## ✅ Đã hoàn thành trong session 2026-07-30

- [x] **SCORING FIX: nối `Active_User_Count` end-to-end (v3.13.0)** — Đóng lại task phiên trước bị bỏ dở (chưa commit/deploy/handover). Root cause: Adoption score (max 20đ) lấy từ `Active_User_Count` mà chưa hề có ô nhập → luôn=0. Fix: thêm field "Số người dùng thực tế" vào register wizard (`constants.js`) + form cập nhật tuần (`weekly-update.html`) + GAS đọc/ghi (`AdminService.gs`, `Config.gs`). 95/95 Playwright PASS.
- [x] **[P0] Redeploy GAS** — `AdminService.gs` + `Config.gs` deployed 2026-07-30, URL không đổi (confirmed by user).
- [x] **[P1] Push origin/main** — commit v3.13.0 pushed 2026-07-30.
- [ ] **[P0] Backfill + `recalculateAllScores_()`** — UC cũ có `Active_User_Count` rỗng → Adoption vẫn 0 tới khi nhập số thực + chạy recalc.

---

## ✅ Đã hoàn thành trong session 2026-07-29

- [x] **WORDING FIX: tên Trung tâm sai ở trang đăng nhập (v3.12.3)** — `login.html` phụ đề "Trung tâm Sản phẩm & Dịch vụ" → "Trung tâm Sản phẩm & Giải pháp Tín dụng". Rà soát toàn bộ pages: đây là nơi duy nhất spell tên đầy đủ; short form "TT SPTD" đồng nhất & đúng khắp site → giữ nguyên. Nhãn tab "Điểm SPTD" giữ nguyên (tên tính năng). Thuần FE, không đụng GAS/test.
- [ ] **(Tùy chọn) WORDING-01** — chuẩn hóa viết hoa "Use Case" vs "Use case" giữa sidebar và portal card (xem TECH_DEBT). Chưa quyết định.

---

## ✅ Đã hoàn thành trong session 2026-07-27

- [x] **BUG FIX: dashboard/My Cases thiếu UC cũ (v3.12.2, commit `3c7463e`, GAS deployed)** — Root cause: `listUseCases_` sort `Created_At` mới→cũ rồi `slice(0, 200)`, FE lọc owner ở client SAU khi cắt → tổng UC >200 làm mất mọi UC cũ hơn UC thứ-200 (≈20/06) trước khi lọc owner. Fix: GAS owner filter (`owner_login`+`owner_name`) TRƯỚC slice + `limit<=0`=không cắt; FE org loads dùng `limit:0`, My Cases fetch theo owner ở server. Đóng **DATA-LIMIT-01**. Test 95/95 + 30/30 + 29/29 PASS.
- [ ] **[P0 VERIFY sau deploy]** Login user có UC trước 20/06 → tab "Use case của tôi" đủ UC cũ; KPI/SPTD phản ánh cả UC cũ. (Playwright mock bỏ qua param owner → đường server-filter chỉ verify được thủ công.)

---

## ✅ Đã hoàn thành trong session 2026-07-07

- [x] **Phân tích migration BL1+BL2→BL** — Grep 0 match → không có hardcode → chỉ cần data migration
- [x] **Viết `MigrationService.gs`** — `migrateTeamsBL_(dryRun)` + public wrappers `dryRunTeamBL` / `commitTeamBL`; batch read/write; idempotent
- [x] **Chạy migration thành công** — LOOKUP + MASTER_DATA + USERS cột Team: BL1/BL2 → BL; DASHBOARD_READY cache cleared; commit `a1beaa7`

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
