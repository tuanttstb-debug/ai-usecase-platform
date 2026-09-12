// ─────────────────────────────────────────────────────────────────
// ai-exercise.js — CR (2026-09-12): "Bài tập AI"
//
// Chia sẻ thao tác AI nhỏ (chưa đủ thành US): Tiêu đề + Mô tả + Prompt + Link demo
// (ổ chung). 1 trang gộp: đăng bài + tra cứu (tìm kiếm) như thư viện. KHÔNG tính KPI.
// Nhịp "1 bài/tuần" = khuyến khích (chỉ hiện "tuần này bạn đã đăng X bài", không chặn).
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _all    = [];
  var _search = '';
  var _editId = null;   // đang sửa bài nào (null = đăng mới)

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _norm(s) { return String(s || '').trim().toLowerCase(); }
  function _user()  { return (typeof AuthService !== 'undefined') ? AuthService.getUser() : null; }
  function _me()    { var u = _user(); return u ? _norm(u.email) : ''; }
  function _isAdmin(){ var u = _user(); return !!(u && u.role === 'admin'); }
  function showToast(m, t) { if (typeof Toast !== 'undefined') Toast.show(m, t || 'info'); }

  function _startOfWeek() {
    var d = new Date();
    var day = d.getDay();               // 0=CN,1=T2
    var diff = (day === 0) ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function _weekCountMine() {
    var me = _me(), sow = _startOfWeek();
    return _all.filter(function (e) {
      if (_norm(e.owner_email) !== me) return false;
      var c = new Date(e.created_at || 0);
      return !isNaN(c) && c >= sow;
    }).length;
  }

  function _matches(e) {
    if (!_search) return true;
    var hay = [e.exercise_id, e.title, e.description, e.owner_name, e.team].map(_norm).join(' ');
    return hay.indexOf(_search) !== -1;
  }

  // ── Load + render ──────────────────────────────────────────────
  function _load() {
    var loading = document.getElementById('exLoading');
    if (loading) { loading.style.display = ''; loading.textContent = 'Đang tải Bài tập AI…'; loading.style.color = ''; }
    Api.listExercises().then(function (res) {
      _all = Array.isArray(res) ? res : (res && (res.items || res.data)) || [];
      window._exercises = _all; // expose cho test
      if (loading) loading.style.display = 'none';
      _renderHint();
      _render();
    }).catch(function () {
      if (loading) { loading.textContent = 'Không tải được Bài tập AI. Kiểm tra kết nối GAS.'; loading.style.color = 'var(--color-error)'; }
    });
  }

  function _renderHint() {
    var hint = document.getElementById('exWeekHint');
    if (!hint) return;
    var n = _weekCountMine();
    hint.textContent = n > 0 ? ('Tuần này bạn đã đăng ' + n + ' bài.') : 'Tuần này bạn chưa đăng bài nào — chia sẻ 1 thao tác AI nhỏ nhé!';
  }

  function _render() {
    var wrap = document.getElementById('exList');
    var countEl = document.getElementById('exCount');
    if (!wrap) return;
    var list = _all.filter(_matches);
    if (countEl) countEl.textContent = list.length + ' / ' + _all.length + ' bài';

    if (!_all.length) {
      wrap.innerHTML = '<p class="empty-state" style="padding:var(--space-6);text-align:center;color:var(--color-text-muted)">Chưa có bài tập AI nào. Hãy là người đầu tiên chia sẻ!</p>';
      return;
    }
    if (!list.length) {
      wrap.innerHTML = '<p class="empty-state" style="padding:var(--space-6);text-align:center;color:var(--color-text-muted)">Không có bài nào khớp tìm kiếm.</p>';
      return;
    }

    var me = _me(), admin = _isAdmin();
    wrap.innerHTML = list.map(function (e) {
      var mine = _norm(e.owner_email) === me;
      var canManage = mine || admin;
      var demo = String(e.demo_link || '').trim();
      var demoHtml = demo
        ? '<a href="' + esc(demo) + '" target="_blank" rel="noopener" class="btn btn--ghost btn--sm">▶ Xem demo (ổ chung)</a>'
        : '';
      var manageHtml = canManage
        ? '<button class="btn btn--ghost btn--sm" onclick="AiExercise.edit(\'' + esc(e.exercise_id) + '\')">Sửa</button>' +
          '<button class="btn btn--ghost btn--sm" onclick="AiExercise.del(\'' + esc(e.exercise_id) + '\')" style="color:var(--color-error)">Xóa</button>'
        : '';
      return '<div class="dash-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="font-weight:600;color:var(--color-text)">' + esc(e.title || '(không tiêu đề)') + '</div>' +
          '<span class="id-badge" style="flex-shrink:0">' + esc(e.exercise_id || '') + '</span>' +
        '</div>' +
        (e.description ? '<div style="font-size:var(--text-sm);color:var(--color-text-secondary);white-space:pre-wrap">' + esc(e.description) + '</div>' : '') +
        '<div style="font-size:12px;color:var(--color-text-muted)">' + esc(e.owner_name || e.owner_email || '—') + (e.team ? ' · ' + esc(e.team) : '') + '</div>' +
        '<details class="ex-prompt"><summary style="cursor:pointer;color:var(--color-primary);font-size:var(--text-sm);font-weight:600">Xem Prompt</summary>' +
          '<pre style="white-space:pre-wrap;background:var(--color-surface-alt,rgba(0,0,0,.03));padding:10px;border-radius:8px;margin-top:6px;font-family:var(--font-mono,monospace);font-size:12px">' + esc(e.prompt || '') + '</pre>' +
          '<button class="btn btn--ghost btn--sm" onclick="AiExercise.copy(\'' + esc(e.exercise_id) + '\')">📋 Copy Prompt</button>' +
        '</details>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">' + demoHtml + manageHtml + '</div>' +
      '</div>';
    }).join('');
  }

  // ── Submit (đăng mới / cập nhật) ───────────────────────────────
  function _v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  function _submit() {
    var title  = _v('exTitle');
    var prompt = _v('exPrompt');
    var msg = document.getElementById('exFormMsg');
    if (!title)  { if (msg) msg.textContent = 'Vui lòng nhập Tiêu đề.'; showToast('Thiếu Tiêu đề', 'error'); return; }
    if (!prompt) { if (msg) msg.textContent = 'Vui lòng nhập Prompt.'; showToast('Thiếu Prompt', 'error'); return; }
    if (msg) msg.textContent = '';

    var u = _user() || {};
    var payload = {
      Title:       title,
      Description: _v('exDescription'),
      Prompt:      prompt,
      Demo_Link:   _v('exDemoLink'),
      Owner_Name:  u.displayName || u.email || '',
      Owner_Email: u.email || '',
      Team:        u.team || '',
      requester_email: u.email || '',
      is_admin:    _isAdmin() ? 'true' : 'false'
    };

    var btn = document.getElementById('exSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

    var p = _editId
      ? Api.updateExercise(Object.assign({ Exercise_ID: _editId }, payload))
      : Api.createExercise(payload);

    p.then(function () {
      showToast(_editId ? 'Đã cập nhật bài tập!' : 'Đã đăng bài tập AI!', 'success');
      _resetForm();
      _load();
    }).catch(function (err) {
      showToast('Lỗi: ' + ((err && err.message) || err), 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = _editId ? 'Lưu thay đổi' : 'Đăng bài'; }
    });
  }

  function _resetForm() {
    _editId = null;
    ['exTitle', 'exDescription', 'exPrompt', 'exDemoLink'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    var btn = document.getElementById('exSubmitBtn'); if (btn) btn.textContent = 'Đăng bài';
    var ttl = document.getElementById('exFormTitle'); if (ttl) ttl.textContent = 'Đăng bài tập AI';
    var cancel = document.getElementById('exCancelBtn'); if (cancel) cancel.style.display = 'none';
    var msg = document.getElementById('exFormMsg'); if (msg) msg.textContent = '';
  }

  function edit(id) {
    var e = _all.filter(function (x) { return x.exercise_id === id; })[0];
    if (!e) return;
    _editId = id;
    var set = function (fid, val) { var el = document.getElementById(fid); if (el) el.value = val || ''; };
    set('exTitle', e.title); set('exDescription', e.description); set('exPrompt', e.prompt); set('exDemoLink', e.demo_link);
    var btn = document.getElementById('exSubmitBtn'); if (btn) btn.textContent = 'Lưu thay đổi';
    var ttl = document.getElementById('exFormTitle'); if (ttl) ttl.textContent = 'Sửa bài tập ' + id;
    var cancel = document.getElementById('exCancelBtn'); if (cancel) cancel.style.display = '';
    var form = document.getElementById('exFormCard'); if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function del(id) {
    var u = _user() || {};
    Api.deleteExercise({ Exercise_ID: id, requester_email: u.email || '', is_admin: _isAdmin() ? 'true' : 'false' })
      .then(function () { showToast('Đã xóa bài tập.', 'success'); if (_editId === id) _resetForm(); _load(); })
      .catch(function (err) { showToast('Lỗi xóa: ' + ((err && err.message) || err), 'error'); });
  }

  function copy(id) {
    var e = _all.filter(function (x) { return x.exercise_id === id; })[0];
    if (!e || !e.prompt) { showToast('Bài này chưa có prompt.', 'info'); return; }
    var text = e.prompt;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast('Đã copy prompt!', 'success'); }, function () { _fallbackCopy(text); });
    } else { _fallbackCopy(text); }
  }
  function _fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      showToast('Đã copy prompt!', 'success');
    } catch (e) { showToast('Không copy được — hãy chọn và copy thủ công.', 'error'); }
  }

  function _bind() {
    var btn = document.getElementById('exSubmitBtn');
    if (btn && !btn._bound) { btn.addEventListener('click', _submit); btn._bound = true; }
    var cancel = document.getElementById('exCancelBtn');
    if (cancel && !cancel._bound) { cancel.addEventListener('click', _resetForm); cancel._bound = true; }
    var s = document.getElementById('exSearch');
    if (s && !s._bound) {
      var d;
      s.addEventListener('input', function () { clearTimeout(d); d = setTimeout(function () { _search = _norm(s.value); _render(); }, 200); });
      s._bound = true;
    }
  }

  if (window.Router) window.Router.register('ai-exercise', {
    title: 'Bài tập AI',
    init: function () { _resetForm(); _bind(); _load(); }
  });

  window.AiExercise = { reload: _load, edit: edit, del: del, copy: copy };
})();
