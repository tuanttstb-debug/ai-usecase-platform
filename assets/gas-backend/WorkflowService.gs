// ─────────────────────────────────────────────────────────────────
// WorkflowService.gs — H2 Giai đoạn 2: Nhập liệu theo Workflow
//
// Nguồn droplist đăng ký Use case = sheet WORKFLOW_CATALOG (trên spreadsheet AI US).
// Mỗi row: [Catalog_ID, Nhom, Workflow, UseCase, Active, Updated_At].
// Lọc theo Team qua sheet TEAM_GROUP_MAP: mọi user thấy '1. Workflow chung'
// + Nhóm ứng với Team của mình.
//
// SETUP 1 LẦN (trong GAS Editor AI US project):
//   1. Chạy seedWorkflowCatalog()  → tạo 2 sheet + import 69 US + seed Team→Nhóm
//      + thêm cột Workflow/Workflow_Group vào MASTER_DATA (self-heal).
//   2. Sau đó quản lý qua trang Cấu hình Workflow (admin) — không cần chạy lại.
// ─────────────────────────────────────────────────────────────────

// Sentinel FE dùng cho option "Khác — nhập tự do" (không lưu vào catalog).
var WORKFLOW_OTHER_VALUE = '__OTHER__';

/**
 * Đảm bảo 2 sheet catalog tồn tại + có header. Seed TEAM_GROUP_MAP nếu rỗng.
 * Idempotent — an toàn khi gọi nhiều lần.
 */
function ensureWorkflowSheets_() {
  ensureSheetColumns_(SHEETS.WORKFLOW, WORKFLOW_HEADERS);
  ensureSheetColumns_(SHEETS.TEAM_GROUP, TEAM_GROUP_HEADERS);

  // Seed Team→Nhóm nếu chưa có dòng dữ liệu nào
  var tg = readSheetAsObjects_(SHEETS.TEAM_GROUP);
  if (!tg.length) {
    var tgSheet = getOrCreateSheet_(SHEETS.TEAM_GROUP);
    TEAM_GROUP_SEED.forEach(function (pair) {
      tgSheet.appendRow([pair[0], pair[1]]);
    });
  }
}

/**
 * Sinh Catalog_ID kế tiếp dạng WFC-NNNN dựa trên ID lớn nhất hiện có.
 */
function _nextCatalogId_(rows) {
  var max = 0;
  (rows || []).forEach(function (r) {
    var m = /^WFC-(\d+)$/.exec(String(r.Catalog_ID || '').trim());
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return 'WFC-' + String(max + 1).padStart(4, '0');
}

function _isActive_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'x' || s === 'active' || s === '';
}

/**
 * Đọc TEAM_GROUP_MAP → { teamLower: Nhom }.
 */
function getTeamGroupMap_() {
  ensureWorkflowSheets_();
  var rows = readSheetAsObjects_(SHEETS.TEAM_GROUP);
  var map = {};
  rows.forEach(function (r) {
    var t = String(r.Team || '').trim().toLowerCase();
    var g = String(r.Nhom || '').trim();
    if (t && g) map[t] = g;
  });
  return map;
}

/**
 * Cây catalog đã LỌC theo Team (dùng cho droplist đăng ký).
 * @param {string} team  Team của user (có thể rỗng → chỉ thấy Nhóm chung)
 * @returns {{ groups: Array<{ nhom, workflows: Array<{ name, usecases:string[] }> }> }}
 */
function getWorkflowCatalog_(team) {
  ensureWorkflowSheets_();
  var rows = readSheetAsObjects_(SHEETS.WORKFLOW);
  var teamMap = getTeamGroupMap_();

  // Các Nhóm user được thấy: luôn có Nhóm chung + Nhóm ứng với Team.
  var allowed = {};
  allowed[WORKFLOW_COMMON_GROUP] = true;
  var teamGroup = teamMap[String(team || '').trim().toLowerCase()];
  if (teamGroup) allowed[teamGroup] = true;

  // Gom theo Nhóm → Workflow → [UseCase], giữ thứ tự xuất hiện.
  var groupOrder = [];
  var groups = {}; // nhom → { order:[], wf:{ name:[uc...] } }

  rows.forEach(function (r) {
    if (!_isActive_(r.Active)) return;
    var nhom = String(r.Nhom || '').trim();
    var wf   = String(r.Workflow || '').trim();
    var uc   = String(r.UseCase || '').trim();
    if (!nhom || !wf) return;
    if (!allowed[nhom]) return;

    if (!groups[nhom]) { groups[nhom] = { order: [], wf: {} }; groupOrder.push(nhom); }
    var g = groups[nhom];
    if (!g.wf[wf]) { g.wf[wf] = []; g.order.push(wf); }
    if (uc) g.wf[wf].push(uc);
  });

  var out = groupOrder.map(function (nhom) {
    var g = groups[nhom];
    return {
      nhom: nhom,
      workflows: g.order.map(function (w) { return { name: w, usecases: g.wf[w] }; })
    };
  });

  return { groups: out };
}

/**
 * Toàn bộ catalog (kể cả inactive) cho trang quản lý admin.
 * @returns {{ rows: Array, groups: string[], team_map: Array<{team,nhom}> }}
 */
function listWorkflowCatalog_() {
  ensureWorkflowSheets_();
  var rows = readSheetAsObjects_(SHEETS.WORKFLOW).map(function (r) {
    return {
      catalog_id: String(r.Catalog_ID || '').trim(),
      nhom:       String(r.Nhom || '').trim(),
      workflow:   String(r.Workflow || '').trim(),
      usecase:    String(r.UseCase || '').trim(),
      active:     _isActive_(r.Active),
      updated_at: r.Updated_At ? String(r.Updated_At) : ''
    };
  });

  // Danh sách Nhóm gợi ý = nhóm mặc định + nhóm đã có trong data.
  var groupSet = {};
  [WORKFLOW_COMMON_GROUP, '2. Workflow đặc thù PO', '3. Workflow PTKD & QLDM',
   '4. Workflow đặc thù Số hóa tín dụng'].forEach(function (g) { groupSet[g] = true; });
  rows.forEach(function (r) { if (r.nhom) groupSet[r.nhom] = true; });

  var tm = readSheetAsObjects_(SHEETS.TEAM_GROUP).map(function (r) {
    return { team: String(r.Team || '').trim(), nhom: String(r.Nhom || '').trim() };
  });

  return { rows: rows, groups: Object.keys(groupSet), team_map: tm };
}

/**
 * Thêm mới / cập nhật 1 dòng catalog (US) theo Catalog_ID.
 * body: { Catalog_ID?, Nhom, Workflow, UseCase, Active }
 * @returns {{ created:boolean, catalog_id:string }}
 */
function workflowUpsert_(body) {
  ensureWorkflowSheets_();
  var nhom = sanitizeStr_(body.Nhom || body.nhom, 200);
  var wf   = sanitizeStr_(body.Workflow || body.workflow, 300);
  var uc   = sanitizeStr_(body.UseCase !== undefined ? body.UseCase : body.usecase, 500);
  var active = (body.Active === undefined && body.active === undefined) ? true
             : _isActive_(body.Active !== undefined ? body.Active : body.active);
  if (!nhom) throw new Error('Thiếu Nhóm');
  if (!wf)   throw new Error('Thiếu Workflow');

  var id  = String(body.Catalog_ID || body.catalog_id || '').trim();
  var now = new Date().toISOString();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var all = readSheetAsObjects_(SHEETS.WORKFLOW);

    if (id) {
      var found = findRowByField_(SHEETS.WORKFLOW, 'Catalog_ID', id);
      if (!found) throw new Error('Không tìm thấy Catalog_ID: ' + id);
      var upd = { Catalog_ID: id, Nhom: nhom, Workflow: wf, UseCase: uc, Active: active, Updated_At: now };
      var row = found.headers.map(function (h) { return toSheetValue_(upd[h] !== undefined ? upd[h] : found.obj[h]); });
      found.sheet.getRange(found.rowIndex, 1, 1, found.headers.length).setValues([row]);
      return { created: false, catalog_id: id };
    }

    var newId = _nextCatalogId_(all);
    appendRowFromObject_(SHEETS.WORKFLOW, {
      Catalog_ID: newId, Nhom: nhom, Workflow: wf, UseCase: uc, Active: active, Updated_At: now
    });
    return { created: true, catalog_id: newId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xóa 1 dòng catalog theo Catalog_ID (xóa hẳn row).
 */
function workflowDelete_(body) {
  ensureWorkflowSheets_();
  var id = String(body.Catalog_ID || body.catalog_id || '').trim();
  if (!id) throw new Error('Thiếu Catalog_ID');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findRowByField_(SHEETS.WORKFLOW, 'Catalog_ID', id);
    if (!found) throw new Error('Không tìm thấy Catalog_ID: ' + id);
    found.sheet.deleteRow(found.rowIndex);
    return { deleted: true, catalog_id: id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Đổi tên một Workflow (áp cho MỌI US thuộc Nhóm+Workflow cũ). Tùy chọn đổi Nhóm.
 * body: { Nhom, Workflow (cũ), New_Workflow, New_Nhom? }
 * @returns {{ updated:number }}
 */
function workflowRename_(body) {
  ensureWorkflowSheets_();
  var nhom   = sanitizeStr_(body.Nhom || body.nhom, 200);
  var oldWf  = sanitizeStr_(body.Workflow || body.workflow, 300);
  var newWf  = sanitizeStr_(body.New_Workflow || body.new_workflow, 300);
  var newNhom = sanitizeStr_(body.New_Nhom || body.new_nhom || nhom, 200);
  if (!nhom || !oldWf) throw new Error('Thiếu Nhóm/Workflow cần đổi');
  if (!newWf) throw new Error('Thiếu tên Workflow mới');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getOrCreateSheet_(SHEETS.WORKFLOW);
    var data  = sheet.getDataRange().getValues();
    if (data.length < 2) return { updated: 0 };
    var headers = data[0].map(String);
    var cNhom = headers.indexOf('Nhom');
    var cWf   = headers.indexOf('Workflow');
    var cUpd  = headers.indexOf('Updated_At');
    var now   = new Date().toISOString();
    var count = 0;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cNhom]).trim() === nhom && String(data[i][cWf]).trim() === oldWf) {
        data[i][cWf]   = newWf;
        data[i][cNhom] = newNhom;
        if (cUpd !== -1) data[i][cUpd] = now;
        count++;
      }
    }
    if (count > 0) sheet.getRange(1, 1, data.length, headers.length).setValues(data);
    return { updated: count };
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────────
// SEED — chạy 1 lần trong GAS Editor
// ─────────────────────────────────────────────────────────────────

/**
 * Import 69 US từ WORKFLOW_SEED_ROWS vào WORKFLOW_CATALOG (chỉ khi sheet đang rỗng),
 * seed TEAM_GROUP_MAP, và thêm cột Workflow/Workflow_Group vào MASTER_DATA.
 * An toàn: KHÔNG ghi đè nếu catalog đã có dữ liệu (tránh xóa chỉnh sửa của admin).
 *
 * Chạy trong GAS Editor: chọn hàm seedWorkflowCatalog → Run.
 */
function seedWorkflowCatalog() {
  ensureWorkflowSheets_();

  // Self-heal cột Workflow/Workflow_Group trong MASTER_DATA
  var addedCols = ensureSheetColumns_(SHEETS.MASTER, HEADERS);

  var existing = readSheetAsObjects_(SHEETS.WORKFLOW);
  if (existing.length > 0) {
    return { seeded: 0, skipped: existing.length,
      message: 'WORKFLOW_CATALOG đã có ' + existing.length + ' dòng — bỏ qua import để không ghi đè.',
      master_columns_added: addedCols };
  }

  var sheet = getOrCreateSheet_(SHEETS.WORKFLOW);
  var now = new Date().toISOString();
  var n = 0;
  var out = [];
  (WORKFLOW_SEED_ROWS || []).forEach(function (r) {
    n++;
    out.push(['WFC-' + String(n).padStart(4, '0'), r[0], r[1], r[2], true, now]);
  });
  if (out.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, out.length, WORKFLOW_HEADERS.length).setValues(out);
  }
  return { seeded: out.length, skipped: 0,
    message: 'Đã import ' + out.length + ' Use case vào WORKFLOW_CATALOG.',
    master_columns_added: addedCols };
}
