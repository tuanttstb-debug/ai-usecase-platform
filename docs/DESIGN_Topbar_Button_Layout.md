# Concept thiết kế — Bố cục nút & Topbar (chuẩn hóa AIUS theo SHTD)

> **Mục đích:** chốt nguyên tắc bố cục nút + cụm điều khiển topbar TRƯỚC khi chuẩn hóa AIUS, để mọi trang "cùng một nhà" với SHTD (sản phẩm UIUX chuẩn). Nguồn gốc: `AIOS/04_Knowledge/references/REF-UIUX-DESIGN-SYSTEM.md` + đọc trực tiếp `SHTD-Dashboard/index.html` + `assets/css/layout.css`.
>
> **Ngày:** 2026-09-09 · **Phạm vi:** topbar-right (cụm action + danh tính), nút icon, nút hành động, nút đăng xuất, dark toggle.

---

## 1. Giải phẫu topbar SHTD (mẫu chuẩn)

```
┌ topbar ─────────────────────────────────────────────────────────────────┐
│ [≡ hamburger]  Page Title              status·icon-btn·icon-btn·…·[user-pill] │
│                breadcrumb                (trái→phải: action → danh tính)      │
└ topbar-left ──────────────────────────  ─ topbar-right ───────────────────┘
```

- **topbar-left** (`gap:16px`): hamburger (`.icon-btn`) · nhóm tiêu đề (`.page-title` 17px/700 + `.breadcrumb` 12px/text-3).
- **topbar-right** (`display:flex; align-items:center; gap:10px`): các **action dạng icon** xếp trước → **user-pill LUÔN Ở CUỐI** (ngoài cùng phải).
  - Thứ tự SHTD: `status-dot` → `.icon-btn`(phím tắt) → `.icon-btn#darkModeBtn`(dark) → `.lang-toggle` → notif → Quick View → **`.user-pill`**.

## 2. Taxonomy nút (kích thước & vai trò)

| Loại | Class | Kích thước / hình | Dùng cho |
|---|---|---|---|
| **Icon-button** | `.icon-btn` (SHTD) / `.topbar-icon-btn` (AIUS) | **36–38px vuông**, viền `--border`, nền `--surface`, radius nhỏ | hành động đơn (dark, phím tắt, refresh, **đăng xuất**). Luôn có `title`/`aria-label`. |
| **User-pill** | `.user-pill` / `.topbar-user-chip` | pill bo tròn (`radius-full`), avatar chữ cái + tên (+role) | **danh tính phiên**, đặt CUỐI topbar-right. |
| **Nút hành động chính** | `.btn.btn-primary` | nền **accent (cam)** + glow | 1 hành động chính/màn (submit, "Đăng ký mới"). REF Nguyên tắc 2. |
| **Nút phụ / viền / ghost** | `.btn-outline` / `.btn-ghost` | viền hoặc trong suốt, tông `--primary` (tím) | hành động phụ, cấu trúc. |
| **Segmented** | `.lang-toggle` / `.scope-toggle` | nhóm nút liền | chuyển chế độ (VI/EN, Của tôi/Tất cả). |

## 3. Nguyên tắc bố cục (rút gọn để áp)

1. **Nhóm action = icon-btn đồng đều.** Mọi hành động icon trên topbar cùng cỡ (36–38px vuông), cùng `gap`, cùng viền/nền → mắt đọc thành 1 hàng công cụ. Không lẫn cỡ, không nút trôi nổi.
2. **Danh tính đặt cuối.** `user-pill`/`user-chip` luôn ở ngoài cùng phải; các action đứng bên trái nó. Không để action **đè** lên danh tính.
3. **Đăng xuất là icon-btn trong cụm topbar-right**, KHÔNG phải nút ghost lạc lõng ở footer. Session-control gom về 1 chỗ (cạnh user-pill).
4. **Một sắc nhấn cho hành động chính** (cam `--accent`); cấu trúc/nút phụ dùng tím `--primary`. Không nhiều sắc nhấn cạnh tranh.
5. **Dark toggle = 1 icon-btn trong cụm**, đặt ngay trước user-pill; nhớ lựa chọn; KHÔNG dùng nút nổi `position:fixed` trên trang có topbar (gây đè).
6. **Icon luôn có nhãn hoặc title.** Icon đơn độc phải có `title`/`aria-label` rõ nghĩa.
7. **Không trùng lặp danh tính/điều khiển.** Hiển thị user + logout ở MỘT nơi (topbar), tránh vừa sidebar-footer vừa topbar.

## 4. Áp cho AIUS (multi-page 12 trang) — chuẩn mục tiêu

**Topbar-right chuẩn (mọi trang app):**
```
.topbar-actions (flex, align-center, gap var(--space-3))
  ├─ [refresh]  .topbar-icon-btn         (chỉ trang có, admin-gated)
  ├─ [dark]     .topbar-icon-btn         (chèn bởi theme.js, ngay trước user-chip)
  ├─ [user]     .topbar-user-chip        (avatar + tên — danh tính, gần cuối)
  └─ [logout]   .topbar-icon-btn#topbarLogoutBtn   (đăng xuất — icon-btn chuẩn, cuối)
```

**Thay đổi so với hiện trạng:**
- 5 trang thiếu `.topbar-actions` (library · personal-score · review-queue · workflow-catalog · workflow-coverage) → **bọc user-chip vào `.topbar-actions`** ⇒ dark toggle chèn inline (hết nút nổi đè tên user).
- **Đăng xuất** chuyển thành `.topbar-icon-btn#topbarLogoutBtn` trong cụm topbar-right (chuẩn) — **gỡ nút ghost `.sidebar-logout-btn`** ở sidebar footer (footer giữ avatar+tên+role làm danh tính phụ). Bind logout tập trung ở `AuthService.populateSidebarUser()`.
- `theme.js` chèn dark toggle **trước `.topbar-user-chip`** (đúng "action trước, danh tính sau").

**Bất biến (không đổi):** phím tắt Ctrl+D · persist `aius_theme` · trang không-topbar (login, đổi-mật-khẩu) vẫn dùng nút nổi (không có topbar nên không đè).
