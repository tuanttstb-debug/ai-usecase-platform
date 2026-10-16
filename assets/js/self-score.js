// ─────────────────────────────────────────────────────────────────
// self-score.js
//   • View "my-score"     : KPI CỦA TÔI — khung D70 (2026-10-09): M1–M4 TỰ TÍNH (member-kpi-preview), không tự khai;
//                           + khai Lan tỏa AI (M4) chọn LOẠI hoạt động → teamlead/PM duyệt.
//   • View "score-review" : teamlead/admin CHẤM ĐẠT/CHƯA ĐẠT TỪNG BÀI TẬP (bài Đạt = ≥3/4 tiêu chí — D69)
//                           + duyệt khai lan tỏa. Không tự chấm bài của mình (bài teamlead do PM chấm).
// Lịch sử: CR 2026-09-12 #3 (member tự chấm KPI2/KPI3 0–10 → teamlead duyệt) — đã thay bằng khung D70;
//   route self-score-* vẫn giữ ở GAS để đọc dữ liệu cũ, UI không còn dùng.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _tok()  { return (typeof AuthService !== 'undefined' && AuthService.getToken) ? AuthService.getToken() : ''; }
  function _user() { return (typeof AuthService !== 'undefined') ? AuthService.getUser() : null; }
  function _me()   { var u = _user(); return u ? String(u.email || '').trim().toLowerCase() : ''; }
  function _isAdmin() { var u = _user(); return !!(u && u.role === 'admin'); }
  function showToast(m, t) { if (typeof Toast !== 'undefined') Toast.show(m, t || 'info'); }
  function _val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function _monthLabel() { var d = new Date(); return 'Tháng ' + ('0'+(d.getMonth()+1)).slice(-2) + '/' + d.getFullYear(); }
  function _fmt(n) { var v = parseFloat(n); return isNaN(v) ? '0' : String(Math.round(v * 10) / 10); }
  function _weekShort(w) { var m = /W(\d+)$/.exec(String(w || '')); return m ? 'Tuần ' + parseInt(m[1], 10) : '—'; }

  var STATUS_BADGE = {
    Draft:     { t: 'Nháp',        cls: 'badge-muted'   },
    Submitted: { t: 'Chờ duyệt',   cls: 'badge-warning' },
    Approved:  { t: 'Đã duyệt',    cls: 'badge-success' },
    Rejected:  { t: 'Bị từ chối',  cls: 'badge-error'   }
  };
  function _badge(status) {
    var b = STATUS_BADGE[status] || STATUS_BADGE.Draft;
    return '<span class="badge ' + b.cls + '">' + b.t + '</span>';
  }

  // 4 tiêu chí bài tập (D69) — dùng chung chấm bài + gợi ý cho member.
  var CRITERIA = [
    { n: 1, label: 'Việc thật, có đầu vào/đầu ra' },
    { n: 2, label: 'Ghi giờ làm trước/sau' },
    { n: 3, label: 'Ghi AI sai ở đâu, đã kiểm chứng' },
    { n: 4, label: 'Có mẫu/câu lệnh dùng lại được' }
  ];
  var PASS_MIN = 3;
  // Gợi ý tick sẵn theo dữ liệu bài (teamlead vẫn quyết): (1) có mô tả · (2) đủ 2 ô giờ · (3) có kiểm chứng · (4) có mẫu dùng lại.
  function _suggest(e) {
    var has = function (v) { return String(v == null ? '' : v).trim() !== ''; };
    var out = [];
    if (has(e.description)) out.push(1);
    if (has(e.hours_before) && has(e.hours_after)) out.push(2);
    if (has(e.ai_check)) out.push(3);
    if (has(e.reuse_template)) out.push(4);
    return out;
  }

  // ══════════════ VIEW: my-score (KPI của tôi) ══════════════
  function _myInit() {
    var mEl = document.getElementById('myScoreMonth'); if (mEl) mEl.textContent = _monthLabel();
    var cs = document.getElementById('scSubmitBtn'); if (cs && !cs._b) { cs.addEventListener('click', _submitClaim); cs._b = true; }
    _loadMyKpi(); _loadMyClaims();
  }

  function _loadMyKpi() {
    var fin = document.getElementById('myKpiFinal');
    var tbl = document.getElementById('myKpiTable');
    if (fin) fin.innerHTML = '<span class="list-loading">Đang tính…</span>';
    Api.getMemberKpiPreview(_me()).then(function (k) {
      window._myKpi = k; // expose cho test
      _renderMyKpi(k);
    }).catch(function (e) {
      if (fin) fin.innerHTML = '';
      if (tbl) tbl.innerHTML = '<p class="list-empty">Không tải được KPI: ' + esc((e && e.message) || e) + '</p>';
    });
  }

  function _renderMyKpi(k) {
    var fin = document.getElementById('myKpiFinal');
    var tbl = document.getElementById('myKpiTable');
    if (!k) { if (tbl) tbl.innerHTML = '<p class="list-empty">Chưa có dữ liệu KPI.</p>'; return; }
    var d = k.detail || {};
    var pass = (parseFloat(k.final) || 0) >= (k.kpi_pass || 70);
    if (fin) fin.innerHTML = '<b style="font-size:var(--text-xl)" id="myKpiFinalNum">' + _fmt(k.final) + '%</b> ' +
      '<span class="badge ' + (pass ? 'badge-success' : 'badge-warning') + '">' + (pass ? 'Đạt KPI' : 'Chưa đạt (cần ≥70%)') + '</span>';
    var teamRatio = (d.m1_team_ratio === null || d.m1_team_ratio === undefined) ? 'chưa có số đo' : _fmt(d.m1_team_ratio) + '% mục tiêu khát vọng';
    var rows = [
      ['M1', 'Việc lớn', '40%', k.m1, 'Team: ' + teamRatio + ' → ' + _fmt(d.m1_team_score) + '% · Hạng mục được giao: ' + (d.m1_items_passed || 0) + '/' + (d.m1_items_assigned || 0) + ' đạt đúng hạn'],
      ['M2', 'Bài tập AI tuần', '30%', k.m2, (d.m2_pass_weeks || []).length + ' tuần có bài Đạt' + ((d.m2_pass_weeks || []).length ? ' (' + d.m2_pass_weeks.map(_weekShort).join(', ') + ')' : '') + ' · cần 10 tuần = 100%'],
      ['M3', 'Tự học', '15%', k.m3, (d.m3_courses_done || 0) + ' khóa hoàn thành có chứng chỉ' + (d.m3_courses_paid ? ' (' + d.m3_courses_paid + ' trả phí ×2)' : '') + ' · cần 4 khóa = 100%'],
      ['M4', 'Lan tỏa', '15%', k.m4, (d.m4_activities || 0) + ' hoạt động được xác nhận · 1 = 100%, từ 2 = 120%'],
      ['−', 'Trừ chậm mốc', '', -(k.penalty || 0), (d.milestones_late || 0) + ' mốc chậm (−2%/mốc, tối đa −10%)']
    ];
    if (tbl) tbl.innerHTML = '<div class="table-wrap"><table class="data-table" aria-label="KPI cá nhân của tôi"><thead><tr><th>Chỉ tiêu</th><th>Tỷ trọng</th><th style="text-align:right">Điểm</th><th>Căn cứ</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr data-kpi="' + esc(r[0]) + '"><td><b>' + esc(r[0]) + '</b> ' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td>' +
          '<td style="text-align:right;font-family:var(--font-mono,monospace);font-weight:700">' + _fmt(r[3]) + '%</td><td style="font-size:var(--text-sm)">' + esc(r[4]) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function _submitClaim() {
    var type = _val('scType'), desc = _val('scDesc'), ev = _val('scEvidence');
    if (!type) { showToast('Chọn loại hoạt động lan tỏa', 'error'); return; }
    if (!desc) { showToast('Nhập mô tả hoạt động lan tỏa', 'error'); return; }
    if (!ev)   { showToast('Nhập link bằng chứng lan tỏa', 'error'); return; }
    var btn = document.getElementById('scSubmitBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi…'; }
    Api.submitSharingClaim({ token: _tok(), Month: _monthLabel(), Claim_Type: type, Description: desc, Evidence_Link: ev }).then(function () {
      showToast('Đã nộp khai lan tỏa cho teamlead!', 'success');
      ['scType', 'scDesc', 'scEvidence'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
      _loadMyClaims();
    }).catch(function (e) { showToast('Lỗi: ' + ((e && e.message) || e), 'error'); })
      .then(function () { if (btn) { btn.disabled = false; btn.textContent = 'Nộp khai lan tỏa'; } });
  }

  function _loadMyClaims() {
    Api.listSharingClaims({ token: _tok(), scope: 'mine' }).then(function (res) {
      var rows = Array.isArray(res) ? res : (res && (res.data || res.items)) || [];
      var wrap = document.getElementById('scList'); if (!wrap) return;
      if (!rows.length) { wrap.innerHTML = '<p class="list-empty">Chưa có khai lan tỏa nào.</p>'; return; }
      wrap.innerHTML = rows.map(function (c) {
        return '<div class="dash-card" style="padding:var(--space-3);display:flex;flex-direction:column;gap:4px">' +
          '<div style="display:flex;justify-content:space-between;gap:8px"><span style="font-weight:600">' + esc(c.month) + (c.claim_type ? (' · ' + esc(c.claim_type)) : '') + '</span>' + _badge(c.status) + '</div>' +
          '<div style="font-size:var(--text-sm)">' + esc(c.description) + '</div>' +
          (c.evidence_link ? '<a href="' + esc(c.evidence_link) + '" target="_blank" rel="noopener" style="font-size:12px">Bằng chứng ↗</a>' : '') +
          (c.status === 'Rejected' && c.review_comment ? '<div style="font-size:12px;color:var(--color-error)"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(c.review_comment) + '</div>' : '') +
        '</div>';
      }).join('');
    }).catch(function () {});
  }

  // ══════════════ VIEW: score-review (teamlead) ══════════════
  var _exAll = [];
  var _claimsAll = [];
  // CR 2026-10-16: căn cứ chấm lấy thêm từ learning-list (họ tên · việc lớn/hạng mục · kế hoạch tuần) — lỗi thì vẫn chấm được.
  var _ctx = { names: {}, tasks: {}, assigns: {}, plans: {} };
  function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  // Bộ lọc chuẩn Team + Nhân sự (people-filter.js) — áp cả bài tập và lan tỏa.
  var _pf = null;
  function _revInit() {
    var f = document.getElementById('srExFilter');
    if (f && !f._b) { f.addEventListener('change', _renderExReview); f._b = true; }
    if (!_pf) _pf = PeopleFilter.bind({ team: 'srTeamFilter', user: 'srUserFilter', onChange: function () { _renderExReview(); _renderClaims(); } });
    _loadExercises(); _loadPendingClaims();
  }

  // Nhãn nhân sự chuẩn "Username-Họ tên" — họ tên lấy từ dòng dữ liệu, thiếu thì tra danh bạ learning-list.
  function _userLabel(username, name) {
    return PeopleFilter.label(username, name || _ctx.names[_norm(username)] || '');
  }

  // Danh sách người/team trong phạm vi = bài tập + lan tỏa đang hiển thị được.
  function _refreshFilters() {
    if (!_pf) return;
    var list = [];
    _exAll.forEach(function (e) { list.push({ username: e.owner_email, name: e.owner_name || _ctx.names[_norm(e.owner_email)], team: e.team }); });
    _claimsAll.forEach(function (c) { list.push({ username: c.username, name: c.display_name, team: c.team }); });
    _pf.setPeople(list);
  }
  function _passFilter(team, username) { return !_pf || _pf.match(team, username); }

  function _loadContext() {
    if (!Api.listLearning) return Promise.resolve();
    return Api.listLearning().then(function (res) {
      var d = res || {};
      var c = { names: {}, tasks: {}, assigns: {}, plans: {} };
      (d.members || []).forEach(function (m) { if (m.username && m.display_name) c.names[_norm(m.username)] = m.display_name; });
      (d.big_tasks || []).forEach(function (t) { c.tasks[t.task_id] = t; });
      (d.assigns || []).forEach(function (a) { c.assigns[a.assign_id] = a; });
      (d.weeks || []).forEach(function (w) { if (w.plan) c.plans[_norm(w.username) + '|' + w.week] = w.plan; });
      _ctx = c;
    }).catch(function () {});
  }

  function _fmtStamp(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    // Giờ VN (UTC+7) — dạng "14/10/2026 10:00".
    var v7 = new Date(d.getTime() + 7 * 3600 * 1000), p = function (n) { return ('0' + n).slice(-2); };
    return p(v7.getUTCDate()) + '/' + p(v7.getUTCMonth() + 1) + '/' + v7.getUTCFullYear() + ' ' + p(v7.getUTCHours()) + ':' + p(v7.getUTCMinutes());
  }
  function _isUrl(s) { return /^https?:\/\//i.test(String(s || '').trim()); }
  function _linkOrText(s) {
    var v = String(s || '').trim();
    return _isUrl(v) ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v) + ' ↗</a>' : esc(v);
  }
  // Việc lớn gắn với bài: Assign_ID → hạng mục (người · hạn · tiêu chí nghiệm thu) + tên việc lớn; Task_ID → tên việc lớn.
  function _bigTaskHtml(ref) {
    var r = String(ref || '').trim();
    if (!r) return '—';
    var a = _ctx.assigns[r], t = _ctx.tasks[a ? a.task_id : r];
    if (!a && !t) return esc(r);
    var out = '<span class="id-badge">' + esc(r) + '</span> ';
    if (t) out += esc(t.task_name);
    if (a) {
      out += '<div style="font-size:12px;color:var(--color-text-secondary)">Hạng mục: ' + esc(a.item) +
        (a.due_date ? ' · hạn ' + esc(a.due_date) : '') + (a.status ? ' · ' + esc(a.status) : '') +
        (a.acceptance_criteria ? '<br>Tiêu chí nghiệm thu: ' + esc(a.acceptance_criteria) : '') + '</div>';
    }
    return out;
  }
  // Giờ trước → sau + % tiết kiệm.
  function _hoursHtml(e) {
    var hasB = e.hours_before !== '' && e.hours_before != null, hasA = e.hours_after !== '' && e.hours_after != null;
    if (!hasB && !hasA) return '<i>chưa ghi</i>';
    var s = esc(hasB ? e.hours_before : '?') + ' giờ → ' + esc(hasA ? e.hours_after : '?') + ' giờ';
    var b = parseFloat(e.hours_before), a = parseFloat(e.hours_after);
    if (hasB && hasA && b > 0 && !isNaN(a)) s += ' <span style="color:var(--color-text-muted)">(giảm ' + _fmt((b - a) / b * 100) + '%)</span>';
    return s;
  }
  // Tuần này người đó đã có bài Đạt khác chưa (mỗi tuần tính tối đa 1 bài).
  function _otherPassSameWeek(e) {
    return _exAll.some(function (x) {
      return x.exercise_id !== e.exercise_id && _norm(x.owner_email) === _norm(e.owner_email) && x.week === e.week && x.review_status === 'Đạt';
    });
  }

  // Bài thuộc phạm vi chấm: admin → mọi bài (trừ bài của mình); teamlead → bài team mình/team backup (trừ bài của mình).
  // Ngoại lệ: PM trong APP_CONFIG.EXERCISE_SELF_REVIEW_USERS được tự chấm bài của mình.
  function _inScope(e) {
    var me = _me();
    if (String(e.owner_email || '').trim().toLowerCase() === me) {
      return ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.EXERCISE_SELF_REVIEW_USERS) || []).indexOf(me) !== -1;
    }
    if (_isAdmin()) return true;
    var u = _user() || {};
    var teams = [String(u.team || '')].concat(u.backup_teams || []).map(function (t) { return String(t).trim().toLowerCase(); });
    return teams.indexOf(String(e.team || '').trim().toLowerCase()) !== -1;
  }

  function _loadExercises() {
    var wrap = document.getElementById('srExList'); if (wrap) wrap.innerHTML = '<p class="list-loading">Đang tải…</p>';
    Promise.all([Api.listExercises(), _loadContext()]).then(function (r) {
      var res = r[0];
      _exAll = (Array.isArray(res) ? res : (res && (res.items || res.data)) || []).filter(_inScope);
      window._srExercises = _exAll; // expose cho test
      _refreshFilters();
      _renderExReview();
    }).catch(function (e) { if (wrap) wrap.innerHTML = '<p class="list-empty">Lỗi tải bài tập: ' + esc((e && e.message) || e) + '</p>'; });
  }

  var MISSING = '<i style="color:var(--color-text-muted)">chưa ghi</i>';
  function _row(label, html) {
    return '<div style="display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:start"><b>' + esc(label) + '</b><div style="white-space:pre-wrap;word-break:break-word">' + html + '</div></div>';
  }

  function _renderExReview() {
    var wrap = document.getElementById('srExList'); if (!wrap) return;
    var mode = _val('srExFilter') || 'pending';
    var list = _exAll.filter(function (e) {
      var rv = String(e.review_status || '').trim();
      return (mode === 'all' || (mode === 'pending' ? !rv : !!rv)) && _passFilter(e.team, e.owner_email);
    }).sort(function (a, b) { return String(a.week).localeCompare(String(b.week)) || String(a.owner_name).localeCompare(String(b.owner_name)); });
    var cnt = document.getElementById('srExCount');
    if (cnt) cnt.textContent = list.length + (mode === 'pending' ? ' chờ chấm' : ' bài');
    if (!list.length) { wrap.innerHTML = '<p class="list-empty">' + (mode === 'pending' ? 'Không có bài nào chờ chấm.' : 'Không có bài nào.') + '</p>'; return; }
    wrap.innerHTML = list.map(function (e) {
      var picked = e.review_status ? String(e.review_criteria || '').split(',').map(Number) : _suggest(e);
      var st = e.review_status === 'Đạt' ? '<span class="badge badge-success">Đạt</span>'
        : (e.review_status === 'Chưa đạt' ? '<span class="badge badge-error">Chưa đạt</span>' : '<span class="badge badge-warning">Chờ chấm</span>');
      var id = esc(e.exercise_id);
      var plan = _ctx.plans[_norm(e.owner_email) + '|' + e.week];
      var reviewed = e.review_status
        ? '<div style="font-size:12px;color:var(--color-text-muted)">Đã chấm bởi ' + esc(_userLabel(e.reviewed_by)) + (e.reviewed_at ? ' lúc ' + esc(_fmtStamp(e.reviewed_at)) : '') +
          (e.review_comment ? ' · Nhận xét: ' + esc(e.review_comment) : '') + '</div>' : '';
      var dup = _otherPassSameWeek(e)
        ? '<div style="font-size:12px;color:var(--color-warning,#b45309)"><i class="fa-solid fa-circle-info"></i> Người này đã có bài Đạt khác trong ' + esc(_weekShort(e.week)) + ' — mỗi tuần chỉ tính 1 bài vào M2.</div>' : '';
      return '<div class="dash-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:8px" data-ex="' + id + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span style="font-weight:600">' + esc(e.title) + ' <span class="id-badge">' + id + '</span></span>' +
          '<span class="srOwner" style="font-size:12px;color:var(--color-text-muted)">' + esc(_userLabel(e.owner_email, e.owner_name)) + ' · ' + esc(e.team) + ' · ' + esc(_weekShort(e.week)) +
          (e.created_at ? ' · nộp ' + esc(_fmtStamp(e.created_at)) : '') + '</span></div>' +
        '<div class="srDetail" style="font-size:var(--text-sm);display:flex;flex-direction:column;gap:6px">' +
          (plan ? _row('Kế hoạch tuần', esc(plan)) : '') +
          _row('(1) Mô tả việc', e.description ? esc(e.description) : MISSING) +
          _row('Prompt', e.prompt ? '<div style="background:var(--color-bg-subtle,rgba(0,0,0,.04));border-radius:6px;padding:6px 8px;max-height:220px;overflow:auto;font-family:var(--font-mono,monospace);font-size:12px">' + esc(e.prompt) + '</div>' : MISSING) +
          _row('(2) Giờ trước → sau', _hoursHtml(e)) +
          _row('(3) Kiểm chứng AI', e.ai_check ? esc(e.ai_check) : MISSING) +
          _row('(4) Mẫu dùng lại', e.reuse_template ? _linkOrText(e.reuse_template) : MISSING) +
          _row('Link demo', e.demo_link ? _linkOrText(e.demo_link) : MISSING) +
          _row('Việc lớn', _bigTaskHtml(e.big_task_ref)) +
        '</div>' + dup + reviewed +
        '<div class="sr-crit" style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:var(--text-sm)">' +
          CRITERIA.map(function (c) {
            return '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="srCrit" value="' + c.n + '"' +
              (picked.indexOf(c.n) !== -1 ? ' checked' : '') + ' onchange="ScoreReview.critChanged(this)"> (' + c.n + ') ' + esc(c.label) + '</label>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + st +
          ' <span class="srCritCount" style="font-size:12px;color:var(--color-text-muted)"></span>' +
          '<input type="text" class="form-input srComment" placeholder="Nhận xét (tùy chọn)" value="' + esc(e.review_comment || '') + '" style="flex:1;min-width:160px;font-size:12px;padding:6px 8px">' +
          '<button class="btn btn-success btn-sm srPass" onclick="ScoreReview.passEx(\'' + id + '\',this)"><i class="fa-solid fa-check"></i> Đạt</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--color-error)" onclick="ScoreReview.failEx(\'' + id + '\',this)"><i class="fa-solid fa-xmark"></i> Chưa đạt</button>' +
        '</div></div>';
    }).join('');
    var boxes = wrap.querySelectorAll('.dash-card[data-ex]');
    for (var i = 0; i < boxes.length; i++) _syncCard(boxes[i]);
  }

  function _cardCrit(card) {
    var out = [], cb = card.querySelectorAll('.srCrit');
    for (var i = 0; i < cb.length; i++) if (cb[i].checked) out.push(parseInt(cb[i].value, 10));
    return out;
  }
  // Nút Đạt chỉ bật khi ≥3/4 tiêu chí.
  function _syncCard(card) {
    var n = _cardCrit(card).length;
    var lbl = card.querySelector('.srCritCount'); if (lbl) lbl.textContent = n + '/4 tiêu chí';
    var pass = card.querySelector('.srPass'); if (pass) { pass.disabled = n < PASS_MIN; pass.title = n < PASS_MIN ? 'Cần ≥3/4 tiêu chí để chấm Đạt' : ''; }
  }

  function _reviewEx(id, action, btn) {
    var card = btn.closest('.dash-card');
    var crit = _cardCrit(card);
    if (action === 'pass' && crit.length < PASS_MIN) { showToast('Bài Đạt cần ≥3/4 tiêu chí', 'error'); return; }
    var cm = card.querySelector('.srComment');
    var u = _user() || {};
    btn.disabled = true;
    Api.reviewExercise({ token: _tok(), reviewer_email: u.email || '', Exercise_ID: id, action: action,
                         Criteria: crit.join(','), Review_Comment: cm ? cm.value.trim() : '' })
      .then(function () {
        showToast(action === 'pass' ? 'Đã chấm Đạt (tính vào M2).' : 'Đã chấm Chưa đạt.', 'success');
        _exAll.forEach(function (e) {
          if (e.exercise_id === id) {
            e.review_status = action === 'pass' ? 'Đạt' : 'Chưa đạt'; e.review_criteria = crit.join(','); e.review_comment = cm ? cm.value.trim() : '';
            e.reviewed_by = _me(); e.reviewed_at = new Date().toISOString();
          }
        });
        _renderExReview();
      })
      .catch(function (e) { btn.disabled = false; showToast('Lỗi: ' + ((e && e.message) || e), 'error'); });
  }

  function _loadPendingClaims() {
    var wrap = document.getElementById('srClaimList'); if (wrap) wrap.innerHTML = '<p class="list-loading">Đang tải…</p>';
    Api.listSharingClaims({ token: _tok(), scope: 'review', status: 'Submitted' }).then(function (res) {
      _claimsAll = Array.isArray(res) ? res : (res && (res.data || res.items)) || [];
      _refreshFilters();
      _renderClaims();
    }).catch(function (e) { if (wrap) wrap.innerHTML = '<p class="list-empty">Lỗi tải: ' + esc((e && e.message) || e) + '</p>'; });
  }

  function _renderClaims() {
    var wrap = document.getElementById('srClaimList'); if (!wrap) return;
    var rows = _claimsAll.filter(function (c) { return _passFilter(c.team, c.username); });
    var cnt = document.getElementById('srClaimCount'); if (cnt) cnt.textContent = rows.length + ' chờ duyệt';
    if (!rows.length) { wrap.innerHTML = '<p class="list-empty">Không có khai lan tỏa nào chờ duyệt.</p>'; return; }
    wrap.innerHTML = rows.map(function (c) {
        return '<div class="dash-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px" data-claim="' + esc(c.claim_id) + '">' +
          '<div style="display:flex;justify-content:space-between;gap:8px"><span style="font-weight:600">' + esc(_userLabel(c.username, c.display_name)) + ' · ' + esc(c.team) + '</span><span style="font-size:12px;color:var(--color-text-muted)">' + esc(c.month) + (c.claim_type ? (' · ' + esc(c.claim_type)) : '') + '</span></div>' +
          '<div style="font-size:var(--text-sm)">' + esc(c.description) + '</div>' +
          (c.evidence_link ? '<a href="' + esc(c.evidence_link) + '" target="_blank" rel="noopener" style="font-size:12px">Bằng chứng ↗</a>' : '<span style="font-size:12px;color:var(--color-text-muted)">(không có link)</span>') +
          '<div style="display:flex;gap:6px;align-items:center;margin-top:2px">' +
            '<input type="text" class="form-input srComment" placeholder="Lý do (bắt buộc khi từ chối)" style="flex:1;font-size:12px;padding:6px 8px">' +
            '<button class="btn btn-success btn-sm" onclick="ScoreReview.approveClaim(\'' + esc(c.claim_id) + '\',this)"><i class="fa-solid fa-check"></i> Duyệt</button>' +
            '<button class="btn btn-ghost btn-sm" style="color:var(--color-error)" onclick="ScoreReview.rejectClaim(\'' + esc(c.claim_id) + '\',this)"><i class="fa-solid fa-xmark"></i> Từ chối</button>' +
          '</div></div>';
      }).join('');
  }

  function _commentOf(btn) { var card = btn.closest('.dash-card'); var i = card ? card.querySelector('.srComment') : null; return i ? i.value.trim() : ''; }

  function _reviewClaim(id, action, btn) {
    var comment = _commentOf(btn);
    if (action === 'reject' && !comment) { showToast('Từ chối phải kèm lý do', 'error'); return; }
    Api.reviewSharingClaim({ token: _tok(), Claim_ID: id, action: action, Review_Comment: comment }).then(function () {
      showToast(action === 'approve' ? 'Đã duyệt lan tỏa (tính M4).' : 'Đã từ chối.', 'success'); _loadPendingClaims();
    }).catch(function (e) { showToast('Lỗi: ' + ((e && e.message) || e), 'error'); });
  }

  window.ScoreReview = {
    passEx: function (id, b) { _reviewEx(id, 'pass', b); },
    failEx: function (id, b) { _reviewEx(id, 'fail', b); },
    critChanged: function (cb) { var card = cb.closest('.dash-card'); if (card) _syncCard(card); },
    approveClaim: function (id, b) { _reviewClaim(id, 'approve', b); },
    rejectClaim: function (id, b) { _reviewClaim(id, 'reject', b); },
    reload: _loadExercises
  };
  window.MyScore = { reload: _loadMyKpi };

  if (window.Router) {
    window.Router.register('my-score',     { title: 'KPI của tôi', init: _myInit });
    window.Router.register('score-review', { title: 'Chấm bài & duyệt lan tỏa', roles: ['admin','champion','teamlead'], init: _revInit });
  }
})();
