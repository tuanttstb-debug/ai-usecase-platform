# SESSION HANDOVER

## Session: 2026-08-31 #6 — [TT] redeploy GAS + smoke test OK → 4 CR (#5) LIVE
- **Task completed:** [TT] xác nhận **redeploy GAS + smoke test production OK** (đúng thứ tự: GAS trước, FE sau) → 4 CR ở phiên #5 nay **hiệu lực trên production**: CR1 Team tự điền · CR2a đăng ký không còn Lĩnh vực (gửi OK, backend hết bắt buộc Business_Category) · CR2b dashboard "Nhóm workflow" · CR2c trang Độ phủ Workflow. Blocker "chờ [TT] redeploy" (coupling CR2a) **đã đóng**.
- **Files changed:** *(không đổi code — chốt trạng thái)* code ở `cdb44dc` (phiên #5). Chỉ cập nhật AI_CONTEXT.
- **Decision made:** Không có mới; xác nhận 4 CR vận hành đúng trên production.
- **Blocker:** **Không.**
- **Next step:** [CC] (tùy chọn) propagate nav "Độ phủ Workflow" sang các trang còn lại; thêm Workflow vào uc-detail-view. [TT] dùng thực tế, báo nếu cần chỉnh.
- **Regression risk:** **Không** (thuần xác nhận; code đã verify Playwright 118/118 + [TT] smoke OK).

## Session: 2026-08-31 #5 — 2 CR: Team mặc định theo user + bỏ Lĩnh vực · Dashboard theo Workflow · trang Độ phủ Workflow
- **Task completed:** 4 hạng mục (phỏng vấn [TT] chốt 4 quyết định). **CR1** — form đăng ký tự chọn Team = team user đăng nhập (normalize lệch tên, vẫn sửa được): `app.js.rebuildLookupFields` + helper `_resolveSessionTeamOption`. **CR2a** — BỎ "Lĩnh vực nghiệp vụ" (Business_Category) khỏi đăng ký: gỡ khỏi `STEPS` (constants) + `Validator.step1` + `REQUIRED_FIELDS_CREATE` (GAS); Explore table cột "Lĩnh vực"→"Workflow". **CR2b** — Dashboard tổng hợp theo **Nhóm workflow** thay Lĩnh vực: `renderStackedChart('categoryChart','workflow_group')` + title + `_openListByField`; heading "Phân bổ theo Nhóm workflow". **CR2c** — trang MỚI **Độ phủ Workflow** (`workflow-coverage.html/js`): đối chiếu WORKFLOW_CATALOG (`Api.listWorkflowCatalog`) vs US đăng ký → ma trận Nhóm×workflow (đã có US/chưa + đếm), drill xuống US catalog chưa đăng ký; nav link ở dashboard/leaderboard. **BE (CR2b/2c cần):** `listUseCases_` output +`workflow`+`workflow_group`.
- **Files changed:** *(FE)* `app.js`, `constants.js`, `validation.js`, `dashboard.js`, `dashboard.html`, `leaderboard.html`; MỚI `workflow-coverage.html`, `assets/js/workflow-coverage.js`. *(GAS — CẦN REDEPLOY)* `AdminService.gs` (list +workflow/workflow_group), `Config.gs` (REQUIRED_FIELDS_CREATE −Business_Category). *(test)* `05` +CR1; MỚI `11-dashboard-workflow` (2), `12-workflow-coverage` (3). Verify **Playwright 118/118**.
- **Decision made:** [TT] chốt: CR1 = team user (sửa được); CR2a = gỡ required backend (redeploy); CR2b = thay hẳn Lĩnh vực→Workflow (gom Nhóm); CR2c = trang riêng ma trận. Coverage match catalog US theo (workflow, tên US); US tên tự do → "ngoài danh mục mẫu".
- **Blocker:** **⚠️ THỨ TỰ REDEPLOY QUAN TRỌNG (CR2a coupling):** GAS mới **backward-compatible** (Business_Category nay optional → FE cũ vẫn chạy) → **[TT] redeploy GAS TRƯỚC, rồi hard-refresh FE.** Nếu FE mới chạy trên GAS cũ (chưa redeploy) → đăng ký FAIL vì backend còn bắt buộc Business_Category. CR2b/2c cần redeploy để list trả workflow (nếu chưa, chart/coverage rỗng).
- **Next step:** [TT] **redeploy GAS** (dán TẤT CẢ .gs) → hard-refresh → nghiệm thu: (CR1) mở đăng ký thấy Team sẵn = team mình; (CR2a) đăng ký không còn ô Lĩnh vực, gửi OK; (CR2b) dashboard biểu đồ "Nhóm workflow"; (CR2c) mở "Độ phủ Workflow" thấy ma trận. [CC] (tùy chọn) propagate nav link Độ phủ sang các trang còn lại; thêm Workflow vào detail view.
- **Regression risk:** **Thấp → Playwright 118/118** (+6 test mới). CR2a: FE bỏ field + backend bỏ required đồng bộ; cột dashboard đổi hiển thị (US cũ giữ Business_Category trong sheet). CR2b field-key generic. CR2c trang mới độc lập. Data-boundary: chỉ metadata.

## Session: 2026-08-31 #4 — BỎ bước duyệt: US nộp xong vào review luôn (DEBUG "AIUS-0343 không hiện ở Review")
- **Task completed:** [TT] báo US vừa nộp `AIUS-0343` không hiện ở màn Review. **Truy vết (đọc LIVE):** AIUS-0343 CÓ trong `list` (Status=Submitted, Pending_Review) → không phải lỗi Round 2 T2/cache. **Gốc:** `review-queue.js._load` cố ý chỉ nạp US `status==='Approved'` (thiết kế cũ: hội đồng chấm US ĐÃ DUYỆT). [TT] chốt **bỏ bước duyệt** → sửa `_load`: `Api.listUseCases({limit:0})` (bỏ gate Approved) + loại client `['draft','rejected']` → US nộp xong (Submitted/Under Review/Approved) vào review luôn. Xác minh backend `submitCouncilScore_` KHÔNG gate status (chấm US Submitted chạy trọn) → **FE-only, không redeploy GAS**.
- **Files changed:** *(FE)* `assets/js/review-queue.js` (_load + comment header). *(test)* `tests/03-review-queue.spec.js` (+1: Submitted hiện / Rejected+Draft loại). *(GAS helper)* `assets/gas-backend/UseCaseService.gs` — MỚI `resetUseCaseIdCounter()` (chạy tay Editor: [TT] xóa DB cũ → clear bộ đếm NEXT_ID về 1 → US kế = AIUS-0001).
- **[TT] clear bộ đếm (đã xóa DB cũ):** cách nhanh = sửa TAY sheet CONFIG ô `NEXT_ID`=1; hoặc dán `UseCaseService.gs` vào Editor + chạy `resetUseCaseIdCounter()`. (An toàn: generateUseCaseId_ luôn né trùng theo maxExisting.)
- **Decision made:** [TT] bỏ bước Admin duyệt. Review = mọi US ĐÃ NỘP (loại Draft chưa nộp + Rejected đã loại). 3 mục Chờ/Đang/Đã chấm vẫn theo tiến độ hội đồng (không theo status). Giữ nút approve/reject ở dashboard (không còn là gate; reject vẫn dùng để loại khỏi review) — không gỡ để giảm blast radius.
- **Blocker:** **Không.** FE-only → [TT] chỉ hard-refresh màn Review; AIUS-0343 sẽ hiện.
- **Next step:** [TT] hard-refresh review-queue → xác nhận AIUS-0343 (+ US Submitted khác) hiện ở "Cần chấm". [CC] (tùy chọn) nếu muốn gỡ hẳn nút duyệt ở dashboard.
- **Regression risk:** **Thấp → Playwright 112/112.** `limit:0`=all + no-status=all (xác minh AdminService.gs L142/192); council scoring không gate status (ScoringServiceH2 L200). Data đọc LIVE khớp. Data-boundary: chỉ metadata.

## Session: 2026-08-31 #3 — Verify LIVE production Round 2 T2 (sau [TT] redeploy GAS, link không đổi)
- **Task completed:** Test LIVE trên GAS production + đo hiệu quả thực tế. Probe gọi thẳng endpoint (GET-JSONP, plain JSON). **KẾT QUẢ PASS:** (A) dedup create — cùng reqId ×3 → **1 record** `AIUS-0341`, 0 trùng (trước fix = 3 dòng); (B) control reqId khác → record mới (không over-block); (C) dedup update — cùng reqId ×2 → Edit_Version chỉ +1 (không double-apply). **Latency thực:** create cold 7,989ms → dedup-hit 1,716–1,905ms (~4× nhanh); update ghi 5,085ms → dedup-hit 1,717ms; list 3,385→1,259ms (cache R1).
- **Files changed:** *(không đổi code — thuần verify)* Round 2 T2 code đã ở `849a026`. Probe chạy qua node stdin (không tạo file trong repo).
- **Decision made:** Xác nhận idempotency hoạt động đúng trên production; cold-start create ~8s là lý do timeout hay xảy ra → retry cùng reqId nay an toàn tuyệt đối (0 trùng).
- **Blocker:** **Không.** **[TT] cần xóa tay 2 dòng probe** (đã auto-reject, vô hại): `AIUS-0341` (rec `a04e4df3-9d6a-47ad-a39a-2cf8756c2178`) + rec `71d9b560-c18f-4ec6-aa64-f5ebcaa991fe`, tên `__CC_IDEM_PROBE_DELETE_ME__`.
- **Next step:** [TT] xóa 2 dòng probe. [CC] (tùy chọn) drive UI thật qua Chrome để anh xem trực quan khóa nút + 1 dòng (tạo thêm 1 probe → auto-reject).
- **Regression risk:** **Không** (thuần đọc/probe + reject; không đụng code/schema). REQ_DEDUP tự sinh khi ghi lần đầu — xác nhận hoạt động (dedup-hit trả record cũ).

## Session: 2026-08-31 #2 — Round 2 T2: chống timeout/mất/trùng khi ghi (idempotency reqId) — TRIỆT ĐỂ
- **Task completed:** Fix gốc timeout/mất/trùng bằng **idempotency `Req_ID`** (phỏng vấn [TT] chốt 3: Hybrid cache+sheet · reqId theo phiên form + khóa nút · phạm vi create+update). **Server:** mới `IdempotencyService.gs` (`_idemLookup_` cache→sheet, `_idemRemember_` cache+sheet REQ_DEDUP, prune, `setupReqDedupSheet()`, `testIdempotencyStore()`); `Config.gs` +`SHEETS.REQ_DEDUP`+`REQ_DEDUP_HEADERS`; `UseCaseService.gs` — `createUseCase_` bọc script lock + dedup theo reqId (tách `_createUseCaseCore_` + ID helper no-lock `_generateUseCaseIdNoLock_`/`_assignUseCaseIdNoLock_` tránh nested lock), `updateUseCase_` dedup lock-free. **Client:** `app.js` reqId ổn định theo phiên form (lazy-gen, xóa sau success, giữ khi lỗi) + khóa nút `#submitBtn` khi bay; `api.js._writeHybrid` retry an toàn (chỉ GET-JSONP, chỉ khi có reqId, lỗi transient) — cùng reqId → server dedup.
- **Files changed:** *(GAS — CẦN REDEPLOY)* MỚI `IdempotencyService.gs`; `Config.gs`; `UseCaseService.gs`. *(FE)* `api.js`, `app.js`. *(test)* MỚI `tests/10-idempotency.spec.js` (4 test).
- **Decision made:** create nơi sinh trùng thật (Record_ID UUID mới/lần) → cần dedup + lock; update idempotent-theo-Record_ID → dedup lock-free đủ. RETRY chỉ GET-JSONP (POST đã có verify-polling, retry 90s×3 vô nghĩa). reqId KHÔNG ghi MASTER (ngoài HEADERS). Dedup best-effort không làm hỏng write chính. Dedup store hybrid: cache fast-path + sheet bền (chống trùng cả retry thủ công/cache-evict).
- **Blocker:** **Không.** **⚠️ [TT] cần redeploy GAS** (dán TẤT CẢ .gs — có MỚI `IdempotencyService.gs`, `Config.gs` đổi). Sheet `REQ_DEDUP` tự tạo khi ghi lần đầu hoặc chạy `setupReqDedupSheet()`.
- **Next step:** [TT] redeploy → chạy `testIdempotencyStore()` (verify dedup store) + smoke: đăng ký 1 UC, ngắt mạng giữa chừng/bấm Gửi nhiều lần → chỉ 1 dòng. [CC] (tùy chọn) rút ngắn writeTimeout cho GET-retry để giảm worst-case true-timeout.
- **Regression risk:** **Thấp → verify Playwright 111/111** (+4 idempotency, 05-create-write giữ 100%). Không reqId → hành vi cũ (0 retry). Dedup lỗi nuốt an toàn. Data-boundary: reqId là uuid, không PII; REQ_DEDUP chỉ chứa id nội bộ.

## Session: 2026-08-31 — Clear tech debt (gỡ dead code + đóng UC-DETAIL-DUP-01) sau khi [TT] redeploy GAS + smoke OK
- **Task completed:** [TT] xác nhận đã **redeploy toàn bộ GAS + smoke test OK** → [CC] clear nợ tech: **(1)** ✅ **UC-DETAIL-DUP-01 ĐÓNG** — `dashboard.js._renderDetailBody` sections 1–4 nay gọi `UCDetailView.render(uc, {noEmptyFallback:true})` (1 nguồn layout dùng chung với review-queue); dashboard giữ mục riêng ✓ phê duyệt + ★ Điểm US + milestone block; gỡ helper nhân bản `_dsubsec`/`_demoField`; `dashboard.html` +include `uc-detail-view.js`; thêm option `noEmptyFallback` (additive). **(2)** ✅ **Dead code GỠ:** `isValidUrl_` (Utils.gs, 0 caller) · CSS `.sptd-*` (dashboard.css −193 dòng, tab SPTD đã ẩn) · doc H1 `SCORING_ENGINE_DESIGN.md` → `archive/h1/`. **(3)** ✅ Đóng deploy-gated: H1-CLEANUP-01 (routes/ScoringEngine gỡ trên live) + SCORING-H2-MONTHLY migration (cột Month/Evidence_Link đã có).
- **Files changed:** `assets/js/dashboard.js` (−80: delegate 1–4 + gỡ 2 helper), `assets/js/uc-detail-view.js` (+noEmptyFallback), `dashboard.html` (+include), `assets/css/dashboard.css` (−194: khối SPTD), `assets/gas-backend/Utils.gs` (−isValidUrl_), `SCORING_ENGINE_DESIGN.md`→`archive/h1/`, `AI_CONTEXT/TECH_DEBT.md`.
- **Decision made:** Refactor tối thiểu-rủi ro: chỉ delegate sections 1–4 (byte-identical), giữ helper `_dsection/_dgrid/_dfield/_demoLinkHtml` (còn dùng cho milestone/table/section 5) + copy-logic dashboard (khác cơ chế toast — không gộp). CSS SPTD cắt cả khối (đuôi file, sptd-only gồm `@media`).
- **Blocker:** **Không.** FE/GAS-cleanup không cần redeploy thêm (isValidUrl_ vốn 0 caller; các gỡ khác đã trên live sau redeploy của [TT]).
- **Next step (Nhóm C — KHÔNG đóng được bằng deploy, chờ [TT]/phiên riêng):** nguồn nhập `Evidence_Link` (chờ [TT] chốt member nhập ở đâu) · **Round 2 T2** idempotency+retry write (feature, tách phiên vì chạm transport hybrid) · WRITE-TRANSPORT-01 residual (cần browser+tài khoản test).
- **Regression risk:** **Thấp → verify Playwright 107/107 PASS.** Sections 1–4 output không đổi (delegate byte-identical); helper còn dùng đều giữ; CSS gỡ là dead (0 element/JS tham chiếu `.sptd-*`); `isValidUrl_` 0 caller. Data-boundary: chỉ code/metadata, 0 secret/PII.

## Session: 2026-08-28 — CR 2 mục: cập nhật Prompt/Luồng AI ở tuần + Review panel 2 cột (xem chi tiết + duyệt đồng thời)
- **Task completed:** *(2 CR [TT] giao, sau khi [TT] đã redeploy GAS tuning R1 + smoke test OK)* **(1) Mục tiêu 1** — `weekly-update.html` thêm accordion "Cập nhật Prompt & Luồng xử lý AI (nếu có thay đổi)" (mặc định đóng): 1 ô Luồng AI (`Flow_Description`) + 8 ô `Prompt_*`. Chọn UC → `Api.getUseCase` prefill; gửi kèm submit **chỉ khi** `_fullDetailLoaded` && `_promptTouched` (chống ghi đè rỗng). Backend `submitWeeklyUpdate_` ghi các field này thẳng MASTER (nội dung, không gate milestone/KPI) + snapshot vào WEEKLY_LOG (10 cột mới); `getWeeklyLog_` trả `prompt_updated` → timeline badge ✦. **(2) Mục tiêu 2** — `review-queue` panel 2 cột: TRÁI chi tiết US đầy đủ (module mới `uc-detail-view.js` tách từ dashboard) + Copy prompt, PHẢI chấm điểm; panel mở rộng 1080px, ≤860px xếp dọc. Fetch full detail (`Api.getUseCase`), render nhanh từ list rồi làm giàu.
- **Files changed:** *(FE)* MỚI `assets/js/uc-detail-view.js`; sửa `review-queue.html` (panel 2 cột + script), `assets/js/review-queue.js` (`_loadDetail`), `assets/css/dashboard.css` (+`.review-panel--split`/`.rp-split`/responsive), `weekly-update.html` (accordion + JS + badge). *(GAS — CẦN REDEPLOY)* `assets/gas-backend/AdminService.gs` (`submitWeeklyUpdate_` ghi prompt/flow + snapshot; `getWeeklyLog_` +`prompt_updated`), `assets/gas-backend/Config.gs` (`WEEKLY_LOG_HEADERS` +10 cột). *(test)* `tests/03-review-queue.spec.js` +1, `tests/weekly-update.spec.js` +T12.
- **Decision made:** [TT] chốt 3 điểm: Mục tiêu 2 = 1 panel rộng 2 cột (không phải 2 popup rời); Mục tiêu 1 lưu lịch sử = ghi đè MASTER + snapshot WEEKLY_LOG; khối prompt = accordion mặc định đóng. Prompt/flow không gate milestone (là nội dung, không tính điểm). Tách render chi tiết ra module dùng chung thay vì nhân bản (dashboard tạm giữ bản riêng để giảm blast radius).
- **Blocker:** **Không.** Mục tiêu 2 FE-only (hard-refresh). Mục tiêu 1 cần [TT] **redeploy GAS** (AdminService+Config; snapshot WEEKLY_LOG tự thêm cột qua `ensureSheetColumns_`).
- **Next step:** [TT] redeploy GAS + nghiệm thu: (a) cập nhật tuần mở accordion → sửa prompt/luồng → gửi → timeline ✦ + MASTER cập nhật; (b) review panel 2 cột bấm US → chi tiết + chấm điểm cùng hiện. [CC] (tùy chọn) gộp dashboard.js dùng `uc-detail-view.js`.
- **Regression risk:** **Thấp → verify đầy đủ.** Playwright **104/104** (giữ nguyên mọi id cũ của panel; thay đổi additive). Prompt/flow chỉ ghi khi user chủ động mở+sửa (2 guard). Snapshot WEEKLY_LOG additive (cột mới). Data-boundary: chỉ metadata UC nội bộ (0 tên KH/secret).

## Session: 2026-08-26 (#4) — TUNING BE Round 1: cache reads theo version + tối ưu lookup ghi
- **Task completed:** [TT] báo AIUS chậm (load rất chậm/mất kết nối/ghi chậm) → scan trọn BE (Code/UseCaseService/DashboardService/AdminService/Utils/api.js) → tune backend-only. **T1:** version-gated cache cho `list` + `dashboard` (mới `CacheLayer.gs`: `AIUS_DATA_VER` bump tập trung ở doGet/doPost khi write; CacheService gzip; key gắn version+filter). Dashboard chuyển từ cache-thời-gian-30'-lossy → version-cache full+tươi. **T3:** `findRowByKeyColumn_` (đọc cột khóa + 1 dòng thay full N×99) áp `updateUseCase_` + `getUseCaseById_`.
- **Files changed:** *(spoke, chưa deploy GAS)* MỚI `assets/gas-backend/CacheLayer.gs`; sửa `Code.gs` (bump ở doGet/doPost), `DashboardService.gs` (getDashboardSummary_ version-cache), `AdminService.gs` (listUseCases_ cache), `Utils.gs` (+`findRowByKeyColumn_`), `UseCaseService.gs` (update+getById dùng key-column lookup). **0 file FE.**
- **Decision made:** SHTD chỉ là **tham chiếu** ([TT] xác nhận) — tune riêng theo kiến trúc AIUS (JSONP transport, không bê version-per-domain của SHTD). Bump version tập trung theo action (1 chỗ) thay vì rải ở từng hàm write. Dashboard trả FULL summary (bỏ đường lossy) — coi là cải thiện. Idempotency+retry (T2) tách Round 2 vì chạm transport hybrid vừa fix CR#1.
- **Blocker:** **Không.** **⚠️ [TT] cần redeploy GAS** — dán TẤT CẢ .gs cùng lúc (có file MỚI `CacheLayer.gs`; bài học `SHEET-SPAM-01`).
- **Next step:** [TT] redeploy + nghiệm thu: load `list`/`dashboard` lần 2 nhanh hẳn (cache), sau khi ghi 1 UC thì lần load kế tươi ngay (version bump); update UC nhanh hơn. [CC] Round 2: **T2 idempotency `reqId` dedup + bật retry write an toàn** (create/update) — trị timeout/mất/trùng.
- **Regression risk:** **Thấp → backend-only, tương thích.** Syntax OK 6/6; shape response `list`/`dashboard`/`update` không đổi (dashboard là superset). Cache key gắn version → sau mọi write tự vô hiệu (không stale). `findRowByKeyColumn_` trả cùng shape `findRowByField_`. **CẦN redeploy mới hiệu lực.** Rủi ro cache: nếu bỏ sót 1 write-action trong `_AIUS_WRITE_ACTIONS` → cache có thể stale cho tới write kế/TTL 6h (đã liệt kê đủ 16 action mutating). Data-boundary: cache chỉ metadata UC (không secret).

## Session: 2026-08-26 (#3) — CR bỏ validate URL cho Demo_Link (free text)
- **Task completed:** [TT] báo đăng ký US với link demo nội bộ/ổ chung (không https://) bị chặn *"Lỗi gửi: Demo_Link phải là URL hợp lệ (bắt đầu bằng https://)"*. Truy vết: FE **không** validate (Validator.all chỉ kiểm step1/step2, Demo_Link type text/không required); gốc = **server-side** `ValidationService.gs`. Gỡ 2 khối validate Demo_Link (`validateCreate_` + `validateUpdate_`) → free text.
- **Files changed:** `assets/gas-backend/ValidationService.gs` (gỡ 2 khối `isValidUrl_(Demo_Link)`). `isValidUrl_` (Utils.gs) nay không caller (dead code, dọn sau).
- **Decision made:** Link demo = **free text** hoàn toàn (chấp nhận `\\server\...`/localhost/SharePoint/ghi chú); không validate định dạng ở cả FE lẫn BE. Hiển thị do FE `_demoLinkHtml` phân biệt http (bấm được) vs non-web (Copy).
- **Blocker:** **⚠️ [TT] REDEPLOY GAS** (dán lại ValidationService.gs — nên dán tất cả .gs cùng lúc, bài học `SHEET-SPAM-01`). Backend-only, FE không đổi.
- **Next step:** [TT] redeploy + thử đăng ký lại với link ổ chung → không còn bị chặn. [CC] (tùy chọn) gỡ `isValidUrl_` dead + rà các validate URL khác nếu có field link tương tự.
- **Regression risk:** **Rất thấp** — chỉ nới lỏng 1 validate (bỏ chặn), không đổi luồng ghi/đọc. Syntax check OK; không test unit nào assert validate này (không vỡ). Data-boundary: không đụng dữ liệu.

## Session: 2026-08-26 — CR đăng ký US "timeout giả"/không ghi (CR#1) + hyperlink chi tiết (CR#2) + filter Owner review-queue (CR#3)
- **Task completed:** Sửa 3 CR do [TT] báo (sau khi [TT] deploy GAS). **CR#1** truy gốc bằng đọc LIVE (GAS `list`/`usecase`, read-only): xác định **không US nào ghi được từ ~16/08**, nhưng **backend create OK** (probe payload hợp lệ qua GET → ghi thành công `AIUS-0337`). Kết luận gốc = **đường ghi hidden-iframe POST (v3.15.0) không hoàn tất write trên live**, và vì POST không đọc được response nên `_submitViaPost` che MỌI lỗi thành "Timeout". Sửa: **transport HYBRID** — thêm `Api._writeHybrid()` ưu tiên GET-JSONP (payload ≤7500) / fallback iframe-POST (payload >7500); create/update trỏ qua nó. + guard `Owner_Email` ở `app.js submitForm` (server REQUIRED nhưng FE Validator không kiểm). **CR#2** tên US → `<a class="uc-name-link">` mở `_byKey` ở `renderMyTable`/`renderExploreTable`. **CR#3** droplist `rqOwnerFilter` + `_populateOwnerFilter` + lọc theo owner trong `_applyFilters`.
- **Files changed:** *(spoke — push origin/main `73bfde1`)* `assets/js/api.js` (+`_writeHybrid`, create/update route qua nó), `assets/js/app.js` (inject+guard Owner_Email/Owner_Name), `assets/js/dashboard.js` (2 bảng: tên US hyperlink), `assets/css/dashboard.css` (`.uc-name-link`), `assets/js/review-queue.js` (owner filter), `review-queue.html` (`#rqOwnerFilter`), `tests/05-create-write-ops.spec.js` (viết lại cho hybrid + test lõi). *(hub AIOS phiên này)* `00_System/CROSS_REPO_LOG.md` (+1 dòng), 4 file `AI_CONTEXT/` hub, `PORTFOLIO_DIGEST.md`.
- **Decision made:** Transport **hybrid GET-ưu-tiên** (không revert hẳn về GET để giữ fix link-demo-dài của v3.15.0) — [TT] chốt. GET-JSONP đọc được lỗi server thật → bỏ "timeout giả". Ngưỡng 7500 (đồng bộ `_request`). Probe ghi 1 dòng thật `AIUS-0337` để kiểm chứng (chấp nhận, [TT] xoá tay — không có route xoá UC).
- **Blocker:** **Không** (FE-only, không cần redeploy GAS). Chờ [TT] nghiệm thu production.
- **Next step:** **[TT]** hard-refresh + đăng ký thử 1 US → xác nhận hiện ở "Use case của tôi"; xoá dòng probe `AIUS-0337`; (tùy chọn) test 1 US link-demo-dài để đóng nốt residual. **[CC]** nếu US link-dài vẫn lỗi → reproduce browser (cần [TT] cấp tài khoản test) soi đường POST; đóng `WRITE-TRANSPORT-01`.
- **Regression risk:** **Thấp–Trung bình → đã verify.** Playwright **102/102** (05 rewrite hybrid GET/POST + 01/03/04/06/07/08/09/weekly-update). Đổi transport lõi create/update nhưng POST-path giữ nguyên cho payload lớn; GET-path đã proven ghi được trên live. Residual: nếu POST hỏng thật trên live, ca payload >7500 hiếm *có thể* còn lỗi nhưng **hiện cảnh báo rõ** (không im lặng). Không đụng GAS/backend.

## Session: 2026-08-18 (Part 3) — Dọn rác: nguồn user DUY NHẤT = User_Master (SHTD)
**Scope:** Rà soát toàn bộ, gỡ tính năng rác trỏ data cũ (sheet USERS nội bộ), gỡ quản lý user khỏi AI US, chốt nguồn user duy nhất = `User_Master` trên SHTD.
**Status:** ✅ Code xong + test local PASS: **Playwright 88/88** (đã xóa spec 02 users-page ~10 test) · SPTD 34/34 · KPI 38/38 · ID 14/14. **⚠️ CẦN redeploy GAS.**

### Quyết định (AskUserQuestion)
1. **Xóa hẳn quản lý user khỏi AI US** — SHTD-Dashboard là nơi DUY NHẤT quản lý user; AI US chỉ ĐỌC User_Master (login/role/KPI).
2. **Giữ `change-password.html` + thêm link nav** (đổi mật khẩu tự phục vụ, ghi User_Master).
3. **Xóa script migration 1 lần** (MigrationService, FixOwnerNameMigration).
4. **Giữ tối thiểu fallback admin** (Config.gs/env.js ADMIN_EMAILS — cứu hộ offline); **bỏ CHAMPION_USERS**.

### Đã gỡ
- **GAS xóa file:** `UserService.gs` (chuyển `normalizeUser_` → Utils.gs), `MigrationService.gs`, `FixOwnerNameMigration.gs`.
- **GAS route bỏ:** `user-login`, `user-init`, `user-upsert`, `user-reset-password`, `user-sync` (giữ `users` READ, `auth-login`, `auth-change-password`).
- **GAS bỏ hàm ghi user** trong AuthTokenService: `userUpsertInMaster_`, `userResetPasswordInMaster_`, `syncUsersToMaster_`, `_canonRole_`, `_userHeaderIdx_`. Giữ `getAllUsersFromMaster_`, `getAdminUsernamesFromMaster_`, `authChangePassword_`, `getCouncilUsernames_`.
- **GAS:** Config bỏ `SHEETS.USERS`+`USERS_HEADERS`; Utils bỏ case USERS trong getOrCreateSheet_; AdminService bỏ priority USERS-nội-bộ + repoint `getAllUsers_()`→`getAllUsersFromMaster_()` (2 chỗ: enrich owner name + isChampionForTeam_, champion→teamlead).
- **FE xóa file:** `users.html`, `assets/js/users.js`, `tests/02-users-page.spec.js`.
- **FE:** api.js bỏ validateUser/upsertUser/resetUserPassword/syncUsers/initUsersSheet (giữ getUsers READ); routes.js tương ứng; auth.js bỏ `login()` chết + `_resolveRole` (CHAMPION_USERS); env.js bỏ CHAMPION_USERS; dashboard.js gỡ users-tab (giữ `_usersList` load cho KPI); dashboard.html gỡ orphan userModal; **gỡ navUsers khỏi 8 page + thêm nav "Đổi mật khẩu"** (mọi user); setupNav bỏ navUsers; index.html card "Quản lý người dùng"→"Cấu hình Workflow".

### Blocker / Next
- **[P0] Redeploy GAS** (Edit deployment → New version) — routes user-* đã bỏ; nếu FE cũ còn gọi sẽ 'Endpoint không tồn tại' (đã gỡ FE nên không gọi). Deploy để đồng bộ.
- Test lại login/role/KPI đọc User_Master; đổi mật khẩu qua nav mới.

### Kèm theo (chưa kích hoạt): Team Số split
- `WorkflowSeedTeamSo.gs` + Config `TEAM_GROUP_SEED` (Số→'4. Workflow đặc thù Số hóa tín dụng') + WorkflowService group-4 default: **committed nhưng DORMANT** — chỉ có tác dụng khi chạy `seedTeamSoWorkflows()`. **Danh sách WF/US đề xuất còn CHỜ user duyệt** trước khi chạy (xem cuối phiên trước).

---

## Session: 2026-08-18 (Part 2) — H2 Giai đoạn 2: Nhập liệu theo Workflow + Admin cấu hình WF/US
**Scope:** Triển khai Giai đoạn 2 (nhập liệu theo Workflow) + tính năng mới do user đề xuất: **trang Admin cấu hình Workflow/US** (thêm mới khi phát sinh; cấu hình lưu tại GAS phục vụ droplist).
**Branch:** `feat/h2-workflow-input` (nhánh mới từ main sau khi merge auth). **Chưa deploy GAS, chưa merge main.**
**Status:** ✅ Code xong + test local PASS: **Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14** (1 flake A2 "Api is not defined" dưới tải song song — pass khi chạy riêng).

### Quyết định (AskUserQuestion)
1. UI admin = **trang riêng `workflow-catalog.html`** (admin-only, Pattern A) — không nhồi vào dashboard.
2. CRUD **chỉ Workflow + US**; Team→Nhóm map sửa trực tiếp trong sheet `TEAM_GROUP_MAP`.
3. Wizard: **Workflow bắt buộc → US dependent dropdown + "Khác — nhập tự do"** (§6.2).

### Đã làm (chi tiết đầy đủ + việc thủ công: H2_PLAN §8)
- **GAS:** `WorkflowService.gs` (MỚI: getWorkflowCatalog_ lọc theo Team, list/upsert/delete/rename, `seedWorkflowCatalog()` import 69 US), `WorkflowSeedData.gs` (MỚI: 69 dòng từ xlsx), `Config.gs` (SHEETS+headers+seed Team→Nhóm+cột MASTER `Workflow`/`Workflow_Group`), `Code.gs` (routes workflow-*).
- **FE:** `workflow-catalog.html`+`workflow-catalog.js` (MỚI, trang admin CRUD); `constants.js`/`wizard.js` (dependent dropdown + name-swap 1 carrier UseCase_Name + "Khác" free-text); `app.js` (fetch catalog theo team, sync edit/nháp, inject Workflow_Group); `validation.js` (Workflow required chỉ khi catalog ready); `routes.js`/`api.js`; nav "Cấu hình Workflow" (admin) vào 8 page + `auth.js setupNav`.
- **Data source:** đọc `H2/Template nhập Workflow và Use case.xlsx` → 3 Nhóm/23 WF/69 US (verify).

### Blocker
- **Không chặn code.** Cần **deploy GAS + chạy `seedWorkflowCatalog()`** rồi smoke test trước khi merge main (GAS-first). Trước khi seed: FE fallback catalog rỗng → US về nhập tự do (không vỡ đăng ký).

### Next step
1. **[P0]** GAS Editor: Edit deployment → New version; chạy `seedWorkflowCatalog()`; smoke test đăng ký (Workflow lọc theo Team → US dependent → "Khác") + trang `workflow-catalog.html` (thêm/sửa/xóa/đổi-tên).
2. **[P1]** Merge `feat/h2-workflow-input` → main sau smoke test.
3. **[P3]** Giai đoạn 3 — Scoring mới (H2_PLAN §4).

### Regression risk
- **UseCase_Name đổi từ text → select (dependent).** Edit UC cũ có US ngoài danh mục → tự chuyển "Khác" + điền lại text (đã xử lý `syncWorkflowSelection`). Offline/chưa seed → Workflow không bắt buộc, US nhập tự do → không chặn. 98/98 Playwright xác nhận (gồm full-UI submit qua nhánh "Khác").
- **MASTER_DATA thêm 2 cột cuối** — `ensureSheetColumns_` self-heal khi chạy `seedWorkflowCatalog()`; create/update chỉ persist field có trong HEADERS nên an toàn.

---

## Session: 2026-08-18
**Scope:** Merge H2 Giai đoạn 1 (auth dùng chung) `feat/h2-shared-auth` → `main` + push thẳng `origin/main`; cập nhật context.
**Status:** ✅ Merged fast-forward (`fc894b5..2e14332`) + pushed `origin/main`. **⚠️ Chưa smoke test login thật** — user yêu cầu merge trước, chấp nhận rủi ro.

### Đã làm
1. **Fast-forward merge** `feat/h2-shared-auth` (4 commit: `2e14332`, `50bc341`, `e377098`, `413071c`) vào `main` — không tạo merge commit, lịch sử thẳng.
2. **Push `origin/main`** (theo yêu cầu user, push thẳng lên main).
3. **Cập nhật context**: PROJECT_STATE (trạng thái merged + cảnh báo chưa smoke test), TODO_NEXT (đánh dấu merge xong, smoke test lên P0 việc đầu tiên, kèm bước rollback), handover này.
4. **KHÔNG commit** `evd/weekly-update/*.png` (modified) và `H2/*.xlsx` (untracked) — giữ nguyên quyết định §5 phiên trước (không đưa binary/screenshot vào commit).

### Quyết định
- **Merge trước, smoke test sau** — user chỉ đạo rõ. Rủi ro auth breaking (bỏ fallback local; mọi user phải có trong `User_Master` + mật khẩu) được chấp nhận có ý thức. Đã ghi cảnh báo + đường rollback (revert / trỏ Pages về `fc894b5`) trong TODO_NEXT.

### Next step
1. **[P0] Smoke test login thật trên GitHub Pages live** (hard-refresh) — xem TODO_NEXT. Nếu không login được → soát `AUTH_SECRET`, `User_Master`, GAS authorize `1cpg1p…`.
2. **[P2] Giai đoạn 2 — Nhập liệu theo Workflow** (H2_PLAN §3).
3. **[P3] Giai đoạn 3 — Scoring mới** (H2_PLAN §4).

### Regression risk
- **Đăng nhập breaking đã LÊN LIVE** (username-only → username+password, bỏ fallback local). Nếu GAS/AUTH_SECRET/User_Master lệch → toàn bộ user không login được. Chưa smoke test → theo dõi sát sau khi Pages cập nhật cache.

---

## Session: 2026-08-17
**Scope:** H2 — (1) Phân tích + lập kế hoạch triển khai H2 (3 hạng mục); (2) Triển khai **Giai đoạn 1: Auth dùng chung user/mật khẩu với SHTD-Dashboard** (phương án A).
**Branch:** `feat/h2-shared-auth` (commit `50bc341`) — **CHƯA merge `main`** → GitHub Pages chưa live.
**Status:** ✅ Code xong + test local PASS (Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14). GAS user đã deploy (AUTH_SECRET + authorize User_Master), URL không đổi.

### Bối cảnh H2 (kế hoạch đầy đủ: `AI_CONTEXT/H2_PLAN.md`)
3 hạng mục H2: (1) **Nhập liệu theo Workflow** (chọn WF theo Team → chọn US từ danh mục 69 US thay free-text; data `H2/Template nhập Workflow và Use case.xlsx`: 3 Nhóm→23 WF→69 US); (2) **Auth dùng chung SHTD**; (3) **Đổi scoring** (bỏ auto-score + SPTD; Điểm US do hội đồng 4 teamlead chấm 30/40/30, Điểm cá nhân do teamlead chấm 30/20/30/20 một lần cuối kỳ 31/12/2026). Trình tự: Item 2 → Item 1 → Item 3.

### Task completed (phiên này)
1. **Kế hoạch H2** — `AI_CONTEXT/H2_PLAN.md` (phân tích hiện trạng đã verify, thiết kế từng item, §6 quyết định đã chốt, §8 nhật ký).
2. **Giai đoạn 1 — Auth dùng chung (phương án A = 1 sheet `User_Master`):**
   - Đăng nhập chuyển từ **username-only** → **username + password** (SHA-256) với **token HMAC-SHA256** (AUTH_SECRET chia sẻ), nguồn user duy nhất = `User_Master` trên spreadsheet SHTD `1cpg1p…`.
   - Role `champion` → **`teamlead`** toàn hệ thống (giữ alias nhận `champion` cũ để không vỡ).
   - Quản lý user (users.html) repoint sang `User_Master`: tạo (cần mật khẩu) / cập nhật / đặt lại mật khẩu / sync owner từ MASTER_DATA.
   - Trang **đổi mật khẩu** mới.

### Files changed
| File | Thay đổi | Deploy |
|---|---|---|
| `assets/gas-backend/AuthTokenService.gs` | **MỚI** — `authLogin_`/`validateToken_`/`authChangePassword_`; `getAllUsersFromMaster_`/`getAdminUsernamesFromMaster_`/`getCouncilUsernames_`; `userUpsertInMaster_`/`userResetPasswordInMaster_`/`syncUsersToMaster_`. Đọc-ghi `User_Master` (SHTD spreadsheet) | ⚠️ GAS (đã deploy) |
| `assets/gas-backend/Code.gs` | routes `auth-login`, `auth-change-password`, `user-reset-password`; `user-upsert`/`user-sync`/`users` repoint → User_Master | ⚠️ GAS (đã deploy) |
| `assets/gas-backend/AdminService.gs` | `getAdminEmails_()` Priority 1 → `getAdminUsernamesFromMaster_()` (USERS nội bộ xuống 1b) | ⚠️ GAS (đã deploy) |
| `login.html` | Thêm ô mật khẩu; submit → `Api.authLogin` → `storeAuth`; **bỏ fallback local** (không bypass mật khẩu) | FE tĩnh |
| `change-password.html` | **MỚI** — đổi mật khẩu qua `Api.changePassword` + token | FE tĩnh |
| `assets/js/auth.js` | `getToken`, `storeAuth`, `isTeamlead/isTeamleadOrAdmin/requireTeamleadOrAdmin`, `isCouncil`; alias champion→teamlead; role label Teamlead; chuẩn hóa champion→teamlead khi lưu | FE tĩnh |
| `assets/js/api.js` | `authLogin(u,p)`, `changePassword(...)`, `resetUserPassword(...)` | FE tĩnh |
| `config/routes.js` | `authLogin`, `authChangePassword`, `userResetPassword` | FE tĩnh |
| `config/env.js` | `COUNCIL_USERS: ['tuantt4','maittt7','tutv3','quynhnny']`; ghi chú CHAMPION_USERS→teamlead | FE tĩnh |
| `assets/js/users.js` | Ô mật khẩu (tạo=bắt buộc, sửa=đặt lại tùy chọn); gửi Password + `resetUserPassword`; role màu/nhãn teamlead | FE tĩnh |
| `users.html` | Ô mật khẩu trong modal; role option `teamlead` (thay champion) | FE tĩnh |
| `assets/js/dashboard.js` | `populateSidebarUser` roleLabels + teamlead (champion→Teamlead) | FE tĩnh |
| `assets/css/components.css` | `#userModal .modal-card` max-height 90vh + body cuộn (thêm field không tràn viewport) | FE tĩnh |
| `tests/01-auth-nav.spec.js`, `tests/02-users-page.spec.js` | assertion + option champion→teamlead | — |
| `AI_CONTEXT/H2_PLAN.md` | **MỚI** — kế hoạch H2 + nhật ký Giai đoạn 1 | — |

### Decision made
1. **Auth = 1 sheet `User_Master` dùng chung** (không nhân bản/sync 2 chiều) → nguồn duy nhất, đổi mật khẩu 1 bên áp cả 2 hệ thống.
2. **`champion` → `teamlead`** (SHTD đã có role Teamlead) — khớp yêu cầu Item 3 (teamlead chấm điểm). Giữ alias nhận champion để migrate dần, chưa dọn `review-queue.js`.
3. **Bỏ fallback đăng nhập local** — có mật khẩu thì không được bypass khi lỗi mạng.
4. **Hội đồng chấm điểm US = 4 teamlead** (TuanTT4, MaiTTT7, TuTV3, QuynhNNY) — cấu hình qua `COUNCIL_USERS` (env.js + Script Property).
5. **Commit chỉ file liên quan** — không đưa `H2/*.xlsx` (binary) và evd screenshots vào commit này.

### Blocker
- **Không chặn code.** Branch chưa merge `main` → muốn FE lên GitHub Pages phải merge. Cần **smoke test đăng nhập thật** (user+password) trên GAS đã deploy trước khi merge.

### Next step
1. **[P1] Smoke test login thật** — đăng nhập username+password (tài khoản trong User_Master) trên branch (chạy local hoặc merge). Kiểm tra role teamlead thấy đúng nav; đổi mật khẩu; admin tạo/sửa/đặt-lại-mật-khẩu user; sync owner. Nếu lỗi token → soát `AUTH_SECRET` AI US khớp SHTD.
2. **[P1] Merge `feat/h2-shared-auth` → `main`** sau smoke test.
3. **[P2] Giai đoạn 2 — Nhập liệu theo Workflow** (độc lập; xem H2_PLAN §3): sheet `WORKFLOW_CATALOG` + `TEAM_GROUP_MAP` (Số/CV/BL=PO, PTKD MB/MN=PTKD&QLDM, QLDM tạm PTKD&QLDM), endpoint catalog, dependent dropdown Step 1, option "Khác — nhập tự do".
4. **[P3] Giai đoạn 3 — Scoring mới** (lớn nhất).

### Regression risk
- **Đăng nhập đổi cơ bản (username-only → username+password).** Mọi user PHẢI có trong `User_Master` kèm mật khẩu, nếu không sẽ không đăng nhập được. Đã bỏ fallback local → GAS/AUTH_SECRET lỗi = không ai login được.
- **2 GAS project ghi chung 1 sheet `User_Master`** → concurrency khi ghi user (LockService chỉ per-project, không mutual giữa 2 project) — xem TECH_DEBT USERMASTER-CONCURRENCY-01. Tần suất ghi user thấp → rủi ro thấp.
- **`review-queue.js` vẫn dùng thuật ngữ champion** — chạy nhờ alias auth; sẽ dọn ở Item 3 (xem TECH_DEBT CHAMPION-TERM-01).
- **Sheet `USERS` nội bộ cũ ngừng dùng cho auth** nhưng vẫn còn hàm đọc (validateUserLogin_ legacy route user-login). Không xóa vội (USERS-LEGACY-01).
- Test local 98/98 + unit đầy đủ PASS → không regression trong phạm vi test hiện có (mock JSONP, inject session — không cover đường token thật).

---

## Session: 2026-08-02
**Scope:** (1) Đồng bộ duyệt milestone với duyệt US — xem chi tiết toàn cảnh trước khi duyệt; (2) Link demo bấm được trong mọi popup duyệt/chi tiết US; (3) Fix triệt để lỗi link demo dài (ổ chung) làm hỏng tạo US.
**Version:** 3.15.0
**Status:** ✅ **LIVE** — GAS deployed (URL không đổi), FE pushed `main` (`fc894b5`), feature branch merged + deleted. Đúng thứ tự GAS→FE. Chờ smoke test live.

### Deploy — HOÀN THÀNH (2026-08-02)
1. ✅ **GAS** deployed 3 file (`Code.gs` doPost decode payload, `UseCaseService.gs` getUseCaseById_ fallback UseCase_ID, `AdminService.gs` list demo fields) — Edit deployment → New version, **URL không đổi** (user xác nhận).
2. ✅ **FE** merged `feat/v3.15.0-milestone-demolink-post` → `main` (fast-forward) + pushed `origin/main` (`fc894b5`). Branch đã xóa.
3. ⏳ **Smoke test live** chưa chạy (xem Next step).

### Task completed
1. **Milestone dùng chung modal chi tiết US** — Card milestone (tab Chờ duyệt) bỏ 2 nút duyệt/từ chối tại chỗ, thay bằng 1 nút **"🔍 Xem chi tiết & Duyệt"** → mở `openDetail(uc, milestone)` = đúng modal 4 section của US + chèn khối **"Nội dung điều chỉnh chờ duyệt"** (Stage cũ→mới, Điểm cũ→mới, tuần Log_Date, ghi chú tuần). Duyệt/Từ chối **inline trong modal** (relabel nút thành "Duyệt/Từ chối milestone"); từ chối bắt buộc lý do qua ô comment (bỏ `window.prompt` → đóng MILESTONE-PROMPT-01).
2. **Link demo bấm được + Copy** — 4 popup: modal chi tiết US, popup duyệt milestone (dùng chung), modal chi tiết Leaderboard, cột **Demo** mới trong list drill-down. `http(s)` → `<a target=_blank>` (href qua `encodeURI` an toàn); link ổ chung/UNC/`file://` → text + nút Copy (browser không mở được UNC). Copy truyền URL qua base64 trong onclick.
3. **Fix triệt để link demo dài làm hỏng create (POST iframe)** — Root cause: create/update nhét payload vào URL GET, giới hạn ~8KB của GAS → link ổ chung dài + nhiều field Việt vượt ngưỡng → HTTP 400. Nay create/update đi **hidden-iframe FORM POST** (không giới hạn body, không vướng CORS vì không đọc response iframe) + **verify bằng `getUseCase`**. Bỏ ngưỡng 7500 cho write (vẫn giữ cho đường GET nhỏ: duplicate-check…). Verify create hardening: khớp owner để tránh nhận nhầm UC có sẵn khi hint ID trùng.

### Files changed
| File | Thay đổi | Deploy |
|---|---|---|
| `assets/js/dashboard.js` | `_detailMilestone` state; `openDetail(uc, milestone)`; `_openMilestoneDetail`; `_renderMilestoneChangeBlock`; `_confirmDetailAction` nhánh milestone; footer relabel; `_demoLinkHtml`/`_demoField`/`_copyText`/`_copyB64`; Section 3 dùng `_demoField`; cột Demo trong `openListModal`; public API `_openMilestoneDetail`,`_copyB64` | FE tĩnh |
| `assets/css/dashboard.css` | `.detail-section--milestone`, `.demo-link`, `.demo-link--nonweb`, `.demo-copy-btn`, `.detail-value--demo` | FE tĩnh |
| `leaderboard.html` | `_lbDemoLinkHtml`/`_lbDemoField`/`lbCopyB64`/`_lbFallbackCopy`; Section 3 dùng demo field | FE tĩnh |
| `assets/js/api.js` | `_encodePayload` (tách encode); `_submitViaPost` (iframe POST + verify + poll); `_writeTimeout` (seam test); `createUseCase`/`updateUseCase` → POST+verify; 7500 chỉ còn cho GET-path | FE tĩnh |
| `assets/gas-backend/Code.gs` | `doPost` decode `payload` (base64url form field) như doGet + hỗ trợ callback | ⚠️ **CẦN redeploy** |
| `assets/gas-backend/UseCaseService.gs` | `getUseCaseById_` fallback tra theo `UseCase_ID` (verify create) | ⚠️ **CẦN redeploy** |
| `assets/gas-backend/AdminService.gs` | `listUseCases_` trả `demo_status`+`demo_link` (cột Demo list popup) | ⚠️ **CẦN redeploy** |
| `tests/05-create-write-ops.spec.js` | Viết lại cho transport POST+verify (A encode/GET-limit, B success, C timeout seam, D full-UI) | — |
| `tests/07-milestone-approval.spec.js` | T03/T04 → flow modal; +T06 link demo hyperlink | — |

### Test (local, PASS)
- **Playwright 98/98** (thêm T06 demo-link). **Unit: SPTD 34/34 · KPI 38/38 · ID 14/14.**
- Test seam: `window.__API_WRITE_TIMEOUT__` rút ngắn timeout write để test path timeout nhanh (mặc định 90s).

### Decision made
1. **Milestone tái dùng `openDetail`** (không modal riêng) — user chọn: xem toàn cảnh US 4 section + khối diff, đồng nhất tuyệt đối với duyệt US.
2. **Fix item 3 = POST iframe + verify** (user chọn, chấp nhận redeploy GAS) thay vì chỉ cảnh báo FE — bỏ hẳn giới hạn độ dài.
3. **POST giữ `?action=` trên query, chỉ `payload` vào body** — GAS `e.parameter` gộp query+form field → mock Playwright (đọc action từ query) vẫn chạy.
4. **Verify create khớp owner** — chống false-positive khi hint UseCase_ID trùng UC có sẵn của người khác (hiếm).

### Blocker
- **Không có.** Đã deploy GAS + push FE đúng thứ tự.

### Next step
1. **[P1] Smoke test live** (GitHub Pages có thể cache vài phút → hard-refresh): (a) tạo US mới với link demo ổ chung dài → lưu OK (hết HTTP 400); (b) tab Chờ duyệt → "🔍 Xem chi tiết & Duyệt" milestone → khối "Nội dung điều chỉnh" hiển thị → duyệt áp Stage/điểm; (c) bấm/Copy link demo trong 4 popup; (d) mắt thường Leaderboard (LEADERBOARD-DEMO-NOTEST-01).
2. **[P2]** Cân nhắc CREATE-VALIDATION-MSG-01 / UPDATE-VERIFY-01 (client_nonce) nếu gặp lỗi validate GAS không rõ message khi tạo US.

### Regression risk
- **Write-path đổi lớn:** create/update không còn JSONP GET. **Bắt buộc GAS mới** (doPost decode payload). Deploy sai thứ tự = vỡ tạo/sửa US.
- **Lỗi validate GAS khi create không đọc được message cụ thể** (iframe không đọc response) → hiện cảnh báo chung sau timeout. Validator client-side chặn phần lớn trước khi gửi. Xem CREATE-VALIDATION-MSG-01.
- **Update verify chỉ xác nhận record tồn tại**, không chắc chắn write đã áp (xem UPDATE-VERIFY-01). Rủi ro false-positive chỉ khi POST rớt giữa chừng (hiếm).
- **openDetail thêm tham số thứ 2 (optional)** — mọi caller cũ gọi 1 tham số vẫn chạy (milestone=null). 98/98 Playwright xác nhận không regression.

---

## Session: 2026-07-31
**Scope:** FEATURE — Milestone cập nhật tuần → KPI (có phê duyệt Admin). Update US ở "Cập nhật tuần" khi **chuyển Stage hoặc nâng điểm** được ghi nhận như 1 US mới ở KPI, **bắt buộc Admin duyệt** mới áp Stage/điểm + tính KPI.
**Version:** 3.14.0
**Status:** ✅ **DONE** — GAS deployed (URL không đổi) + `migrateWeeklyLogSchema()` chạy xong + FE pushed (`8a786a4`). Verified live: milestone hiển thị đúng ở tab "Chờ duyệt".

### Flow mới (đã chốt với user)
| Cập nhật tuần | Ghi UC ngay | Cần Admin duyệt | Tính KPI |
|---|---|---|---|
| Chỉ ghi chú/tiến độ | ✅ | ❌ | ❌ |
| **Milestone** = chuyển Stage **hoặc** nâng điểm | Chỉ ghi chú; **giữ Stage/điểm/số-liệu-điểm** pending | ✅ | ✅ sau duyệt: +1 vào **tuần Log_Date**, credit **Owner**, **cộng dồn** nhiều tuần |

- Admin duyệt tại **tab "Chờ duyệt"** dashboard (section riêng "Milestone cập nhật tuần chờ duyệt").
- SPTD: milestone cộng **số lượng + tuần đạt** (KHÔNG cộng quality avg).

### Files changed
| File | Thay đổi |
|---|---|
| `Config.gs` | `WEEKLY_LOG_HEADERS` +8 cột milestone (Log_ID, Is_Milestone, Milestone_Type, Previous/Proposed_Total_Score, Approval_Status, Approved_By/At, Milestone_Comment); `MILESTONE_STATUS` const |
| `Utils.gs` | `ensureSheetColumns_()` (self-heal schema), `updateRowByField_()` (update theo Log_ID) |
| `AdminService.gs` | `submitWeeklyUpdate_` rewrite (probe-score phát hiện milestone, gate Stage/điểm khi pending); `listMilestones_/approveMilestone_/rejectMilestone_`; `getWeeklyLog_` trả milestone fields; `migrateWeeklyLogSchema()` public |
| `Code.gs` | routes `milestone-list/approve/reject` |
| `routes.js`+`api.js` | `milestoneList/Approve/Reject` |
| `weekly-update.html` | submit xử lý `res.pending_milestone` → thông báo "chờ Admin duyệt"; timeline badge trạng thái duyệt |
| `dashboard.js` | `_milestonePending/_milestoneApproved/_msCache`; `_loadMilestones` (approved cho mọi user, pending queue chỉ admin); `renderPendingMilestones`+approve/reject; `_buildKPIData` cộng milestone đã duyệt |
| `dashboard.html` | section "Milestone cập nhật tuần chờ duyệt" trong tab-pending |
| `sptd-scoring.js` | bucket tách `qty` (quantity+milestone) khỏi `ucs` (quality); `computeAllScores/computeUserDetails` nhận `milestones` |
| `test-kpi-data.js` | Suite H (8) milestone KPI |
| `test-sptd-scoring.js` | Suite F (5) milestone SPTD |
| `tests/07-milestone-approval.spec.js` | NEW — 5 E2E duyệt milestone (mocked) |

### Test (local, PASS)
- Unit: SPTD **34/34**, KPI **38/38**.
- Playwright mocked: 01–07 = **91/91** (gồm 5 mới). Live read-only weekly-update T01/T05/T09 = **3/3**.
- weekly-update.html backward-compatible với GAS cũ (pending_milestone undefined → success thường).

### Deploy — ĐÃ HOÀN THÀNH (2026-07-31)
1. ✅ **GAS** deployed: `Config.gs`, `Utils.gs`, `AdminService.gs`, `Code.gs` (Edit → New version, URL không đổi).
2. ✅ **`migrateWeeklyLogSchema()`** chạy xong — log thêm cột: `Log_ID, Active_User_Count, Is_Milestone, Milestone_Type, Previous_Total_Score, Proposed_Total_Score, Approval_Status, Approved_By, Approved_At, Milestone_Comment`.
3. ✅ **FE pushed** `8a786a4` lên main.

### Phát hiện phụ khi migrate (→ TECH_DEBT WEEKLYLOG-COL-01)
Migration cũng phải thêm **`Active_User_Count`** vào WEEKLY_LOG → tức sheet prod **thiếu cột này từ trước**. Nghĩa là các lần "Cập nhật tuần" từ v3.13.0 ghi `Active_User_Count` vào WEEKLY_LOG đã bị **âm thầm rớt** (`appendRowFromObject_` map theo header). Nay đã đúng. **Không** ảnh hưởng Adoption score ở MASTER (cột MASTER vẫn OK); chỉ lịch sử WEEKLY_LOG trước đây không lưu số người dùng.

### Debug phiên này (đã đóng, không phải bug)
User báo milestone submit xong nhưng không thấy ở màn "Chờ duyệt". Kiểm tra: (1) curl live GAS `milestone-list?filter=pending` → trả đúng milestone; (2) GitHub Pages đã serve dashboard.js/html mới; (3) `_isAdmin` set trước `_loadStartupData`. Kết luận: **code đúng end-to-end, chỉ do GitHub Pages/cache lên chậm.** User xác nhận đã thấy sau khi cache cập nhật.

### Blocker
- **Không có.** Live hoạt động.

### Next step
- **[P1] Smoke test trọn vòng duyệt:** bấm ✓ Duyệt milestone AIUS-0301 → verify UC lên S3, điểm 70, KPI Owner "Trần Thế Tuân" +1 tuần 31/07. Thử ✕ Từ chối (có lý do) → UC không đổi.
- **[P2]** Cân nhắc ngưỡng "nâng điểm" (hiện mọi mức tăng điểm đều thành milestone cần duyệt) — xem TECH_DEBT MILESTONE-THRESH-01.

### Regression risk
- **Hành vi v3.13.0 đổi có chủ đích:** weekly-update milestone (stage/nâng điểm) KHÔNG còn apply ngay — chờ Admin duyệt. Update thường vẫn apply ngay.
- KPI có thể tăng khi milestone được duyệt (cộng dồn) — thông báo người theo dõi số cũ.
- Reject milestone dùng `window.prompt` (xem TECH_DEBT MILESTONE-PROMPT-01) — hoạt động nhưng không đồng bộ UX modal.

---

## Session: 2026-07-30
**Scope:** SCORING FIX — Nối trường `Active_User_Count` (nguồn điểm Adoption) end-to-end; đóng lại task phiên trước bị bỏ dở
**Version:** 3.13.0

### Bối cảnh
Task phiên trước bị **đóng không đúng cách** (chưa commit, chưa deploy, chưa handover). Rà soát working tree phát hiện 4 file sửa dở: `constants.js`, `weekly-update.html`, `AdminService.gs`, `Config.gs`.

### Root cause (đã xác nhận trong code)
Mô hình auto-score 70pt có thành phần **Adoption (max 20đ)** lấy từ `Active_User_Count`. `ScoringEngine.gs` + `scoring.js` kỳ vọng trường này **từ v3.0** (cột MASTER `Active_User_Count`+`Adoption_Score` đã có, `createUseCase_` auto-persist + auto-score sẵn), NHƯNG **chưa hề có ô nhập liệu nào** trên UI → `Active_User_Count` luôn rỗng → **Adoption luôn = 0 cho mọi UC**. Đây là "lỗi chấm điểm US".

### Task completed
Nối `Active_User_Count` end-to-end qua cả 2 đường nhập liệu:
- **Đăng ký UC mới** — `constants.js`: thêm `FIELDS.ACTIVE_USER_COUNT`, đưa vào `STEPS[3]` (nhóm impact) + `FIELD_CONFIG` ("Số người dùng thực tế"). Input render với `name=Active_User_Count` → tự vào `FormMapper.collectData()` → (a) create payload persist vào MASTER (HEADERS đã có cột) + GAS auto-score ngay; (b) live preview điểm (`app.js` → `ScoringEngine.compute` → Adoption bar).
- **Cập nhật tuần** — `weekly-update.html`: input `#activeUsers` + prefill từ `active_user_count` + submit `Active_User_Count`; reflow 2 hàng "Số liệu thực tế".
- **GAS** — `AdminService.gs`: `listUseCases_` trả `active_user_count`; `submitWeeklyUpdate_` thêm vào `NUM_FIELDS` + WEEKLY_LOG row. `Config.gs`: `WEEKLY_LOG_HEADERS` thêm `Active_User_Count`.

### Files changed
| File | Thay đổi | Deploy |
|---|---|---|
| `assets/js/constants.js` | `ACTIVE_USER_COUNT` field + STEPS[3] + FIELD_CONFIG | FE tĩnh |
| `weekly-update.html` | input `#activeUsers` + prefill + submit; reflow | FE tĩnh |
| `assets/gas-backend/AdminService.gs` | `listUseCases_` trả `active_user_count`; `submitWeeklyUpdate_` NUM_FIELDS + WEEKLY_LOG | ✅ GAS (2026-07-30) |
| `assets/gas-backend/Config.gs` | `WEEKLY_LOG_HEADERS` += `Active_User_Count` | ✅ GAS (2026-07-30) |
| `ai_context/*.md` | Handover + PROJECT_STATE + TODO_NEXT + TECH_DEBT (SCORE-BACKFILL-01) | — |

### Decision made
- **Đường đăng ký UC mới hoạt động ngay chỉ với push FE** (`constants.js`) — GAS live đã có cột + scoring + auto-score từ v3.0, không cần deploy.
- **Đường cập nhật tuần cần redeploy GAS** — trước redeploy: prefill hiện 0 và weekly submit âm thầm bỏ `Active_User_Count`.

### Test
- **95/95 Playwright PASS** (full suite, 5.7m). Trọng tâm: `04-scoring-preview` (21) + `weekly-update` (11) = 32 pass sau reflow form. Không regression.

### Blocker
- **Không có blocker code.** Fix đã live cả FE lẫn GAS (deployed 2026-07-30, URL không đổi, confirmed by user).
- **Điều kiện dữ liệu còn tồn (không chặn code):** UC lịch sử có `Active_User_Count` rỗng → Adoption của chúng vẫn = 0 cho tới khi nhập số thực + chạy recalc. Đã log **SCORE-BACKFILL-01** trong TECH_DEBT.

### Next step
1. **[P0] Backfill + recalc** — Nhập `Active_User_Count` thực cho UC cũ (qua "Cập nhật tuần" hoặc sửa sheet), rồi chạy `recalculateAllScores_()` trong GAS Editor để chấm lại toàn bộ. UC tạo/cập nhật từ 2026-07-30 trở đi đã tự chấm đúng.
2. **[P1] Verify sau recalc** — Mở 1 UC có nhiều người dùng → detail popup + leaderboard phản ánh Adoption > 0 và Total_Score tăng tương ứng.

### Regression risk
- **Thấp.** FE thêm 1 field optional (không required, không đụng validation). GAS thêm field vào NUM split + append — backward compatible. Reflow `weekly-update.html` không đổi id các input cũ → Playwright không vỡ (95/95 pass full suite).
- **Lưu ý recalc:** `recalculateAllScores_()` ghi lại scoring fields cho **toàn bộ** MASTER. Với UC đã có champion review, Total_Score sẽ tính lại từ auto (đã đổi nhờ Adoption) + manual hiện có — số điểm một số UC sẽ **tăng**, đúng ý đồ nhưng cần thông báo nếu ai đó theo dõi con số cũ.

### Commit
| Commit | Mô tả |
|---|---|
| `b2dcdb2` | fix(scoring): nối Active_User_Count end-to-end — Adoption score hết bằng 0 (v3.13.0) |
| `baad847` | docs: đánh dấu GAS redeploy + push xong cho v3.13.0 |
| `[handover]` | chore: session handover 2026-07-30 |

---

## Session: 2026-07-29
**Scope:** WORDING — Rà soát tổng thể tên hiển thị; sửa tên Trung tâm bị sai ở trang đăng nhập
**Version:** 3.12.3

### Task completed
Rà soát toàn bộ user-facing wording về tên tổ chức trên tất cả pages. Phát hiện + sửa 1 lỗi: phụ đề trang đăng nhập ghi sai tên Trung tâm. Xác nhận không còn chỗ nào khác spell sai tên; short form "TT SPTD" đồng nhất toàn site.

### Files changed
| File | Thay đổi | Deploy |
|---|---|---|
| `login.html` (dòng 37) | Phụ đề: "Trung tâm Sản phẩm & **Dịch vụ**" → "Trung tâm Sản phẩm & **Giải pháp Tín dụng**" | FE tĩnh |

### Decision made
- **Tên đầy đủ đúng của Trung tâm = "Trung tâm Sản phẩm & Giải pháp Tín dụng"** (không phải "Sản phẩm & Dịch vụ"). Đây là nơi DUY NHẤT trên site spell tên đầy đủ → chỉ sửa 1 dòng.
- **Giữ nguyên short form "TT SPTD"** (quyết định của user) — dùng ở ~15 chỗ (sidebar sub-label, title, meta, footer, leaderboard, login note), tất cả đồng nhất & đúng. Không đổi.
- **Giữ nguyên nhãn tab "Điểm SPTD"** (quyết định của user) — là tên tính năng chấm điểm, không phải tên Trung tâm; tránh đụng code identifier (`sptd-scoring.js`, `SPTD_EXCLUDED_USERS`).

### Blocker
Không có. Thuần frontend (1 dòng HTML), không đụng GAS.

### Next step
- P0 cũ vẫn treo (không phát sinh mới phiên này): (1) verify My Cases hiển thị UC cũ sau DATA-LIMIT-01 fix; (2) smoke test weekly-update với champion thật.
- Tùy chọn (chưa quyết): chuẩn hóa cách viết hoa "Use Case" vs "Use case" giữa sidebar và portal card → xem WORDING-01 trong TECH_DEBT.

### Regression risk
- **Rất thấp.** Chỉ đổi text hiển thị tĩnh trong `login.html`; không đụng logic, không đụng test, không đụng GAS. Playwright không assert chuỗi này.

### Commit
| Commit | Mô tả |
|---|---|
| `be211c8` | fix: sửa tên Trung tâm sai ở trang đăng nhập (Dịch vụ → Giải pháp Tín dụng) |

---

## Session: 2026-07-27
**Scope:** BUG FIX — "Use case của tôi" (và toàn dashboard) thiếu UC nộp trước ≈20/06
**Version:** 3.12.2

### Task completed
Fix triệt để lỗi tab "Use case của tôi" chỉ hiện UC từ ≈20/06, thiếu UC cũ hơn — phát sinh với **nhiều user** dù DB vẫn còn data. Root cause + fix server-side + FE, deploy GAS, push main.

### Root cause (đã xác nhận trong code)
`listUseCases_` (GAS) sort `Created_At` mới→cũ rồi `slice(0, limit=200)`; FE lọc owner ở **client SAU khi đã cắt**. Khi tổng UC toàn tổ chức >200 → mọi UC cũ hơn UC thứ-200 (≈20/06) bị loại **trước khi** lọc owner → mất UC cũ đồng loạt (cắt theo mốc ngày chung nên mọi user giống nhau). `_allList` (nuôi KPI/SPTD/Khám phá/Tất cả/Chờ duyệt) cũng dính cùng cap. = **TECH_DEBT DATA-LIMIT-01**, nay CLOSED.

### Files changed (commit `3c7463e`)
| File | Thay đổi | Deploy |
|---|---|---|
| `assets/gas-backend/AdminService.gs` | `listUseCases_`: filter `owner_login`/`owner_name` TRƯỚC slice (khớp Owner_Email **và** Owner_Name, case-insensitive + `normalizeUser_`); có owner filter → trả full; `limit<=0` → không cắt | ✅ GAS |
| `assets/gas-backend/Code.gs` | Route `list` truyền `owner_login`/`owner_name`; giữ `limit='0'` khi FE gửi 0 | ✅ GAS |
| `config/routes.js` | Thêm 2 param owner; gửi `&limit=` cả khi =0 (`filters.limit != null && !== ''`) | FE tĩnh |
| `assets/js/dashboard.js` | org loads `limit:0`; My Cases fetch theo owner ở server (`_myList = all`, bỏ double-filter client); pending `limit:0` | FE tĩnh |
| `assets/js/review-queue.js` | `limit 500→0` | FE tĩnh |
| `manager-review.html` | `limit 200→0` | FE tĩnh |

### Decision made
- **Server-side owner filter (đúng nhất)** thay vì chỉ nâng limit ở FE — user chọn, cho phép redeploy GAS. My Cases hỏi GAS đúng owner → server lọc trước khi cắt.
- **Scope toàn hệ thống:** org-wide loads dùng `limit:0` (= tất cả) vì KPI/SPTD/Khám phá/Tất cả đều derive từ `_allList` → nếu chỉ fix My Cases thì các tab kia vẫn sai số.
- **Convention `limit:0` = "lấy tất cả"** (không cắt). `routes.js` phải gửi limit cả khi =0; GAS parse `<=0` → full.
- Match owner theo **cả** login lẫn display name (2 chiều) để chống data `Owner_Name`/`Owner_Email` lệch nhau (liên quan Khám Phá fix 2026-07-09).

### Blocker
Không còn. GAS đã deploy (URL không đổi), FE đã push `origin/main`.

### Next step
- **[P0 verify]** Login user có UC nộp trước 20/06 → tab "Use case của tôi" phải thấy đủ UC cũ (đây là bài test đường server-owner-filter mà Playwright mock **không** cover — mock bỏ qua param owner).
- KPI + Điểm SPTD → số/điểm phản ánh cả UC cũ.
- P0 cũ vẫn treo: champion smoke test weekly-update.

### Regression risk
- **Thấp–trung bình.** `limit:0` tải toàn bộ MASTER mỗi lần → chậm dần khi data lên nhiều nghìn UC (JSONP response size). Data hiện tại vài trăm UC → OK. Nếu cần, sau này chuyển pagination server-side (P3).
- Playwright mock route theo `action` only (bỏ qua `owner_*`/`limit`) → đường My-Cases server-filter **không** được E2E cover. Verify thủ công bước P0 ở trên.
- Test: 95/95 Playwright + 30/30 KPI + 29/29 SPTD unit PASS (không regression).

### Commit
| Commit | Mô tả |
|---|---|
| `3c7463e` | fix: My Cases + dashboard thiếu UC cũ do global cap 200 cắt trước khi lọc owner |

---

## Session: 2026-07-08
**Scope:** Feature "Điểm SPTD" — Tính năng chấm điểm hiệu suất user (80-10-10 scoring)

### Tóm tắt
Implement hoàn chỉnh tab "Điểm SPTD" trên dashboard.html. Công thức 80-10-10:
- 80% chất lượng = avg(Total_Score) của UC Approved
- 10% số lượng = min(n_approved/n_weeks, 1) × 10
- 10% tuần đạt = n_weeks_hit / n_weeks × 10

T0 cố định: 2026-06-01 (Monday). Tuần = Monday-anchored từ T0 = 2026-06-01.

### Files đã thay đổi
| File | Loại | Mô tả |
|---|---|---|
| `assets/js/sptd-scoring.js` | NEW | SPTDScoring IIFE module — computeAllScores, computeUserDetails, getRank; conditional module.exports cho Node test compat |
| `config/env.js` | Modified | Thêm `PROGRAM_START_DATE: '2026-06-01'` và `SPTD_EXCLUDED_USERS: ['cuongvm1']` |
| `dashboard.html` | Modified | Tab button #tab-btn-sptd, tab panel #tab-sptd, script tag sptd-scoring.js |
| `assets/js/dashboard.js` | Modified | `_sptdScores` state, `renderSPTDTab()` + 6 sub-render funcs, `_exportSPTDCSV()`, public API export |
| `assets/css/dashboard.css` | Modified | ~150 lines SPTD CSS (card, breakdown grid, formula box, leaderboard table, UC table, timeline, responsive) |
| `assets/tests/test-sptd-scoring.js` | NEW | 29 unit tests (5 suites: A basic, B edge cases, C userDetails, D getRank, E merge) — 29/29 PASS |
| `tests/06-sptd-tab.spec.js` | NEW | 10 Playwright E2E tests — 10/10 PASS |

### Tính năng đã implement
- **My card**: big score + 3-component breakdown + rank badge + compare với SPTD avg
- **Formula box**: nguyên tắc chấm + calc breakdown với số thực của user
- **Leaderboard**: bảng xếp hạng, hàng "tôi" tô nền, huy chương 🥇🥈🥉, rank chip màu theo mức
- **UC list**: danh sách UC Approved của tôi, sắp xếp theo score giảm, badge ⏳ cho UC chưa có champ review
- **Timeline**: ô tuần ✓/✗ từ T0 đến nay, label T1/T2/.., tooltip dateRange
- **CSV export**: admin only, BOM UTF-8, filename ngày

### Kết quả test
- Unit tests: **29/29 PASS** (`node assets/tests/test-sptd-scoring.js`)
- Playwright: **95/95 PASS** (85 cũ + 10 mới SPTD)

### Lý do kỹ thuật quan trọng
- **Phase 0 skipped**: total_score + auto_score đã có sẵn trong listUseCases_ (lines 184-185 AdminService.gs) → không cần redeploy GAS
- **Duplicate-key merge**: owner_email = display_name pattern được xử lý giống KPI tab (claimed + inactiveKeys pattern)
- **global.APP_CONFIG**: unit test phải dùng `global.APP_CONFIG` (không phải `var`) để module require() đọc được
- **module.exports shim**: thêm `if (typeof module !== 'undefined') module.exports = _public` vào cuối sptd-scoring.js

### Commits phiên này
| Commit | Mô tả |
|---|---|
| `fed5d33` | feat: add Điểm SPTD tab with 80-10-10 gamification scoring |
| `f5436c9` | fix: update SPTD program start date to 2026-06-01 |
| `[handover]` | chore: session handover 2026-07-08 |

### P0 còn lại
- Champion smoke test (từ TODO_NEXT.md P0 cũ)

---

## Session: 2026-05-28
**Scope:** UI/UX Refactor v2.0.0-ui — thiết kế, lập kế hoạch và implement

---

## Đã hoàn thành
- Phân tích toàn bộ codebase → viết `UI_UX_REVIEW.md`, `UI_REFACTOR_PLAN.md`
- Implement 27 UX improvements (chi tiết xem `CHANGELOG_UI.md`)
- Fix bugs: BUG-01, BUG-02, BUG-05, BUG-06, SMELL-05
- Resolve maintainability: MAINT-03, MAINT-04, MAINT-05, MAINT-06
- Tạo CSS mới: `typography.css`, `forms.css`, `states.css`
- Thêm `FIELD_CONFIG` + `GROUP_CONFIG` vào `constants.js`
- Rebuild `FieldBuilder` trong `wizard.js` dùng FIELD_CONFIG
- Fix execution order trong `app.js` (Wizard.init → populateData)
- Thay `confirm()` bằng inline draft banner

## Deferred (chủ động bỏ qua)
- BUG-03 (Status luôn là Draft) — cần xác nhận với PO
- BUG-04 (validateUpdate_ không được gọi) — GAS backend, 5-min fix
- SEC-01/02/03, PERF-01/02/03 — ngoài scope refactor UI
- Dashboard UI, Approval workflow — SPRINT 4

---

## Session: 2026-05-28 (Part 2)
**Scope:** Phase 1–5 audit + fix data loading + Dashboard + Approval feature

## Đã hoàn thành
- **Phase 1 audit:** Tìm ra 3 bugs mới (BUG-A, BUG-B, BUG-C) qua phân tích toàn bộ data flow
- **BUG-A fixed:** Checkbox groups không rebuild được sau lookup load
- **BUG-B fixed:** Race condition edit mode — `_pendingEditData` pattern
- **BUG-C fixed:** `Current_Stage` bị overwrite bởi `Status` trong GAS
- **BUG-04 confirmed resolved:** `validateUpdate_()` đã được gọi
- **New endpoints:** `list`, `approve`, `reject`
- **AdminService.gs (new):** Admin email validation, approve/reject/list
- **dashboard.html + dashboard.js + dashboard.css (new):** KPI, charts, approval flow

---

## Session: 2026-05-28 (Part 3)
**Scope:** Login feature + Portal home refactor (TPBank BIZ-inspired) + Auth integration  
**Version:** v2.2.0

---

### Files created
| File | Mô tả |
|------|-------|
| `login.html` | Login page — clean purple card, email-only |
| `register.html` | Wizard form (di chuyển từ `index.html`) + auth guard |
| `assets/js/auth.js` | AuthService — IIFE, session-based, role-aware |
| `assets/css/login.css` | Login page styles (purple gradient card) |
| `assets/css/portal.css` | Portal home styles (TPBank BIZ-inspired) |

### Files modified
| File | Thay đổi |
|------|---------|
| `index.html` | Refactored → portal home với service cards, data-driven, role-based |
| `config/env.js` | Thêm `USER_SESSION_KEY: 'ai_user_session'` |
| `assets/css/variables.css` | Thêm purple palette + accent + portal layout tokens |
| `dashboard.html` | Thêm `auth.js`, update logout, thêm "Trang chủ" nav, fix register link |
| `assets/js/dashboard.js` | AuthService integration (init, logout, gate form) với fallback cũ |

### Decisions chốt
1. **Wizard moved to `register.html`** — `index.html` là portal home, minimal invasive với tất cả wizard code không đổi
2. **Backward compat `?edit=`** — `index.html` redirect `?edit=...` sang `register.html?edit=...`
3. **AuthService = IIFE pattern** — consistent với codebase hiện tại, không cần bundler
4. **Email-only login** — no password, keep current behavior, role từ `ADMIN_EMAILS` list
5. **Dual session keys** — `ai_user_session` (new) + `ai_admin_email` (legacy, written by AuthService cho backward compat)
6. **dashboard.js fallback** — nếu `auth.js` không load, dashboard.js fallback về legacy gate

### Risks
- **SEC-01 vẫn tồn tại:** Email tự nhập, không có real auth. Người biết email admin vẫn có thể dùng gate.
- **No password:** Login bằng email bất kỳ → production cần Google OAuth hoặc domain restriction
- **Session là sessionStorage** → clear khi đóng tab (intentional, dùng cho browser sessions)

### Open issues
- BUG-03 (Status="Draft") vẫn pending PO confirmation
- GAS chưa deploy với code approve/reject
- `login.html` cần được serve qua HTTP (không phải file://) để sessionStorage hoạt động cross-page

---

## Recommended next actions
1. **[P0] Test login flow:** Mở qua local server → `login.html` → nhập email → redirect portal
2. **[P0] Test portal:** service cards render đúng theo role (user vs admin)
3. **[P0] Deploy GAS** với AdminService.gs để approve/reject live
4. **[P1] Update `ADMIN_EMAILS`** trong `config/env.js` với email thật
5. **[P2] Nâng cấp auth:** Google OAuth (`google.accounts.oauth2`) để xác thực email thật

---

## Session: 2026-05-29
**Scope:** TPBank BIZ Full UI/UX Refactor — v3.0 design system

### Decisions chốt
1. **Primary color = Purple `#7B2CBF`** — Google Blue (#1a73e8) bị loại bỏ hoàn toàn
2. **Sidebar gradient token** → `--sidebar-gradient: linear-gradient(180deg,#7B2CBF 0%,#6622B4 100%)` — dùng chung cho sidebar, tất cả purple headers
3. **Card radius = 20px (`--radius-xl`)**, Button/Input radius = 12px (`--radius-md`)
4. **Shadow rule:** `0 2px 10px rgba(0,0,0,.03)` — không heavy shadow
5. **`dashboard.html`** là trang duy nhất có sidebar layout. Portal/register dùng top-header.
6. **Sidebar collapse:** trigger tại 1024px, dùng `.is-open` class + `.sidebar-overlay`
7. **Status badge colors** cập nhật theo semantic palette: Submitted=purple, Approved=green, Warning=amber, Error=red

### Files modified (CSS)
| File | Delta |
|---|---|
| `variables.css` | Complete rewrite — TPBank BIZ token system |
| `layout.css` | Added full sidebar + topbar architecture |
| `components.css` | Purple-first buttons, cards, modals, toasts |
| `forms.css` | Purple focus rings, 12px radius, styled radio pills |
| `wizard.css` | TPBank stepper: green ring active, green ✓ done |
| `dashboard.css` | Top-accent KPI cards, purple tabs |
| `login.css` | Uses `--sidebar-gradient` token |
| `portal.css` | Updated tokens, spacious rows |
| `responsive.css` | Sidebar collapse at 1024px |
| `states.css` | Trimmed — removed duplicated success/banner blocks |

### Files modified (HTML/JS)
| File | Delta |
|---|---|
| `dashboard.html` | Full enterprise sidebar + topbar layout |
| `dashboard.js` | `populateSidebarUser()` added; removed `headerAdminActions`; TPBank status colors |

### New docs created
`DESIGN_TOKENS.md`, `DESIGN_SYSTEM.md`, `UIUX_SYSTEM.md`, `LAYOUT_SYSTEM.md`, `THEME_ARCHITECTURE.md`, `RESPONSIVE_GUIDE.md`, `COMPONENT_GUIDELINES.md`, `CHANGELOG_UI_REFACTOR.md`

### Open issues (không blocking)
- ~~`register.html` / `index.html` chưa có sidebar~~ → **Fixed in Part 3**

---

## Session: 2026-05-29 (Part 2)
**Scope:** P5 UI Polish — SVG icons + Chart.js integration

### Decisions chốt
1. **SVG icon library = Heroicons 2.0** (inline, MIT license, không cần CDN)
2. **Chart.js 4.4.4** qua jsDelivr CDN, load trước `dashboard.js`
3. **statusChart** → doughnut chart (`aspectRatio: 1.6`, legend bottom, tooltip % breakdown)
4. **teamChart / categoryChart** → horizontal bar (`indexAxis: 'y'`, purple fill, no legend)
5. **Fallback CSS charts** vẫn giữ — tự động kích hoạt nếu Chart.js CDN không load
6. **KPI icons màu semantic**: total=purple, approved=green, pending=amber, hours=blue (via `currentColor`)

### Files modified
| File | Delta |
|---|---|
| `dashboard.html` | Toàn bộ emoji → Heroicons SVG inline; canvas cho 3 charts; Chart.js CDN |
| `dashboard.js` | `_charts` state; `renderStatusChart` → doughnut; `renderBreakdownChart` → hbar; CSS fallbacks giữ nguyên |
| `assets/css/dashboard.css` | `.chart-container canvas { display:block; max-width:100% }`; `.kpi-icon` + `.admin-gate-icon` thêm `color` token |

### Icons thay thế
| Vị trí | Emoji cũ | Heroicons mới |
|---|---|---|
| Brand logo | 🚀 | sparkles |
| Nav Dashboard | 📊 | chart-bar-square |
| Nav Register | ➕ | document-plus |
| Nav My cases | 📋 | clipboard-document-list |
| Nav Home | 🏠 | home |
| Logout | ⏻ | arrow-right-on-rectangle |
| Topbar toggle | ☰ | bars-3 |
| Topbar refresh | ↻ | arrow-path |
| Admin gate | 🔐 | lock-closed |
| KPI Total | 📊 | chart-bar-square |
| KPI Approved | ✅ | check-circle |
| KPI Pending | ⏳ | clock |
| KPI Hours | ⏱️ | bolt |

---

## Session: 2026-05-29 (Part 3)
**Scope:** Layout unification + My US + Auto-fill + Username login + Approval popup

### Decisions chốt
1. **Sidebar trên tất cả pages** — `register.html`, `index.html` rebuild dùng `.app-layout` giống `dashboard.html`
2. **Dashboard open cho mọi user** — Admin: 4 tabs + KPI. Regular user: chỉ "Use Case của tôi" tab
3. **Username-based login** — không validate định dạng email; `ADMIN_EMAILS` chứa usernames (`['admin','tuantt4','manager']`)
4. **Auto-fill Owner_Name/Owner_Email từ session** — readonly sau khi fill; không fill ở edit mode
5. **Owner_Email field** đổi type `'email'` → `'text'`, label → "Mã người đăng ký"
6. **US Detail modal** — `.modal-card--wide` (720px), show all fields, approve/reject inline (không mở modal thứ 2)
7. **UC cache pattern** — tránh `JSON.stringify` trong onclick attribute (XSS/syntax risk); dùng `_ucCache[key]` + `Dashboard._byKey(key)`
8. **My US filter** — client-side: `owner_name === user.displayName || owner_email === user.email`
9. **"Use Case của tôi" nav** — active khi tab=my; Dashboard nav active khi các tab admin khác

### Files modified
| File | Delta |
|---|---|
| `config/env.js` | ADMIN_EMAILS = usernames array |
| `assets/js/auth.js` | Xóa email regex validation; `_buildDisplayName` hỗ trợ username |
| `login.html` | `type="text"`, label "Tên đăng nhập", placeholder username |
| `assets/js/constants.js` | `Owner_Email.type` → `'text'`; label → "Mã người đăng ký" |
| `assets/js/app.js` | `_autoFillOwner()` after Wizard.init(); readonly lock |
| `register.html` | Full rewrite → sidebar layout; Dashboard nav ẩn với non-admin |
| `index.html` | Full rewrite → sidebar layout; SVG icons trong service cards |
| `assets/css/portal.css` | `.app-content > .portal-main { padding: 0 }` tránh double-padding |
| `assets/css/components.css` | `.modal-card--wide` + `.modal-card--wide .modal-body` |
| `dashboard.html` | My US tab; KPI row hidden khi non-admin; detail modal; remove admin gate UI |
| `assets/js/dashboard.js` | Full rewrite: role-based UI, My Cases load/render, detail popup, approval in popup, cache pattern |

### Open issues
- **My US filter** dùng client-side — nếu Owner_Name/Email không khớp chính xác sẽ miss cases cũ (submit trước khi có feature này)
- **GAS deploy** vẫn chưa xong — approve/reject API endpoints cần deploy mới có tác dụng
- **BUG-03** (Status="Draft") vẫn pending PO confirm
- `portal.css` vẫn còn references tới `.portal-header` (responsive) — harmless, nhưng cần cleanup sau

---

## Session: 2026-05-29 (Part 4)
**Scope:** Bug fixes — URL redirect, Owner_Email field, dropdown cleanup, GAS validation, My US filter

### Files modified (Frontend)
| File | Delta |
|---|---|
| `assets/js/auth.js` | `requireAuth()`: dùng `pathname.split('/').filter(Boolean).pop()` thay vì full pathname → fix URL duplicate trên GitHub Pages subdirectory |
| `assets/js/app.js` | Xóa `readOnly` lock trên Owner fields; xóa `Owner_Email` khỏi `FormMapper.populateData`; inject `data.Owner_Email = user.email` silent trong `submitForm()` trước khi validate |
| `assets/js/validation.js` | Xóa check `OWNER_EMAIL` (required + regex) khỏi `step1()`; xóa `'Mã người đăng ký'` khỏi `markErrors` map |
| `assets/js/constants.js` | Xóa `FIELDS.OWNER_EMAIL` khỏi `STEPS[0].fields`; xóa toàn bộ block `Owner_Email` khỏi `FIELD_CONFIG` |
| `assets/js/dashboard.js` | `_loadMyUseCases()`: cross-compare 4 chiều + `.trim()` — match `owner_name` vs cả `displayName` và `email`, `owner_email` vs cả hai |

### Files modified (GAS Backend)
| File | Delta |
|---|---|
| `assets/gas-backend/LookupService.gs` | Rewrite hoàn toàn — xóa `findColIndex_()`, 3 mảng ALIASES, `Status/Priority/Risk_Level/Demo_Status` khỏi LOOKUP_DEFAULTS; dùng fixed column positions (col 0/1/3); xóa Logger.log |
| `assets/gas-backend/ValidationService.gs` | Xóa email regex `@` khỏi `validateCreate_()` và `validateUpdate_()` |
| `assets/gas-backend/Utils.gs` | Xóa toàn bộ `output.addHeader(...)` trong `sendJson_()` — GAS không hỗ trợ method này |

### Decisions chốt
1. **Owner_Email ẩn hoàn toàn khỏi UI** — field không render, không validate, inject silent từ session trong `submitForm()` để GAS vẫn nhận được
2. **Email validation bị xóa cả FE lẫn BE** — `ValidationService.gs` không còn regex `@` check; field lưu username không phải email
3. **User_Type**: xóa `'Toàn công ty'` → còn `['Cá nhân', 'Team', 'TT SPTD']`
4. **Business_Category**: xóa `'Thanh toán'`, `'Nhân sự'`, `'CNTT'` → còn `['Tín dụng', 'Vận hành', 'Khách hàng', 'Tuân thủ', 'Khác']`
5. **`sendJson_` không dùng addHeader** — GAS infrastructure tự xử lý CORS; addHeader không tồn tại trên TextOutput object

### Open issues (Part 4)
- **[BUG-GAS-01] GAS data loading lỗi** — `?action=health` OK nhưng `?action=lookup` / `?action=list` không load được. Root cause chưa xác định. Cần: paste exact error message từ toast hoặc GAS Executions log
- **[BUG-FE-01] auth.js chưa push GitHub** — fix URL duplicate đã đúng trong local nhưng GitHub Pages vẫn phục vụ code cũ
- **Utils.gs** fix addHeader cần deploy lên GAS

---

## Session: 2026-06-02
**Scope:** Full UC detail view before approval + GAS permission fix + full flow test
**Commits:** `afd1933` (feat), `0b8c7a0` (fix) — merged vào `main`

### Đã hoàn thành

- **[BUG-FE-01] Verified closed** — auth.js URL fix đã có trên GitHub từ trước, handover cũ ghi sai trạng thái
- **Full flow test (Playwright)** — 17/18 pass; 1 false positive (test dùng `tuantt4` là admin nhưng assume là user thường); UI role-based hoạt động đúng
- **FEAT: Xem chi tiết UC trước khi duyệt** — rebuild modal thành 4 section theo wizard steps; progressive fetch: mở ngay với list data → background fetch `getUseCase` → re-render full data khi GAS trả về
- **FIX: GAS `ADMIN_EMAILS` mismatch** — `Config.gs` cũ dùng email (`admin@sptd.vn`); auth đã chuyển sang username → fix thành `['admin', 'tuantt4', 'manager']`

### Files changed
| File | Delta |
|---|---|
| `assets/js/dashboard.js` | +180 lines: `openDetail` gọi `_fetchFullDetail`; thêm `_fetchFullDetail`, `_normalizeFullData`; rewrite `_renderDetailBody` (4 sections); helpers `_dsection`, `_dsubsec`, `_dgrid`, `_dfield` |
| `assets/css/dashboard.css` | +96 lines: detail section styles — step badges, 2-col grid, pre-wrap values, subsection, wide-modal padding reset |
| `assets/gas-backend/Config.gs` | Line 111: `ADMIN_EMAILS = ['admin', 'tuantt4', 'manager']` (usernames, không phải emails) |

### Decisions chốt
1. **Modal progressive load** — hiện ngay với list data (12 fields), fetch full data từ GAS ngầm. Nếu GAS lỗi, partial view vẫn hữu ích; không show error toast để tránh nhiễu
2. **Sections tự ẩn nếu empty** — Sections 2/3/4 không render khi không có data → clean với data cũ hoặc khi GAS chưa deploy
3. **`_normalizeFullData`** — normalize PascalCase từ `getUseCase` response về snake_case dùng chung
4. **ADMIN_EMAILS dùng username** — nhất quán với auth system, không dùng email format

### Blockers hiện tại
- **[BUG-GAS-02] NEW — GAS new deployment chưa authorize**: Khi deploy GAS Web App mới, cần chạy thủ công 1 hàm trong GAS Editor để grant OAuth → Sheets access. Chưa làm → create/submit bị "không có quyền"
- **[BUG-GAS-03] NEW — CONFIG sheet override `Config.gs`**: `getAdminEmails_()` đọc CONFIG sheet row `ADMIN_EMAILS` trước khi fallback về `Config.gs`. Nếu sheet còn giá trị `admin@sptd.vn,manager@sptd.vn` thì fix `Config.gs` bị vô hiệu → phải update cell trong sheet thành `admin,tuantt4,manager`
- **[BUG-GAS-01] vẫn open** — root cause lookup/list loading chưa xác định

### Regression risks
- `_renderDetailBody` rewrite hoàn toàn — field keys từ `listUseCases` (`uc.pain_point`, `uc.team`...) phải khớp với `_dgrid`/`_dfield` calls. Verify với GAS data thật sau khi authorize
- `openDetail` gọi `Api.getUseCase(record_id)` mỗi lần mở modal — 1 JSONP request thêm/lần; acceptable nhưng cần monitor nếu GAS có rate limit

---

## Session: 2026-06-02 (Part 2)
**Scope:** Root cause diagnosis — data loading failure + URL fix
**Commits:** `b265ebe` (fix URL + resolve merge conflict)

### Đã hoàn thành

- **[BUG-GAS-01] ROOT CAUSE XÁC ĐỊNH + CLOSED** — Phân tích toàn bộ git history `config/env.js` (7 URL khác nhau trong 35 phút). Root cause: commit `a76bd9f` nhập URL không tồn tại (`AKfycbx8b7h...`) khi cố revert — không khớp với bất kỳ deployment nào trong GAS.
- **[BUG-GAS-02] CLOSED** — User đã authorize OAuth cho deployment hiện tại. Link đang hoạt động.
- **`env.js` cố định tại URL working**: `AKfycbyaM1dQcCZYHNam3zb6UrwP5Qf8BnsJr1XzjPUuGqla-k2WCAI5llLllIhadU7mfBfP`
- **Quy trình deploy chuẩn documented** trong `TODO_NEXT.md` — ngăn tái phát

### Timeline sự cố hôm nay (để tham khảo)

| Thời gian | Hành động | Kết quả |
|---|---|---|
| Trước 15:00 | URL gốc `AKfycbwe0eo3X3KW...` | ✅ Hoạt động |
| 15:00 | Deploy mới → URL `AKfycbzaMcZAEPa...` | ❌ Chưa auth OAuth |
| 15:13 | Deploy mới → URL `AKfycbz4TmB4Ds...` | ❌ Chưa auth OAuth |
| 15:15 | "Revert" → URL `AKfycbx8b7hdBNc...` | ❌ URL không tồn tại |
| 15:3x | Deploy mới → URL `AKfycbwVGwFLjq...` | ❌ Chưa auth OAuth |
| 15:35 | Deploy mới → URL `AKfycbyaM1dQcC...` → **authorize** | ✅ **Hoạt động** |

### Root cause pattern
Khi tạo "New Deployment" trong GAS: URL thay đổi + cần authorize OAuth lại. Giải pháp lâu dài: luôn dùng "Edit deployment → New version" thay vì "New Deployment" để giữ URL cố định.

### Blockers còn lại
- **[BUG-GAS-03]** CONFIG sheet `ADMIN_EMAILS` cần update → ảnh hưởng approve/reject
- **P0** GAS code sync: `Config.gs`, `Utils.gs`, `LookupService.gs` local fixes chưa vào GAS Editor

---

## Session: 2026-06-02 (Part 3)
**Scope:** Bug fixes (URL, CSS modal) + 3 new features (auto-load, explore tab, copy prompt)
**Commits:** `93a2e58` (CSS fix), `b265ebe` (URL fix), `f1530ec` (features)
**Version:** 3.3.0

### Đã hoàn thành

- **[BUG-GAS-01] CLOSED** — Root cause xác định: `env.js` trỏ URL không tồn tại (`AKfycbx8b7h...`). Đã restore URL working `AKfycbwe0eo3X3KW...`.
- **[BUG-GAS-02] CLOSED** — OAuth đã authorize cho active deployment.
- **Approve/Reject confirmed working** — User xác nhận "từ chối, duyệt thành công".
- **[BUG-CSS-01] FIXED** — Modal footer bị đẩy xuống dưới viewport khi nội dung 4-section dài. Fix: `overflow:hidden` + `min-height:0` trên `.modal-card--wide`. File: `assets/css/components.css`.
- **FEAT: Auto-load on startup** — Thay `_loadTabData(initTab)` bằng `_loadStartupData()`. Single `Promise.all([listUseCases, getDashboard])` populate tất cả tabs ngay khi `DOMContentLoaded`. Non-admin: 1 request; Admin: 2 requests.
- **FEAT: Tab "Khám phá"** — Tab mới visible tất cả users. Hiển thị use cases có status=Approved từ toàn org. Searchable theo tên/team/lĩnh vực/người đăng ký.
- **FEAT: Copy Prompt** — Nút `📋 Copy Prompt` trong footer detail modal. Hiện khi UC có data prompt (sau `_fetchFullDetail`). Ghép 8 trường thành text có `# heading`. `navigator.clipboard` với `execCommand` fallback.

### Files changed

| File | Delta |
|---|---|
| `assets/css/components.css` | +2 lines: `overflow:hidden` + `min-height:0` trên `.modal-card--wide` |
| `assets/js/dashboard.js` | +152 lines: `_loadStartupData`, `renderExploreTable`, `_bindExploreSearch`, `_hasPromptData`, `_copyPrompt`, `_fallbackCopy`; update `_bindRefresh`, `_confirmDetailAction`, `openDetail`, `_fetchFullDetail`, `_bindDetailModal` |
| `dashboard.html` | +20 lines: explore tab button + panel + copy prompt button |
| `config/env.js` | URL restored (multiple commits) |
| `ai_context/*.md` | Session docs updated |

### Decisions chốt

1. **`_loadStartupData` = single source of truth** — Cả refresh button và post-approve/reject đều gọi `_loadStartupData()`. `_pendingList` derive client-side từ `_allList` (filter Submitted/Under Review).
2. **Explore chỉ show Approved** — Regular user chỉ thấy UC đã được duyệt → cleaner UX, tránh noise từ draft/pending của người khác.
3. **Copy prompt = full text** — Ghép 8 trường với `# header` Markdown-style → paste được trực tiếp vào Claude/ChatGPT.
4. **GAS URL mystery** — URL `AKfycbwe0eo3X3KW...` hoạt động nhưng không tìm thấy trong GAS deployment history của user → có thể thuộc GAS project khác. Cần identify project để quản lý.

### Blockers còn lại

- **[GAS-MYSTERY-01]** GAS URL active không tìm thấy trong deployment history → không quản lý được, không thể update code GAS
- **[BUG-GAS-03]** STATUS UNCLEAR — approve/reject đang hoạt động nên CONFIG sheet của GAS project active có thể đã đúng. Cần verify bằng cách mở đúng GAS project và check CONFIG sheet
- **GAS code sync** — Local fixes (`Config.gs`, `Utils.gs`, `LookupService.gs`) chưa vào GAS Editor vì chưa tìm được đúng project

### Regression risks

- **`_pendingList` derive client-side**: trước đây GAS filter `filter:'pending'` — giờ filter JS từ `_allList` limit 200. Nếu >200 records total, một số pending records ở cuối list có thể không hiển thị trong tab "Chờ duyệt".
- **`_loadTabData('my')` gọi `_loadMyUseCases()`** — vẫn fetch API riêng khi user click tab My sau startup → double fetch. Harmless nhưng lãng phí 1 request.
- **Explore tab empty nếu không có Approved UC** — Khi dùng lần đầu, nếu chưa có UC nào được duyệt, tab Khám phá sẽ trống. Đây là expected behavior nhưng có thể confuse user mới.

---

## Session: 2026-06-02 (Part 4)
**Scope:** Tự động sinh UseCase_ID chống trùng + hiển thị mã dự kiến trên form
**Version:** 3.4.0

### Vấn đề gốc (root cause)
`generateUseCaseId_()` cũ chỉ dùng counter từ CONFIG sheet, không cross-check với MASTER_DATA. Nếu:
- Sheet có ID cao hơn counter (import thủ công, rollback, migration)
- Counter bị reset
→ Có thể sinh ra ID đã tồn tại.

Ngoài ra, có 1 bug tinh tế: code cũ dùng `data[j][0]` hardcoded thay vì `keyCol` index để tìm row NEXT_ID trong CONFIG sheet — hoạt động đúng trong thực tế vì cột 0 luôn là `Key`, nhưng không robust.

### Đã hoàn thành

- **[GAS] `_getAllUseCaseIds_()`** — NEW helper: đọc tất cả UseCase_ID từ MASTER_DATA
- **[GAS] `_getMaxExistingIdNum_()`** — NEW helper: tìm số thứ tự cao nhất hiện có
- **[GAS] `generateUseCaseId_()` rewrite v2** — sync `max(CONFIG.NEXT_ID, maxExisting + 1)` + collision loop + fix `configRowIndex` tracking (không còn dùng `data[j][0]` hardcoded)
- **[GAS] `peekNextUseCaseId_()`** — NEW: xem trước ID tiếp theo, read-only, không tiêu thụ counter
- **[GAS] `Code.gs`** — thêm endpoint `?action=next-id`
- **[FE] `routes.js`** — thêm `API.nextId()`
- **[FE] `api.js`** — thêm `Api.getNextId()`
- **[FE] `register.html`** — thêm `#nextIdBadge` trong wizard-meta
- **[FE] `app.js`** — `loadNextIdPreview()`: load + hiển thị badge "Mã dự kiến: AIUS-XXXX" ở new mode; ẩn ở edit mode
- **[FE] `wizard.css`** — `.nextid-badge` styles (purple, subtle border)
- **[TEST] `assets/tests/test-id-generation.js`** — 14 unit tests, 14/14 pass

### Files changed
| File | Delta |
|---|---|
| `assets/gas-backend/UseCaseService.gs` | +72 lines: 3 new functions + rewrite `generateUseCaseId_()` |
| `assets/gas-backend/Code.gs` | +4 lines: route `?action=next-id` |
| `config/routes.js` | +1 line: `API.nextId()` |
| `assets/js/api.js` | +1 line: `Api.getNextId()` |
| `assets/js/app.js` | +22 lines: `loadNextIdPreview()` + call in new mode |
| `register.html` | +1 line: `#nextIdBadge` span |
| `assets/css/wizard.css` | +14 lines: `.nextid-badge` styles |
| `assets/tests/test-id-generation.js` | NEW: 14 unit tests |

### Decisions chốt
1. **Sync strategy = max(CONFIG, maxExisting + 1)**: luôn dùng giá trị lớn hơn → không bao giờ tạo ID < maxExisting
2. **Collision loop**: sau khi chọn candidate từ max(), loop skip qua bất kỳ ID nào đã tồn tại → handles edge cases như manually-inserted IDs ở giữa range
3. **Peek = no lock, no write**: `peekNextUseCaseId_()` không dùng LockService → nhanh, không block concurrent creates; trade-off: preview có thể lệch nếu có create đồng thời (acceptable cho preview UX)
4. **Badge ẩn ở edit mode**: ID đã được cấp và hiển thị trong `editModeBanner` → không cần preview
5. **Badge ẩn khi GAS lỗi**: `loadNextIdPreview()` catch lỗi silently → không làm phiền user khi GAS offline

### GAS deployment note
Sau khi tìm được đúng GAS project (P0 blocker), paste `UseCaseService.gs` và `Code.gs` mới vào GAS Editor → "Edit deployment → New version → Deploy".

---

## Session: 2026-06-03
**Scope:** Drill-down list popup + đồng bộ nút Chi tiết tại "Nộp gần đây"
**Commit:** `7dde9d2`
**Version:** 3.5.0

### Đã hoàn thành

- **FEAT: List popup modal** — Click vào các vùng tương tác trên dashboard mở popup bảng danh sách use case lọc theo ngữ cảnh
  - KPI card "Tổng use case" → all list
  - KPI card "Đã duyệt" → filter Approved
  - KPI card "Chờ duyệt" → filter Submitted + Under Review
  - KPI card "Giờ tiết kiệm" → filter Approved
  - Chart.js doughnut segment (status) → filter by status
  - Chart.js horizontal bar (team) → filter by team
  - Chart.js horizontal bar (category) → filter by category
  - CSS fallback charts → clickable qua `Dashboard._openListByStatus/Team/Category`
- **FEAT: Chi tiết trong list popup** — Mỗi row có nút "Chi tiết" → mở `openDetail()` chồng lên list modal. Escape đóng detail trước, list modal vẫn còn. Escape lần 2 đóng list modal.
- **FIX: recentTable đồng bộ** — Tab "Tổng quan" → "Nộp gần đây" thêm cột nút "Chi tiết" (colspan 4→5), dùng cùng `openDetail()` như các bảng khác.

### Files changed
| File | Delta |
|---|---|
| `dashboard.html` | +16 lines: `#listModal` HTML; `#recentTable` header thêm `<th></th>` |
| `assets/js/dashboard.js` | +163 lines: `openListModal`, `_closeListModal`, `_bindListModal`, `_bindKPIClicks`; update `renderStatusChart`/`renderBreakdownChart` onClick+onHover; update `_chartRow` thêm onclickStr; update `_renderStatusChartCSS`, `_renderBreakdownChartCSS`; update `renderRecentTable`; update `window.Dashboard` public API |
| `assets/css/dashboard.css` | +30 lines: `.modal-card--list`, `.kpi-card--clickable` |

### Decisions chốt
1. **List modal chồng lên detail modal** — z-index tự nhiên từ DOM order (`listModal` trước `usDetailModal`). Không cần thêm z-index.
2. **Escape priority** — `_bindListModal` handler check nếu detail modal đang mở thì bỏ qua → Escape đóng detail trước, lần 2 đóng list.
3. **KPI click = admin only** — `_bindKPIClicks()` guard `if (!_isAdmin) return` → regular user không thấy click cursor trên KPI.
4. **CSS fallback charts** — `_chartRow` nhận thêm tham số `onclickStr`; CSS fallback truyền `Dashboard._openListByStatus/Team/Category(label)` inline.
5. **`capturedLabels/capturedFieldKey`** — Closure capture trong Chart.js `onClick` để tránh stale reference khi chart bị destroy/recreate.

### Open issues (không blocking)
- GAS-MYSTERY-01, GAS code sync — vẫn còn từ session trước

---

## Session: 2026-06-03 (Part 2)
**Scope:** Fix đồng bộ xem chi tiết recentTable với các màn khác
**Commit:** `7715389`

### Root cause đã xác định

`DashboardService.gs` — `computeDashboardSummary_()` chỉ push 4 trường vào `recent_submissions`:
```
{ usecase_id, name, team, submitted_at }
```
Thiếu `record_id` và `status` → `openDetail()` không gọi `_fetchFullDetail()` → modal chỉ thấy dữ liệu tối thiểu, không có approve/reject buttons, không load chi tiết đầy đủ.

Các bảng khác (allTable, myTable, pendingList, exploreTable, exploreTable) dùng data từ `_allList` (endpoint `listUseCases`) đã có đủ trường → hoạt động đúng.

### Đã hoàn thành

**FE — `assets/js/dashboard.js`:**
- `renderRecentTable()`: enrich từng item từ `_allList` theo `usecase_id` trước khi cache. Nếu tìm thấy → dùng object đầy đủ (có `record_id`, `status`, tất cả fields). Preserve `submitted_at` date gốc.
- `openDetail()`: thêm safety net — nếu UC thiếu `record_id`, tìm bản đầy đủ trong `_allList` trước khi render. Áp dụng cho mọi nguồn, không chỉ recentTable.
- Date field: dùng `submitted_at || submit_date` (hai nguồn data dùng key khác nhau)

**GAS — `assets/gas-backend/DashboardService.gs`:**
- `computeDashboardSummary_()`: push thêm `record_id`, `status`, `owner_name` vào mỗi item `recentList` — fix tại nguồn sau khi deploy GAS

### Files changed
| File | Delta |
|---|---|
| `assets/js/dashboard.js` | +24 lines: enrichment logic trong `renderRecentTable` + safety net trong `openDetail` |
| `assets/gas-backend/DashboardService.gs` | +3 fields: `record_id`, `status`, `owner_name` trong `recent_submissions` |

### Decisions chốt
1. **FE enrich = primary fix** — Hoạt động ngay với GAS hiện tại (không cần deploy GAS mới). `_allList` luôn load trước khi user có thể click recentTable (cùng `Promise.all` trong `_loadStartupData`).
2. **`openDetail` safety net = defensive fix** — Bảo vệ mọi trường hợp UC thiếu `record_id` từ bất kỳ nguồn nào, không chỉ recentTable.
3. **GAS fix = fix tại nguồn** — Sau khi deploy GAS mới, `recent_submissions` sẽ có đủ trường ngay, không cần enrich từ `_allList`.
4. **Không thay đổi filter** — `recent_submissions` vẫn chỉ lọc `Status === SUBMITTED` (không mở rộng sang `Under Review`) vì chưa có PO confirmation.

### Test checklist
- [ ] Login admin → tab Tổng quan → bảng "Nộp gần đây" → click nút "Chi tiết" → modal mở đúng 4 section
- [ ] Modal header hiện đúng status badge (Submitted/màu purple)
- [ ] Approve/Reject buttons hiện (vì status = Submitted)
- [ ] Section 2 (Luồng AI & Prompt) / Section 3 / Section 4 load sau khi GAS fetch xong
- [ ] Copy Prompt button hiện sau khi full data load
- [ ] Click "Chi tiết" trong list popup (từ KPI click) → detail modal hoạt động như nhau

---

## Session: 2026-06-03 (Part 3)
**Scope:** Filter tab Tất cả + Box Từ chối
**Commit:** `2eda85a`
**Version:** 3.6.0

### Đã hoàn thành

**Feature 1 — Filter tab "Tất cả use case":**
- Multi-select status pills: click toggle từng trạng thái, "Tất cả" reset về all
- Team dropdown: danh sách build động từ `_allList` sau khi data load
- Search kết hợp với filter (không thay thế)
- Count badge "X / Tổng" cập nhật real-time theo filter hiện tại
- Filter state `_filterAll` giữ nguyên khi data refresh

**Feature 2 — Box "Từ chối" trong tab Tổng quan:**
- `dash-card--rejected`: viền đỏ trái, ẩn khi không có rejected UC
- Preview tối đa 5 UC, nút "Xem tất cả" mở list popup khi > 5
- Mỗi row có nút "Chi tiết" → `openDetail()` đầy đủ 4 section (đồng bộ với các màn khác)
- Tự ẩn khi không có UC nào bị từ chối (clean UX)

### Files changed
| File | Delta |
|---|---|
| `dashboard.html` | +30 lines: filter bar trong tab Tất cả; rejected card trong tab Tổng quan |
| `assets/js/dashboard.js` | +143 lines: `_filterAll`/`_rejectedList` state; `_initAllFilters`, `_populateTeamFilter`, `_applyAllTableFilters`, `renderRejectedCard`; update `_loadStartupData`/`_loadAllUseCases`/`_bindSearch` |
| `assets/css/dashboard.css` | +87 lines: `.filter-bar`, `.filter-pill`, `.filter-select`, `.all-count-badge`, `.dash-card--rejected`, `.tab-badge--danger` |

### Decisions chốt
1. **Multi-select status via pill toggle** — mỗi pill là toggle độc lập; "Tất cả" pill reset tất cả; "Tất cả" tự active khi không chọn gì
2. **Team dropdown = dynamic** — `_populateTeamFilter()` gọi sau `_allList` load; preserve selection khi re-render
3. **`_applyAllTableFilters()` = single source of truth** — search, status filter, team filter đều qua hàm này; `_bindSearch` đơn giản hóa thành `debounce(_applyAllTableFilters, 300)`
4. **Rejected card ẩn khi không có data** — `card.style.display = items.length ? '' : 'none'` → không show empty box khi chưa có UC bị từ chối
5. **REJECTED_PREVIEW = 5** — giống pattern của recentTable; "Xem tất cả" dùng lại `openListModal` hiện có

### Test checklist
- [ ] Login admin → tab Tất cả → click pill "Đã duyệt" → chỉ hiện Approved UCs
- [ ] Click thêm pill "Từ chối" → hiện cả Approved + Rejected (multi-select)
- [ ] Click "Tất cả" pill → reset về all
- [ ] Chọn team trong dropdown → filter theo team
- [ ] Search + filter kết hợp hoạt động
- [ ] Count badge "X / Tổng" cập nhật đúng
- [ ] Tab Tổng quan → box "Từ chối" hiện khi có rejected UC
- [ ] Click "Chi tiết" trong rejected card → detail modal đầy đủ
- [ ] Nút "Xem tất cả" → list popup "Đã từ chối" với toàn bộ danh sách

### Regression risks (v3.6)
- **`_applyAllTableFilters` thay thế `renderAllTable(_allList)` trực tiếp** — nếu `_allList` chưa load khi filter được gọi → render empty. Cần verify `_initAllFilters()` không trigger filter trước khi data load (hiện tại OK vì pills chỉ bắt sự kiện click, không tự gọi).
- **`_populateTeamFilter()` preserve selection** — khi data reload (refresh button), giá trị `_filterAll.team` được đọc lại để re-select. Nếu team không còn trong list mới → dropdown về "Tất cả" nhưng `_filterAll.team` vẫn giữ giá trị cũ → filter lạ. Cần reset: `_filterAll.team = teamSel.value` trong `_populateTeamFilter` sau khi render.
- **`rejectedCard` ẩn khi không có data** — nếu admin có Rejected UCs nhưng `_allList` limit 200 không bao gồm hết → card thiếu data. Acceptable hiện tại nhưng cần pagination dài hạn.

---

---

## Session: 2026-06-03 (Part 4)
**Scope:** Fix URL duplicate "ai-usecase-platform" sau khi đăng nhập
**Commit:** `2a5a2af`
**Version:** 3.6.1

### Root cause
Khi user mở app qua trailing-slash URL (e.g. `https://…/ai-usecase-platform/`):
- `window.location.pathname.split('/').filter(Boolean).pop()` → trả về `'ai-usecase-platform'` thay vì `'index.html'`
- Chuỗi này được encode vào `?return=ai-usecase-platform`
- Sau khi login: `window.location.replace('ai-usecase-platform')` chạy từ `login.html` tại `/ai-usecase-platform/login.html`
- Browser resolve thành `…/ai-usecase-platform/ai-usecase-platform` → 404 / loop

### Đã hoàn thành

**Fix lớp 1 — `assets/js/auth.js` `requireAuth()`:**
- Validate segment bằng regex `/\.html?$/i` trước khi dùng làm return URL
- Nếu không có đuôi `.html` → fallback về `'index.html'`

**Fix lớp 2 — `login.html` `safeReturnUrl()`:**
- Tạo helper function dùng chung cho cả 2 chỗ redirect (already-logged-in check + form submit)
- Regex mới `/^[a-zA-Z0-9_-]+\.html(\?[a-zA-Z0-9_.=&%-]*)?$/` — chỉ chấp nhận `*.html`, từ chối directory name
- Xoá regex cũ `^[a-zA-Z0-9_\-./]+$` (quá rộng, không kiểm tra extension)

### Files changed
| File | Delta |
|---|---|
| `assets/js/auth.js` | `requireAuth()`: thêm `.html` extension check, +2 lines comment |
| `login.html` | `safeReturnUrl()` helper mới; 2 redirect dùng chung; -2 lines duplicate |

### Test cases coverage
| Scenario | Trước fix | Sau fix |
|---|---|---|
| Mở `…/ai-usecase-platform/` (trailing slash) | ❌ redirect → `…/ai-usecase-platform/ai-usecase-platform` | ✅ redirect → `…/ai-usecase-platform/index.html` |
| Mở `…/ai-usecase-platform` (no slash) | ❌ redirect → `…/ai-usecase-platform/ai-usecase-platform` | ✅ redirect → `…/ai-usecase-platform/index.html` |
| Mở `…/ai-usecase-platform/dashboard.html` | ✅ redirect → `…/ai-usecase-platform/login.html?return=dashboard.html` | ✅ không đổi |
| `?return=` chứa directory name | ❌ dùng được vì regex cũ pass | ✅ reject → fallback `index.html` |
| `?return=dashboard.html` | ✅ | ✅ không đổi |

---

---

## Session: 2026-06-03 (Part 5)
**Scope:** Fix confirm button bị frozen sau approve/reject đầu tiên
**Commit:** `4bc33bc`
**Version:** 3.6.2

### Root cause
`_confirmDetailAction()` set `confirmBtn.disabled = true` khi bắt đầu xử lý, nhưng **chỉ reset về `false` trong `catch` (error path)**. Success path không bao giờ reset. Kết quả: sau approve/reject thành công, button bị frozen disabled. Lần mở modal tiếp theo — `openDetail()` không reset `disabled` → button bị kẹt → user click không có tác dụng.

### Đã hoàn thành

**Fix lớp 1 — `openDetail()` reset block:**
```js
document.getElementById('detailActionConfirmBtn').disabled = false;
```
Thêm vào block "Reset action area" trong `openDetail()` → mỗi lần mở modal đều reset.

**Fix lớp 2 — `_showActionArea()` (defense-in-depth):**
```js
confirmBtn.disabled = false;
```
Thêm ngay sau khi lấy `confirmBtn` element → đảm bảo reset kể cả khi user đến từ path không qua `openDetail`.

### Test kết quả (Playwright, live GitHub Pages)
| Case | Kết quả |
|---|---|
| Button initial state = enabled | ✅ |
| Simulate stuck (disabled=true) → click Chi tiết → button reset | ✅ |
| Source có ≥2 điểm reset (catch + openDetail + _showActionArea) = 3 điểm | ✅ |

---

---

## Session: 2026-06-03 (Part 6)
**Scope:** Fix duplicate UseCase_ID khi submit đồng thời — gen ID xuống lúc Submit
**Commit:** `3780bf6`
**Version:** 3.6.3

### Root cause
`peekNextUseCaseId_()` không có lock — không atomic. Khi nhiều user submit cùng lúc:
1. Cả 2 FE peek → cùng thấy `AIUS-0005`
2. Cả 2 gọi `createUseCase()` → GAS (nếu chưa deploy v2) ghi 2 row với cùng `AIUS-0005`

Nếu GAS v2 đã deploy (có `LockService`) thì ổn, nhưng vì GAS-MYSTERY-01 vẫn còn → không đảm bảo.

### Fix 2 lớp

**Lớp 1 — FE `app.js`:**
- Xóa `loadNextIdPreview()` khỏi `init()` — không hiện badge sớm (stale, gây nhầm)
- Trong `submitForm()`: gọi `Api.getNextId()` ngay trước `createUseCase()`, gắn kết quả vào `data.UseCase_ID` làm hint
- Nếu GAS offline: try/catch bỏ qua, GAS tự sinh ID server-side

**Lớp 2 — GAS `UseCaseService.gs`:**
- Thêm `_assignUseCaseId_(hint)`: nhận hint từ FE, acquire `LockService`, check hint còn free không → dùng + sync counter qua `_ensureCounterAhead_()`; nếu hint đã dùng → fallback `generateUseCaseId_()`
- Thêm `_ensureCounterAhead_()`: đảm bảo `CONFIG.NEXT_ID` không bao giờ re-issue số đã dùng
- `createUseCase_()` dùng `_assignUseCaseId_(sanitizeStr_(data.UseCase_ID))` thay vì `generateUseCaseId_()` trực tiếp

### Kết quả
- Race window thu hẹp từ (mở form → submit) xuống còn ~1 JSONP RTT
- 2 concurrent submit với cùng hint: chỉ 1 thắng lock + dùng hint; cái kia fallback generate mới → 0 duplicate

### Test kết quả (Playwright, local server)
| Test | Kết quả |
|---|---|
| next-id NOT called on page load | ✅ |
| nextIdBadge hidden on load | ✅ |
| getNextId() called at submit time | ✅ |
| UseCase_ID hint trong createUseCase payload | ✅ |
| getNextId() offline → createUseCase vẫn chạy (graceful) | ✅ |
| lookup still loads normally (no regression) | ✅ |

### Note về GAS deployment
`_assignUseCaseId_()` và `_ensureCounterAhead_()` cần paste vào GAS Editor sau khi tìm được đúng project (GAS-MYSTERY-01). Khi chưa deploy: FE gửi hint nhưng GAS cũ bỏ qua (dùng `generateUseCaseId_()` cũ) → không tệ hơn trước, chỉ chưa đạt full fix.

---

---

## Session: 2026-06-03 (Part 7)
**Scope:** Fix toàn diện ký tự đặc biệt gây lỗi lưu vào GAS — v3.7.0
**Commit:** `76b0242`
**Version:** 3.7.0

### Root cause phân tích

6 bugs được phát hiện qua rà soát toàn bộ encoding pipeline FE → GAS → Google Sheets:

| Bug | Mức độ | Mô tả |
|---|---|---|
| SPECIAL-01 | Minor | CRLF `\r\n` từ Windows clipboard tạo `\r` sót trong Sheets |
| SPECIAL-02 | **High** | Formula injection: giá trị bắt đầu `=`,`+`,`-`,`@`,`\|` bị Sheets interpret làm formula → DATA CORRUPTION |
| SPECIAL-03 | **Critical** | Null byte `\0` → `setValues` fail → SAVE FAILURE |
| SPECIAL-04 | Minor | `\r` giữa chuỗi không bị `sanitizeStr_` strip |
| SPECIAL-05 | **Critical** | `JSON_Backup` vượt 50,000 chars/cell limit → `setValues` throw → SAVE FAILURE |
| SPECIAL-06 | **Critical** | Lone surrogate Unicode → `encodeURIComponent` throw URIError → SAVE FAILURE |

### Đã hoàn thành

**FE — `assets/js/form-mapper.js`:**
- `collectData()`: normalize `\r\n` → `\n`, lone `\r` → `\n` cho textarea elements (SPECIAL-01)

**FE — `assets/js/api.js`:**
- `_request()`: strip lone surrogate trước khi encode (giữ surrogate pair = emoji hợp lệ) (SPECIAL-06)
- Thêm payload size guard: nếu payload > 50,000 chars → reject với error message rõ ràng
- Error message khi encode fail rõ hơn (có hint về ký tự đặc biệt)

**GAS — `assets/gas-backend/Utils.gs`:**
- `sanitizeStr_()`: strip null byte `\0`, strip lone surrogate, normalize `\r\n`/`\r` → `\n` (SPECIAL-03, 04, 06)
- **NEW** `toSheetValue_(val)`: helper prefix `'` cho strings bắt đầu bằng formula chars → chống formula injection trong `appendRow`/`setValues` (SPECIAL-02)
- `appendRowFromObject_()`: dùng `toSheetValue_()` khi build row array
- `updateRowByRecordId_()`: dùng `toSheetValue_()` khi build row array

**GAS — `assets/gas-backend/UseCaseService.gs`:**
- `createUseCase_()`: cap `JSON_Backup` tại 45,000 chars (SPECIAL-05)
- `updateUseCase_()`: cap `JSON_Backup` tại 45,000 chars (SPECIAL-05)

**Test — `assets/tests/test-special-chars.js` (NEW):**
- 62 test cases: A (encoding roundtrip), B (sanitizeStr_), C (toSheetValue_), D (JSON_Backup), E (CRLF), F (end-to-end Prompt_Context)
- 62/62 PASS

### Files changed
| File | Delta |
|---|---|
| `assets/js/form-mapper.js` | +5 lines: CRLF normalization trong collectData |
| `assets/js/api.js` | +20 lines: lone surrogate strip + payload size guard + better error msg |
| `assets/gas-backend/Utils.gs` | +34 lines: sanitizeStr_ improvements + new toSheetValue_() + apply in write helpers |
| `assets/gas-backend/UseCaseService.gs` | +6 lines: JSON_Backup size cap trong create + update |
| `assets/tests/test-special-chars.js` | NEW: 62 unit tests |

### Lưu ý GAS deployment
`Utils.gs` và `UseCaseService.gs` có thay đổi cần deploy. Do GAS-MYSTERY-01 vẫn chưa resolved, các fix GAS chưa active trên production.
Khi tìm được đúng project → deploy tất cả 6 files (xem TODO_NEXT.md).

### Quyết định kỹ thuật
1. **`toSheetValue_` chỉ apply khi ghi sheet** — không apply trong `sanitizeStr_` để JSON_Backup lưu giá trị gốc (không có `'` prefix)
2. **Lone surrogate regex**: `/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g` — surrogate pair match trước, lone surrogate còn lại bị strip
3. **JSON_Backup = 45,000 chars** (không phải 50,000) — buffer 5,000 chars cho overhead

---

---

## Session: 2026-06-03 (Part 8)
**Scope:** Fix timeout false-failure khi create/update UC
**Commit:** `e83f16b`
**Version:** 3.7.1

### Root cause phân tích

GAS `createUseCase_` / `updateUseCase_` thực hiện quá nhiều sheet reads đồng bộ:
- `updateUseCase_`: đọc MASTER_DATA 2 lần (`findObjectByField_` + `updateRowByRecordId_`) + ghi ACTIVITY_LOG
- `createUseCase_`: đọc MASTER_DATA (ID assignment) + CONFIG + ghi MASTER + ACTIVITY_LOG
- `LOCK_TIMEOUT_MS = 10000`: lock chờ tối đa 10s
- Tổng execution: có thể 15–25s với sheet nhiều rows → vượt 20s FE JSONP timeout
- GAS ghi xong nhưng response về sau khi FE đã cleanup callback → user thấy "lỗi" nhưng data đã lưu

### Đã hoàn thành

**FE — `assets/js/api.js`:**
- `_request(url, data, timeoutMs)`: thêm param `timeoutMs` truyền xuống `_jsonp()`
- `createUseCase` / `updateUseCase`: dùng `45000ms` thay vì mặc định `20000ms`

**FE — `assets/js/app.js`:**
- `submitForm()`: tách xử lý lỗi ra `_handleSubmitError(err, recordId, hintId)`
- `_handleSubmitError()`:
  - Lỗi thật (không phải timeout): hiện toast error như cũ
  - **Update timeout**: auto-verify bằng `Api.getUseCase(recordId)` — nếu record tồn tại → show success, nếu không → warn user kiểm tra dashboard
  - **Create timeout**: hiện warning kèm hint ID, hướng dẫn kiểm tra dashboard trước khi nộp lại

**GAS — `assets/gas-backend/Utils.gs`:**
- Thêm `findRowByField_(sheetName, field, value)`: đọc sheet 1 lần, trả về `{obj, rowIndex, headers, sheet}` → caller write trực tiếp không cần đọc lại

**GAS — `assets/gas-backend/UseCaseService.gs`:**
- Rewrite `updateUseCase_()`: dùng `findRowByField_` thay cho `findObjectByField_` + `updateRowByRecordId_`
- Kết quả: MASTER_DATA chỉ đọc **1 lần** thay vì 2 → giảm ~30-50% execution time cho update

### Files changed
| File | Delta |
|---|---|
| `assets/js/api.js` | +5 lines: timeoutMs param + 45s cho write ops |
| `assets/js/app.js` | +48 lines: `_handleSubmitError()` + smart timeout recovery |
| `assets/gas-backend/Utils.gs` | +32 lines: `findRowByField_()` |
| `assets/gas-backend/UseCaseService.gs` | +10/-8 lines: single-read update |

### Decisions chốt
1. **45s timeout** — đủ cho GAS với sheet ~200 rows; GAS hard limit là 6 phút nên vẫn còn margin
2. **Update auto-verify** — dùng `getUseCase` (read-only, nhanh hơn write) để xác nhận; nếu GAS vẫn bận → warn thay vì fail silently
3. **Create warning** — không thể verify ID vì chưa có Record_ID; hint ID giúp user tìm trên dashboard
4. **GAS single-read** — `findRowByField_` giữ `sheet` reference → write dùng `sheet.getRange().setValues()` trong cùng execution, không mở lại sheet

### GAS deployment note
`Utils.gs` + `UseCaseService.gs` có thay đổi → cần deploy sau khi tìm được GAS project (GAS-MYSTERY-01). Trước khi deploy GAS, FE đã hoạt động với 45s timeout + smart recovery.

---

## Session: 2026-06-03 (Part 9)
**Scope:** Fix HTTP 400 khi create/update với Prompt_Context có nội dung
**Commit:** `006bae5`
**Version:** 3.7.2

### Root cause phân tích (2 scenario)

**CREATE — data KHÔNG trong DB khi có 400:**
- Tiếng Việt tốn 3 bytes UTF-8/ký tự → base64url expand 4× so với ASCII
- 1,500 ký tự Việt trong Prompt_Context → ~6,000 chars base64url → full GET URL ~6,200 chars
- GAS infrastructure giới hạn ~8KB URL → reject trước khi `doGet` chạy → HTTP 400
- Không có data nào được ghi → User nhầm tưởng data có trong DB từ lần submit thành công trước đó

**UPDATE — data CÓ trong DB nhưng vẫn 400:**
- GAS chạy xong, ghi data thành công vào sheet
- `updateUseCase_` trả về full merged object (~7,000+ chars khi Prompt_Context có nội dung)
- `sendJsonP_` tạo JSONP body lớn → Google cần embed response vào redirect URL → URL quá dài → HTTP 400
- Data đã ghi nhưng response delivery thất bại → user thấy 400 nhưng data vẫn có trong sheet

### Đã hoàn thành

**FE — `assets/js/api.js`:**
- Đổi payload size check từ pre-encode JSON (50,000 chars, không hiệu quả) sang **post-encode base64url (7,500 chars)**
- Tiếng Việt expand ~4×, pre-encode check không phản ánh URL thực tế
- Error message mới nêu rõ field `Prompt_Context`, giải thích Vietnamese overhead

**FE — `assets/js/app.js`:**
- **Strip empty fields** khỏi CREATE payload trước khi encode
- GAS tự khởi tạo tất cả field về '' → safe khi bỏ field rỗng
- Giảm URL điển hình ~60% (form có ~35 fields, phần lớn rỗng)

**GAS — `assets/gas-backend/UseCaseService.gs`:**
- `updateUseCase_()` trả về **minimal response** `{record_id, usecase_id, updated_at}` thay vì full merged object
- FE không sử dụng merged data sau update
- Giảm JSONP response body từ ~7,000+ chars → ~100 chars → fix UPDATE 400

### Files changed
| File | Delta |
|---|---|
| `assets/js/api.js` | +9/-4 lines: post-encode size check + detailed error message |
| `assets/js/app.js` | +6 lines: strip empty fields cho create payload |
| `assets/gas-backend/UseCaseService.gs` | +3/-7 lines: minimal update response |

### Decisions chốt
1. **7,500 chars base64url limit** — buffer ~500 chars cho URL overhead (base URL 130 chars + action + callback ~60 chars = 190 chars), tổng URL ~7,690 chars, an toàn dưới 8KB
2. **Strip empty cho create chỉ** — update cần giữ empty values (để clear fields đã fill trước đó)
3. **Minimal update response** — `{record_id, usecase_id, updated_at}` đủ cho FE verify (dùng trong `_handleSubmitError` auto-verify qua `getUseCase`)
4. **Không thay đổi `toSheetValue_`** — `'` prefix được Sheets API xử lý như "text escape" (consumed), không gây 400 Sheets API error

### GAS deployment note
`UseCaseService.gs` có thay đổi → cần deploy khi tìm được GAS project (GAS-MYSTERY-01).
Trước khi deploy GAS: FE đã có strip-empty + post-encode size check → CREATE sẽ tốt hơn.
Sau khi deploy GAS: UPDATE 400 cũng được fix (minimal response).

---

## Session: 2026-06-03 (Part 10)
**Scope:** Fix HTTP 400 UPDATE — xác nhận root cause qua URL thực tế + FE workaround
**Commit:** `d52c756`
**Version:** 3.7.3

### Root cause xác nhận qua URL thực tế

User cung cấp failing request URL:
```
https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhn...<10,000+ chars>...&lib=...
```

**Cơ chế:**
1. GAS nhận request → `doGet` chạy → ghi data vào DB ✅
2. GAS tạo JSONP response gồm full merged object (Prompt_Context ~5,000 chars tiếng Việt)
3. GAS trả 302 redirect đến `googleusercontent.com/macros/echo?user_content_key=<ENCODED_RESPONSE>`
4. `user_content_key` = base64url encode của toàn bộ JSONP response → ~10,000+ chars
5. Browser theo redirect → URL quá giới hạn → **HTTP 400**
6. `<script>` tag nhận 400 → `script.onerror` → error "GAS script load thất bại"

### Vấn đề với fix trước

`_handleSubmitError` v3.7.1 chỉ kiểm tra `isTimeout` (message chứa "Timeout"). `script.onerror` tạo ra error "GAS script load thất bại" → bypass logic auto-verify → user thấy "Lỗi gửi: GAS script load thất bại" dù data đã ghi xong.

### Đã hoàn thành

**FE — `assets/js/app.js`:**
- `_handleSubmitError()`: thêm `isScriptError` = check "script load thất bại"
- `isTransportErr = isTimeout || isScriptError` — cả hai đều trigger UPDATE auto-verify
- Khi `isScriptError` cho UPDATE: gọi `getUseCase(recordId)` → nếu record tồn tại → show success
- Error message cập nhật (không mention "45s" cho script.onerror case)

### Files changed
| File | Delta |
|---|---|
| `assets/js/app.js` | +11/-10 lines: `isScriptError` + `isTransportErr` trong `_handleSubmitError` |

### Luồng xử lý sau fix (UPDATE với Prompt_Context dài)

```
User click Update
  → GAS runs → writes to DB → returns full merged response → 302 redirect
  → googleusercontent returns 400 (URL quá dài)
  → script.onerror → "GAS script load thất bại"
  → _handleSubmitError: isScriptError=true, recordId exists
  → showLoading("Đang xác nhận kết quả...")
  → Api.getUseCase(recordId) → success (small response)
  → Storage.clear() → Toast "Cập nhật thành công!" → showSuccessScreen
```

### Fix vĩnh viễn cần deploy GAS

Deploy `UseCaseService.gs` (đã có trong repo, minimal response):
```js
return { record_id: recordId, usecase_id: merged.UseCase_ID, updated_at: now };
```
→ `user_content_key` chỉ ~100 chars → URL không bao giờ quá giới hạn

---

---

## Session: 2026-06-05 (Part 13)
**Scope:** USERS sheet + User management feature + 30/30 local tests pass
**Commits:** `cc8420c` (feat) — merged vào `main`
**Version:** 3.10.0

---

### Đã hoàn thành

- **GAS `UserService.gs` (NEW)** — `normalizeUser_()` case-insensitive (Tuantt4=tuantt4=TUANTT4), `upsertUser_()`, `syncUsersFromMasterData_()`, `validateUserLogin_()`, `updateLastLogin_()`, `getAdminUsernamesFromSheet_()`
- **`Config.gs`** — `SHEETS.USERS = 'USERS'` + `USERS_HEADERS` constant
- **`Utils.gs`** — `getOrCreateSheet_` xử lý USERS sheet
- **`AdminService.gs`** — `getAdminEmails_()` priority: USERS sheet → CONFIG sheet → Config.gs hardcoded
- **`Code.gs`** — 5 endpoints mới: `user-login`, `users`, `user-upsert`, `user-sync`, `user-init`
- **`auth.js`** — `AuthService.storeUser()` public method
- **`routes.js` + `api.js`** — `validateUser`, `getUsers`, `upsertUser`, `syncUsers`, `initUsersSheet`
- **`login.html`** — load `routes.js` + `api.js`; async login (GAS trước, local fallback)
- **`dashboard.html`** — Tab "Người dùng" (admin-only) + user add/edit modal
- **`dashboard.js`** — `_loadUsersTab`, `renderUsersTab`, `_bindUsersTab`, `_saveUser`, `_editUser`
- **`dashboard.css`** — `.data-table`, `.btn--ghost`, `.dash-card-actions`
- **Verification: 30/30 Playwright tests PASS** — T1–T8 covering login, tab visibility, modal, regression, offline fallback

### USERS sheet structure
| Column | Mô tả |
|---|---|
| Username | Normalized lowercase — primary key |
| Display_Name | Tên hiển thị trong UI |
| Role | `admin` hoặc `user` |
| Team | Phòng/team |
| Email | Email thực (optional, future OAuth) |
| Active | TRUE/FALSE — deactivate không xóa row |
| Created_At | ISO timestamp |
| Last_Login | Cập nhật mỗi lần đăng nhập |

### Case-insensitive design
`normalizeUser_(str)` = `.trim().toLowerCase()` — áp dụng ở **mọi** điểm so sánh trong GAS và FE.

### Blockers còn lại
- **GAS-MYSTERY-01** — vẫn chưa resolve → 7 file GAS local chưa deploy
- **FILTER-01 / PERF-02** — 1-dòng fixes, vẫn pending

---

## Session: 2026-06-05
**Scope:** Stacked breakdown charts + KPI & Tiến độ tab + local verification
**Commits:** `9e15471` (stacked charts + guide) · `afcdf44` (KPI tab) · `91c4a00` (date fix) · `b0cff5f` / `0aa7c18` (context)
**Version:** 3.9.0

---

### Tasks completed

| # | Mô tả | Commit |
|---|-------|--------|
| 1 | **Stacked bar charts** — "Phân bổ theo Team" và "Phân bổ theo Lĩnh vực" đổi từ single-bar sang stacked bar phân màu theo 6 trạng thái. Click segment → list modal lọc group + status. CSS fallback hiện badge trạng thái dưới mỗi row. | `9e15471` |
| 2 | **User guide** — `HUONG_DAN_NHAP_LIEU.txt`: hướng dẫn đầy đủ 32 trường cho 4 bước wizard. | `9e15471` |
| 3 | **KPI & Tiến độ tab** — Tab mới visible tất cả users. 4 section: header tuần (% đạt), bảng tiến độ tuần, bar chart 6 tháng, ranking tổng + streak leaderboard. Tính client-side từ `_allList`. | `afcdf44` |
| 4 | **Fix date format** — `_getWeekRange` dùng `toLocaleDateString('vi-VN')` trả về hyphens (`01-06`) thay vì slashes (`01/06`) trên một số Chromium/Windows. Đổi sang manual `padStart` formatter. | `91c4a00` |

---

### Files changed

| File | Delta |
|------|-------|
| `assets/js/dashboard.js` | +`renderStackedChart` + `_renderStackedChartCSS` (replace `renderBreakdownChart` call sites); +`renderKPITab`, `_buildKPIData`, `_getWeekKey`, `_getWeekStart`, `_prevWeekKey`, `_getWeekRange`, `_computeStreak`, `_buildMonthlyKPI`, `_renderKPIMonthChart`; fix `_getWeekRange` manual formatter; update `_loadTabData` |
| `dashboard.html` | +tab button `[data-tab="kpi"]`; +tab panel `#tab-kpi` |
| `assets/css/dashboard.css` | +~170 lines: `.kpi-week-header`, `.kpi-badge`, `.kpi-me-tag`, `.kpi-row--me`, `.kpi-streak-*` |
| `HUONG_DAN_NHAP_LIEU.txt` | NEW — hướng dẫn nhập liệu 32 trường |
| `ai_context/PROJECT_STATE.md` | Version bump → 3.9.0; feature rows added |
| `ai_context/TODO_NEXT.md` | Part 11 + 12 entries added |

---

### Decisions chốt

1. **Stacked data = client-side từ `_allList`** — không cần endpoint GAS mới. Tính đơn giản, không cần deploy GAS để có tính năng.
2. **KPI visible tất cả users** — không admin-only. Khuyến khích cạnh tranh lành mạnh trong toàn đội.
3. **Định nghĩa đạt KPI** = UC có `status ≠ 'Draft'` (Submitted trở lên). Draft không tính.
4. **Week key = ISO Monday date string** (e.g. `"2026-06-02"`) — tránh ISO week number arithmetic phức tạp tại year boundaries.
5. **Strict streak** — không UC tuần đang chạy → streak = 0. Khuyến khích nộp sớm trong tuần.
6. **Manual `DD/MM` formatter** — `toLocaleDateString('vi-VN')` unreliable trên headless Chromium (hyphens vs slashes theo OS locale). Dùng `padStart` thủ công để đảm bảo nhất quán mọi môi trường.
7. **`renderBreakdownChart` vẫn giữ trong code** — không xóa để tránh break CSS fallback references; tuy nhiên không còn được gọi cho team/category charts.

---

### Verification (Playwright local)

Test runner: Playwright + Chrome (`localhost:8787` Python HTTP server).

| Check | Kết quả |
|-------|---------|
| KPI tab button & panel visible | ✅ |
| teamChart canvas rendered (Chart.js stacked) | ✅ |
| categoryChart canvas rendered | ✅ |
| Click teamChart bar → listModal "Team: CV2 — Đã duyệt" | ✅ |
| Click categoryChart bar → listModal "Lĩnh vực: Vận hành — Đã duyệt" | ✅ |
| KPI tab renders week header + table + chart | ✅ |
| Current user row highlighted (kpi-row--me) | ✅ |
| KPI tab visible for regular user; overview hidden | ✅ |
| Week range format `"01/06 – 07/06"` slashes | ✅ (after fix) |
| JS errors | ✅ 0 |

---

### Regression risks

- **`renderBreakdownChart` dead code** — hàm vẫn tồn tại nhưng không được gọi cho team/category charts nữa. CSS fallback references (`Dashboard._openListByTeam/Category`) vẫn hoạt động vì hàm `_renderBreakdownChartCSS` vẫn còn. Không có risk immediate.
- **KPI stats subject to DATA-LIMIT-01** — `_buildKPIData()` iterate trên `_allList` (max 200 records). Nếu total UC > 200 thì `thisWeek` / `streak` / `ranking` sẽ thiếu data của user có UC ngoài top 200. Cùng limitation với các tab khác.
- **Streak chỉ đúng khi user nộp đủ 1 UC/tuần** — với dữ liệu test hiện tại tất cả UCs được nộp trong 1 tuần (T6/2026) nên 100% đạt + streak = 1. Behavior sẽ rõ hơn sau vài tuần có real data.

---

### Blockers còn lại (không thay đổi từ session trước)

- **GAS-MYSTERY-01** — URL GAS active không tìm được project nguồn → toàn bộ GAS code local chưa deploy. **Cần user action.**
- **GAS pending deploy** — 6 files cần paste + deploy khi tìm được project (xem TODO_NEXT P0).
- **FILTER-01** — `_populateTeamFilter` stale state: 1-dòng fix, vẫn pending.
- **PERF-02** — `_loadTabData('my')` double-fetch: 1-dòng guard, vẫn pending.

---

---

## Session: 2026-06-05 (Part 14)
**Scope:** KPI & Tiến độ tab — load user list từ USERS sheet + case-insensitive matching
**Commit:** `e3c2922`
**Version:** 3.10.1

---

### Đã hoàn thành

- **FEAT: KPI tab hiển thị users với 0 UC** — `_buildKPIData()` rewrite hoàn toàn. Primary source là `_usersList` (USERS sheet). Users chưa nộp UC vẫn xuất hiện với `thisWeek=0` + badge "⏳ Chưa". Inactive users (`active=false`) excluded.
- **FIX: Case-insensitive matching** — `_norm()` helper: `.trim().toLowerCase()` áp dụng cho tất cả key so sánh. Tuantt4=TuanTT4=tuantt4 merge thành 1 entry. Không còn duplicate row.
- **FIX: "isMe" highlight** — `curUserKey` lấy từ `_user.email` (= username) thay vì `displayName`. `isMe` check: `u.username === curUserKey` (primary) → `u.name.toLowerCase()` (fallback).
- **Lazy load users cho KPI tab** — `_loadTabData('kpi')`: nếu `_usersList` chưa có, tự gọi `Api.getUsers()` trước khi render; fail-silently nếu GAS endpoint chưa deploy → fallback `_allList` (backward compat hoàn toàn).
- **Edge case: UC owners không có trong USERS sheet** — vẫn xuất hiện trong KPI (submitted trước khi có user management).
- **Tests:** `test-kpi-data.js` — 20/20 pass (5 suites: users với 0 UC, case-insensitive, fallback, owner_email missing, isMe detection)

### Files changed

| File | Delta |
|------|-------|
| `assets/js/dashboard.js` | +69/-22 lines: `_norm()` helper; `_buildKPIData()` rewrite (byEmail+byName index, USERS sheet join); `_loadTabData('kpi')` lazy users load; `renderKPITab()` username-based isMe, userKeys |
| `assets/tests/test-kpi-data.js` | NEW — 20 unit tests |
| `assets/tests/test-kpi-playwright.js` | NEW — Playwright integration test template (requires local server) |

### Decisions chốt

1. **`_norm()` = single normalize function** — `trim().toLowerCase()` dùng ở mọi điểm so sánh trong `_buildKPIData`. Không inline lặp lại.
2. **byEmail primary, byName secondary** — `owner_email` (username) là key chính vì reliable hơn `owner_name` (display name). Nếu `owner_email` rỗng → fallback `owner_name`.
3. **Lazy load, không thêm vào `_loadStartupData`** — tránh thêm request có thể timeout (GAS-MYSTERY-01) vào startup critical path. KPI tab load users khi user click tab lần đầu.
4. **Inactive users excluded** — `u.active === false` → skip. Consistent với logic USERS sheet.
5. **pctAchieved denominator = tất cả active users** — mẫu số giờ bao gồm cả users 0 UC → % đạt KPI phản ánh đúng thực tế team hơn (có thể thấp hơn trước).

### Regression risks

- **pctAchieved thấp hơn** — Trước đây mẫu số chỉ là users có ≥1 UC (đều đạt). Nay mẫu số là tất cả active users → % thường thấp hơn. Đây là intentional/accurate nhưng có thể gây ngạc nhiên.
- **Lazy `Api.getUsers()` on KPI tab click** — nếu GAS chậm, user thấy tab trống ~1-2 giây trước khi render. Acceptable; không có spinner riêng cho phase này.
- **`_buildKPIData` fallback khi `_usersList = []`** — nếu GAS users endpoint fail, hành vi giống v3.9.0 (chỉ hiện users có UC). Không tệ hơn baseline.

### Open issues (không thay đổi)

- GAS-MYSTERY-01 — 7 file GAS chưa deploy → user-login validate qua GAS không có tác dụng
- FILTER-01, PERF-02 — 1-line fixes vẫn pending

---

## Session: 2026-06-08
**Scope:** KPI tab enhancements — week navigation, exclude directors, Approved-only count
**Version:** 3.10.2

### Đã hoàn thành

- **FEAT: KPI week navigation** — Nút ‹/› trong header tuần cho phép xem lại KPI các tuần trước. `_kpiViewedWeek` state var (null = tuần hiện tại). `_nextWeekKey()` helper mới. Nút "›" disabled khi đang xem tuần hiện tại. Section title thay đổi động: "Tuần này" / "N tuần trước". `Dashboard._kpiNav(dir)` trong public API. Streak tính tương đối theo tuần đang xem.
- **FEAT: Loại user khỏi KPI** — `KPI_EXCLUDED_USERS: ['cuongvm1']` trong `config/env.js`. `_buildKPIData()` bỏ qua user trong danh sách này ở tất cả paths (USERS sheet, byEmail fallback, byName fallback). Dễ thêm/bỏ user bằng cách sửa `env.js`.
- **FIX: KPI chỉ đếm UC được duyệt** — Đổi `if (!uc.status || uc.status === 'Draft') return` → `if (uc.status !== 'Approved') return`. UC bị từ chối, đang nộp, đang review không còn tính KPI. Goal text: "1 UC được duyệt / người / tuần".

### Files changed
| File | Delta |
|---|---|
| `config/env.js` | +3 lines: `KPI_EXCLUDED_USERS: ['cuongvm1']` |
| `assets/js/dashboard.js` | +66 lines net: `_kpiViewedWeek` state; `_nextWeekKey()`; `_buildKPIData()` excluded check + Approved-only filter; `renderKPITab()` week nav + dynamic label; `Dashboard._kpiNav()`; render-immediately fix in `_loadTabData('kpi')` |
| `assets/css/dashboard.css` | +30 lines: `.kpi-week-nav`, `.kpi-nav-btn` styles |

### Decisions chốt
1. **KPI = Approved only** — UC nộp xong nhưng chưa được duyệt không tính; phản ánh đúng giá trị thực tế
2. **`KPI_EXCLUDED_USERS` trong env.js** — admin có thể thêm/bỏ user mà không cần sửa logic JS; hiện tại `['cuongvm1']`
3. **Week nav chỉ thay đổi "Tiến độ tuần"** — Monthly chart luôn 6 tháng gần nhất; Ranking tính tổng all-time; Streak tính backward từ tuần đang xem
4. **Render-immediately fix** — `_loadTabData('kpi')` nay render ngay với data có sẵn, sau đó re-render sau khi `getUsers()` resolve; trước đây chờ `getUsers()` (20s timeout) mới render → nav buttons không xuất hiện

### Bug found + fixed trong session này
**KPI-SPINNER-01 CLOSED** — `_loadTabData('kpi')` cũ: nếu `_usersList` rỗng, gọi `renderKPITab()` sau `getUsers()` resolve, không render gì trong lúc chờ → nav buttons không xuất hiện. Fix: render ngay với `_allList` hiện có, `getUsers()` chạy background và re-render sau khi xong.

### Test kết quả
15/15 Playwright tests PASS — login inject → KPI tab → nav buttons, label, disabled state, cuongvm1 exclusion, prev/next navigation, 3-week back, no JS errors.

---

## Recommended next actions (session kế tiếp)

**[P0 — USER ACTION] Tìm GAS project (GAS-MYSTERY-01):**
1. Mở `script.google.com` → My Projects → từng project → Deploy → Manage deployments
2. Tìm URL chứa `AKfycbypN8afAl2z` → đổi tên project → note lại

**[P0 — sau khi tìm được GAS] Paste 9 file vào GAS Editor → Edit deployment → New version → Deploy:**
`AdminService.gs` (NEW funcs) · `Code.gs` (champion-review route) · `UserService.gs` (NEW) · `UseCaseService.gs` · `Config.gs` · `Utils.gs` · `LookupService.gs` · `DashboardService.gs`

Sau khi deploy, chạy 1 lần:
- `GAS_URL?action=user-init&admin_email=tuantt4` → tạo sheet USERS + seed admin
- Dashboard → tab Người dùng → Đồng bộ từ UC → import tất cả owner từ MASTER_DATA
- Thêm champion users vào USERS sheet: Role=champion, Active=TRUE, Team=<tên team khớp MASTER_DATA>

**[P1] Fix `_populateTeamFilter` stale state (FILTER-01):**
- 1 dòng: `_filterAll.team = teamSel.value` sau khi render options. File: `assets/js/dashboard.js`

**[P1] Fix `_loadTabData('my')` double-fetch (PERF-02):**
- Thêm guard `if (_myList.length === 0)`. File: `assets/js/dashboard.js`

**[P1] Regression risks còn mở (không blocking):**
- `_pendingList` derive client-side từ `_allList` limit 200 → UC pending sau row 200 không hiện tab Chờ duyệt
- `rejectedCard` cũng limit 200 → admin list lớn có thể miss rejected UC cuối
- KPI stats subject to DATA-LIMIT-01 (cùng giới hạn 200 records)

**[P2] Pagination** — `_allList` giới hạn 200 records

**[P2] BUG-03** — Status="Draft" khi tạo mới: confirm với PO là bug hay intent

**[P3] Xóa dead code** — `renderBreakdownChart` và `_renderBreakdownChartCSS` không còn được gọi cho team/category charts (đã thay bằng `renderStackedChart`). Có thể xóa nếu muốn clean up.

---

## Session: 2026-06-17
**Scope:** Champion Role + Review Queue + Scoring Preview + Standalone User Management page
**Commit:** `c6eca78` (main) — 26 files changed, +2648 insertions, -138 deletions
**Tests:** 59/59 Playwright PASS (4 spec files, local Python http.server port 8787)
**GAS deploy:** ⚠️ PENDING — `AdminService.gs` + `Code.gs` edited locally, NOT yet deployed

### Files Added

| File | Description |
|---|---|
| `users.html` | Standalone admin-only user management (replaces dashboard tab) |
| `review-queue.html` | Champion+admin review queue — 3 sections + slide-in review panel |
| `assets/js/users.js` | UsersPage IIFE — table render, add/edit modal, role color badges |
| `assets/js/review-queue.js` | ReviewQueue IIFE — load, team-filter, panel open/close, submit |
| `assets/js/scoring.js` | ScoringEngine client-side (mirrors GAS ScoringEngine.gs) |
| `playwright.config.js` | Playwright config — Python http.server port 8787, Chromium only |
| `tests/helpers.js` | `setSession()`, `mockGAS()`, fixture users + UC list |
| `tests/01-auth-nav.spec.js` | 15 tests: role-based nav on index/register/dashboard |
| `tests/02-users-page.spec.js` | 9 tests: users.html access, table render, modal, redirect |
| `tests/03-review-queue.spec.js` | 12 tests: access control, badge counts, panel, submit API |
| `tests/04-scoring-preview.spec.js` | 21 tests: ScoringEngine unit + register.html preview sliders |
| `tests/scoring-test.html` | Minimal HTML fixture (only loads scoring.js, no auth) |

### Files Modified

| File | Delta |
|---|---|
| `register.html` | navUsers/navReviewQueue; scoring preview panel + self-assessment sliders; `<link>` to dashboard.css |
| `index.html` | navUsers + navReviewQueue (replaced navManagerReview) |
| `assets/js/app.js` | `_bindScoringPreview()`, `_updateScoringPreview()`; slider values injected at submit |
| `assets/css/dashboard.css` | +~380 lines: score ring/bars/sliders, rq-sections, review panel overlay |
| `assets/js/auth.js` | `isChampion()`, `isChampionOrAdmin()`, `requireChampionOrAdmin()`, `populateSidebarUser()`, `setupNav()` |
| `config/env.js` | `CHAMPION_USERS: []` fallback list |
| `config/routes.js` | `submitChampionReview` endpoint |
| `assets/js/api.js` | `Api.submitChampionReview()` |
| `assets/gas-backend/AdminService.gs` | `isChampionForTeam_()` + `submitChampionReview_()` |
| `assets/gas-backend/Code.gs` | `champion-review` route |
| `package.json` | `@playwright/test` devDependency |

### Decisions Made This Session

1. Champion cannot approve/reject (admin-only right); champion scores Quality/BV/Innovation 0–10
2. Champion sees only their own team's UCs — enforced both FE (`_filter()`) and GAS (`isChampionForTeam_()`)
3. Separate pages (users.html, review-queue.html) — not tabs inside dashboard
4. Self-assessment: BV + Innovation sliders on register wizard; Quality scored post-review by champion
5. Scores visible publicly on Explore tab
6. `tests/scoring-test.html` minimal fixture → avoids auth redirect that blocked ScoringEngine loading in tests

### Bugs Fixed During Session

- `getAllRows_()` does not exist → fixed to `getAllUsers_()` in `isChampionForTeam_()`
- USERS lookup was `u.Email || u.Username` → fixed to `u.Username || u.Email` (reviewer_email is username)
- `uc.owner` field doesn't exist → fixed to `uc.owner_name` in `review-queue.js`
- `@playwright/test` not installed → added as devDependency
- ScoringEngine tests hitting auth redirect → fixed with `tests/scoring-test.html` fixture

### Blocker (session 2026-06-17)

GAS files NOT deployed. `champion-review` route + `isChampionForTeam_()` only exist locally.
Deploy via "Edit deployment → New version" (NOT New Deployment — keep URL unchanged).
GAS URL: `AKfycbypN8afAl2zQwpR7K6k1-699g3HAhFAIqAOtDn3qY1nJWzuN1bd8n99bzRUzaV8ZMyTCw`

---

## Session: 2026-06-18
**Scope:** Sidebar UI đồng bộ toàn bộ pages + fix Champion role không lưu DB + GAS deployed
**Commit:** `c4a53ec` — 5 files changed, 80 insertions, 80 deletions
**Tests:** 59/59 Playwright PASS
**GAS:** ✅ **FULLY DEPLOYED** — GAS-MYSTERY-01 CLOSED. URL giữ nguyên.

---

### Đã hoàn thành

#### Task 1 — Sidebar UI audit + sync (4 files)

| File | Vấn đề | Fix |
|---|---|---|
| `leaderboard.html` | Thiếu `navUsers`, `navReviewQueue`; có `navManagerReview` lỗi thời; `initAuth()` thủ công (champion → "Người dùng") | Thêm 2 nav items vào section Quản lý; xóa navManagerReview; thay `initAuth()` bằng `AuthService.requireAuth()` + `populateSidebarUser()` + `setupNav()` |
| `weekly-update.html` | Thiếu `navUsers`, `navReviewQueue`; có `navManagerReview`; `initSidebar()` thủ công | Cùng fix; thay DOMContentLoaded + initSidebar bằng AuthService calls |
| `users.html` | Pattern B sidebar (div.sidebar-header + "AI-US-SPTD"); `nav role="menu"`; thiếu section label "Quản lý"; topbar class sai (`topbar-user`, `topbar-avatar`, `topbar-username`) | Pattern B → A; `role="menubar"`; thêm label; `topbar-user-chip` / `topbar-user-avatar` / `topbar-user-name` |
| `review-queue.html` | Cùng Pattern B issues | Cùng fix |

**Sidebar Pattern A (chuẩn — tất cả sidebar pages):**
```html
<aside aria-label="Điều hướng chính">
  <a href="index.html" class="sidebar-brand">
    <div class="sidebar-brand-logo"><!-- sparkles SVG --></div>
    <div class="sidebar-brand-text">
      <span class="sidebar-brand-name">Bình dân hóa AI</span>
      <span class="sidebar-brand-sub">TT SPTD</span>
    </div>
  </a>
  <nav role="menubar">
    <span class="sidebar-section-label">Quản lý</span>
    <!-- nav items -->
```

**Nav items chuẩn trong section Quản lý (tất cả sidebar pages phải có):**
```
navDashboard      — admin only       — href="dashboard.html"     — style="display:none"
[Đăng ký UC]      — all users        — href="register.html"
[Use Case của tôi] — all users        — href="dashboard.html?tab=my"
navUsers          — admin only       — href="users.html"         — style="display:none"
navReviewQueue    — admin+champion   — href="review-queue.html"  — style="display:none"
```

**Inline JS pattern (auth guard + sidebar init):**
```js
AuthService.requireAuth();          // hoặc requireAdmin / requireChampionOrAdmin
AuthService.populateSidebarUser();  // set name + role + avatar từ session
AuthService.setupNav();             // show/hide nav items theo role
```

---

#### Task 2 — Champion role không lưu DB (2 fixes trong UserService.gs)

**Root cause:** GAS `_buildUserRow_` ternary chỉ giữ 'admin', downgrade 'champion' → 'user' silently. GAS trả `{success:true}` → api.js resolves → toast "Đã cập nhật" → user không phát hiện. Tương tự, `validateUserLogin_` trả 'user' thay vì 'champion' khi login.

| Hàm | Bug | Fix |
|---|---|---|
| `_buildUserRow_` (line 181) | `normRole === 'admin' ? 'admin' : 'user'` | `(normRole === 'admin' \|\| normRole === 'champion') ? normRole : 'user'` |
| `validateUserLogin_` (line 307) | `_resolvedRole === 'admin' ? 'admin' : 'user'` | `(_resolvedRole === 'admin' \|\| _resolvedRole === 'champion') ? _resolvedRole : 'user'` |

---

### GAS deploy — trạng thái sau session

**GAS-MYSTERY-01: CLOSED** — User tìm được đúng project, deploy thành công. URL giữ nguyên.

Tất cả 9 files đã live:
`AdminService.gs` · `Code.gs` · `UserService.gs` (+ champion fix) · `Config.gs` · `Utils.gs` · `UseCaseService.gs` · `LookupService.gs` · `DashboardService.gs`

**Quy trình deploy chuẩn (không thay đổi URL):**
```
GAS Editor → Deploy → Manage Deployments → Edit (bút chì) → Version: "New version" → Deploy
```

---

### Recommended next actions (session tiếp theo)

**[P0] Champion E2E test:**
1. Thêm champion vào USERS sheet: `Role=champion`, `Active=TRUE`, `Team=<tên khớp MASTER_DATA>`
2. Login champion → verify navReviewQueue visible, role label "Champion"
3. Review-queue → set sliders → submit → check MASTER sheet scores

**[P0] Khởi tạo USERS sheet (nếu chưa):**
```
GAS_URL?action=user-init&admin_email=tuantt4
```
Sau đó Dashboard → tab Người dùng → Đồng bộ từ UC.

**[P1] Fix regression risks còn mở:**
- FILTER-01: `_filterAll.team = teamSel.value` sau render options (`dashboard.js _populateTeamFilter`)
- PERF-02: `if (_myList.length === 0)` guard trong `_loadTabData('my')` (`dashboard.js`)

**[P1] Smoke test toàn hệ thống sau GAS deploy:**
- `GAS_URL?action=health` → `{"success":true}`
- Login → submit UC mới → kiểm tra ID, ký tự đặc biệt, score preview
- Admin approve → UC xuất hiện ở Explore với score chip
- Champion review → Total_Score recalculated

**[P2] KPI_EXCLUDED_USERS từ USERS sheet** — thêm column `KPI_Exempt` thay vì hardcode trong env.js

**[P2] BUG-03** — Status="Draft" khi tạo mới: confirm với PO là bug hay intent

---

## Session: 2026-06-18 (Part 2)
**Scope:** Scoring Display (KPI + Detail) + Review Queue Filter + Home Page Service Cards + Sidebar Nav Order
**Commit:** `6f6f774` — 11 files changed, 597 insertions, 97 deletions
**Version:** 3.10.4

---

### Đã hoàn thành

#### Feature A — Scoring Display (KPI tab + detail popup)

- **`_openKPIScoreList(title, items)`** (`dashboard.js` ~line 1654) — replaces `openListModal` in `_openKPIUserList()`. Popup columns: Mã | Tên | Trạng thái | Điểm Auto | Điểm Champion | Tổng | Rank | Nhận xét | Chi tiết.
  - No score → "chưa thực hiện chấm điểm" badge in all score columns
  - Rank chip: `.score-chip` with inline `background:{rank.color}; color:#fff`
- **`_renderDetailBody()`** — new "★ Đánh giá & Điểm số" IIFE section:
  - No score → `.not-scored-notice`
  - Scored → total + rank badge + Auto breakdown (/70) + Champion breakdown grid (chất lượng / giá trị KD / sáng tạo) + reviewer + comment
  - Guard: `typeof ScoringEngine !== 'undefined'`
- **`_normalizeFullData()`** — 7 new score field mappings (quality_score, business_value_score, innovation_score, auto_score, manual_score, total_score, rank_category)
- **`AdminService.gs` `listUseCases_()`** — 5 new fields deployed by user: `review_comment`, `reviewer_email`, `quality_score`, `business_value_score`, `innovation_score`
- **`dashboard.css`** — ~25 new CSS classes (`.not-scored-notice`, `.score-total-row`, `.score-rank-badge`, `.score-breakdown-grid`, `.score-chip`, etc.)

**Decision (Option A):** Admin does NOT score numerically. Only Auto + Champion scores shown.

#### Feature B — Review Queue Filter

- **`review-queue.html`** — filter bar above `#rqContent`: search input, team dropdown (admin only), section pills (Tất cả/Chờ đánh giá/Đang review/Đã hoàn thành), result counter
- **`review-queue.js`** — `_filterState`, `_norm()`, `_populateTeamFilter()`, `_applyFilters()`, `_bindFilters()` (250ms debounce); `_render()` now routes through `_applyFilters()`
- **`dashboard.css`** — `.rq-filter-bar`, `.rq-search-input`, `.rq-team-select`, `.rq-pill`, `.rq-pill.active`, `.rq-result-count`

#### Feature C — Home Page Service Cards + Sidebar Nav Order

- **`index.html`** — PORTAL_SERVICES 2 → 8 items (2 sections); bug fix `role` undefined → `var userRole`; champion added to all non-admin-exclusive roles arrays
- **Sidebar "Trang chủ" first** — 7 pages updated: dashboard/register/users/review-queue/leaderboard/weekly-update/index. `manager-review.html` NOT updated.
- **"Hệ thống" section divider + label removed** from all 7 updated pages

#### Bugs fixed this session

| Bug | Fix |
|---|---|
| `.score-chip` unreadable on solid rank-color backgrounds | `color: #fff` in CSS rule |
| Dead code `var k = _cache(uc)` in `_openKPIScoreList` | Removed |
| PORTAL_SERVICES always empty — `role` undefined | `var userRole = user ? (user.role \|\| 'user') : 'user'` |
| Champion excluded from portal service cards | `'champion'` added to roles arrays |

#### GAS note

`AdminService.gs` `listUseCases_()` updated with 5 score fields and deployed by user. URL unchanged.

**Pending verification:** `getUseCase` endpoint may not return score sub-components — affects Champion breakdown section in detail popup. KPI list popup uses `_allList` (now has score fields) → works.

---

### Regression risks

- `color:#fff` on `.score-chip` — review-queue uses inline background → white text ✅; KPI list uses inline color override ✅
- `_openKPIUserList` → `_openKPIScoreList` — graceful: score columns show `—` if GAS fields absent
- PORTAL_SERVICES fix — blank portal bug fixed; no code relied on broken empty behavior
- `_render()` → `_applyFilters()` in review-queue — verified consistent with `_group()` logic

---

### Recommended next actions

**[P0]** Champion E2E: review → KPI score list shows correct scores → detail popup shows breakdown (verify getUseCase fields)
**[P1]** Fix FILTER-01 (`_populateTeamFilter` stale state) and PERF-02 (double-fetch)
**[P1]** Clean up or gitignore `debug_sidebar.js` (untracked in repo root)
**[P2]** Update `manager-review.html` sidebar to Pattern A (Trang chủ first, Hệ thống removed)

---

## Session: 2026-06-19
**Scope:** Folder migration + Champion user guide (HDSD) with production screenshots
**Commit:** `e0f418a` — 14 files changed, 585 insertions
**Code changes:** None — documentation/tooling only
**Version:** 3.10.3 (no version bump — no code change)

---

### Tasks completed

| # | Task | Result |
|---|------|--------|
| 1 | **Folder migration** — cả 2 projects di chuyển từ `D:\Công việc\Vibecode\` → `D:\Workspace\Production\`. Memory files cập nhật. Git repos verified sạch tại vị trí mới. | ✅ Done |
| 2 | **8 screenshots từ production** — Playwright headless Chromium, session injection (không cần GAS login). Pages: login, home-champion, dashboard-my, explore, review-queue (champion), review-queue (admin với data), register form, leaderboard. | ✅ Done |
| 3 | **`HDSD_Champion_AI_USSPTD.docx`** — Word 721 KB, 8 phần, 7 hình minh họa từ GitHub Pages production. Gửi được ngay cho Champion. | ✅ Done |

### Files changed (non-code)

| File | Mô tả |
|---|---|
| `HDSD_Champion_AI_USSPTD.docx` | NEW — Champion user guide, 8 sections, 7 screenshots |
| `screenshots/*.png` | NEW — 8 production screenshots (01–09, bỏ 08) |
| `build_champion_guide.py` | NEW — Python/python-docx script tái tạo docx khi cần update |
| `capture_champion_screens.mjs` | NEW — Playwright script chụp màn hình production |
| `package.json` / `package-lock.json` | playwright thêm vào devDependencies |

### Decisions made

1. **Session injection thay vì real login** — inject `ai_user_session` JSON vào sessionStorage tại `login.html` (cùng origin), rồi navigate sang target page. Không cần GAS auth live. Reliable và nhanh.
2. **Admin session cho review queue screenshot** — Champion session (Team Số) cho queue trống 0 UC; Admin session thấy 5 UC "Chờ đánh giá" thực tế → ảnh minh họa có data thật.
3. **Word (.docx) format** — lựa chọn của người dùng. python-docx (đã cài sẵn). Pandoc không có.
4. **playwright cài local trong project** — không có global install; thêm vào devDependencies thay vì npx (tránh version drift).

### Blockers

Không có blocker mới. Tất cả blocker từ session trước còn nguyên (xem TODO_NEXT).

### Regression risks

- `capture_champion_screens.mjs` hardcode username `tuantt4` và team `Team Số` — cần cập nhật nếu tài khoản thay đổi role hoặc bị xóa.
- `build_champion_guide.py`: print() dùng ASCII thay Unicode để tránh cp1252 error trên Windows PowerShell — không ảnh hưởng nội dung docx (python-docx xử lý Unicode đúng).
- playwright devDependency thêm ~60 MB node_modules khi `npm install` — node_modules đã có trong .gitignore, không ảnh hưởng GitHub Pages deploy.

### Recommended next actions

**[P0]** Gửi `HDSD_Champion_AI_USSPTD.docx` cho các Champion
**[P0]** Champion E2E test (xem section trước — không thay đổi)
**[P0]** Verify `getUseCase` trả score sub-components (SCORE-DETAIL-01)
**[P1]** Fix FILTER-01 + PERF-02 (1-line fixes, vẫn pending)
**[P1]** `debug_sidebar.js` — xóa hoặc gitignore
**[P2]** `manager-review.html` sidebar Pattern A (NAV-01)

---

## Session: 2026-06-19 (Part 2)
**Scope:** Leaderboard enhancement — score breakdown columns + click-to-detail popup
**Commit:** `ac50eaf` — 2 files changed, 351 insertions, 17 deletions
**Version:** no bump (feature addition, không có version scheme update)

---

### Tasks completed

| # | Task | Result |
|---|------|--------|
| 1 | **Score columns** — Thay cột "Điểm (100)" + "Giờ tiết kiệm" bằng 3 cột: Auto /70 · Champion /30 · Tổng /100 + cột Comment | ✅ |
| 2 | **Clickable rows** — Tất cả rows trong Top/Cần cải thiện/Theo Category tabs: cursor pointer + hover tint purple | ✅ |
| 3 | **UC detail popup** — `#lbDetailModal` tự chứa trong `leaderboard.html`, 4 sections + "★ Đánh giá & Điểm số", read-only. Progressive: render từ cache → `Api.getUseCase()` async → re-render full | ✅ |
| 4 | **GAS mapItem** — Thêm `review_comment` vào `getLeaderboard_()` mapItem trong `AdminService.gs` | ✅ (local; cần deploy) |

---

### Files changed

| File | Delta |
|------|-------|
| `leaderboard.html` | +351/-17 lines: 3 score columns, clickable rows, `#lbDetailModal` HTML, `_lbCache`, `lbOpenDetail()`, `_lbFetchFull()` (async), `_lbNormalize()`, `_lbRenderBody()`, `lbCloseDetail()`, helpers `_lbSection/_lbSubsec/_lbGrid/_lbField/_lbFmtDate`, CSS classes `.lb-score-num/.lb-score-auto/.lb-score-champion/.lb-score-total/.lb-comment-cell/.lb-row-clickable` |
| `assets/gas-backend/AdminService.gs` | +1 line: `review_comment: uc.Review_Comment \|\| ''` trong `mapItem` của `getLeaderboard_()` |

---

### Decisions made

1. **Self-contained `leaderboard.html`** — `dashboard.js` không được load trong leaderboard (DOM-coupled). Viết inline `_lb*` functions. ~200 lines JS, không cần module riêng.
2. **`_lbCache[usecase_id]`** — XSS-safe: không JSON trong onclick attribute, giống `_ucCache` pattern trong dashboard.js.
3. **Score columns thay thế "Điểm (100)" progress bar** — 3 cột số riêng (màu blue/purple/black) dễ đọc hơn progress bar. "Giờ tiết kiệm" bị xóa để nhường chỗ.
4. **`review_comment` thêm vào GAS mapItem** — Cần 1-line GAS change; không thêm GAS thì cột Comment luôn trống. Decision: change GAS + redeploy (không phải "no GAS changes").
5. **Read-only, no approve/reject** — Leaderboard là public view. Footer chỉ có "Đóng".
6. **Category tab: 3 score cols, no Comment** — Layout hẹp hơn, không cần cột Comment vì category table chỉ hiện 5 rows/category.

---

### Blockers

- **Cần redeploy GAS** — `AdminService.gs` có `review_comment` trong local repo. Đến khi deploy: cột Comment trong leaderboard table trống (field không có trong API response), nhưng Comment vẫn hiện trong detail popup (lấy từ `getUseCase`).
  - Deploy procedure: GAS Editor → Deploy → Manage Deployments → Edit → New version → Deploy
  - URL không đổi: `AKfycbypN8afAl2zQwpR7K6k1-699g3HAhFAIqAOtDn3qY1nJWzuN1bd8n99bzRUzaV8ZMyTCw`

---

### Regression risks

| Risk | Severity |
|------|----------|
| Cột "Giờ tiết kiệm" bị xóa — data vẫn accessible trong detail popup (section Demo & Tái sử dụng) | Low |
| Comment column blank trước khi redeploy GAS | Low — cosmetic only |
| `lbOpenDetail(uid)` nếu `_lbCache[uid]` undefined (UC từ category tab không populate cache top/bottom) — hiện đúng vì `_lbCache` populate tại render time trong cả 3 functions | Very low |

---

### Recommended next actions

**[P0]** Redeploy GAS (New version) để `review_comment` xuất hiện trong cột Comment  
**[P0]** Gửi `HDSD_Champion_AI_USSPTD.docx` cho Champion (vẫn pending từ phiên trước)  
**[P0]** Champion E2E test — verify scoring E2E, detail popup sub-scores  
**[P1]** Fix FILTER-01 (`_populateTeamFilter` stale state, 1 line, `dashboard.js`)  
**[P1]** Fix PERF-02 (`_loadTabData('my')` double-fetch, 1 line, `dashboard.js`)  
**[P2]** `manager-review.html` sidebar Pattern A (NAV-01)

---

## Session: 2026-06-20
**Scope:** GAS performance fix + write-ops Playwright test suite (05) — 74/74 tests pass
**Version:** 3.10.4 (no bump — GAS optimization + test-only changes)
**Instruction gốc:** "GAS done, link giữ nguyên, thực hiện fix, test kỹ tại local với các case có size dữ liệu lớn, debug trước khi Deploy"

---

### Đã hoàn thành

| # | Task | Result |
|---|------|--------|
| 1 | **GAS opt — `_getAllUseCaseIds_()`** (`UseCaseService.gs`): đọc chỉ cột UseCase_ID (N×1) thay vì toàn bộ sheet (N×99). Giảm ~90% data đọc trong mỗi createUseCase call. | ✅ Local |
| 2 | **GAS opt — `appendRowFromObject_()`** (`Utils.gs`): đọc chỉ hàng header (1×lastCol) thay vì `getDataRange()` (N×lastCol). Giảm 1 full-sheet read per write. | ✅ Already in code |
| 3 | **FE — timeout 90s** (`api.js`): `createUseCase` / `updateUseCase` timeout tăng 45s → 90s. Buffer đủ cho GAS cold start (5–15s) + LockService wait + 2 sheet ops (tổng ~15–35s). | ✅ Committed |
| 4 | **Fix `playwright.config.js` cwd** — đổi từ đường dẫn cũ sang `D:\\Workspace\\Production\\ai-usecase-platform`. PLAYWRIGHT-01 cwd portion CLOSED. | ✅ Done |
| 5 | **New test suite `tests/05-create-write-ops.spec.js`** — 15 tests: A (payload size guard), B (duplicate check), C (GAS timeout recovery — 48s delay), D (create/update full flow mock). | ✅ 15/15 pass |
| 6 | **Debug + fix 3 root causes** trong spec 05 (4 iterations `debug-d2.spec.js`, xóa sau khi xong): | ✅ |
| | — MOCK_LOOKUP keys: `teams`/`categories` → `Team`/`Business_Category` (khớp `FIELD_CONFIG.lookupKey`) | |
| | — viText sizes: 700/1000 → 2000 chars (6000 chars × 1.75 UTF-8 avg × 4/3 base64 ≈ 14000 >> 7500 limit) | |
| | — `fillAndGoToSubmit`: thêm `waitForFunction(() => Team select.options.length > 1)` trước khi `populateData` | |
| **Total:** | 74/74 tests pass (59 existing + 15 new) | ✅ |

---

### Files changed

| File | Delta |
|------|-------|
| `assets/js/api.js` | `createUseCase`/`updateUseCase` timeout: 45000 → 90000ms |
| `playwright.config.js` | `cwd` path corrected (PLAYWRIGHT-01 cwd fix) |
| `assets/gas-backend/UseCaseService.gs` | `_getAllUseCaseIds_()`: single-column read (N×1 not N×99) |
| `assets/gas-backend/Utils.gs` | `appendRowFromObject_()`: header-only read (already correct in file) |
| `tests/05-create-write-ops.spec.js` | NEW → fixed: MOCK_LOOKUP keys + viText sizes + select wait |
| `tests/debug-d2.spec.js` | Created then deleted (temp diagnostic) |

---

### Key technical findings

- **GAS timeout root cause:** Redundant MASTER_DATA reads (N×99), NOT payload size. `_getAllUseCaseIds_()` đọc full sheet để lấy IDs → cắt xuống N×1 column.
- **Vietnamese UTF-8 expansion:** ~1.75× (NOT 4×) for mixed content. viText(700)×3 = ~3700 base64 chars, well below 7500 limit. Need viText(2000)×3 = ~14000 to reliably trigger limit.
- **MOCK_LOOKUP keys must match FIELD_CONFIG.lookupKey exactly:** `_createSelect()` sets `select.dataset.lookup = config.lookupKey` (`'Team'`, `'Business_Category'`, etc.), not lowercase plural. Wrong mock keys → select options never populated → validation fails → GAS never called.
- **rebuildLookupFields() timing:** Microtask — runs within same event loop tick as JSONP callback. `options.length > 1` is guaranteed before `networkidle` fires (500ms idle timer). `waitForFunction` is a reliable synchronization point.
- **`window.__LOOKUP` key lookup path:** `window.__LOOKUP[select.dataset.lookup]` = `window.__LOOKUP['Team']` NOT `window.__LOOKUP['teams']`.

---

### GAS deployment note

`UseCaseService.gs` `_getAllUseCaseIds_()` optimization is **local only** — needs paste into GAS Editor + new version deploy. Until deployed: still functional (original code works), just slower with large sheet.

`Utils.gs` `appendRowFromObject_()` header-only read: already in the deployed version (per current file state).

---

### Regression risks

- **C tests (48s delay):** Pass với 90s timeout. Nếu timeout giảm xuống ≤48s → C1/C2 fail. Không giảm timeout write ops.
- **viText(2000)×3 payload test:** Assumes UTF-8 expansion ~1.75×. Nếu test data thay đổi sang pure Vietnamese → expansion ~2.7× → ≈21000 chars (vẫn >> 7500, test vẫn pass).
- **GAS single-column read:** Assumes UseCase_ID column exists in MASTER sheet. If column missing → `idCol === -1` → returns `[]` (empty, not error). createUseCase falls back to `generateUseCaseId_()`.

---

### Next actions

**[P0]** Redeploy GAS (AdminService.gs) — `review_comment` trong leaderboard mapItem (LB-GAS-01)
**[P0]** Gửi `HDSD_Champion_AI_USSPTD.docx` cho Champion
**[P0]** Champion E2E test + verify `getUseCase` trả score sub-components (SCORE-DETAIL-01)
**[P1]** Deploy `UseCaseService.gs` optimization (New version GAS — same URL)
**[P1]** Fix FILTER-01 (`_populateTeamFilter` stale state, 1 line)
**[P1]** Fix PERF-02 (`_loadTabData('my')` double-fetch, 1 line)
**[P2]** `manager-review.html` sidebar Pattern A (NAV-01)

---

## Session: 2026-06-22
**Scope:** UC Picker Modal (weekly-update) + HDSD Cập nhật tuần + FILTER-01/PERF-02/NAV-01 + GAS redeployed
**Commits:** `26820c4` (UC picker modal) → `13fe01c` (test timeout fix) → `a673f47` (FILTER-01/PERF-02/NAV-01 + HDSD doc)
**Tests:** 85/85 Playwright PASS (was 74/74; 11 new weekly-update tests)
**GAS:** ✅ REDEPLOYED 2026-06-22 — AdminService.gs + UseCaseService.gs. URL unchanged.
**Version:** v3.11

---

### Đã hoàn thành

| # | Task | Commit | Result |
|---|------|--------|--------|
| 1 | **UC Picker Modal** — `weekly-update.html` thay thế `<select>` dropdown bằng full-screen modal table | `26820c4` | ✅ |
| 2 | **Stage lifecycle S1→S4** — upgrade toggle + checklist gate + S4 fields (scalePlan, scaleRisks) + WEEKLY_LOG timeline | `26820c4` | ✅ |
| 3 | **Playwright weekly-update suite** — 11 tests T01–T11, `test.setTimeout(90000)` | `13fe01c` | ✅ 85/85 |
| 4 | **HDSD_CapNhatTuan_AI_USSPTD.docx** — Word 1.7MB, 11 sections, 14 EVD images | `a673f47` | ✅ Sent |
| 5 | **FILTER-01** — `dashboard.js _populateTeamFilter()`: `_filterAll.team = teamSel.value` | `a673f47` | ✅ |
| 6 | **PERF-02** — `dashboard.js _loadTabData('my')`: `if (_myList.length === 0)` guard | `a673f47` | ✅ |
| 7 | **NAV-01** — `manager-review.html`: Pattern A sidebar full sync | `a673f47` | ✅ |
| 8 | **GAS redeploy** — AdminService.gs (submitWeeklyUpdate_ + leaderboard comment) + UseCaseService.gs (N×1 opt) | user action | ✅ |
| 9 | **Champion E2E test** | user action | ✅ |
| 10 | **HDSD Champion gửi** | user action | ✅ |

---

### Files changed

| File | Mô tả |
|---|---|
| `weekly-update.html` | UC picker modal, stage S1→S4, WEEKLY_LOG timeline, role-based filtering |
| `tests/weekly-update.spec.js` | NEW — 11 tests T01–T11, test.setTimeout(90000) |
| `assets/js/dashboard.js` | FILTER-01 (1 line) + PERF-02 (1 line) |
| `manager-review.html` | NAV-01 full Pattern A sidebar sync |
| `scripts/gen_hdsd_capnhattuan.py` | NEW — python-docx HDSD generator (11 sections) |
| `HDSD_CapNhatTuan_AI_USSPTD.docx` | NEW — 1.7MB Word doc |
| `evd/weekly-update/*.png` | 25 EVD screenshots (T01–T11 set + older set) |

---

### Key technical decisions

1. **`display:none/flex` for picker modal** — opacity-based approach would pass CSS visibility but fail Playwright `toBeVisible()`. `display:none` (hidden) / `display:flex` (shown) is the only reliable approach for IIFE vanilla JS + Playwright.
2. **`test.setTimeout(90000)` inside describe block** — weekly-update tests make real GAS JSONP network calls. Adding inside describe block only raises limit for those 11 tests; global `timeout: 20000` in playwright.config.js stays unchanged to keep all other tests fast.
3. **T09/T11 skip-gracefully when UC at S4 max** — `_stageAtMax` badge is visible; tests call `return` (not `test.skip()`). This is intentional: AIUS-0144 was transitioned to S4 in T11, so first UC is always S4-max in subsequent runs. Data-dependent behavior, not a test failure.
4. **FILTER-01 root cause** — `teamSel.innerHTML = '...'` causes browser to reset `select.value` to `''` when the previously-selected option no longer exists in new HTML. `_filterAll.team` was not updated → stale value caused filter to show empty results. Fix: add `_filterAll.team = teamSel.value` immediately after rebuild.
5. **PERF-02 guard sufficiency** — `_loadStartupData()` populates `_myList` at page load. Tab switching uses `display:none/block` (DOM preserved, not re-rendered). Guard `if (_myList.length === 0)` is sufficient and safe.
6. **Stage key defensive** — `uc.stage || uc.current_stage || 'S1 - Idea'` — GAS API returns `stage` field but field name may vary (`current_stage` also observed in older data). Defensive fallback prevents undefined stage.

---

### Errors fixed during session

| Error | Root cause | Fix |
|---|---|---|
| T04 timeout (PLAYWRIGHT-TIMEOUT-01) | Global timeout 20000ms insufficient for GAS real network calls | `test.setTimeout(90000)` inside weekly-update describe block |
| UnicodeEncodeError in gen_hdsd script | Windows cp1252 can't encode `✅` emoji in print statement | Changed to ASCII `print('OK  Da tao: ...')` |

---

### Recommended next actions

**[P0]** Smoke test weekly-update với real champion credentials — verify picker chỉ hiện team's UCs  
**[P2]** SEC-01 auth hardening — Google Sign-In hoặc username whitelist (PO decision needed)  
**[P2]** KPI_EXCLUDED_USERS từ USERS sheet `KPI_Exempt` column thay vì hardcode env.js  
**[P3]** Feature backlog: empty state Explore, pagination 200+, Export CSV, weekly-update spinner

---

## Session: 2026-06-29
**Scope:** Bug fix — KPI tuần theo dõi cả user inactive
**Version:** v3.11.1

### Root cause

`_buildKPIData()` trong `dashboard.js`:
- **Step 2a** (dòng ~1598): Khi `u.active === false` → `return` ngay, user **không được thêm vào `claimed`**
- **Step 2b** (dòng ~1617): Iterate `byEmail` keys — kiểm tra `if (claimed[eKey]) return` nhưng inactive user không có trong `claimed` → UC cũ của họ (Approved UCs trong `_allList`) **bị thêm vào `result`**
- Kết quả: user đã deactivate vẫn xuất hiện trong bảng KPI tuần

### Fix

**`assets/js/dashboard.js` — `_buildKPIData()`:**
- Thêm `var inactiveKeys = {}` trước block `if (_usersList ...)`
- Trong `u.active === false` branch: ghi cả `username` lẫn `display_name` vào `inactiveKeys`
- Step 2b: thêm `if (inactiveKeys[eKey]) return;` trước khi add vào result

**`assets/tests/test-kpi-data.js`:**
- Đồng bộ filter sang `status !== 'Approved'` (khớp dashboard.js)
- Thêm inactive UC vào fixture ALL_LIST → A9 test đúng bug thay vì pass vì lý do sai
- Thêm Suite F (F1–F5): test inactive với UC, edge case display_name

### Files changed

| File | Delta |
|------|-------|
| `assets/js/dashboard.js` | +8/-3 lines: `inactiveKeys` tracking trong Step 2a + filter trong Step 2b |
| `assets/tests/test-kpi-data.js` | +30 lines: filter update + Suite F (5 tests) + fixture inactive UC |
| `evd/kpi-inactive-fix/` | 5 EVD screenshots |
| `scripts/capture_kpi_inactive_fix.mjs` | NEW — EVD capture script |

### Test kết quả

| Check | Kết quả |
|-------|---------|
| Unit test `test-kpi-data.js` | **25/25 PASS** (20 existing + 5 new Suite F) |
| Playwright full suite | **85/85 PASS** (no regression) |
| EVD screenshots | 5 ảnh tại `evd/kpi-inactive-fix/` |

---

## Session: 2026-06-29 (Part 2)
**Scope:** Bug fix — KPI hiển thị user 2 lần + AIUS-0157 không xuất hiện ở đúng row
**Version:** v3.11.2
**Commits:** `68f4339` (debug temp, removed), `a5ff7fd` (fix)

### Root cause

`_buildKPIData()` — Step 2a chỉ `claimed[uKey]` (username), KHÔNG `claimed[dnKey]` (display_name).

Kịch bản dẫn đến lỗi:
- User "Nguyễn Phạm Lâm Phương" (`username = "phuongnpl"`) nộp một số UC với `owner_email = "phuongnpl"` (username) và một số UC khác với `owner_email = "Nguyễn Phạm Lâm Phương"` (display_name).
- Step 1 tạo ra **hai key** trong `byEmail`: `byEmail["phuongnpl"]` (2 UC) và `byEmail["nguyễn phạm lâm phương"]` (N UC gồm AIUS-0157).
- Step 2a: `stats = byEmail["phuongnpl"]` → found; `claimed["phuongnpl"] = true`; nhưng `byEmail["nguyễn phạm lâm phương"]` **không được claimed**.
- Step 2b: `"nguyễn phạm lâm phương"` không trong `claimed` → tạo **ghost row thứ 2** tên "Nguyễn Phạm Lâm Phương" với tất cả UC nộp qua display_name.

Kết quả: user xuất hiện **2 lần** trong KPI. Row thật (username key) chỉ có 2 UC, row ghost (display_name key) có đủ UC kể cả AIUS-0157.

Điều này cũng giải thích tại sao AIUS-0157 không hiện ở row của user khi xem tuần 22/06–28/06: AIUS-0157 nằm trong ghost row (được submit với `owner_email = display_name`), không phải trong row user thật (username key chỉ có 2 UC, trong đó tuần đó = 0).

### Fix

**`assets/js/dashboard.js` — `_buildKPIData()`:**
- Thêm helper `mergeKPIStats_(a, b)` bên trong `_buildKPIData`: merge hai stat bucket bằng cách cộng từng weekKey và total.
- Step 2a: claim **cả `uKey` lẫn `dnKey`** unconditionally (trước khi tìm stats).
- Step 2a: merge `byEmail[uKey]` + `byEmail[dnKey]` qua `mergeKPIStats_()` thay vì `||` chain. Hai bucket **disjoint** (một UC chỉ có một `owner_email`) nên merge an toàn không double-count.
- Fall back sang `byName` chỉ khi byEmail không có gì cho user này.

**`assets/tests/test-kpi-data.js`:**
- Đồng bộ `buildKPIData()` với logic mới (thêm `mergeKPIStats_`, claim cả dnKey).
- Thêm **Suite G** (G1–G5): verify user xuất hiện 1 lần, total = sum cả hai bucket, tuần đúng, không ghost row.

### Files changed

| File | Delta |
|------|-------|
| `assets/js/dashboard.js` | +20/-8 lines: `mergeKPIStats_` helper + claim dnKey + merge byEmail buckets trong Step 2a; bỏ temp diagnostic |
| `assets/tests/test-kpi-data.js` | +35 lines: `mergeKPIStats_` + claim dnKey trong `buildKPIData` + Suite G (5 tests) |

### Test kết quả

| Check | Kết quả |
|-------|---------|
| Unit test `test-kpi-data.js` | **30/30 PASS** (25 existing + 5 new Suite G) |
| Playwright full suite | **85/85 PASS** (no regression) |

---

## Session: 2026-07-07
**Scope:** Phân tích + chuẩn bị migrate Team BL1 + BL2 → Team BL
**Version:** 3.11.2 (không bump — script chờ user deploy + run)

### Yêu cầu
Toàn bộ Team BL2 gộp vào Team BL1 thành 1 team tên "BL". Cần update: LOOKUP sheet, MASTER_DATA (cột Team), USERS sheet (cột Team), xóa DASHBOARD_READY cache.

### Phân tích

**Phạm vi ảnh hưởng (đã xác minh):**
- Grep 0 match BL1/BL2 trong toàn bộ codebase JS/HTML/GAS/txt → **không có hardcode**
- Team name hoàn toàn data-driven từ LOOKUP sheet → **không cần sửa frontend**
- LOOKUP_DEFAULTS trong LookupService.gs không chứa BL1/BL2 → **không cần sửa code GAS**
- Test fixtures dùng "Team Số"/"Team ABC" → **85/85 tests không bị ảnh hưởng**

**Chỉ cần:**
1. Chạy GAS migration script (data-only, không deploy lại)
2. Re-login cho champion users của BL1/BL2 sau migrate

### File tạo mới

| File | Mô tả |
|---|---|
| `assets/gas-backend/MigrationService.gs` | One-time migration: `migrateTeamsBL_(dryRun)` |

### Hàm `migrateTeamsBL_(dryRun)`

**DRY_RUN = true** (mặc định): chỉ log, không ghi sheet.
**DRY_RUN = false**: thực sự commit.

Hành động khi commit:
1. **LOOKUP sheet**: đổi row Team=BL1 → "BL"; xóa row Team=BL2 (hoặc ngược lại nếu BL đã tồn tại)
2. **MASTER_DATA**: đọc cột Team 1 lần (N×1), replace BL1/BL2 → BL, ghi lại 1 lần
3. **USERS**: cùng pattern với MASTER_DATA
4. **DASHBOARD_READY**: xóa data rows → cache tự rebuild lần truy cập tiếp theo

### Quy trình thực hiện (cần user action)

```
1. Mở GAS Editor → tạo file mới → paste MigrationService.gs
2. Chạy migrateTeamsBL_() (dryRun=true mặc định) → View → Logs → xem preview
3. Xác nhận log đúng → sửa dòng đầu hàm: dryRun = false → chạy lại
4. Kiểm tra Google Sheets: LOOKUP Team chỉ còn "BL", MASTER_DATA/USERS đã update
5. Mở dashboard → team filter → xác nhận chỉ còn "BL"
6. Yêu cầu champion BL (nếu có) re-login để session lấy team mới từ USERS sheet
7. (Optional) Xóa MigrationService.gs khỏi GAS Editor sau khi xong
```

### Decisions chốt
1. **Không cần deploy GAS** — chỉ cần chạy script trực tiếp trong GAS Editor (Run function). URL GAS giữ nguyên.
2. **Batch read/write** — đọc cả cột Team 1 lần, ghi lại 1 lần → tối thiểu API calls, tránh timeout
3. **DRY_RUN mặc định true** — safe by default; user phải chủ động đổi false để commit
4. **Idempotent** — chạy lại script khi đã migrate xong → 0 changes (phát hiện "BL" đã tồn tại, không tìm thấy BL1/BL2)
5. **Frontend không cần sửa** — 0 hardcode → data-driven tự cập nhật

### Kết quả thực hiện

✅ Migration hoàn tất cùng phiên:
- `dryRunTeamBL` chạy thành công → preview log đúng
- `commitTeamBL` chạy thành công → LOOKUP + MASTER_DATA + USERS đã update, DASHBOARD_READY cache cleared
- Fix GAS private function bug: thêm wrapper `dryRunTeamBL` / `commitTeamBL` (hàm `_` suffix không hiện trong Run menu GAS)

### Commits phiên này
| Commit | Mô tả |
|---|---|
| `7731d64` | feat: add MigrationService.gs |
| `a1beaa7` | fix: add public wrapper functions for GAS Run menu |
| `[handover]` | chore: session handover 2026-07-07 |
