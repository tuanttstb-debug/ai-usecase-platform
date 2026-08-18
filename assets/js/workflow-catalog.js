(function () {
  'use strict';

  var _rows   = [];    // [{catalog_id, nhom, workflow, usecase, active, updated_at}]
  var _groups = [];    // danh sách Nhóm gợi ý
  var _teamMap = [];   // [{team, nhom}]
  var _cache  = {};    // key → row (edit)

  /* ── Utils ── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg, type) {
    if (typeof Toast !== 'undefined') Toast.show(msg, type || 'info');
    else alert(msg);
  }
  function adminEmail() {
    var u = AuthService.getUser();
    return u ? u.email : '';
  }

  /* ── Load ── */
  async function _load() {
    var wrap = document.getElementById('wfTableWrap');
    if (!wrap) return;
    wrap.innerHTML = '<p class="empty-state">Đang tải danh mục…</p>';
    try {
      var res = await Api.listWorkflowCatalog();
      _rows    = (res && res.rows)     || [];
      _groups  = (res && res.groups)   || [];
      _teamMap = (res && res.team_map) || [];
      _render();
    } catch (e) {
      wrap.innerHTML = '<p class="empty-state" style="color:var(--color-error)">Không tải được danh mục. Kiểm tra GAS deployment + đã chạy seedWorkflowCatalog() chưa.</p>';
    }
  }

  /* ── Render (nhóm theo Nhóm → Workflow) ── */
  function _render() {
    var wrap = document.getElementById('wfTableWrap');
    if (!wrap) return;

    var q = (document.getElementById('wfSearch').value || '').trim().toLowerCase();
    var rows = _rows.filter(function (r) {
      if (!q) return true;
      return (r.workflow || '').toLowerCase().indexOf(q) !== -1
          || (r.usecase  || '').toLowerCase().indexOf(q) !== -1
          || (r.nhom     || '').toLowerCase().indexOf(q) !== -1;
    });

    if (!rows.length) {
      wrap.innerHTML = '<p class="empty-state">' + (q ? 'Không có kết quả khớp.' : 'Danh mục trống. Chạy seedWorkflowCatalog() trong GAS, hoặc nhấn "+ Thêm Use case".') + '</p>';
      _updateWorkflowDatalist();
      return;
    }

    // sort theo nhom, workflow rồi usecase
    rows.sort(function (a, b) {
      return (a.nhom + '|' + a.workflow + '|' + a.usecase)
        .localeCompare(b.nhom + '|' + b.workflow + '|' + b.usecase, 'vi');
    });

    _cache = {};
    var body = rows.map(function (r, i) {
      var key = 'w_' + i;
      _cache[key] = r;
      var activeHtml = r.active
        ? '<span class="status-badge" style="background:rgba(76,175,80,.12);color:#388e3c">Hiện</span>'
        : '<span class="status-badge" style="background:rgba(244,67,54,.1);color:#c62828">Ẩn</span>';
      return '<tr>' +
        '<td style="color:var(--color-text-secondary);font-size:var(--text-xs);white-space:nowrap">' + esc(r.nhom) + '</td>' +
        '<td>' + esc(r.workflow) + '</td>' +
        '<td>' + (r.usecase ? esc(r.usecase) : '<em style="color:var(--color-text-muted)">(workflow rỗng)</em>') + '</td>' +
        '<td>' + activeHtml + '</td>' +
        '<td style="white-space:nowrap"><button class="btn btn--ghost btn--sm" onclick="WorkflowCatalog._edit(\'' + key + '\')">Sửa</button></td>' +
        '</tr>';
    }).join('');

    wrap.innerHTML =
      '<div style="overflow-x:auto">' +
      '<table class="data-table" style="min-width:720px">' +
      '<thead><tr><th>Nhóm</th><th>Workflow</th><th>Use case</th><th>Trạng thái</th><th></th></tr></thead>' +
      '<tbody>' + body + '</tbody></table></div>' +
      '<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">' +
        rows.length + ' dòng · ' + _countWorkflows(rows) + ' workflow · ' + _groups.length + ' nhóm' +
      '</p>';

    _updateWorkflowDatalist();
  }

  function _countWorkflows(rows) {
    var set = {};
    rows.forEach(function (r) { set[r.nhom + '|' + r.workflow] = true; });
    return Object.keys(set).length;
  }

  function _fillGroupSelect(sel, includeBlank) {
    if (!sel) return;
    sel.innerHTML = (includeBlank ? '<option value="">— Chọn —</option>' : '') +
      _groups.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('');
  }

  function _updateWorkflowDatalist() {
    var dl = document.getElementById('wfWorkflowList');
    if (!dl) return;
    var set = {};
    _rows.forEach(function (r) { if (r.workflow) set[r.workflow] = true; });
    dl.innerHTML = Object.keys(set).map(function (w) { return '<option value="' + esc(w) + '"></option>'; }).join('');
  }

  /* ── Use case modal ── */
  function _openModal(row) {
    var isEdit = !!row;
    document.getElementById('wfModalTitle').textContent = isEdit ? 'Sửa Use case' : 'Thêm Use case';
    _fillGroupSelect(document.getElementById('wfNhom'), false);
    document.getElementById('wfNhom').value      = isEdit ? row.nhom : (_groups[0] || '');
    document.getElementById('wfWorkflow').value  = isEdit ? row.workflow : '';
    document.getElementById('wfUseCase').value   = isEdit ? row.usecase : '';
    document.getElementById('wfActive').checked  = isEdit ? !!row.active : true;
    document.getElementById('wfModalSaveBtn').dataset.id = isEdit ? row.catalog_id : '';
    document.getElementById('wfDeleteBtn').style.display = isEdit ? '' : 'none';
    document.getElementById('wfDeleteBtn').dataset.id = isEdit ? row.catalog_id : '';
    _updateWorkflowDatalist();
    document.getElementById('wfModal').classList.remove('hidden');
  }
  function _closeModal() { document.getElementById('wfModal').classList.add('hidden'); }

  async function _save() {
    var nhom = (document.getElementById('wfNhom').value || '').trim();
    var wf   = (document.getElementById('wfWorkflow').value || '').trim();
    var uc   = (document.getElementById('wfUseCase').value || '').trim();
    var active = document.getElementById('wfActive').checked;
    if (!nhom) { showToast('Vui lòng chọn Nhóm', 'error'); return; }
    if (!wf)   { showToast('Vui lòng nhập Workflow', 'error'); return; }

    var btn = document.getElementById('wfModalSaveBtn');
    var id  = btn.dataset.id || '';
    btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      var payload = { Nhom: nhom, Workflow: wf, UseCase: uc, Active: active, reviewer_email: adminEmail() };
      if (id) payload.Catalog_ID = id;
      var res = await Api.upsertWorkflow(payload);
      showToast(res.created ? 'Đã thêm Use case' : 'Đã cập nhật', 'success');
      _closeModal();
      await _load();
    } catch (e) {
      showToast('Lỗi lưu: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Lưu';
    }
  }

  async function _delete() {
    var id = document.getElementById('wfDeleteBtn').dataset.id || '';
    if (!id) return;
    if (!window.confirm('Xóa dòng này khỏi danh mục? (không ảnh hưởng Use case đã đăng ký)')) return;
    var btn = document.getElementById('wfDeleteBtn');
    btn.disabled = true;
    try {
      await Api.deleteWorkflow({ Catalog_ID: id, reviewer_email: adminEmail() });
      showToast('Đã xóa', 'success');
      _closeModal();
      await _load();
    } catch (e) {
      showToast('Lỗi xóa: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ── Rename workflow modal ── */
  function _workflowsOfGroup(nhom) {
    var set = {};
    _rows.forEach(function (r) { if (r.nhom === nhom && r.workflow) set[r.workflow] = true; });
    return Object.keys(set);
  }
  function _fillRenameWorkflows() {
    var nhom = document.getElementById('rnNhom').value;
    var sel  = document.getElementById('rnWorkflow');
    var list = _workflowsOfGroup(nhom);
    sel.innerHTML = list.length
      ? list.map(function (w) { return '<option value="' + esc(w) + '">' + esc(w) + '</option>'; }).join('')
      : '<option value="">(nhóm chưa có workflow)</option>';
  }
  function _openRename() {
    _fillGroupSelect(document.getElementById('rnNhom'), false);
    _fillGroupSelect(document.getElementById('rnNewNhom'), false);
    document.getElementById('rnNhom').value = _groups[0] || '';
    _fillRenameWorkflows();
    document.getElementById('rnNewNhom').value = document.getElementById('rnNhom').value;
    document.getElementById('rnNewName').value = '';
    document.getElementById('wfRenameModal').classList.remove('hidden');
  }
  function _closeRename() { document.getElementById('wfRenameModal').classList.add('hidden'); }

  async function _saveRename() {
    var nhom   = document.getElementById('rnNhom').value;
    var oldWf  = document.getElementById('rnWorkflow').value;
    var newWf  = (document.getElementById('rnNewName').value || '').trim();
    var newNhom = document.getElementById('rnNewNhom').value;
    if (!oldWf)  { showToast('Nhóm chưa có workflow để đổi', 'error'); return; }
    if (!newWf)  { showToast('Vui lòng nhập tên workflow mới', 'error'); return; }
    var btn = document.getElementById('wfRenameSaveBtn');
    btn.disabled = true; btn.textContent = 'Đang đổi…';
    try {
      var res = await Api.renameWorkflow({
        Nhom: nhom, Workflow: oldWf, New_Workflow: newWf, New_Nhom: newNhom, reviewer_email: adminEmail()
      });
      showToast('Đã đổi tên (' + (res.updated || 0) + ' use case)', 'success');
      _closeRename();
      await _load();
    } catch (e) {
      showToast('Lỗi đổi tên: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Đổi tên';
    }
  }

  /* ── Bind ── */
  function _bind() {
    document.getElementById('wfAddBtn').addEventListener('click', function () { _openModal(null); });
    document.getElementById('wfRenameBtn').addEventListener('click', _openRename);
    document.getElementById('wfModalCloseBtn').addEventListener('click', _closeModal);
    document.getElementById('wfModalCancelBtn').addEventListener('click', _closeModal);
    document.getElementById('wfModalSaveBtn').addEventListener('click', _save);
    document.getElementById('wfDeleteBtn').addEventListener('click', _delete);
    document.getElementById('wfRenameCloseBtn').addEventListener('click', _closeRename);
    document.getElementById('wfRenameCancelBtn').addEventListener('click', _closeRename);
    document.getElementById('wfRenameSaveBtn').addEventListener('click', _saveRename);
    document.getElementById('rnNhom').addEventListener('change', _fillRenameWorkflows);

    var search = document.getElementById('wfSearch');
    var t = null;
    search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(_render, 200); });

    [document.getElementById('wfModal'), document.getElementById('wfRenameModal')].forEach(function (m) {
      if (m) m.addEventListener('click', function (e) { if (e.target === m) m.classList.add('hidden'); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () { _bind(); _load(); });

  window.WorkflowCatalog = {
    _edit: function (key) { var r = _cache[key]; if (r) _openModal(r); }
  };
})();
