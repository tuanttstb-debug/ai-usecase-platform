// ─────────────────────────────────────────────────────────────────
// auth.js — AuthService
//
// Roles: admin | champion | user
// Champion: can review UCs of their own team (no approve/reject)
//
// Depends on: config/env.js (APP_CONFIG) — must load first.
// Session key: APP_CONFIG.USER_SESSION_KEY || 'ai_user_session'
// Role resolution: ADMIN_EMAILS → admin, CHAMPION_USERS → champion, else user
// ─────────────────────────────────────────────────────────────────

var AuthService = (function () {

  var SESSION_KEY = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.USER_SESSION_KEY)
    ? APP_CONFIG.USER_SESSION_KEY
    : 'ai_user_session';

  // ── Role resolution ──────────────────────────────────────────────
  function _resolveRole(email) {
    var normalized = email.toLowerCase().trim();
    var adminList = ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.ADMIN_EMAILS) || [])
      .map(function (e) { return String(e).toLowerCase().trim(); });
    if (adminList.indexOf(normalized) !== -1) return 'admin';
    var championList = ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.CHAMPION_USERS) || [])
      .map(function (e) { return String(e).toLowerCase().trim(); });
    if (championList.indexOf(normalized) !== -1) return 'champion';
    return 'user';
  }

  // Build display name from username (or email local-part)
  function _buildDisplayName(username) {
    var base = username.includes('@') ? username.split('@')[0] : username;
    return base
      .split(/[._-]/)
      .map(function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; })
      .join(' ')
      .trim() || username;
  }

  // ── Storage helpers ──────────────────────────────────────────────
  function _save(user) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      if (user.role === 'admin'
          && typeof APP_CONFIG !== 'undefined'
          && APP_CONFIG.ADMIN_SESSION_KEY) {
        sessionStorage.setItem(APP_CONFIG.ADMIN_SESSION_KEY, user.email);
      }
    } catch (e) {}
  }

  function _clear() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    try {
      if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.ADMIN_SESSION_KEY) {
        sessionStorage.removeItem(APP_CONFIG.ADMIN_SESSION_KEY);
      }
    } catch (e) {}
  }

  // ── Public API ───────────────────────────────────────────────────
  return {

    login: function (username) {
      var uname = String(username || '').trim();
      if (!uname) {
        return { success: false, error: 'Vui lòng nhập tên đăng nhập' };
      }
      var user = {
        email:       uname,
        displayName: _buildDisplayName(uname),
        role:        _resolveRole(uname),
        loginAt:     new Date().toISOString()
      };
      _save(user);
      return { success: true, user: user };
    },

    logout: function () { _clear(); },

    getUser: function () {
      try {
        var raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    isLoggedIn: function () { return !!this.getUser(); },

    isAdmin: function () {
      var u = this.getUser();
      return !!(u && u.role === 'admin');
    },

    isChampion: function () {
      var u = this.getUser();
      return !!(u && u.role === 'champion');
    },

    isChampionOrAdmin: function () {
      return this.isAdmin() || this.isChampion();
    },

    requireAuth: function () {
      if (!this.isLoggedIn()) {
        var last = window.location.pathname.split('/').filter(Boolean).pop() || '';
        var page = /\.html?$/i.test(last) ? last : 'index.html';
        var ret  = encodeURIComponent(page + window.location.search);
        window.location.replace('login.html?return=' + ret);
        return false;
      }
      return true;
    },

    requireAdmin: function () {
      if (!this.requireAuth()) return false;
      if (!this.isAdmin()) {
        window.location.replace('index.html');
        return false;
      }
      return true;
    },

    requireChampionOrAdmin: function () {
      if (!this.requireAuth()) return false;
      if (!this.isChampionOrAdmin()) {
        window.location.replace('index.html');
        return false;
      }
      return true;
    },

    /**
     * Store a user object from GAS validateUserLogin response.
     * @param {{ email, displayName, role, team?, loginAt? }} userData
     */
    storeUser: function(userData) {
      if (!userData || !userData.email) return;
      var role = String(userData.role || 'user').toLowerCase().trim();
      if (role !== 'admin' && role !== 'champion') role = 'user';
      var user = {
        email:       String(userData.email).trim().toLowerCase(),
        displayName: userData.displayName || _buildDisplayName(userData.email),
        role:        role,
        team:        userData.team || '',
        loginAt:     userData.loginAt || new Date().toISOString()
      };
      _save(user);
    },

    /**
     * Show/hide sidebar nav items based on current user role.
     * Call once after DOM is ready. Safe to call multiple times.
     */
    setupNav: function () {
      var user  = this.getUser();
      var role  = user ? (user.role || 'user') : 'user';
      var isAdm = role === 'admin';
      var isChm = role === 'champion';

      function show(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = '';
      }
      if (isAdm) {
        show('navDashboard');
        show('navUsers');
        show('navReviewQueue');
      } else if (isChm) {
        show('navReviewQueue');
      }
    },

    /**
     * Populate sidebar footer user info and bind logout.
     * Call once after DOM is ready.
     */
    populateSidebarUser: function () {
      var user = this.getUser();
      if (!user) return;
      var initials = (user.displayName || user.email || '?').charAt(0).toUpperCase();
      var roleLabels = { admin: 'Admin', champion: 'Champion', user: 'Người dùng' };
      var roleLabel  = roleLabels[user.role] || 'Người dùng';

      function setEl(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
      setEl('sidebarAvatar',   initials);
      setEl('sidebarUserName', user.displayName || user.email);
      setEl('sidebarUserRole', roleLabel);
      setEl('topbarAvatar',    initials);
      setEl('topbarUserName',  user.displayName || user.email);

      var chip = document.getElementById('topbarUserChip');
      if (chip) chip.style.display = '';

      var logoutBtn = document.getElementById('sidebarLogoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', function () {
        AuthService.logout();
        window.location.replace('login.html');
      });
    }
  };
})();
