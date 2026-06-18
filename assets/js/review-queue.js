(function () {
  'use strict';

  var _allUcs = [];      // full list from GAS
  var _cache  = {};      // recordId → uc
  var _currentUc = null; // uc being reviewed in the panel
  var _filterState = { search: '', team: '', section: '' };

  /* ── Utilities ── */
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showToast(msg, type) {
    if (typeof Toast !== 'undefined') Toast.show(msg, type || 'info');
    else alert(msg);
  }

  /* ── Filtering ── */
  function _filter(list) {
    var user = AuthService.getUser();
    if (!user || user.role === 'admin') return list;
    // champion: only their team
    var team = String(user.team || '').trim().toLowerCase();
    if (!team) return []; // champion with no team sees nothing
    return list.filter(function (uc) {
      return String(uc.team || '').trim().toLowerCase() === team;
    });
  }

  /* ── Queue grouping ── */
  function _group(list) {
    var pending     = []; // Submitted — not yet reviewed
    var underReview = []; // Under Review
    var done        = []; // Approved + has manual score

    list.forEach(function (uc) {
      var st = String(uc.status || '').toLowerCase();
      if (st === 'submitted') {
        pending.push(uc);
      } else if (st === 'under review') {
        underReview.push(uc);
      } else if (st === 'approved' && (uc.manual_score > 0 || uc.total_score > 0)) {
        done.push(uc);
      }
    });
    return { pending: pending, underReview: underReview, done: done };
  }

  /* ── Table rendering ── */
  function _renderQueue(containerId, badgeId, list, showScores) {
    var badge = document.getElementById(badgeId);
    if (badge) badge.textContent = list.length;

    var wrap = document.getElementById(containerId);
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = '<p class="empty-state rq-empty">Không có use case nào.</p>';
      return;
    }

    var rows = list.map(function (uc) {
      var rid = uc.record_id || uc.Record_ID || '';
      _cache[rid] = uc;

      var scoreCell = '';
      if (showScores && (uc.total_score > 0 || uc.auto_score > 0)) {
        var total = uc.total_score || 0;
        var rank  = typeof ScoringEngine !== 'undefined' ? ScoringEngine.getRankInfo(total) : null;
        scoreCell = '<span class="score-chip" style="' + (rank ? 'background:' + rank.color : '') + '">' + total + '</span>';
      } else {
        scoreCell = '<span style="color:var(--color-text-muted)">—</span>';
      }

      return '<tr>' +
        '<td style="font-family:monospace;font-size:var(--text-sm);font-weight:600">' + esc(uc.usecase_id || uc.UseCase_ID || rid) + '</td>' +
        '<td><a href="#" class="rq-name-link" onclick="ReviewQueue._open(\'' + esc(rid) + '\');return false">' + esc(uc.name || uc.Use_Case_Name || '(không tên)') + '</a></td>' +
        '<td>' + esc(uc.team || '—') + '</td>' +
        '<td>' + esc(uc.owner_name || uc.owner || '—') + '</td>' +
        '<td style="text-align:center">' + scoreCell + '</td>' +
        '<td>' +
          '<button class="btn btn--ghost btn--sm" onclick="ReviewQueue._open(\'' + esc(rid) + '\');return false">Review</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    wrap.innerHTML =
      '<table class="rq-table data-table">' +
      '<thead><tr><th>Mã</th><th>Tên Use Case</th><th>Team</th><th>Người đăng ký</th><th style="text-align:center">Điểm</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  /* ── UI Filters ── */
  function _norm(s) { return String(s || '').trim().toLowerCase(); }

  function _populateTeamFilter() {
    var sel = document.getElementById('rqTeamFilter');
    if (!sel) return;
    var user = AuthService.getUser();
    // Champion only sees their own team → no need for dropdown
    if (user && user.role !== 'admin') {
      sel.style.display = 'none';
      return;
    }
    var teams = [];
    _allUcs.forEach(function (uc) {
      var t = String(uc.team || '').trim();
      if (t && teams.indexOf(t) === -1) teams.push(t);
    });
    teams.sort();
    sel.innerHTML = '<option value="">Tất cả team</option>' +
      teams.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    if (_filterState.team) sel.value = _filterState.team;
  }

  function _applyFilters() {
    var base    = _filter(_allUcs);       // role-based
    var q       = _norm(_filterState.search);
    var team    = _norm(_filterState.team);
    var section = _filterState.section;

    var list = base.filter(function (uc) {
      if (q && _norm(uc.name).indexOf(q) === -1 && _norm(uc.usecase_id).indexOf(q) === -1) return false;
      if (team && _norm(uc.team) !== team) return false;
      return true;
    });

    var groups = _group(list);
    var total  = list.length;

    var sectionMap = {
      '':            ['rqSectionPending', 'rqSectionUnderReview', 'rqSectionDone'],
      'pending':     ['rqSectionPending'],
      'underReview': ['rqSectionUnderReview'],
      'done':        ['rqSectionDone']
    };
    var visible = sectionMap[section] || sectionMap[''];

    ['rqSectionPending', 'rqSectionUnderReview', 'rqSectionDone'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = visible.indexOf(id) !== -1 ? '' : 'none';
    });

    if (visible.indexOf('rqSectionPending')     !== -1) _renderQueue('rqTablePending',     'rqBadgePending',     groups.pending,     false);
    if (visible.indexOf('rqSectionUnderReview') !== -1) _renderQueue('rqTableUnderReview', 'rqBadgeUnderReview', groups.underReview, false);
    if (visible.indexOf('rqSectionDone')        !== -1) _renderQueue('rqTableDone',        'rqBadgeDone',        groups.done,        true);

    var countEl = document.getElementById('rqResultCount');
    if (countEl) countEl.textContent = total + ' use case';
  }

  function _bindFilters() {
    var searchEl = document.getElementById('rqSearch');
    if (searchEl) {
      var debounce;
      searchEl.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          _filterState.search = searchEl.value;
          _applyFilters();
        }, 250);
      });
    }

    var teamSel = document.getElementById('rqTeamFilter');
    if (teamSel) {
      teamSel.addEventListener('change', function () {
        _filterState.team = teamSel.value;
        _applyFilters();
      });
    }

    var pills = document.querySelectorAll('.rq-pill');
    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');
        _filterState.section = pill.getAttribute('data-section') || '';
        _applyFilters();
      });
    });
  }

  /* ── Load ── */
  async function _load() {
    document.getElementById('rqLoading').style.display = '';
    document.getElementById('rqContent').style.display = 'none';
    var filterBar = document.getElementById('rqFilterBar');
    if (filterBar) filterBar.style.display = 'none';
    try {
      var result = await Api.listUseCases({ limit: 500 });
      _allUcs = Array.isArray(result) ? result : (result.items || result.data || []);
      _populateTeamFilter();
      _render();
    } catch (e) {
      document.getElementById('rqLoading').textContent = 'Không tải được dữ liệu. Kiểm tra kết nối GAS.';
      document.getElementById('rqLoading').style.color = 'var(--color-error)';
    }
  }

  function _render() {
    _applyFilters();
    document.getElementById('rqLoading').style.display = 'none';
    document.getElementById('rqContent').style.display = '';
    var filterBar = document.getElementById('rqFilterBar');
    if (filterBar) filterBar.style.display = '';
  }

  /* ── Review Panel ── */
  function _openPanel(uc) {
    _currentUc = uc;
    var panel   = document.getElementById('reviewPanel');
    var overlay = document.getElementById('reviewPanelOverlay');

    // Fill header info
    function setTxt(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    setTxt('rpUcId',   uc.usecase_id || uc.UseCase_ID || uc.record_id || '');
    setTxt('rpUcName', uc.name || uc.Use_Case_Name || '');
    setTxt('rpUcMeta', (uc.team || '') + (uc.owner ? ' · ' + uc.owner : ''));

    // Auto score
    var autoScore = uc.auto_score || 0;
    setTxt('rpAutoScore', autoScore);

    // Reset sliders to existing values or defaults
    var q   = Math.min(10, Math.max(0, parseInt(uc.quality_score   || uc.Quality_Score   || 5, 10)));
    var bv  = Math.min(10, Math.max(0, parseInt(uc.business_value_score || uc.Business_Value_Score || 5, 10)));
    var inn = Math.min(10, Math.max(0, parseInt(uc.innovation_score || uc.Innovation_Score || 5, 10)));

    var sQ   = document.getElementById('rpSliderQuality');
    var sBiz = document.getElementById('rpSliderBiz');
    var sInn = document.getElementById('rpSliderInn');
    if (sQ)   { sQ.value   = q;   setTxt('rpValQuality', q); }
    if (sBiz) { sBiz.value = bv;  setTxt('rpValBiz', bv); }
    if (sInn) { sInn.value = inn; setTxt('rpValInn', inn); }

    // Reset comment
    var commentEl = document.getElementById('rpComment');
    if (commentEl) commentEl.value = '';

    _updateProjectedScore();

    panel.style.display   = '';
    overlay.style.display = '';
    panel.classList.add('is-open');
  }

  function _closePanel() {
    var panel   = document.getElementById('reviewPanel');
    var overlay = document.getElementById('reviewPanelOverlay');
    panel.classList.remove('is-open');
    setTimeout(function () {
      panel.style.display   = 'none';
      overlay.style.display = 'none';
    }, 260);
    _currentUc = null;
  }

  function _updateProjectedScore() {
    if (!_currentUc) return;
    var sQ   = document.getElementById('rpSliderQuality');
    var sBiz = document.getElementById('rpSliderBiz');
    var sInn = document.getElementById('rpSliderInn');
    var q   = sQ   ? parseInt(sQ.value, 10)   : 0;
    var bv  = sBiz ? parseInt(sBiz.value, 10)  : 0;
    var inn = sInn ? parseInt(sInn.value, 10)  : 0;

    var auto  = _currentUc.auto_score || 0;
    var total = Math.min(100, auto + q + bv + inn);

    function setTxt(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    setTxt('rpProjectedTotal', total);
    setTxt('rpValQuality', q);
    setTxt('rpValBiz', bv);
    setTxt('rpValInn', inn);

    var chip = document.getElementById('rpRankChip');
    if (chip && typeof ScoringEngine !== 'undefined') {
      var rank = ScoringEngine.getRankInfo(total);
      chip.textContent      = rank.label;
      chip.style.background = rank.color;
      chip.style.display    = '';
    }
  }

  async function _submitReview() {
    if (!_currentUc) return;
    var user = AuthService.getUser();
    if (!user) return;

    var sQ   = document.getElementById('rpSliderQuality');
    var sBiz = document.getElementById('rpSliderBiz');
    var sInn = document.getElementById('rpSliderInn');
    var commentEl = document.getElementById('rpComment');
    var submitBtn = document.getElementById('rpSubmitBtn');

    var payload = {
      Record_ID:             _currentUc.record_id || _currentUc.Record_ID,
      Quality_Score:         parseInt(sQ   ? sQ.value   : 0, 10),
      Business_Value_Score:  parseInt(sBiz ? sBiz.value : 0, 10),
      Innovation_Score:      parseInt(sInn ? sInn.value : 0, 10),
      Review_Comment:        commentEl ? commentEl.value.trim() : '',
      reviewer_email:        user.email
    };

    if (!payload.Record_ID) { showToast('Không xác định được Record_ID', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang gửi…';
    try {
      await Api.submitChampionReview(payload);
      showToast('Đã gửi đánh giá thành công!', 'success');
      _closePanel();
      await _load();
    } catch (e) {
      showToast('Lỗi gửi đánh giá: ' + (e.message || e), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi đánh giá';
    }
  }

  /* ── Bind ── */
  function _bind() {
    // Panel close
    var closeBtn = document.getElementById('reviewPanelClose');
    if (closeBtn) closeBtn.addEventListener('click', _closePanel);
    var overlay = document.getElementById('reviewPanelOverlay');
    if (overlay) overlay.addEventListener('click', _closePanel);

    // Slider live updates
    ['rpSliderQuality', 'rpSliderBiz', 'rpSliderInn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', _updateProjectedScore);
    });

    // Submit
    var submitBtn = document.getElementById('rpSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', _submitReview);
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    _bind();
    _bindFilters();
    _load();
  });

  /* ── Public API ── */
  window.ReviewQueue = {
    _open: function (recordId) {
      var uc = _cache[recordId];
      if (uc) _openPanel(uc);
    }
  };

})();
