/* ─────────────────────────────────────────
   dashboard.js — Dashboard + My Cases
   Accessible to all logged-in users.
   Admin: all tabs + KPI + approve/reject.
   User:  "My Cases" tab only.
   Depends: env.js, auth.js, routes.js, api.js
   ───────────────────────────────────────── */
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────
  var _user        = null;
  var _isAdmin     = false;
  var _dashData    = null;
  var _pendingList = [];
  var _allList     = [];
  var _myList      = [];
  var _exploreList = [];
  var _charts       = {};
  var _detailUc     = null;
  var _detailAction = null; // 'approve' | 'reject'
  var _ucCache      = {}; // key → uc object (safe alternative to inline JSON)
  var _rejectedList = [];
  var _filterAll    = { statuses: [], team: '' }; // multi-status + single-team filter for "all" tab
  var _usersList    = []; // cache user list for Users tab
  var _kpiViewedWeek = null; // null = current week; updated by week navigation buttons
  var _kpiViewMode   = 'total'; // 'total' | 'week' — default shows all-time ranking

  // ── Status config ────────────────────────────────────────────────
  var STATUS_CFG = {
    'Draft':        { label: 'Nháp',         color: '#A4A4B2' },
    'Submitted':    { label: 'Đã nộp',       color: '#7B2CBF' },
    'Under Review': { label: 'Đang review',  color: '#F6B100' },
    'Approved':     { label: 'Đã duyệt',     color: '#4CAF50' },
    'Rejected':     { label: 'Từ chối',      color: '#F44336' },
    'Archived':     { label: 'Lưu trữ',      color: '#A4A4B2' }
  };

  // ── Init ─────────────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', function () {

    // Auth check: all logged-in users allowed
    if (typeof AuthService !== 'undefined') {
      if (!AuthService.isLoggedIn()) {
        window.location.replace('login.html?return=dashboard.html');
        return;
      }
      _user    = AuthService.getUser();
      _isAdmin = AuthService.isAdmin();
    }

    _populateSidebar();
    _setupLayout();
    _bindTabs();
    _bindSearch();
    _bindRefresh();
    _bindDetailModal();
    _bindApprovalModal();
    _bindExploreSearch();
    _bindListModal();
    _bindKPIClicks();
    _initAllFilters();

    // Determine initial tab from URL param
    var sp       = new URLSearchParams(window.location.search);
    var initTab  = sp.get('tab') || (_isAdmin ? 'overview' : 'my');
    _activateTab(initTab);

    // Load all data on startup — no waiting for tab clicks
    _loadStartupData();
  });

  // ── Layout setup (role-based visibility) ─────────────────────────
  function _setupLayout() {
    var isChampion = typeof AuthService !== 'undefined' && typeof AuthService.isChampion === 'function' && AuthService.isChampion();
    if (_isAdmin) {
      var kpiRow = document.getElementById('kpiRow');
      if (kpiRow) kpiRow.style.display = '';

      document.querySelectorAll('.admin-only').forEach(function (el) {
        el.style.display = '';
      });

      var navDash = document.getElementById('navDashboard');
      if (navDash) navDash.style.display = '';

      var navUsers = document.getElementById('navUsers');
      if (navUsers) navUsers.style.display = '';

      var navReviewQueue = document.getElementById('navReviewQueue');
      if (navReviewQueue) navReviewQueue.style.display = '';

      var refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) refreshBtn.style.display = '';

      var title = document.getElementById('topbarTitle');
      if (title) title.textContent = 'Dashboard Quản lý';
    } else {
      if (isChampion) {
        var navRQ = document.getElementById('navReviewQueue');
        if (navRQ) navRQ.style.display = '';
      }
      var title2 = document.getElementById('topbarTitle');
      if (title2) title2.textContent = 'Use Case của tôi';
    }
  }

  // ── Populate sidebar user info ────────────────────────────────────
  function _populateSidebar() {
    if (!_user) return;
    var initials = (_user.displayName || _user.email || '?').charAt(0).toUpperCase();
    var roleLabels = { admin: 'Admin', champion: 'Champion', user: 'Người dùng' };
    var roleLabel  = roleLabels[_user.role] || 'Người dùng';
    function setEl(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    setEl('sidebarAvatar',   initials);
    setEl('sidebarUserName', _user.displayName || _user.email);
    setEl('sidebarUserRole', roleLabel);
    setEl('topbarAvatar',    initials);
    setEl('topbarUserName',  _user.displayName || _user.email);
    var chip = document.getElementById('topbarUserChip'); if (chip) chip.style.display = '';

    var logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      if (typeof AuthService !== 'undefined') AuthService.logout();
      window.location.replace('login.html');
    });
  }

  // ── Tab Navigation ───────────────────────────────────────────────
  function _activateTab(tabName) {
    document.querySelectorAll('.dash-tab').forEach(function (btn) {
      var active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('hidden', panel.id !== 'tab-' + tabName);
    });

    // Update "Use Case của tôi" nav active state
    var navMyUs = document.getElementById('navMyUs');
    if (navMyUs) navMyUs.classList.toggle('is-active', tabName === 'my');
    var navDash = document.getElementById('navDashboard');
    if (navDash) navDash.classList.toggle('is-active', tabName !== 'my');
  }

  function _bindTabs() {
    document.querySelectorAll('.dash-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.dataset.tab;
        _activateTab(target);
        _loadTabData(target);
      });
    });
  }

  function _loadTabData(tab) {
    if (tab === 'overview' && _isAdmin) {
      _loadAdminOverview();
    } else if (tab === 'pending' && _isAdmin) {
      if (_pendingList.length === 0) _loadPending();
    } else if (tab === 'all' && _isAdmin) {
      if (_allList.length === 0) _loadAllUseCases();
    } else if (tab === 'my') {
      _loadMyUseCases();
    } else if (tab === 'explore') {
      if (!_exploreList.length) {
        _exploreList = _allList.filter(function (uc) { return uc.status === 'Approved'; });
        renderExploreTable(_exploreList);
      }
    } else if (tab === 'kpi') {
      renderKPITab(); // render immediately with available data
      if (!_usersList.length) {
        // Then fetch USERS sheet for users-with-0-UCs feature; re-render when ready
        Api.getUsers()
          .then(function (list) { _usersList = list || []; })
          .catch(function () { /* GAS users endpoint not deployed yet — fall back to _allList */ })
          .then(function () { renderKPITab(); });
      }
    } else if (tab === 'users' && _isAdmin) {
      _loadUsersTab();
    }
  }

  // ── Startup: load all data at once (no lazy loading) ─────────────
  async function _loadStartupData() {
    showLoading(true);
    try {
      var results = await Promise.all([
        Api.listUseCases({ limit: 200 }),
        _isAdmin ? Api.getDashboard() : Promise.resolve(null)
      ]);
      _allList = results[0] || [];

      var uName  = (_user ? (_user.displayName || _user.email || '') : '').toLowerCase().trim();
      var uEmail = (_user ? (_user.email       || '')              : '').toLowerCase().trim();
      _myList = _allList.filter(function (uc) {
        var n = String(uc.owner_name  == null ? '' : uc.owner_name).toLowerCase().trim();
        var e = String(uc.owner_email == null ? '' : uc.owner_email).toLowerCase().trim();
        return n === uName || n === uEmail || e === uEmail || e === uName;
      });
      _exploreList = _allList.filter(function (uc) { return uc.status === 'Approved'; });

      renderMyTable(_myList);
      renderExploreTable(_exploreList);

      if (_isAdmin) {
        _dashData     = results[1] || {};
        _pendingList  = _allList.filter(function (uc) {
          return uc.status === 'Submitted' || uc.status === 'Under Review';
        });
        _rejectedList = _allList.filter(function (uc) { return uc.status === 'Rejected'; });

        _populateTeamFilter();
        _applyAllTableFilters();
        renderPendingList(_pendingList);
        updatePendingBadge(_pendingList.length);
        renderKPI(_dashData);
        renderStatusChart(_dashData.status_breakdown   || {});
        renderStackedChart('teamChart',     'team');
        renderStackedChart('categoryChart', 'category');
        renderRecentTable(_dashData.recent_submissions || []);
        renderRejectedCard(_rejectedList);
        if (_dashData.refreshed_at) updateRefreshedAt(_dashData.refreshed_at);
      }
    } catch (err) {
      showToast('Lỗi tải dữ liệu: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ── Admin: load overview ──────────────────────────────────────────
  async function _loadAdminOverview() {
    showLoading(true);
    try {
      var results = await Promise.all([
        Api.getDashboard(),
        Api.listUseCases({ filter: 'pending' })
      ]);
      _dashData    = results[0];
      _pendingList = results[1] || [];

      renderKPI(_dashData);
      renderStatusChart(_dashData.status_breakdown   || {});
      renderStackedChart('teamChart',     'team');
      renderStackedChart('categoryChart', 'category');
      renderRecentTable(_dashData.recent_submissions || []);
      updatePendingBadge(_pendingList.length);
      updateRefreshedAt(_dashData.refreshed_at);
    } catch (err) {
      showToast('Lỗi tải dữ liệu: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ── Admin: load pending ───────────────────────────────────────────
  async function _loadPending() {
    showLoading(true);
    try {
      _pendingList = (await Api.listUseCases({ filter: 'pending' })) || [];
      renderPendingList(_pendingList);
      updatePendingBadge(_pendingList.length);
    } catch (err) {
      showToast('Lỗi tải danh sách chờ duyệt: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ── Admin: load all ───────────────────────────────────────────────
  async function _loadAllUseCases() {
    showLoading(true);
    try {
      _allList = (await Api.listUseCases({ limit: 200 })) || [];
      _populateTeamFilter();
      _applyAllTableFilters();
    } catch (err) {
      showToast('Lỗi tải danh sách: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ── My Cases ──────────────────────────────────────────────────────
  async function _loadMyUseCases() {
    showLoading(true);
    try {
      var all = (await Api.listUseCases({ limit: 200 })) || [];
      var userName  = (_user ? (_user.displayName || _user.email || '') : '').toLowerCase().trim();
      var userEmail = (_user ? (_user.email || '') : '').toLowerCase().trim();
      _myList = all.filter(function (uc) {
        var n = String(uc.owner_name  == null ? '' : uc.owner_name).toLowerCase().trim();
        var e = String(uc.owner_email == null ? '' : uc.owner_email).toLowerCase().trim();
        return n === userName
            || n === userEmail
            || e === userEmail
            || e === userName;
      });
      renderMyTable(_myList);
    } catch (err) {
      showToast('Lỗi tải use case của bạn: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ── KPI ──────────────────────────────────────────────────────────
  function renderKPI(data) {
    var st      = data.status_breakdown || {};
    var pending = (st['Submitted'] || 0) + (st['Under Review'] || 0);
    var hours   = data.total_hours_saved_month || 0;
    setKPI('kpiTotal',    data.total_use_cases || 0);
    setKPI('kpiApproved', data.approved_count  || 0);
    setKPI('kpiPending',  pending);
    setKPI('kpiHours',    hours >= 1000 ? (hours / 1000).toFixed(1) + 'k' : String(Math.round(hours)));
  }

  function setKPI(id, value) {
    var card = document.getElementById(id);
    if (!card) return;
    var el = card.querySelector('.kpi-value');
    if (el) el.textContent = value;
  }

  // ── Status Chart ─────────────────────────────────────────────────
  function renderStatusChart(breakdown) {
    var container = document.getElementById('statusChart');
    if (!container) return;
    var total = objSum(breakdown);
    if (total === 0) { container.innerHTML = emptyChart(); return; }

    if (typeof Chart === 'undefined') { _renderStatusChartCSS(container, breakdown, total); return; }

    var order = ['Approved', 'Under Review', 'Submitted', 'Draft', 'Rejected', 'Archived'];
    var labels = [], data = [], colors = [], statusKeys = [];
    order.forEach(function (status) {
      var count = breakdown[status] || 0;
      if (!count) return;
      var cfg = STATUS_CFG[status] || { label: status, color: '#dadce0' };
      labels.push(cfg.label); data.push(count); colors.push(cfg.color); statusKeys.push(status);
    });

    var canvas = container.querySelector('canvas');
    if (!canvas) { container.innerHTML = '<canvas></canvas>'; canvas = container.querySelector('canvas'); }
    if (_charts.status) _charts.status.destroy();

    var capturedStatusKeys = statusKeys.slice();
    _charts.status = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: true, aspectRatio: 1.6,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: { callbacks: { label: function (ctx) { var pct = ((ctx.parsed / total) * 100).toFixed(1); return ' ' + ctx.label + ': ' + ctx.parsed + ' (' + pct + '%)'; } } }
        },
        onHover: function (event, elements) { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
        onClick: function (event, elements) {
          if (!elements.length) return;
          var status = capturedStatusKeys[elements[0].index];
          if (!status) return;
          var cfg   = STATUS_CFG[status] || { label: status };
          var items = _allList.filter(function (uc) { return uc.status === status; });
          openListModal('Trạng thái: ' + cfg.label, items);
        }
      }
    });
  }

  function _renderStatusChartCSS(container, breakdown, total) {
    var order = ['Approved', 'Under Review', 'Submitted', 'Draft', 'Rejected', 'Archived'];
    container.innerHTML = order.map(function (status) {
      var count = breakdown[status] || 0;
      if (!count) return '';
      var cfg = STATUS_CFG[status] || { label: status, color: '#dadce0' };
      var pct = ((count / total) * 100).toFixed(1);
      return _chartRow(cfg.label, pct + '%', cfg.color, count + ' (' + pct + '%)', null, false,
        'Dashboard._openListByStatus(\'' + status + '\')');
    }).join('');
  }

  // ── Breakdown Chart ───────────────────────────────────────────────
  function renderBreakdownChart(containerId, breakdown) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var entries = Object.keys(breakdown)
      .map(function (k) { return [k, breakdown[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });

    if (entries.length === 0) { container.innerHTML = emptyChart(); return; }

    var fieldKey    = containerId === 'teamChart' ? 'team' : 'category';
    var titlePrefix = containerId === 'teamChart' ? 'Team: '   : 'Lĩnh vực: ';

    if (typeof Chart === 'undefined') { _renderBreakdownChartCSS(container, entries, fieldKey, titlePrefix); return; }

    var top    = entries.slice(0, 8);
    var labels = top.map(function (e) { return e[0]; });
    var data   = top.map(function (e) { return e[1]; });
    var ratio  = containerId === 'categoryChart' ? 3.5 : 2;

    var canvas = container.querySelector('canvas');
    if (!canvas) { container.innerHTML = '<canvas></canvas>'; canvas = container.querySelector('canvas'); }
    if (_charts[containerId]) _charts[containerId].destroy();

    var capturedLabels      = labels.slice();
    var capturedFieldKey    = fieldKey;
    var capturedTitlePrefix = titlePrefix;

    _charts[containerId] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: 'rgba(123,44,191,0.72)', borderWidth: 0, borderRadius: 4 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: true, aspectRatio: ratio,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.parsed.x + ' use case'; } } } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } }, y: { ticks: { font: { size: 12 } }, grid: { display: false } } },
        onHover: function (event, elements) { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
        onClick: function (event, elements) {
          if (!elements.length) return;
          var label = capturedLabels[elements[0].index];
          if (!label) return;
          var items = _allList.filter(function (uc) {
            return String(uc[capturedFieldKey] == null ? '' : uc[capturedFieldKey]).trim() === String(label).trim();
          });
          openListModal(capturedTitlePrefix + label, items);
        }
      }
    });
  }

  function _renderBreakdownChartCSS(container, entries, fieldKey, titlePrefix) {
    var maxVal = entries[0][1] || 1;
    container.innerHTML = entries.slice(0, 8).map(function (e) {
      var label = e[0];
      var fn = fieldKey === 'team'
        ? 'Dashboard._openListByTeam(\'' + esc(label) + '\')'
        : 'Dashboard._openListByCategory(\'' + esc(label) + '\')';
      return _chartRow(label, ((e[1] / maxVal) * 100).toFixed(0) + '%', 'var(--color-primary)', String(e[1]), 'var(--color-primary-light)', true, fn);
    }).join('');
  }

  // ── Stacked Breakdown Chart (Team / Category + Status) ───────────
  function renderStackedChart(containerId, fieldKey) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Build stacked data from _allList
    var totals  = {};
    var stacked = {};
    _allList.forEach(function (uc) {
      var key = String(uc[fieldKey] == null ? '' : uc[fieldKey]).trim();
      if (!key) return;
      var status = uc.status || 'Draft';
      if (!stacked[key]) { stacked[key] = {}; totals[key] = 0; }
      stacked[key][status] = (stacked[key][status] || 0) + 1;
      totals[key]++;
    });

    var keys = Object.keys(totals)
      .sort(function (a, b) { return totals[b] - totals[a]; })
      .slice(0, 8);

    if (!keys.length) { container.innerHTML = emptyChart(); return; }

    var titlePrefix = fieldKey === 'team' ? 'Team: ' : 'Lĩnh vực: ';

    if (typeof Chart === 'undefined') {
      _renderStackedChartCSS(container, keys, stacked, totals, fieldKey, titlePrefix);
      return;
    }

    var statusOrder = ['Approved', 'Under Review', 'Submitted', 'Draft', 'Rejected', 'Archived'];
    var datasets    = [];
    statusOrder.forEach(function (status) {
      var hasData = keys.some(function (k) { return (stacked[k][status] || 0) > 0; });
      if (!hasData) return;
      var cfg = STATUS_CFG[status] || { label: status, color: '#dadce0' };
      datasets.push({
        label:           cfg.label,
        data:            keys.map(function (k) { return stacked[k][status] || 0; }),
        backgroundColor: cfg.color,
        borderWidth:     0,
        borderRadius:    2,
        _statusKey:      status
      });
    });

    var ratio  = containerId === 'categoryChart' ? 3.5 : 2;
    var canvas = container.querySelector('canvas');
    if (!canvas) { container.innerHTML = '<canvas></canvas>'; canvas = container.querySelector('canvas'); }
    if (_charts[containerId]) _charts[containerId].destroy();

    var capturedKeys        = keys.slice();
    var capturedDatasets    = datasets;
    var capturedFieldKey    = fieldKey;
    var capturedTitlePrefix = titlePrefix;

    _charts[containerId] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: keys, datasets: datasets },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: true, aspectRatio: ratio,
        plugins: {
          legend: {
            display: true, position: 'bottom',
            labels: { padding: 12, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 10 }
          },
          tooltip: {
            mode: 'index',
            callbacks: {
              label: function (ctx) {
                return ctx.parsed.x > 0 ? ' ' + ctx.dataset.label + ': ' + ctx.parsed.x : null;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { stacked: true, ticks: { font: { size: 12 } }, grid: { display: false } }
        },
        onHover: function (event, elements) { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
        onClick: function (event, elements) {
          if (!elements.length) return;
          var el       = elements[0];
          var groupKey = capturedKeys[el.index];
          var dataset  = capturedDatasets[el.datasetIndex];
          if (!groupKey || !dataset) return;
          var statusKey = dataset._statusKey;
          var items = _allList.filter(function (uc) {
            var match = String(uc[capturedFieldKey] == null ? '' : uc[capturedFieldKey]).trim() === groupKey;
            return statusKey ? (match && uc.status === statusKey) : match;
          });
          openListModal(capturedTitlePrefix + groupKey + (dataset.label ? ' — ' + dataset.label : ''), items);
        }
      }
    });
  }

  function _renderStackedChartCSS(container, keys, stacked, totals, fieldKey, titlePrefix) {
    var statusOrder = ['Approved', 'Under Review', 'Submitted', 'Draft', 'Rejected', 'Archived'];
    var maxTotal    = totals[keys[0]] || 1;
    container.innerHTML = keys.map(function (key) {
      var total = totals[key];
      var fn    = fieldKey === 'team'
        ? 'Dashboard._openListByTeam(\'' + esc(key) + '\')'
        : 'Dashboard._openListByCategory(\'' + esc(key) + '\')';
      var pct   = ((total / maxTotal) * 100).toFixed(0) + '%';
      var badges = statusOrder.map(function (status) {
        var count = stacked[key][status] || 0;
        if (!count) return '';
        var cfg = STATUS_CFG[status] || { label: status, color: '#5f6368' };
        return '<span style="background:' + cfg.color + '20;color:' + cfg.color +
          ';border:1px solid ' + cfg.color + '40;border-radius:4px;padding:1px 5px;font-size:10px;white-space:nowrap">' +
          esc(cfg.label) + ' ' + count + '</span>';
      }).filter(Boolean).join(' ');
      return '<div class="chart-row" style="cursor:pointer;flex-wrap:wrap;gap:4px" onclick="' + fn + '">' +
        '<span class="chart-row-label" title="' + esc(key) + '">' + esc(key) + '</span>' +
        '<div class="chart-bar-wrap"><div class="chart-bar" style="width:' + pct + ';background:var(--color-primary-light);border-left:3px solid var(--color-primary)"></div></div>' +
        '<span class="chart-row-count">' + total + '</span>' +
        (badges ? '<div style="width:100%;padding-left:var(--space-2);margin-top:2px;display:flex;flex-wrap:wrap;gap:4px">' + badges + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function _chartRow(label, widthPct, barColor, countText, bgColor, bordered, onclickStr) {
    var barStyle = 'width:' + widthPct + ';background:' + (bgColor || barColor);
    if (bordered) barStyle += ';border-left:3px solid ' + barColor;
    var rowAttrs = onclickStr ? ' style="cursor:pointer" onclick="' + onclickStr + '"' : '';
    return '<div class="chart-row"' + rowAttrs + '><span class="chart-row-label" title="' + esc(label) + '">' + esc(label) + '</span><div class="chart-bar-wrap"><div class="chart-bar" style="' + barStyle + '"></div></div><span class="chart-row-count">' + esc(countText) + '</span></div>';
  }

  function emptyChart() { return '<p class="empty-state-text">Chưa có dữ liệu</p>'; }

  // ── UC Cache (safe onclick without inline JSON) ───────────────────
  function _cache(uc) {
    var key = uc.record_id || uc.usecase_id || ('uc_' + Object.keys(_ucCache).length);
    _ucCache[key] = uc;
    return key;
  }
  function _btnDetail(uc, label, cls) {
    return '<button class="btn btn-sm ' + (cls||'btn-outline') + '" onclick="event.stopPropagation();Dashboard._byKey(\'' + esc(_cache(uc)) + '\')">' + label + '</button>';
  }
  function _btnApprove(uc) {
    return '<button class="btn btn-sm btn-success" onclick="event.stopPropagation();Dashboard._approveByKey(\'' + esc(_cache(uc)) + '\')">✓ Duyệt</button>';
  }
  function _btnReject(uc) {
    return '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();Dashboard._rejectByKey(\'' + esc(_cache(uc)) + '\')">✕ Từ chối</button>';
  }

  // ── Recent Submissions Table ──────────────────────────────────────
  function renderRecentTable(items) {
    var tbody = document.querySelector('#recentTable tbody');
    if (!tbody) return;
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Chưa có use case nào được nộp gần đây</td></tr>'; return; }
    tbody.innerHTML = items.map(function (uc) {
      // recent_submissions từ GAS chỉ có 4 trường, thiếu record_id/status.
      // Enrich từ _allList để openDetail() có đủ data (record_id, status, v.v.).
      var dateVal = uc.submitted_at || uc.submit_date; // preserve trước khi có thể bị ghi đè
      if (!uc.record_id && uc.usecase_id) {
        for (var i = 0; i < _allList.length; i++) {
          if (_allList[i].usecase_id === uc.usecase_id) {
            uc = Object.assign({}, _allList[i], { submitted_at: dateVal }); // giữ nguyên date gốc
            break;
          }
        }
      }
      var k = _cache(uc);
      return '<tr style="cursor:pointer" onclick="Dashboard._byKey(\'' + esc(k) + '\')">' +
        '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
        '<td>' + esc(uc.name || '') + '</td>' +
        '<td>' + esc(uc.team || '--') + '</td>' +
        '<td>' + fmtDate(uc.submitted_at || uc.submit_date) + '</td>' +
        '<td>' + _btnDetail(uc, 'Chi tiết') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ── Pending List ──────────────────────────────────────────────────
  function renderPendingList(items) {
    var container = document.getElementById('pendingList');
    if (!container) return;
    if (!items.length) { container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Không có use case nào đang chờ duyệt ✓</p></div>'; return; }
    container.innerHTML = items.map(function (uc) {
      var cfg = STATUS_CFG[uc.status] || { label: uc.status, color: '#5f6368' };
      var excerpt = uc.pain_point
        ? '<div class="pending-card-excerpt">' + esc(uc.pain_point.substring(0, 150)) + (uc.pain_point.length > 150 ? '…' : '') + '</div>'
        : '';
      return '<div class="pending-card">' +
        '<div class="pending-card-header">' +
          '<span class="id-badge">' + esc(uc.usecase_id || '--') + '</span>' +
          '<span class="status-badge" style="background:' + cfg.color + '20;color:' + cfg.color + ';border:1px solid ' + cfg.color + '40">' + cfg.label + '</span>' +
        '</div>' +
        '<div class="pending-card-title">' + esc(uc.name || 'Không có tên') + '</div>' +
        '<div class="pending-card-meta">' +
          '<span>' + esc(uc.owner_name || '--') + '</span>' +
          '<span>' + esc(uc.team || '--') + '</span>' +
          '<span>' + esc(uc.category || '--') + '</span>' +
          '<span>' + fmtDate(uc.submit_date) + '</span>' +
        '</div>' +
        excerpt +
        '<div class="pending-card-actions">' +
          _btnDetail(uc, 'Xem chi tiết') +
          _btnApprove(uc) +
          _btnReject(uc) +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── All Use Cases Table ───────────────────────────────────────────
  function renderAllTable(items) {
    var tbody = document.querySelector('#allTable tbody');
    if (!tbody) return;
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Chưa có use case nào</td></tr>'; return; }
    tbody.innerHTML = items.map(function (uc) {
      var cfg = STATUS_CFG[uc.status] || { label: uc.status, color: '#5f6368' };
      var k = _cache(uc);
      return '<tr style="cursor:pointer" onclick="Dashboard._byKey(\'' + esc(k) + '\')">' +
        '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
        '<td>' + esc(uc.name || '') + '</td>' +
        '<td>' + esc(uc.owner_name || '--') + '</td>' +
        '<td>' + esc(uc.team || '--') + '</td>' +
        '<td><span class="status-badge" style="background:' + cfg.color + '20;color:' + cfg.color + '">' + cfg.label + '</span></td>' +
        '<td>' + _btnDetail(uc, 'Chi tiết') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ── My Cases Table ────────────────────────────────────────────────
  function renderMyTable(items) {
    var tbody = document.querySelector('#myTable tbody');
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Bạn chưa có use case nào. <a href="register.html">Đăng ký ngay →</a></td></tr>';
      return;
    }
    tbody.innerHTML = items.map(function (uc) {
      var cfg = STATUS_CFG[uc.status] || { label: uc.status, color: '#5f6368' };
      var k = _cache(uc);
      return '<tr style="cursor:pointer" onclick="Dashboard._byKey(\'' + esc(k) + '\')">' +
        '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
        '<td>' + esc(uc.name || '') + '</td>' +
        '<td><span class="status-badge" style="background:' + cfg.color + '20;color:' + cfg.color + '">' + cfg.label + '</span></td>' +
        '<td>' + fmtDate(uc.submit_date || uc.submitted_at) + '</td>' +
        '<td>' + _btnDetail(uc, 'Chi tiết') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ── Explore Table ─────────────────────────────────────────────────
  function renderExploreTable(items) {
    var tbody = document.querySelector('#exploreTable tbody');
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Chưa có use case nào được duyệt</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(function (uc) {
      var k = _cache(uc);
      var scoreVal = uc.total_score || uc.auto_score || 0;
      var scoreHtml, rankHtml;
      if (scoreVal > 0) {
        var rank = (typeof ScoringEngine !== 'undefined') ? ScoringEngine.getRankInfo(scoreVal) : null;
        var c = rank ? rank.color : '#999';
        scoreHtml = '<span class="score-chip" style="background:' + c + '20;color:' + c + ';border:1px solid ' + c + '40;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600">' + scoreVal + '</span>';
        rankHtml  = rank ? '<span style="font-size:11px;font-weight:600;color:' + c + '">' + esc(rank.label) + '</span>' : '<span style="color:var(--color-text-muted);font-size:11px">--</span>';
      } else {
        scoreHtml = '<span style="color:var(--color-text-muted);font-size:12px">--</span>';
        rankHtml  = '<span style="color:var(--color-text-muted);font-size:11px">Chưa chấm</span>';
      }
      return '<tr style="cursor:pointer" onclick="Dashboard._byKey(\'' + esc(k) + '\')">' +
        '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
        '<td>' + esc(uc.name       || '') + '</td>' +
        '<td>' + esc(uc.team       || '--') + '</td>' +
        '<td>' + esc(uc.owner_name || '--') + '</td>' +
        '<td style="text-align:center">' + scoreHtml + '</td>' +
        '<td>' + rankHtml + '</td>' +
        '<td>' + esc(uc.category   || '--') + '</td>' +
        '<td>' + _btnDetail(uc, 'Xem') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ── List Popup Modal ──────────────────────────────────────────────
  function openListModal(title, items) {
    var titleEl = document.getElementById('listModalTitle');
    var countEl = document.getElementById('listModalCount');
    var body    = document.getElementById('listModalBody');
    if (!titleEl || !body) return;

    titleEl.textContent = title;
    if (countEl) countEl.textContent = (items ? items.length : 0) + ' use case';

    if (!items || !items.length) {
      body.innerHTML = '<p style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">Không có use case nào</p>';
    } else {
      var rows = items.map(function (uc) {
        var cfg = STATUS_CFG[uc.status] || { label: uc.status || '--', color: '#5f6368' };
        var k   = _cache(uc);
        return '<tr style="cursor:pointer" onclick="Dashboard._byKey(\'' + esc(k) + '\')">' +
          '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
          '<td>' + esc(uc.name || '') + '</td>' +
          '<td>' + esc(uc.owner_name || '--') + '</td>' +
          '<td>' + esc(uc.team || '--') + '</td>' +
          '<td><span class="status-badge" style="background:' + cfg.color + '20;color:' + cfg.color + '">' + cfg.label + '</span></td>' +
          '<td>' + _btnDetail(uc, 'Chi tiết') + '</td>' +
        '</tr>';
      }).join('');
      body.innerHTML =
        '<table class="dash-table" style="margin:0">' +
          '<thead><tr><th>Mã</th><th>Tên Use Case</th><th>Người đăng ký</th><th>Team</th><th>Trạng thái</th><th></th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>';
    }

    document.getElementById('listModal').classList.remove('hidden');
  }

  function _closeListModal() {
    var modal = document.getElementById('listModal');
    if (modal) modal.classList.add('hidden');
  }

  function _bindListModal() {
    var closeBtn = document.getElementById('listModalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', _closeListModal);

    var modal = document.getElementById('listModal');
    if (modal) modal.addEventListener('click', function (e) {
      if (e.target === this) _closeListModal();
    });

    // Escape: only close list modal when detail modal is not open
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var listModal = document.getElementById('listModal');
      if (!listModal || listModal.classList.contains('hidden')) return;
      var detailModal = document.getElementById('usDetailModal');
      if (detailModal && !detailModal.classList.contains('hidden')) return;
      _closeListModal();
    });
  }

  // ── All-tab Filters ───────────────────────────────────────────────
  function _initAllFilters() {
    if (!_isAdmin) return;
    var pillsContainer = document.getElementById('statusFilterPills');
    if (!pillsContainer) return;

    // Render static status pills (one per STATUS_CFG + "Tất cả" reset pill)
    var order = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Archived'];
    var allPillHtml = '<button class="filter-pill is-active" data-status="" style="--pill-color:var(--color-primary)">Tất cả</button>';
    var statusPillsHtml = order.map(function (s) {
      var cfg = STATUS_CFG[s] || { label: s, color: '#5f6368' };
      return '<button class="filter-pill" data-status="' + s + '" style="--pill-color:' + cfg.color + '">' + esc(cfg.label) + '</button>';
    }).join('');
    pillsContainer.innerHTML = allPillHtml + statusPillsHtml;

    pillsContainer.addEventListener('click', function (e) {
      var pill = e.target.closest('.filter-pill');
      if (!pill) return;
      var status = pill.dataset.status;

      if (status === '') {
        // Reset: clear all status filters
        _filterAll.statuses = [];
        pillsContainer.querySelectorAll('.filter-pill').forEach(function (p) {
          p.classList.toggle('is-active', p.dataset.status === '');
        });
      } else {
        var idx = _filterAll.statuses.indexOf(status);
        if (idx === -1) _filterAll.statuses.push(status);
        else            _filterAll.statuses.splice(idx, 1);
        pill.classList.toggle('is-active', idx === -1);
        // "Tất cả" pill: active only when nothing selected
        var allPill = pillsContainer.querySelector('[data-status=""]');
        if (allPill) allPill.classList.toggle('is-active', _filterAll.statuses.length === 0);
      }
      _applyAllTableFilters();
    });

    // Team select
    var teamSel = document.getElementById('teamFilter');
    if (teamSel) teamSel.addEventListener('change', function () {
      _filterAll.team = teamSel.value;
      _applyAllTableFilters();
    });
  }

  function _populateTeamFilter() {
    var teamSel = document.getElementById('teamFilter');
    if (!teamSel) return;
    var current = _filterAll.team;
    var teams   = [];
    _allList.forEach(function (uc) {
      if (uc.team && teams.indexOf(uc.team) === -1) teams.push(uc.team);
    });
    teams.sort();
    teamSel.innerHTML = '<option value="">Tất cả</option>' +
      teams.map(function (t) {
        return '<option value="' + esc(t) + '"' + (current === t ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
  }

  function _applyAllTableFilters() {
    var q   = String((document.getElementById('searchInput') || {}).value || '').trim().toLowerCase();
    var result = _allList.filter(function (uc) {
      if (_filterAll.statuses.length && _filterAll.statuses.indexOf(uc.status) === -1) return false;
      if (_filterAll.team && String(uc.team == null ? '' : uc.team) !== _filterAll.team) return false;
      if (q) {
        return String(uc.name       == null ? '' : uc.name).toLowerCase().includes(q)
            || String(uc.owner_name == null ? '' : uc.owner_name).toLowerCase().includes(q)
            || (uc.team       || '').toLowerCase().includes(q)
            || (uc.usecase_id || '').toLowerCase().includes(q);
      }
      return true;
    });
    // Update count badge
    var countEl = document.getElementById('allTableCount');
    if (countEl) countEl.textContent = result.length + ' / ' + _allList.length;
    renderAllTable(result);
  }

  // ── Rejected Card (Overview tab) ──────────────────────────────────
  var REJECTED_PREVIEW = 5;

  function renderRejectedCard(items) {
    var card = document.getElementById('rejectedCard');
    if (!card) return;

    card.style.display = items.length ? '' : 'none';

    var badge = document.getElementById('rejectedCountBadge');
    if (badge) badge.textContent = String(items.length);

    var viewAllBtn = document.getElementById('viewAllRejectedBtn');
    if (viewAllBtn) {
      viewAllBtn.style.display = items.length > REJECTED_PREVIEW ? '' : 'none';
      viewAllBtn.onclick = function () { openListModal('Đã từ chối', items); };
    }

    var tbody = document.querySelector('#rejectedTable tbody');
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Không có use case nào bị từ chối</td></tr>';
      return;
    }

    tbody.innerHTML = items.slice(0, REJECTED_PREVIEW).map(function (uc) {
      var k = _cache(uc);
      return '<tr style="cursor:pointer" onclick="Dashboard._byKey(\'' + esc(k) + '\')">' +
        '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
        '<td>' + esc(uc.name || '') + '</td>' +
        '<td>' + esc(uc.owner_name || '--') + '</td>' +
        '<td>' + esc(uc.team || '--') + '</td>' +
        '<td>' + fmtDate(uc.submit_date || uc.submitted_at) + '</td>' +
        '<td>' + _btnDetail(uc, 'Chi tiết') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ── KPI Drill-down ────────────────────────────────────────────────
  function _bindKPIClicks() {
    if (!_isAdmin) return;

    function makeClickable(id, getTitleAndItems) {
      var card = document.getElementById(id);
      if (!card) return;
      card.classList.add('kpi-card--clickable');
      card.addEventListener('click', function () {
        var result = getTitleAndItems();
        openListModal(result[0], result[1]);
      });
    }

    makeClickable('kpiTotal', function () {
      return ['Tất cả Use Case', _allList];
    });
    makeClickable('kpiApproved', function () {
      return ['Đã duyệt', _allList.filter(function (uc) { return uc.status === 'Approved'; })];
    });
    makeClickable('kpiPending', function () {
      return ['Chờ duyệt', _allList.filter(function (uc) {
        return uc.status === 'Submitted' || uc.status === 'Under Review';
      })];
    });
    makeClickable('kpiHours', function () {
      return ['Đã duyệt (Giờ tiết kiệm)', _allList.filter(function (uc) { return uc.status === 'Approved'; })];
    });
  }

  // ── US Detail Modal ───────────────────────────────────────────────
  function openDetail(uc) {
    // Safety net: nếu UC thiếu record_id (vd: từ recent_submissions chưa enrich),
    // tìm bản đầy đủ trong _allList theo usecase_id.
    if (!uc.record_id && uc.usecase_id && _allList.length) {
      for (var ri = 0; ri < _allList.length; ri++) {
        if (_allList[ri].usecase_id === uc.usecase_id) {
          uc = Object.assign({}, _allList[ri], { submitted_at: uc.submitted_at || uc.submit_date });
          break;
        }
      }
    }

    _detailUc     = uc;
    _detailAction = null;

    // Header
    document.getElementById('detailModalTitle').textContent = uc.name || 'Chi tiết Use Case';
    document.getElementById('detailModalId').textContent    = uc.usecase_id || '--';

    var cfg = STATUS_CFG[uc.status] || { label: uc.status || '--', color: '#5f6368' };
    var statusEl = document.getElementById('detailModalStatus');
    statusEl.textContent = cfg.label;
    statusEl.style.cssText = 'background:' + cfg.color + '20;color:' + cfg.color + ';border:1px solid ' + cfg.color + '40;flex-shrink:0';

    // Body: render with partial list data first, then fetch full data
    document.getElementById('detailView').innerHTML = _renderDetailBody(uc, false);

    // Edit button (own cases, not yet approved/rejected)
    var editBtn = document.getElementById('detailEditBtn');
    if (editBtn) {
      var canEdit = uc.record_id && ['Draft','Submitted'].includes(uc.status);
      editBtn.style.display = canEdit ? '' : 'none';
      editBtn.href = 'register.html?edit=' + encodeURIComponent(uc.record_id || uc.usecase_id || '');
    }

    // Approve/Reject buttons: admin only, on eligible statuses
    var canApprove = _isAdmin && ['Submitted', 'Under Review'].includes(uc.status);
    document.getElementById('detailApproveBtn').style.display = canApprove ? '' : 'none';
    document.getElementById('detailRejectBtn').style.display  = canApprove ? '' : 'none';

    // Copy prompt button: visible when prompt data exists
    var copyBtn = document.getElementById('detailCopyPromptBtn');
    if (copyBtn) copyBtn.style.display = _hasPromptData(uc) ? '' : 'none';

    // Reset action area
    document.getElementById('detailActionArea').style.display  = 'none';
    document.getElementById('detailModalFooter').style.display = '';
    document.getElementById('detailActionComment').value = '';
    document.getElementById('detailActionConfirmBtn').disabled = false;

    document.getElementById('usDetailModal').classList.remove('hidden');

    // Fetch full data in background (requires GAS deployed)
    if (uc.record_id) _fetchFullDetail(uc.record_id);
  }

  async function _fetchFullDetail(recordId) {
    try {
      var data = await Api.getUseCase(recordId);
      var full = _normalizeFullData(data);
      if (_detailUc && _detailUc.record_id === recordId) {
        _detailUc = Object.assign({}, _detailUc, full);
        document.getElementById('detailView').innerHTML = _renderDetailBody(_detailUc, true);
        var copyBtn = document.getElementById('detailCopyPromptBtn');
        if (copyBtn) copyBtn.style.display = _hasPromptData(_detailUc) ? '' : 'none';
      }
    } catch (_) {
      // GAS may not be deployed — partial view already shown is sufficient
    }
  }

  function _normalizeFullData(d) {
    if (!d) return {};
    return {
      record_id:            d.Record_ID              || '',
      usecase_id:           d.UseCase_ID             || '',
      name:                 d.UseCase_Name            || '',
      owner_name:           d.Owner_Name              || '',
      owner_email:          d.Owner_Email             || '',
      team:                 d.Team                    || '',
      category:             d.Business_Category       || '',
      stage:                d.Current_Stage           || '',
      status:               d.Status                  || '',
      submit_date:          d.Submit_Date             || d.Created_At || '',
      pain_point:           d.Pain_Point              || '',
      current_process:      d.Current_Process         || '',
      current_time_min:     d.Current_Time_Min        || '',
      current_problem:      d.Current_Problem         || '',
      user_type:            d.User_Type               || '',
      expected_goals:       d.Expected_Goals          || '',
      flow_description:     d.Flow_Description        || '',
      input_types:          d.Input_Types             || '',
      prompt_role:          d.Prompt_Role             || '',
      prompt_task:          d.Prompt_Task             || '',
      prompt_goal:          d.Prompt_Goal             || '',
      prompt_context:       d.Prompt_Context          || '',
      prompt_input:         d.Prompt_Input            || '',
      prompt_steps:         d.Prompt_Steps            || '',
      prompt_output_format: d.Prompt_Output_Format    || '',
      prompt_evaluation:    d.Prompt_Evaluation       || '',
      demo_status:          d.Demo_Status             || '',
      demo_link:            d.Demo_Link               || '',
      before_time_min:      d.Before_Time_Min         || '',
      after_time_min:       d.After_Time_Min          || '',
      quality_improvement:  d.Quality_Improvement     || '',
      improvement_note:     d.Improvement_Note        || '',
      reuse_level:          d.Reuse_Level             || '',
      reuse_adjustment:     d.Reuse_Adjustment        || '',
      when_to_use:          d.When_To_Use             || '',
      usage_steps:          d.Usage_Steps             || '',
      usage_notes:          d.Usage_Notes             || '',
      review_comment:       d.Review_Comment          || '',
      reviewer_email:       d.Reviewer                || d.reviewer_email || '',
      quality_score:        (parseFloat(d.Quality_Score        || d.quality_score)        || 0),
      business_value_score: (parseFloat(d.Business_Value_Score || d.business_value_score) || 0),
      innovation_score:     (parseFloat(d.Innovation_Score     || d.innovation_score)     || 0),
      auto_score:           (parseFloat(d.Auto_Score           || d.auto_score)           || 0),
      manual_score:         (parseFloat(d.Manual_Score         || d.manual_score)         || 0),
      total_score:          (parseFloat(d.Total_Score          || d.total_score)          || 0),
      rank_category:        d.Rank_Category || d.rank_category || '',
    };
  }

  function _renderDetailBody(uc, isFullData) {
    var html = '';

    // ── Section 1: Thông tin nghiệp vụ ──────────────────────────────
    html += _dsection('1', 'Thông tin nghiệp vụ', [
      _dgrid([
        ['Người đăng ký', uc.owner_name],
        ['Team',          uc.team],
        ['Lĩnh vực',      uc.category],
        ['Giai đoạn',     uc.stage],
        ['Ngày nộp',      fmtDate(uc.submit_date || uc.submitted_at)],
      ]),
      _dfield('Điểm đau nghiệp vụ', uc.pain_point,      true),
      _dfield('Quy trình hiện tại',  uc.current_process, true),
      _dgrid([
        ['Thời gian xử lý hiện tại', uc.current_time_min ? uc.current_time_min + ' phút' : ''],
        ['Hệ quả / Rủi ro',          uc.current_problem],
      ]),
      _dfield('Đối tượng sử dụng', uc.user_type,      false),
      _dfield('Mục tiêu kỳ vọng',  uc.expected_goals, false),
    ]);

    // ── Section 2: Luồng AI & Prompt ────────────────────────────────
    var s2 = _dfield('Mô tả luồng xử lý AI', uc.flow_description, true) +
             _dfield('Loại dữ liệu đầu vào',  uc.input_types,      false) +
             _dsubsec('Thiết kế Prompt', [
               _dfield('Vai trò AI (Role)',              uc.prompt_role,          true),
               _dfield('Nhiệm vụ cụ thể (Task)',         uc.prompt_task,          true),
               _dfield('Mục tiêu đầu ra (Goal)',         uc.prompt_goal,          true),
               _dfield('Ngữ cảnh bổ sung (Context)',     uc.prompt_context,       true),
               _dfield('Mô tả đầu vào (Input)',          uc.prompt_input,         true),
               _dfield('Các bước xử lý (Steps)',         uc.prompt_steps,         true),
               _dfield('Định dạng đầu ra (Output)',      uc.prompt_output_format, true),
               _dfield('Tiêu chí đánh giá (Evaluation)', uc.prompt_evaluation,   true),
             ]);
    if (s2.trim()) html += _dsection('2', 'Luồng AI & Prompt', [s2]);

    // ── Section 3: Demo & Tái sử dụng ───────────────────────────────
    var timeSaved = '';
    if (uc.before_time_min && uc.after_time_min) {
      var before = parseFloat(uc.before_time_min), after = parseFloat(uc.after_time_min);
      if (before > 0) timeSaved = ' (' + Math.round(((before - after) / before) * 100) + '% tiết kiệm)';
    }
    var s3 = _dgrid([
               ['Trạng thái demo',           uc.demo_status],
               ['Link demo / tài liệu',      uc.demo_link],
               ['Thời gian trước khi có AI', uc.before_time_min ? uc.before_time_min + ' phút' : ''],
               ['Thời gian sau khi có AI',   uc.after_time_min  ? uc.after_time_min  + ' phút' + timeSaved : ''],
             ]) +
             _dfield('Cải thiện chất lượng',                  uc.quality_improvement, true) +
             _dfield('Ghi chú thêm về hiệu quả',              uc.improvement_note,    true) +
             _dfield('Phạm vi tái sử dụng',                   uc.reuse_level,         false) +
             _dfield('Hướng dẫn điều chỉnh khi tái sử dụng', uc.reuse_adjustment,    true);
    if (s3.trim()) html += _dsection('3', 'Demo & Tái sử dụng', [s3]);

    // ── Section 4: Hướng dẫn sử dụng ────────────────────────────────
    var s4 = _dfield('Khi nào nên dùng use case này?', uc.when_to_use, true) +
             _dfield('Hướng dẫn thực hiện từng bước',  uc.usage_steps, true) +
             _dfield('Lưu ý & hạn chế',                uc.usage_notes, true);
    if (s4.trim()) html += _dsection('4', 'Hướng dẫn sử dụng', [s4]);

    // ── Section 5: Thông tin phê duyệt ──────────────────────────────
    var s5 = _dgrid([['Người duyệt', uc.reviewer_email]]) +
             _dfield('Nhận xét duyệt', uc.review_comment, true);
    if (s5.trim()) html += _dsection('✓', 'Thông tin phê duyệt', [s5], 'detail-section--review');

    // ── Section ★ Đánh giá & Điểm số ─────────────────────────────────
    (function () {
      var auto   = uc.auto_score           || 0;
      var manual = uc.manual_score         || 0;
      var total  = uc.total_score          || (auto + manual);
      var q      = uc.quality_score        || 0;
      var bv     = uc.business_value_score || 0;
      var inn    = uc.innovation_score     || 0;
      var rankInfo  = typeof ScoringEngine !== 'undefined' ? ScoringEngine.getRankInfo(total) : null;
      var hasScore  = auto > 0 || manual > 0 || q > 0 || bv > 0 || inn > 0;

      var sScore = '';
      if (!hasScore) {
        sScore = '<div class="not-scored-notice"><span class="not-scored-icon">⏳</span><span>Chưa thực hiện chấm điểm</span></div>';
      } else {
        var rankBadge = (rankInfo && total > 0)
          ? '<span class="score-rank-badge" style="background:' + rankInfo.color + '20;color:' + rankInfo.color + ';border:1px solid ' + rankInfo.color + '40">' + esc(rankInfo.label) + '</span>'
          : '';
        sScore += '<div class="score-total-row">' +
          '<div class="score-total-num"><span class="score-total-val">' + total + '</span><span class="score-total-max">&nbsp;/100</span><span class="score-total-label">Tổng điểm</span></div>' +
          rankBadge +
        '</div>';

        sScore += '<div class="score-subsections">';
        sScore += '<div class="score-subsection">' +
          '<div class="score-subsection-title">Điểm Auto <em>(hệ thống)</em>' +
            '<span class="score-val-badge">' + auto + ' / 70</span>' +
          '</div>' +
          '<p class="score-subsection-note">Tính tự động: hiệu quả thời gian · số người dùng · tái sử dụng · tần suất · tài liệu</p>' +
        '</div>';

        if (manual > 0 || q > 0 || bv > 0 || inn > 0) {
          sScore += '<div class="score-subsection">' +
            '<div class="score-subsection-title">Điểm Champion <em>(đánh giá)</em>' +
              '<span class="score-val-badge score-val-badge--champion">' + manual + ' / 30</span>' +
            '</div>' +
            '<div class="score-breakdown-grid">' +
              '<div class="score-component"><span class="score-comp-label">Chất lượng</span><span class="score-comp-val">' + q + '<span class="score-comp-max">/10</span></span></div>' +
              '<div class="score-component"><span class="score-comp-label">Giá trị KD</span><span class="score-comp-val">' + bv + '<span class="score-comp-max">/10</span></span></div>' +
              '<div class="score-component"><span class="score-comp-label">Sáng tạo</span><span class="score-comp-val">' + inn + '<span class="score-comp-max">/10</span></span></div>' +
            '</div>';
          if (uc.reviewer_email) sScore += '<div class="score-reviewer">Người đánh giá: <strong>' + esc(uc.reviewer_email) + '</strong></div>';
          if (uc.review_comment) sScore += '<div class="score-comment">' + esc(uc.review_comment) + '</div>';
          sScore += '</div>';
        } else {
          sScore += '<div class="score-subsection">' +
            '<div class="score-subsection-title">Điểm Champion <em>(đánh giá)</em></div>' +
            '<div class="not-scored-notice not-scored-notice--sm">Chưa có đánh giá từ Champion</div>' +
          '</div>';
        }
        sScore += '</div>';
      }
      html += _dsection('★', 'Đánh giá & Điểm số', [sScore], 'detail-section--score');
    })();

    // Loading hint while full data is being fetched
    if (!isFullData && uc.record_id) {
      html += '<div class="detail-loading-hint">Đang tải nội dung chi tiết từ server...</div>';
    }

    return html || '<p class="empty-state-text" style="padding:var(--space-6)">Không có dữ liệu</p>';
  }

  // ── Detail render helpers ─────────────────────────────────────────
  function _dsection(step, title, parts, extra) {
    var body = parts.join('');
    if (!body.trim()) return '';
    return '<div class="detail-section ' + (extra || '') + '">' +
      '<div class="detail-section-title">' +
        '<span class="detail-step-badge">' + step + '</span>' +
        '<span>' + esc(title) + '</span>' +
      '</div>' +
      '<div class="detail-section-body">' + body + '</div>' +
    '</div>';
  }

  function _dsubsec(title, parts) {
    var body = parts.join('');
    if (!body.trim()) return '';
    return '<div class="detail-subsection">' +
      '<div class="detail-subsection-title">' + esc(title) + '</div>' +
      '<div class="detail-section-body">' + body + '</div>' +
    '</div>';
  }

  function _dgrid(pairs) {
    var cells = pairs.filter(function (p) { return p[1] && String(p[1]).trim(); });
    if (!cells.length) return '';
    return '<div class="detail-grid-2col">' +
      cells.map(function (p) {
        return '<div class="detail-field">' +
          '<div class="detail-label">' + esc(p[0]) + '</div>' +
          '<div class="detail-value">'  + esc(String(p[1])) + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function _dfield(label, value, pre) {
    if (!value && value !== 0) return '';
    var val = String(value).trim();
    if (!val) return '';
    return '<div class="detail-field detail-field--full">' +
      '<div class="detail-label">' + esc(label) + '</div>' +
      '<div class="detail-value' + (pre ? ' detail-value--pre' : '') + '">' + esc(val) + '</div>' +
    '</div>';
  }

  function _hasPromptData(uc) {
    return !!(uc && (uc.prompt_role || uc.prompt_task || uc.prompt_goal || uc.prompt_context ||
                     uc.prompt_input || uc.prompt_steps || uc.prompt_output_format || uc.prompt_evaluation));
  }

  function _copyPrompt() {
    var uc = _detailUc;
    if (!uc) return;
    var parts = [];
    if (uc.prompt_role)          parts.push('# Vai trò (Role)\n'                     + uc.prompt_role);
    if (uc.prompt_task)          parts.push('# Nhiệm vụ (Task)\n'                    + uc.prompt_task);
    if (uc.prompt_goal)          parts.push('# Mục tiêu (Goal)\n'                    + uc.prompt_goal);
    if (uc.prompt_context)       parts.push('# Ngữ cảnh (Context)\n'                + uc.prompt_context);
    if (uc.prompt_input)         parts.push('# Đầu vào (Input)\n'                    + uc.prompt_input);
    if (uc.prompt_steps)         parts.push('# Các bước xử lý (Steps)\n'            + uc.prompt_steps);
    if (uc.prompt_output_format) parts.push('# Định dạng đầu ra (Output Format)\n'  + uc.prompt_output_format);
    if (uc.prompt_evaluation)    parts.push('# Tiêu chí đánh giá (Evaluation)\n'   + uc.prompt_evaluation);
    if (!parts.length) { showToast('Use case này chưa có nội dung prompt', 'info'); return; }
    var text = parts.join('\n\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { showToast('Đã copy prompt vào clipboard', 'success'); })
        .catch(function () { _fallbackCopy(text); });
    } else {
      _fallbackCopy(text);
    }
  }

  function _fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('Đã copy prompt vào clipboard', 'success'); }
    catch (e) { showToast('Không thể copy tự động — hãy copy thủ công từ mục Prompt', 'error'); }
    document.body.removeChild(ta);
  }

  function _bindDetailModal() {
    document.getElementById('detailModalCloseBtn').addEventListener('click', _closeDetail);
    document.getElementById('detailCloseBtn').addEventListener('click', _closeDetail);

    document.getElementById('usDetailModal').addEventListener('click', function (e) {
      if (e.target === this) _closeDetail();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') _closeDetail();
    });

    document.getElementById('detailApproveBtn').addEventListener('click', function () {
      _showActionArea('approve');
    });
    document.getElementById('detailRejectBtn').addEventListener('click', function () {
      _showActionArea('reject');
    });
    document.getElementById('detailActionCancelBtn').addEventListener('click', function () {
      document.getElementById('detailActionArea').style.display  = 'none';
      document.getElementById('detailModalFooter').style.display = '';
    });
    document.getElementById('detailActionConfirmBtn').addEventListener('click', _confirmDetailAction);
    var copyBtn = document.getElementById('detailCopyPromptBtn');
    if (copyBtn) copyBtn.addEventListener('click', _copyPrompt);
  }

  function _showActionArea(action) {
    _detailAction = action;
    var noteEl = document.getElementById('detailActionNote');
    var confirmBtn = document.getElementById('detailActionConfirmBtn');
    confirmBtn.disabled = false;
    var comment = document.getElementById('detailActionComment');
    comment.value = '';
    comment.placeholder = action === 'approve' ? 'Nhận xét (tùy chọn)...' : 'Lý do từ chối (bắt buộc)...';
    noteEl.style.display = action === 'reject' ? '' : 'none';
    confirmBtn.className = action === 'approve' ? 'btn btn-success' : 'btn btn-danger';
    confirmBtn.textContent = action === 'approve' ? '✓ Xác nhận duyệt' : '✕ Xác nhận từ chối';
    document.getElementById('detailModalFooter').style.display = 'none';
    document.getElementById('detailActionArea').style.display  = '';
  }

  async function _confirmDetailAction() {
    if (!_detailUc || !_detailAction) return;
    var comment = (document.getElementById('detailActionComment').value || '').trim();
    if (_detailAction === 'reject' && !comment) {
      showToast('Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    var confirmBtn = document.getElementById('detailActionConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Đang xử lý...';
    showLoading(true);
    try {
      var payload = {
        record_id:      _detailUc.record_id,
        reviewer_email: _user ? _user.email : '',
        comment:        comment
      };
      if (_detailAction === 'approve') {
        await Api.approveUseCase(payload);
        showToast('Đã duyệt use case thành công', 'success');
      } else {
        await Api.rejectUseCase(payload);
        showToast('Đã từ chối use case', 'info');
      }
      _closeDetail();
      _allList = []; _pendingList = []; _dashData = null;
      await _loadStartupData();
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = _detailAction === 'approve' ? '✓ Xác nhận duyệt' : '✕ Xác nhận từ chối';
    } finally {
      showLoading(false);
    }
  }

  function _closeDetail() {
    document.getElementById('usDetailModal').classList.add('hidden');
    _detailUc     = null;
    _detailAction = null;
  }

  // ── Legacy Approval Modal (kept for backward compat) ──────────────
  function _bindApprovalModal() {
    var cancelBtn  = document.getElementById('modalCancelBtn');
    var confirmBtn = document.getElementById('modalConfirmBtn');
    if (cancelBtn)  cancelBtn.addEventListener('click',  _closeModal);
    if (confirmBtn) confirmBtn.addEventListener('click', _confirmModalApproval);
    var modal = document.getElementById('approvalModal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === this) _closeModal(); });
  }

  var _modal = { action: null, recordId: null };

  function _openModalApprove(recordId, name) {
    _modal = { action: 'approve', recordId: recordId };
    document.getElementById('modalConfirmBtn').className     = 'btn btn-success';
    document.getElementById('modalConfirmBtn').textContent   = 'Xác nhận duyệt';
    document.getElementById('modalTitle').textContent        = 'Xác nhận duyệt use case';
    document.getElementById('modalBody').innerHTML           = 'Duyệt use case: <strong>' + esc(name) + '</strong>';
    document.getElementById('modalComment').value            = '';
    document.getElementById('rejectNote').classList.add('hidden');
    document.getElementById('approvalModal').classList.remove('hidden');
  }

  function _openModalReject(recordId, name) {
    _modal = { action: 'reject', recordId: recordId };
    document.getElementById('modalConfirmBtn').className     = 'btn btn-danger';
    document.getElementById('modalConfirmBtn').textContent   = 'Xác nhận từ chối';
    document.getElementById('modalTitle').textContent        = 'Từ chối use case';
    document.getElementById('modalBody').innerHTML           = 'Từ chối use case: <strong>' + esc(name) + '</strong>';
    document.getElementById('modalComment').value            = '';
    document.getElementById('rejectNote').classList.remove('hidden');
    document.getElementById('approvalModal').classList.remove('hidden');
  }

  function _closeModal() {
    document.getElementById('approvalModal').classList.add('hidden');
    _modal = { action: null, recordId: null };
  }

  async function _confirmModalApproval() {
    if (!_modal.action || !_modal.recordId) return;
    var comment    = (document.getElementById('modalComment').value || '').trim();
    var confirmBtn = document.getElementById('modalConfirmBtn');
    if (_modal.action === 'reject' && !comment) { showToast('Vui lòng nhập lý do từ chối', 'error'); return; }
    confirmBtn.disabled = true; confirmBtn.textContent = 'Đang xử lý...';
    showLoading(true);
    try {
      var payload = { record_id: _modal.recordId, reviewer_email: _user ? _user.email : '', comment: comment };
      if (_modal.action === 'approve') { await Api.approveUseCase(payload); showToast('Đã duyệt use case thành công', 'success'); }
      else                             { await Api.rejectUseCase(payload);  showToast('Đã từ chối use case', 'info'); }
      _closeModal();
      _pendingList = []; _dashData = null;
      await _loadAdminOverview();
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = _modal.action === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối';
    } finally {
      showLoading(false);
    }
  }

  // ── Search (Explore tab) ─────────────────────────────────────────
  function _bindExploreSearch() {
    var input = document.getElementById('exploreSearch');
    if (!input) return;
    input.addEventListener('input', debounce(function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { renderExploreTable(_exploreList); return; }
      renderExploreTable(_exploreList.filter(function (uc) {
        return String(uc.name       == null ? '' : uc.name).toLowerCase().includes(q)
            || String(uc.owner_name == null ? '' : uc.owner_name).toLowerCase().includes(q)
            || (uc.team     || '').toLowerCase().includes(q)
            || (uc.category || '').toLowerCase().includes(q);
      }));
    }, 300));
  }

  // ── Search (All tab) ──────────────────────────────────────────────
  function _bindSearch() {
    var input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', debounce(_applyAllTableFilters, 300));
  }

  // ── Refresh ───────────────────────────────────────────────────────
  function _bindRefresh() {
    var btn = document.getElementById('refreshBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      _allList = []; _pendingList = []; _dashData = null; _myList = []; _exploreList = [];
      _loadStartupData();
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function updatePendingBadge(count) {
    var el = document.getElementById('pendingBadge');
    if (el) el.textContent = count > 0 ? String(count) : '';
  }

  function updateRefreshedAt(ts) {
    var el = document.getElementById('refreshedAt');
    if (el && ts) el.textContent = 'Cập nhật: ' + fmtDate(ts);
  }

  function fmtDate(isoStr) {
    if (!isoStr) return '--';
    try {
      var d = new Date(isoStr);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return String(isoStr).substring(0, 10); }
  }

  function esc(str) {
    var d = document.createElement('span');
    d.textContent = String(str == null ? '' : str);
    return d.innerHTML;
  }

  function objSum(obj) {
    return Object.keys(obj).reduce(function (s, k) { return s + (obj[k] || 0); }, 0);
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function showLoading(show) {
    var el = document.getElementById('loadingOverlay');
    if (el) el.classList.toggle('hidden', !show);
  }

  function showToast(message, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    var toast  = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.setAttribute('role', 'alert');
    toast.innerHTML =
      '<span class="toast-icon" aria-hidden="true">' + (icons[type] || 'ℹ') + '</span>' +
      '<span class="toast-message">' + esc(message) + '</span>' +
      '<button class="toast-close" aria-label="Đóng" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 5000);
  }

  // ── KPI Tab ──────────────────────────────────────────────────────

  /* ISO Monday-based week key, e.g. "2026-06-02" (date of Monday) */
  function _getWeekStart(date) {
    var d = new Date(date);
    if (isNaN(d.getTime())) return null;
    var day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function _getWeekKey(date) {
    var ws = _getWeekStart(date);
    if (!ws) return null;
    var y = ws.getFullYear();
    var m = String(ws.getMonth() + 1).padStart(2, '0');
    var d = String(ws.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function _prevWeekKey(weekKey) {
    var d = new Date(weekKey);
    d.setDate(d.getDate() - 7);
    return _getWeekKey(d);
  }

  function _nextWeekKey(weekKey) {
    var d = new Date(weekKey);
    d.setDate(d.getDate() + 7);
    return _getWeekKey(d);
  }

  function _getWeekRange(weekKey) {
    var mon = new Date(weekKey);
    var sun = new Date(mon.getTime() + 6 * 24 * 3600 * 1000);
    var fmt = function (dt) {
      return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');
    };
    return fmt(mon) + ' – ' + fmt(sun);
  }

  /* Normalize: trim + lowercase for case-insensitive comparison (Tuantt4=TuanTT4=tuantt4) */
  function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /* Build per-user weekly submission counts.
     Primary source: _usersList (USERS sheet) — shows users with 0 UCs.
     Fallback: derive users from _allList only (if _usersList not yet loaded).
     UC ownership matched by: normalize(owner_email) === username (primary),
                              or normalize(owner_name) matches username / display_name (secondary). */
  function _buildKPIData() {
    // Users excluded from KPI tracking (e.g. directors who don't submit weekly)
    var excluded = (APP_CONFIG.KPI_EXCLUDED_USERS || []).map(_norm);

    // Step 1: aggregate UC stats — only Approved UCs count for KPI
    var byEmail = {}; // norm(owner_email) → {team, weeks, total, rawName}
    var byName  = {}; // norm(owner_name)  → same (secondary index)

    _allList.forEach(function (uc) {
      if (uc.status !== 'Approved') return;
      var dateStr = uc.submit_date || uc.submitted_at;
      if (!dateStr) return;
      var weekKey = _getWeekKey(new Date(dateStr));
      if (!weekKey) return;

      var eKey = _norm(uc.owner_email);
      var nKey = _norm(uc.owner_name);
      var team = uc.team || '--';
      var rawName = String(uc.owner_name == null ? '' : uc.owner_name).trim();

      function addTo(map, key) {
        if (!key) return;
        if (!map[key]) map[key] = { team: team, weeks: {}, total: 0, rawName: rawName || key };
        map[key].weeks[weekKey] = (map[key].weeks[weekKey] || 0) + 1;
        map[key].total++;
      }
      if (eKey) addTo(byEmail, eKey);
      if (nKey && nKey !== eKey) addTo(byName, nKey);
    });

    var result  = {};
    var claimed = {}; // track byEmail keys already linked to a USERS entry

    if (_usersList && _usersList.length) {
      // Step 2a: start from USERS sheet — includes users with 0 UCs
      _usersList.forEach(function (u) {
        if (u.active === false) return; // skip deactivated
        var uKey  = _norm(u.username);
        if (excluded.indexOf(uKey) !== -1) return; // skip excluded users (e.g. directors)
        var dnKey = _norm(u.display_name);
        if (!uKey) return;

        // Match: username → owner_email, then owner_name; display_name → owner_name
        var stats = byEmail[uKey] || byEmail[dnKey] || byName[uKey] || byName[dnKey] || null;
        if (stats) claimed[uKey] = true;

        result[uKey] = {
          username: uKey,
          name: u.display_name || u.username,
          team: (stats && stats.team && stats.team !== '--') ? stats.team : (u.team || '--'),
          weeks: stats ? stats.weeks : {},
          total: stats ? stats.total : 0
        };
      });

      // Step 2b: UC owners not found in USERS sheet (submitted before user management was added)
      Object.keys(byEmail).forEach(function (eKey) {
        if (claimed[eKey]) return;
        if (excluded.indexOf(eKey) !== -1) return;
        var stats = byEmail[eKey];
        result[eKey] = {
          username: eKey,
          name: stats.rawName || eKey,
          team: stats.team,
          weeks: stats.weeks,
          total: stats.total
        };
      });
    } else {
      // Fallback: derive from _allList (old behavior — only users who have submitted UCs)
      Object.keys(byEmail).forEach(function (key) {
        if (excluded.indexOf(key) !== -1) return;
        var stats = byEmail[key];
        result[key] = { username: key, name: stats.rawName || key, team: stats.team, weeks: stats.weeks, total: stats.total };
      });
      Object.keys(byName).forEach(function (key) {
        if (result[key]) return;
        if (excluded.indexOf(key) !== -1) return;
        var stats = byName[key];
        result[key] = { username: key, name: stats.rawName || key, team: stats.team, weeks: stats.weeks, total: stats.total };
      });
    }

    return result;
  }

  /* Filter _allList by owner for KPI user row drill-down */
  function _openKPIUserList(username, displayName) {
    var uKey = _norm(username);
    var dKey = _norm(displayName);
    var items = _allList.filter(function (uc) {
      var eKey = _norm(uc.owner_email);
      var nKey = _norm(uc.owner_name);
      return (uKey && (eKey === uKey || nKey === uKey)) ||
             (dKey && (eKey === dKey || nKey === dKey));
    });
    _openKPIScoreList((displayName || username) + ' — Use case', items);
  }

  /* Specialized score list popup for KPI tab — shows Auto/Champion scores per UC */
  function _openKPIScoreList(title, items) {
    var titleEl = document.getElementById('listModalTitle');
    var countEl = document.getElementById('listModalCount');
    var body    = document.getElementById('listModalBody');
    if (!titleEl || !body) return;

    titleEl.textContent = title;
    if (countEl) countEl.textContent = (items ? items.length : 0) + ' use case';

    if (!items || !items.length) {
      body.innerHTML = '<p style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">Không có use case nào</p>';
    } else {
      var rows = items.map(function (uc) {
        var cfg        = STATUS_CFG[uc.status] || { label: uc.status || '--', color: '#5f6368' };
        var autoScore  = uc.auto_score   || 0;
        var manScore   = uc.manual_score || 0;
        var totalScore = uc.total_score  || 0;
        var rankInfo   = typeof ScoringEngine !== 'undefined' ? ScoringEngine.getRankInfo(totalScore) : null;

        var autoHtml = autoScore > 0
          ? '<span style="color:var(--color-text-secondary);font-size:var(--text-sm)">' + autoScore + '<span style="color:var(--color-text-muted)">/70</span></span>'
          : '<span style="color:var(--color-text-muted)">—</span>';

        var championHtml = manScore > 0
          ? '<span class="score-chip" style="background:var(--color-primary-surface,rgba(123,44,191,.12));color:var(--color-primary)">' + manScore + '/30</span>'
          : '<span class="champion-unscored">⏳ Chưa chấm</span>';

        var totalHtml = (totalScore > 0 && rankInfo)
          ? '<span class="score-chip" style="background:' + rankInfo.color + '20;color:' + rankInfo.color + '">' + totalScore + '</span>'
          : '<span style="color:var(--color-text-muted)">—</span>';

        var rankHtml = (rankInfo && totalScore > 0)
          ? '<span style="font-size:11px;font-weight:600;color:' + rankInfo.color + '">' + esc(rankInfo.label) + '</span>'
          : '<span style="color:var(--color-text-muted);font-size:11px">—</span>';

        var comment = uc.review_comment || '';
        var commentHtml = comment
          ? '<span style="font-size:11px;color:var(--color-text-secondary);font-style:italic" title="' + esc(comment) + '">' + esc(comment.length > 50 ? comment.substring(0, 50) + '…' : comment) + '</span>'
          : '<span style="color:var(--color-text-muted);font-size:11px">—</span>';

        return '<tr>' +
          '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
          '<td>' + esc(uc.name || '') + '</td>' +
          '<td><span class="status-badge" style="background:' + cfg.color + '20;color:' + cfg.color + '">' + esc(cfg.label) + '</span></td>' +
          '<td style="text-align:center">' + autoHtml + '</td>' +
          '<td style="text-align:center">' + championHtml + '</td>' +
          '<td style="text-align:center">' + totalHtml + '</td>' +
          '<td>' + rankHtml + '</td>' +
          '<td>' + commentHtml + '</td>' +
          '<td>' + _btnDetail(uc, 'Chi tiết') + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        '<div style="overflow-x:auto">' +
        '<table class="dash-table" style="margin:0;font-size:var(--text-sm);min-width:800px">' +
          '<thead><tr>' +
            '<th>Mã</th><th>Tên Use Case</th><th>Trạng thái</th>' +
            '<th style="text-align:center">Điểm Auto</th>' +
            '<th style="text-align:center">Điểm Champion</th>' +
            '<th style="text-align:center">Tổng</th>' +
            '<th>Rank</th>' +
            '<th>Nhận xét</th>' +
            '<th></th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table></div>';
    }

    document.getElementById('listModal').classList.remove('hidden');
  }

  /* Strict streak: if no UC this week → 0; else count consecutive weeks backward */
  function _computeStreak(userEntry, currentWeekKey) {
    if (!(userEntry.weeks[currentWeekKey] >= 1)) return 0;
    var streak   = 1;
    var checkKey = _prevWeekKey(currentWeekKey);
    for (var i = 0; i < 104; i++) {
      if ((userEntry.weeks[checkKey] || 0) >= 1) { streak++; checkKey = _prevWeekKey(checkKey); }
      else break;
    }
    return streak;
  }

  /* Monthly aggregation for last 6 months */
  function _buildMonthlyKPI(userData) {
    var monthly = {};
    Object.keys(userData).forEach(function (name) {
      Object.keys(userData[name].weeks).forEach(function (weekKey) {
        var monthKey = weekKey.substring(0, 7); // "2026-06"
        monthly[monthKey] = (monthly[monthKey] || 0) + userData[name].weeks[weekKey];
      });
    });
    var keys = [];
    var now  = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return { keys: keys, counts: keys.map(function (k) { return monthly[k] || 0; }) };
  }

  function renderKPITab() {
    var container = document.getElementById('kpiTabContent');
    if (!container) return;

    if (!_allList.length) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Dữ liệu đang tải, vui lòng chờ...</p></div>';
      return;
    }

    var userData      = _buildKPIData();
    var todayWeekKey  = _getWeekKey(new Date());
    var viewedWeekKey = _kpiViewedWeek || todayWeekKey;
    var weekRange     = _getWeekRange(viewedWeekKey);
    var isCurrentWeek = viewedWeekKey === todayWeekKey;
    var weeksBack     = isCurrentWeek ? 0 : Math.round((new Date(todayWeekKey) - new Date(viewedWeekKey)) / (7 * 24 * 3600 * 1000));
    var weekLabel     = isCurrentWeek ? 'Tuần này' : weeksBack + ' tuần trước';
    var userKeys      = Object.keys(userData);

    // Enrich with streak; carry username for case-insensitive "isMe" detection
    var enriched = userKeys.map(function (key) {
      var u = userData[key];
      return {
        username: u.username || key,
        name:     u.name     || key,
        team:     u.team,
        total:    u.total,
        thisWeek: u.weeks[viewedWeekKey] || 0,
        streak:   _computeStreak(u, viewedWeekKey)
      };
    });

    var achieved    = enriched.filter(function (u) { return u.thisWeek >= 1; });
    var pctAchieved = userKeys.length ? Math.round((achieved.length / userKeys.length) * 100) : 0;
    var pctColor    = pctAchieved >= 80 ? '#4CAF50' : pctAchieved >= 50 ? '#F6B100' : '#F44336';

    // Match current user by username (= _user.email in this system) — case-insensitive
    var curUserKey  = (_user ? (_user.email || _user.displayName || '') : '').trim().toLowerCase();
    var weeklyList  = enriched.slice().sort(function (a, b) { return b.thisWeek - a.thisWeek || a.name.localeCompare(b.name); });
    var rankingList = enriched.slice().sort(function (a, b) { return b.total - a.total  || b.streak - a.streak; });
    var topStreakers = enriched.slice().sort(function (a, b) { return b.streak - a.streak; }).slice(0, 3).filter(function (u) { return u.streak > 0; });
    var medals      = ['🥇', '🥈', '🥉'];

    var html = '';

    /* ── Header bar ──────────────────────────────────── */
    html += '<div class="kpi-week-header">';

    // View mode toggle — always shown
    html += '<div class="kpi-view-toggle">' +
      '<button class="kpi-view-btn' + (_kpiViewMode === 'total' ? ' active' : '') + '" onclick="Dashboard._kpiSetView(\'total\')" title="Xem tổng hợp">Tổng</button>' +
      '<button class="kpi-view-btn' + (_kpiViewMode === 'week'  ? ' active' : '') + '" onclick="Dashboard._kpiSetView(\'week\')"  title="Xem theo tuần">Theo tuần</button>' +
    '</div>';

    // Week navigation — only in week mode
    if (_kpiViewMode === 'week') {
      html +=
        '<div class="kpi-week-nav">' +
          '<button class="kpi-nav-btn" onclick="Dashboard._kpiNav(\'prev\')" title="Tuần trước">&#8249;</button>' +
          '<div class="kpi-week-info">' +
            '<span class="kpi-week-label">' + esc(weekLabel) + '</span>' +
            '<span class="kpi-week-range">' + esc(weekRange) + '</span>' +
          '</div>' +
          '<button class="kpi-nav-btn" onclick="Dashboard._kpiNav(\'next\')" title="Tuần sau"' + (isCurrentWeek ? ' disabled' : '') + '>&#8250;</button>' +
        '</div>' +
        '<div class="kpi-week-stats">' +
          '<span class="kpi-week-achievement"><strong>' + achieved.length + ' / ' + userKeys.length + '</strong> users đạt mục tiêu</span>' +
          '<span class="kpi-week-pct" style="color:' + pctColor + '">' + pctAchieved + '%</span>' +
        '</div>' +
        '<div class="kpi-week-goal">Mục tiêu: 1 UC được duyệt / người / tuần</div>';
    }

    html += '</div>'; // end kpi-week-header

    /* ── Shared fragments ──────────────────────────── */
    var _rankingHtml = '<div class="dash-card">' +
      '<div class="dash-card-header"><h3>Bảng xếp hạng (tổng)</h3></div>' +
      '<table class="dash-table">' +
      '<thead><tr><th>#</th><th>Người đăng ký</th><th>Team</th><th>Tổng UC</th><th>Streak</th><th></th></tr></thead>' +
      '<tbody>' +
      rankingList.map(function (u, idx) {
        var isMe   = u.username === curUserKey || u.name.toLowerCase() === curUserKey;
        var rank   = idx < 3 ? medals[idx] : String(idx + 1);
        var streak = u.streak > 0
          ? '<span class="kpi-streak-badge">' + u.streak + ' 🔥</span>'
          : '<span style="color:var(--color-text-muted)">—</span>';
        return '<tr' + (isMe ? ' class="kpi-row--me"' : '') + '>' +
          '<td>' + rank + '</td>' +
          '<td>' + esc(u.name) + (isMe ? ' <span class="kpi-me-tag">bạn</span>' : '') + '</td>' +
          '<td>' + esc(u.team) + '</td>' +
          '<td><strong>' + u.total + '</strong></td>' +
          '<td>' + streak + '</td>' +
          '<td><button class="btn btn--ghost btn--sm" onclick="event.stopPropagation();Dashboard._openKPIUserList(\'' + esc(u.username) + '\',\'' + esc(u.name) + '\')">Xem US</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>' +
    '</div>';

    var _streakInner = '';
    if (!topStreakers.length) {
      _streakInner = '<p class="empty-state-text" style="padding:var(--space-6)">Chưa ai đạt chuỗi tuần liên tiếp</p>';
    } else {
      topStreakers.forEach(function (u) {
        var isMe = u.username === curUserKey || u.name.toLowerCase() === curUserKey;
        _streakInner += '<div class="kpi-streak-item' + (isMe ? ' kpi-streak-item--me' : '') + '">' +
          '<div class="kpi-streak-avatar">' + esc(u.name.charAt(0).toUpperCase()) + '</div>' +
          '<div class="kpi-streak-info">' +
            '<span class="kpi-streak-name">' + esc(u.name) + (isMe ? ' <span class="kpi-me-tag">bạn</span>' : '') + '</span>' +
            '<span class="kpi-streak-team">' + esc(u.team) + '</span>' +
          '</div>' +
          '<div class="kpi-streak-count">' + u.streak + ' 🔥 <span class="kpi-streak-unit">tuần</span></div>' +
          '<button class="btn btn--ghost btn--sm" onclick="event.stopPropagation();Dashboard._openKPIUserList(\'' + esc(u.username) + '\',\'' + esc(u.name) + '\')">Xem US</button>' +
        '</div>';
      });
    }
    var _streakHtml = '<div class="dash-card">' +
      '<div class="dash-card-header"><h3>🔥 Chuỗi tuần liên tiếp</h3></div>' +
      '<div class="kpi-streak-list">' + _streakInner + '</div>' +
    '</div>';

    var _monthChartHtml = '<div class="dash-card">' +
      '<div class="dash-card-header"><h3>KPI theo tháng (6 tháng gần nhất)</h3></div>' +
      '<div id="kpiMonthChart" class="chart-container"><canvas aria-label="Biểu đồ KPI theo tháng" role="img"></canvas></div>' +
    '</div>';

    /* ── Layout by view mode ─────────────────────── */
    if (_kpiViewMode === 'total') {
      // Ranking full-width first, then monthly chart, then streak
      html += _rankingHtml + _monthChartHtml + _streakHtml;

    } else {
      // Weekly progress first, then monthly chart, then ranking + streak side by side
      var sectionTitle = isCurrentWeek ? 'Tiến độ tuần này' : ('Tiến độ tuần ' + weekRange);
      html += '<div class="dash-card">' +
        '<div class="dash-card-header"><h3>' + esc(sectionTitle) + '</h3></div>';

      if (!weeklyList.length) {
        html += '<p class="empty-state-text" style="padding:var(--space-6)">Chưa có dữ liệu</p>';
      } else {
        html += '<table class="dash-table">' +
          '<thead><tr><th>Người đăng ký</th><th>Team</th><th>UC tuần này</th><th>Trạng thái</th><th></th></tr></thead>' +
          '<tbody>' +
          weeklyList.map(function (u) {
            var isMe  = u.username === curUserKey || u.name.toLowerCase() === curUserKey;
            var badge = u.thisWeek >= 1
              ? '<span class="kpi-badge kpi-badge--ok">✓ Đạt</span>'
              : '<span class="kpi-badge kpi-badge--no">⏳ Chưa</span>';
            return '<tr' + (isMe ? ' class="kpi-row--me"' : '') + '>' +
              '<td>' + esc(u.name) + (isMe ? ' <span class="kpi-me-tag">bạn</span>' : '') + '</td>' +
              '<td>' + esc(u.team) + '</td>' +
              '<td><strong>' + u.thisWeek + '</strong></td>' +
              '<td>' + badge + '</td>' +
              '<td><button class="btn btn--ghost btn--sm" onclick="event.stopPropagation();Dashboard._openKPIUserList(\'' + esc(u.username) + '\',\'' + esc(u.name) + '\')">Xem US</button></td>' +
            '</tr>';
          }).join('') +
          '</tbody></table>';
      }
      html += '</div>';

      html += _monthChartHtml;
      html += '<div class="dash-grid-2">' + _rankingHtml + _streakHtml + '</div>';
    }

    container.innerHTML = html;

    // Render monthly chart after DOM update
    _renderKPIMonthChart(_buildMonthlyKPI(userData));
  }

  function _renderKPIMonthChart(monthData) {
    var container = document.getElementById('kpiMonthChart');
    if (!container) return;

    var labels = monthData.keys.map(function (k) {
      var p = k.split('-');
      return 'T' + parseInt(p[1]) + '/' + p[0];
    });

    if (typeof Chart === 'undefined') {
      var maxV = Math.max.apply(null, monthData.counts) || 1;
      container.innerHTML = monthData.keys.map(function (k, i) {
        var c = monthData.counts[i];
        return _chartRow(labels[i], ((c / maxV) * 100).toFixed(0) + '%', 'var(--color-primary)', String(c), 'var(--color-primary-light)', true, null);
      }).join('');
      return;
    }

    var canvas = container.querySelector('canvas');
    if (!canvas) { container.innerHTML = '<canvas></canvas>'; canvas = container.querySelector('canvas'); }
    if (_charts.kpiMonth) _charts.kpiMonth.destroy();

    _charts.kpiMonth = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Số UC nộp',
          data: monthData.counts,
          backgroundColor: 'rgba(123,44,191,0.72)',
          borderWidth: 0,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true, aspectRatio: 3,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.parsed.y + ' UC'; } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
        }
      }
    });
  }

  // ── Users Tab ─────────────────────────────────────────────────────

  var ROLE_LABEL = { admin: 'Quản trị viên', user: 'Người dùng' };

  async function _loadUsersTab() {
    var wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    wrap.innerHTML = '<p class="empty-state">Đang tải danh sách người dùng…</p>';
    try {
      _usersList = await Api.getUsers();
      renderUsersTab(_usersList);
    } catch(e) {
      wrap.innerHTML = '<p class="empty-state" style="color:var(--color-error)">Không tải được danh sách user. Kiểm tra GAS deployment.</p>';
    }
  }

  function renderUsersTab(list) {
    var wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    if (!list || !list.length) {
      wrap.innerHTML = '<p class="empty-state">Chưa có user nào. Nhấn "Đồng bộ từ UC" để import từ dữ liệu hiện có.</p>';
      return;
    }

    var rows = list.map(function(u, i) {
      var activeHtml = u.active
        ? '<span class="status-badge" style="background:rgba(76,175,80,.12);color:#388e3c">Active</span>'
        : '<span class="status-badge" style="background:rgba(244,67,54,.1);color:#c62828">Inactive</span>';
      var roleHtml = u.role === 'admin'
        ? '<span class="status-badge" style="background:rgba(123,44,191,.12);color:#7B2CBF">Admin</span>'
        : '<span class="status-badge" style="background:rgba(164,164,178,.15);color:#6D6D7A">User</span>';
      var lastLogin = u.last_login ? u.last_login.split('T')[0] : '—';
      var key = 'u_' + i;
      _ucCache[key] = u;
      return '<tr>' +
        '<td style="font-weight:600;font-family:monospace;font-size:var(--text-sm)">' + _esc(u.username) + '</td>' +
        '<td>' + _esc(u.display_name || '—') + '</td>' +
        '<td>' + roleHtml + '</td>' +
        '<td>' + _esc(u.team || '—') + '</td>' +
        '<td>' + activeHtml + '</td>' +
        '<td style="color:var(--color-text-secondary);font-size:var(--text-xs)">' + lastLogin + '</td>' +
        '<td><button class="btn btn--ghost btn--sm" onclick="Dashboard._editUser(\'' + key + '\')" title="Chỉnh sửa">Sửa</button></td>' +
        '</tr>';
    }).join('');

    wrap.innerHTML =
      '<div style="overflow-x:auto">' +
      '<table class="data-table" style="min-width:600px">' +
      '<thead><tr>' +
        '<th>Username</th><th>Tên hiển thị</th><th>Vai trò</th><th>Team</th><th>Trạng thái</th><th>Đăng nhập cuối</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      '<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">' +
        list.length + ' user · Username luôn so sánh không phân biệt hoa thường' +
      '</p>';
  }

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _bindUsersTab() {
    // Sync button
    var syncBtn = document.getElementById('syncUsersBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async function() {
        if (!_isAdmin || !_user) return;
        syncBtn.disabled = true;
        syncBtn.textContent = 'Đang đồng bộ…';
        try {
          var res = await Api.syncUsers(_user.email);
          showToast('Đồng bộ xong: +' + (res.synced || 0) + ' user mới, ' + (res.skipped || 0) + ' đã có', 'success');
          await _loadUsersTab();
        } catch(e) {
          showToast('Lỗi sync: ' + (e.message || e), 'error');
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14" style="vertical-align:middle;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Đồng bộ từ UC';
        }
      });
    }

    // Add user button
    var addBtn = document.getElementById('addUserBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() { _openUserModal(null); });
    }

    // Modal close/cancel
    var closeBtn  = document.getElementById('userModalCloseBtn');
    var cancelBtn = document.getElementById('userModalCancelBtn');
    if (closeBtn)  closeBtn.addEventListener('click',  _closeUserModal);
    if (cancelBtn) cancelBtn.addEventListener('click', _closeUserModal);

    // Modal save
    var saveBtn = document.getElementById('userModalSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', _saveUser);

    // Close on overlay click
    var modal = document.getElementById('userModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) _closeUserModal();
      });
    }
  }

  function _openUserModal(userData) {
    var modal = document.getElementById('userModal');
    if (!modal) return;
    var isEdit = !!userData;
    document.getElementById('userModalTitle').textContent = isEdit ? 'Chỉnh sửa người dùng' : 'Thêm người dùng';
    document.getElementById('umUsername').value     = isEdit ? (userData.username || '') : '';
    document.getElementById('umUsername').readOnly  = isEdit; // username không đổi khi edit
    document.getElementById('umDisplayName').value  = isEdit ? (userData.display_name || '') : '';
    document.getElementById('umRole').value         = isEdit ? (userData.role || 'user') : 'user';
    document.getElementById('umTeam').value         = isEdit ? (userData.team  || '') : '';
    document.getElementById('umEmail').value        = isEdit ? (userData.email || '') : '';
    document.getElementById('umActive').checked     = isEdit ? !!userData.active : true;
    modal.classList.remove('hidden');
  }

  function _closeUserModal() {
    var modal = document.getElementById('userModal');
    if (modal) modal.classList.add('hidden');
  }

  async function _saveUser() {
    if (!_isAdmin || !_user) return;
    var uname = (document.getElementById('umUsername').value || '').trim();
    if (!uname) { showToast('Vui lòng nhập tên đăng nhập', 'error'); return; }

    var saveBtn = document.getElementById('userModalSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu…';

    try {
      var payload = {
        Username:     uname,
        Display_Name: (document.getElementById('umDisplayName').value || '').trim(),
        Role:         document.getElementById('umRole').value,
        Team:         (document.getElementById('umTeam').value  || '').trim(),
        Email:        (document.getElementById('umEmail').value || '').trim(),
        Active:       document.getElementById('umActive').checked,
        reviewer_email: _user.email
      };
      var res = await Api.upsertUser(payload);
      showToast(res.created ? 'Đã thêm user "' + uname + '"' : 'Đã cập nhật user "' + uname + '"', 'success');
      _closeUserModal();
      await _loadUsersTab();
    } catch(e) {
      showToast('Lỗi lưu user: ' + (e.message || e), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu';
    }
  }

  // ── Public API ────────────────────────────────────────────────────
  window.Dashboard = {
    _byKey: function (key) {
      var uc = _ucCache[key]; if (uc) openDetail(uc);
    },
    _approveByKey: function (key) {
      var uc = _ucCache[key]; if (uc) { openDetail(uc); _showActionArea('approve'); }
    },
    _rejectByKey: function (key) {
      var uc = _ucCache[key]; if (uc) { openDetail(uc); _showActionArea('reject'); }
    },
    // List modal helpers (used by CSS fallback chart onclick)
    _openListByStatus: function (status) {
      var cfg   = STATUS_CFG[status] || { label: status };
      var items = _allList.filter(function (uc) { return uc.status === status; });
      openListModal('Trạng thái: ' + cfg.label, items);
    },
    _openListByTeam: function (team) {
      var items = _allList.filter(function (uc) {
        return String(uc.team == null ? '' : uc.team).trim() === String(team).trim();
      });
      openListModal('Team: ' + team, items);
    },
    _openListByCategory: function (cat) {
      var items = _allList.filter(function (uc) {
        return String(uc.category == null ? '' : uc.category).trim() === String(cat).trim();
      });
      openListModal('Lĩnh vực: ' + cat, items);
    },
    // Legacy compat
    _openDetail:        openDetail,
    _approve:           function (recordId, name) { _openModalApprove(recordId, name); },
    _reject:            function (recordId, name) { _openModalReject(recordId, name); },
    // KPI user drill-down
    _openKPIUserList: _openKPIUserList,
    // KPI view mode toggle (total / week)
    _kpiSetView: function (mode) {
      if (mode !== 'total' && mode !== 'week') return;
      _kpiViewMode = mode;
      renderKPITab();
    },
    // KPI week navigation
    _kpiNav: function (dir) {
      var todayKey = _getWeekKey(new Date());
      var current  = _kpiViewedWeek || todayKey;
      if (dir === 'prev') {
        _kpiViewedWeek = _prevWeekKey(current);
      } else if (dir === 'next' && current !== todayKey) {
        var next = _nextWeekKey(current);
        _kpiViewedWeek = next > todayKey ? todayKey : next;
      }
      renderKPITab();
    },
    // Users tab
    _editUser: function(key) {
      var u = _ucCache[key];
      if (u) _openUserModal(u);
    }
  };

})();
