// ─────────────────────────────────────────────────────────────────
// personal-score.js — H2 Giai đoạn 3: Teamlead chấm điểm cá nhân
//
// CR 2026-08-26:
//   • Điểm NĂNG LỰC (M-KPI-2) chấm theo THÁNG (droplist kỳ); cuối kỳ = TB các tháng đã chấm.
//   • Panel hiển thị RÕ từng nhóm điểm: M-KPI-1 (US, hội đồng — chỉ đọc) · M-KPI-2 (teamlead chấm)
//     · KPI khác (khóa/lan tỏa/trừ) · KPI tổng hợp dự kiến.
//   • Slider mặc định 0 khi tháng CHƯA chấm; giữ điểm đã lưu khi SỬA tháng đã chấm.
//   • Dòng EVD (link bằng chứng ổ share) — chỉ hiển thị, không nhập.
// Teamlead chấm cho thành viên team mình (role=user). Admin chấm mọi team.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _members  = [];    // [{username, display_name, team}]
  var _scoreMap = {};     // username → aggregate row (final_score=TB, months:[...], latest fields)
  var _current  = null;   // member being scored
  var _month    = '';     // kỳ tháng đang chấm (nhãn 'Tháng MM/YYYY')
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
        if (s && s.months_scored) {
          var rank = (typeof ScoringH2 !== 'undefined') ? ScoringH2.rankInfo(s.final_score) : null;
          scoreCell  = '<span class="score-chip" style="' + (rank ? 'background:' + rank.color : '') + '">' + s.final_score + '</span>';
          statusCell = '<span style="color:var(--color-success,#2e7d32)">✓ ' + s.months_scored + ' tháng · ' + esc(s.scored_by || '') + '</span>';
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
            ((s && s.months_scored) ? 'Chấm/Sửa' : 'Chấm') + '</button></td>' +
          '</tr>';
      }).join('');
      wrap.innerHTML =
        '<table class="rq-table data-table">' +
        '<thead><tr><th>Username</th><th>Họ tên</th><th>Team</th>' +
        '<th style="text-align:center">Điểm CN (TB tháng)</th><th>Trạng thái</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>';
    }

    var countEl = document.getElementById('psResultCount');
    if (countEl) countEl.textContent = list.length + ' thành viên';

    document.getElementById('psLoading').style.display = 'none';
    document.getElementById('psContent').style.display = '';
    var bar = document.getElementById('psFilterBar'); if (bar) bar.style.display = '';
  }

  /* ── Kỳ tháng ── */
  function _populateMonths() {
    var sel = document.getElementById('psMonth');
    if (!sel || typeof ScoringH2 === 'undefined') return;
    var months = ScoringH2.h2Months();
    sel.innerHTML = months.map(function (m) {
      return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
    }).join('');
  }

  // Chi tiết tháng đã chấm của member hiện tại (nếu có).
  function _monthDetail(username, month) {
    var s = _scoreMap[username];
    if (!s || !s.months) return null;
    for (var i = 0; i < s.months.length; i++) {
      if (String(s.months[i].month) === String(month)) return s.months[i];
    }
    return null;
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

    // Kỳ mặc định = tháng hiện tại trong kỳ H2.
    _month = (typeof ScoringH2 !== 'undefined') ? ScoringH2.currentH2Month() : '';
    var monthSel = document.getElementById('psMonth');
    if (monthSel && _month) monthSel.value = _month;

    // KPI khác (nhập 1 lần — lấy giá trị mới nhất của member).
    setNum('psCourses',     s ? s.courses_completed : 0);
    setNum('psCoursesPaid', s ? s.courses_paid : 0);
    var sh = document.getElementById('psSharing'); if (sh) sh.checked = !!(s && s.sharing_achieved);
    setNum('psLate',        s ? s.milestones_late : 0);

    // EVD (đọc-only).
    _renderEvd(s ? s.evidence_link : '');

    _fillMonthSliders();     // prefill 4 tiêu chí theo tháng (0 nếu chưa chấm)
    _updateKpiOther();
    _loadUsPreview(m.username);   // M-KPI-1 (US) + tổng hợp KPI dự kiến

    var panel = document.getElementById('psPanel');
    var overlay = document.getElementById('psPanelOverlay');
    panel.style.display = ''; overlay.style.display = '';
    panel.classList.add('is-open');
  }

  // Prefill 4 slider theo tháng đang chọn: đã chấm → điểm đã lưu; chưa chấm → 0.
  function _fillMonthSliders() {
    if (!_current) return;
    var det = _monthDetail(_current.username, _month);
    var vals = det
      ? [det.diversity, det.ai_proficiency, det.product_quality, det.quantity_met]
      : [0, 0, 0, 0];
    setSlider('psSliderDiv', vals[0]); setSlider('psSliderAi', vals[1]);
    setSlider('psSliderPq', vals[2]);  setSlider('psSliderQt', vals[3]);
    var cm = document.getElementById('psComment');
    if (cm) cm.value = det ? (det.comment || '') : '';

    // Hint tháng + TB hiện tại.
    var s = _scoreMap[_current.username];
    var hint = document.getElementById('psMonthHint');
    if (hint) hint.textContent = det
      ? ('Tháng này ĐÃ chấm: ' + det.final_score + '/100 — sửa để ghi đè.')
      : 'Tháng này CHƯA chấm (mặc định 0).';
    var avgInfo = document.getElementById('psAvgInfo');
    if (avgInfo) avgInfo.textContent = (s && s.months_scored)
      ? (s.final_score + '/100 (TB ' + s.months_scored + ' tháng đã chấm)')
      : 'chưa có tháng nào';

    _updateProjected();
  }

  function setSlider(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = (val === undefined || val === null || val === '') ? 0 : val;
    if (typeof ScoreSlider !== 'undefined') ScoreSlider.refresh(el);
  }
  function setNum(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = (val === undefined || val === null || val === '') ? 0 : val;
  }
  function numVal(id) { var el = document.getElementById(id); return el ? Math.max(0, parseInt(el.value, 10) || 0) : 0; }

  function _renderEvd(link) {
    var el = document.getElementById('psEvdValue');
    if (!el) return;
    var url = String(link || '').trim();
    if (url && /^https?:\/\//i.test(url)) {
      el.innerHTML = '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url) + '</a>';
    } else if (url) {
      el.textContent = url;
    } else {
      el.textContent = 'Chưa có link bằng chứng (sẽ cập nhật ở ổ share).';
    }
  }

  // Preview M-KPI-3 (khóa học) · M-KPI-4 (lan tỏa) · điểm trừ milestone.
  function _updateKpiOther() {
    var courses = numVal('psCourses');
    var paid    = numVal('psCoursesPaid');
    var sharing = document.getElementById('psSharing');
    var late    = numVal('psLate');
    var m3 = (typeof ScoringH2 !== 'undefined') ? ScoringH2.courseScore(courses, paid) : 0;
    var m4 = (typeof ScoringH2 !== 'undefined') ? ScoringH2.sharingScore(sharing && sharing.checked) : 0;
    var pen = (typeof ScoringH2 !== 'undefined') ? ScoringH2.milestonePenalty(late) : 0;
    setTxt('psM3', m3); setTxt('psM4', m4); setTxt('psPenalty', pen);
    _updateFinalKpi();
  }

  // M-KPI-1 (US) + tổng hợp KPI dự kiến — fetch từ backend (đọc-only).
  var _usM1 = 0;
  async function _loadUsPreview(username) {
    _usM1 = 0;
    setTxt('psUsScore', '…');
    try {
      var r = await Api.getMemberKpiPreview(username);
      _usM1 = (r && typeof r.m1 === 'number') ? r.m1 : 0;
      setTxt('psUsScore', _usM1 + '/100');
      var note = document.getElementById('psUsNote');
      if (note) note.textContent = (r && r.uc_count)
        ? ('Bình quân điểm hội đồng ' + r.uc_count + ' UC do thành viên sở hữu. Teamlead không chấm mục này.')
        : 'Chưa có UC nào được hội đồng chấm. Teamlead không chấm mục này.';
    } catch (e) {
      setTxt('psUsScore', '0/100');
    }
    _updateFinalKpi();
  }

  function _vals() {
    function v(id) { var el = document.getElementById(id); return el ? parseInt(el.value, 10) : 0; }
    return { div: v('psSliderDiv'), ai: v('psSliderAi'), pq: v('psSliderPq'), qt: v('psSliderQt') };
  }

  // M-KPI-2 (điểm năng lực THÁNG đang chấm).
  function _updateProjected() {
    var v = _vals();
    var final = (typeof ScoringH2 !== 'undefined')
      ? ScoringH2.personalFinalScore(v.div, v.ai, v.pq, v.qt) : 0;
    setTxt('psProjected', final);
    var chip = document.getElementById('psRankChip');
    if (chip && typeof ScoringH2 !== 'undefined') {
      var r = ScoringH2.rankInfo(final);
      chip.textContent = r.label; chip.style.background = r.color; chip.style.display = '';
    }
    _updateFinalKpi();
  }

  // KPI tổng hợp dự kiến = M1·0.40 + M2·0.30 + M3·0.15 + M4·0.15 − trừ.
  // M2 dùng ở đây = TB các tháng đã chấm CÓ tính tháng đang chấm (thay điểm tháng này bằng giá trị slider).
  function _updateFinalKpi() {
    if (typeof ScoringH2 === 'undefined' || !_current) return;
    var v = _vals();
    var m2Month = ScoringH2.personalFinalScore(v.div, v.ai, v.pq, v.qt);

    // Gộp tháng đã chấm + ghi đè/thêm tháng hiện tại → TB.
    var s = _scoreMap[_current.username];
    var byMonth = {};
    if (s && s.months) s.months.forEach(function (mo) { byMonth[mo.month] = mo.final_score; });
    byMonth[_month] = m2Month;   // tháng đang chấm dùng giá trị slider
    var finals = Object.keys(byMonth).map(function (k) { return byMonth[k]; });
    var m2Avg = ScoringH2.personalPeriodAvg(finals);

    var m3 = ScoringH2.courseScore(numVal('psCourses'), numVal('psCoursesPaid'));
    var sh = document.getElementById('psSharing');
    var m4 = ScoringH2.sharingScore(sh && sh.checked);
    var pen = ScoringH2.milestonePenalty(numVal('psLate'));

    var finalKpi = ScoringH2.memberKpiFinal(_usM1, m2Avg, m3, m4, pen);
    setTxt('psFinalKpi', finalKpi + '/100');
    var chip = document.getElementById('psFinalRank');
    if (chip) { var r = ScoringH2.rankInfo(finalKpi); chip.textContent = r.label; chip.style.background = r.color; chip.style.display = ''; }
    var bd = document.getElementById('psFinalBreakdown');
    if (bd) bd.innerHTML = 'M1(US) ' + _usM1 + '·40% + M2 ' + m2Avg + '·30% + M3 ' + m3 + '·15% + M4 ' + m4 + '·15% − trừ ' + pen + '%';
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
    var v = _vals();
    var commentEl = document.getElementById('psComment');
    var btn = document.getElementById('psSubmitBtn');

    var sharing = document.getElementById('psSharing');
    var payload = {
      Username:        _current.username,
      Display_Name:    _current.display_name,
      Team:            _current.team,
      Month:           _month,
      Diversity:       v.div,
      AI_Proficiency:  v.ai,
      Product_Quality: v.pq,
      Quantity_Met:    v.qt,
      Courses_Completed: numVal('psCourses'),
      Courses_Paid:      numVal('psCoursesPaid'),
      Sharing_Achieved:  !!(sharing && sharing.checked),
      Milestones_Late:   numVal('psLate'),
      Comment:         commentEl ? commentEl.value.trim() : '',
      token:          AuthService.getToken(),
      reviewer_email: user.email
    };

    btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      await Api.submitPersonalScore(payload);
      showToast('Đã lưu điểm ' + (_month || 'kỳ') + '!', 'success');
      _close();
      await _load();
    } catch (e) {
      showToast('Lỗi lưu điểm: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Lưu điểm tháng này';
    }
  }

  /* ── Bind ── */
  function _bind() {
    _populateMonths();
    if (typeof ScoreSlider !== 'undefined') ScoreSlider.enhanceAll(document.getElementById('psPanel'));

    var closeBtn = document.getElementById('psPanelClose');
    if (closeBtn) closeBtn.addEventListener('click', _close);
    var overlay = document.getElementById('psPanelOverlay');
    if (overlay) overlay.addEventListener('click', _close);

    ['psSliderDiv', 'psSliderAi', 'psSliderPq', 'psSliderQt'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', _updateProjected);
    });
    var monthSel = document.getElementById('psMonth');
    if (monthSel) monthSel.addEventListener('change', function () {
      _month = monthSel.value; _fillMonthSliders();
    });
    ['psCourses', 'psCoursesPaid', 'psSharing', 'psLate'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', _updateKpiOther);
      if (el && el.type === 'checkbox') el.addEventListener('change', _updateKpiOther);
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
