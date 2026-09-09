/* ══════════════════════════════════════════════════════════════
   shell.js — Khung SPA dùng chung (1 nguồn sidebar + topbar)
   - Auth guard + populate user (topbar/sidebar)
   - RBAC: ẩn nav item theo data-roles (1 nguồn → hết drift)
   - Logout ở topbar + toggle sidebar mobile
   - Đăng ký view "home" (portal danh mục dịch vụ)
   - Khởi động Router
   Nạp CUỐI (sau auth.js, router.js, và các module view).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Home view (portal danh mục dịch vụ, role-aware) ──
  var PORTAL_SERVICES = [
    {
      sectionLabel: 'Đăng ký & Quản lý',
      items: [
        { label: 'Đăng ký AI Use Case', desc: 'Tạo mới và nộp use case AI cho team', view: 'register', roles: ['user','champion','admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>' },
        { label: 'Use case của tôi', desc: 'Xem trạng thái và chỉnh sửa use case đã nộp', view: 'dashboard', sub: 'my', roles: ['user','champion','admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>' },
        { label: 'Khám phá Use Case', desc: 'Duyệt và tìm kiếm toàn bộ use case của tổ chức', view: 'dashboard', sub: 'explore', roles: ['user','champion','admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" /></svg>' },
        { label: 'Hàng đợi Review', desc: 'Chấm điểm và đánh giá use case trong hàng đợi', view: 'review-queue', roles: ['champion','admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" /></svg>' },
        { label: 'Cấu hình Workflow', desc: 'Thêm, sửa Workflow và Use case cho droplist đăng ký', view: 'workflow-catalog', roles: ['admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>' }
      ]
    },
    {
      sectionLabel: 'Báo cáo & Phân tích',
      items: [
        { label: 'Dashboard tổng quan', desc: 'Thống kê, phân tích và quản lý toàn bộ use case', view: 'dashboard', roles: ['admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>' },
        { label: 'KPI & Tiến độ', desc: 'Theo dõi điểm số và xếp hạng của từng người dùng', view: 'dashboard', sub: 'kpi', roles: ['user','champion','admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>' },
        { label: 'Leaderboard', desc: 'Bảng xếp hạng top use case và người dùng nổi bật', view: 'leaderboard', roles: ['user','champion','admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516" /></svg>' },
        { label: 'Cập nhật tuần', desc: 'Bản tin hàng tuần về tình hình triển khai AI', view: 'weekly-update', roles: ['user','champion','admin'],
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>' }
      ]
    }
  ];

  function renderHome() {
    var host = document.getElementById('serviceSections');
    if (!host || host.getAttribute('data-rendered')) return;
    host.setAttribute('data-rendered', '1');
    var userRole = (window.AuthService && AuthService.getUser() && AuthService.getUser().role) || 'user';
    PORTAL_SERVICES.forEach(function (section) {
      var visible = section.items.filter(function (it) { return it.roles.indexOf(userRole) !== -1; });
      if (!visible.length) return;
      var sec = document.createElement('div'); sec.className = 'service-section';
      var h2 = document.createElement('h2'); h2.className = 'service-section-title'; h2.textContent = section.sectionLabel; sec.appendChild(h2);
      var list = document.createElement('div'); list.className = 'service-list'; list.setAttribute('role', 'list');
      visible.forEach(function (it) {
        var a = document.createElement('a');
        a.className = 'service-item';
        a.href = '#' + it.view + (it.sub ? '/' + it.sub : '');
        a.setAttribute('role', 'listitem');
        a.setAttribute('aria-label', it.label + (it.desc ? ' — ' + it.desc : ''));
        a.innerHTML =
          '<div class="service-item-icon" aria-hidden="true">' + it.icon + '</div>' +
          '<div class="service-item-content"><p class="service-item-label"></p><p class="service-item-desc"></p></div>' +
          '<div class="service-item-right"><i class="service-item-chevron" aria-hidden="true">›</i></div>';
        a.querySelector('.service-item-label').textContent = it.label;
        a.querySelector('.service-item-desc').textContent = it.desc;
        list.appendChild(a);
      });
      sec.appendChild(list); host.appendChild(sec);
    });
  }

  window.Router.register('home', { title: 'Trang chủ', roles: [], init: renderHome });

  // ── Bootstrap khung ──
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AuthService || !AuthService.requireAuth()) return; // chưa đăng nhập → redirect login

    AuthService.populateSidebarUser();

    // RBAC nav (1 nguồn): ẩn item mà role hiện tại không có quyền
    var role = (AuthService.getUser() || {}).role || 'user';
    var items = document.querySelectorAll('.sidebar-nav-item[data-roles]');
    for (var i = 0; i < items.length; i++) {
      var roles = (items[i].getAttribute('data-roles') || '').split(/\s+/).filter(Boolean);
      if (roles.length && roles.indexOf(role) === -1) items[i].style.display = 'none';
    }

    // Logout ở topbar
    var lo = document.getElementById('topbarLogoutBtn');
    if (lo) lo.addEventListener('click', function () { AuthService.logout(); window.location.replace('login.html'); });

    // Sidebar toggle (mobile)
    var sidebar = document.getElementById('appSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var toggle  = document.getElementById('sidebarToggle');
    function closeSidebar() { if (sidebar) sidebar.classList.remove('is-open'); if (overlay) overlay.classList.remove('is-visible'); if (toggle) toggle.setAttribute('aria-expanded', 'false'); }
    function openSidebar()  { if (sidebar) sidebar.classList.add('is-open'); if (overlay) overlay.classList.add('is-visible'); if (toggle) toggle.setAttribute('aria-expanded', 'true'); }
    if (toggle)  toggle.addEventListener('click', function () { sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar(); });
    if (overlay) overlay.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSidebar(); });

    window.Router.start();
  });
})();
