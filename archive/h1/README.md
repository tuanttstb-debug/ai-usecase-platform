# Archive H1 (mô hình cũ) — Bình dân hóa AI

Thư mục lưu **ghi chú/di sản của giai đoạn H1** (mô hình chấm điểm cũ), **KHÔNG còn nạp/deploy**.
Mục đích: giữ lịch sử để tra cứu, **tách bạch khỏi H2** để không lẫn lộn. (Dọn 2026-08-26.)

## H2 thay thế H1 như thế nào
- Chấm điểm: H1 auto-score 70/30 (`ScoringEngine.gs`) + SPTD 80-10-10 (`sptd-scoring.js`)
  → **H2**: Điểm US (hội đồng, 30/40/30, bình quân) + Điểm cá nhân (teamlead, theo tháng) trong
  `assets/gas-backend/ScoringServiceH2.gs` + `assets/js/scoring-h2.js`.
- Review: H1 `manager-review` / `champion-review` → **H2** `review-queue.html` (hội đồng) + `personal-score.html`.
- KPI: H1 tab "Điểm SPTD" ở dashboard → **H2** `leaderboard.html` (tab Điểm US / Cá nhân / KPI tổng hợp / KPI Teamlead / Heatmap).

## Nội dung archive
- `ScoringEngine.gs` — auto-score H1 (computeAutoScore_/scoreUseCase_/recalculate*). Đã gỡ mọi caller.
- `scoring.js`, `sptd-scoring.js` — client scoring H1 (không còn include).
- `manager-review.html` — trang review H1 (legacy).
- `tests/` — unit/UI test H1 (`test-sptd-scoring.js`, `test-governance-ui.js`, `scoring-test.html`).
- `build_champion_guide.py`, `capture_champion_screens.mjs`, `capture_retry.mjs`, `screenshots/` — tài liệu/ảnh H1.
- `HDSD_Champion_*.docx`, `HDSD_CapNhatTuan_*.docx`, `HUONG_DAN_NHAP_LIEU.txt` — HDSD giai đoạn H1.

## Đã gỡ ở code đang chạy (backend cần redeploy GAS)
- Routes GAS: `manager-review`, `champion-review`, `score-recalc`, `rank-recalc`.
- Hàm: `submitManagerReview_`, `submitChampionReview_` (AdminService.gs); toàn bộ `ScoringEngine.gs`.
- Ngừng gọi `scoreUseCase_` khi tạo/sửa UC + cập nhật tuần + duyệt milestone.
  → **Lưu ý hành vi:** milestone khi cập nhật tuần nay CHỈ theo **đổi stage** (bỏ "điểm tăng").
    `champion` role vẫn được nhận như `teamlead` (shim tương thích, giữ trong auth.js).
