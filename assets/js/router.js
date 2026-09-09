/* ══════════════════════════════════════════════════════════════
   router.js — Router SPA-lite (hash-based) cho AIUS
   1 shell (index.html) + nhiều <section data-view> chuyển bằng #hash,
   KHÔNG reload → hết drift menu + hết nhấp nháy.
   API:
     Router.register(view, { title, roles, init, show })
        - init(sub): gọi 1 LẦN khi view mở lần đầu (lazy)
        - show(sub): gọi MỖI lần vào view (truyền tham số phụ sau '/')
        - roles: mảng role được phép ([] hoặc bỏ = mọi role)
     Router.go(view, sub)  → đổi hash
     Router.start()        → shell gọi sau khi auth sẵn sàng
   Hash: #view  hoặc  #view/sub   (vd #dashboard/my)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var registry = {};
  var inited = {};

  function role() {
    var u = window.AuthService && AuthService.getUser && AuthService.getUser();
    return u ? (u.role || 'user') : 'user';
  }
  function allowed(cfg) {
    if (!cfg || !cfg.roles || !cfg.roles.length) return true;
    return cfg.roles.indexOf(role()) !== -1;
  }
  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return { view: 'home', sub: '' };
    var parts = h.split('/');
    return { view: parts[0], sub: parts.slice(1).join('/') };
  }

  function render() {
    var r = parseHash();
    var cfg = registry[r.view];

    // View lạ hoặc không đủ quyền → về #home
    if (!cfg || !allowed(cfg)) {
      if (r.view !== 'home') { location.replace('#home'); return; }
    }

    // Hiện đúng section
    var sections = document.querySelectorAll('.app-content [data-view]');
    for (var i = 0; i < sections.length; i++) {
      sections[i].hidden = (sections[i].getAttribute('data-view') !== r.view);
    }

    // Active nav
    var navs = document.querySelectorAll('.sidebar-nav-item[data-view]');
    for (var j = 0; j < navs.length; j++) {
      var on = navs[j].getAttribute('data-view') === r.view;
      navs[j].classList.toggle('is-active', on);
      if (on) navs[j].setAttribute('aria-current', 'page');
      else navs[j].removeAttribute('aria-current');
    }

    // Tiêu đề topbar + document.title
    var titleEl = document.getElementById('topbarTitle');
    var t = (cfg && cfg.title) ? cfg.title : '';
    if (titleEl && t) titleEl.textContent = t;
    document.title = (t ? t + ' — ' : '') + 'AI Use Case Platform';

    // Lazy init 1 lần
    if (cfg && typeof cfg.init === 'function' && !inited[r.view]) {
      inited[r.view] = true;
      try { cfg.init(r.sub); } catch (e) { console.error('[router] init ' + r.view, e); }
    }
    // show mỗi lần (truyền sub)
    if (cfg && typeof cfg.show === 'function') {
      try { cfg.show(r.sub); } catch (e) { console.error('[router] show ' + r.view, e); }
    }

    // đóng sidebar mobile nếu đang mở
    var sb = document.getElementById('appSidebar');
    var ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.remove('is-open');
    if (ov) ov.classList.remove('is-visible');
    window.scrollTo(0, 0);
  }

  var Router = {
    register: function (view, cfg) { registry[view] = cfg || {}; },
    go: function (view, sub) { location.hash = '#' + view + (sub ? '/' + sub : ''); },
    current: function () { return parseHash(); },
    start: function () {
      window.addEventListener('hashchange', render);
      if (!location.hash) { location.replace('#home'); }
      render();
    }
  };

  window.Router = Router;
})();
