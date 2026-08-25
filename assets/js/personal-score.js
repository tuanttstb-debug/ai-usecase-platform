// ─────────────────────────────────────────────────────────────────
// personal-score.js — H2 Giai đoạn 3: Teamlead chấm điểm cá nhân
//
// Teamlead chấm 4 tiêu chí 0–10 cho từng thành viên team mình (role=user):
//   Đa dạng 30% · Thành thạo AI 20% · Chất lượng SP 30% · Số lượng đủ 20%.
// Chấm 1 lần cuối kỳ (hạn 31/12/2026) — chấm lại = ghi đè. Admin chấm mọi team.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _members  = [];   // [{username, display_name, team}]
  var _scoreMap = {};    // username → score row
  var _current  = null;  // member being scored
  var _filter   = { search: '', team: '' };

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg, type) {
    if (typeof Toast !== 'undefined') Toast.show(msg, type || 'info'); else alert(msg);
  }
  function _norm(s) { return String(s || '').trim().toLowerCase(); }
  function setTxt(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

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
      var res = await Promise.all([ Api.getUsers(), Api.listPersonalScores('') ]);
      var users = res[0] || [];
      var scores = (res[1] && res[1].scores) || [];

      var me = AuthService.getUser();
      var isAdmin = AuthService.isAdmin();
      var myTeam = me ? _norm(me.team) : '';
      var excl = _excluded();

      _members = users.filter(function (u) {
        if (String(u.role).toLowerCase() !== 'user') return false;   // chỉ thành viên
        if (u.active === false) return false;
        if (excl.indexOf(_norm(u.username)) !== -1) return false;
        if (!isAdmin && _norm(u.team) !== myTeam) return false;      // teamlead chỉ team mình
        return true;
      }).map(function (u) {
        return { username: _norm(u.username), display_name: u.display_name || u.username, team: u.team || '' };
      });

      _scoreMap = {};
      scores.forEach(function (s) { _scoreMap[_norm(s.username)] = s; });

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
        var s = _scoreMap[m.username];
        var scoreCell, statusCell;
        if (s) {
          var rank = (typeof ScoringH2 !== 'undefined') ? ScoringH2.rankInfo(s.final_score) : null;
          scoreCell  = '<span class="score-chip" style="' + (rank ? 'background:' + rank.color : '') + '">' + s.final_score + '</span>';
          statusCell = '<span style="color:var(--color-success,#2e7d32)">✓ ' + esc(s.scored_by || '') + '</span>';
        } else {
          scoreCell  = '<span style="color:var(--color-text-muted)">—</span>';
          statusCell = '<span style="color:var(--color-text-muted)">Chưa chấm</span>';
        }
        return '<tr>' +
          '<td style="font-family:monospace;font-weight:600">' + esc(m.username) + '</td>' +
          '<td>' + esc(m.display_name) + '</td>' +
          '<td>' + esc(m.team || '—') + '</td>' +
          '<td style="text-align:center">' + scoreCell + '</td>' +
          '<td>' + statusCell + '</td>' +
          '<td><button class="btn btn--ghost btn--sm" onclick="PersonalScore._open(\'' + esc(m.username) + '\');return false">' +
            (s ? 'Sửa điểm' : 'Chấm') + '</button></td>' +
          '</tr>';
      }).join('');
      wrap.innerHTML =
        '<table class="rq-table data-table">' +
        '<thead><tr><th>Username</th><th>Họ tên</th><th>Team</th>' +
        '<th style="text-align:center">Điểm CN</th><th>Trạng thái</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>';
    }

    var countEl = document.getElementById('psResultCount');
    if (countEl) countEl.textContent = list.length + ' thành viên';

    document.getElementById('psLoading').style.display = 'none';
    document.getElementById('psContent').style.display = '';
    var bar = document.getElementById('psFilterBar'); if (bar) bar.style.display = '';
  }

  /* ── Panel ── */
  function _open(username) {
    var m = _members.filter(function (x) { return x.username === username; })[0];
    if (!m) return;
    _current = m;

    setTxt('psMemberUser', m.username);
    setTxt('psMemberName', m.display_name);
    setTxt('psMemberMeta', 'Team: ' + (m.team || '—'));

    var s = _scoreMap[m.username];
    var vals = s
      ? [s.diversity, s.ai_proficiency, s.product_quality, s.quantity_met]
      : [5, 5, 5, 5];
    setSlider('psSliderDiv', vals[0]); setSlider('psSliderAi', vals[1]);
    setSlider('psSliderPq', vals[2]);  setSlider('psSliderQt', vals[3]);
    var cm = document.getElementById('psComment');
    if (cm) cm.value = (s && s.comment) ? s.comment : '';
    _updateProjected();

    var panel = document.getElementById('psPanel');
    var overlay = document.getElementById('psPanelOverlay');
    panel.style.display = ''; overlay.style.display = '';
    panel.classList.add('is-open');
  }

  function setSlider(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = (val === undefined || val === null || val === '') ? 5 : val;
  }

  function _close() {
    var panel = document.getElementById('psPanel');
    var overlay = document.getElementById('psPanelOverlay');
    panel.classList.remove('is-open');
    setTimeout(function () { panel.style.display = 'none'; overlay.style.display = 'none'; }, 260);
    _current = null;
  }

  function _vals() {
    function v(id) { var el = document.getElementById(id); return el ? parseInt(el.value, 10) : 0; }
    return { div: v('psSliderDiv'), ai: v('psSliderAi'), pq: v('psSliderPq'), qt: v('psSliderQt') };
  }

  function _updateProjected() {
    var v = _vals();
    setTxt('psValDiv', v.div); setTxt('psValAi', v.ai); setTxt('psValPq', v.pq); setTxt('psValQt', v.qt);
    var final = (typeof ScoringH2 !== 'undefined')
      ? ScoringH2.personalFinalScore(v.div, v.ai, v.pq, v.qt) : 0;
    setTxt('psProjected', final);
    var chip = document.getElementById('psRankChip');
    if (chip && typeof ScoringH2 !== 'undefined') {
      var r = ScoringH2.rankInfo(final);
      chip.textContent = r.label; chip.style.background = r.color; chip.style.display = '';
    }
  }

  async function _submit() {
    if (!_current) return;
    var user = AuthService.getUser();
    if (!user) return;
    var v = _vals();
    var commentEl = document.getElementById('psComment');
    var btn = document.getElementById('psSubmitBtn');

    var payload = {
      Username:        _current.username,
      Display_Name:    _current.display_name,
      Team:            _current.team,
      Diversity:       v.div,
      AI_Proficiency:  v.ai,
      Product_Quality: v.pq,
      Quantity_Met:    v.qt,
      Comment:         commentEl ? commentEl.value.trim() : '',
      token:          AuthService.getToken(),
      reviewer_email: user.email
    };

    btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      await Api.submitPersonalScore(payload);
      showToast('Đã lưu điểm cá nhân!', 'success');
      _close();
      await _load();
    } catch (e) {
      showToast('Lỗi lưu điểm: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Lưu điểm cá nhân';
    }
  }

  /* ── Bind ── */
  function _bind() {
    var closeBtn = document.getElementById('psPanelClose');
    if (closeBtn) closeBtn.addEventListener('click', _close);
    var overlay = document.getElementById('psPanelOverlay');
    if (overlay) overlay.addEventListener('click', _close);

    ['psSliderDiv', 'psSliderAi', 'psSliderPq', 'psSliderQt'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', _updateProjected);
    });
    var btn = document.getElementById('psSubmitBtn');
    if (btn) btn.addEventListener('click', _submit);

    var searchEl = document.getElementById('psSearch');
    if (searchEl) {
      var deb;
      searchEl.addEventListener('input', function () {
        clearTimeout(deb);
        deb = setTimeout(function () { _filter.search = searchEl.value; _render(); }, 250);
      });
    }
    var teamSel = document.getElementById('psTeamFilter');
    if (teamSel) teamSel.addEventListener('change', function () { _filter.team = teamSel.value; _render(); });
  }

  document.addEventListener('DOMContentLoaded', function () { _bind(); _load(); });

  window.PersonalScore = { _open: _open };

})();
