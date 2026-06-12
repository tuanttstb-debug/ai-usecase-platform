# PROJECT STATE

**Last updated:** 2026-06-08
**Version:** 3.10.2

---

## Architecture Overview

### Pages & Routes
| URL | File | Auth | Description |
|-----|------|------|-------------|
| `/login.html` | `login.html` | Public | Login page — email only |
| `/index.html` | `index.html` | User+ | Portal home (service cards) |
| `/register.html` | `register.html` | User+ | Wizard 4-step (moved from index.html) |
| `/dashboard.html` | `dashboard.html` | Admin only | Dashboard + approval |

### Auth Flow
```
Any page → AuthService.requireAuth()
  → not logged in → login.html?return=<page>
  → login form submit → AuthService.login(email)
    → role = 'admin' if email in APP_CONFIG.ADMIN_EMAILS
    → role = 'user' otherwise
    → store to sessionStorage['ai_user_session']
  → redirect to return URL or index.html

dashboard.html → AuthService.requireAdmin()
  → not logged in → login.html
  → logged in but not admin → index.html
  → admin confirmed → show dashboard
```

### Session Storage Keys
| Key | Type | Owner | Notes |
|-----|------|-------|-------|
| `ai_user_session` | JSON object | `auth.js` | `{email, displayName, role, loginAt}` |
| `ai_admin_email` | string | legacy + `auth.js` | Written for dashboard.js backward compat |

### Script Load Order (register.html)
```
env.js → auth.js → [auth guard inline] → routes.js → constants.js
→ helpers.js → storage.js → api.js → validation.js → toast.js
→ duplicate-check.js → form-mapper.js → wizard.js → app.js
```

### Script Load Order (dashboard.html)
```
env.js → auth.js → routes.js → api.js → dashboard.js
```

### Script Load Order (index.html / portal)
```
env.js → auth.js → [inline portal script]
```

---

## Frontend — ✅ Hoàn chỉnh

| Area | Status | Notes |
|---|---|---|
| Login page | ✅ | Username-based (no email validation), `type="text"`; URL redirect fix v3.6.1 |
| Portal home | ✅ | Sidebar layout, SVG icons, same shell as dashboard |
| Register/Wizard | ✅ | Sidebar layout; auto-fill Owner_Name (editable); Owner_Email ẩn — inject silent; UseCase_ID fetched fresh tại submit time (v3.6.3); special chars fully handled (v3.7.0); timeout 45s + smart recovery (v3.7.1); HTTP 400 Prompt_Context fix (v3.7.2) |
| AuthService | ✅ | Username login; no regex; `ADMIN_EMAILS` = username list |
| Auth guard | ✅ | All pages redirect to login if not authenticated |
| Auth logout | ✅ | Sidebar logout button trên tất cả pages |
| Backward compat `?edit=` | ✅ | `index.html` redirects `?edit=` → `register.html` |
| Wizard 4-step | ✅ | `register.html` |
| Auto-fill owner fields | ✅ | Owner_Name auto-fill (editable); Owner_Email hidden + silent inject khi submit |
| Unique UseCase ID | ✅ | v3.6.3 — ID fetched fresh tại submit; GAS `_assignUseCaseId_()` validate trong lock; fallback generate nếu collision |
| Dashboard (admin) | ✅ | Auto-load tất cả tabs khi login; approve/reject confirmed working |
| Dashboard (user) | ✅ | My Cases + Khám phá tabs |
| My US feature | ✅ | Tab trong dashboard; case-insensitive filter, cross-compare owner_name/email |
| Explore (Khám phá) | ✅ | NEW v3.3 — All approved UCs from org; searchable; all users |
| US Detail popup | ✅ | 4-section view; progressive load; approve/reject inline; Copy Prompt button |
| Drill-down list popup | ✅ | NEW v3.5 — Click KPI cards / chart segments/bars → popup bảng lọc → Chi tiết |
| recentTable Chi tiết | ✅ | NEW v3.5 — Nút Chi tiết đồng bộ với các bảng khác |
| Filter tab Tất cả | ✅ | NEW v3.6 — Multi-select status pills + team dropdown + search kết hợp + count badge |
| Box Từ chối | ✅ | NEW v3.6 — Rejected card trong tab Tổng quan; preview 5 + Xem tất cả; Chi tiết đầy đủ |
| Copy Prompt | ✅ | NEW v3.3 — 8 prompt fields → clipboard; hiện sau khi full data load |
| Approval flow | ✅ | Confirmed working; confirm button re-enable fix v3.6.2 |
| Auto-load on startup | ✅ | NEW v3.3 — _loadStartupData() thay lazy tab-click loading |
| TPBank sidebar UI | ✅ | Tất cả pages dùng sidebar — consistent layout |
| Heroicons SVG | ✅ | Tất cả emoji → SVG inline (dashboard, register, index) |
| Chart.js charts | ✅ | doughnut + stacked horizontal bar (Team & Category); CSS fallback nếu CDN fail |
| Stacked breakdown charts | ✅ | NEW v3.8.0 — Team & Category bars phân tách màu theo trạng thái UC; click segment → popup lọc đúng group + status |
| KPI & Tiến độ tab | ✅ | v3.10.2 — Week nav ‹/› xem lại tuần trước; chỉ đếm Approved UCs; `KPI_EXCLUDED_USERS` loại directors (cuongvm1); render ngay không chờ getUsers(); 15/15 Playwright PASS |
| User management | ✅ | NEW v3.10.0 — Sheet USERS trong GAS; case-insensitive (normalizeUser_); login async validates GAS; admin tab quản lý users; sync từ MASTER_DATA |
| KPI week date format | ✅ | fix `91c4a00` — manual `DD/MM` formatter thay `toLocaleDateString` (locale inconsistency trên Chromium/Windows) |
| Responsive | ✅ | Sidebar collapse 1024px áp dụng toàn bộ pages |

## Backend (GAS) — ⚠️ Partial

**Active deployment URL:** `AKfycbwe0eo3X3KWxGdJ8ZWLjAgx3FVvcSOxTA5KVJGYVV3_Skbn0eXAVouzKaZOgDaDcUupew`
**OAuth:** ✅ Authorized | **GAS code sync:** ⚠️ Local fixes chưa deploy — chưa tìm được đúng GAS project (GAS-MYSTERY-01)

**Pending deploy (7 files):**

| File | Thay đổi chính | Version |
|---|---|---|
| `UserService.gs` | **NEW** — USERS sheet, normalizeUser_(), validateUserLogin_(), syncUsersFromMasterData_() | v3.10.0 |
| `Code.gs` | Routes next-id + 5 user endpoints | v3.10.0 |
| `Config.gs` | SHEETS.USERS + USERS_HEADERS + usernames ADMIN_EMAILS | v3.10.0 |
| `Utils.gs` | sanitizeStr_ + toSheetValue_() + findRowByField_() + USERS case | v3.10.0 |
| `UseCaseService.gs` | _assignUseCaseId_() + single-read update + JSON_Backup cap | v3.7.1 |
| `LookupService.gs` | Rewrite hoàn toàn | v2.x |
| `DashboardService.gs` | record_id + status + owner_name trong recent_submissions | v3.5.1 |

**Sau khi deploy:** Chạy `?action=user-init&admin_email=tuantt4` → Dashboard → tab Người dùng → Đồng bộ từ UC

| Feature | Status | Notes |
|---|---|---|
| createUseCase | ✅ | Live |
| getUseCase | ✅ | Live |
| updateUseCase | ✅ | Live |
| listUseCases | ✅ | Live |
| approveUseCase | ✅ | Confirmed working |
| rejectUseCase | ✅ | Confirmed working |
| duplicateCheck | ✅ | Live |
| lookupData | ✅ | Live |
| dashboard API | ✅ | Live |
| user-login / users / user-upsert / user-sync | ⏳ | Code ready locally, chưa deploy (GAS-MYSTERY-01) |
| Authentication | ❌ | Username-based FE only, no real auth (SEC-01) |

## Auth Architecture Notes (v3.10)
- **Login:** Async — gọi GAS `?action=user-login` lấy role từ USERS sheet; fallback về local nếu GAS offline
- **Role resolution priority:** USERS sheet (Active=TRUE) → `APP_CONFIG.ADMIN_EMAILS` (local fallback khi offline)
- **Admin list:** GAS USERS sheet (Role=admin) → `Config.gs` ADMIN_EMAILS → `config/env.js` ADMIN_EMAILS
- **Session:** sessionStorage `ai_user_session` = `{email: username, displayName, role, team, loginAt}`
- **Dashboard access:** All logged-in users → dashboard.html; admin sees full tabs + Users tab, user sees My/Explore/KPI
- **Owner fields:** Auto-filled from session on register; readonly after fill
- **CAVEAT:** Khi GAS offline, fallback local không check `Active=FALSE` → deactivated user vẫn login được (USER-OFFLINE-01 in TECH_DEBT)

## Data Layer — ✅ Unchanged
Google Sheets structure unchanged. API contract (field names) unchanged. localStorage key unchanged.

## CSS Design System (v3.0.0)

**Primary:** `#7B2CBF` (purple) — Google Blue eliminated  
**Sidebar gradient:** `linear-gradient(180deg, #7B2CBF 0%, #6622B4 100%)`  
**Card radius:** 20px | **Button/Input radius:** 12px | **Shadow:** `0 2px 10px rgba(0,0,0,.03)`

Key tokens (all in `variables.css`):
```
--color-primary:         #7B2CBF
--sidebar-gradient:      linear-gradient(180deg, #7B2CBF 0%, #6622B4 100%)
--color-bg:              #F5F5F7
--color-surface:         #FFFFFF
--color-border:          #E9E9EF
--color-text:            #1F1F2C
--color-text-secondary:  #6D6D7A
--color-text-muted:      #A4A4B2
--radius-md:             12px   (buttons, inputs)
--radius-xl:             20px   (cards, modals)
--shadow-card:           0 2px 10px rgba(0,0,0,.03)
--sidebar-width:         252px
```

## Layout Architecture (v3.0.0)
| Page | Layout | Sidebar |
|---|---|---|
| `dashboard.html` | `.app-layout` → sidebar + topbar | ✅ Yes (252px purple) |
| `index.html` | `.portal-header` + `.portal-main` | ❌ Top-header only |
| `register.html` | `.app-header` + `.app-container` | ❌ Top-header only |
| `login.html` | `.login-page` centered card | ❌ Auth page |

Sidebar collapses at **1024px** (off-canvas, `.is-open` toggle).

## Design Docs (new in v3.0)
- `DESIGN_TOKENS.md` — all token values
- `DESIGN_SYSTEM.md` — component HTML patterns + CSS architecture
- `UIUX_SYSTEM.md` — design philosophy, anti-patterns
- `LAYOUT_SYSTEM.md` — layout diagram + spacing rules
- `THEME_ARCHITECTURE.md` — token inheritance model, dark mode readiness
- `RESPONSIVE_GUIDE.md` — breakpoint table + sidebar behavior
- `COMPONENT_GUIDELINES.md` — copy-paste patterns for each component
- `CHANGELOG_UI_REFACTOR.md` — full delta of this refactor
