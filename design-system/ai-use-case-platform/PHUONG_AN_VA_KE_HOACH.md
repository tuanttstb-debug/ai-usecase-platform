# Nâng cấp tổng thể UI/UX AIUS theo chuẩn v2 — phương án & kế hoạch

> Anh Tuân giao 2026-11-03. Chuẩn: AIOS `03_Skills/design-system` v2 · profile **P1 App tác nghiệp** · `MASTER.md` (cùng thư mục, sinh 2026-11-03).
> Phạm vi anh chốt: **toàn bộ 12 trang** · **không giữ màu nhận diện cũ** (bỏ tím-cam SHTD) · **điện thoại + laptop, tối ưu laptop 14"** · **làm từng đợt: push → báo anh check OK → làm đợt sau**.

## 1. Hiện trạng (đo LIVE 2026-11-03, tài khoản tuantt4, Chrome)

App là 1 trang `index.html` + router hash: 13 màn + `login.html` + `change-password.html` (10 file `*.html` còn lại chỉ chuyển hướng). CSS 14 file, 4.802 dòng (riêng `dashboard.css` 1.803). JS render khoảng 480 chuỗi class.

| Khổ | Màn lỗi | Lỗi |
|---|---|---|
| **Điện thoại 390px** | Dashboard · Bài tập & Học tập · Leaderboard | **Trang tràn ngang** (rộng 736 / 521 / 491px): hàng tab `dash-tab`/`lb-tab` không cuộn riêng, bảng `dash-table`/`rank-table` nằm ngoài khung cuộn |
| 390px | Hàng đợi Review · Cấu hình Workflow · Độ phủ Workflow | Bảng rộng hơn màn hình (trang không tràn nhưng bảng bị cắt) |
| 390px | Chấm bài & lan tỏa (533) · KPI từng người (39) · Hàng đợi Review (9) | Nút/ô nhập cao < 36px — khó bấm bằng tay |
| Laptop 1366px | cả 13 màn | Không tràn ngang. Sidebar chiếm ~268px, vùng nội dung ~1.030px |
| Mọi khổ | Cấu hình Workflow (452) · Chấm bài (338) · Độ phủ (57) · Hàng đợi (49) | Chữ < 12px |
| Mọi khổ | Độ phủ Workflow (16) · Leaderboard (2) · Đăng ký (1) | Emoji làm biểu tượng |

**Lỗi nền (theo mã nguồn):**
- **Phông DM Sans không có bộ chữ tiếng Việt** (Google Fonts chỉ có latin/latin-ext) → chữ có dấu rơi về phông khác, nét không đều. Fira Sans (MASTER đề xuất) có bộ `vietnamese`.
- Tương phản không đạt WCAG AA: chữ mờ `#A4A4B2` trên nền trắng ≈ 2,4:1 (cần ≥ 4,5:1). Chữ nhóm menu `rgba(255,255,255,.5)` trên nền tím cũng không đạt.
- Token cũ đặt tên kiểu SHTD (`--color-primary` tím, `--sidebar-gradient`), một số màu viết cứng trong component.

## 2. Gu mới (từ MASTER, đã chỉnh theo luật AIOS)

| Vai | Màu | Ghi chú |
|---|---|---|
| Primary (link, nút chính, mục menu đang chọn) | `#1D4ED8` xanh dương 700 | MASTER `#1E40AF`, em nâng 1 bậc để nút nổi hơn; chữ trắng ≈ 6,7:1 |
| Accent (chỉ để nhấn "cần chú ý") | `#D97706` hổ phách, chữ đen | Không dùng làm nút chính (chữ trắng trên hổ phách không đạt AA) |
| Nền / thẻ | `#F8FAFC` / `#FFFFFF` | |
| Chữ / chữ phụ | `#0F172A` / `#475569` | **Bỏ chữ xanh navy của MASTER** → slate trung tính, dễ đọc bảng dày |
| Viền | `#E2E8F0` | Bỏ viền xanh nhạt của MASTER (bảng dày nhìn rối) |
| Trạng thái | Xanh `#15803D` · Vàng `#B45309` · Đỏ `#B91C1C` · Thông tin `#1D4ED8` | Đều ≥ 4,5:1 trên nền trắng |
| Phông | **Fira Sans** (chữ) · **Fira Code** (số, mã EX-/KR-/PC-) | Có tiếng Việt; dự phòng `Segoe UI, system-ui` khi máy cơ quan chặn Google Fonts |
| Biểu tượng | Font Awesome 6 (đang dùng) — thay emoji | |
| Theme | Sáng mặc định + nút tối (nhớ theo máy) | Luật P1 |

**Sidebar:** đổi từ nền tím đậm sang **nền trắng/slate-50, mục đang chọn tô xanh nhạt + vạch xanh trái** (kiểu app quản trị hiện đại). Thu gọn được còn thanh biểu tượng 72px.

## 3. Bố cục theo thiết bị

| Khổ | Bố cục |
|---|---|
| **Laptop 14" (1366–1536px, đích chính)** | Sidebar 232px (thu được 72px) · nội dung co giãn tới 1.440px, không bó hẹp giữa màn · chữ thân 14px, bảng 13px, số dùng Fira Code · tiêu đề bảng dính khi cuộn · bộ lọc 1 hàng |
| Màn lớn ≥ 1600px | Như trên, giữ lề hai bên, không kéo dãn bảng quá 1.440px |
| Máy tính bảng 768–1024px | Sidebar thu thành biểu tượng · lưới 2 cột → 1 cột |
| **Điện thoại ≤ 480px** | Sidebar trượt ngang (nút ☰) · topbar dính · hàng tab cuộn ngang trong khung riêng · bảng cuộn trong `.table-wrap` (bảng chính ≥ 6 cột → dạng thẻ) · nút/ô nhập cao ≥ 40px · hộp thoại trượt từ đáy · **0 tràn ngang** |

## 4. Cách làm — phương án

| Phương án | Mô tả | Đánh giá |
|---|---|---|
| A. Thay hẳn bằng starter AIOS | Bỏ 14 file CSS, dùng class của starter, sửa ~480 chuỗi class trong JS | ❌ Rủi ro cao: đụng logic render, vỡ 24 file test Playwright, khó chia đợt |
| **B. Giữ class, thay lớp gu + khung từng phần (khuyến nghị)** | Đợt 1 viết lại token (`brand.css` + `tokens.css`, giữ tên biến cũ làm bí danh trỏ sang token mới) → mọi màn đổi màu/phông cùng lúc. Các đợt sau viết lại CSS từng nhóm màn, JS chỉ sửa khi cần (tab cuộn, bảng → thẻ, bỏ emoji) | ✅ Đổi được toàn app ngay đợt 1, mỗi đợt nhỏ, test cũ vẫn chạy, quay lui dễ |

**Chọn B.** Mỗi đợt: sửa → Playwright toàn bộ (hiện 180/180) → đo lại 3 khổ (390 · 1366 · 1536) trên Chrome + `/design-review` → bump cache `?v=` → push `main` (GitHub Pages lên ngay, **không cần redeploy GAS** — đợt này chỉ đụng giao diện) → báo anh check.

## 5. Kế hoạch 4 đợt

| Đợt | Nội dung | Màn | Xong khi |
|---|---|---|---|
| **1. Nền + khung** | Token mới + phông Fira (có tiếng Việt) + bí danh biến cũ · sidebar sáng, thu gọn được, trượt ngang trên điện thoại · topbar · nút tối · nút / ô nhập / select / badge / tab / bảng chung (tab cuộn riêng, `.table-wrap`) · trang đăng nhập + đổi mật khẩu | Toàn app đổi gu; riêng login, đổi mật khẩu, khung app làm kỹ | 0 tràn ngang ở cả 13 màn 390px · tương phản AA chữ thường · Playwright xanh |
| **2. Màn dùng hằng ngày (H2)** | Trang chủ · Bài tập & Học tập (5 tab) · KPI của tôi · Chấm bài & lan tỏa · KPI từng người | 5 | Nút ≥ 40px trên điện thoại · bảng tuần/khóa/việc lớn đọc được trên 390px · bộ lọc Team + Nhân sự đúng chuẩn |
| **3. Use case** | Đăng ký (wizard) · Use case của tôi · Cập nhật US · Hàng đợi Review · Thư viện AI | 5 | Form 1 cột trên điện thoại, nhãn rõ, focus thấy được · Hàng đợi Review dạng thẻ trên điện thoại |
| **4. Báo cáo + dọn** | Dashboard · Leaderboard · Độ phủ Workflow · Cấu hình Workflow · US H1 · bỏ emoji · dọn CSS thừa (`dashboard.css` 1.803 dòng) · cập nhật `DESIGN_SYSTEM.md`/`COMPONENT_GUIDELINES.md` | 5 + dọn | `/design-review` cả app không còn lỗi Chặn/Cao · tài liệu khớp |

Mỗi đợt ước 1 phiên làm việc. Em báo anh sau mỗi lần push, kèm ảnh trước/sau ở 2 khổ (laptop + điện thoại).

## 6. Rủi ro & cách giữ

| Rủi ro | Giữ bằng |
|---|---|
| Đổi màu làm sai nghĩa trạng thái (Đạt/Chưa đạt, RAG) | Giữ đúng thang trạng thái, chỉ đổi sắc; soát màn Chấm bài + Việc lớn ở đợt 1 |
| Máy cơ quan chặn Google Fonts | Phông dự phòng Segoe UI (có tiếng Việt) |
| Người dùng đang mở bản cũ trong cache | Bump `?v=` mọi file CSS/JS mỗi đợt |
| Đợt 1 đổi toàn app cùng lúc, màn chưa làm kỹ có thể lệch | Bí danh biến cũ giữ bố cục; đo 13 màn ở 3 khổ trước khi push |
| Test Playwright bám selector | Giữ class (phương án B); test vỡ → sửa test chỉ khi đổi có chủ đích |

## 7. Cần anh duyệt
1. Phương án **B** + 4 đợt như mục 5.
2. Gu mục 2: xanh dương + slate, sidebar **sáng**, phông Fira Sans.
3. Đợt 1 làm ngay sau khi anh duyệt.
