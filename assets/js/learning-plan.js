// ─────────────────────────────────────────────────────────────────
// learning-plan.js — CR (2026-10-01): "Kế hoạch học tập" (AIUS-001 · 5 nhóm mục tiêu)
//
// 1 trang gộp:
//   (A) Đăng ký của tôi: bài tập tuần + công cụ + mức dùng AI + khóa học (thêm/sửa/xóa, hạn học xong)
//   (B) Theo dõi chung: ô số tổng + bảng khóa học theo hạn (quá hạn / sắp tới hạn 7 ngày / chưa rõ khóa /
//       chưa đăng ký) lọc theo team — ai cũng xem được để cả Trung tâm cùng thấy tiến độ
//   (C) Việc lớn cấp Trung tâm (chỉ đọc; PM nhập ở sheet VIEC_LON)
// Trạng thái "Hoàn thành" + link chứng chỉ: vòng 2.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var SOON_DAYS = 7;
  var _data = { members: [], courses: [], big_tasks: [] };
  var _editCourseId = null;
  var _filter = { team: '', state: '', q: '' };

  var STATE_META = {
    overdue: { label: 'Quá hạn',          cls: 'badge-error'   },
    soon:    { label: 'Sắp tới hạn',      cls: 'badge-warning' },
    ontrack: { label: 'Đúng tiến độ',     cls: 'badge-primary' },
    done:    { label: 'Hoàn thành',       cls: 'badge-success' },
    nodate:  { label: 'Chưa có hạn',      cls: 'badge-muted'   },
    unclear: { label: 'Chưa rõ khóa',     cls: 'badge-warning' },
    missing: { label: 'Chưa đăng ký',     cls: 'badge-error'   },
    nocourse:{ label: 'Chưa có khóa',     cls: 'badge-muted'   }
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

  // ── Hạn học: số ngày còn lại tính theo ngày (bỏ giờ) ─────────────
  function _today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function _daysLeft(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return null;
    var p = ymd.split('-');
    var t = new Date(+p[0], +p[1] - 1, +p[2]);
    return Math.round((t - _today()) / 86400000);
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
  function _badge(st) {
    var m = STATE_META[st] || STATE_META.nodate;
    return '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>';
  }

  // ── Dòng theo dõi: 1 dòng / khóa; member chưa có khóa → 1 dòng trống ──
  function _rows() {
    var byUser = {};
    _data.courses.forEach(function (c) { (byUser[c.username] = byUser[c.username] || []).push(c); });
    var rows = [];
    _data.members.forEach(function (m) {
      var list = byUser[m.username] || [];
      if (m.status === 'Chưa đăng ký') {
        rows.push({ m: m, c: null, state: 'missing' });
      } else if (!list.length) {
        rows.push({ m: m, c: null, state: 'nocourse' });
      } else {
        list.forEach(function (c) { rows.push({ m: m, c: c, state: courseState(c) }); });
      }
      delete byUser[m.username];
    });
    // Khóa của người không có dòng đăng ký (vd teamlead tự thêm) vẫn hiện
    Object.keys(byUser).forEach(function (u) {
      byUser[u].forEach(function (c) {
        rows.push({ m: { username: u, display_name: c.display_name, team: c.team, exercise_plan: '' }, c: c, state: courseState(c) });
      });
    });
    var order = { overdue: 0, missing: 1, soon: 2, unclear: 3, nocourse: 4, nodate: 5, ontrack: 6, done: 7 };
    rows.sort(function (a, b) {
      return (order[a.state] - order[b.state]) ||
        String(a.m.team).localeCompare(String(b.m.team)) ||
        String(a.c ? a.c.target_date : '').localeCompare(String(b.c ? b.c.target_date : ''));
    });
    return rows;
  }

  // ── Load ───────────────────────────────────────────────────────
  function _load() {
    var loading = _el('lpLoading');
    if (loading) { loading.style.display = ''; loading.textContent = 'Đang tải kế hoạch học tập…'; loading.style.color = ''; }
    Api.listLearning().then(function (res) {
      res = res || {};
      _data = {
        members:   Array.isArray(res.members) ? res.members : [],
        courses:   Array.isArray(res.courses) ? res.courses : [],
        big_tasks: Array.isArray(res.big_tasks) ? res.big_tasks : []
      };
      window._learningPlan = _data; // expose cho test
      if (loading) loading.style.display = 'none';
      _fillTeamFilter();
      _renderMine();
      _renderTracking();
      _renderBigTasks();
    }).catch(function () {
      if (loading) { loading.textContent = 'Không tải được kế hoạch học tập. Kiểm tra kết nối GAS.'; loading.style.color = 'var(--color-error)'; }
    });
  }

  // ── (A) Đăng ký của tôi ─────────────────────────────────────────
  function _myMember() {
    var me = _me();
    return _data.members.filter(function (m) { return m.username === me; })[0] || null;
  }
  function _myCourses() {
    var me = _me();
    return _data.courses.filter(function (c) { return c.username === me; });
  }

  function _renderMine() {
    var m = _myMember();
    var hint = _el('lpMyStatus');
    if (hint) {
      hint.innerHTML = m && m.status === 'Đã đăng ký'
        ? '<span class="badge badge-success">Đã đăng ký</span>' + (m.submitted_at ? ' <span style="color:var(--color-text-muted)">từ ' + esc(_fmtDate(String(m.submitted_at).slice(0, 10))) + '</span>' : '')
        : '<span class="badge badge-error">Chưa đăng ký</span>';
    }
    if (m) {
      _set('lpExercise', m.exercise_plan);
      _set('lpTools', m.ai_tools);
      _set('lpUsage', m.usage_level);
      _set('lpSupport', m.support_need);
    }
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
        var st = courseState(c);
        var sub = [c.provider, c.paid === 'Có' ? 'trả phí' : ''].filter(Boolean).join(' · ');
        return '<tr data-course="' + esc(c.course_id) + '">' +
          '<td>' + esc(c.course_name) + (sub ? '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(sub) + '</div>' : '') + '</td>' +
          '<td style="white-space:nowrap">' + _fmtDate(c.target_date) + '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(_leftText(c)) + '</div></td>' +
          '<td>' + _badge(st) + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" title="Sửa" aria-label="Sửa khóa học" onclick="LearningPlan.editCourse(\'' + esc(c.course_id) + '\')"><i class="fa-solid fa-pen"></i> Sửa</button>' +
            '<button class="btn btn-ghost btn-sm" title="Xóa" aria-label="Xóa khóa học" style="color:var(--color-error)" onclick="LearningPlan.delCourse(\'' + esc(c.course_id) + '\')"><i class="fa-solid fa-trash"></i></button>' +
          '</td></tr>';
      }).join('') + '</tbody></table>';
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

  function _submitRegister() {
    var plan = _v('lpExercise');
    var msg = _el('lpRegMsg');
    if (!plan) { if (msg) msg.textContent = 'Vui lòng nhập bài tập tuần này.'; showToast('Thiếu bài tập tuần này', 'error'); return; }
    if (msg) msg.textContent = '';
    var payload = _payloadBase();
    payload.Exercise_Plan = plan;
    payload.AI_Tools      = _v('lpTools');
    payload.Usage_Level   = _v('lpUsage');
    payload.Support_Need  = _v('lpSupport');
    var btn = _el('lpRegBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
    Api.registerLearning(payload).then(function () {
      showToast('Đã lưu đăng ký!', 'success');
      _load();
    }).catch(function (err) {
      showToast('Lỗi: ' + ((err && err.message) || err), 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu đăng ký'; }
    });
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

  // ── (B) Theo dõi chung ──────────────────────────────────────────
  function _fillTeamFilter() {
    var sel = _el('lpTeamFilter');
    if (!sel) return;
    var teams = {};
    _data.members.forEach(function (m) { if (m.team) teams[m.team] = 1; });
    _data.courses.forEach(function (c) { if (c.team) teams[c.team] = 1; });
    var cur = sel.value;
    sel.innerHTML = '<option value="">Tất cả team</option>' +
      Object.keys(teams).sort().map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    sel.value = cur;
  }

  function _inTeam(team) { return !_filter.team || team === _filter.team; }

  function _summary() {
    var members = _data.members.filter(function (m) { return _inTeam(m.team); });
    var courses = _data.courses.filter(function (c) { return _inTeam(c.team); });
    var reg = members.filter(function (m) { return m.status === 'Đã đăng ký'; }).length;
    var count = function (st) { return courses.filter(function (c) { return courseState(c) === st; }).length; };
    return {
      registered: reg, total: members.length,
      courses:    courses.filter(function (c) { return courseState(c) !== 'unclear'; }).length,
      soon:       count('soon'),
      overdue:    count('overdue'),
      unclear:    count('unclear'),
      missing:    members.length - reg
    };
  }

  function _tile(id, value, label, cls) {
    return '<div class="kpi-card ' + (cls || '') + '" id="' + id + '" role="listitem">' +
      '<div class="kpi-value">' + esc(value) + '</div><div class="kpi-label">' + esc(label) + '</div></div>';
  }

  function _renderTracking() {
    var s = _summary();
    var tiles = _el('lpSummary');
    if (tiles) {
      tiles.style.display = '';
      tiles.innerHTML =
        _tile('lpKpiRegistered', s.registered + '/' + s.total, 'Đã đăng ký', 'kpi-success') +
        _tile('lpKpiCourses',    s.courses,                    'Khóa đã chọn', 'kpi-info') +
        _tile('lpKpiSoon',       s.soon,                       'Sắp tới hạn (≤' + SOON_DAYS + ' ngày)', 'kpi-warning') +
        _tile('lpKpiOverdue',    s.overdue,                    'Quá hạn', 'kpi-warning') +
        _tile('lpKpiUnclear',    s.unclear,                    'Chưa rõ khóa', '') +
        _tile('lpKpiMissing',    s.missing,                    'Chưa đăng ký', '');
    }

    var q = _norm(_filter.q);
    var rows = _rows().filter(function (r) {
      if (!_inTeam(r.m.team)) return false;
      if (_filter.state && r.state !== _filter.state) return false;
      if (!q) return true;
      var hay = [r.m.username, r.m.display_name, r.m.team, r.m.exercise_plan, r.c && r.c.course_name, r.c && r.c.provider].map(_norm).join(' ');
      return hay.indexOf(q) !== -1;
    });
    var count = _el('lpCount');
    if (count) count.textContent = rows.length + ' dòng';
    var wrap = _el('lpTable');
    if (!wrap) return;
    if (!rows.length) {
      wrap.innerHTML = '<p class="list-empty">Không có dòng nào khớp bộ lọc.</p>';
      return;
    }
    wrap.innerHTML = '<div class="rq-table-wrap"><table class="dash-table" aria-label="Theo dõi kế hoạch học tập"><thead><tr>' +
      '<th>Team</th><th>Thành viên</th><th>Bài tập tuần đăng ký</th><th>Khóa học</th><th>Nơi học</th><th>Trả phí</th><th>Hạn học xong</th><th>Tình trạng</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        var c = r.c;
        return '<tr data-state="' + r.state + '">' +
          '<td>' + esc(r.m.team || '—') + '</td>' +
          '<td><div style="font-weight:600">' + esc(r.m.display_name || r.m.username) + '</div><div style="font-size:12px;color:var(--color-text-muted)">' + esc(r.m.username) + '</div></td>' +
          '<td style="max-width:280px">' + esc(r.m.exercise_plan || '—') + '</td>' +
          '<td>' + esc(c ? c.course_name : '—') + (c && c.note ? '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(c.note) + '</div>' : '') + '</td>' +
          '<td>' + esc(c ? (c.provider || '—') : '—') + '</td>' +
          '<td>' + esc(c ? (c.paid || '—') : '—') + '</td>' +
          '<td style="white-space:nowrap">' + (c ? _fmtDate(c.target_date) : '—') + '</td>' +
          '<td style="white-space:nowrap">' + _badge(r.state) + (c ? ' <span style="font-size:12px;color:var(--color-text-muted)">' + esc(_leftText(c)) + '</span>' : '') + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  // ── (C) Việc lớn ────────────────────────────────────────────────
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
    var map = [
      ['lpRegBtn', 'click', _submitRegister],
      ['lpCourseBtn', 'click', _submitCourse],
      ['lpCourseCancel', 'click', _resetCourseForm]
    ];
    map.forEach(function (b) {
      var el = _el(b[0]);
      if (el && !el._bound) { el.addEventListener(b[1], b[2]); el._bound = true; }
    });
    var team = _el('lpTeamFilter');
    if (team && !team._bound) { team.addEventListener('change', function () { _filter.team = team.value; _renderTracking(); }); team._bound = true; }
    var state = _el('lpStateFilter');
    if (state && !state._bound) { state.addEventListener('change', function () { _filter.state = state.value; _renderTracking(); }); state._bound = true; }
    var s = _el('lpSearch');
    if (s && !s._bound) {
      var d;
      s.addEventListener('input', function () { clearTimeout(d); d = setTimeout(function () { _filter.q = s.value; _renderTracking(); }, 200); });
      s._bound = true;
    }
  }

  if (window.Router) window.Router.register('learning-plan', {
    title: 'Kế hoạch học tập',
    init: function () { _resetCourseForm(); _bind(); _load(); }
  });

  window.LearningPlan = { reload: _load, editCourse: editCourse, delCourse: delCourse, courseState: courseState };
})();
