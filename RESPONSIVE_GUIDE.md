# Responsive Guide — TPBank BIZ

> ⚠️ **ĐÃ THAY bằng UI/UX v2 (v4 token, 2026-11-03).** Nguồn chuẩn hiện tại:
> - Gu (màu, phông, dials): `design-system/ai-use-case-platform/MASTER.md` · phương án + 4 đợt: `design-system/ai-use-case-platform/PHUONG_AN_VA_KE_HOACH.md`
> - Token: `assets/css/variables.css` — primary xanh `#1D4ED8`, chữ/viền slate, hổ phách `--color-accent` CHỈ để nhấn "cần chú ý", nút chính = `.btn-primary` (xanh), phông Fira Sans/Fira Code (có tiếng Việt), chữ thân 14px, nhỏ nhất 12px
> - Khung: sidebar sáng (thu gọn desktop `.app-layout.is-collapsed` · trượt ngang ≤1024px) · trang trong `.app-content` dùng `.app-container.view-wrap` (1200px) / `--narrow` (960px), không style inline max-width/padding
> - Điện thoại: tab cuộn trong khung (`.dash-tabs`/`.lb-tabs`/`.tab-nav`) · bảng chỉ-đọc ≥5 cột tự thành thẻ ≤640px (`shell.js` gắn `.is-stacked` + `data-label`; bảng không muốn xếp thẻ → `data-no-stack`) · nút/ô nhập ≥40px
> - Biểu tượng: Font Awesome 6 / SVG — **không emoji**. Màu dữ liệu trong JS dùng bảng v4 (xanh `#15803D` · vàng `#B45309` · đỏ `#B91C1C` · tím `#6D28D9` = Xuất sắc)
> - Bộ lọc theo người: chuẩn Team + Nhân sự (`people-filter.js`). Kiểm cuối: `/design-review` (hub AIOS)
>
> Phần dưới là tài liệu hệ cũ (tím-cam SHTD), giữ để tra lịch sử.


## Strategy: Desktop-First

All base styles target 1440px. Media queries progressively simplify for smaller screens.

## Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Desktop XL | 1440px+ | Full layout, sidebar 252px |
| Desktop | 1280px | Sidebar 240px, content padding 24px |
| Tablet L | 1024px | **Sidebar collapses to off-canvas** |
| Tablet | 768px | KPI 2-col, compact topbar, smaller tabs |
| Mobile | 480px | KPI 1-col, full-width forms, bottom nav |

## Sidebar Responsive Behavior

```
1440px → sidebar always visible (252px)
1280px → sidebar always visible (240px)
1024px → sidebar hidden (translateX(-100%))
         toggle button appears in topbar
         opening sidebar adds overlay
```

## KPI Grid Responsive

```
1440–1025px → 4 columns
1024–769px  → 2 columns
480px       → 1 column
```

## Wizard Form Responsive

```
Desktop  → padding 32px sides
Tablet   → padding 20px sides
Mobile   → padding 16px sides
           step labels hidden
           nav buttons stack vertically
```

## Topbar Responsive

```
Desktop  → [Title] [Refresh] [User chip with name]
Tablet   → [Sidebar Toggle] [Title] [Refresh] [Avatar only]
Mobile   → [Sidebar Toggle] [Title] [Refresh]
```

## Typography Responsive

Typography scale uses rem-based values and does not change at breakpoints.
Font size stays consistent — only layout/padding adapts.

## Touch Targets

All interactive elements maintain `min-height: 40px` (buttons) or `min-height: 44px` (sidebar nav items) to meet mobile touch target standards.
