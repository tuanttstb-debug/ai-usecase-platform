# TODO NEXT

Thứ tự ưu tiên cho session tiếp theo.

---

## P0 — [NEEDS DEPLOY] Sync GAS code v3.4 sau khi tìm được project

Sau khi hoàn thành GAS-MYSTERY-01 bên dưới, paste 2 file mới vào GAS Editor:

| File | Thay đổi quan trọng |
|---|---|
| `UseCaseService.gs` | `generateUseCaseId_()` rewrite v2 + 2 helpers + `peekNextUseCaseId_()` |
| `Code.gs` | Route `?action=next-id` |

Sau khi deploy (Edit deployment → New version), test: `GAS_URL?action=next-id` → phải trả `{"success":true,"data":{"next_id":"AIUS-XXXX"}}`

---

## P0 — [BLOCKING] Tìm đúng GAS project (GAS-MYSTERY-01)

GAS URL đang hoạt động (`AKfycbwe0eo3X3KW...`) không tìm thấy trong deployment history → không biết project nào đang serve, không thể update code GAS.

**Fix:**
1. Mở `script.google.com` → **My Projects** → duyệt tất cả project
2. Với mỗi project → **Deploy → Manage deployments** → tìm URL chứa `AKfycbwe0eo3X3KW`
3. Khi tìm được: đổi tên project thành `AI Use Case Platform` để không lạc lần sau
4. Kiểm tra project đó có đúng code không (so với `assets/gas-backend/`)

---

## P0 — Sync GAS code sau khi tìm được project

Sau khi tìm được đúng GAS project (P0 trên), paste 3 file từ repo → GAS Editor → **Edit deployment → New version → Deploy** (URL không đổi):

| File | Source |
|---|---|
| `Config.gs` | `assets/gas-backend/Config.gs` |
| `Utils.gs` | `assets/gas-backend/Utils.gs` |
| `LookupService.gs` | `assets/gas-backend/LookupService.gs` |

---

## P0 — Verify BUG-GAS-03 (CONFIG sheet ADMIN_EMAILS)

Approve/reject đang hoạt động nhưng chưa rõ vì BUG-GAS-03 đã được fix hay vì GAS project khác không có CONFIG sheet issue.

**Verify:**
1. Mở Google Sheet gắn với GAS project active
2. Sheet **CONFIG** → row `Key = ADMIN_EMAILS` → kiểm tra `Value`
3. Nếu `Value` vẫn là `admin@sptd.vn,...` → đổi thành `admin,tuantt4,manager`
4. Nếu row không tồn tại → bỏ qua (GAS fallback về `Config.gs`)

---

## P1 — End-to-end smoke test sau khi fix P0

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

## P1 — Fix regression risk (v3.6)

- [ ] `_populateTeamFilter()`: sau khi render options, sync `_filterAll.team = teamSel.value` để tránh stale filter state khi team bị xóa khỏi data sau refresh

---

## P3 — Feature backlog

- [ ] Explore tab: show empty state với CTA "Chưa có UC nào được duyệt — hãy là người đầu tiên!" thay vì text thuần
- [ ] Pagination cho dashboard (giới hạn 200 records hiện tại) — ảnh hưởng rejected card + filter
- [ ] "Under Review" status transition cho workflow
- [ ] Export to CSV từ dashboard (tab Tất cả + filter state)
- [ ] Line chart (submission trend) — cần `trend_data` từ GAS API
- [ ] Fix double-fetch: `_loadTabData('my')` vẫn gọi `_loadMyUseCases()` sau startup
- [ ] Filter tab Tất cả: thêm nút "Reset tất cả filter" (1 click reset status + team + search)

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
