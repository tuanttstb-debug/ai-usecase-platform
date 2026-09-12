// ─────────────────────────────────────────────────────────────────
// us-h1.js — CR (2026-09-12): View "US H1" (chỉ đọc)
//
// Bảng tra cứu Use Case kỳ H1, đọc từ sheet 'Data H1' qua route h1-list.
// TÁCH hoàn toàn khỏi US H2 (MASTER_DATA) + KPI/leaderboard/chấm điểm.
// Read-only: không sửa/không đăng ký/không chấm. Cột: Mã · Tên US · Team ·
// Owner · Workflow · Stage · Kế hoạch (tháng).
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _all = [];
  var _loaded = false;
  var _search = '';

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

  // Gộp 4 ô kế hoạch tháng thành 1 tóm tắt ngắn (T9/T10/T11/T12) cho ô "Kế hoạch".
  function _planSummary(uc) {
    var months = [
      ['T9', uc.action_plan_m09], ['T10', uc.action_plan_m10],
      ['T11', uc.action_plan_m11], ['T12', uc.action_plan_m12]
    ];
    var parts = months
      .filter(function (m) { return m[1] && String(m[1]).trim(); })
      .map(function (m) { return m[0] + ': ' + String(m[1]).trim(); });
    return parts.length ? parts.join(' · ') : '—';
  }

  function _matchesSearch(uc) {
    if (!_search) return true;
    var hay = [uc.usecase_id, uc.name, uc.team, uc.owner_name, uc.owner_email, uc.workflow]
      .map(_norm).join(' ');
    return hay.indexOf(_search) !== -1;
  }

  function _render() {
    var content = document.getElementById('h1Content');
    var countEl = document.getElementById('h1Count');
    if (!content) return;

    var list = _all.filter(_matchesSearch);
    if (countEl) countEl.textContent = list.length + ' / ' + _all.length + ' use case';

    if (!_all.length) {
      content.innerHTML = '<p class="empty-state" style="padding:var(--space-6);text-align:center;color:var(--color-text-muted)">' +
        'Chưa có dữ liệu US H1 (sheet “Data H1” trống hoặc chưa tồn tại).</p>';
      return;
    }
    if (!list.length) {
      content.innerHTML = '<p class="empty-state" style="padding:var(--space-6);text-align:center;color:var(--color-text-muted)">' +
        'Không có use case nào khớp tìm kiếm.</p>';
      return;
    }

    var rows = list.map(function (uc) {
      return '<tr>' +
        '<td style="white-space:nowrap"><span class="id-badge">' + esc(uc.usecase_id || '') + '</span></td>' +
        '<td style="font-weight:600;color:var(--color-text)">' + esc(uc.name || '(không tên)') + '</td>' +
        '<td>' + esc(uc.team || '—') + '</td>' +
        '<td>' + esc(uc.owner_name || uc.owner_email || '—') + '</td>' +
        '<td>' + esc(uc.workflow || '—') + '</td>' +
        '<td style="white-space:nowrap">' + _stagePill(uc.stage) + '</td>' +
        '<td style="max-width:320px;color:var(--color-text-secondary);font-size:var(--text-xs)">' + esc(_planSummary(uc)) + '</td>' +
      '</tr>';
    }).join('');

    content.innerHTML =
      '<div style="overflow-x:auto">' +
        '<table class="h1-table" style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">' +
          '<thead><tr style="text-align:left;border-bottom:2px solid var(--color-border)">' +
            '<th style="padding:8px 10px">Mã</th>' +
            '<th style="padding:8px 10px">Tên Use Case</th>' +
            '<th style="padding:8px 10px">Team</th>' +
            '<th style="padding:8px 10px">Owner</th>' +
            '<th style="padding:8px 10px">Workflow</th>' +
            '<th style="padding:8px 10px">Stage</th>' +
            '<th style="padding:8px 10px">Kế hoạch</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';
  }

  function _load() {
    var loading = document.getElementById('h1Loading');
    var content = document.getElementById('h1Content');
    if (loading) loading.style.display = '';
    if (content) content.style.display = 'none';

    Api.listUseCasesH1().then(function (res) {
      var arr = Array.isArray(res) ? res : (res && (res.items || res.data)) || [];
      _all = arr;
      _loaded = true;
      window._h1UseCases = _all; // expose cho test
      if (loading) loading.style.display = 'none';
      if (content) content.style.display = '';
      _render();
    }).catch(function () {
      if (loading) {
        loading.textContent = 'Không tải được danh sách US H1. Kiểm tra kết nối GAS.';
        loading.style.color = 'var(--color-error)';
      }
    });
  }

  function _bind() {
    var s = document.getElementById('h1Search');
    if (s && !s._bound) {
      var d;
      s.addEventListener('input', function () {
        clearTimeout(d);
        d = setTimeout(function () { _search = _norm(s.value); _render(); }, 200);
      });
      s._bound = true;
    }
  }

  // SPA: lazy-init khi router mở view #us-h1
  if (window.Router) window.Router.register('us-h1', {
    title: 'US H1 (chỉ đọc)',
    init: function () { _bind(); _load(); }
  });

  window.UsH1 = { reload: _load };
})();
