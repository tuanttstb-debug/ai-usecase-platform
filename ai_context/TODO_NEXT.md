# TODO NEXT

Thứ tự ưu tiên cho session tiếp theo.

---

## P0 — [BLOCKING] Sync CONFIG sheet ADMIN_EMAILS (BUG-GAS-03)

`getAdminEmails_()` đọc CONFIG sheet trước khi fallback về `Config.gs`. Nếu sheet còn giá trị cũ, fix `Config.gs` bị vô hiệu.

**Fix:**
1. Mở Google Sheet → sheet tên **CONFIG**
2. Tìm row `Key = ADMIN_EMAILS`
3. Sửa cột `Value` thành: `admin,tuantt4,manager`
4. Không cần re-deploy GAS — sheet được đọc runtime

**Verify:** Gọi `GAS_URL?action=reject` với payload `{record_id: "...", reviewer_email: "tuantt4", comment: "test"}` → phải trả `success: true` (hoặc lỗi do record không tồn tại, không phải lỗi quyền)

---

## P0 — Sync GAS backend code vào GAS Editor

Ba file đã fix local **nhưng chưa được copy vào GAS Editor**. Deployment hiện tại (`AKfycbyaM1dQ...`) đang chạy code cũ.

**Quy trình (làm 1 lần duy nhất, URL không đổi):**

1. Vào **GAS Editor** → script.google.com
2. Mở từng file bên dưới → **xóa toàn bộ nội dung cũ → paste code mới**
3. Sau khi paste đủ 3 file: **Deploy → Manage deployments → chọn deployment hiện tại → Edit (bút chì) → Version: "New version" → Deploy**

> ⚠️ **KHÔNG nhấn "New deployment"** — sẽ tạo URL mới, phá vỡ toàn bộ. Chỉ dùng **"New version"** trên deployment cũ.

**File 1 — `Config.gs`** (thay đổi: dòng ADMIN_EMAILS)
```
ADMIN_EMAILS = ['admin', 'tuantt4', 'manager']
```
→ Copy toàn bộ nội dung từ `assets/gas-backend/Config.gs` trong repo

**File 2 — `Utils.gs`** (thay đổi: xóa `addHeader` calls trong `sendJson_`)
→ Copy toàn bộ nội dung từ `assets/gas-backend/Utils.gs` trong repo

**File 3 — `LookupService.gs`** (thay đổi: rewrite dùng `LOOKUP_CATEGORY_MAP`)
→ Copy toàn bộ nội dung từ `assets/gas-backend/LookupService.gs` trong repo

---

## P0 — Verify end-to-end sau khi sync GAS code

Checklist:
- [ ] `GAS_URL?action=health` → `{"success":true}`
- [ ] `GAS_URL?action=lookup` → trả object với các field dropdown
- [ ] `GAS_URL?action=list` → trả array use cases
- [ ] Login admin → dashboard → tab "Chờ duyệt" → xem chi tiết modal đủ 4 sections
- [ ] Click "Duyệt" → toast "Đã duyệt thành công"
- [ ] Submit use case mới từ register.html → không lỗi quyền

---

## ✅ Đã giải quyết (session 2026-06-02 Part 2)

- **[BUG-GAS-01] CLOSED** — Root cause: `env.js` trỏ đến URL không tồn tại (gõ sai khi cố revert). Đã fix về URL working `AKfycbyaM1dQ...`.
- **[BUG-GAS-02] CLOSED** — OAuth đã được authorize cho deployment hiện tại. URL đang hoạt động.
- **[BUG-FE-URL] CLOSED** — `env.js` đã commit URL đúng, pushed to origin/main.

---

## Quy trình deploy GAS chuẩn (bắt buộc đọc trước khi deploy)

**Vấn đề gốc rễ đã xảy ra hôm nay:** Mỗi lần tạo "New Deployment" trong GAS sẽ:
1. Tạo URL mới hoàn toàn → frontend mất kết nối
2. Cần authorize OAuth lại từ đầu
3. Phải update `env.js` → commit → push → đợi GitHub Pages rebuild

**Quy trình đúng khi cần cập nhật GAS code:**
```
GAS Editor → Deploy → Manage Deployments
  → Chọn deployment đang dùng → Edit (icon bút chì)
  → Version: chọn "New version"
  → Deploy
```
→ URL không đổi, OAuth không cần redo, `env.js` không cần update.

**Chỉ tạo "New Deployment" khi:** cố ý muốn có 2 môi trường song song (staging/prod).

---

## P1 — Nâng cấp auth (security)

**Hiện tại (v3.2):** Username tự nhập, không verify, không có password. SEC-01 vẫn tồn tại.

**Recommended:**

Option A — Whitelist username cho mọi user (không chỉ admin):
- `AuthService.login()`: check username có trong whitelist trước khi cho login
- Nếu không trong whitelist → block

Option B — Google Sign-In:
- `google.accounts.oauth2.initTokenClient()` (GSI v2)
- Verify token via GAS endpoint

**Clarify với PO:**
- [ ] BUG-03: Status="Draft" khi tạo mới — design intent hay bug?
- [ ] Có cần whitelist toàn bộ user không?
- [ ] Có cần thêm role (approver, viewer) không?

---

## P2 — Feature backlog

- [ ] Pagination cho dashboard "Tất cả use case" (hiện giới hạn 200 records)
- [ ] "Under Review" status transition cho workflow
- [ ] Export to CSV từ dashboard
- [ ] Line chart (submission trend) — cần `trend_data` từ GAS API

---

## P3 — Tech debt

- [ ] Migrate JS từ global var sang ES Modules (MAINT-01)
- [ ] Add `Content-Security-Policy` header (SEC-02)
- [ ] Fill `assets/docs/` với deployment guide thực tế (MAINT-07)

---

## P4 — UI Polish

- [x] SVG icon library — Heroicons 2.0 (done 2026-05-29)
- [x] Chart.js integration (done 2026-05-29)
- [x] Full UC detail view modal — 4 sections (done 2026-06-02)
- [ ] Dark mode — tokens sẵn sàng, thêm `@media (prefers-color-scheme: dark)` vào `variables.css`
- [ ] Logo SVG thay sparkles trong sidebar brand
