# SESSION HANDOVER

## Session: 2026-05-28
**Scope:** UI/UX Refactor v2.0.0-ui — thiết kế, lập kế hoạch và implement

---

## Đã hoàn thành
- Phân tích toàn bộ codebase → viết `UI_UX_REVIEW.md`, `UI_REFACTOR_PLAN.md`
- Implement 27 UX improvements (chi tiết xem `CHANGELOG_UI.md`)
- Fix bugs: BUG-01, BUG-02, BUG-05, BUG-06, SMELL-05
- Resolve maintainability: MAINT-03, MAINT-04, MAINT-05, MAINT-06
- Tạo CSS mới: `typography.css`, `forms.css`, `states.css`
- Thêm `FIELD_CONFIG` + `GROUP_CONFIG` vào `constants.js`
- Rebuild `FieldBuilder` trong `wizard.js` dùng FIELD_CONFIG
- Fix execution order trong `app.js` (Wizard.init → populateData)
- Thay `confirm()` bằng inline draft banner

## Deferred (chủ động bỏ qua)
- BUG-03 (Status luôn là Draft) — cần xác nhận với PO
- BUG-04 (validateUpdate_ không được gọi) — GAS backend, 5-min fix
- SEC-01/02/03, PERF-01/02/03 — ngoài scope refactor UI
- Dashboard UI, Approval workflow — SPRINT 4

---

## Session: 2026-05-28 (Part 2)
**Scope:** Phase 1–5 audit + fix data loading + Dashboard + Approval feature

## Đã hoàn thành
- **Phase 1 audit:** Tìm ra 3 bugs mới (BUG-A, BUG-B, BUG-C) qua phân tích toàn bộ data flow
- **BUG-A fixed:** Checkbox groups không rebuild được sau lookup load
- **BUG-B fixed:** Race condition edit mode — `_pendingEditData` pattern
- **BUG-C fixed:** `Current_Stage` bị overwrite bởi `Status` trong GAS
- **BUG-04 confirmed resolved:** `validateUpdate_()` đã được gọi
- **New endpoints:** `list`, `approve`, `reject`
- **AdminService.gs (new):** Admin email validation, approve/reject/list
- **dashboard.html + dashboard.js + dashboard.css (new):** KPI, charts, approval flow

---

## Session: 2026-05-28 (Part 3)
**Scope:** Login feature + Portal home refactor (TPBank BIZ-inspired) + Auth integration  
**Version:** v2.2.0

---

### Files created
| File | Mô tả |
|------|-------|
| `login.html` | Login page — clean purple card, email-only |
| `register.html` | Wizard form (di chuyển từ `index.html`) + auth guard |
| `assets/js/auth.js` | AuthService — IIFE, session-based, role-aware |
| `assets/css/login.css` | Login page styles (purple gradient card) |
| `assets/css/portal.css` | Portal home styles (TPBank BIZ-inspired) |

### Files modified
| File | Thay đổi |
|------|---------|
| `index.html` | Refactored → portal home với service cards, data-driven, role-based |
| `config/env.js` | Thêm `USER_SESSION_KEY: 'ai_user_session'` |
| `assets/css/variables.css` | Thêm purple palette + accent + portal layout tokens |
| `dashboard.html` | Thêm `auth.js`, update logout, thêm "Trang chủ" nav, fix register link |
| `assets/js/dashboard.js` | AuthService integration (init, logout, gate form) với fallback cũ |

### Decisions chốt
1. **Wizard moved to `register.html`** — `index.html` là portal home, minimal invasive với tất cả wizard code không đổi
2. **Backward compat `?edit=`** — `index.html` redirect `?edit=...` sang `register.html?edit=...`
3. **AuthService = IIFE pattern** — consistent với codebase hiện tại, không cần bundler
4. **Email-only login** — no password, keep current behavior, role từ `ADMIN_EMAILS` list
5. **Dual session keys** — `ai_user_session` (new) + `ai_admin_email` (legacy, written by AuthService cho backward compat)
6. **dashboard.js fallback** — nếu `auth.js` không load, dashboard.js fallback về legacy gate

### Risks
- **SEC-01 vẫn tồn tại:** Email tự nhập, không có real auth. Người biết email admin vẫn có thể dùng gate.
- **No password:** Login bằng email bất kỳ → production cần Google OAuth hoặc domain restriction
- **Session là sessionStorage** → clear khi đóng tab (intentional, dùng cho browser sessions)

### Open issues
- BUG-03 (Status="Draft") vẫn pending PO confirmation
- GAS chưa deploy với code approve/reject
- `login.html` cần được serve qua HTTP (không phải file://) để sessionStorage hoạt động cross-page

---

## Recommended next actions
1. **[P0] Test login flow:** Mở qua local server → `login.html` → nhập email → redirect portal
2. **[P0] Test portal:** service cards render đúng theo role (user vs admin)
3. **[P0] Deploy GAS** với AdminService.gs để approve/reject live
4. **[P1] Update `ADMIN_EMAILS`** trong `config/env.js` với email thật
5. **[P2] Nâng cấp auth:** Google OAuth (`google.accounts.oauth2`) để xác thực email thật

---

## Session: 2026-05-29
**Scope:** TPBank BIZ Full UI/UX Refactor — v3.0 design system

### Decisions chốt
1. **Primary color = Purple `#7B2CBF`** — Google Blue (#1a73e8) bị loại bỏ hoàn toàn
2. **Sidebar gradient token** → `--sidebar-gradient: linear-gradient(180deg,#7B2CBF 0%,#6622B4 100%)` — dùng chung cho sidebar, tất cả purple headers
3. **Card radius = 20px (`--radius-xl`)**, Button/Input radius = 12px (`--radius-md`)
4. **Shadow rule:** `0 2px 10px rgba(0,0,0,.03)` — không heavy shadow
5. **`dashboard.html`** là trang duy nhất có sidebar layout. Portal/register dùng top-header.
6. **Sidebar collapse:** trigger tại 1024px, dùng `.is-open` class + `.sidebar-overlay`
7. **Status badge colors** cập nhật theo semantic palette: Submitted=purple, Approved=green, Warning=amber, Error=red

### Files modified (CSS)
| File | Delta |
|---|---|
| `variables.css` | Complete rewrite — TPBank BIZ token system |
| `layout.css` | Added full sidebar + topbar architecture |
| `components.css` | Purple-first buttons, cards, modals, toasts |
| `forms.css` | Purple focus rings, 12px radius, styled radio pills |
| `wizard.css` | TPBank stepper: green ring active, green ✓ done |
| `dashboard.css` | Top-accent KPI cards, purple tabs |
| `login.css` | Uses `--sidebar-gradient` token |
| `portal.css` | Updated tokens, spacious rows |
| `responsive.css` | Sidebar collapse at 1024px |
| `states.css` | Trimmed — removed duplicated success/banner blocks |

### Files modified (HTML/JS)
| File | Delta |
|---|---|
| `dashboard.html` | Full enterprise sidebar + topbar layout |
| `dashboard.js` | `populateSidebarUser()` added; removed `headerAdminActions`; TPBank status colors |

### New docs created
`DESIGN_TOKENS.md`, `DESIGN_SYSTEM.md`, `UIUX_SYSTEM.md`, `LAYOUT_SYSTEM.md`, `THEME_ARCHITECTURE.md`, `RESPONSIVE_GUIDE.md`, `COMPONENT_GUIDELINES.md`, `CHANGELOG_UI_REFACTOR.md`

### Open issues (không blocking)
- ~~`register.html` / `index.html` chưa có sidebar~~ → **Fixed in Part 3**

---

## Session: 2026-05-29 (Part 2)
**Scope:** P5 UI Polish — SVG icons + Chart.js integration

### Decisions chốt
1. **SVG icon library = Heroicons 2.0** (inline, MIT license, không cần CDN)
2. **Chart.js 4.4.4** qua jsDelivr CDN, load trước `dashboard.js`
3. **statusChart** → doughnut chart (`aspectRatio: 1.6`, legend bottom, tooltip % breakdown)
4. **teamChart / categoryChart** → horizontal bar (`indexAxis: 'y'`, purple fill, no legend)
5. **Fallback CSS charts** vẫn giữ — tự động kích hoạt nếu Chart.js CDN không load
6. **KPI icons màu semantic**: total=purple, approved=green, pending=amber, hours=blue (via `currentColor`)

### Files modified
| File | Delta |
|---|---|
| `dashboard.html` | Toàn bộ emoji → Heroicons SVG inline; canvas cho 3 charts; Chart.js CDN |
| `dashboard.js` | `_charts` state; `renderStatusChart` → doughnut; `renderBreakdownChart` → hbar; CSS fallbacks giữ nguyên |
| `assets/css/dashboard.css` | `.chart-container canvas { display:block; max-width:100% }`; `.kpi-icon` + `.admin-gate-icon` thêm `color` token |

### Icons thay thế
| Vị trí | Emoji cũ | Heroicons mới |
|---|---|---|
| Brand logo | 🚀 | sparkles |
| Nav Dashboard | 📊 | chart-bar-square |
| Nav Register | ➕ | document-plus |
| Nav My cases | 📋 | clipboard-document-list |
| Nav Home | 🏠 | home |
| Logout | ⏻ | arrow-right-on-rectangle |
| Topbar toggle | ☰ | bars-3 |
| Topbar refresh | ↻ | arrow-path |
| Admin gate | 🔐 | lock-closed |
| KPI Total | 📊 | chart-bar-square |
| KPI Approved | ✅ | check-circle |
| KPI Pending | ⏳ | clock |
| KPI Hours | ⏱️ | bolt |

---

## Session: 2026-05-29 (Part 3)
**Scope:** Layout unification + My US + Auto-fill + Username login + Approval popup

### Decisions chốt
1. **Sidebar trên tất cả pages** — `register.html`, `index.html` rebuild dùng `.app-layout` giống `dashboard.html`
2. **Dashboard open cho mọi user** — Admin: 4 tabs + KPI. Regular user: chỉ "Use Case của tôi" tab
3. **Username-based login** — không validate định dạng email; `ADMIN_EMAILS` chứa usernames (`['admin','tuantt4','manager']`)
4. **Auto-fill Owner_Name/Owner_Email từ session** — readonly sau khi fill; không fill ở edit mode
5. **Owner_Email field** đổi type `'email'` → `'text'`, label → "Mã người đăng ký"
6. **US Detail modal** — `.modal-card--wide` (720px), show all fields, approve/reject inline (không mở modal thứ 2)
7. **UC cache pattern** — tránh `JSON.stringify` trong onclick attribute (XSS/syntax risk); dùng `_ucCache[key]` + `Dashboard._byKey(key)`
8. **My US filter** — client-side: `owner_name === user.displayName || owner_email === user.email`
9. **"Use Case của tôi" nav** — active khi tab=my; Dashboard nav active khi các tab admin khác

### Files modified
| File | Delta |
|---|---|
| `config/env.js` | ADMIN_EMAILS = usernames array |
| `assets/js/auth.js` | Xóa email regex validation; `_buildDisplayName` hỗ trợ username |
| `login.html` | `type="text"`, label "Tên đăng nhập", placeholder username |
| `assets/js/constants.js` | `Owner_Email.type` → `'text'`; label → "Mã người đăng ký" |
| `assets/js/app.js` | `_autoFillOwner()` after Wizard.init(); readonly lock |
| `register.html` | Full rewrite → sidebar layout; Dashboard nav ẩn với non-admin |
| `index.html` | Full rewrite → sidebar layout; SVG icons trong service cards |
| `assets/css/portal.css` | `.app-content > .portal-main { padding: 0 }` tránh double-padding |
| `assets/css/components.css` | `.modal-card--wide` + `.modal-card--wide .modal-body` |
| `dashboard.html` | My US tab; KPI row hidden khi non-admin; detail modal; remove admin gate UI |
| `assets/js/dashboard.js` | Full rewrite: role-based UI, My Cases load/render, detail popup, approval in popup, cache pattern |

### Open issues
- **My US filter** dùng client-side — nếu Owner_Name/Email không khớp chính xác sẽ miss cases cũ (submit trước khi có feature này)
- **GAS deploy** vẫn chưa xong — approve/reject API endpoints cần deploy mới có tác dụng
- **BUG-03** (Status="Draft") vẫn pending PO confirm
- `portal.css` vẫn còn references tới `.portal-header` (responsive) — harmless, nhưng cần cleanup sau

---

## Session: 2026-05-29 (Part 4)
**Scope:** Bug fixes — URL redirect, Owner_Email field, dropdown cleanup, GAS validation, My US filter

### Files modified (Frontend)
| File | Delta |
|---|---|
| `assets/js/auth.js` | `requireAuth()`: dùng `pathname.split('/').filter(Boolean).pop()` thay vì full pathname → fix URL duplicate trên GitHub Pages subdirectory |
| `assets/js/app.js` | Xóa `readOnly` lock trên Owner fields; xóa `Owner_Email` khỏi `FormMapper.populateData`; inject `data.Owner_Email = user.email` silent trong `submitForm()` trước khi validate |
| `assets/js/validation.js` | Xóa check `OWNER_EMAIL` (required + regex) khỏi `step1()`; xóa `'Mã người đăng ký'` khỏi `markErrors` map |
| `assets/js/constants.js` | Xóa `FIELDS.OWNER_EMAIL` khỏi `STEPS[0].fields`; xóa toàn bộ block `Owner_Email` khỏi `FIELD_CONFIG` |
| `assets/js/dashboard.js` | `_loadMyUseCases()`: cross-compare 4 chiều + `.trim()` — match `owner_name` vs cả `displayName` và `email`, `owner_email` vs cả hai |

### Files modified (GAS Backend)
| File | Delta |
|---|---|
| `assets/gas-backend/LookupService.gs` | Rewrite hoàn toàn — xóa `findColIndex_()`, 3 mảng ALIASES, `Status/Priority/Risk_Level/Demo_Status` khỏi LOOKUP_DEFAULTS; dùng fixed column positions (col 0/1/3); xóa Logger.log |
| `assets/gas-backend/ValidationService.gs` | Xóa email regex `@` khỏi `validateCreate_()` và `validateUpdate_()` |
| `assets/gas-backend/Utils.gs` | Xóa toàn bộ `output.addHeader(...)` trong `sendJson_()` — GAS không hỗ trợ method này |

### Decisions chốt
1. **Owner_Email ẩn hoàn toàn khỏi UI** — field không render, không validate, inject silent từ session trong `submitForm()` để GAS vẫn nhận được
2. **Email validation bị xóa cả FE lẫn BE** — `ValidationService.gs` không còn regex `@` check; field lưu username không phải email
3. **User_Type**: xóa `'Toàn công ty'` → còn `['Cá nhân', 'Team', 'TT SPTD']`
4. **Business_Category**: xóa `'Thanh toán'`, `'Nhân sự'`, `'CNTT'` → còn `['Tín dụng', 'Vận hành', 'Khách hàng', 'Tuân thủ', 'Khác']`
5. **`sendJson_` không dùng addHeader** — GAS infrastructure tự xử lý CORS; addHeader không tồn tại trên TextOutput object

### Open issues (Part 4)
- **[BUG-GAS-01] GAS data loading lỗi** — `?action=health` OK nhưng `?action=lookup` / `?action=list` không load được. Root cause chưa xác định. Cần: paste exact error message từ toast hoặc GAS Executions log
- **[BUG-FE-01] auth.js chưa push GitHub** — fix URL duplicate đã đúng trong local nhưng GitHub Pages vẫn phục vụ code cũ
- **Utils.gs** fix addHeader cần deploy lên GAS

---

## Session: 2026-06-02
**Scope:** Full UC detail view before approval + GAS permission fix + full flow test
**Commits:** `afd1933` (feat), `0b8c7a0` (fix) — merged vào `main`

### Đã hoàn thành

- **[BUG-FE-01] Verified closed** — auth.js URL fix đã có trên GitHub từ trước, handover cũ ghi sai trạng thái
- **Full flow test (Playwright)** — 17/18 pass; 1 false positive (test dùng `tuantt4` là admin nhưng assume là user thường); UI role-based hoạt động đúng
- **FEAT: Xem chi tiết UC trước khi duyệt** — rebuild modal thành 4 section theo wizard steps; progressive fetch: mở ngay với list data → background fetch `getUseCase` → re-render full data khi GAS trả về
- **FIX: GAS `ADMIN_EMAILS` mismatch** — `Config.gs` cũ dùng email (`admin@sptd.vn`); auth đã chuyển sang username → fix thành `['admin', 'tuantt4', 'manager']`

### Files changed
| File | Delta |
|---|---|
| `assets/js/dashboard.js` | +180 lines: `openDetail` gọi `_fetchFullDetail`; thêm `_fetchFullDetail`, `_normalizeFullData`; rewrite `_renderDetailBody` (4 sections); helpers `_dsection`, `_dsubsec`, `_dgrid`, `_dfield` |
| `assets/css/dashboard.css` | +96 lines: detail section styles — step badges, 2-col grid, pre-wrap values, subsection, wide-modal padding reset |
| `assets/gas-backend/Config.gs` | Line 111: `ADMIN_EMAILS = ['admin', 'tuantt4', 'manager']` (usernames, không phải emails) |

### Decisions chốt
1. **Modal progressive load** — hiện ngay với list data (12 fields), fetch full data từ GAS ngầm. Nếu GAS lỗi, partial view vẫn hữu ích; không show error toast để tránh nhiễu
2. **Sections tự ẩn nếu empty** — Sections 2/3/4 không render khi không có data → clean với data cũ hoặc khi GAS chưa deploy
3. **`_normalizeFullData`** — normalize PascalCase từ `getUseCase` response về snake_case dùng chung
4. **ADMIN_EMAILS dùng username** — nhất quán với auth system, không dùng email format

### Blockers hiện tại
- **[BUG-GAS-02] NEW — GAS new deployment chưa authorize**: Khi deploy GAS Web App mới, cần chạy thủ công 1 hàm trong GAS Editor để grant OAuth → Sheets access. Chưa làm → create/submit bị "không có quyền"
- **[BUG-GAS-03] NEW — CONFIG sheet override `Config.gs`**: `getAdminEmails_()` đọc CONFIG sheet row `ADMIN_EMAILS` trước khi fallback về `Config.gs`. Nếu sheet còn giá trị `admin@sptd.vn,manager@sptd.vn` thì fix `Config.gs` bị vô hiệu → phải update cell trong sheet thành `admin,tuantt4,manager`
- **[BUG-GAS-01] vẫn open** — root cause lookup/list loading chưa xác định

### Regression risks
- `_renderDetailBody` rewrite hoàn toàn — field keys từ `listUseCases` (`uc.pain_point`, `uc.team`...) phải khớp với `_dgrid`/`_dfield` calls. Verify với GAS data thật sau khi authorize
- `openDetail` gọi `Api.getUseCase(record_id)` mỗi lần mở modal — 1 JSONP request thêm/lần; acceptable nhưng cần monitor nếu GAS có rate limit

---

## Session: 2026-06-02 (Part 2)
**Scope:** Root cause diagnosis — data loading failure + URL fix
**Commits:** `b265ebe` (fix URL + resolve merge conflict)

### Đã hoàn thành

- **[BUG-GAS-01] ROOT CAUSE XÁC ĐỊNH + CLOSED** — Phân tích toàn bộ git history `config/env.js` (7 URL khác nhau trong 35 phút). Root cause: commit `a76bd9f` nhập URL không tồn tại (`AKfycbx8b7h...`) khi cố revert — không khớp với bất kỳ deployment nào trong GAS.
- **[BUG-GAS-02] CLOSED** — User đã authorize OAuth cho deployment hiện tại. Link đang hoạt động.
- **`env.js` cố định tại URL working**: `AKfycbyaM1dQcCZYHNam3zb6UrwP5Qf8BnsJr1XzjPUuGqla-k2WCAI5llLllIhadU7mfBfP`
- **Quy trình deploy chuẩn documented** trong `TODO_NEXT.md` — ngăn tái phát

### Timeline sự cố hôm nay (để tham khảo)

| Thời gian | Hành động | Kết quả |
|---|---|---|
| Trước 15:00 | URL gốc `AKfycbwe0eo3X3KW...` | ✅ Hoạt động |
| 15:00 | Deploy mới → URL `AKfycbzaMcZAEPa...` | ❌ Chưa auth OAuth |
| 15:13 | Deploy mới → URL `AKfycbz4TmB4Ds...` | ❌ Chưa auth OAuth |
| 15:15 | "Revert" → URL `AKfycbx8b7hdBNc...` | ❌ URL không tồn tại |
| 15:3x | Deploy mới → URL `AKfycbwVGwFLjq...` | ❌ Chưa auth OAuth |
| 15:35 | Deploy mới → URL `AKfycbyaM1dQcC...` → **authorize** | ✅ **Hoạt động** |

### Root cause pattern
Khi tạo "New Deployment" trong GAS: URL thay đổi + cần authorize OAuth lại. Giải pháp lâu dài: luôn dùng "Edit deployment → New version" thay vì "New Deployment" để giữ URL cố định.

### Blockers còn lại
- **[BUG-GAS-03]** CONFIG sheet `ADMIN_EMAILS` cần update → ảnh hưởng approve/reject
- **P0** GAS code sync: `Config.gs`, `Utils.gs`, `LookupService.gs` local fixes chưa vào GAS Editor
