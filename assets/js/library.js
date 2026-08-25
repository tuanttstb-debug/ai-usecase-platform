// ─────────────────────────────────────────────────────────────────
// library.js — P15 Thư viện Prompt/Workflow/Quick Win dùng chung
//
// Gom Use Case ĐÃ DUYỆT (Approved), nhóm theo Workflow, cho lọc/tìm + Copy Prompt.
// Prompt lấy khi mở modal (getUseCase) — list chỉ trả summary.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _all = [];
  var _cache = {};       // record_id → uc summary
  var _full = {};        // record_id → full UC (fetched)
  var _reuse = {};       // record_id → { count, reusers[] }
  var _threshold = 3;
  var _current = null;   // record_id đang mở modal
  var _filter = { search: '', workflow: '', team: '' };

  function _me() { var u = AuthService.getUser(); return u ? _norm(u.email) : ''; }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg, type) { if (typeof Toast !== 'undefined') Toast.show(msg, type || 'info'); else alert(msg); }
  function _norm(s) { return String(s || '').trim().toLowerCase(); }
  function _wf(uc)  { return String(uc.workflow || uc.Workflow || '').trim() || '(Chưa gắn workflow)'; }
  function _rid(uc) { return uc.record_id || uc.Record_ID || ''; }

  async function _load() {
    document.getElementById('libLoading').style.display = '';
    document.getElementById('libContent').style.display = 'none';
    var bar = document.getElementById('libFilterBar'); if (bar) bar.style.display = 'none';
    try {
      var results = await Promise.all([ Api.listUseCases({ status: 'Approved', limit: 0 }), Api.getReuseCounts() ]);
      var res = results[0];
      var arr = Array.isArray(res) ? res : (res.items || res.data || []);
      _all = arr.filter(function (uc) { return _norm(uc.status) === 'approved'; });
      var rc = results[1] || {};
      _reuse = rc.map || {};
      _threshold = rc.threshold || 3;
      _populateFilters();
      _render();
    } catch (e) {
      var l = document.getElementById('libLoading');
      l.textContent = 'Không tải được thư viện. Kiểm tra kết nối GAS.';
      l.style.color = 'var(--color-error)';
    }
  }

  function _populateFilters() {
    var wfs = [], teams = [];
    _all.forEach(function (uc) {
      var w = _wf(uc); if (wfs.indexOf(w) === -1) wfs.push(w);
      var t = String(uc.team || '').trim(); if (t && teams.indexOf(t) === -1) teams.push(t);
    });
    wfs.sort(); teams.sort();
    var wfSel = document.getElementById('libWorkflowFilter');
    if (wfSel) wfSel.innerHTML = '<option value="">Tất cả workflow</option>' +
      wfs.map(function (w) { return '<option value="' + esc(w) + '">' + esc(w) + '</option>'; }).join('');
    var tSel = document.getElementById('libTeamFilter');
    if (tSel) tSel.innerHTML = '<option value="">Tất cả team</option>' +
      teams.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
  }

  function _render() {
    var q = _norm(_filter.search), wf = _filter.workflow, team = _norm(_filter.team);
    var list = _all.filter(function (uc) {
      if (wf && _wf(uc) !== wf) return false;
      if (team && _norm(uc.team) !== team) return false;
      if (q) {
        var hay = _norm(uc.name) + ' ' + _norm(_wf(uc)) + ' ' + _norm(uc.owner_name) + ' ' + _norm(uc.usecase_id);
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var wrap = document.getElementById('libContent');
    if (!list.length) {
      wrap.innerHTML = '<p class="empty-state">Không có Use Case nào khớp bộ lọc.</p>';
    } else {
      // Nhóm theo Workflow
      var byWf = {}, order = [];
      list.forEach(function (uc) { var w = _wf(uc); if (!byWf[w]) { byWf[w] = []; order.push(w); } byWf[w].push(uc); _cache[_rid(uc)] = uc; });
      wrap.innerHTML = order.map(function (w) {
        var cards = byWf[w].map(function (uc) {
          var rid = _rid(uc);
          var score = (uc.total_score || uc.uc_score || 0);
          var scoreChip = score > 0
            ? '<span class="score-chip" style="background:rgba(123,44,191,.12);color:var(--color-primary)">' + score + '</span>'
            : '';

          // Tái dùng (T05/M05)
          var rz = _reuse[rid] || { count: 0, reusers: [] };
          var me = _me();
          var iReused = (rz.reusers || []).indexOf(me) !== -1;
          var isMine = (uc.owner_email && _norm(uc.owner_email) === me) ||
                       (uc.owner_login && _norm(uc.owner_login) === me);
          var reached = rz.count >= _threshold;
          var reuseBadge = '<div style="font-size:12px;' + (reached ? 'color:var(--color-success,#2e7d32);font-weight:600' : 'color:var(--color-text-secondary)') + '">' +
            '♻ ' + rz.count + ' người tái dùng' + (reached ? ' · Lan tỏa đạt ✓' : '') + '</div>';
          var reuseBtn;
          if (isMine) reuseBtn = '';
          else if (iReused) reuseBtn = '<button class="btn btn--ghost btn--sm" disabled style="opacity:.6">✓ Bạn đã tái dùng</button>';
          else reuseBtn = '<button class="btn btn--ghost btn--sm" onclick="Library.reuse(\'' + esc(rid) + '\')">♻ Tôi đã tái dùng</button>';

          return '<div class="dash-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
              '<span class="id-badge">' + esc(uc.usecase_id || rid) + '</span>' + scoreChip +
            '</div>' +
            '<div style="font-weight:600;color:var(--color-text)">' + esc(uc.name || '(không tên)') + '</div>' +
            '<div style="font-size:12px;color:var(--color-text-secondary)">' + esc(uc.team || '—') + ' · ' + esc(uc.owner_name || uc.owner || '—') + '</div>' +
            reuseBadge +
            '<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">' +
              '<button class="btn btn--ghost btn--sm" onclick="Library.open(\'' + esc(rid) + '\')">Xem &amp; Copy Prompt</button>' +
              reuseBtn +
            '</div>' +
          '</div>';
        }).join('');
        return '<div class="section-panel" style="margin-bottom:var(--space-5)">' +
          '<div class="section-panel-header"><span class="section-panel-title">' + esc(w) + '</span>' +
            '<span style="font-size:var(--text-xs);color:var(--color-text-secondary)">' + byWf[w].length + ' use case</span></div>' +
          '<div class="section-panel-body"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-3)">' + cards + '</div></div>' +
        '</div>';
      }).join('');
    }

    var countEl = document.getElementById('libResultCount');
    if (countEl) countEl.textContent = list.length + ' use case';
    document.getElementById('libLoading').style.display = 'none';
    document.getElementById('libContent').style.display = '';
    var bar = document.getElementById('libFilterBar'); if (bar) bar.style.display = '';
  }

  // ── Prompt modal ──
  var PROMPT_FIELDS = [
    ['Prompt_Role', 'Vai trò (Role)'], ['Prompt_Task', 'Nhiệm vụ (Task)'],
    ['Prompt_Goal', 'Mục tiêu (Goal)'], ['Prompt_Context', 'Ngữ cảnh (Context)'],
    ['Prompt_Input', 'Đầu vào (Input)'], ['Prompt_Steps', 'Các bước (Steps)'],
    ['Prompt_Output_Format', 'Định dạng đầu ra (Output)'], ['Prompt_Evaluation', 'Tiêu chí đánh giá (Evaluation)'],
  ];

  function _promptText(uc) {
    return PROMPT_FIELDS
      .map(function (f) { var v = String(uc[f[0]] || '').trim(); return v ? (f[1] + ':\n' + v) : ''; })
      .filter(Boolean).join('\n\n');
  }

  async function open(rid) {
    _current = rid;
    var sum = _cache[rid] || {};
    document.getElementById('libModalTitle').textContent = sum.name || 'Prompt';
    document.getElementById('libModalId').textContent = sum.usecase_id || '';
    document.getElementById('libModalBody').innerHTML = '<div class="lb-loading"><div class="spinner"></div> Đang tải prompt…</div>';
    document.getElementById('libModal').classList.remove('hidden');

    try {
      var uc = _full[rid] || await Api.getUseCase(rid);
      _full[rid] = uc;
      _renderModal(uc);
    } catch (e) {
      document.getElementById('libModalBody').innerHTML = '<p style="color:var(--color-error);padding:var(--space-4)">Không tải được nội dung prompt.</p>';
    }
  }

  function _renderModal(uc) {
    var rows = PROMPT_FIELDS.map(function (f) {
      var v = String(uc[f[0]] || '').trim();
      if (!v) return '';
      return '<div class="detail-field detail-field--full">' +
        '<div class="detail-label">' + esc(f[1]) + '</div>' +
        '<div class="detail-value detail-value--pre">' + esc(v) + '</div></div>';
    }).filter(Boolean).join('');

    var guide = '';
    [['When_To_Use', 'Khi nào dùng'], ['Usage_Steps', 'Hướng dẫn thực hiện'], ['Usage_Notes', 'Lưu ý']].forEach(function (g) {
      var v = String(uc[g[0]] || '').trim();
      if (v) guide += '<div class="detail-field detail-field--full"><div class="detail-label">' + esc(g[1]) + '</div><div class="detail-value detail-value--pre">' + esc(v) + '</div></div>';
    });

    var flow = String(uc.Flow_Description || '').trim();
    var flowHtml = flow ? '<div class="detail-field detail-field--full"><div class="detail-label">Mô tả luồng AI</div><div class="detail-value detail-value--pre">' + esc(flow) + '</div></div>' : '';

    var body = document.getElementById('libModalBody');
    if (!rows && !guide && !flowHtml) {
      body.innerHTML = '<p style="padding:var(--space-4);color:var(--color-text-muted)">Use case này chưa có nội dung prompt/hướng dẫn.</p>';
    } else {
      body.innerHTML = flowHtml + (rows ? '<h4 style="margin:var(--space-3) 0 var(--space-2)">Prompt</h4>' + rows : '') +
        (guide ? '<h4 style="margin:var(--space-3) 0 var(--space-2)">Quick Win — hướng dẫn</h4>' + guide : '');
    }
  }

  function copyPrompt() {
    var uc = _full[_current];
    if (!uc) return;
    var text = _promptText(uc);
    if (!text) { showToast('Use case này chưa có nội dung prompt.', 'info'); return; }
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

  function closeModal() { document.getElementById('libModal').classList.add('hidden'); _current = null; }

  // Xác nhận đã tái dùng UC (T05/M05)
  async function reuse(rid) {
    var user = AuthService.getUser();
    if (!user) return;
    try {
      var res = await Api.submitReuseConfirm({ Record_ID: rid, token: AuthService.getToken(), reviewer_email: user.email });
      // cập nhật local rồi re-render
      _reuse[rid] = _reuse[rid] || { count: 0, reusers: [] };
      if (_reuse[rid].reusers.indexOf(_me()) === -1) _reuse[rid].reusers.push(_me());
      _reuse[rid].count = (res && res.reuse_count != null) ? res.reuse_count : (_reuse[rid].count + 1);
      showToast('Đã ghi nhận bạn tái dùng UC này!', 'success');
      _render();
    } catch (e) {
      showToast('Lỗi: ' + (e.message || e), 'error');
    }
  }

  function _bind() {
    var s = document.getElementById('libSearch');
    if (s) { var d; s.addEventListener('input', function () { clearTimeout(d); d = setTimeout(function () { _filter.search = s.value; _render(); }, 250); }); }
    var wf = document.getElementById('libWorkflowFilter');
    if (wf) wf.addEventListener('change', function () { _filter.workflow = wf.value; _render(); });
    var t = document.getElementById('libTeamFilter');
    if (t) t.addEventListener('change', function () { _filter.team = t.value; _render(); });
  }

  document.addEventListener('DOMContentLoaded', function () { _bind(); _load(); });

  window.Library = { open: open, copyPrompt: copyPrompt, closeModal: closeModal, reuse: reuse };

})();
