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

---

## Session: 2026-06-02 (Part 3)
**Scope:** Bug fixes (URL, CSS modal) + 3 new features (auto-load, explore tab, copy prompt)
**Commits:** `93a2e58` (CSS fix), `b265ebe` (URL fix), `f1530ec` (features)
**Version:** 3.3.0

### Đã hoàn thành

- **[BUG-GAS-01] CLOSED** — Root cause xác định: `env.js` trỏ URL không tồn tại (`AKfycbx8b7h...`). Đã restore URL working `AKfycbwe0eo3X3KW...`.
- **[BUG-GAS-02] CLOSED** — OAuth đã authorize cho active deployment.
- **Approve/Reject confirmed working** — User xác nhận "từ chối, duyệt thành công".
- **[BUG-CSS-01] FIXED** — Modal footer bị đẩy xuống dưới viewport khi nội dung 4-section dài. Fix: `overflow:hidden` + `min-height:0` trên `.modal-card--wide`. File: `assets/css/components.css`.
- **FEAT: Auto-load on startup** — Thay `_loadTabData(initTab)` bằng `_loadStartupData()`. Single `Promise.all([listUseCases, getDashboard])` populate tất cả tabs ngay khi `DOMContentLoaded`. Non-admin: 1 request; Admin: 2 requests.
- **FEAT: Tab "Khám phá"** — Tab mới visible tất cả users. Hiển thị use cases có status=Approved từ toàn org. Searchable theo tên/team/lĩnh vực/người đăng ký.
- **FEAT: Copy Prompt** — Nút `📋 Copy Prompt` trong footer detail modal. Hiện khi UC có data prompt (sau `_fetchFullDetail`). Ghép 8 trường thành text có `# heading`. `navigator.clipboard` với `execCommand` fallback.

### Files changed

| File | Delta |
|---|---|
| `assets/css/components.css` | +2 lines: `overflow:hidden` + `min-height:0` trên `.modal-card--wide` |
| `assets/js/dashboard.js` | +152 lines: `_loadStartupData`, `renderExploreTable`, `_bindExploreSearch`, `_hasPromptData`, `_copyPrompt`, `_fallbackCopy`; update `_bindRefresh`, `_confirmDetailAction`, `openDetail`, `_fetchFullDetail`, `_bindDetailModal` |
| `dashboard.html` | +20 lines: explore tab button + panel + copy prompt button |
| `config/env.js` | URL restored (multiple commits) |
| `ai_context/*.md` | Session docs updated |

### Decisions chốt

1. **`_loadStartupData` = single source of truth** — Cả refresh button và post-approve/reject đều gọi `_loadStartupData()`. `_pendingList` derive client-side từ `_allList` (filter Submitted/Under Review).
2. **Explore chỉ show Approved** — Regular user chỉ thấy UC đã được duyệt → cleaner UX, tránh noise từ draft/pending của người khác.
3. **Copy prompt = full text** — Ghép 8 trường với `# header` Markdown-style → paste được trực tiếp vào Claude/ChatGPT.
4. **GAS URL mystery** — URL `AKfycbwe0eo3X3KW...` hoạt động nhưng không tìm thấy trong GAS deployment history của user → có thể thuộc GAS project khác. Cần identify project để quản lý.

### Blockers còn lại

- **[GAS-MYSTERY-01]** GAS URL active không tìm thấy trong deployment history → không quản lý được, không thể update code GAS
- **[BUG-GAS-03]** STATUS UNCLEAR — approve/reject đang hoạt động nên CONFIG sheet của GAS project active có thể đã đúng. Cần verify bằng cách mở đúng GAS project và check CONFIG sheet
- **GAS code sync** — Local fixes (`Config.gs`, `Utils.gs`, `LookupService.gs`) chưa vào GAS Editor vì chưa tìm được đúng project

### Regression risks

- **`_pendingList` derive client-side**: trước đây GAS filter `filter:'pending'` — giờ filter JS từ `_allList` limit 200. Nếu >200 records total, một số pending records ở cuối list có thể không hiển thị trong tab "Chờ duyệt".
- **`_loadTabData('my')` gọi `_loadMyUseCases()`** — vẫn fetch API riêng khi user click tab My sau startup → double fetch. Harmless nhưng lãng phí 1 request.
- **Explore tab empty nếu không có Approved UC** — Khi dùng lần đầu, nếu chưa có UC nào được duyệt, tab Khám phá sẽ trống. Đây là expected behavior nhưng có thể confuse user mới.

---

## Session: 2026-06-02 (Part 4)
**Scope:** Tự động sinh UseCase_ID chống trùng + hiển thị mã dự kiến trên form
**Version:** 3.4.0

### Vấn đề gốc (root cause)
`generateUseCaseId_()` cũ chỉ dùng counter từ CONFIG sheet, không cross-check với MASTER_DATA. Nếu:
- Sheet có ID cao hơn counter (import thủ công, rollback, migration)
- Counter bị reset
→ Có thể sinh ra ID đã tồn tại.

Ngoài ra, có 1 bug tinh tế: code cũ dùng `data[j][0]` hardcoded thay vì `keyCol` index để tìm row NEXT_ID trong CONFIG sheet — hoạt động đúng trong thực tế vì cột 0 luôn là `Key`, nhưng không robust.

### Đã hoàn thành

- **[GAS] `_getAllUseCaseIds_()`** — NEW helper: đọc tất cả UseCase_ID từ MASTER_DATA
- **[GAS] `_getMaxExistingIdNum_()`** — NEW helper: tìm số thứ tự cao nhất hiện có
- **[GAS] `generateUseCaseId_()` rewrite v2** — sync `max(CONFIG.NEXT_ID, maxExisting + 1)` + collision loop + fix `configRowIndex` tracking (không còn dùng `data[j][0]` hardcoded)
- **[GAS] `peekNextUseCaseId_()`** — NEW: xem trước ID tiếp theo, read-only, không tiêu thụ counter
- **[GAS] `Code.gs`** — thêm endpoint `?action=next-id`
- **[FE] `routes.js`** — thêm `API.nextId()`
- **[FE] `api.js`** — thêm `Api.getNextId()`
- **[FE] `register.html`** — thêm `#nextIdBadge` trong wizard-meta
- **[FE] `app.js`** — `loadNextIdPreview()`: load + hiển thị badge "Mã dự kiến: AIUS-XXXX" ở new mode; ẩn ở edit mode
- **[FE] `wizard.css`** — `.nextid-badge` styles (purple, subtle border)
- **[TEST] `assets/tests/test-id-generation.js`** — 14 unit tests, 14/14 pass

### Files changed
| File | Delta |
|---|---|
| `assets/gas-backend/UseCaseService.gs` | +72 lines: 3 new functions + rewrite `generateUseCaseId_()` |
| `assets/gas-backend/Code.gs` | +4 lines: route `?action=next-id` |
| `config/routes.js` | +1 line: `API.nextId()` |
| `assets/js/api.js` | +1 line: `Api.getNextId()` |
| `assets/js/app.js` | +22 lines: `loadNextIdPreview()` + call in new mode |
| `register.html` | +1 line: `#nextIdBadge` span |
| `assets/css/wizard.css` | +14 lines: `.nextid-badge` styles |
| `assets/tests/test-id-generation.js` | NEW: 14 unit tests |

### Decisions chốt
1. **Sync strategy = max(CONFIG, maxExisting + 1)**: luôn dùng giá trị lớn hơn → không bao giờ tạo ID < maxExisting
2. **Collision loop**: sau khi chọn candidate từ max(), loop skip qua bất kỳ ID nào đã tồn tại → handles edge cases như manually-inserted IDs ở giữa range
3. **Peek = no lock, no write**: `peekNextUseCaseId_()` không dùng LockService → nhanh, không block concurrent creates; trade-off: preview có thể lệch nếu có create đồng thời (acceptable cho preview UX)
4. **Badge ẩn ở edit mode**: ID đã được cấp và hiển thị trong `editModeBanner` → không cần preview
5. **Badge ẩn khi GAS lỗi**: `loadNextIdPreview()` catch lỗi silently → không làm phiền user khi GAS offline

### GAS deployment note
Sau khi tìm được đúng GAS project (P0 blocker), paste `UseCaseService.gs` và `Code.gs` mới vào GAS Editor → "Edit deployment → New version → Deploy".

---

## Session: 2026-06-03
**Scope:** Drill-down list popup + đồng bộ nút Chi tiết tại "Nộp gần đây"
**Commit:** `7dde9d2`
**Version:** 3.5.0

### Đã hoàn thành

- **FEAT: List popup modal** — Click vào các vùng tương tác trên dashboard mở popup bảng danh sách use case lọc theo ngữ cảnh
  - KPI card "Tổng use case" → all list
  - KPI card "Đã duyệt" → filter Approved
  - KPI card "Chờ duyệt" → filter Submitted + Under Review
  - KPI card "Giờ tiết kiệm" → filter Approved
  - Chart.js doughnut segment (status) → filter by status
  - Chart.js horizontal bar (team) → filter by team
  - Chart.js horizontal bar (category) → filter by category
  - CSS fallback charts → clickable qua `Dashboard._openListByStatus/Team/Category`
- **FEAT: Chi tiết trong list popup** — Mỗi row có nút "Chi tiết" → mở `openDetail()` chồng lên list modal. Escape đóng detail trước, list modal vẫn còn. Escape lần 2 đóng list modal.
- **FIX: recentTable đồng bộ** — Tab "Tổng quan" → "Nộp gần đây" thêm cột nút "Chi tiết" (colspan 4→5), dùng cùng `openDetail()` như các bảng khác.

### Files changed
| File | Delta |
|---|---|
| `dashboard.html` | +16 lines: `#listModal` HTML; `#recentTable` header thêm `<th></th>` |
| `assets/js/dashboard.js` | +163 lines: `openListModal`, `_closeListModal`, `_bindListModal`, `_bindKPIClicks`; update `renderStatusChart`/`renderBreakdownChart` onClick+onHover; update `_chartRow` thêm onclickStr; update `_renderStatusChartCSS`, `_renderBreakdownChartCSS`; update `renderRecentTable`; update `window.Dashboard` public API |
| `assets/css/dashboard.css` | +30 lines: `.modal-card--list`, `.kpi-card--clickable` |

### Decisions chốt
1. **List modal chồng lên detail modal** — z-index tự nhiên từ DOM order (`listModal` trước `usDetailModal`). Không cần thêm z-index.
2. **Escape priority** — `_bindListModal` handler check nếu detail modal đang mở thì bỏ qua → Escape đóng detail trước, lần 2 đóng list.
3. **KPI click = admin only** — `_bindKPIClicks()` guard `if (!_isAdmin) return` → regular user không thấy click cursor trên KPI.
4. **CSS fallback charts** — `_chartRow` nhận thêm tham số `onclickStr`; CSS fallback truyền `Dashboard._openListByStatus/Team/Category(label)` inline.
5. **`capturedLabels/capturedFieldKey`** — Closure capture trong Chart.js `onClick` để tránh stale reference khi chart bị destroy/recreate.

### Open issues (không blocking)
- GAS-MYSTERY-01, GAS code sync — vẫn còn từ session trước

---

## Session: 2026-06-03 (Part 2)
**Scope:** Fix đồng bộ xem chi tiết recentTable với các màn khác
**Commit:** `7715389`

### Root cause đã xác định

`DashboardService.gs` — `computeDashboardSummary_()` chỉ push 4 trường vào `recent_submissions`:
```
{ usecase_id, name, team, submitted_at }
```
Thiếu `record_id` và `status` → `openDetail()` không gọi `_fetchFullDetail()` → modal chỉ thấy dữ liệu tối thiểu, không có approve/reject buttons, không load chi tiết đầy đủ.

Các bảng khác (allTable, myTable, pendingList, exploreTable, exploreTable) dùng data từ `_allList` (endpoint `listUseCases`) đã có đủ trường → hoạt động đúng.

### Đã hoàn thành

**FE — `assets/js/dashboard.js`:**
- `renderRecentTable()`: enrich từng item từ `_allList` theo `usecase_id` trước khi cache. Nếu tìm thấy → dùng object đầy đủ (có `record_id`, `status`, tất cả fields). Preserve `submitted_at` date gốc.
- `openDetail()`: thêm safety net — nếu UC thiếu `record_id`, tìm bản đầy đủ trong `_allList` trước khi render. Áp dụng cho mọi nguồn, không chỉ recentTable.
- Date field: dùng `submitted_at || submit_date` (hai nguồn data dùng key khác nhau)

**GAS — `assets/gas-backend/DashboardService.gs`:**
- `computeDashboardSummary_()`: push thêm `record_id`, `status`, `owner_name` vào mỗi item `recentList` — fix tại nguồn sau khi deploy GAS

### Files changed
| File | Delta |
|---|---|
| `assets/js/dashboard.js` | +24 lines: enrichment logic trong `renderRecentTable` + safety net trong `openDetail` |
| `assets/gas-backend/DashboardService.gs` | +3 fields: `record_id`, `status`, `owner_name` trong `recent_submissions` |

### Decisions chốt
1. **FE enrich = primary fix** — Hoạt động ngay với GAS hiện tại (không cần deploy GAS mới). `_allList` luôn load trước khi user có thể click recentTable (cùng `Promise.all` trong `_loadStartupData`).
2. **`openDetail` safety net = defensive fix** — Bảo vệ mọi trường hợp UC thiếu `record_id` từ bất kỳ nguồn nào, không chỉ recentTable.
3. **GAS fix = fix tại nguồn** — Sau khi deploy GAS mới, `recent_submissions` sẽ có đủ trường ngay, không cần enrich từ `_allList`.
4. **Không thay đổi filter** — `recent_submissions` vẫn chỉ lọc `Status === SUBMITTED` (không mở rộng sang `Under Review`) vì chưa có PO confirmation.

### Test checklist
- [ ] Login admin → tab Tổng quan → bảng "Nộp gần đây" → click nút "Chi tiết" → modal mở đúng 4 section
- [ ] Modal header hiện đúng status badge (Submitted/màu purple)
- [ ] Approve/Reject buttons hiện (vì status = Submitted)
- [ ] Section 2 (Luồng AI & Prompt) / Section 3 / Section 4 load sau khi GAS fetch xong
- [ ] Copy Prompt button hiện sau khi full data load
- [ ] Click "Chi tiết" trong list popup (từ KPI click) → detail modal hoạt động như nhau

---

## Session: 2026-06-03 (Part 3)
**Scope:** Filter tab Tất cả + Box Từ chối
**Commit:** `2eda85a`
**Version:** 3.6.0

### Đã hoàn thành

**Feature 1 — Filter tab "Tất cả use case":**
- Multi-select status pills: click toggle từng trạng thái, "Tất cả" reset về all
- Team dropdown: danh sách build động từ `_allList` sau khi data load
- Search kết hợp với filter (không thay thế)
- Count badge "X / Tổng" cập nhật real-time theo filter hiện tại
- Filter state `_filterAll` giữ nguyên khi data refresh

**Feature 2 — Box "Từ chối" trong tab Tổng quan:**
- `dash-card--rejected`: viền đỏ trái, ẩn khi không có rejected UC
- Preview tối đa 5 UC, nút "Xem tất cả" mở list popup khi > 5
- Mỗi row có nút "Chi tiết" → `openDetail()` đầy đủ 4 section (đồng bộ với các màn khác)
- Tự ẩn khi không có UC nào bị từ chối (clean UX)

### Files changed
| File | Delta |
|---|---|
| `dashboard.html` | +30 lines: filter bar trong tab Tất cả; rejected card trong tab Tổng quan |
| `assets/js/dashboard.js` | +143 lines: `_filterAll`/`_rejectedList` state; `_initAllFilters`, `_populateTeamFilter`, `_applyAllTableFilters`, `renderRejectedCard`; update `_loadStartupData`/`_loadAllUseCases`/`_bindSearch` |
| `assets/css/dashboard.css` | +87 lines: `.filter-bar`, `.filter-pill`, `.filter-select`, `.all-count-badge`, `.dash-card--rejected`, `.tab-badge--danger` |

### Decisions chốt
1. **Multi-select status via pill toggle** — mỗi pill là toggle độc lập; "Tất cả" pill reset tất cả; "Tất cả" tự active khi không chọn gì
2. **Team dropdown = dynamic** — `_populateTeamFilter()` gọi sau `_allList` load; preserve selection khi re-render
3. **`_applyAllTableFilters()` = single source of truth** — search, status filter, team filter đều qua hàm này; `_bindSearch` đơn giản hóa thành `debounce(_applyAllTableFilters, 300)`
4. **Rejected card ẩn khi không có data** — `card.style.display = items.length ? '' : 'none'` → không show empty box khi chưa có UC bị từ chối
5. **REJECTED_PREVIEW = 5** — giống pattern của recentTable; "Xem tất cả" dùng lại `openListModal` hiện có

### Test checklist
- [ ] Login admin → tab Tất cả → click pill "Đã duyệt" → chỉ hiện Approved UCs
- [ ] Click thêm pill "Từ chối" → hiện cả Approved + Rejected (multi-select)
- [ ] Click "Tất cả" pill → reset về all
- [ ] Chọn team trong dropdown → filter theo team
- [ ] Search + filter kết hợp hoạt động
- [ ] Count badge "X / Tổng" cập nhật đúng
- [ ] Tab Tổng quan → box "Từ chối" hiện khi có rejected UC
- [ ] Click "Chi tiết" trong rejected card → detail modal đầy đủ
- [ ] Nút "Xem tất cả" → list popup "Đã từ chối" với toàn bộ danh sách

### Regression risks (v3.6)
- **`_applyAllTableFilters` thay thế `renderAllTable(_allList)` trực tiếp** — nếu `_allList` chưa load khi filter được gọi → render empty. Cần verify `_initAllFilters()` không trigger filter trước khi data load (hiện tại OK vì pills chỉ bắt sự kiện click, không tự gọi).
- **`_populateTeamFilter()` preserve selection** — khi data reload (refresh button), giá trị `_filterAll.team` được đọc lại để re-select. Nếu team không còn trong list mới → dropdown về "Tất cả" nhưng `_filterAll.team` vẫn giữ giá trị cũ → filter lạ. Cần reset: `_filterAll.team = teamSel.value` trong `_populateTeamFilter` sau khi render.
- **`rejectedCard` ẩn khi không có data** — nếu admin có Rejected UCs nhưng `_allList` limit 200 không bao gồm hết → card thiếu data. Acceptable hiện tại nhưng cần pagination dài hạn.

---

---

## Session: 2026-06-03 (Part 4)
**Scope:** Fix URL duplicate "ai-usecase-platform" sau khi đăng nhập
**Commit:** `2a5a2af`
**Version:** 3.6.1

### Root cause
Khi user mở app qua trailing-slash URL (e.g. `https://…/ai-usecase-platform/`):
- `window.location.pathname.split('/').filter(Boolean).pop()` → trả về `'ai-usecase-platform'` thay vì `'index.html'`
- Chuỗi này được encode vào `?return=ai-usecase-platform`
- Sau khi login: `window.location.replace('ai-usecase-platform')` chạy từ `login.html` tại `/ai-usecase-platform/login.html`
- Browser resolve thành `…/ai-usecase-platform/ai-usecase-platform` → 404 / loop

### Đã hoàn thành

**Fix lớp 1 — `assets/js/auth.js` `requireAuth()`:**
- Validate segment bằng regex `/\.html?$/i` trước khi dùng làm return URL
- Nếu không có đuôi `.html` → fallback về `'index.html'`

**Fix lớp 2 — `login.html` `safeReturnUrl()`:**
- Tạo helper function dùng chung cho cả 2 chỗ redirect (already-logged-in check + form submit)
- Regex mới `/^[a-zA-Z0-9_-]+\.html(\?[a-zA-Z0-9_.=&%-]*)?$/` — chỉ chấp nhận `*.html`, từ chối directory name
- Xoá regex cũ `^[a-zA-Z0-9_\-./]+$` (quá rộng, không kiểm tra extension)

### Files changed
| File | Delta |
|---|---|
| `assets/js/auth.js` | `requireAuth()`: thêm `.html` extension check, +2 lines comment |
| `login.html` | `safeReturnUrl()` helper mới; 2 redirect dùng chung; -2 lines duplicate |

### Test cases coverage
| Scenario | Trước fix | Sau fix |
|---|---|---|
| Mở `…/ai-usecase-platform/` (trailing slash) | ❌ redirect → `…/ai-usecase-platform/ai-usecase-platform` | ✅ redirect → `…/ai-usecase-platform/index.html` |
| Mở `…/ai-usecase-platform` (no slash) | ❌ redirect → `…/ai-usecase-platform/ai-usecase-platform` | ✅ redirect → `…/ai-usecase-platform/index.html` |
| Mở `…/ai-usecase-platform/dashboard.html` | ✅ redirect → `…/ai-usecase-platform/login.html?return=dashboard.html` | ✅ không đổi |
| `?return=` chứa directory name | ❌ dùng được vì regex cũ pass | ✅ reject → fallback `index.html` |
| `?return=dashboard.html` | ✅ | ✅ không đổi |

---

---

## Session: 2026-06-03 (Part 5)
**Scope:** Fix confirm button bị frozen sau approve/reject đầu tiên
**Commit:** `4bc33bc`
**Version:** 3.6.2

### Root cause
`_confirmDetailAction()` set `confirmBtn.disabled = true` khi bắt đầu xử lý, nhưng **chỉ reset về `false` trong `catch` (error path)**. Success path không bao giờ reset. Kết quả: sau approve/reject thành công, button bị frozen disabled. Lần mở modal tiếp theo — `openDetail()` không reset `disabled` → button bị kẹt → user click không có tác dụng.

### Đã hoàn thành

**Fix lớp 1 — `openDetail()` reset block:**
```js
document.getElementById('detailActionConfirmBtn').disabled = false;
```
Thêm vào block "Reset action area" trong `openDetail()` → mỗi lần mở modal đều reset.

**Fix lớp 2 — `_showActionArea()` (defense-in-depth):**
```js
confirmBtn.disabled = false;
```
Thêm ngay sau khi lấy `confirmBtn` element → đảm bảo reset kể cả khi user đến từ path không qua `openDetail`.

### Test kết quả (Playwright, live GitHub Pages)
| Case | Kết quả |
|---|---|
| Button initial state = enabled | ✅ |
| Simulate stuck (disabled=true) → click Chi tiết → button reset | ✅ |
| Source có ≥2 điểm reset (catch + openDetail + _showActionArea) = 3 điểm | ✅ |

---

---

## Session: 2026-06-03 (Part 6)
**Scope:** Fix duplicate UseCase_ID khi submit đồng thời — gen ID xuống lúc Submit
**Commit:** `3780bf6`
**Version:** 3.6.3

### Root cause
`peekNextUseCaseId_()` không có lock — không atomic. Khi nhiều user submit cùng lúc:
1. Cả 2 FE peek → cùng thấy `AIUS-0005`
2. Cả 2 gọi `createUseCase()` → GAS (nếu chưa deploy v2) ghi 2 row với cùng `AIUS-0005`

Nếu GAS v2 đã deploy (có `LockService`) thì ổn, nhưng vì GAS-MYSTERY-01 vẫn còn → không đảm bảo.

### Fix 2 lớp

**Lớp 1 — FE `app.js`:**
- Xóa `loadNextIdPreview()` khỏi `init()` — không hiện badge sớm (stale, gây nhầm)
- Trong `submitForm()`: gọi `Api.getNextId()` ngay trước `createUseCase()`, gắn kết quả vào `data.UseCase_ID` làm hint
- Nếu GAS offline: try/catch bỏ qua, GAS tự sinh ID server-side

**Lớp 2 — GAS `UseCaseService.gs`:**
- Thêm `_assignUseCaseId_(hint)`: nhận hint từ FE, acquire `LockService`, check hint còn free không → dùng + sync counter qua `_ensureCounterAhead_()`; nếu hint đã dùng → fallback `generateUseCaseId_()`
- Thêm `_ensureCounterAhead_()`: đảm bảo `CONFIG.NEXT_ID` không bao giờ re-issue số đã dùng
- `createUseCase_()` dùng `_assignUseCaseId_(sanitizeStr_(data.UseCase_ID))` thay vì `generateUseCaseId_()` trực tiếp

### Kết quả
- Race window thu hẹp từ (mở form → submit) xuống còn ~1 JSONP RTT
- 2 concurrent submit với cùng hint: chỉ 1 thắng lock + dùng hint; cái kia fallback generate mới → 0 duplicate

### Test kết quả (Playwright, local server)
| Test | Kết quả |
|---|---|
| next-id NOT called on page load | ✅ |
| nextIdBadge hidden on load | ✅ |
| getNextId() called at submit time | ✅ |
| UseCase_ID hint trong createUseCase payload | ✅ |
| getNextId() offline → createUseCase vẫn chạy (graceful) | ✅ |
| lookup still loads normally (no regression) | ✅ |

### Note về GAS deployment
`_assignUseCaseId_()` và `_ensureCounterAhead_()` cần paste vào GAS Editor sau khi tìm được đúng project (GAS-MYSTERY-01). Khi chưa deploy: FE gửi hint nhưng GAS cũ bỏ qua (dùng `generateUseCaseId_()` cũ) → không tệ hơn trước, chỉ chưa đạt full fix.

---

## Recommended next actions (session kế tiếp)

**[P0] GAS deploy** (blocker cũ, vẫn còn):
1. Tìm đúng GAS project (`script.google.com` → My Projects → URL `AKfycbwe0eo3X3KW...`)
2. Sau khi tìm được: paste `UseCaseService.gs`, `Code.gs`, `Config.gs`, `Utils.gs`, `LookupService.gs`, `DashboardService.gs`
3. "Edit deployment → New version → Deploy" (KHÔNG nhấn "New Deployment")

**[P1] Fix regression risk** trong `_populateTeamFilter`:
- Sau khi render options, đọc lại `teamSel.value` → update `_filterAll.team` để sync state

**[P2] Pagination** — `_allList` giới hạn 200 records, cần "Xem thêm" hoặc server-side pagination

**[P2] BUG-03 confirm với PO** — Status="Draft" khi tạo mới: bug hay intent?

**[P3] Fix double-fetch** — `_loadTabData('my')` vẫn gọi `_loadMyUseCases()` mỗi khi click tab dù data đã có từ startup
