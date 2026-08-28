// ─────────────────────────────────────────────────────────────────
// review-queue.js — H2 Giai đoạn 3: Hội đồng chấm điểm US
//
// Hội đồng (4 teamlead, APP_CONFIG.COUNCIL_USERS) chấm mỗi UC ĐÃ DUYỆT theo 3 tiêu chí
// 0–10 (Tiết kiệm 30% · Tự động 40% · Sáng tạo 30%). Điểm US cuối = bình quân điểm
// các thành viên đã chấm. Mỗi thành viên 1 dòng/UC (chấm lại = ghi đè).
//
// 3 nhóm (theo góc nhìn người đang đăng nhập):
//   pending     — UC duyệt, chưa đủ hội đồng & BẠN chưa chấm  → "Cần bạn chấm"
//   underReview — UC duyệt, BẠN đã chấm nhưng chưa đủ hội đồng → "Đã chấm — chờ đủ"
//   done        — UC duyệt, đã đủ hội đồng (đủ số thành viên)   → "Đã đủ hội đồng"
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _allUcs   = [];    // full list from GAS (đã lọc Approved)
  var _cache    = {};    // recordId → uc
  var _progress = {};    // recordId → { count, final, reviewers[] }
  var _councilSize = 4;
  var _currentUc = null; // uc being scored in the panel
  var _filterState = { search: '', team: '', owner: '', section: '' };

  /* ── Utilities ── */
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg, type) {
    if (typeof Toast !== 'undefined') Toast.show(msg, type || 'info');
    else alert(msg);
  }
  function _norm(s) { return String(s || '').trim().toLowerCase(); }
  function _myUsername() {
    var u = AuthService.getUser();
    return u ? _norm(u.email) : '';
  }
  function _canScore() {
    return AuthService.isCouncil() || AuthService.isAdmin();
  }
  function _rid(uc) { return uc.record_id || uc.Record_ID || ''; }

  /* ── Filtering (council + admin thấy TẤT CẢ — hội đồng chấm mọi UC) ── */
  function _filter(list) { return list; }

  /* ── Queue grouping theo tiến độ hội đồng + góc nhìn người dùng ── */
  function _group(list) {
    var me = _myUsername();
    var pending = [], waiting = [], done = [];
    list.forEach(function (uc) {
      var p = _progress[_rid(uc)] || { count: 0, reviewers: [] };
      var scoredByMe = (p.reviewers || []).indexOf(me) !== -1;
      if (p.count >= _councilSize) done.push(uc);
      else if (scoredByMe)        waiting.push(uc);
      else                        pending.push(uc);
    });
    return { pending: pending, underReview: waiting, done: done };
  }

  /* ── Table rendering ── */
  function _renderQueue(containerId, badgeId, list) {
    var badge = document.getElementById(badgeId);
    if (badge) badge.textContent = list.length;

    var wrap = document.getElementById(containerId);
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = '<p class="empty-state rq-empty">Không có use case nào.</p>';
      return;
    }

    var rows = list.map(function (uc) {
      var rid = _rid(uc);
      _cache[rid] = uc;
      var p = _progress[rid] || { count: 0, final: 0 };

      var scoreCell;
      if (p.count > 0) {
        var rank = (typeof ScoringH2 !== 'undefined') ? ScoringH2.rankInfo(p.final) : null;
        scoreCell = '<span class="score-chip" style="' + (rank ? 'background:' + rank.color : '') + '">' + p.final + '</span>';
      } else {
        scoreCell = '<span style="color:var(--color-text-muted)">—</span>';
      }
      var progCell = '<span style="font-weight:600">' + p.count + '</span>' +
                     '<span style="color:var(--color-text-muted)">/' + _councilSize + '</span>';

      return '<tr>' +
        '<td style="font-family:monospace;font-size:var(--text-sm);font-weight:600">' + esc(uc.usecase_id || uc.UseCase_ID || rid) + '</td>' +
        '<td><a href="#" class="rq-name-link" onclick="ReviewQueue._open(\'' + esc(rid) + '\');return false">' + esc(uc.name || uc.Use_Case_Name || '(không tên)') + '</a></td>' +
        '<td>' + esc(uc.team || '—') + '</td>' +
        '<td>' + esc(uc.owner_name || uc.owner || '—') + '</td>' +
        '<td style="text-align:center">' + progCell + '</td>' +
        '<td style="text-align:center">' + scoreCell + '</td>' +
        '<td><button class="btn btn--ghost btn--sm" onclick="ReviewQueue._open(\'' + esc(rid) + '\');return false">' +
          (_canScore() ? 'Chấm điểm' : 'Xem') + '</button></td>' +
        '</tr>';
    }).join('');

    wrap.innerHTML =
      '<table class="rq-table data-table">' +
      '<thead><tr><th>Mã</th><th>Tên Use Case</th><th>Team</th><th>Người đăng ký</th>' +
      '<th style="text-align:center">Hội đồng</th><th style="text-align:center">Điểm US</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  /* ── UI Filters ── */
  function _populateTeamFilter() {
    var sel = document.getElementById('rqTeamFilter');
    if (!sel) return;
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

  /* ── Filter theo Người đăng ký (Owner) — CR#3 ── */
  function _populateOwnerFilter() {
    var sel = document.getElementById('rqOwnerFilter');
    if (!sel) return;
    var owners = [];
    _allUcs.forEach(function (uc) {
      var o = String(uc.owner_name || uc.owner || '').trim();
      if (o && owners.indexOf(o) === -1) owners.push(o);
    });
    owners.sort(function (a, b) { return a.localeCompare(b, 'vi'); });
    sel.innerHTML = '<option value="">Tất cả người đăng ký</option>' +
      owners.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
    if (_filterState.owner) sel.value = _filterState.owner;
  }

  function _applyFilters() {
    var base    = _filter(_allUcs);
    var q       = _norm(_filterState.search);
    var team    = _norm(_filterState.team);
    var owner   = _norm(_filterState.owner);
    var section = _filterState.section;

    var list = base.filter(function (uc) {
      if (q && _norm(uc.name).indexOf(q) === -1 && _norm(uc.usecase_id).indexOf(q) === -1) return false;
      if (team && _norm(uc.team) !== team) return false;
      if (owner && _norm(uc.owner_name || uc.owner) !== owner) return false;
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

    if (visible.indexOf('rqSectionPending')     !== -1) _renderQueue('rqTablePending',     'rqBadgePending',     groups.pending);
    if (visible.indexOf('rqSectionUnderReview') !== -1) _renderQueue('rqTableUnderReview', 'rqBadgeUnderReview', groups.underReview);
    if (visible.indexOf('rqSectionDone')        !== -1) _renderQueue('rqTableDone',        'rqBadgeDone',        groups.done);

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
    var ownerSel = document.getElementById('rqOwnerFilter');
    if (ownerSel) {
      ownerSel.addEventListener('change', function () {
        _filterState.owner = ownerSel.value;
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
      var results = await Promise.all([
        Api.listUseCases({ status: 'Approved', limit: 0 }),
        Api.getCouncilProgress()
      ]);
      var raw = results[0];
      var all = Array.isArray(raw) ? raw : (raw.items || raw.data || []);
      // chỉ giữ UC đã duyệt (phòng khi filter server không áp)
      _allUcs = all.filter(function (uc) { return _norm(uc.status) === 'approved'; });

      var prog = results[1] || {};
      _progress    = prog.map || {};
      _councilSize = prog.council_size || (APP_CONFIG.COUNCIL_USERS || []).length || 4;

      _populateTeamFilter();
      _populateOwnerFilter();
      _render();
    } catch (e) {
      var l = document.getElementById('rqLoading');
      l.textContent = 'Không tải được dữ liệu. Kiểm tra kết nối GAS.';
      l.style.color = 'var(--color-error)';
    }
  }

  function _render() {
    _applyFilters();
    document.getElementById('rqLoading').style.display = 'none';
    document.getElementById('rqContent').style.display = '';
    var filterBar = document.getElementById('rqFilterBar');
    if (filterBar) filterBar.style.display = '';
  }

  /* ── Panel ── */
  function setTxt(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

  function _openPanel(uc) {
    _currentUc = uc;
    setTxt('rpUcId',   uc.usecase_id || uc.UseCase_ID || _rid(uc));
    setTxt('rpUcName', uc.name || uc.Use_Case_Name || '');
    setTxt('rpUcMeta', (uc.team || '') + (uc.owner_name || uc.owner ? ' · ' + (uc.owner_name || uc.owner) : ''));

    // Reset sliders về 0 khi chấm mới (sẽ prefill nếu reviewer đã chấm) — CR#3.
    ['rpSliderTime', 'rpSliderAuto', 'rpSliderCreative'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.value = 0; if (typeof ScoreSlider !== 'undefined') ScoreSlider.refresh(el); }
    });
    var commentEl = document.getElementById('rpComment');
    if (commentEl) commentEl.value = '';

    // EVD dạng dòng (CR#4): link demo/bằng chứng của UC — chỉ hiển thị.
    _renderEvd(uc.demo_link || uc.Demo_Link || '');

    setTxt('rpCouncilFinal', '…');
    setTxt('rpCouncilStatus', 'Đang tải trạng thái hội đồng…');
    _updateProjectedScore();

    // Gate submit theo quyền hội đồng
    var submitBtn = document.getElementById('rpSubmitBtn');
    var notice    = document.getElementById('rpNotCouncil');
    if (_canScore()) {
      if (submitBtn) submitBtn.style.display = '';
      if (notice) notice.style.display = 'none';
    } else {
      if (submitBtn) submitBtn.style.display = 'none';
      if (notice) notice.style.display = '';
    }

    var panel   = document.getElementById('reviewPanel');
    var overlay = document.getElementById('reviewPanelOverlay');
    panel.style.display = ''; overlay.style.display = '';
    panel.classList.add('is-open');

    // Cột trái: chi tiết US đầy đủ (fetch full data — list nhẹ không có prompt/luồng)
    _loadDetail(uc);

    // Nạp trạng thái hội đồng của UC này
    Api.listCouncilScores(_rid(uc)).then(function (info) {
      _fillCouncilStatus(info);
    }).catch(function () {
      setTxt('rpCouncilStatus', 'Không tải được trạng thái hội đồng (có thể chưa ai chấm).');
      setTxt('rpCouncilFinal', '0');
    });
  }

  /* ── Cột trái: chi tiết US (Mục tiêu 2) ── */
  function _loadDetail(uc) {
    var host = document.getElementById('rpDetail');
    var copyBtn = document.getElementById('rpCopyPromptBtn');
    if (copyBtn) copyBtn.style.display = 'none';
    if (host) host.innerHTML = '<p class="empty-state-text" style="padding:var(--space-6)">Đang tải chi tiết…</p>';

    // Render nhanh bằng dữ liệu list đã có, rồi làm giàu bằng full detail.
    if (host && typeof UCDetailView !== 'undefined') host.innerHTML = UCDetailView.render(uc);

    var rid = _rid(uc);
    if (!rid || typeof Api.getUseCase !== 'function') return;
    Api.getUseCase(rid).then(function (data) {
      // Panel có thể đã đổi UC khác trong lúc chờ → chỉ áp nếu vẫn đúng UC.
      if (!_currentUc || _rid(_currentUc) !== rid) return;
      var full = UCDetailView.normalize(data);
      // Giữ tên/owner từ list nếu full thiếu.
      full.name = full.name || _currentUc.name;
      full.owner_name = full.owner_name || _currentUc.owner_name || _currentUc.owner;
      if (host) host.innerHTML = UCDetailView.render(full);
      if (copyBtn && UCDetailView.hasPrompt(full)) {
        copyBtn.style.display = '';
        copyBtn.onclick = function () { UCDetailView.copyPrompt(full); };
      }
    }).catch(function () {
      // GAS lỗi/không deploy — bản render từ list vẫn hiển thị (thiếu prompt/luồng).
    });
  }

  function _fillCouncilStatus(info) {
    if (!info) return;
    var final = info.final || 0;
    setTxt('rpCouncilFinal', final);
    var rankChip = document.getElementById('rpCouncilRank');
    if (rankChip && typeof ScoringH2 !== 'undefined' && info.scored_count > 0) {
      var r = ScoringH2.rankInfo(final);
      rankChip.textContent = r.label; rankChip.style.background = r.color; rankChip.style.display = '';
    } else if (rankChip) {
      rankChip.style.display = 'none';
    }

    var scored  = (info.scores || []).map(function (s) { return s.reviewer; });
    var pending = info.pending || [];
    var statusHtml = 'Đã chấm: <strong>' + (info.scored_count || 0) + '/' + (info.council_size || _councilSize) + '</strong>';
    if (scored.length)  statusHtml += ' · Đã: ' + scored.map(esc).join(', ');
    if (pending.length) statusHtml += ' · Chưa: ' + pending.map(esc).join(', ');
    var statusEl = document.getElementById('rpCouncilStatus');
    if (statusEl) statusEl.innerHTML = statusHtml;

    // Prefill điểm của chính reviewer nếu đã chấm
    var me = _myUsername();
    var mine = (info.scores || []).filter(function (s) { return _norm(s.reviewer) === me; })[0];
    if (mine) {
      var st = document.getElementById('rpSliderTime');     if (st) st.value = mine.time_saving;
      var sa = document.getElementById('rpSliderAuto');     if (sa) sa.value = mine.automation;
      var sc = document.getElementById('rpSliderCreative'); if (sc) sc.value = mine.creativity;
      if (typeof ScoreSlider !== 'undefined') { ScoreSlider.refresh(st); ScoreSlider.refresh(sa); ScoreSlider.refresh(sc); }
      var cm = document.getElementById('rpComment');        if (cm && mine.comment) cm.value = mine.comment;
      _updateProjectedScore();
    }
  }

  function _closePanel() {
    var panel   = document.getElementById('reviewPanel');
    var overlay = document.getElementById('reviewPanelOverlay');
    panel.classList.remove('is-open');
    setTimeout(function () { panel.style.display = 'none'; overlay.style.display = 'none'; }, 260);
    _currentUc = null;
  }

  function _sliderVals() {
    var t = document.getElementById('rpSliderTime');
    var a = document.getElementById('rpSliderAuto');
    var c = document.getElementById('rpSliderCreative');
    return {
      time:     t ? parseInt(t.value, 10) : 0,
      auto:     a ? parseInt(a.value, 10) : 0,
      creative: c ? parseInt(c.value, 10) : 0
    };
  }

  function _updateProjectedScore() {
    var v = _sliderVals();
    setTxt('rpValTime', v.time);
    setTxt('rpValAuto', v.auto);
    setTxt('rpValCreative', v.creative);
    var member = (typeof ScoringH2 !== 'undefined')
      ? ScoringH2.councilMemberScore(v.time, v.auto, v.creative)
      : 0;
    setTxt('rpProjectedTotal', member);
    var chip = document.getElementById('rpRankChip');
    if (chip && typeof ScoringH2 !== 'undefined') {
      var rank = ScoringH2.rankInfo(member);
      chip.textContent = rank.label; chip.style.background = rank.color; chip.style.display = '';
    }
  }

  async function _submitScore() {
    if (!_currentUc) return;
    if (!_canScore()) { showToast('Chỉ thành viên hội đồng mới được chấm điểm US.', 'error'); return; }
    var user = AuthService.getUser();
    if (!user) return;

    var v = _sliderVals();
    var commentEl = document.getElementById('rpComment');
    var submitBtn = document.getElementById('rpSubmitBtn');

    var payload = {
      Record_ID:   _rid(_currentUc),
      Time_Saving: v.time,
      Automation:  v.auto,
      Creativity:  v.creative,
      Comment:     commentEl ? commentEl.value.trim() : '',
      token:          AuthService.getToken(),
      reviewer_email: user.email
    };
    if (!payload.Record_ID) { showToast('Không xác định được Record_ID', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang gửi…';
    try {
      await Api.submitCouncilScore(payload);
      showToast('Đã ghi điểm hội đồng!', 'success');
      _closePanel();
      await _load();
    } catch (e) {
      showToast('Lỗi ghi điểm: ' + (e.message || e), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi điểm hội đồng';
    }
  }

  /* ── EVD dạng dòng (CR#4) — link demo/bằng chứng của UC, chỉ hiển thị ── */
  function _renderEvd(link) {
    var el = document.getElementById('rpEvdValue');
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

  /* ── Bind ── */
  function _bind() {
    if (typeof ScoreSlider !== 'undefined') ScoreSlider.enhanceAll(document.getElementById('reviewPanel'));

    var closeBtn = document.getElementById('reviewPanelClose');
    if (closeBtn) closeBtn.addEventListener('click', _closePanel);
    var overlay = document.getElementById('reviewPanelOverlay');
    if (overlay) overlay.addEventListener('click', _closePanel);

    ['rpSliderTime', 'rpSliderAuto', 'rpSliderCreative'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', _updateProjectedScore);
    });

    var submitBtn = document.getElementById('rpSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', _submitScore);
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
