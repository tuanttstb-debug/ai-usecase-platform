# TECH DEBT

Các vấn đề kỹ thuật đã biết, chưa ưu tiên xử lý ngay.

---

## SEC-01 — Không có xác thực thật (CRITICAL)

**Mô tả:** Login bằng username tự nhập, không verify. Bất kỳ ai biết username admin đều có thể login với role admin.

**Hiện trạng:** Username-based, session lưu trong sessionStorage. GAS backend validate `reviewer_email` trong `ADMIN_EMAILS` nhưng không verify identity.

**Rủi ro:** Ai biết username "admin" hoặc "tuantt4" → vào được dashboard admin.

**Fix đề xuất:** Google Sign-In (`google.accounts.oauth2`) hoặc domain restriction. Pending PO decision.

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

## GAS-DEBT-01 — GAS local files chưa sync với deployed version

**Mô tả:** Một số file GAS backend đã sửa local nhưng chưa deploy lên GAS Editor:
- `Config.gs`: ADMIN_EMAILS = usernames (commit `0b8c7a0`)
- `Utils.gs`: xóa `addHeader` (commit `357e22f`)
- `LookupService.gs`: rewrite (commit `357e22f`)

**Rủi ro:** Discrepancy giữa git và GAS deployed version → hard to debug.

**Fix:** Luôn copy file GAS local → GAS Editor → Deploy sau mỗi session. Xem xét dùng `clasp` để sync tự động.

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

## PERF-02 — `_loadTabData('my')` vẫn fetch API riêng sau startup

**Mô tả:** Sau khi `_loadStartupData()` đã populate `_myList`, user click tab "My Cases" vẫn gọi `_loadMyUseCases()` (không có guard) → thêm 1 API request không cần thiết.

**Hiện tại:** Harmless về functionality, chỉ lãng phí 1 request mỗi lần click.

**Fix:** Thêm guard `if (_myList.length === 0)` vào `_loadTabData` case 'my'. File: `assets/js/dashboard.js` dòng `} else if (tab === 'my') {`.
