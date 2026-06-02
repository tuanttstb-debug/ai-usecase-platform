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
  var _charts      = {};
  var _detailUc    = null;
  var _detailAction = null; // 'approve' | 'reject'
  var _ucCache     = {}; // key → uc object (safe alternative to inline JSON)

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

    // Determine initial tab from URL param
    var sp       = new URLSearchParams(window.location.search);
    var initTab  = sp.get('tab') || (_isAdmin ? 'overview' : 'my');
    _activateTab(initTab);

    // Load data for initial tab
    _loadTabData(initTab);
  });

  // ── Layout setup (role-based visibility) ─────────────────────────
  function _setupLayout() {
    if (_isAdmin) {
      // Show KPI row
      var kpiRow = document.getElementById('kpiRow');
      if (kpiRow) kpiRow.style.display = '';

      // Show admin tabs
      document.querySelectorAll('.admin-only').forEach(function (el) {
        el.style.display = '';
      });

      // Show Dashboard nav item
      var navDash = document.getElementById('navDashboard');
      if (navDash) navDash.style.display = '';

      // Show refresh button
      var refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) refreshBtn.style.display = '';

      // Update topbar title
      var title = document.getElementById('topbarTitle');
      if (title) title.textContent = 'Dashboard Quản lý';
    } else {
      // Regular user: topbar shows "Use Case của tôi"
      var title2 = document.getElementById('topbarTitle');
      if (title2) title2.textContent = 'Use Case của tôi';
    }
  }

  // ── Populate sidebar user info ────────────────────────────────────
  function _populateSidebar() {
    if (!_user) return;
    var initials = (_user.displayName || _user.email || '?').charAt(0).toUpperCase();
    function setEl(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    setEl('sidebarAvatar',   initials);
    setEl('sidebarUserName', _user.displayName || _user.email);
    setEl('sidebarUserRole', _isAdmin ? 'Admin' : 'Người dùng');
    setEl('topbarAvatar',    initials);
    setEl('topbarUserName',  _user.displayName || _user.email);
    var chip = document.getElementById('topbarUserChip'); if (chip) chip.style.display = '';

    // Logout
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
      renderBreakdownChart('teamChart',     _dashData.team_breakdown     || {});
      renderBreakdownChart('categoryChart', _dashData.category_breakdown || {});
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
      renderAllTable(_allList);
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
    var labels = [], data = [], colors = [];
    order.forEach(function (status) {
      var count = breakdown[status] || 0;
      if (!count) return;
      var cfg = STATUS_CFG[status] || { label: status, color: '#dadce0' };
      labels.push(cfg.label); data.push(count); colors.push(cfg.color);
    });

    var canvas = container.querySelector('canvas');
    if (!canvas) { container.innerHTML = '<canvas></canvas>'; canvas = container.querySelector('canvas'); }
    if (_charts.status) _charts.status.destroy();

    _charts.status = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: true, aspectRatio: 1.6,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: { callbacks: { label: function (ctx) { var pct = ((ctx.parsed / total) * 100).toFixed(1); return ' ' + ctx.label + ': ' + ctx.parsed + ' (' + pct + '%)'; } } }
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
      return _chartRow(cfg.label, pct + '%', cfg.color, count + ' (' + pct + '%)');
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

    if (typeof Chart === 'undefined') { _renderBreakdownChartCSS(container, entries); return; }

    var top    = entries.slice(0, 8);
    var labels = top.map(function (e) { return e[0]; });
    var data   = top.map(function (e) { return e[1]; });
    var ratio  = containerId === 'categoryChart' ? 3.5 : 2;

    var canvas = container.querySelector('canvas');
    if (!canvas) { container.innerHTML = '<canvas></canvas>'; canvas = container.querySelector('canvas'); }
    if (_charts[containerId]) _charts[containerId].destroy();

    _charts[containerId] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: 'rgba(123,44,191,0.72)', borderWidth: 0, borderRadius: 4 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: true, aspectRatio: ratio,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.parsed.x + ' use case'; } } } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } }, y: { ticks: { font: { size: 12 } }, grid: { display: false } } }
      }
    });
  }

  function _renderBreakdownChartCSS(container, entries) {
    var maxVal = entries[0][1] || 1;
    container.innerHTML = entries.slice(0, 8).map(function (e) {
      return _chartRow(e[0], ((e[1] / maxVal) * 100).toFixed(0) + '%', 'var(--color-primary)', String(e[1]), 'var(--color-primary-light)', true);
    }).join('');
  }

  function _chartRow(label, widthPct, barColor, countText, bgColor, bordered) {
    var barStyle = 'width:' + widthPct + ';background:' + (bgColor || barColor);
    if (bordered) barStyle += ';border-left:3px solid ' + barColor;
    return '<div class="chart-row"><span class="chart-row-label" title="' + esc(label) + '">' + esc(label) + '</span><div class="chart-bar-wrap"><div class="chart-bar" style="' + barStyle + '"></div></div><span class="chart-row-count">' + esc(countText) + '</span></div>';
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
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Chưa có use case nào được nộp gần đây</td></tr>'; return; }
    tbody.innerHTML = items.map(function (uc) {
      var k = _cache(uc);
      return '<tr style="cursor:pointer" onclick="Dashboard._byKey(\'' + esc(k) + '\')">' +
        '<td><span class="id-badge">' + esc(uc.usecase_id || '--') + '</span></td>' +
        '<td>' + esc(uc.name || '') + '</td>' +
        '<td>' + esc(uc.team || '--') + '</td>' +
        '<td>' + fmtDate(uc.submitted_at) + '</td>' +
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

  // ── US Detail Modal ───────────────────────────────────────────────
  function openDetail(uc) {
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

    // Reset action area
    document.getElementById('detailActionArea').style.display  = 'none';
    document.getElementById('detailModalFooter').style.display = '';
    document.getElementById('detailActionComment').value = '';

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
  }

  function _showActionArea(action) {
    _detailAction = action;
    var noteEl = document.getElementById('detailActionNote');
    var confirmBtn = document.getElementById('detailActionConfirmBtn');
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
      // Reload pending + overview
      _pendingList = [];
      _dashData    = null;
      await _loadAdminOverview();
      if (document.getElementById('tab-pending') && !document.getElementById('tab-pending').classList.contains('hidden')) {
        await _loadPending();
      }
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

  // ── Search (All tab) ──────────────────────────────────────────────
  function _bindSearch() {
    var input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', debounce(function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { renderAllTable(_allList); return; }
      renderAllTable(_allList.filter(function (uc) {
        return String(uc.name       == null ? '' : uc.name).toLowerCase().includes(q)
            || String(uc.owner_name == null ? '' : uc.owner_name).toLowerCase().includes(q)
            || (uc.team       || '').toLowerCase().includes(q)
            || (uc.usecase_id || '').toLowerCase().includes(q);
      }));
    }, 300));
  }

  // ── Refresh ───────────────────────────────────────────────────────
  function _bindRefresh() {
    var btn = document.getElementById('refreshBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      _allList = []; _pendingList = []; _dashData = null;
      _loadAdminOverview();
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
    // Legacy compat
    _openDetail:        openDetail,
    _approve:           function (recordId, name) { _openModalApprove(recordId, name); },
    _reject:            function (recordId, name) { _openModalReject(recordId, name); }
  };

})();
