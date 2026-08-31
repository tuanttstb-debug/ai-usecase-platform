// ─────────────────────────────────────────────────────────────────
// workflow-coverage.js — CR2c: Độ phủ Workflow
//
// Đối chiếu WORKFLOW_CATALOG (kỳ vọng: Nhóm → Workflow → Use case) với US ĐÃ ĐĂNG KÝ
// (list, field `workflow`). Ma trận theo Nhóm × workflow: đã có US / chưa + đếm.
// Drill 1 workflow → danh sách US catalog, đánh dấu đã đăng ký / chưa.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _groups = [];     // [{ nhom, workflows:[{ name, usecases:[...], regCount, coveredNames:Set, regList:[...] }] }]
  var _regByWf = {};    // norm(workflow) → [uc...]

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function isActive(v) {
    if (v === true) return true;
    if (v === false) return false;
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return s === '' || s === 'true' || s === '1' || s === 'yes' || s === 'x' || s === 'active';
  }

  async function load() {
    try {
      var res = await Promise.all([ Api.listWorkflowCatalog(), Api.listUseCases({ limit: 0 }) ]);
      var catalog = res[0] || {};
      var rows = catalog.rows || [];
      var ucs  = res[1] || [];
      _build(rows, ucs);
      _render();
    } catch (e) {
      var l = document.getElementById('wfcLoading');
      if (l) { l.textContent = 'Không tải được dữ liệu độ phủ. Kiểm tra kết nối GAS.'; l.style.color = 'var(--color-error)'; }
    }
  }

  function _build(rows, ucs) {
    // Index US đã đăng ký theo workflow
    _regByWf = {};
    ucs.forEach(function (uc) {
      var wf = norm(uc.workflow || uc.Workflow);
      if (!wf) return;
      (_regByWf[wf] = _regByWf[wf] || []).push(uc);
    });

    // Gom catalog (chỉ active) theo Nhóm → Workflow → [usecase names]
    var order = [];         // giữ thứ tự nhóm xuất hiện
    var map = {};           // nhom → { order:[wf], wf:{ wfName:[uc...] } }
    rows.forEach(function (r) {
      if (!isActive(r.active !== undefined ? r.active : r.Active)) return;
      var nhom = String(r.nhom || r.Nhom || '').trim();
      var wf   = String(r.workflow || r.Workflow || '').trim();
      var uc   = String(r.usecase || r.UseCase || '').trim();
      if (!nhom || !wf) return;
      if (!map[nhom]) { map[nhom] = { order: [], wf: {} }; order.push(nhom); }
      var g = map[nhom];
      if (!g.wf[wf]) { g.wf[wf] = []; g.order.push(wf); }
      if (uc) g.wf[wf].push(uc);
    });

    _groups = order.map(function (nhom) {
      var g = map[nhom];
      return {
        nhom: nhom,
        workflows: g.order.map(function (wfName) {
          var catUcs = g.wf[wfName];
          var reg    = _regByWf[norm(wfName)] || [];
          var covered = {};   // norm(usecase) đã có US đăng ký cùng tên
          reg.forEach(function (u) { covered[norm(u.name || u.UseCase_Name)] = true; });
          var coveredNames = catUcs.filter(function (n) { return covered[norm(n)]; });
          return {
            name: wfName,
            usecases: catUcs,
            regCount: reg.length,
            regList: reg,
            coveredCatalog: coveredNames.length,
            catalogCount: catUcs.length
          };
        })
      };
    });
  }

  function _render() {
    var loading = document.getElementById('wfcLoading');
    var content = document.getElementById('wfcContent');
    var summary = document.getElementById('wfcSummary');

    // Tổng hợp
    var totWf = 0, wfWithUs = 0, totCatUc = 0, coveredUc = 0;
    _groups.forEach(function (g) {
      g.workflows.forEach(function (w) {
        totWf++;
        if (w.regCount > 0) wfWithUs++;
        totCatUc  += w.catalogCount;
        coveredUc += w.coveredCatalog;
      });
    });

    summary.innerHTML =
      _tile('Workflow đã có US', wfWithUs + ' / ' + totWf, wfWithUs === totWf ? 'var(--color-success)' : 'var(--color-primary)') +
      _tile('Workflow còn trống', (totWf - wfWithUs), (totWf - wfWithUs) > 0 ? 'var(--color-warning)' : 'var(--color-success)') +
      _tile('US catalog đã đăng ký', coveredUc + ' / ' + totCatUc, 'var(--color-primary)') +
      _tile('US catalog chưa có', (totCatUc - coveredUc), (totCatUc - coveredUc) > 0 ? 'var(--color-warning)' : 'var(--color-success)');
    summary.style.display = '';

    if (!_groups.length) {
      content.innerHTML = '<div class="empty-state">Chưa có dữ liệu WORKFLOW_CATALOG.</div>';
    } else {
      content.innerHTML = _groups.map(function (g, gi) {
        var rows = g.workflows.map(function (w, wi) {
          var has = w.regCount > 0;
          var badge = has
            ? '<span class="status-badge" style="background:#4CAF5020;color:#2E7D32">✓ Đã có US</span>'
            : '<span class="status-badge" style="background:#F6B10020;color:#B26A00">○ Chưa có</span>';
          var missing = w.catalogCount - w.coveredCatalog;
          return '<tr style="cursor:pointer" onclick="WorkflowCoverage.openWf(' + gi + ',' + wi + ')">' +
            '<td>' + esc(w.name) + '</td>' +
            '<td style="text-align:center">' + badge + '</td>' +
            '<td style="text-align:center">' + w.regCount + '</td>' +
            '<td style="text-align:center">' + w.coveredCatalog + ' / ' + w.catalogCount + '</td>' +
            '<td style="text-align:center">' + (missing > 0 ? '<strong style="color:#B26A00">' + missing + '</strong>' : '0') + '</td>' +
          '</tr>';
        }).join('');
        return '<div class="dash-card" style="margin-bottom:var(--space-4)">' +
          '<div class="dash-card-header"><h3>' + esc(g.nhom) + '</h3></div>' +
          '<div style="overflow-x:auto"><table class="dash-table" style="margin:0">' +
            '<thead><tr><th>Workflow</th><th style="text-align:center">Trạng thái</th><th style="text-align:center">US đăng ký</th><th style="text-align:center">US catalog đã có</th><th style="text-align:center">Chưa đăng ký</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table></div>' +
        '</div>';
      }).join('');
    }

    loading.style.display = 'none';
    content.style.display = '';
  }

  function _tile(label, value, color) {
    return '<div class="kpi-card">' +
      '<div class="kpi-info">' +
        '<div class="kpi-value" style="color:' + (color || 'var(--color-primary)') + '">' + esc(value) + '</div>' +
        '<div class="kpi-label">' + esc(label) + '</div>' +
      '</div>' +
    '</div>';
  }

  function openWf(gi, wi) {
    var g = _groups[gi]; if (!g) return;
    var w = g.workflows[wi]; if (!w) return;
    var covered = {};
    (w.regList || []).forEach(function (u) { covered[norm(u.name || u.UseCase_Name)] = true; });

    var body = document.getElementById('wfcModalBody');
    document.getElementById('wfcModalTitle').textContent = w.name;
    document.getElementById('wfcModalCount').textContent = w.coveredCatalog + '/' + w.catalogCount + ' US catalog';

    var catRows = w.usecases.length
      ? w.usecases.map(function (n) {
          var ok = covered[norm(n)];
          return '<tr><td>' + esc(n) + '</td><td style="text-align:center">' +
            (ok ? '<span class="status-badge" style="background:#4CAF5020;color:#2E7D32">✓ Đã đăng ký</span>'
                : '<span class="status-badge" style="background:#F6B10020;color:#B26A00">Chưa</span>') +
          '</td></tr>';
        }).join('')
      : '<tr><td colspan="2" style="color:var(--color-text-muted)">Workflow này chưa khai US mẫu trong catalog.</td></tr>';

    // US đăng ký ngoài catalog (tên tự do — không khớp US mẫu nào)
    var extra = (w.regList || []).filter(function (u) {
      return w.usecases.every(function (n) { return norm(n) !== norm(u.name || u.UseCase_Name); });
    });
    var extraHtml = extra.length
      ? '<p style="margin:var(--space-4) 0 var(--space-2);font-weight:600">US đã đăng ký ngoài danh mục mẫu (' + extra.length + ')</p>' +
        '<ul style="margin:0;padding-left:var(--space-5)">' + extra.map(function (u) {
          return '<li>' + esc(u.name || u.UseCase_Name) + ' <span class="id-badge">' + esc(u.usecase_id || u.UseCase_ID || '') + '</span></li>';
        }).join('') + '</ul>'
      : '';

    body.innerHTML =
      '<table class="dash-table" style="margin:0"><thead><tr><th>Use case (catalog)</th><th style="text-align:center;width:150px">Đăng ký</th></tr></thead><tbody>' + catRows + '</tbody></table>' + extraHtml;
    document.getElementById('wfcModal').classList.remove('hidden');
  }

  function closeModal() { document.getElementById('wfcModal').classList.add('hidden'); }

  window.WorkflowCoverage = { openWf: openWf, closeModal: closeModal, _build: _build, _groups: function () { return _groups; } };
  document.addEventListener('DOMContentLoaded', load);
})();
