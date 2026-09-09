/* ══════════════════════════════════════════════════════════════
   theme.js — Dark-mode toggle + persist (chuẩn hệ SHTD / design-system)
   Tự chứa, không phụ thuộc thư viện ngoài. Đặt <script src=".../theme.js">
   trong <head> (KHÔNG defer) để apply theme TRƯỚC khi vẽ → không nhấp nháy.
   - Nhớ lựa chọn trong localStorage (key theo dự án).
   - Chèn nút toggle vào .topbar-actions (hoặc .header-actions), fallback nút nổi.
   - Phím tắt Ctrl+D (bỏ qua khi con trỏ trong ô nhập).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var THEME_KEY = 'aius_theme';
  var root = document.documentElement;

  // Icon (stroke SVG, khớp phong cách icon AIUS). Trăng = đang sáng (bấm để tối);
  // Mặt trời = đang tối (bấm để sáng).
  var ICON_MOON =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>';
  var ICON_SUN =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>';

  function currentIsDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  // ── Apply saved theme sớm (trước paint) ──
  try {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      root.setAttribute('data-theme', saved);
    }
  } catch (e) { /* localStorage bị chặn → giữ light mặc định */ }

  function syncButton(btn) {
    if (!btn) return;
    var dark = currentIsDark();
    btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    var label = dark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  function setTheme(dark) {
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
    syncButton(document.getElementById('darkModeBtn'));
  }

  function toggleTheme() { setTheme(!currentIsDark()); }

  function buildButton(floating) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'darkModeBtn';
    btn.className = floating ? 'theme-toggle-floating' : 'topbar-icon-btn theme-toggle';
    btn.addEventListener('click', toggleTheme);
    syncButton(btn);
    return btn;
  }

  function inject() {
    if (document.getElementById('darkModeBtn')) return; // idempotent
    var host = document.querySelector('.topbar-actions') || document.querySelector('.header-actions');
    if (host) {
      host.insertBefore(buildButton(false), host.firstChild);
    } else {
      document.body.appendChild(buildButton(true));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  // ── Phím tắt Ctrl+D ──
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey && (e.key === 'd' || e.key === 'D'))) return;
    var t = e.target;
    var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
    e.preventDefault();
    toggleTheme();
  });
})();
