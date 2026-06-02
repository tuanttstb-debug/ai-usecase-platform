# TODO NEXT

Thứ tự ưu tiên cho session tiếp theo.

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

## P3 — Feature backlog

- [ ] Explore tab: show empty state với CTA "Chưa có UC nào được duyệt — hãy là người đầu tiên!" thay vì text thuần
- [ ] Pagination cho dashboard (giới hạn 200 records hiện tại)
- [ ] "Under Review" status transition cho workflow
- [ ] Export to CSV từ dashboard
- [ ] Line chart (submission trend) — cần `trend_data` từ GAS API
- [ ] Fix double-fetch: `_loadTabData('my')` vẫn gọi `_loadMyUseCases()` sau startup

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

## ✅ Đã hoàn thành trong session 2026-06-02

- [x] BUG-GAS-01: URL sai → restore đúng URL
- [x] BUG-GAS-02: OAuth authorized
- [x] BUG-CSS-01: modal footer bị đẩy xuống khi nội dung dài
- [x] Auto-load tất cả tabs khi login (`_loadStartupData`)
- [x] Tab Khám phá (all approved UCs, searchable, all users)
- [x] Copy Prompt (8 fields, clipboard API + fallback)
- [x] Approve/Reject confirmed working end-to-end

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
