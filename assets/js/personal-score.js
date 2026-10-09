// ─────────────────────────────────────────────────────────────────
// personal-score.js — Teamlead/admin xem KPI cá nhân từng người + nhập điểm trừ chậm mốc
//
// Khung D70 (2026-10-09 — tạm áp dụng bản trình 06/10): M1–M4 TỰ TÍNH ở server (KpiEngineH2.gs):
//   M1 việc lớn (OKR team + hạng mục được giao) · M2 bài tập Đạt theo tuần · M3 khóa hoàn thành + chứng chỉ
//   · M4 lan tỏa đã duyệt. Bỏ chấm 4 tiêu chí 0–10 theo tháng (D69). Teamlead chỉ nhập số mốc chậm + nhận xét
//   (ghi PERSONAL_SCORE theo tháng — engine đọc tháng mới nhất).
// Danh sách: teamlead → thành viên team mình (+ team backup); admin → MỌI người active (gồm teamlead, lãnh đạo — D54).
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _members  = [];    // [{username, display_name, team, role}]
  var _scoreMap = {};    // username → dòng PERSONAL_SCORE gộp (months[], milestones_late…)
  var _kpiMap   = {};    // username → KPI tự tính (kpi-leaderboard)
  var _current  = null;
  var _month    = '';
  var _kpi      = null;  // KPI xem trước của người đang mở
  var _filter   = { search: '', team: '' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg, type) {
    if (typeof Toast !== 'undefined') Toast.show(msg, type || 'info'); else alert(msg);
  }
  function _norm(s) { return String(s || '').trim().toLowerCase(); }
  function setTxt(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  function _fmt(n) { var v = parseFloat(n); return isNaN(v) ? '0' : String(Math.round(v * 10) / 10); }
  function _passBadge(final) {
    var ok = (parseFloat(final) || 0) >= ((typeof ScoringH2 !== 'undefined' && ScoringH2.KPI_PASS) || 70);
    return '<span class="badge ' + (ok ? 'badge-success' : 'badge-warning') + '">' + (ok ? 'Đạt' : 'Chưa đạt') + '</span>';
  }

  function _excluded() {
    return ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.KPI_EXCLUDED_USERS) || [])
      .map(function (u) { return _norm(u); });
  }

  /* ── Load ── */
  async function _load() {
    document.getElementById('psLoading').style.display = '';
    document.getElementById('psContent').style.display = 'none';
    var bar = document.getElementById('psFilterBar'); if (bar) bar.style.display = 'none';
    try {
      var res = await Promise.all([
        Api.getUsers(),
        Api.listPersonalScores(''),
        Api.getKpiLeaderboard({}).catch(function () { return null; })
      ]);
      var users = res[0] || [];
      var scores = (res[1] && res[1].scores) || [];
      var kpi = (res[2] && res[2].member_ranking) || [];

      var me = AuthService.getUser();
      var isAdmin = AuthService.isAdmin();
      var myTeam = me ? _norm(me.team) : '';
      var myBackup = ((me && me.backup_teams) || []).map(_norm);
      var excl = _excluded();

      _members = users.filter(function (u) {
        if (u.active === false) return false;
        if (excl.indexOf(_norm(u.username)) !== -1) return false;
        if (isAdmin) return true;                                     // admin: mọi role (D54)
        if (String(u.role).toLowerCase() !== 'user') return false;    // teamlead: thành viên team mình
        return _norm(u.team) === myTeam || myBackup.indexOf(_norm(u.team)) !== -1;
      }).map(function (u) {
        return { username: _norm(u.username), display_name: u.display_name || u.username, team: u.team || '',
                 role: String(u.role || 'user').toLowerCase(),
                 backup: !isAdmin && _norm(u.team) !== myTeam };
      });

      _scoreMap = {};
      scores.forEach(function (s) { _scoreMap[_norm(s.username)] = s; });
      _kpiMap = {};
      kpi.forEach(function (k) { _kpiMap[_norm(k.username)] = k; });

      _populateTeamFilter(isAdmin);
      _render();
    } catch (e) {
      var l = document.getElementById('psLoading');
      l.textContent = 'Không tải được danh sách. Kiểm tra kết nối GAS.';
      l.style.color = 'var(--color-error)';
    }
  }

  function _populateTeamFilter(isAdmin) {
    var sel = document.getElementById('psTeamFilter');
    if (!sel) return;
    if (!isAdmin) { sel.style.display = 'none'; return; }
    var teams = [];
    _members.forEach(function (m) { if (m.team && teams.indexOf(m.team) === -1) teams.push(m.team); });
    teams.sort();
    sel.innerHTML = '<option value="">Tất cả team</option>' +
      teams.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    if (_filter.team) sel.value = _filter.team;
  }

  function _render() {
    var q = _norm(_filter.search), team = _norm(_filter.team);
    var list = _members.filter(function (m) {
      if (q && _norm(m.display_name).indexOf(q) === -1 && _norm(m.username).indexOf(q) === -1) return false;
      if (team && _norm(m.team) !== team) return false;
      return true;
    });

    var wrap = document.getElementById('psTable');
    if (!list.length) {
      wrap.innerHTML = '<p class="empty-state">Không có thành viên nào.</p>';
    } else {
      var rows = list.map(function (m) {
        var k = _kpiMap[m.username];
        var cell = function (v) { return '<td style="text-align:center">' + (k ? _fmt(v) : '—') + '</td>'; };
        return '<tr data-user="' + esc(m.username) + '">' +
          '<td style="font-family:var(--font-mono,monospace);font-weight:600">' + esc(m.username) + '</td>' +
          '<td>' + esc(m.display_name) + (m.role !== 'user' ? ' <span class="badge badge-muted">' + esc(m.role) + '</span>' : '') + '</td>' +
          '<td>' + esc(m.team || '—') + (m.backup ? ' <span class="badge badge-warning">backup</span>' : '') + '</td>' +
          cell(k && k.m1) + cell(k && k.m2) + cell(k && k.m3) + cell(k && k.m4) +
          '<td style="text-align:center;font-weight:700">' + (k ? _fmt(k.final) : '—') + '</td>' +
          '<td>' + (k ? _passBadge(k.final) : '<span class="badge badge-muted">Chưa tải</span>') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" onclick="PersonalScore._open(\'' + esc(m.username) + '\');return false"><i class="fa-solid fa-magnifying-glass-chart"></i> Xem</button></td>' +
          '</tr>';
      }).join('');
      wrap.innerHTML =
        '<table class="rq-table data-table">' +
        '<thead><tr><th>Username</th><th>Họ tên</th><th>Team</th>' +
        '<th style="text-align:center">M1·40</th><th style="text-align:center">M2·30</th><th style="text-align:center">M3·15</th><th style="text-align:center">M4·15</th>' +
        '<th style="text-align:center">KPI</th><th>Tình trạng</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>';
    }

    var countEl = document.getElementById('psResultCount');
    if (countEl) countEl.textContent = list.length + ' người';

    document.getElementById('psLoading').style.display = 'none';
    document.getElementById('psContent').style.display = '';
    var bar = document.getElementById('psFilterBar'); if (bar) bar.style.display = '';
  }

  /* ── Kỳ tháng (điểm trừ ghi theo tháng; engine đọc tháng mới nhất) ── */
  function _populateMonths() {
    var sel = document.getElementById('psMonth');
    if (!sel || typeof ScoringH2 === 'undefined') return;
    sel.innerHTML = ScoringH2.h2Months().map(function (m) {
      return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
    }).join('');
  }
  function _monthDetail(username, month) {
    var s = _scoreMap[username];
    if (!s || !s.months) return null;
    for (var i = 0; i < s.months.length; i++) if (String(s.months[i].month) === String(month)) return s.months[i];
    return null;
  }

  /* ── Panel ── */
  function _open(username) {
    var m = _members.filter(function (x) { return x.username === username; })[0];
    if (!m) return;
    _current = m;
    setTxt('psMemberUser', m.username);
    setTxt('psMemberName', m.display_name);
    setTxt('psMemberMeta', 'Team: ' + (m.team || '—') + (m.backup ? ' · (team backup)' : ''));

    _month = (typeof ScoringH2 !== 'undefined') ? ScoringH2.currentH2Month() : '';
    var monthSel = document.getElementById('psMonth');
    if (monthSel && _month) monthSel.value = _month;
    var s = _scoreMap[m.username];
    var late = document.getElementById('psLate');
    if (late) late.value = s ? (s.milestones_late || 0) : 0;
    _fillMonth();

    _kpi = null;
    ['psUsScore', 'psM2', 'psFinalKpi'].forEach(function (id) { setTxt(id, '…'); });
    _loadPreview(m.username);

    var panel = document.getElementById('psPanel');
    var overlay = document.getElementById('psPanelOverlay');
    panel.style.display = ''; overlay.style.display = '';
    panel.classList.add('is-open');
  }

  function _fillMonth() {
    if (!_current) return;
    var det = _monthDetail(_current.username, _month);
    var cm = document.getElementById('psComment');
    if (cm) cm.value = det ? (det.comment || '') : '';
    _updatePenalty();
  }

  async function _loadPreview(username) {
    try {
      var r = await Api.getMemberKpiPreview(username);
      if (!_current || _current.username !== username) return;
      _kpi = r || null;
    } catch (e) { _kpi = null; }
    _renderPreview();
  }

  function _renderPreview() {
    var k = _kpi, d = (k && k.detail) || {};
    if (!k) {
      setTxt('psUsScore', '—'); setTxt('psM2', '—'); setTxt('psM3', '0'); setTxt('psM4', '0');
      setTxt('psFinalKpi', '—');
      var bd0 = document.getElementById('psFinalBreakdown'); if (bd0) bd0.textContent = 'Không tải được KPI tự tính.';
      return;
    }
    setTxt('psUsScore', _fmt(k.m1) + '%');
    setTxt('psUsNote', 'Việc lớn team: ' + (d.m1_team_ratio === null || d.m1_team_ratio === undefined ? 'chưa đo' : _fmt(d.m1_team_ratio) + '% mục tiêu → ' + _fmt(d.m1_team_score) + '%') +
      ' · Hạng mục được giao: ' + (d.m1_items_passed || 0) + '/' + (d.m1_items_assigned || 0) + ' đạt đúng hạn' +
      (d.m1_items_assigned ? '' : ' (chưa được giao — teamlead giao ở tab Việc lớn)'));
    setTxt('psM2', _fmt(k.m2) + '%');
    setTxt('psM2Note', (d.m2_pass_weeks || []).length + ' tuần có bài Đạt (tuần 40–52) · 10 bài Đạt = 100%.');
    setTxt('psM3', _fmt(k.m3));
    setTxt('psM3Note', '(' + (d.m3_courses_done || 0) + ' khóa' + (d.m3_courses_paid ? ', ' + d.m3_courses_paid + ' trả phí' : '') + ')');
    setTxt('psM4', _fmt(k.m4));
    setTxt('psM4Note', '(' + (d.m4_activities || 0) + ' hoạt động)');
    _updatePenalty();
  }

  function _updatePenalty() {
    var el = document.getElementById('psLate');
    var late = el ? Math.max(0, parseInt(el.value, 10) || 0) : 0;
    var pen = (typeof ScoringH2 !== 'undefined') ? ScoringH2.milestonePenalty(late) : 0;
    setTxt('psPenalty', pen);
    if (!_kpi || typeof ScoringH2 === 'undefined') return;
    var final = ScoringH2.memberKpiFinal(_kpi.m1, _kpi.m2, _kpi.m3, _kpi.m4, pen);
    setTxt('psFinalKpi', final + '%');
    var rk = document.getElementById('psFinalRank'); if (rk) rk.innerHTML = _passBadge(final);
    var bd = document.getElementById('psFinalBreakdown');
    if (bd) bd.textContent = 'M1 ' + _fmt(_kpi.m1) + '×40% + M2 ' + _fmt(_kpi.m2) + '×30% + M3 ' + _fmt(_kpi.m3) +
      '×15% + M4 ' + _fmt(_kpi.m4) + '×15% − trừ ' + pen + '% (tối đa 120%, đạt ≥70%).';
  }

  function _close() {
    var panel = document.getElementById('psPanel');
    var overlay = document.getElementById('psPanelOverlay');
    panel.classList.remove('is-open');
    setTimeout(function () { panel.style.display = 'none'; overlay.style.display = 'none'; }, 260);
    _current = null;
  }

  async function _submit() {
    if (!_current) return;
    var user = AuthService.getUser();
    if (!user) return;
    var commentEl = document.getElementById('psComment');
    var lateEl = document.getElementById('psLate');
    var btn = document.getElementById('psSubmitBtn');
    // Chỉ còn điểm trừ + nhận xét. Các cột 0–10/khóa/lan tỏa cũ không còn tính KPI (khung D70).
    var payload = {
      Username:        _current.username,
      Display_Name:    _current.display_name,
      Team:            _current.team,
      Month:           _month,
      Milestones_Late: lateEl ? Math.max(0, parseInt(lateEl.value, 10) || 0) : 0,
      Comment:         commentEl ? commentEl.value.trim() : '',
      token:           AuthService.getToken(),
      reviewer_email:  user.email
    };
    btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      await Api.submitPersonalScore(payload);
      showToast('Đã lưu điểm trừ + nhận xét ' + (_month || '') + '!', 'success');
      _close();
      await _load();
    } catch (e) {
      showToast('Lỗi lưu: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Lưu điểm trừ + nhận xét';
    }
  }

  /* ── Bind ── */
  function _bind() {
    _populateMonths();
    var closeBtn = document.getElementById('psPanelClose');
    if (closeBtn && !closeBtn._bound) { closeBtn.addEventListener('click', _close); closeBtn._bound = true; }
    var overlay = document.getElementById('psPanelOverlay');
    if (overlay && !overlay._bound) { overlay.addEventListener('click', _close); overlay._bound = true; }
    var monthSel = document.getElementById('psMonth');
    if (monthSel && !monthSel._bound) {
      monthSel.addEventListener('change', function () { _month = monthSel.value; _fillMonth(); });
      monthSel._bound = true;
    }
    var late = document.getElementById('psLate');
    if (late && !late._bound) { late.addEventListener('input', _updatePenalty); late._bound = true; }
    var btn = document.getElementById('psSubmitBtn');
    if (btn && !btn._bound) { btn.addEventListener('click', _submit); btn._bound = true; }

    var searchEl = document.getElementById('psSearch');
    if (searchEl && !searchEl._bound) {
      var deb;
      searchEl.addEventListener('input', function () {
        clearTimeout(deb);
        deb = setTimeout(function () { _filter.search = searchEl.value; _render(); }, 250);
      });
      searchEl._bound = true;
    }
    var teamSel = document.getElementById('psTeamFilter');
    if (teamSel && !teamSel._bound) { teamSel.addEventListener('change', function () { _filter.team = teamSel.value; _render(); }); teamSel._bound = true; }
  }

  if (window.Router) window.Router.register('personal-score', {
    title: 'KPI cá nhân từng người',
    roles: ['admin', 'champion', 'teamlead'],
    init: function () { _bind(); _load(); }
  });

  window.PersonalScore = { _open: _open };

})();
