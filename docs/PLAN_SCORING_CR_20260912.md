# PLAN — CR Chấm điểm cá nhân (member tự chấm) + Tách "Chấm điểm lan tỏa AI"

- **Ngày:** 2026-09-12
- **Repo:** `ai-usecase-platform` (spoke) · Hub KPI: `binh-dan-hoa-ai-H2`
- **Trạng thái:** ✅ ĐÃ CHỐT KHUNG (xem "QUYẾT ĐỊNH" bên dưới) — sẵn sàng code.

## ✅ QUYẾT ĐỊNH ĐÃ CHỐT (anh Tuân, 2026-09-12)
1. **Cơ chế review = DUYỆT (approve/reject).** Member tự đề xuất điểm + bằng chứng; teamlead xác nhận hoặc từ chối (reject **bắt buộc lý do**). Điểm CHỈ tính KPI **sau Approved**. Điểm đề xuất chưa duyệt **không lên leaderboard** (default).
2. **KPI2 (năng lực AI, 30%):** member **tự chấm 0–10** từng tiêu chí (bộ tiêu chí năng lực AI hiện có) + link bằng chứng → teamlead duyệt.
3. **KPI3 (khóa học, 15%):** GIỮ công thức hiện tại (**4 khóa = 100%, khóa trả phí ×2**). Member khai **số khóa thường + số khóa trả phí** + link bằng chứng.
4. **KPI4 (lan tỏa, 15%):** **BỔ SUNG SONG SONG** — giữ nguyên cơ chế auto (`UC_REUSE` ≥3 người tái dùng) VÀ thêm luồng member **tự khai lan tỏa + bằng chứng → teamlead duyệt**; **đạt nếu 1 trong 2** đường thỏa. Tách thành mục chấm riêng trong form.
5. **Bằng chứng:** **tách 3 ô link** riêng cho KPI2 / KPI3 / KPI4.
6. **Kỳ:** 1 lần/**tháng dương lịch** (MM/YYYY). Chưa duyệt → member **sửa lại thoải mái**; **sau Approved → khóa cứng** (đổi phải teamlead mở lại / reject).
7. **Reject:** bắt buộc lý do; member **làm lại trong cùng tháng**.
8. **Giữ màn teamlead chấm trực tiếp SONG SONG** (fallback) cùng với luồng member-nộp → teamlead-duyệt.
9. **Phạm vi:** bật cho **toàn bộ member** ngay (không pilot).
10. Bằng chứng lan tỏa = **link** (buổi đào tạo / biên bản / screenshot / DS người áp dụng); teamlead tự đánh giá "đạt" khi duyệt (không ép ngưỡng cứng). Route `self-assessment` cũ (H1) **để nguyên, deprecated** (không đụng).

> Các mục thiết kế §(c) dưới đây đọc theo khung đã chốt này. §(d) là câu hỏi gốc (đã trả lời ở trên).

- **Trạng thái gốc:** PLAN — chưa code, chờ anh Tuân chốt các câu hỏi ở §(d).
- **Phạm vi CR (nguyên văn, còn mơ hồ):**
  1. Bổ sung **"Chấm điểm cá nhân"**: cá nhân **TỰ CHẤM, 1 lần/tháng**; member chấm → **đẩy lên teamlead review**. Nội dung: **số khóa học + link bằng chứng** cho **KPI2** và **KPI3+4**.
  2. Tách riêng **"Chấm điểm lan tỏa AI"**: member tự chấm + cung cấp bằng chứng → chuyển teamlead review (tách khỏi phần chấm hiện tại).

---

## (a) ĐÁNH GIÁ HIỆN TRẠNG

### Mô hình KPI H2 (nguồn: `binh-dan-hoa-ai-H2/config/kpi_roles.yaml`, đã LĐTT duyệt 2026-08-21)
Member KPI = **M1·0.40 + M2·0.30 + M3·0.15 + M4·0.15 − điểm trừ milestone** (clamp 0..100):

| Mã | Tên | Trọng số | Ai chấm (hiện tại) |
|----|-----|----------|---------------------|
| M-KPI-1 | Điểm Use case cá nhân (3 tiêu chí 30/40/30) | 0.40 | **Hội đồng teamlead** chấm từng UC, lấy bình quân |
| M-KPI-2 | Năng lực ứng dụng AI cá nhân (4 tiêu chí 30/20/30/20) | 0.30 | **Teamlead** chấm theo tháng; cuối kỳ = TB tháng |
| M-KPI-3 | Số khóa học AI hoàn thành (≥4 khóa=100%, mỗi khóa 25%, trả phí x2) | 0.15 | **Teamlead** nhập số khóa trong panel personal-score |
| M-KPI-4 | Chia sẻ & lan tỏa AI (đạt→100 / không→0) | 0.15 | **Teamlead** tick `Sharing_Achieved` HOẶC auto qua `UC_REUSE` (≥3 người tái dùng) |

> **Điểm mấu chốt từ hub — YAML M-KPI-2 ghi rõ:** *"Hàng tuần ≥1 công việc thực tế dùng AI + bằng chứng; Teamlead **duyệt** theo tháng (**AI Worklog**)"* và M-KPI-3 *"minh_chứng: Chứng chỉ khóa học AI, ghi nhận trên Dashboard"*. Tức mô hình gốc VỐN đã thiết kế luồng **member nộp bằng chứng → teamlead duyệt**, nhưng **hiện chưa xây** — hệ thống đang để teamlead nhập tất cả. CR này chính là hiện thực hóa phần member-side còn thiếu.

### Kiến trúc chấm điểm đang chạy (code thực tế)

**Backend (`assets/gas-backend/`):**
- `Config.gs` — hằng số H2: `H2_KPI_WEIGHTS` (40/30/15/15), `H2_PERSONAL_WEIGHTS` (30/20/30/20), `H2_UC_WEIGHTS` (30/40/30), `H2_COURSE_TARGET=4` / `H2_COURSE_PCT_EACH=25`, `H2_REUSE_THRESHOLD=3`, `H2_TEAMLEAD_WEIGHTS` (60/40), `H2_KPI_PASS=70`, `H2_MILESTONE_PENALTY_EACH=2`/`_MAX=10`.
- Sheets: `PERSONAL_SCORE`, `UC_COUNCIL_SCORE`, `UC_REUSE`.
- `PERSONAL_HEADERS` (sheet PERSONAL_SCORE) — **1 dòng / (member × Month)**:
  `Score_ID, Username, Display_Name, Team, Month, Diversity, AI_Proficiency, Product_Quality, Quantity_Met, Final_Score, Courses_Completed, Courses_Paid, Sharing_Achieved, Milestones_Late, Evidence_Link, Scored_By, Comment, Scored_At`.
  - M-KPI-2 (`Final_Score`) chấm **theo tháng**, cuối kỳ = TB các tháng.
  - M-KPI-3/4 + điểm trừ **KHÔNG theo tháng** → backend đọc từ **dòng tháng MỚI NHẤT** ("nhập 1 lần").
  - `Evidence_Link` **đã có cột** nhưng hiện **đọc-only** (comment code: "cập nhật ở ổ share", không nhập tại panel).
- `ScoringServiceH2.gs`:
  - `submitPersonalScore_(body)` — **auth: chỉ TEAMLEAD của đúng team member (`isChampionForTeam_`) hoặc admin**. Member KHÔNG được ghi.
  - `submitCouncilScore_` (điểm US, hội đồng), `submitReuseConfirm_` (xác nhận tái dùng — auth: người đăng nhập bất kỳ, không tự xác nhận UC mình), `getReuseCounts_`, `_reuseByOwner_`.
  - `_memberKpiFor_` / `getMemberKpiPreview_` — tính M1..M4 + trừ; M4 = 100 nếu `Sharing_Achieved` HOẶC reuse ≥3.
  - `getKpiLeaderboard_`, `getH2Leaderboard_`, `listPersonalScores_`.
- `AdminService.gs::submitSelfAssessment_` + route `self-assessment` — **VESTIGE H1**: ghi `Self_Assessment_Score` (0-100) lên MASTER_DATA, thuộc mô hình governance cũ (layer 20%). **KHÔNG liên quan** KPI H2 hiện hành → dễ gây nhầm khi nghe "self". Cần xác nhận có tái dùng/bỏ.

**Routes (`Code.gs`) + API builder (`config/routes.js`):**
`self-assessment` (H1 vestige) · `council-score-submit/list` · `council-progress` · `personal-score-submit/list` · `member-kpi-preview` · `h2-leaderboard` · `kpi-leaderboard` · `reuse-confirm` · `reuse-counts`.

**FE (`assets/js/`):**
- `personal-score.js` — màn **"Chấm điểm cá nhân"**, `roles: ['admin','champion','teamlead']` (**member KHÔNG vào được**). Teamlead chọn member → chọn tháng → kéo 4 slider (M2) + nhập số khóa (`psCourses`/`psCoursesPaid`) + tick lan tỏa (`psSharing`) + số milestone chậm (`psLate`). EVD chỉ hiển thị đọc. Panel còn preview M1 (US) + KPI tổng hợp dự kiến.
- `scoring-h2.js` (công thức mirror FE), `score-slider.js` (slider 0–10), `leaderboard.js`.

### Teamlead review — cơ chế hiện có
- **Không có** luồng "member nộp → teamlead duyệt (approve/reject)" cho điểm cá nhân. Teamlead **trực tiếp nhập & ghi đè** (upsert theo Username×Month).
- Cơ chế duyệt DUY NHẤT đang tồn tại là **milestone-approve/reject** (WEEKLY_LOG, `Approval_Status`) — cho cập nhật tuần của UC, không phải cho điểm cá nhân/khóa học/lan tỏa.

---

## (b) GAP — CR yêu cầu gì mà hiện chưa có

1. **Member tự chấm (self-score) — CHƯA CÓ.** Toàn bộ điểm cá nhân hiện do teamlead nhập; không có màn/role/route cho member tự nộp. `self-assessment` hiện hữu là của mô hình H1 khác, không dùng lại được về nghĩa.
2. **Luồng "member nộp → teamlead review (approve/reject)" — CHƯA CÓ.** Sheet PERSONAL_SCORE không có cột trạng thái duyệt (Submit/Approved/Rejected), người nộp (Submitted_By), thời điểm duyệt... Hiện chỉ có `Scored_By` (teamlead) + `Scored_At`.
3. **Ràng buộc "1 lần/tháng" ở phía member — CHƯA CÓ.** Backend đã khóa theo `(Username, Month)` (upsert) nên cấu trúc dữ liệu sẵn sàng, nhưng chưa có quy tắc "member chỉ được nộp/sửa 1 lần/tháng" hay khóa sau khi teamlead duyệt.
4. **Nhập số khóa học + link bằng chứng bởi MEMBER cho KPI2 & KPI3+4 — CHƯA CÓ.** `Evidence_Link` là đọc-only; `Courses_*`, `Sharing_*` do teamlead nhập. CR muốn member là người nhập số khóa + link.
5. **Tách "Chấm điểm lan tỏa AI" thành luồng riêng — CHƯA CÓ.** Lan tỏa (M-KPI-4) hiện nằm chung panel teamlead (`psSharing`) + auto qua UC_REUSE. CR muốn màn riêng: member tự khai + bằng chứng → teamlead review, tách khỏi phần chấm hiện tại.
6. **Bằng chứng theo từng nhóm KPI — CHƯA RÕ CẤU TRÚC.** Hiện chỉ 1 cột `Evidence_Link` gộp. CR nói "link bằng chứng cho KPI2 và KPI3+4" → có thể cần tách link theo nhóm (M2 / M3 / M4).

---

## (c) THIẾT KẾ ĐỀ XUẤT (mức plan — chưa code)

> Nguyên tắc data-boundary (ràng buộc dự án): **chỉ lưu LINK bằng chứng** (ổ share/Drive), **không upload file**. Giữ đúng như `Evidence_Link` hiện tại và như "Bài tập AI" (`Demo_Link`).

### C1. Mô hình dữ liệu — 2 phương án

**Phương án A (KHUYẾN NGHỊ) — tái dùng `PERSONAL_SCORE`, bổ sung cột trạng thái duyệt + cột member-input.**
- Thêm vào `PERSONAL_HEADERS` (append cuối để `ensureSheetColumns_` self-heal không lệch cột cũ):
  - `Self_Status` — `Draft` / `Submitted` / `Approved` / `Rejected` (luồng member→teamlead).
  - `Submitted_By`, `Submitted_At` — member nộp.
  - `Reviewed_By`, `Reviewed_At`, `Review_Comment` — teamlead duyệt.
  - `Self_*` (nếu muốn giữ song song điểm member tự đề xuất vs teamlead chốt): `Self_Diversity, Self_AI_Proficiency, Self_Product_Quality, Self_Quantity_Met` — HOẶC dùng chung 4 cột hiện có và teamlead sửa đè khi duyệt (đơn giản hơn).
  - `Evidence_M2`, `Evidence_M3`, `Evidence_M4` — tách link bằng chứng theo nhóm (nếu chốt cần tách; nếu không, giữ 1 `Evidence_Link`).
- **Ưu:** ít sheet, tái dùng toàn bộ engine tính KPI (`_aggPersonalRows_`, `_memberKpiFor_`). **Nhược:** 1 dòng đang gánh cả M2(tháng) + M3/M4(mới nhất) + trạng thái duyệt → ngữ nghĩa hơi nặng; cần quy tắc rõ "điểm nào áp khi Approved".

**Phương án B — tách sheet mới `PERSONAL_SELF_SUBMISSION` (staging) + giữ `PERSONAL_SCORE` là bản chốt.**
- Member ghi vào sheet staging (self-score + số khóa + link theo tháng, có `Status`). Khi teamlead **Approve** → backend "chốt" sang `PERSONAL_SCORE` (giữ nguyên engine KPI đọc PERSONAL_SCORE như cũ).
- **Ưu:** tách bạch "đề xuất của member" vs "điểm chính thức"; engine KPI không đổi. **Nhược:** thêm sheet + logic đồng bộ 2 bảng; phức tạp hơn.

### C2. Lan tỏa AI (M-KPI-4) — luồng riêng
- Thêm sheet **`SHARING_CLAIM`** (member tự khai lan tỏa): `Claim_ID, Username, Display_Name, Team, Month?, Claim_Type (đào tạo|chia sẻ|use case tái dùng), Description, Evidence_Link, Status (Submitted/Approved/Rejected), Reviewed_By, Reviewed_At, Review_Comment, Submitted_At`.
- M-KPI-4 khi tính = 100 nếu có **≥1 SHARING_CLAIM đã Approved** HOẶC (giữ) auto qua `UC_REUSE` ≥3 người. → cần chốt: claim member có **thay** hay **bổ sung** cơ chế `Sharing_Achieved`/`UC_REUSE` hiện có (xem Q ở §d).
- **Tách khỏi panel teamlead:** panel personal-score bỏ tick `psSharing` (hoặc để đọc-only), thay bằng màn "Lan tỏa AI" riêng.

### C3. Routes GAS mới (dự kiến)
- `self-score-submit` (member nộp điểm cá nhân + số khóa + link, auth: chính chủ, khóa theo tháng).
- `self-score-list` / `self-score-mine` (member xem của mình; teamlead xem hàng đợi chờ duyệt team mình).
- `self-score-review` (teamlead approve/reject; nếu Approve → áp/chốt điểm).
- `sharing-claim-submit` / `sharing-claim-list` / `sharing-claim-review`.
- Bổ sung API builder tương ứng trong `config/routes.js`.

### C4. FE — màn hình mới
- **Màn "Điểm cá nhân của tôi" (role: user/member)** — member chọn tháng, tự kéo 4 slider M2, nhập số khóa (thường/trả phí) + link bằng chứng M2/M3, nút "Nộp cho teamlead". Hiển thị trạng thái (Draft/Submitted/Approved/Rejected + comment teamlead). Khóa sửa sau khi Approved (hoặc cho sửa tạo lại Submitted — xem Q).
- **Màn "Lan tỏa AI của tôi" (role: user/member)** — member khai buổi chia sẻ/đào tạo/tái dùng + link → nộp.
- **Nâng cấp panel teamlead `personal-score.js`** — thêm tab/khối "Chờ duyệt": xem điểm & bằng chứng member nộp → **Approve/Reject** (và tùy chốt: được **sửa đè** điểm hay chỉ duyệt). Màn review lan tỏa tương tự.

### C5. Cơ chế "1 lần/tháng"
- Khóa theo `(Username, Month)` như hiện tại (upsert). Quy tắc đề xuất: member được **sửa thoải mái khi còn Draft/Submitted**; sau khi teamlead **Approved** thì **khóa** (muốn sửa phải teamlead mở lại / reject). Cần chốt hành vi (Q7, Q8).

---

## (d) DANH SÁCH CÂU HỎI LÀM RÕ CHO ANH TUÂN (QUAN TRỌNG NHẤT)

**Nhóm 1 — Ánh xạ KPI (để không hiểu sai "KPI2/KPI3/KPI4"):**
1. Xác nhận ánh xạ: **KPI2 = M-KPI-2** (năng lực ứng dụng AI, 4 tiêu chí 30/20/30/20), **KPI3 = M-KPI-3** (số khóa học), **KPI4 = M-KPI-4** (lan tỏa) đúng theo `kpi_roles.yaml` chứ? (KPI1 = điểm US do hội đồng chấm, không nằm trong CR.)
2. "**Số khóa học**" trong CR map vào **M-KPI-3** (4 khóa=100%, mỗi khóa 25%, trả phí x2) — giữ nguyên công thức này chứ? Member khai luôn **số khóa trả phí** để hệ số x2?
3. CR nói bằng chứng "cho **KPI2 và KPI3+4**". Vậy cần **mấy ô link** riêng: 1 link chung, hay tách **Evidence_M2 / Evidence_M3 / Evidence_M4** (3 ô)? Hay gộp M3+M4 thành 1?

**Nhóm 2 — Bản chất "teamlead review":**
4. Teamlead review là **DUYỆT (approve/reject)** đề xuất của member, hay **CHẤM ĐÈ** (teamlead nhập điểm chính thức, member chỉ cung cấp dữ liệu/bằng chứng)? Hay **cả hai** (member đề xuất điểm → teamlead có thể sửa rồi duyệt)?
5. Với **M-KPI-2** (4 tiêu chí năng lực): member **tự cho điểm 0–10 từng tiêu chí**, hay chỉ **nộp bằng chứng công việc** còn điểm do teamlead chấm? (YAML gốc nói teamlead "duyệt" AI Worklog → nghiêng phương án member nộp bằng chứng, teamlead chấm.)
6. Nếu teamlead reject: member **làm lại trong tháng** hay bị **mất kỳ đó**? Có cần ô "lý do từ chối" bắt buộc không?

**Nhóm 3 — Quy tắc "1 lần/tháng":**
7. "1 lần/tháng" tính theo **tháng dương lịch** (Tháng MM/YYYY như hiện tại) chứ? Hay theo kỳ khác (tuần/quý)?
8. Trong tháng, sau khi **nộp** mà chưa duyệt, member còn **sửa lại** được không? Sau khi teamlead **Approved** có **khóa cứng** không (muốn sửa phải teamlead mở lại)?
9. Có **hạn nộp** trong tháng không (VD nộp trước ngày 5 tháng sau)? Quá hạn có chặn server-side hay chỉ cảnh báo? (Hiện `H2_PERSONAL_DEADLINE` chỉ là thông tin, không hard-block.)

**Nhóm 4 — Tách "Lan tỏa AI":**
10. CR muốn **thay** hay **bổ sung**? Hiện M-KPI-4 đạt 100 khi: (i) teamlead tick `Sharing_Achieved`, HOẶC (ii) auto — UC của member được **≥3 người** xác nhận tái dùng (`UC_REUSE`/`reuse-confirm`). Sau CR: giữ nhánh (ii) tự động không, hay mọi thứ chuyển sang member-khai + teamlead duyệt?
11. **Bằng chứng lan tỏa** là gì để coi là "đạt": link buổi đào tạo/biên bản/ảnh chụp, hay số người tham gia/áp dụng? Có cần đủ ngưỡng (VD ≥1 buổi, hoặc ≥3 người áp dụng) không?
12. Lan tỏa tính **1 lần/kỳ H2** (đạt/không) hay cũng **theo tháng** như điểm năng lực? (M-KPI-4 hiện là nhị phân đạt/không cho cả kỳ.)

**Nhóm 5 — Phạm vi & tương thích:**
13. Đối tượng áp dụng: **tất cả member** (role=user) toàn TT, hay chỉ một số team pilot trước?
14. Route `self-assessment` cũ (mô hình H1, ghi `Self_Assessment_Score` lên MASTER) — **bỏ hẳn**, hay để nguyên (không dùng)? Tên "self" dễ nhầm với màn tự chấm mới.
15. Ưu tiên **Phương án A** (thêm cột vào PERSONAL_SCORE) hay **Phương án B** (sheet staging riêng)? (Ảnh hưởng độ phức tạp & rủi ро lệch cột.)
16. Sau khi member tự chấm/nộp, teamlead vẫn giữ **quyền chấm trực tiếp** (panel hiện tại) như một đường song song, hay **thay thế hoàn toàn** bằng luồng member-nộp?
17. Điểm member tự đề xuất có **hiển thị công khai** (leaderboard) trước khi teamlead duyệt không, hay chỉ tính vào KPI/leaderboard **sau khi Approved**?

---

## Phụ lục — File nguồn liên quan (để tham chiếu khi triển khai)
- `assets/gas-backend/Config.gs` — `PERSONAL_HEADERS`, `UC_REUSE_HEADERS`, `H2_*` constants, `SHEETS`.
- `assets/gas-backend/ScoringServiceH2.gs` — `submitPersonalScore_`, `listPersonalScores_`, `submitReuseConfirm_`, `getReuseCounts_`, `_memberKpiFor_`, `getMemberKpiPreview_`, `getKpiLeaderboard_`.
- `assets/gas-backend/AdminService.gs` — `submitSelfAssessment_` (H1 vestige), `isChampionForTeam_` (auth teamlead theo team + backup chéo).
- `assets/gas-backend/Code.gs` — routes (dòng ~252–389).
- `assets/js/personal-score.js` — màn teamlead chấm điểm cá nhân (role admin/champion/teamlead).
- `assets/js/scoring-h2.js`, `score-slider.js`, `leaderboard.js`; `config/routes.js` — API builder.
- Hub: `binh-dan-hoa-ai-H2/config/kpi_roles.yaml` (định nghĩa M-KPI-1..4 + điểm trừ), `DECISIONS.md` (D02 mô hình KPI; D18/D19/D25 nhắc "AI Worklog" & "M05 lan tỏa: chưa tạo cấp member — chốt sau").
