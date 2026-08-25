# KẾ HOẠCH TRIỂN KHAI H2 — AI USE CASE PLATFORM

**Ngày lập:** 2026-08-17
**Người lập:** AI pair (theo yêu cầu TuanTT4)
**Trạng thái:** ✅ APPROVED — mọi quyết định đã chốt (§0 + §6). Bắt đầu Giai đoạn 1 (auth).
**Phạm vi:** 3 hạng mục lớn của H2 — (1) Nhập liệu theo Workflow, (2) Dùng chung user/mật khẩu với SHTD-Dashboard, (3) Đổi mô hình chấm điểm.

---

## 0. Quyết định đã chốt (2026-08-17)

| # | Quyết định | Chọn |
|---|---|---|
| Q1 | Cơ chế auth chung | **Dùng chung 1 sheet `User_Master`** của SHTD (spreadsheet `1cpg1p…`), token HMAC-SHA256, `AUTH_SECRET` chia sẻ |
| Q2 | Hội đồng chấm điểm US | **Cả 4**: TuanTT4, MaiTTT7, TuTV3, QuynhNNY → điểm cuối = bình quân người đã chấm |
| Q3 | Lọc droplist Workflow | **Theo Team/chức năng user** — ai cũng thấy "Workflow chung" + workflow của Nhóm mình (cần bảng map Team→Nhóm) |
| Q4 | Phạm vi hệ điểm mới | **Thay thế hoàn toàn** auto-score (70đ) + SPTD 80-10-10 |

---

## 1. Hiện trạng kỹ thuật (đã xác minh trong code)

### 1.1 Nhập liệu
- `register.html` = wizard 4 bước; dựng field từ `assets/js/constants.js` (`STEPS`, `FIELD_CONFIG`) qua `FieldBuilder` (`wizard.js`).
- `UseCase_Name` hiện là **text tự do** (Step 1, group `identity`).
- `Team`, `Business_Category` = `select` lookup từ sheet `LOOKUP` (`lookupKey`).
- Chưa có khái niệm Workflow ở bất kỳ đâu.

### 1.2 Auth
- Login **chỉ username, không mật khẩu** — `login.html` chỉ có ô `#loginEmail`.
- `assets/js/auth.js` (IIFE `AuthService`): login đồng bộ, resolve role từ `APP_CONFIG.ADMIN_EMAILS`/`CHAMPION_USERS`, lưu plain object vào `sessionStorage['ai_user_session']`. Không token.
- GAS AI US: sheet `USERS` (spreadsheet **`1xLMQLTgj2sRf1l9C6s6AHCT5zWJLQOofL375t8Pv_NA`**), `UserService.gs` — headers: `Username | Display_Name | Role | Team | Email | Active | Created_At | Last_Login`. Role: `admin | champion | user`.

### 1.3 Scoring
- `ScoringEngine.gs` (GAS) + `assets/js/scoring.js` (mirror FE): **70đ auto** (Efficiency 20 + Adoption 20 + Reuse 20 + Frequency 15 + Documentation 5) + **30đ manual** (Quality/Business_Value/Innovation, do champion chấm qua `submitChampionReview_`).
- `assets/js/sptd-scoring.js`: điểm cá nhân **SPTD 80-10-10** (80% avg quality UC Approved + 10% số lượng + 10% tuần đạt).
- Hiển thị: tab KPI, tab Điểm SPTD (`dashboard.js`), `leaderboard.html`, `review-queue.html`.
- MASTER_DATA (`Config.gs` `HEADERS`) đã có sẵn nhiều cột scoring cũ (`Auto_Score`, `Manual_Score`, `Total_Score`, `Rank_Category`, `Committee_Review_Score`, `Self_Assessment_Score`…).

### 1.4 SHTD-Dashboard (nguồn auth dùng chung)
- `backend/AuthService.gs`: `authLogin(username,password)` → verify **SHA-256** hash trong sheet `User_Master`, trả `{token, user}`. Token = `base64url(payload).HMAC-SHA256-hex(payload, AUTH_SECRET)`, payload `{u,dn,r,t,exp}`, hết hạn 24h. `AUTH_SECRET` trong Script Properties.
- Sheet `User_Master` (spreadsheet **`1cpg1p_8TGGbvZNNWZmjsKANqHW1tQijbiQBFLYn56Hk`**): `Username | Display_Name | Role | Team | Email | Active | Created_At | Last_Login | Password_Hash`. Role: **`Admin | User | Teamlead`**.
- `backend/UserService.gs`: `userList/userCreate/userUpdate/userResetPassword` (admin-only).
- **Điểm khớp quan trọng:** SHTD đã có role `Teamlead` — dùng chung sẽ mang sẵn role teamlead sang AI US, phục vụ item 3.

### 1.5 Dữ liệu nguồn item 1
`H2/Template nhập Workflow và Use case.xlsx` (sheet "Ý kiến team"):
- **3 Nhóm** → **23 Workflow lớn** → **69 Use case** đề xuất (3 US/workflow).
- Nhóm: `1. Workflow chung` (7 WF) · `2. Workflow đặc thù PO` (8 WF) · `3. Workflow PTKD & QLDM` (8 WF).
- Cột: `STT | Nhóm | Workflow lớn | Use case bổ sung`.

---

## 2. ITEM 2 — Dùng chung user/mật khẩu với SHTD (LÀM TRƯỚC — nền tảng)

> Làm trước vì item 1 (lọc WF theo role/team) và item 3 (teamlead + hội đồng chấm) đều phụ thuộc model user & role.

### 2.1 Kiến trúc chọn (Q1 = shared sheet)
- AI US GAS **đọc/ghi trực tiếp** sheet `User_Master` trên spreadsheet SHTD `1cpg1p…` (không đổi `SPREADSHEET_ID` chính của AI US — cột này vẫn giữ MASTER_DATA).
- Thêm hằng số riêng: `USER_SPREADSHEET_ID = '1cpg1p_8TGGbvZNNWZmjsKANqHW1tQijbiQBFLYn56Hk'`, `USER_SHEET_NAME = 'User_Master'`.
- `AUTH_SECRET` (Script Property) đặt **giống hệt** ở cả 2 GAS project → token cấp bởi bên nào cũng verify được.

### 2.2 Backend (GAS AI US)
- **Port** từ SHTD: `_sha256Hex`, `_hmacHex`, `_makeToken`, `validateToken`, `authLogin`, `changePassword` (đặt trong file mới `AuthTokenService.gs`).
- Route mới trong `Code.gs`: `?action=auth-login` (username+password → {token,user}), `?action=auth-change-password`.
- **Role normalize:** `Admin→admin`, `Teamlead→teamlead`, `User→user`. Bỏ khái niệm `champion`, thay bằng `teamlead` toàn hệ thống.
- **Repoint** mọi chỗ AI US đang đọc sheet `USERS` nội bộ (KPI, user-list, role resolution) sang `User_Master` dùng chung. Sheet `USERS` cũ ngừng dùng cho auth (giữ lại tạm để đối chiếu, không xóa vội).
- **Hardening (khuyến nghị):** các thao tác nhạy cảm (approve/reject, chấm điểm hội đồng, chấm điểm cá nhân) verify `token` server-side thay vì tin `reviewer_email` trong payload.

### 2.3 Frontend
- `login.html`: thêm ô **mật khẩu** (`type=password`), đổi nhãn/luồng submit.
- `auth.js`: `login()` → **async** gọi `?action=auth-login`; lưu `{token, user:{email,displayName,role,team}}` vào `sessionStorage`. `requireAuth()` kiểm tra token còn hạn (giải mã exp client-side, không cần verify chữ ký ở FE). Thêm `getToken()`; đính token vào payload các call ghi.
- Thay `isChampion*` → `isTeamlead*`; `requireChampionOrAdmin` → `requireTeamleadOrAdmin`. Cập nhật `setupNav`, nhãn role ("Champion"→"Teamlead").
- `config/env.js`: bỏ phụ thuộc `ADMIN_EMAILS`/`CHAMPION_USERS` cho auth (role nay lấy từ `User_Master`); giữ lại làm fallback offline nếu cần.

### 2.4 Dữ liệu/migration
- Đảm bảo `User_Master` có đủ: 4 teamlead (`TuanTT4, MaiTTT7, TuTV3, QuynhNNY` — Role=Teamlead hoặc Admin), toàn bộ owner đang có UC (Role=User), admin hệ thống.
- Mật khẩu mặc định = Username (theo `setupInitialUsers` của SHTD) hoặc do admin đặt; user đổi qua `auth-change-password`.
- Owner cũ trong MASTER_DATA nhưng chưa có trong `User_Master` → chạy sync (tương tự `syncUsersFromMasterData_`, nhưng ghi vào `User_Master`).

### 2.5 Test & rủi ro
- Test: login đúng/sai mật khẩu; tài khoản Active=FALSE bị chặn; token hết hạn; role teamlead thấy đúng nav; admin thấy đủ tab.
- Rủi ro: **2 project ghi chung 1 sheet** → cần cẩn trọng concurrency (LockService khi ghi). Đổi mật khẩu ở AI US phản ánh sang SHTD (đúng ý đồ). AUTH_SECRET lệch = token vô hiệu.

---

## 3. ITEM 1 — Nhập liệu theo Workflow

### 3.1 Mô hình dữ liệu
- Sheet mới `WORKFLOW_CATALOG` (trên spreadsheet AI US): `Nhom | Workflow | UseCase | Active`. Import 69 dòng từ `H2/Template nhập Workflow và Use case.xlsx`.
- Bảng map role → nhóm: `TEAM_GROUP_MAP` (`Team | Nhom`) — **cần bạn cung cấp** (xem §6.1). Quy tắc: mọi user luôn thấy Nhóm `1. Workflow chung`; cộng thêm Nhóm ứng với Team của mình.

### 3.2 Flow mới (Step 1 wizard)
1. **B1 — Chọn Workflow**: select `Workflow`, options = các workflow user được phép thấy (theo Team→Nhóm + "Workflow chung").
2. **B2 — Chọn Use Case**: select `UseCase_Name` (thay text tự do), options = danh sách US của Workflow vừa chọn (dependent dropdown).
3. Các field còn lại (Team, Business_Category, Pain_Point…) và Step 2/3/4 **giữ nguyên**.

### 3.3 Backend
- `Code.gs`: route `?action=workflow-catalog&team=<team>` → trả cây `{ nhom, workflows:[{ name, usecases:[...] }] }` đã lọc theo Team.
- Hàm import 1 lần: `importWorkflowCatalog_()` đọc dữ liệu (paste cứng hoặc từ CSV) ghi vào `WORKFLOW_CATALOG`.
- `HEADERS` (MASTER_DATA): thêm cột `Workflow` (+ tùy chọn `Workflow_Group`) để lưu lựa chọn. **Lưu ý:** thêm cột phải đúng cuối bảng + chạy `ensureSheetColumns_` (đã có ở `Utils.gs`) để self-heal.

### 3.4 Frontend
- `constants.js`: thêm `FIELDS.WORKFLOW`; chèn vào `STEPS[0].fields` trước `USE_CASE_NAME`; thêm `FIELD_CONFIG.Workflow` (select) và đổi `FIELD_CONFIG.UseCase_Name` từ `text` → `select` (dependent).
- `wizard.js` `FieldBuilder`: hỗ trợ **dependent select** (chọn Workflow → nạp lại options UseCase_Name). Cần cơ chế onchange cascade (hiện chưa có).
- `app.js`: nạp `workflow-catalog` theo team user khi vào register (song song `loadNextIdPreview`).
- Nếu cho phép US ngoài danh mục (§6.2): thêm option "Khác — nhập tự do" → hiện lại ô text.

### 3.5 Test & rủi ro
- Test: user Nhóm PO chỉ thấy WF chung + PO; chọn WF → US đúng; submit lưu `Workflow` + `UseCase_Name`.
- Rủi ro: user không map được Team → chỉ thấy "Workflow chung" (fallback an toàn). 69 US là backlog cố định — nếu chặn hoàn toàn free-text sẽ không đăng ký được US mới ngoài backlog (→ quyết định §6.2).

---

## 4. ITEM 3 — Mô hình chấm điểm mới (thay thế hoàn toàn)

### 4.1 Điểm US (hội đồng chấm, mỗi UC)
| Tiêu chí | Trọng số |
|---|---|
| Tiết kiệm thời gian | 30% |
| Mức độ tự động hóa | 40% |
| Tính sáng tạo | 30% |

- Mỗi thành viên hội đồng chấm 3 tiêu chí (0–100 hoặc 0–10, chuẩn hóa) → **điểm thành viên** = Σ(tiêu chí × trọng số), tối đa 100.
- **Điểm US cuối = bình quân điểm các thành viên hội đồng đã chấm** (Q2 = cả 4 người).
- Sheet mới `UC_COUNCIL_SCORE`: `Score_ID | Record_ID | UseCase_ID | Reviewer | Time_Saving | Automation | Creativity | Member_Score | Comment | Scored_At`. Điểm cuối tính từ các dòng (không ghi đè, giữ lịch sử + cho phép sửa).

### 4.2 Điểm cá nhân (teamlead chấm, 1 lần cuối kỳ)
| Tiêu chí | Trọng số |
|---|---|
| Mức độ đa dạng | 30% |
| Thành thạo ứng dụng AI | 20% |
| Chất lượng sản phẩm | 30% |
| Số lượng đủ theo yêu cầu | 20% |

- Teamlead chấm 4 tiêu chí cho từng thành viên team mình, **mỗi tiêu chí nhập 0–10**, **chấm 1 lần cuối kỳ** (hạn **31/12/2026**). Không chấm theo tháng.
- Điểm cá nhân = Σ(tiêu chí/10 × trọng số) × 100, tối đa 100.
- Tiêu chí **"Số lượng đủ theo yêu cầu"**: giữ định mức KPI **như cũ** (1 UC được duyệt/người/tuần) làm tham chiếu; luồng **"Cập nhật tuần"** giữ nguyên để theo dõi số lượng. Teamlead tự đánh giá 0–10 cho tiêu chí này dựa trên mức đạt định mức đó.
- Sheet mới `PERSONAL_SCORE`: `Score_ID | Username | Display_Name | Team | Diversity | AI_Proficiency | Product_Quality | Quantity_Met | Final_Score | Scored_By | Comment | Scored_At`.

### 4.3 Backend
- File mới `ScoringServiceH2.gs`: `submitCouncilScore_`, `listCouncilScores_`, `computeUcFinalScore_` (bình quân); `submitPersonalScore_`, `listPersonalScores_`, `computePersonalFinal_` (bình quân tháng).
- Chỉ **hội đồng** (4 username) được ghi `UC_COUNCIL_SCORE`; chỉ **teamlead của đúng team** (hoặc admin) được ghi `PERSONAL_SCORE`.
- Routes trong `Code.gs`: `council-score-submit/list`, `personal-score-submit/list`.
- **Ngưng dùng** `ScoringEngine.gs` auto-score + `submitChampionReview_` (giữ file, không route). Không chạy `recalculateAllScores_` nữa.

### 4.4 Frontend
- `review-queue.html`: chuyển từ "1 champion chấm" → **hội đồng chấm độc lập**. Mỗi thành viên nhập 3 tiêu chí (0–10), thấy điểm mình + điểm bình quân hội đồng + ai đã/chưa chấm. Điểm US **công khai** trên leaderboard.
- Trang/tab mới **Chấm điểm cá nhân** (teamlead): danh sách thành viên team mình, nhập 4 tiêu chí (0–10), 1 lần cuối kỳ (hạn 31/12/2026).
- **Bỏ** tab "Điểm SPTD" (80-10-10) và mọi hiển thị auto-score/breakdown 70-30. Rebuild **Leaderboard** quanh: Điểm US (bình quân hội đồng) + Điểm cá nhân (bình quân tháng).
- `scoring.js` (preview auto khi đăng ký) — **gỡ bỏ** (không còn auto-score). `sptd-scoring.js` — thay bằng module tổng hợp điểm cá nhân mới.
- `constants.js`: hằng số tiêu chí + trọng số mới; bỏ `RANK`/threshold cũ hoặc định nghĩa lại theo thang 100 mới.

### 4.5 Test & rủi ro
- Test: 4 thành viên chấm 1 UC → điểm cuối = bình quân; chấm thiếu người → bình quân theo số đã chấm; teamlead chỉ chấm được team mình; điểm cá nhân bình quân đúng theo tháng.
- Rủi ro: **đây là thay đổi lớn nhất** — đụng toàn bộ leaderboard/KPI/review. Cần giữ nhánh riêng, test kỹ trước khi bỏ code cũ. Dữ liệu điểm cũ trong MASTER (Total_Score…) sẽ không còn ý nghĩa hiển thị.

---

## 5. Trình tự & phụ thuộc

```
Giai đoạn 1: ITEM 2 (auth dùng chung + champion→teamlead)   ← nền tảng, chặn 1 & 3
        │
        ├── Giai đoạn 2: ITEM 1 (workflow catalog + nhập liệu)   ← cần Team→Nhóm map
        │
        └── Giai đoạn 3: ITEM 3 (scoring mới + hội đồng + leaderboard)  ← cần role teamlead ổn định
```

Mỗi giai đoạn theo quy trình: **GAS trước → FE sau → test (Playwright + unit) → deploy** ("Edit deployment → New version", URL không đổi). Làm trên feature branch riêng, không đụng `main` tới khi test xong.

---

## 6. Quyết định chi tiết (đã chốt 2026-08-17)

### 6.1 Bảng map Team → Nhóm (item 1)
| Team | Nhóm hiển thị (ngoài "Workflow chung") |
|---|---|
| Số | 2. Workflow đặc thù PO |
| CV | 2. Workflow đặc thù PO |
| BL | 2. Workflow đặc thù PO |
| PTKD MB | 3. Workflow PTKD & QLDM |
| PTKD MN | 3. Workflow PTKD & QLDM |
| QLDM | (flow riêng — tạm map "3. Workflow PTKD & QLDM"; sửa được trong sheet TEAM_GROUP_MAP; nếu muốn tách riêng/chỉ "Workflow chung" → cập nhật sau) |

- Mọi user luôn thấy Nhóm `1. Workflow chung`.
- Bảng lưu trong sheet `TEAM_GROUP_MAP` để admin tự sửa, không hardcode.

### 6.2 US ngoài danh mục — **CHO PHÉP**
- UseCase_Name = select từ danh mục theo Workflow; **kèm option "Khác — nhập tự do"** → hiện lại ô text để đăng ký US mới ngoài 69 backlog.

### 6.3 "Số lượng đủ theo yêu cầu" — **giữ định mức như cũ**
- Định mức KPI cũ: **1 UC được duyệt / người / tuần**. Giữ nguyên luồng "Cập nhật tuần".
- Chỉ **reset cách tính điểm** (bỏ SPTD 80-10-10). Teamlead chấm tiêu chí này 0–10 dựa mức đạt định mức.

### 6.4 Kỳ điểm cá nhân — **1 lần cuối kỳ**
- Teamlead chấm **1 lần**, hạn **31/12/2026**. Không chấm theo tháng, không bình quân tháng.

### 6.5 Thang nhập tiêu chí — **0–10**
- Mọi tiêu chí (cả điểm US lẫn điểm cá nhân) nhập **0–10**, quy đổi về thang 100 qua trọng số.

### 6.6 Quyền xem điểm — **công khai**
- Điểm US (bình quân hội đồng) + điểm cá nhân hiển thị công khai trên leaderboard (như hiện tại).

---

## 7. Ước lượng sơ bộ (tham khảo)

| Hạng mục | Độ lớn | Ghi chú |
|---|---|---|
| Item 2 — auth chung | Trung bình | Port sẵn từ SHTD; rủi ro ở repoint role + concurrency |
| Item 1 — workflow input | Nhỏ–Trung bình | Chủ yếu data + dependent dropdown; cần Team→Nhóm |
| Item 3 — scoring mới | **Lớn** | Rewrite scoring + review + leaderboard + KPI; nhiều test |

---

---

## 8. Nhật ký triển khai

### Giai đoạn 1 — Auth dùng chung (đang làm, branch `feat/h2-shared-auth`)

**Code đã xong (chưa deploy):**
- GAS `AuthTokenService.gs` (mới): `authLogin_`, `validateToken_`, `authChangePassword_`, `getAllUsersFromMaster_`, `getAdminUsernamesFromMaster_`, `getCouncilUsernames_`. Đọc/ghi `User_Master` trên spreadsheet SHTD `1cpg1p…`.
- GAS `Code.gs`: routes mới `auth-login`, `auth-change-password`; route `users` repoint sang `getAllUsersFromMaster_()`; `user-login` cũ giữ làm legacy.
- GAS `AdminService.gs`: `getAdminEmails_()` Priority 1 → `getAdminUsernamesFromMaster_()` (User_Master), USERS nội bộ xuống 1b.
- FE `config/routes.js`: `authLogin`, `authChangePassword`. `config/env.js`: thêm `COUNCIL_USERS`.
- FE `assets/js/api.js`: `authLogin(u,p)`, `changePassword(...)`.
- FE `assets/js/auth.js`: `getToken`, `storeAuth`, `isTeamlead/isTeamleadOrAdmin/requireTeamleadOrAdmin`, `isCouncil`; alias champion→teamlead (chấp nhận cả 2); role label Teamlead.
- FE `login.html`: thêm ô mật khẩu; submit gọi `Api.authLogin` → `storeAuth`; **bỏ fallback local** (không bypass mật khẩu).

**⚠️ Việc THỦ CÔNG bạn phải làm để chạy được (trong GAS Editor của AI US project):**
1. **Script Properties → `AUTH_SECRET`** = đúng giá trị AUTH_SECRET đang dùng ở GAS SHTD.
2. (tùy chọn) Script Properties → `COUNCIL_USERS` = `tuantt4,maittt7,tutv3,quynhnny`.
3. Mở/authorize quyền truy cập spreadsheet SHTD `1cpg1p…` cho tài khoản chạy GAS AI US (chạy thử `authLogin_('x','y')` 1 lần để hiện prompt authorize).
4. Đảm bảo `User_Master` có: 4 teamlead (Role=Teamlead), admin, và toàn bộ owner đang có UC (Role=User) + mật khẩu.
5. Deploy: **Edit deployment → New version** (URL không đổi).

**Bổ sung phương án A (đã xong 2026-08-17):**
- ✅ User management repoint sang `User_Master`: GAS `userUpsertInMaster_` (create cần password / update), `userResetPasswordInMaster_`, `syncUsersToMaster_`; routes `user-upsert`/`user-reset-password`/`user-sync` repoint. FE `users.html` thêm ô mật khẩu (tạo=bắt buộc, sửa=đặt lại tùy chọn), role option `teamlead`; `users.js` gửi Password + reset password; `dashboard.js` role label Teamlead. CSS `#userModal` giới hạn chiều cao + cuộn.
- ✅ Trang đổi mật khẩu `change-password.html` (dùng `Api.changePassword` + token).
- ✅ `routes.js`/`api.js`: `userResetPassword`/`resetUserPassword`.
- ✅ Test: sửa assertion champion→teamlead (spec 01, 02). **Local PASS: Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14.**

**GAS:** user xác nhận đã deploy (AUTH_SECRET + authorize + User_Master), URL không đổi (2026-08-17).

**Còn nợ (không chặn) → xử lý ở Item 3 / sau:**
- `review-queue.js` vẫn dùng thuật ngữ `champion` nội bộ (chạy được nhờ alias) — dọn khi rewrite scoring.
- `tests/helpers.js` fixtures vẫn để role `champion` (auth nhận như teamlead) — đổi khi tiện.
- Sheet `USERS` nội bộ cũ: ngừng dùng cho auth, giữ lại đối chiếu.

### Giai đoạn 2 — Nhập liệu theo Workflow (đang làm, branch `feat/h2-workflow-input`)

**Code đã xong (chưa deploy GAS, chưa merge main) — test local PASS: Playwright 98/98 · SPTD 34/34 · KPI 38/38 · ID 14/14.**

Kèm tính năng mới (theo yêu cầu user 2026-08-18): **trang Admin cấu hình Workflow/US** (`workflow-catalog.html`) để thêm/sửa/xóa/đổi-tên khi phát sinh — nguồn cấu hình lưu tại GAS (sheet `WORKFLOW_CATALOG`), phục vụ droplist đăng ký.

**Quyết định chốt (AskUserQuestion 2026-08-18):** (a) UI admin = **trang riêng** `workflow-catalog.html` (admin-only, Pattern A); (b) CRUD **chỉ Workflow + US** (Team→Nhóm map sửa trực tiếp trong sheet `TEAM_GROUP_MAP`); (c) wizard: **Workflow bắt buộc → US dependent dropdown + "Khác — nhập tự do"**.

**GAS (mới/sửa):**
- `WorkflowService.gs` (MỚI): `ensureWorkflowSheets_`, `getWorkflowCatalog_(team)` (lọc theo Team, luôn kèm "1. Workflow chung"), `listWorkflowCatalog_` (admin), `workflowUpsert_`/`workflowDelete_`/`workflowRename_` (LockService), `seedWorkflowCatalog()` (PUBLIC — chạy 1 lần import 69 US + seed Team→Nhóm + self-heal cột MASTER).
- `WorkflowSeedData.gs` (MỚI): `WORKFLOW_SEED_ROWS` = 69 dòng [Nhom, Workflow, UseCase] import từ `H2/Template nhập Workflow và Use case.xlsx`.
- `Config.gs`: SHEETS += `WORKFLOW`/`TEAM_GROUP`; headers `WORKFLOW_HEADERS`/`TEAM_GROUP_HEADERS`; `TEAM_GROUP_SEED` (§6.1); `WORKFLOW_COMMON_GROUP`; HEADERS (MASTER) += `Workflow`, `Workflow_Group` (cuối bảng → ensureSheetColumns_ self-heal).
- `Code.gs`: routes `workflow-catalog` (public), `workflow-list`/`workflow-upsert`/`workflow-delete`/`workflow-rename` (admin, `isAdminEmail_`).

**FE (mới/sửa):**
- `workflow-catalog.html` + `assets/js/workflow-catalog.js` (MỚI): bảng danh mục theo Nhóm→Workflow, modal thêm/sửa US (Nhóm select + Workflow datalist + UseCase + Active) + Xóa, modal Đổi tên Workflow. Nav "Cấu hình Workflow" (admin-only) thêm vào 8 page + `auth.js setupNav` (`navWorkflowCatalog`).
- `constants.js`: `FIELDS.WORKFLOW`; chèn vào `STEPS[0]` trước UseCase_Name; `FIELD_CONFIG.Workflow` (select, wfRole); `UseCase_Name` text→select (wfRole).
- `wizard.js` `FieldBuilder`: `_bindWorkflowCascade` + `applyWorkflowCatalog`/`_populateUseCaseOptions`/`_syncUseCaseCustom`/`syncWorkflowSelection`. Dependent Workflow→US; "Khác" → ô text tự do; **name-swap** đảm bảo luôn đúng 1 carrier `name="UseCase_Name"`.
- `app.js`: fetch `workflow-catalog` theo team user (song song lookup/nextId) → `applyWorkflowCatalog`; re-sync edit/nháp; inject `Workflow_Group` lúc submit. Offline/không seed → catalog rỗng, US về nhập tự do (không chặn).
- `validation.js`: Workflow bắt buộc **chỉ khi** `window.__WF_CATALOG_READY` (offline không chặn).
- `routes.js`/`api.js`: `workflowCatalog/List/Upsert/Delete/Rename` + methods.
- `tests/05`: `fillAndGoToSubmit` route UseCase_Name qua cascade (nhánh "Khác").

**⚠️ VIỆC THỦ CÔNG để chạy được (GAS Editor AI US project) — theo thứ tự GAS→FE:**
1. Deploy code GAS mới: **Edit deployment → New version** (URL không đổi).
2. Chạy **`seedWorkflowCatalog()`** 1 lần → tạo `WORKFLOW_CATALOG` (69 US) + `TEAM_GROUP_MAP` (seed §6.1) + thêm cột `Workflow`/`Workflow_Group` vào MASTER_DATA. (Authorize nếu được hỏi.)
3. (tùy chọn) Sửa `TEAM_GROUP_MAP` nếu muốn đổi Team→Nhóm (vd QLDM tách riêng).
4. Smoke test: đăng ký UC → chọn Workflow (lọc đúng theo Team) → US dependent → "Khác" nhập tự do → lưu có `Workflow`/`Workflow_Group`; admin mở `workflow-catalog.html` thêm/sửa/xóa/đổi-tên.
5. Sau smoke test → merge `feat/h2-workflow-input` → `main`.

**Cập nhật 2026-08-18 (cuối phiên):** GAS đã deploy (URL không đổi), local test PASS, **đã merge `feat/h2-workflow-input` → `main` + push** (user: push thẳng main, không dùng nhánh riêng vì DA chưa thương mại hóa). Còn lại: xác nhận `seedWorkflowCatalog()` đã chạy (nếu droplist trống) + smoke test live.

### Giai đoạn 3 — Mô hình chấm điểm mới (Đợt 1: lõi member scoring, branch `feat/h2-scoring`)

**Ngày:** 2026-08-25 · **PM:** Tuan. Bối cảnh: chương trình H2 quản trị tại AIOS hub (`binh-dan-hoa-ai-H2/`); **KPI PM chốt bản A** (30/20/30/20) — mở khóa Giai đoạn 3. Đợt 1 làm **lõi member scoring**; KPI Teamlead 60/40 + KPI PM bản A + khóa học/lan tỏa/trừ milestone để **Đợt 2**.

**Code đã xong (chưa deploy GAS, chưa merge main):**

*GAS backend (mới `ScoringServiceH2.gs` + sửa `Config.gs`/`Code.gs`):*
- Sheets mới: `UC_COUNCIL_SCORE` (Score_ID·Record_ID·UseCase_ID·Reviewer·Time_Saving·Automation·Creativity·Member_Score·Comment·Scored_At) + `PERSONAL_SCORE` (Score_ID·Username·Display_Name·Team·Diversity·AI_Proficiency·Product_Quality·Quantity_Met·Final_Score·Scored_By·Comment·Scored_At). Headers + trọng số ở `Config.gs` (`H2_UC_WEIGHTS` 30/40/30 · `H2_PERSONAL_WEIGHTS` 30/20/30/20 · `H2_CRITERIA_MAX`=10). `ensureScoringH2Sheets_()` self-heal (idempotent — route tự gọi, KHÔNG cần seed).
- **Điểm US:** `submitCouncilScore_` (upsert theo Record_ID×Reviewer; auth = council `getCouncilUsernames_` hoặc admin; token ưu tiên qua `_resolveReviewer_` → fallback reviewer_email) → tính `Member_Score` → `computeUcFinalScore_` ghi **bình quân** lên MASTER (`Total_Score`+`Committee_Review_Score`+`Rank_Category`+`Score_Updated_At`). `listCouncilScores_` (ai đã/chưa chấm + final) · `getCouncilProgress_` (map tất cả UC, 1 lần đọc — cho hàng đợi).
- **Điểm cá nhân:** `submitPersonalScore_` (upsert theo Username; auth = teamlead đúng team `isChampionForTeam_` hoặc admin; team member tra body → User_Master) · `listPersonalScores_`.
- **Leaderboard:** `getH2Leaderboard_` (uc_ranking = UC đã có ≥1 lượt chấm, theo Committee_Review_Score; personal_ranking).
- Routes `Code.gs`: `council-score-submit/list`, `council-progress`, `personal-score-submit/list`, `h2-leaderboard`. **Ngưng** dùng `champion-review`/auto-score (giữ code, không route mới).

*FE:*
- `routes.js`/`api.js`: +6 method H2 (submitCouncilScore·listCouncilScores·getCouncilProgress·submitPersonalScore·listPersonalScores·getH2Leaderboard) — đính `token` vào payload.
- `assets/js/scoring-h2.js` (MỚI, mirror GAS): `councilMemberScore`·`personalFinalScore`·`councilAverage`·`rankInfo`. Unit test `assets/tests/test-scoring-h2.js` **27/27 PASS**.
- **`review-queue.html`+`review-queue.js` (viết lại):** hội đồng chấm 3 tiêu chí 0–10 (30/40/30); panel hiện điểm US bình quân + ai đã/chưa chấm + prefill điểm của chính reviewer; 3 nhóm theo góc nhìn (Cần bạn chấm / Đã chấm—chờ đủ / Đã đủ hội đồng); nạp `getCouncilProgress` + `listUseCases(Approved)`; gate submit theo `isCouncil()`. Swap include `scoring.js`→`scoring-h2.js`.
- **`personal-score.html`+`personal-score.js` (MỚI):** teamlead chấm 4 tiêu chí 0–10 (30/20/30/20) cho thành viên team mình (admin mọi team); bảng thành viên + panel; nav `navPersonalScore` thêm vào 9 trang + `auth.js setupNav` (teamlead+admin).
- **`leaderboard.html` (rebuild):** 2 tab — "Điểm US (hội đồng)" (uc_ranking, cột Hội đồng n/4 + Điểm US/100) + "Điểm cá nhân" (personal_ranking); nguồn `h2-leaderboard`; ẩn filter category; bỏ cột Auto/Champion/Tổng cũ.
- **`dashboard.html`:** ẩn tab "Điểm SPTD" (mô hình 80-10-10 ngưng dùng).

**⚠️ VIỆC THỦ CÔNG để chạy được (GAS Editor AI US project):**
1. (Tùy) Script Property `COUNCIL_USERS` = `tuantt4,maittt7,tutv3,quynhnny` (mặc định đã hardcode nếu thiếu).
2. Deploy code GAS mới: **Edit deployment → New version** (URL không đổi). Rồi chạy TAY **`setupScoringH2Sheets()`** trong GAS Editor (PUBLIC) để tạo sẵn 2 sheet `UC_COUNCIL_SCORE`+`PERSONAL_SCORE` tại LIVE (idempotent; route chấm điểm cũng tự tạo nếu quên).
3. Smoke test: (a) đăng nhập council → review-queue → chấm 1 UC Approved → điểm US = bình quân, tiến độ n/4 tăng; (b) teamlead → personal-score → chấm 1 thành viên; (c) leaderboard 2 tab hiển thị đúng.
4. Sau smoke test → merge `feat/h2-scoring` → `main`.

### Giai đoạn 3 — Đợt 2: KPI tổng hợp (Member + Teamlead + PM bản A) — CODE XONG 2026-08-25

Hoàn thiện bộ KPI H2 đầy đủ (`binh-dan-hoa-ai-H2/config/kpi_roles.yaml` + `kpi_pm.yaml` bản A).

**GAS (`ScoringServiceH2.gs` + `Config.gs`/`Code.gs`):**
- Mở rộng `PERSONAL_SCORE` +4 cột: `Courses_Completed`, `Courses_Paid` (M-KPI-3), `Sharing_Achieved` (M-KPI-4), `Milestones_Late` (điểm trừ) — **teamlead nhập cùng lúc chấm năng lực** (1 chạm, 1 nguồn).
- Hằng số `H2_KPI_WEIGHTS` (M1·0.40 M2·0.30 M3·0.15 M4·0.15) · `H2_COURSE_*` (mỗi khóa 25%, trả phí x2, cap 100) · `H2_MILESTONE_PENALTY_*` (−2%/mốc, cap −10%) · `H2_TEAMLEAD_WEIGHTS` (60/40) · `H2_KPI_PASS`=70 · `H2_PM_WEIGHTS` (30/20/30/20).
- Engine: `_courseScore_`/`_sharingScore_`/`_milestonePenalty_`/`_memberKpiFinal_`/`_teamleadKpiFinal_`; `_buildKpiContext_` (3 read: MASTER→UC theo owner, PERSONAL, users); `_memberKpiFor_` (M1 = bình quân điểm US hội đồng các UC của member, match Owner_Email→username fallback Owner_Name); `getKpiLeaderboard_` (member_ranking + teamlead_ranking T1/T2 + **center_avg** cho PM-A2). Route `kpi-leaderboard`.
- `submitPersonalScore_`/`listPersonalScores_` ghi/đọc 4 cột mới.

**FE:**
- `scoring-h2.js`: +`courseScore`/`sharingScore`/`milestonePenalty`/`memberKpiFinal`/`teamleadKpiFinal`/`pmKpiFinal` + weights. Unit test `test-scoring-h2.js` **62/62 PASS** (27 Đợt 1 + 35 Đợt 2).
- `personal-score.html/js`: +ô Số khóa học / trả phí / Lan tỏa (checkbox) / Số milestone chậm + preview M3/M4/−trừ; prefill + submit 4 field.
- `leaderboard.html`: +2 tab "KPI tổng hợp" (Member: breakdown M1/M2/M3/M4/−trừ + KPI/100) + "KPI Teamlead" (T1/T2 + KPI/100); **PM card** (admin) A1 (KPI cá nhân PM tự tìm) + A2 (center_avg) tự động, A3/A4 nhập tay → tính `pmKpiFinal` live. `routes.js`/`api.js`: +`kpiLeaderboard`.

**⚠️ VIỆC THỦ CÔNG (LIVE):** deploy GAS (New version) + chạy lại **`setupScoringH2Sheets()`** (idempotent — thêm 4 cột mới vào `PERSONAL_SCORE`). M-KPI-1 hiển thị khi có UC hội đồng chấm; M-KPI-2/3/4/trừ khi teamlead chấm cá nhân.

**Đợt 2 residual:** ✅ **DỌN auto-score cũ** (gỡ preview register + breakdown 70/30 ở leaderboard/dashboard → hiển thị Điểm US hội đồng) + ✅ **rewrite Playwright 03/04/06** (03 hội đồng · 04 ScoringH2 fixture · 06 leaderboard KPI + SPTD ẩn — **42/42 PASS**; full suite 85 pass +1 flake timing weekly-update pass khi chạy riêng). **Còn:** nối A3 (Action Plan) tự động từ SHTD/hub (nhập tay); xóa hẳn dashboard.js SPTD dormant code + gỡ `scoring.js`/`champion-review`/`ScoringEngine.gs` khi ổn định.

*Cập nhật lần cuối nhật ký: 2026-08-25 (Giai đoạn 3 Đợt 1+2 code xong, branch `feat/h2-scoring`; Đợt 1 đã deploy+merge, Đợt 2 chờ deploy+merge).*
