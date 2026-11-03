# UI/UX System — TPBank BIZ Design Philosophy

> ⚠️ **ĐÃ THAY bằng UI/UX v2 (v4 token, 2026-11-03).** Nguồn chuẩn hiện tại:
> - Gu (màu, phông, dials): `design-system/ai-use-case-platform/MASTER.md` · phương án + 4 đợt: `design-system/ai-use-case-platform/PHUONG_AN_VA_KE_HOACH.md`
> - Token: `assets/css/variables.css` — primary xanh `#1D4ED8`, chữ/viền slate, hổ phách `--color-accent` CHỈ để nhấn "cần chú ý", nút chính = `.btn-primary` (xanh), phông Fira Sans/Fira Code (có tiếng Việt), chữ thân 14px, nhỏ nhất 12px
> - Khung: sidebar sáng (thu gọn desktop `.app-layout.is-collapsed` · trượt ngang ≤1024px) · trang trong `.app-content` dùng `.app-container.view-wrap` (1200px) / `--narrow` (960px), không style inline max-width/padding
> - Điện thoại: tab cuộn trong khung (`.dash-tabs`/`.lb-tabs`/`.tab-nav`) · bảng chỉ-đọc ≥5 cột tự thành thẻ ≤640px (`shell.js` gắn `.is-stacked` + `data-label`; bảng không muốn xếp thẻ → `data-no-stack`) · nút/ô nhập ≥40px
> - Biểu tượng: Font Awesome 6 / SVG — **không emoji**. Màu dữ liệu trong JS dùng bảng v4 (xanh `#15803D` · vàng `#B45309` · đỏ `#B91C1C` · tím `#6D28D9` = Xuất sắc)
> - Bộ lọc theo người: chuẩn Team + Nhân sự (`people-filter.js`). Kiểm cuối: `/design-review` (hub AIOS)
>
> Phần dưới là tài liệu hệ cũ (tím-cam SHTD), giữ để tra lịch sử.


## Design Identity

This platform follows the **TPBank BIZ** enterprise banking aesthetic:
- Purple-first color identity
- Enterprise dashboard layout with persistent sidebar
- Card-driven content architecture
- Minimal visual noise — no animations, no heavy shadows, no gradients on content
- Data readability is the top priority

---

## Core Principles

### 1. Purple-First
Every interactive element defaults to the brand purple (`#7B2CBF`). Blue is eliminated from the primary palette.

### 2. Spacious — Not Dense
Cards use 24–32px padding. Section gaps are 24px. No cramming.

### 3. Soft & Rounded
- Cards: `border-radius: 20px`
- Inputs & Buttons: `border-radius: 12px`
- Badges & Pills: `border-radius: 9999px`

### 4. Minimal Shadow
Only one shadow rule: `0 2px 10px rgba(0,0,0,0.03)`. Heavy shadows = noise.

### 5. Workflow-First Interaction
The wizard stepper, form sections, and approval flow are the central UX patterns. All UI serves these workflows.

---

## Layout Architecture

```
┌─────────────────────────────────────────────┐
│  SIDEBAR (252px, purple gradient, fixed)    │
│  ┌─────────────────────────────────────┐    │
│  │ Brand logo + name                   │    │
│  ├─────────────────────────────────────┤    │
│  │ Nav items with icon + label         │    │
│  │ Active = white bg, left bar accent  │    │
│  ├─────────────────────────────────────┤    │
│  │ User avatar + name + logout         │    │
│  └─────────────────────────────────────┘    │
├──────────────────────────────────────────   │
│  TOPBAR (64px, white, sticky)               │
│  [Sidebar toggle] [Title]    [Actions]      │
├──────────────────────────────────────────   │
│  CONTENT AREA (fluid, max 1280px)           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│  ┌─────────────────────────────────────┐    │
│  │ Tab Nav                             │    │
│  │ ┌────────────────┐ ┌─────────────┐ │    │
│  │ │ Chart Card     │ │ Chart Card  │ │    │
│  │ └────────────────┘ └─────────────┘ │    │
│  │ ┌──────────────────────────────── ┐ │    │
│  │ │ Table Card                       │ │    │
│  │ └──────────────────────────────── ┘ │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Pages with Sidebar Layout
- `dashboard.html` — admin dashboard

### Pages with Header-Only Layout
- `index.html` — portal home (top header, service list)
- `register.html` — wizard form (top header, centered card)
- `login.html` — auth page (centered card, no sidebar)

---

## Component Hierarchy

```
Primary Action    → .btn.btn-primary (purple)
Secondary Action  → .btn.btn-outline
Destructive       → .btn.btn-danger
Submit            → .btn.btn-success
Cancel            → .btn.btn-ghost

Card container    → .card / .dash-card
Stat summary      → .kpi-card / .stat-card
Data grid         → .dash-table / .data-table
Navigation tabs   → .dash-tabs + .dash-tab
Notifications     → .toast (colored left border)
Dialog            → .modal-overlay + .modal-card
```

---

## Interaction States

### Button States
- **Default**: solid purple background
- **Hover**: darker purple + shadow `0 2px 12px rgba(123,44,191,.32)`
- **Active/Pressed**: `opacity: 0.88`
- **Disabled**: `opacity: 0.42`, no pointer events

### Input States
- **Default**: border `#E9E9EF`
- **Hover**: border `#C4B8DC`
- **Focus**: border `#7B2CBF` + ring `0 0 0 3px #EDE9FE`
- **Error**: border `#F44336` + ring from error-light

### Sidebar Nav Item States
- **Default**: transparent, text `rgba(255,255,255,0.85)`
- **Hover**: `rgba(255,255,255,0.10)` background
- **Active**: `rgba(255,255,255,0.18)` background + white left bar (3px)

---

## Color Semantics

| Use case | Color |
|---|---|
| Primary action, active, selected | Purple `#7B2CBF` |
| Success, approved | Green `#4CAF50` |
| Warning, pending | Amber `#F6B100` |
| Error, rejected, danger | Red `#F44336` |
| Informational | Blue `#2196F3` |
| Neutral, disabled, archived | Gray `#A4A4B2` |

---

## Typography Hierarchy

```
Page Title        h1  28px / bold    (topbar, page-title)
Section Title     h2  22px / bold    (page sections)
Card Title        h3  18px / semibold (dash-card-header h3)
Body              p   15px / regular
Form Label             13px / medium
Caption / Meta         11px / medium
```

---

## Anti-Patterns (STRICTLY AVOID)

- ❌ Glassmorphism (backdrop-filter + translucent cards)
- ❌ Neon glow effects
- ❌ Heavy box shadows (> 0.08 opacity)
- ❌ Flashy CSS animations (keyframes for attention)
- ❌ Google Blue (`#1a73e8`) as primary — use purple only
- ❌ Inline `style=""` color overrides that bypass tokens
- ❌ Mobile-first breakpoint ordering (desktop-first required)
- ❌ Cramped padding (< 16px inside cards)
- ❌ Random color usage outside the semantic palette
- ❌ Emoji as primary UI icons in enterprise views (sidebar, topbar)
