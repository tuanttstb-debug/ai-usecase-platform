# Rà soát UI/UX — các màn CR 2026-09-12 (audit 2026-09-14)

**Phạm vi:** đối chiếu các màn vừa triển khai (Đăng ký tối giản · Cập nhật US · US H1 · Bài tập AI · Tự chấm KPI · Duyệt chấm điểm) với concept chuẩn SHTD-Dashboard + chính hệ component sẵn có của AIUS.
**Mục tiêu:** đồng nhất trải nghiệm, quy về component chung, rút thành rule cho dự án tới (lưu ở hub: `AIOS/04_Knowledge/references/REF-UIUX-COMPONENT-CONTRACT.md`).
**Kết quả:** 10 phát hiện → đã sửa (FE-only, KHÔNG đụng GAS). Playwright **124/124 PASS**. Cache-bust `?v=20260914`.

## Gốc vấn đề
Các màn mới được dựng bằng chuỗi HTML + **inline-style tự chế**, không dùng lại component mà chính AIUS đã có → lệch trải nghiệm ngay trong cùng 1 app (và một số class nút gõ sai nên vô hiệu).

## Bảng phát hiện & xử lý
| # | Vấn đề | Bằng chứng (trước) | Mức | Đã sửa |
|---|--------|-----|-----|--------|
| 1 | Class nút sai: `btn--sm` không định nghĩa ở đâu; `btn--ghost` chỉ có trong dashboard.css → nút mất cỡ nhỏ/kiểu ghost | ai-exercise.js, self-score.js, us-h1.js, index.html:239/240/700 | 🔴 | Quy về canon `.btn-sm`/`.btn-ghost` (components.css) toàn bộ |
| 2 | Search lệch pattern: view cũ dùng `.search-box`+`.search-input` (icon 🔍, `type=search`); view mới dùng `.form-input` trơ + inline `max-width` | index.html h1Search/exSearch | 🔴 | Bọc `.search-box` + `<i class="fa-solid fa-magnifying-glass search-icon">` |
| 3 | Modal US H1 tự chế overlay inline; nút đóng `btn ✕` thay `.modal-close` | index.html #h1Modal | 🟠 | Về `.modal-overlay/.modal-card--wide/.modal-header/.modal-close/.modal-body` |
| 4 | Badge trạng thái hardcode hex (`#FFF4D6`…) → hỏng dark mode | self-score.js STATUS_BADGE | 🔴 | Dùng `.badge` + `.badge-muted/warning/success/error` (có override dark) |
| 5 | Nút Duyệt hardcode `background:#2e7d32` | self-score.js | 🟠 | Dùng `.btn-success btn-sm` / `.btn-ghost btn-sm` |
| 6 | Không có confirm khi xóa (AIUS thiếu helper confirm) | ai-exercise.js `del()` | 🟠 | MỚI `assets/js/ui-confirm.js` (`uiConfirm()` Promise, modal chuẩn) → gate xóa |
| 7 | Empty/loading không nhất quán (`.empty-state` vs `<p>` tự chế) | 3 màn | 🟡 | MỚI `.list-empty`/`.list-loading` (components.css) dùng chung |
| 8 | Bảng US H1 dựng tay inline-style | us-h1.js | 🟡 | `.table-wrap` + `.data-table` (giữ hook `.h1-table` cho test) |
| 9 | Icon = emoji (▶ ⚠ ↗ 📋 ✕); AIUS không nạp icon font | index.html + 3 màn | 🟡 | Nạp **Font Awesome 6** (khớp SHTD); icon hành động → FA |
| 10 | Rò rỉ listener: gắn `keydown` global mỗi lần init view | us-h1.js:197 | 🟡 | Guard `_escBound` bind 1 lần |

## Điểm đã nhất quán sẵn (giữ)
- debounce search 200ms; `.btn-primary` = cam (Nguyên tắc 2); dùng `Toast` thống nhất; modal các màn cũ đã dùng `.modal-card--wide`.

## File chạm (FE-only)
- `index.html` (FA head, 2 search-box, modal US H1 chuẩn, `btn--sm`→`btn-sm`, include ui-confirm, cache-bust `?v=20260914`)
- MỚI `assets/js/ui-confirm.js`
- `assets/css/components.css` (+`.list-empty`/`.list-loading`/`.table-wrap`)
- `assets/js/{ai-exercise,self-score,us-h1}.js`
- `tests/13-us-h1.spec.js` (selector nút đóng → `.modal-close`)

## Residual / lưu ý
- FA nạp qua CDN cdnjs (không SRI để tránh hash lệch chặn tải). Cân nhắc self-host nếu cần offline tuyệt đối.
- Vài glyph inline nhỏ trong text (⚠/↗) giữ nguyên (không phải nút) — chấp nhận.
- `.btn--ghost` trong dashboard.css nay dead (đã quy usage về `.btn-ghost`) — dọn khi rảnh.
- `_stagePill` còn dựng inline theo `STAGE_LABELS` (nguồn chung) — chấp nhận.
