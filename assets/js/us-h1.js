// ─────────────────────────────────────────────────────────────────
// us-h1.js — CR (2026-09-12): View "US H1" (chỉ đọc) + xem chi tiết + lọc theo trường chung
//
// Bảng tra cứu Use Case kỳ H1, đọc từ sheet 'Data H1' qua route h1-list.
// TÁCH hoàn toàn khỏi US H2 (MASTER_DATA) + KPI/leaderboard/chấm điểm.
// Read-only: tìm kiếm tự do + lọc Team/Workflow/Stage; bấm dòng → xem chi tiết đầy đủ.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _all = [];
  var _search = '';
  var _filter = { team: '', workflow: '', stage: '' };
  var _byId = {}; // usecase_id → uc

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _norm(s) { return String(s || '').trim().toLowerCase(); }

  function _stagePill(stage) {
    var sl = (typeof STAGE_LABELS !== 'undefined' && STAGE_LABELS[stage])
      ? STAGE_LABELS[stage]
      : { short: stage || '—', color: '#6D6D7A', bg: '#F5F5F7' };
    return '<span class="stage-pill" style="background:' + sl.bg + ';color:' + sl.color +
      ';display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:var(--text-xs);font-weight:600">' +
      '<span style="width:6px;height:6px;border-radius:50%;background:' + sl.color + ';display:inline-block;flex-shrink:0"></span>' +
      esc(sl.short) + '</span>';
  }

  function _planSummary(uc) {
    var months = [['T9', uc.action_plan_m09], ['T10', uc.action_plan_m10], ['T11', uc.action_plan_m11], ['T12', uc.action_plan_m12]];
    var parts = months.filter(function (m) { return m[1] && String(m[1]).trim(); })
                      .map(function (m) { return m[0] + ': ' + String(m[1]).trim(); });
    return parts.length ? parts.join(' · ') : '—';
  }

  function _matches(uc) {
    if (_filter.team && _norm(uc.team) !== _norm(_filter.team)) return false;
    if (_filter.workflow && _norm(uc.workflow) !== _norm(_filter.workflow)) return false;
    if (_filter.stage && String(uc.stage) !== _filter.stage) return false;
    if (_search) {
      var hay = [uc.usecase_id, uc.name, uc.team, uc.owner_name, uc.owner_email, uc.workflow, uc.stage, uc.status, uc.pain_point, uc.description]
        .map(_norm).join(' ');
      if (hay.indexOf(_search) === -1) return false;
    }
    return true;
  }

  function _populateFilters() {
    var teams = [], wfs = [];
    _all.forEach(function (uc) {
      var t = String(uc.team || '').trim(); if (t && teams.indexOf(t) === -1) teams.push(t);
      var w = String(uc.workflow || '').trim(); if (w && wfs.indexOf(w) === -1) wfs.push(w);
    });
    teams.sort(); wfs.sort();
    var tSel = document.getElementById('h1TeamFilter');
    if (tSel) tSel.innerHTML = '<option value="">Tất cả team</option>' +
      teams.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    var wSel = document.getElementById('h1WorkflowFilter');
    if (wSel) wSel.innerHTML = '<option value="">Tất cả workflow</option>' +
      wfs.map(function (w) { return '<option value="' + esc(w) + '">' + esc(w) + '</option>'; }).join('');
  }

  function _render() {
    var content = document.getElementById('h1Content');
    var countEl = document.getElementById('h1Count');
    if (!content) return;

    var list = _all.filter(_matches);
    if (countEl) countEl.textContent = list.length + ' / ' + _all.length + ' use case';

    if (!_all.length) {
      content.innerHTML = '<p class="empty-state" style="padding:var(--space-6);text-align:center;color:var(--color-text-muted)">Chưa có dữ liệu US H1 (sheet “Data H1” trống hoặc chưa tồn tại).</p>';
      return;
    }
    if (!list.length) {
      content.innerHTML = '<p class="empty-state" style="padding:var(--space-6);text-align:center;color:var(--color-text-muted)">Không có use case nào khớp bộ lọc.</p>';
      return;
    }

    var rows = list.map(function (uc) {
      var id = uc.usecase_id || uc.record_id || '';
      return '<tr data-id="' + esc(id) + '" style="cursor:pointer" onclick="UsH1.openDetail(\'' + esc(id) + '\')">' +
        '<td style="white-space:nowrap;padding:8px 10px"><span class="id-badge">' + esc(uc.usecase_id || '') + '</span></td>' +
        '<td style="font-weight:600;color:var(--color-text);padding:8px 10px">' + esc(uc.name || '(không tên)') + '</td>' +
        '<td style="padding:8px 10px">' + esc(uc.team || '—') + '</td>' +
        '<td style="padding:8px 10px">' + esc(uc.owner_name || uc.owner_email || '—') + '</td>' +
        '<td style="padding:8px 10px">' + esc(uc.workflow || '—') + '</td>' +
        '<td style="white-space:nowrap;padding:8px 10px">' + _stagePill(uc.stage) + '</td>' +
        '<td style="max-width:280px;color:var(--color-text-secondary);font-size:var(--text-xs);padding:8px 10px">' + esc(_planSummary(uc)) + '</td>' +
      '</tr>';
    }).join('');

    content.innerHTML =
      '<div style="overflow-x:auto"><table class="h1-table" style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">' +
        '<thead><tr style="text-align:left;border-bottom:2px solid var(--color-border)">' +
          '<th style="padding:8px 10px">Mã</th><th style="padding:8px 10px">Tên Use Case</th><th style="padding:8px 10px">Team</th>' +
          '<th style="padding:8px 10px">Owner</th><th style="padding:8px 10px">Workflow</th><th style="padding:8px 10px">Stage</th><th style="padding:8px 10px">Kế hoạch</th>' +
        '</tr></thead><tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  // ── Detail modal (chỉ đọc) ─────────────────────────────────────
  function _field(label, val) {
    var v = String(val == null ? '' : val).trim();
    if (!v) return '';
    return '<div style="margin-bottom:var(--space-3)"><div style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">' + esc(label) + '</div>' +
      '<div style="white-space:pre-wrap;font-size:var(--text-sm);color:var(--color-text)">' + esc(v) + '</div></div>';
  }

  function openDetail(id) {
    var uc = _byId[id];
    if (!uc) return;
    var modal = document.getElementById('h1Modal');
    var title = document.getElementById('h1ModalTitle');
    var meta  = document.getElementById('h1ModalMeta');
    var body  = document.getElementById('h1ModalBody');
    if (!modal) return;

    if (title) title.textContent = uc.name || '(không tên)';
    if (meta) {
      var bits = [uc.usecase_id, uc.team, uc.owner_name || uc.owner_email, uc.workflow, uc.status].filter(Boolean);
      meta.innerHTML = esc(bits.join(' · ')) + ' &nbsp; ' + _stagePill(uc.stage);
    }

    var plan = '';
    [['Kế hoạch T9', uc.action_plan_m09], ['Kế hoạch T10', uc.action_plan_m10], ['Kế hoạch T11', uc.action_plan_m11], ['Kế hoạch T12', uc.action_plan_m12]]
      .forEach(function (p) { plan += _field(p[0], p[1]); });

    var promptHtml = '';
    [['Vai trò (Role)', uc.prompt_role], ['Nhiệm vụ (Task)', uc.prompt_task], ['Mục tiêu (Goal)', uc.prompt_goal],
     ['Ngữ cảnh (Context)', uc.prompt_context], ['Đầu vào (Input)', uc.prompt_input], ['Các bước (Steps)', uc.prompt_steps],
     ['Định dạng đầu ra (Output)', uc.prompt_output_format], ['Tiêu chí đánh giá (Evaluation)', uc.prompt_evaluation]]
      .forEach(function (p) { promptHtml += _field(p[0], p[1]); });

    var demo = String(uc.demo_link || '').trim();
    var demoHtml = demo
      ? '<div style="margin-bottom:var(--space-3)"><div style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;margin-bottom:3px">Demo</div>' +
        '<a href="' + esc(demo) + '" target="_blank" rel="noopener" class="btn btn--ghost btn--sm">▶ Mở demo (ổ chung)</a></div>'
      : '';

    var html = '';
    html += _field('Điểm đau / Vấn đề', uc.pain_point);
    html += _field('Quy trình hiện tại', uc.current_process);
    html += _field('Mô tả luồng xử lý AI', uc.flow_description);
    if (plan.trim()) html += '<h4 style="margin:var(--space-3) 0 var(--space-2)">Kế hoạch hành động theo tháng</h4>' + plan;
    if (promptHtml.trim()) html += '<h4 style="margin:var(--space-3) 0 var(--space-2)">Prompt</h4>' + promptHtml;
    html += _field('Khi nào dùng', uc.when_to_use);
    html += _field('Hướng dẫn thực hiện', uc.usage_steps);
    html += _field('Lưu ý', uc.usage_notes);
    html += demoHtml;
    if (!html.trim()) html = '<p style="color:var(--color-text-muted)">Use case này chưa có nội dung chi tiết.</p>';
    if (body) body.innerHTML = html;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function closeDetail() {
    var modal = document.getElementById('h1Modal');
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
  }

  function _load() {
    var loading = document.getElementById('h1Loading');
    var content = document.getElementById('h1Content');
    if (loading) loading.style.display = '';
    if (content) content.style.display = 'none';

    Api.listUseCasesH1().then(function (res) {
      _all = Array.isArray(res) ? res : (res && (res.items || res.data)) || [];
      _byId = {};
      _all.forEach(function (uc) { _byId[uc.usecase_id || uc.record_id || ''] = uc; });
      window._h1UseCases = _all; // expose cho test
      if (loading) loading.style.display = 'none';
      if (content) content.style.display = '';
      _populateFilters();
      _render();
    }).catch(function () {
      if (loading) { loading.textContent = 'Không tải được danh sách US H1. Kiểm tra kết nối GAS.'; loading.style.color = 'var(--color-error)'; }
    });
  }

  function _bind() {
    var s = document.getElementById('h1Search');
    if (s && !s._bound) {
      var d;
      s.addEventListener('input', function () { clearTimeout(d); d = setTimeout(function () { _search = _norm(s.value); _render(); }, 200); });
      s._bound = true;
    }
    [['h1TeamFilter', 'team'], ['h1WorkflowFilter', 'workflow'], ['h1StageFilter', 'stage']].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el && !el._bound) { el.addEventListener('change', function () { _filter[pair[1]] = el.value; _render(); }); el._bound = true; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
  }

  if (window.Router) window.Router.register('us-h1', {
    title: 'US H1 (chỉ đọc)',
    init: function () { _bind(); _load(); }
  });

  window.UsH1 = { reload: _load, openDetail: openDetail, closeDetail: closeDetail };
})();
