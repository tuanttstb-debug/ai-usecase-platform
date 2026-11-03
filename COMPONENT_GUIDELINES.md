# Component Guidelines — TPBank BIZ

> ⚠️ **ĐÃ THAY bằng UI/UX v2 (v4 token, 2026-11-03).** Nguồn chuẩn hiện tại:
> - Gu (màu, phông, dials): `design-system/ai-use-case-platform/MASTER.md` · phương án + 4 đợt: `design-system/ai-use-case-platform/PHUONG_AN_VA_KE_HOACH.md`
> - Token: `assets/css/variables.css` — primary xanh `#1D4ED8`, chữ/viền slate, hổ phách `--color-accent` CHỈ để nhấn "cần chú ý", nút chính = `.btn-primary` (xanh), phông Fira Sans/Fira Code (có tiếng Việt), chữ thân 14px, nhỏ nhất 12px
> - Khung: sidebar sáng (thu gọn desktop `.app-layout.is-collapsed` · trượt ngang ≤1024px) · trang trong `.app-content` dùng `.app-container.view-wrap` (1200px) / `--narrow` (960px), không style inline max-width/padding
> - Điện thoại: tab cuộn trong khung (`.dash-tabs`/`.lb-tabs`/`.tab-nav`) · bảng chỉ-đọc ≥5 cột tự thành thẻ ≤640px (`shell.js` gắn `.is-stacked` + `data-label`; bảng không muốn xếp thẻ → `data-no-stack`) · nút/ô nhập ≥40px
> - Biểu tượng: Font Awesome 6 / SVG — **không emoji**. Màu dữ liệu trong JS dùng bảng v4 (xanh `#15803D` · vàng `#B45309` · đỏ `#B91C1C` · tím `#6D28D9` = Xuất sắc)
> - Bộ lọc theo người: chuẩn Team + Nhân sự (`people-filter.js`). Kiểm cuối: `/design-review` (hub AIOS)
>
> Phần dưới là tài liệu hệ cũ (tím-cam SHTD), giữ để tra lịch sử.


## General Rules

1. All components must use CSS custom property tokens — no hardcoded hex values
2. All interactive elements must have hover, active, focus, and disabled states
3. All form controls must have visible focus rings (purple, 3px ring)
4. Components must be usable at all 5 breakpoints
5. ARIA roles and labels are required on all interactive components

---

## Sidebar Nav Item

**When active:** Add `is-active` class + `aria-current="page"`  
**When disabled:** Add `is-disabled` class + `aria-disabled="true"` + `pointer-events: none`

```html
<a href="dashboard.html" class="sidebar-nav-item is-active"
   role="menuitem" aria-current="page">
  <i class="sidebar-nav-icon" aria-hidden="true">📊</i>
  <span class="sidebar-nav-label">Dashboard</span>
  <span class="sidebar-nav-badge">3</span>  <!-- optional -->
</a>
```

Badge hides automatically when empty (`:empty { display: none }`).

---

## Button States

Always check all 4 states when adding a new button:

| State | CSS |
|---|---|
| Default | base class |
| Hover | `:hover:not(:disabled)` |
| Active | `:active` → `opacity: 0.88` |
| Disabled | `disabled` attribute or `.btn:disabled` |
| Loading | Add spinner child + hide label (pattern from login-btn) |

---

## Form Validation Pattern

```javascript
// Show error on a form-group
function showFieldError(inputEl, message) {
  var group = inputEl.closest('.form-group');
  group.classList.add('has-error');
  var err = group.querySelector('.field-error');
  if (err) err.textContent = message;
}

// Clear error
function clearFieldError(inputEl) {
  var group = inputEl.closest('.form-group');
  group.classList.remove('has-error');
  var err = group.querySelector('.field-error');
  if (err) err.textContent = '';
}
```

---

## Toast Notification Pattern

```javascript
function showToast(message, type) {
  // type: 'success' | 'error' | 'warning' | 'info'
  var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'alert');
  toast.innerHTML =
    '<span class="toast-icon">' + icons[type] + '</span>' +
    '<span class="toast-message">' + escapeHtml(message) + '</span>' +
    '<button class="toast-close" onclick="this.parentElement.remove()">×</button>';
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(function() { toast.remove(); }, 5000);
}
```

---

## KPI Card Color Variants

```html
<!-- Default (purple accent top) -->
<div class="kpi-card">...</div>

<!-- Success (green accent top) -->
<div class="kpi-card kpi-success">...</div>

<!-- Warning (amber accent top) -->
<div class="kpi-card kpi-warning">...</div>

<!-- Info (blue accent top) -->
<div class="kpi-card kpi-info">...</div>
```

---

## Status Badge Inline Style Pattern

When rendering dynamic status badges in JS (no pre-known class), use inline color style:

```javascript
var cfg = STATUS_CFG[status] || { label: status, color: '#A4A4B2' };
var badge = '<span class="status-badge" style="' +
  'background:' + cfg.color + '20;' +  // 12% opacity background
  'color:' + cfg.color + ';' +
  'border:1px solid ' + cfg.color + '40' +  // 25% opacity border
  '">' + cfg.label + '</span>';
```

---

## Tab Panel Pattern

Tabs must use `role="tablist"` + `role="tab"` + `aria-selected` + `role="tabpanel"` + `aria-labelledby`.

```javascript
function bindTabs() {
  document.querySelectorAll('[role="tab"]').forEach(function(tab) {
    tab.addEventListener('click', function() {
      // Deactivate all
      document.querySelectorAll('[role="tab"]').forEach(function(t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.add('hidden');
      });
      // Activate clicked
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      var target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.classList.remove('hidden');
    });
  });
}
```

---

## Modal Pattern

```javascript
function openModal() {
  document.getElementById('myModal').classList.remove('hidden');
  document.getElementById('myModal').querySelector('[data-focus]').focus();
}
function closeModal() {
  document.getElementById('myModal').classList.add('hidden');
}
// Close on overlay click
document.getElementById('myModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
// Close on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});
```

---

## Collapsible Section (Wizard)

The `<details>` + `<summary>` pattern is used for expandable form sections:

```html
<details class="collapsible-section">
  <summary>
    <span class="collapsible-title">Section Title</span>
    <span class="collapsible-hint">Optional</span>
    <span class="collapsible-chevron">▼</span>
  </summary>
  <div class="collapsible-body">
    <!-- form fields -->
  </div>
</details>
```

The CSS auto-rotates the chevron when `[open]` is present.

---

## Bộ lọc chuẩn Team + Nhân sự (People Filter) — CHUẨN BẮT BUỘC từ 2026-10-16

> Anh Tuân chốt 16/10/2026: **mọi màn có danh sách nhiều người** (bài tập, chấm bài, theo dõi, việc lớn, khóa học… và mọi tính năng lọc làm sau này) dùng bộ lọc chuẩn này. Không tự chế ô lọc team/người riêng.

**Quy tắc**
1. Hai ô chọn đặt cạnh nhau, cùng hàng ô tìm kiếm/bộ lọc khác: **"Tất cả team"** rồi **"Tất cả nhân sự"**.
2. Nhãn nhân sự = **`Username-Họ tên`**, chữ đầu username viết hoa — vd `Tuantt4-Trần Thế Tuân`. Không có họ tên → chỉ `Username`. Họ tên thiếu ở dòng dữ liệu thì tra danh bạ (`learning-list.members`).
3. Danh sách team / nhân sự lấy từ **chính dữ liệu của màn đó** (không liệt kê người không có dòng nào), sắp theo tiếng Việt.
4. Chọn team → ô nhân sự chỉ còn người của team đó; người đang chọn không thuộc team mới → tự về "Tất cả nhân sự".
5. So khớp đã chuẩn hóa (trim + chữ thường). Bộ lọc áp cho **mọi danh sách trên màn** (AND với bộ lọc trạng thái/tìm kiếm). Dòng có nhiều người (vd việc lớn: làm chính + người được giao) khớp khi **một** người khớp.
6. Màn chỉ chứa dữ liệu của chính người dùng (Bài tập tuần, Khóa học của tôi) **không** gắn bộ lọc.

**Markup** (class `.pf-select` trong `components.css`):
```html
<select id="xxTeamFilter" class="pf-select pf-select--team" aria-label="Lọc theo team"><option value="">Tất cả team</option></select>
<select id="xxUserFilter" class="pf-select" aria-label="Lọc theo nhân sự"><option value="">Tất cả nhân sự</option></select>
```

**JS** (`assets/js/people-filter.js` — nạp trước các module màn):
```javascript
var pf = PeopleFilter.bind({ team: 'xxTeamFilter', user: 'xxUserFilter', onChange: render });
pf.setPeople(rows.map(function (r) { return { username: r.username, name: r.display_name, team: r.team }; })); // mỗi lần tải dữ liệu
rows.filter(function (r) { return pf.match(r.team, r.username); });   // username có thể là mảng
PeopleFilter.label('tuantt4', 'Trần Thế Tuân');                         // → "Tuantt4-Trần Thế Tuân" (dùng cho mọi chỗ hiển thị tên)
```

**Đang áp dụng:** Chấm bài & lan tỏa (`sr*`) · Bài tập & Học tập → Thư viện (`ex*`), Theo dõi (`lp*`), Việc lớn (`bt*`). Test: `tests/21-people-filter.spec.js`, `tests/15-self-score.spec.js` T07.
