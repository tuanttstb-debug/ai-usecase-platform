# TODO NEXT

Thứ tự ưu tiên cho session tiếp theo.

---

## P0 — [BLOCKING] Authorize GAS deployment mới (BUG-GAS-02)

Mọi request write/read đều bị "không có quyền" vì GAS Web App mới chưa grant OAuth access to Google Sheet.

**Fix (2 phút):**
1. Vào GAS Editor của deployment mới
2. Chọn bất kỳ function (VD: `getLookupData_`)
3. Nhấn **Run** → popup hiện → **Review permissions → Allow**
4. Test lại create: `GAS_URL?action=health` phải trả `{"success":true}`

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

## P0 — [BLOCKING] Fix GAS data loading (BUG-GAS-01)

`?action=lookup` / `?action=list` lỗi. Phần lớn khả năng do BUG-GAS-02 (chưa authorize). Sau khi fix BUG-GAS-02, test lại ngay.

**Nếu vẫn lỗi sau authorize:**
- GAS Editor → **Executions** → copy error message cụ thể
- Mở trực tiếp: `GAS_URL?action=lookup` → xem response raw

---

## P0 — Verify approve/reject end-to-end sau khi fix BUG-GAS-02 + BUG-GAS-03

Checklist:
- [ ] Login admin → dashboard → tab "Chờ duyệt" → click "Xem chi tiết"
- [ ] Modal hiện đúng 4 sections (Section 2-4 load sau ~1-2s khi GAS trả về)
- [ ] Click "Duyệt" → nhập comment → xác nhận → toast "Đã duyệt thành công"
- [ ] Click "Từ chối" → nhập lý do → xác nhận → toast "Đã từ chối"
- [ ] Submit use case mới → không bị lỗi quyền

---

## P1 — Deploy GAS với local fixes chưa sync

Các file đã sửa local nhưng chưa copy vào GAS Editor:
- [ ] `Config.gs` — `ADMIN_EMAILS = ['admin', 'tuantt4', 'manager']` (commit `0b8c7a0`)
- [ ] `Utils.gs` — xóa `addHeader` calls (commit `357e22f`)
- [ ] `LookupService.gs` — rewrite (commit `357e22f`)

---

## P2 — Nâng cấp auth (security)

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

## P3 — Feature backlog

- [ ] Pagination cho dashboard "Tất cả use case" (hiện giới hạn 200 records)
- [ ] "Under Review" status transition cho workflow
- [ ] Export to CSV từ dashboard
- [ ] Line chart (submission trend) — cần `trend_data` từ GAS API

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
