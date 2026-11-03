# Design Tokens — TPBank BIZ System

> ⚠️ **ĐÃ THAY bằng UI/UX v2 (v4 token, 2026-11-03).** Nguồn chuẩn hiện tại:
> - Gu (màu, phông, dials): `design-system/ai-use-case-platform/MASTER.md` · phương án + 4 đợt: `design-system/ai-use-case-platform/PHUONG_AN_VA_KE_HOACH.md`
> - Token: `assets/css/variables.css` — primary xanh `#1D4ED8`, chữ/viền slate, hổ phách `--color-accent` CHỈ để nhấn "cần chú ý", nút chính = `.btn-primary` (xanh), phông Fira Sans/Fira Code (có tiếng Việt), chữ thân 14px, nhỏ nhất 12px
> - Khung: sidebar sáng (thu gọn desktop `.app-layout.is-collapsed` · trượt ngang ≤1024px) · trang trong `.app-content` dùng `.app-container.view-wrap` (1200px) / `--narrow` (960px), không style inline max-width/padding
> - Điện thoại: tab cuộn trong khung (`.dash-tabs`/`.lb-tabs`/`.tab-nav`) · bảng chỉ-đọc ≥5 cột tự thành thẻ ≤640px (`shell.js` gắn `.is-stacked` + `data-label`; bảng không muốn xếp thẻ → `data-no-stack`) · nút/ô nhập ≥40px
> - Biểu tượng: Font Awesome 6 / SVG — **không emoji**. Màu dữ liệu trong JS dùng bảng v4 (xanh `#15803D` · vàng `#B45309` · đỏ `#B91C1C` · tím `#6D28D9` = Xuất sắc)
> - Bộ lọc theo người: chuẩn Team + Nhân sự (`people-filter.js`). Kiểm cuối: `/design-review` (hub AIOS)
>
> Phần dưới là tài liệu hệ cũ (tím-cam SHTD), giữ để tra lịch sử.


> Source of truth: `assets/css/variables.css`

---

## Color Tokens

### Brand Purple
| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#7B2CBF` | Primary actions, active states |
| `--color-primary-dark` | `#6F2DBD` | Hover state for primary |
| `--color-primary-darker` | `#5A1E9A` | Deep purple, pressed state |
| `--color-primary-mid` | `#8E44EC` | Gradient end |
| `--color-primary-light` | `#EDE9FE` | Pill selected BG, badge BG |
| `--color-primary-surface` | `#F5F0FF` | Card hover, section background |

### Sidebar Gradient
```css
--sidebar-gradient: linear-gradient(180deg, #7B2CBF 0%, #6622B4 100%);
```
Used on: `.app-sidebar`, `.portal-header`, `.login-header`, `.login-card-top`, `.app-header`

### Semantic Colors
| Token | Value | Usage |
|---|---|---|
| `--color-success` | `#4CAF50` | Approved, done states |
| `--color-success-light` | `#E8F5E9` | Success badge background |
| `--color-warning` | `#F6B100` | Pending, caution |
| `--color-warning-light` | `#FFF8E1` | Warning badge background |
| `--color-error` | `#F44336` | Danger, rejected, errors |
| `--color-error-light` | `#FFEBEE` | Error badge background |
| `--color-info` | `#2196F3` | Informational |

### Neutral Palette
| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#F5F5F7` | Page background |
| `--color-bg-alt` | `#FAFAFC` | Secondary surface, meta bars |
| `--color-surface` | `#FFFFFF` | Cards, inputs, modals |
| `--color-border` | `#E9E9EF` | Card borders, dividers |
| `--color-border-focus` | `#7B2CBF` | Focus ring color |
| `--color-overlay` | `rgba(31,31,44,0.04)` | Hover overlay on surfaces |

### Text
| Token | Value | Usage |
|---|---|---|
| `--color-text` | `#1F1F2C` | Primary text |
| `--color-text-secondary` | `#6D6D7A` | Labels, secondary text |
| `--color-text-muted` | `#A4A4B2` | Placeholders, metadata |
| `--color-text-inverse` | `#FFFFFF` | Text on dark surfaces |

### Sidebar Tokens
| Token | Value |
|---|---|
| `--sidebar-text` | `rgba(255,255,255,0.85)` |
| `--sidebar-text-active` | `#FFFFFF` |
| `--sidebar-text-muted` | `rgba(255,255,255,0.5)` |
| `--sidebar-item-hover` | `rgba(255,255,255,0.10)` |
| `--sidebar-item-active` | `rgba(255,255,255,0.18)` |
| `--sidebar-border` | `rgba(255,255,255,0.12)` |

---

## Typography Tokens

**Font:** `Inter` (Google Fonts)

### Scale
| Token | px | Usage |
|---|---|---|
| `--text-xs` | 11px | Captions, labels, badges |
| `--text-sm` | 13px | Secondary text, form labels |
| `--text-base` | 15px | Body text, nav items |
| `--text-md` | 16px | Form inputs (iOS zoom prevention) |
| `--text-lg` | 18px | Card titles |
| `--text-xl` | 20px | Topbar title, section headers |
| `--text-2xl` | 22px | Sub-page titles |
| `--text-3xl` | 28px | Page titles, KPI values |
| `--text-4xl` | 32px | Hero headings |

### Weights
| Token | Value |
|---|---|
| `--font-weight-regular` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |

### Hierarchy Rule
- Page Title: `text-3xl / bold`
- Section Title: `text-xl / semibold`
- Card Title: `text-lg / semibold`
- Body: `text-base / regular`
- Caption / Meta: `text-xs / medium`

---

## Spacing Tokens

Base unit: **4px**

| Token | Value | Common usage |
|---|---|---|
| `--space-1` | 4px | Icon gap, tight padding |
| `--space-2` | 8px | Badge padding, button gap |
| `--space-3` | 12px | Compact padding |
| `--space-4` | 16px | Field margin, list item padding |
| `--space-5` | 20px | Card padding (compact) |
| `--space-6` | 24px | Card padding (default), section gap |
| `--space-7` | 28px | — |
| `--space-8` | 32px | Content padding, large card |
| `--space-10` | 40px | Empty state padding |
| `--space-12` | 48px | Auth card top padding |
| `--space-16` | 64px | Page bottom margin |
| `--space-20` | 80px | Large page margin |

**Card padding rule:** `var(--space-6)` (24px) default, `var(--space-8)` (32px) for auth gates.

---

## Border Radius Tokens

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Badges, tab highlight |
| `--radius-md` | 12px | **Inputs, Buttons (primary)** |
| `--radius-lg` | 16px | — |
| `--radius-xl` | 20px | **Cards, modals, auth gates** |
| `--radius-2xl` | 24px | — |
| `--radius-full` | 9999px | Pills, avatars, search bar |

---

## Shadow Tokens

| Token | Value | Usage |
|---|---|---|
| `--shadow-xs` | `0 1px 4px rgba(0,0,0,.04)` | Subtle lift |
| `--shadow-sm` | `0 2px 10px rgba(0,0,0,.03)` | **Default card shadow** |
| `--shadow-md` | `0 4px 20px rgba(0,0,0,.05)` | Hover state cards |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,.08)` | Modals, toasts |
| `--shadow-card` | same as `shadow-sm` | Cards system-wide |

**Rule:** No heavy shadows. All cards use `shadow-card = 0 2px 10px rgba(0,0,0,.03)`.

---

## Layout Tokens

| Token | Value |
|---|---|
| `--sidebar-width` | 252px |
| `--sidebar-collapsed` | 72px |
| `--topbar-height` | 64px |
| `--header-height` | 64px |
| `--content-max-width` | 1280px |
| `--portal-max-width` | 800px |
| `--max-width` | 760px (wizard/form pages) |

---

## Z-index Scale

| Token | Value | Layer |
|---|---|---|
| `--z-base` | 1 | Normal content |
| `--z-dropdown` | 10 | Dropdowns |
| `--z-sticky` | 20 | Topbar |
| `--z-sidebar` | 30 | Sidebar |
| `--z-overlay` | 100 | Loading overlay |
| `--z-modal` | 200 | Modals |
| `--z-toast` | 300 | Toast notifications |
