// ─────────────────────────────────────────────────────────────────
// learning-plan.js — màn "Bài tập & Học tập" (AIUS-001 · 5 nhóm mục tiêu)
//
// CR 2026-10-01: Kế hoạch học tập (khóa học + hạn, theo dõi chung, việc lớn).
// CR 2026-10-01 #2: gộp với "Bài tập AI" theo vòng tuần — mỗi dữ liệu chỉ nhập 1 lần:
//   Tab Bài tập tuần : kế hoạch tuần (không bắt buộc) → Nộp bài (form ai-exercise.js, gắn Week)
//                      + bài của tôi theo tuần + Hồ sơ AI (công cụ, mức dùng, hỗ trợ)
//   Tab Khóa học     : thêm/sửa/xóa khóa + hạn học xong
//   Tab Thư viện     : danh sách Bài tập AI (ai-exercise.js)
//   Tab Theo dõi     : thành viên × tuần (đã nộp / kế hoạch / chưa có) + khóa học theo hạn
//   Tab Việc lớn     : chỉ đọc (PM nhập ở sheet VIEC_LON)
// Hash: #learning-plan/<tab>. Trạng thái "Hoàn thành" + link chứng chỉ → KPI3: đợt 2.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var SOON_DAYS = 7;
  var MAX_WEEKS = 6;
  var TABS = ['week', 'courses', 'library', 'tracking', 'bigtasks'];
  var _data = { members: [], courses: [], big_tasks: [], weeks: [], current_week: '' };
  var _editCourseId = null;
  var _tab = 'week';
  var _filter = { team: '', state: '', week: '', q: '' };

  var STATE_META = {
    overdue: { label: 'Quá hạn',          cls: 'badge-error'   },
    soon:    { label: 'Sắp tới hạn',      cls: 'badge-warning' },
    ontrack: { label: 'Đúng tiến độ',     cls: 'badge-primary' },
    done:    { label: 'Hoàn thành',       cls: 'badge-success' },
    nodate:  { label: 'Chưa có hạn',      cls: 'badge-muted'   },
    unclear: { label: 'Chưa rõ khóa',     cls: 'badge-warning' },
    nocourse:{ label: 'Chưa có khóa',     cls: 'badge-error'   }
  };
  var WEEK_META = {
    submitted: { label: 'Đã nộp',      cls: 'badge-success' },
    plan:      { label: 'Kế hoạch',    cls: 'badge-primary' },
    none:      { label: 'Chưa có',     cls: 'badge-muted'   }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _norm(s) { return String(s || '').trim().toLowerCase(); }
  function _user()  { return (typeof AuthService !== 'undefined') ? AuthService.getUser() : null; }
  function _me()    { var u = _user(); return u ? _norm(u.email) : ''; }
  function _isAdmin(){ var u = _user(); return !!(u && u.role === 'admin'); }
  function showToast(m, t) { if (typeof Toast !== 'undefined') Toast.show(m, t || 'info'); }
  function _el(id) { return document.getElementById(id); }
  function _v(id) { var el = _el(id); return el ? el.value.trim() : ''; }
  function _set(id, val) { var el = _el(id); if (el) el.value = val || ''; }

  // ── Ngày & tuần ISO (thứ 2 → CN) ────────────────────────────────
  function _today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function isoWeek(d) {
    d = d || new Date();
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    var wk = Math.ceil((((t - ys) / 86400000) + 1) / 7);
    return t.getUTCFullYear() + '-W' + (wk < 10 ? '0' + wk : wk);
  }
  function _weekRange(w) {   // "2026-W40" → [Date thứ 2, Date CN]
    var m = /^(\d{4})-W(\d{2})$/.exec(w || '');
    if (!m) return null;
    var jan4 = new Date(+m[1], 0, 4);
    var mon = new Date(jan4); mon.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (+m[2] - 1) * 7);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [mon, sun];
  }
  function _dm(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function weekLabel(w, withRange) {
    var m = /W(\d+)$/.exec(w || '');
    if (!m) return w || '';
    var r = _weekRange(w);
    return 'Tuần ' + parseInt(m[1], 10) + (withRange && r ? ' (' + _dm(r[0]) + '–' + _dm(r[1]) + ')' : '');
  }
  function currentWeek() { return _data.current_week || isoWeek(); }

  function _daysLeft(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return null;
    var p = ymd.split('-');
    return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - _today()) / 86400000);
  }
  function _fmtDate(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return '—';
    var p = ymd.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function courseState(c) {
    if (c.status === 'Hoàn thành') return 'done';
    if (c.status === 'Chưa rõ khóa') return 'unclear';
    var d = _daysLeft(c.target_date);
    if (d === null) return 'nodate';
    if (d < 0) return 'overdue';
    if (d <= SOON_DAYS) return 'soon';
    return 'ontrack';
  }
  function _leftText(c) {
    var st = courseState(c);
    if (st === 'done' || st === 'unclear' || st === 'nodate') return '';
    var d = _daysLeft(c.target_date);
    if (d < 0) return 'trễ ' + (-d) + ' ngày';
    if (d === 0) return 'hôm nay';
    return 'còn ' + d + ' ngày';
  }
  function _badge(meta, key) {
    var m = meta[key];
    return m ? '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>' : '';
  }

  // Tình trạng 1 người trong 1 tuần: submitted | plan | none
  function _weekRow(username, week) {
    return _data.weeks.filter(function (w) { return w.username === username && w.week === week; })[0] || null;
  }
  function weekState(username, week) {
    var r = _weekRow(username, week);
    if (!r) return 'none';
    return r.status === 'Đã nộp' ? 'submitted' : (r.plan ? 'plan' : 'none');
  }

  // ── Tabs ────────────────────────────────────────────────────────
  function showTab(tab) {
    if (TABS.indexOf(tab) === -1) tab = 'week';
    _tab = tab;
    var btns = document.querySelectorAll('#lpTabs .dash-tab');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-lptab') === tab;
      btns[i].classList.toggle('active', on);
      btns[i].setAttribute('aria-selected', String(on));
    }
    var panels = document.querySelectorAll('[data-lppanel]');
    for (var j = 0; j < panels.length; j++) panels[j].hidden = panels[j].getAttribute('data-lppanel') !== tab;
    var want = '#learning-plan/' + tab;
    if (location.hash !== want && /^#learning-plan/.test(location.hash)) history.replaceState(null, '', want);
  }

  // ── Load ────────────────────────────────────────────────────────
  function _load() {
    var loading = _el('lpLoading');
    if (loading) { loading.style.display = ''; loading.textContent = 'Đang tải…'; loading.style.color = ''; }
    Api.listLearning().then(function (res) {
      res = res || {};
      _data = {
        members:      Array.isArray(res.members) ? res.members : [],
        courses:      Array.isArray(res.courses) ? res.courses : [],
        big_tasks:    Array.isArray(res.big_tasks) ? res.big_tasks : [],
        weeks:        Array.isArray(res.weeks) ? res.weeks : [],
        current_week: res.current_week || isoWeek()
      };
      window._learningPlan = _data; // expose cho test
      if (loading) loading.style.display = 'none';
      _fillTeamFilter();
      _renderWeekTab();
      _renderMine();
      _renderTracking();
      _renderBigTasks();
    }).catch(function () {
      if (loading) { loading.textContent = 'Không tải được dữ liệu. Kiểm tra kết nối GAS.'; loading.style.color = 'var(--color-error)'; }
    });
  }

  function _payloadBase() {
    var u = _user() || {};
    return {
      Username:        _me(),
      Display_Name:    u.displayName || u.email || '',
      Team:            u.team || '',
      requester_email: u.email || '',
      is_admin:        _isAdmin() ? 'true' : 'false'
    };
  }
  function _myMember() {
    var me = _me();
    return _data.members.filter(function (m) { return m.username === me; })[0] || null;
  }

  // ── Tab Bài tập tuần ────────────────────────────────────────────
  function _renderWeekTab() {
    var w = currentWeek();
    var lbl = _el('lpWeekLabel'); if (lbl) lbl.textContent = weekLabel(w, true);
    var me = _me();
    var st = weekState(me, w);
    var row = _weekRow(me, w);
    var badge = _el('lpWeekStatus');
    if (badge) badge.innerHTML = st === 'submitted'
      ? _badge(WEEK_META, 'submitted') + ' <span style="font-size:12px;color:var(--color-text-muted)">' + esc(row.exercise_ids) + '</span>'
      : (st === 'plan' ? '<span class="badge badge-warning">Có kế hoạch, chưa nộp bài</span>' : '<span class="badge badge-error">Chưa nộp bài tuần này</span>');
    _set('lpPlan', row ? row.plan : '');
    var use = _el('lpUsePlan'); if (use) use.style.display = (row && row.plan) ? '' : 'none';

    // Bài của tôi theo tuần (mới nhất trước)
    var wrap = _el('lpMyWeeks');
    if (!wrap) return;
    var mine = _data.weeks.filter(function (r) { return r.username === me; });
    var ex = (window.AiExercise && AiExercise.mine) ? AiExercise.mine() : [];
    if (!mine.length && !ex.length) {
      wrap.innerHTML = '<p class="list-empty" style="margin:0">Chưa có bài tập nào. Ghi kế hoạch hoặc nộp bài đầu tiên ở trên.</p>';
      return;
    }
    var byWeek = {};
    mine.forEach(function (r) { byWeek[r.week] = { row: r, ex: [] }; });
    ex.forEach(function (e) { var k = e.week || ''; if (!k) return; (byWeek[k] = byWeek[k] || { row: null, ex: [] }).ex.push(e); });
    var keys = Object.keys(byWeek).sort().reverse();
    wrap.innerHTML = '<table class="dash-table" aria-label="Bài tập của tôi theo tuần"><thead><tr><th>Tuần</th><th>Kế hoạch</th><th>Bài đã nộp</th><th>Tình trạng</th></tr></thead><tbody>' +
      keys.map(function (k) {
        var it = byWeek[k];
        var stt = (it.ex.length || (it.row && it.row.status === 'Đã nộp')) ? 'submitted' : (it.row && it.row.plan ? 'plan' : 'none');
        var titles = it.ex.length
          ? it.ex.map(function (e) { return '<span class="id-badge">' + esc(e.exercise_id) + '</span> ' + esc(e.title); }).join('<br>')
          : (it.row && it.row.exercise_ids ? esc(it.row.exercise_ids) : '—');
        return '<tr data-week="' + esc(k) + '"><td style="white-space:nowrap">' + esc(weekLabel(k, true)) + '</td>' +
          '<td>' + esc(it.row && it.row.plan ? it.row.plan : '—') + '</td><td>' + titles + '</td><td>' + _badge(WEEK_META, stt) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function _submitPlan() {
    var plan = _v('lpPlan');
    var msg = _el('lpPlanMsg');
    if (!plan) { if (msg) msg.textContent = 'Vui lòng ghi kế hoạch tuần.'; showToast('Thiếu kế hoạch tuần', 'error'); return; }
    if (msg) msg.textContent = '';
    var payload = _payloadBase();
    payload.Plan = plan;
    payload.Week = currentWeek();
    var btn = _el('lpPlanBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
    Api.saveWeekPlan(payload).then(function () {
      showToast('Đã lưu kế hoạch tuần!', 'success');
      _load();
    }).catch(function (err) {
      showToast('Lỗi: ' + ((err && err.message) || err), 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu kế hoạch'; }
    });
  }

  function _usePlan() {
    var row = _weekRow(_me(), currentWeek());
    if (row && row.plan) { _set('exTitle', row.plan.slice(0, 200)); var t = _el('exTitle'); if (t) t.focus(); }
  }

  // Hồ sơ AI (công cụ, mức dùng, hỗ trợ)
  function _submitProfile() {
    var tools = _v('lpTools'), usage = _v('lpUsage');
    var msg = _el('lpRegMsg');
    if (!tools && !usage) { if (msg) msg.textContent = 'Vui lòng chọn mức dùng AI hoặc ghi công cụ AI bạn dùng.'; showToast('Thiếu thông tin hồ sơ', 'error'); return; }
    if (msg) msg.textContent = '';
    var payload = _payloadBase();
    payload.AI_Tools = tools;
    payload.Usage_Level = usage;
    payload.Support_Need = _v('lpSupport');
    var btn = _el('lpRegBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
    Api.registerLearning(payload).then(function () {
      showToast('Đã lưu hồ sơ AI!', 'success');
      _load();
    }).catch(function (err) {
      showToast('Lỗi: ' + ((err && err.message) || err), 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu hồ sơ'; }
    });
  }

  // ── Tab Khóa học ────────────────────────────────────────────────
  function _myCourses() {
    var me = _me();
    return _data.courses.filter(function (c) { return c.username === me; });
  }

  function _renderMine() {
    var m = _myMember();
    var hint = _el('lpMyStatus');
    if (hint) hint.innerHTML = (m && (m.ai_tools || m.usage_level))
      ? '<span class="badge badge-success">Đã khai</span>'
      : '<span class="badge badge-warning">Chưa khai</span>';
    if (m) { _set('lpTools', m.ai_tools); _set('lpUsage', m.usage_level); _set('lpSupport', m.support_need); }

    var wrap = _el('lpMyCourses');
    if (!wrap) return;
    var list = _myCourses();
    if (!list.length) {
      wrap.innerHTML = '<p class="list-empty" style="margin:0">Bạn chưa có khóa học nào. Thêm ít nhất 1 khóa kèm hạn học xong.</p>';
      return;
    }
    wrap.innerHTML = '<table class="dash-table" aria-label="Khóa học của tôi"><thead><tr>' +
      '<th>Khóa học</th><th>Hạn học xong</th><th>Tình trạng</th><th></th></tr></thead><tbody>' +
      list.map(function (c) {
        var sub = [c.provider, c.paid === 'Có' ? 'trả phí' : ''].filter(Boolean).join(' · ');
        return '<tr data-course="' + esc(c.course_id) + '">' +
          '<td>' + esc(c.course_name) + (sub ? '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(sub) + '</div>' : '') + '</td>' +
          '<td style="white-space:nowrap">' + _fmtDate(c.target_date) + '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(_leftText(c)) + '</div></td>' +
          '<td>' + _badge(STATE_META, courseState(c)) + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" title="Sửa" aria-label="Sửa khóa học" onclick="LearningPlan.editCourse(\'' + esc(c.course_id) + '\')"><i class="fa-solid fa-pen"></i> Sửa</button>' +
            '<button class="btn btn-ghost btn-sm" title="Xóa" aria-label="Xóa khóa học" style="color:var(--color-error)" onclick="LearningPlan.delCourse(\'' + esc(c.course_id) + '\')"><i class="fa-solid fa-trash"></i></button>' +
          '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function _submitCourse() {
    var name = _v('lpCourseName');
    var date = _v('lpCourseDate');
    var msg = _el('lpCourseMsg');
    if (!name) { if (msg) msg.textContent = 'Vui lòng nhập tên khóa học.'; showToast('Thiếu tên khóa học', 'error'); return; }
    if (!date) { if (msg) msg.textContent = 'Vui lòng chọn hạn học xong.'; showToast('Thiếu hạn học xong', 'error'); return; }
    if (msg) msg.textContent = '';
    var payload = _payloadBase();
    payload.Course_Name = name;
    payload.Provider    = _v('lpCourseProvider');
    payload.Paid        = _v('lpCoursePaid') || 'Không';
    payload.Target_Date = date;
    var btn = _el('lpCourseBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
    var editing = _editCourseId;
    var p = editing
      ? Api.updateLearningCourse(Object.assign({ Course_ID: editing }, payload))
      : Api.addLearningCourse(payload);
    p.then(function () {
      showToast(editing ? 'Đã cập nhật khóa học!' : 'Đã thêm khóa học!', 'success');
      _resetCourseForm();
      _load();
    }).catch(function (err) {
      showToast('Lỗi: ' + ((err && err.message) || err), 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = _editCourseId ? 'Lưu khóa học' : 'Thêm khóa học'; }
    });
  }

  function _resetCourseForm() {
    _editCourseId = null;
    ['lpCourseName', 'lpCourseProvider', 'lpCourseDate'].forEach(function (id) { _set(id, ''); });
    _set('lpCoursePaid', 'Không');
    var btn = _el('lpCourseBtn'); if (btn) btn.textContent = 'Thêm khóa học';
    var cancel = _el('lpCourseCancel'); if (cancel) cancel.style.display = 'none';
    var msg = _el('lpCourseMsg'); if (msg) msg.textContent = '';
  }

  function editCourse(id) {
    var c = _data.courses.filter(function (x) { return x.course_id === id; })[0];
    if (!c) return;
    showTab('courses');
    _editCourseId = id;
    // Khóa "Chưa rõ khóa" có tên tạm trong ngoặc → để trống cho người dùng điền tên thật
    _set('lpCourseName', /^\(.*\)$/.test(c.course_name) ? '' : c.course_name);
    _set('lpCourseProvider', c.provider);
    _set('lpCoursePaid', ['Có', 'Không', 'Chưa rõ'].indexOf(c.paid) !== -1 ? c.paid : 'Không');
    _set('lpCourseDate', c.target_date);
    var btn = _el('lpCourseBtn'); if (btn) btn.textContent = 'Lưu khóa học';
    var cancel = _el('lpCourseCancel'); if (cancel) cancel.style.display = '';
    var name = _el('lpCourseName'); if (name) name.focus();
  }

  function delCourse(id) {
    var c = _data.courses.filter(function (x) { return x.course_id === id; })[0];
    var label = c ? '"' + c.course_name + '"' : id;
    var ask = (typeof uiConfirm === 'function')
      ? uiConfirm({ title: 'Xóa khóa học', body: 'Xóa ' + label + ' khỏi kế hoạch học tập của bạn?', okLabel: 'Xóa', danger: true })
      : Promise.resolve(true);
    ask.then(function (ok) {
      if (!ok) return;
      var payload = _payloadBase();
      payload.Course_ID = id;
      Api.deleteLearningCourse(payload)
        .then(function () { showToast('Đã xóa khóa học.', 'success'); if (_editCourseId === id) _resetCourseForm(); _load(); })
        .catch(function (err) { showToast('Lỗi xóa: ' + ((err && err.message) || err), 'error'); });
    });
  }

  // ── Tab Theo dõi ────────────────────────────────────────────────
  function _fillTeamFilter() {
    var sel = _el('lpTeamFilter');
    if (!sel) return;
    var teams = {};
    _data.members.forEach(function (m) { if (m.team) teams[m.team] = 1; });
    var cur = sel.value;
    sel.innerHTML = '<option value="">Tất cả team</option>' +
      Object.keys(teams).sort().map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    sel.value = cur;
  }
  function _inTeam(team) { return !_filter.team || team === _filter.team; }
  function _matchQ(parts) {
    var q = _norm(_filter.q);
    return !q || parts.map(_norm).join(' ').indexOf(q) !== -1;
  }
  function _weeksShown() {
    var set = {};
    _data.weeks.forEach(function (w) { set[w.week] = 1; });
    set[currentWeek()] = 1;
    return Object.keys(set).filter(function (w) { return w <= currentWeek(); }).sort().slice(-MAX_WEEKS);
  }

  function _summary() {
    var w = currentWeek();
    var members = _data.members.filter(function (m) { return _inTeam(m.team); });
    var courses = _data.courses.filter(function (c) { return _inTeam(c.team); });
    var cnt = { submitted: 0, plan: 0, none: 0 };
    members.forEach(function (m) { cnt[weekState(m.username, w)]++; });
    var cs = function (st) { return courses.filter(function (c) { return courseState(c) === st; }).length; };
    return { total: members.length, submitted: cnt.submitted, plan: cnt.plan, none: cnt.none,
             soon: cs('soon'), overdue: cs('overdue'), unclear: cs('unclear') };
  }
  function _tile(id, value, label, cls) {
    return '<div class="kpi-card ' + (cls || '') + '" id="' + id + '" role="listitem">' +
      '<div class="kpi-value">' + esc(value) + '</div><div class="kpi-label">' + esc(label) + '</div></div>';
  }

  function _renderTracking() {
    var s = _summary();
    var wl = weekLabel(currentWeek()).toLowerCase();
    var tiles = _el('lpSummary');
    if (tiles) {
      tiles.style.display = '';
      tiles.innerHTML =
        _tile('lpKpiSubmitted', s.submitted + '/' + s.total, 'Đã nộp bài ' + wl, 'kpi-success') +
        _tile('lpKpiPlan',      s.plan,    'Mới có kế hoạch', 'kpi-info') +
        _tile('lpKpiNone',      s.none,    'Chưa có gì ' + wl, 'kpi-warning') +
        _tile('lpKpiSoon',      s.soon,    'Khóa sắp tới hạn (≤' + SOON_DAYS + ' ngày)', 'kpi-warning') +
        _tile('lpKpiOverdue',   s.overdue, 'Khóa quá hạn', 'kpi-warning') +
        _tile('lpKpiUnclear',   s.unclear, 'Chưa rõ khóa', '');
    }
    _renderWeekMatrix();
    _renderCourseTable();
  }

  function _renderWeekMatrix() {
    var wrap = _el('lpWeekMatrix');
    if (!wrap) return;
    var weeks = _weeksShown();
    var cur = currentWeek();
    var order = { none: 0, plan: 1, submitted: 2 };
    var rows = _data.members.filter(function (m) {
      if (!_inTeam(m.team)) return false;
      if (_filter.week && weekState(m.username, cur) !== _filter.week) return false;
      return _matchQ([m.username, m.display_name, m.team]);
    }).sort(function (a, b) {
      return (order[weekState(a.username, cur)] - order[weekState(b.username, cur)]) ||
        String(a.team).localeCompare(String(b.team)) || String(a.display_name).localeCompare(String(b.display_name));
    });
    var cnt = _el('lpWeekCount'); if (cnt) cnt.textContent = rows.length + ' người';
    if (!rows.length) { wrap.innerHTML = '<p class="list-empty">Không có ai khớp bộ lọc.</p>'; return; }
    wrap.innerHTML = '<div class="rq-table-wrap"><table class="dash-table" aria-label="Bài tập theo tuần"><thead><tr><th>Team</th><th>Thành viên</th>' +
      weeks.map(function (w) { return '<th style="white-space:nowrap">' + esc(weekLabel(w)) + (w === cur ? ' (này)' : '') + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (m) {
        return '<tr data-user="' + esc(m.username) + '" data-week-state="' + weekState(m.username, cur) + '">' +
          '<td>' + esc(m.team || '—') + '</td>' +
          '<td><div style="font-weight:600">' + esc(m.display_name || m.username) + '</div><div style="font-size:12px;color:var(--color-text-muted)">' + esc(m.username) + '</div></td>' +
          weeks.map(function (w) {
            var r = _weekRow(m.username, w), st = weekState(m.username, w);
            var tip = r ? (r.plan ? 'Kế hoạch: ' + r.plan : '') + (r.exercise_ids ? ' · Bài: ' + r.exercise_ids : '') : '';
            return '<td title="' + esc(tip) + '">' + _badge(WEEK_META, st) + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  // Khóa học theo hạn: 1 dòng/khóa; thành viên chưa có khóa → 1 dòng "Chưa có khóa"
  function _courseRows() {
    var byUser = {};
    _data.courses.forEach(function (c) { (byUser[c.username] = byUser[c.username] || []).push(c); });
    var rows = [];
    _data.members.forEach(function (m) {
      var list = byUser[m.username] || [];
      if (!list.length) rows.push({ m: m, c: null, state: 'nocourse' });
      list.forEach(function (c) { rows.push({ m: m, c: c, state: courseState(c) }); });
      delete byUser[m.username];
    });
    Object.keys(byUser).forEach(function (u) {
      byUser[u].forEach(function (c) { rows.push({ m: { username: u, display_name: c.display_name, team: c.team }, c: c, state: courseState(c) }); });
    });
    var order = { overdue: 0, nocourse: 1, soon: 2, unclear: 3, nodate: 4, ontrack: 5, done: 6 };
    rows.sort(function (a, b) {
      return (order[a.state] - order[b.state]) || String(a.m.team).localeCompare(String(b.m.team)) ||
        String(a.c ? a.c.target_date : '').localeCompare(String(b.c ? b.c.target_date : ''));
    });
    return rows;
  }

  function _renderCourseTable() {
    var rows = _courseRows().filter(function (r) {
      if (!_inTeam(r.m.team)) return false;
      if (_filter.state && r.state !== _filter.state) return false;
      return _matchQ([r.m.username, r.m.display_name, r.m.team, r.c && r.c.course_name, r.c && r.c.provider]);
    });
    var count = _el('lpCount'); if (count) count.textContent = rows.length + ' dòng';
    var wrap = _el('lpTable');
    if (!wrap) return;
    if (!rows.length) { wrap.innerHTML = '<p class="list-empty">Không có dòng nào khớp bộ lọc.</p>'; return; }
    wrap.innerHTML = '<div class="rq-table-wrap"><table class="dash-table" aria-label="Khóa học theo hạn"><thead><tr>' +
      '<th>Team</th><th>Thành viên</th><th>Khóa học</th><th>Nơi học</th><th>Trả phí</th><th>Hạn học xong</th><th>Tình trạng</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        var c = r.c;
        return '<tr data-state="' + r.state + '">' +
          '<td>' + esc(r.m.team || '—') + '</td>' +
          '<td><div style="font-weight:600">' + esc(r.m.display_name || r.m.username) + '</div><div style="font-size:12px;color:var(--color-text-muted)">' + esc(r.m.username) + '</div></td>' +
          '<td>' + esc(c ? c.course_name : '—') + (c && c.note ? '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(c.note) + '</div>' : '') + '</td>' +
          '<td>' + esc(c ? (c.provider || '—') : '—') + '</td>' +
          '<td>' + esc(c ? (c.paid || '—') : '—') + '</td>' +
          '<td style="white-space:nowrap">' + (c ? _fmtDate(c.target_date) : '—') + '</td>' +
          '<td style="white-space:nowrap">' + _badge(STATE_META, r.state) + (c ? ' <span style="font-size:12px;color:var(--color-text-muted)">' + esc(_leftText(c)) + '</span>' : '') + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  // ── Tab Việc lớn ────────────────────────────────────────────────
  function _renderBigTasks() {
    var wrap = _el('lpBigTasks');
    if (!wrap) return;
    var list = _data.big_tasks;
    if (!list.length) { wrap.innerHTML = '<p class="list-empty">Chưa có việc lớn nào.</p>'; return; }
    wrap.innerHTML = '<div class="rq-table-wrap"><table class="dash-table" aria-label="Việc lớn cấp Trung tâm"><thead><tr>' +
      '<th>Mã</th><th>Việc lớn</th><th>Team</th><th>Nguồn</th><th>Làm chính</th><th>Hiện tại → mục tiêu</th><th>Hạn làm thử</th><th>Trạng thái</th>' +
      '</tr></thead><tbody>' +
      list.map(function (t) {
        var srcCls = /tự chọn/i.test(t.source_type) ? 'badge-success' : 'badge-primary';
        var d = _daysLeft(t.pilot_deadline);
        var left = d === null ? '' : (d < 0 ? 'trễ ' + (-d) + ' ngày' : 'còn ' + d + ' ngày');
        var effort = (t.hours_before || t.target_reduction)
          ? esc(t.hours_before || '?') + ' → ' + esc(t.target_reduction || '?')
          : '<span style="color:var(--color-text-muted)">Teamlead điền</span>';
        return '<tr>' +
          '<td><span class="id-badge">' + esc(t.task_id) + '</span></td>' +
          '<td style="max-width:320px">' + esc(t.task_name) + (t.note ? '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(t.note) + '</div>' : '') + '</td>' +
          '<td>' + esc(t.team) + '</td>' +
          '<td><span class="badge ' + srcCls + '">' + esc(t.source_type || '—') + '</span></td>' +
          '<td>' + esc(t.lead || '—') + (t.participants ? '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(t.participants) + '</div>' : '') + '</td>' +
          '<td>' + effort + '</td>' +
          '<td style="white-space:nowrap">' + _fmtDate(t.pilot_deadline) + (left ? '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(left) + '</div>' : '') + '</td>' +
          '<td>' + esc(t.status || '—') + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function _bind() {
    [['lpPlanBtn', _submitPlan], ['lpUsePlan', _usePlan], ['lpRegBtn', _submitProfile],
     ['lpCourseBtn', _submitCourse], ['lpCourseCancel', _resetCourseForm]].forEach(function (b) {
      var el = _el(b[0]);
      if (el && !el._bound) { el.addEventListener('click', b[1]); el._bound = true; }
    });
    var tabs = document.querySelectorAll('#lpTabs .dash-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i]._bound) continue;
      tabs[i].addEventListener('click', function () { showTab(this.getAttribute('data-lptab')); });
      tabs[i]._bound = true;
    }
    [['lpTeamFilter', 'team'], ['lpStateFilter', 'state'], ['lpWeekFilter', 'week']].forEach(function (f) {
      var el = _el(f[0]);
      if (el && !el._bound) { el.addEventListener('change', function () { _filter[f[1]] = el.value; _renderTracking(); }); el._bound = true; }
    });
    var s = _el('lpSearch');
    if (s && !s._bound) {
      var d;
      s.addEventListener('input', function () { clearTimeout(d); d = setTimeout(function () { _filter.q = s.value; _renderTracking(); }, 200); });
      s._bound = true;
    }
  }

  if (window.Router) window.Router.register('learning-plan', {
    title: 'Bài tập & Học tập',
    init: function () {
      _resetCourseForm(); _bind(); _load();
      if (window.AiExercise && AiExercise.init) AiExercise.init();
    },
    show: function (sub) { showTab(sub || _tab); }
  });

  window.LearningPlan = {
    reload: _load, showTab: showTab, editCourse: editCourse, delCourse: delCourse,
    courseState: courseState, weekState: weekState, currentWeek: currentWeek, isoWeek: isoWeek,
    refreshMine: _renderWeekTab
  };
})();
