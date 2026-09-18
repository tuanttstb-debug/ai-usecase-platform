// ─────────────────────────────────────────────────────────────────
// WorkflowSeedTeamSoAdd.gs — Bổ sung US generic cho các WF sẵn có của Team Số
// (nhóm "4. Workflow đặc thù Số hóa tín dụng"). Không tạo WF mới.
//
// ★ BẢN ĐỘC LẬP (STANDALONE) ★ — chạy được trong BẤT KỲ Apps Script project nào
// (kể cả script rỗng "Chưa có tên"). KHÔNG cần Config.gs / helper backend AIUS.
// Tự mở spreadsheet theo ID, tự nhúng tên sheet + headers, tự có helper.
//
// CÁCH DÙNG (chạy TAY trong Editor):
//   1) dryRunSeedTeamSoAddUS()  → xem verdict + số US sẽ thêm / bỏ qua (KHÔNG ghi).
//                                  Đọc Executions/Logs; kiểm cảnh báo WF lệch tên.
//   2) seedTeamSoAddUS()        → ghi thật (idempotent, chỉ append).
//
// Idempotent: dedup theo Nhom||Workflow||UseCase (bất biến khoảng trắng) → chạy lại an toàn.
// KHÔNG cần redeploy Web App (chỉ ghi sheet WORKFLOW_CATALOG).
//
// BỐI CẢNH: review WF/US Team Số (2026-09-18). Giữ 7 WF, viết US generic (không neo
// sản phẩm) để team khác cùng loại tái dùng + đủ rõ để đóng gói Agent. 4 US lấp lỗ hổng:
//   requirement→User Story · RTM truy vết kiểm thử · sổ rủi ro–issue · approval-readiness.
// ─────────────────────────────────────────────────────────────────

// ⚙️ ID spreadsheet chứa WORKFLOW_CATALOG. Để '' nếu Editor bound-với-spreadsheet.
var _TSA_SS_ID        = '1xLMQLTgj2sRf1l9C6s6AHCT5zWJLQOofL375t8Pv_NA';
var _TSA_SHEET        = 'WORKFLOW_CATALOG';
var _TSA_HEADERS      = ['Catalog_ID', 'Nhom', 'Workflow', 'UseCase', 'Active', 'Updated_At'];
var TEAM_SO_ADD_GROUP = '4. Workflow đặc thù Số hóa tín dụng';

// [Workflow (PHẢI khớp CHÍNH XÁC tên WF đang sống trong nhóm), UseCase]
var TEAM_SO_ADD_ROWS = [
  ['Phát triển dự án số: BRD–US–Mockup–UAT',
   'AI cấu trúc hóa yêu cầu từ biên bản/email/tài liệu thành User Story và acceptance criteria có ưu tiên'],
  ['Kiểm thử & đảm bảo chất lượng sản phẩm số',
   'AI dựng ma trận truy vết Yêu cầu ↔ Test case (RTM) và phát hiện yêu cầu chưa được kiểm thử'],
  ['Quản lý dự án số & tích hợp hệ thống (CORE/LOS/BPM)',
   'AI dựng và bảo trì sổ rủi ro–issue dự án kèm đề xuất hành động giảm thiểu'],
  ['Báo cáo tiền khả thi & đề xuất triển khai',
   'AI đối chiếu tài liệu trình duyệt với checklist tiêu chí phê duyệt và chỉ ra mục còn thiếu']
];

// ── Helper tự chứa ───────────────────────────────────────────────
/** Mở sheet WORKFLOW_CATALOG (openById nếu có _TSA_SS_ID, else spreadsheet đang active). */
function _tsaSheet_() {
  var ss = _TSA_SS_ID ? SpreadsheetApp.openById(_TSA_SS_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Không mở được spreadsheet. Đặt _TSA_SS_ID = ID bảng WORKFLOW_CATALOG.');
  var sh = ss.getSheetByName(_TSA_SHEET);
  if (!sh) throw new Error('Không tìm thấy tab "' + _TSA_SHEET + '" trong spreadsheet ' + ss.getId());
  return sh;
}

/** Chuẩn hóa khoảng trắng (trim + gộp \s+ → 1 space). */
function _tsaNorm_(s) { return String(s).trim().replace(/\s+/g, ' '); }

/** Khóa dedup bất biến khoảng trắng. */
function _tsaKey_(nhom, wf, uc) { return _tsaNorm_(nhom) + '||' + _tsaNorm_(wf) + '||' + _tsaNorm_(uc); }

/** Đọc toàn bộ rows + map cột theo TÊN header (không phụ thuộc thứ tự cột). */
function _tsaRead_() {
  var sheet = _tsaSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length < 1) return { sheet: sheet, rows: [], col: {}, maxN: 0 };

  var header = data[0].map(String);
  var col = {};
  ['Catalog_ID', 'Nhom', 'Workflow', 'UseCase'].forEach(function (name) {
    col[name] = header.indexOf(name);
  });
  if (col.Nhom === -1 || col.Workflow === -1 || col.UseCase === -1) {
    throw new Error('Sheet "' + _TSA_SHEET + '" thiếu cột Nhom/Workflow/UseCase. Header sống: ' + header.join(' | '));
  }

  var rows = [], maxN = 0;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    rows.push({ nhom: r[col.Nhom], wf: r[col.Workflow], uc: r[col.UseCase] });
    if (col.Catalog_ID !== -1) {
      var mm = /^WFC-(\d+)$/.exec(String(r[col.Catalog_ID] || '').trim());
      if (mm) { var n = parseInt(mm[1], 10); if (n > maxN) maxN = n; }
    }
  }
  return { sheet: sheet, rows: rows, col: col, maxN: maxN };
}

/** Phân tích (KHÔNG ghi): thêm / bỏ qua + cảnh báo WF đích chưa tồn tại trong nhóm. */
function _tsaAnalyze_() {
  var db = _tsaRead_();

  var have = {}, wfInGroup = {};
  db.rows.forEach(function (r) {
    have[_tsaKey_(r.nhom, r.wf, r.uc)] = true;
    if (_tsaNorm_(r.nhom) === _tsaNorm_(TEAM_SO_ADD_GROUP)) wfInGroup[_tsaNorm_(r.wf)] = true;
  });

  var toAdd = [], skipped = [], missingWf = [];
  TEAM_SO_ADD_ROWS.forEach(function (pair) {
    var wf = pair[0], uc = pair[1];
    if (!wfInGroup[_tsaNorm_(wf)] && missingWf.indexOf(wf) === -1) missingWf.push(wf);
    if (have[_tsaKey_(TEAM_SO_ADD_GROUP, wf, uc)]) skipped.push(uc);
    else toAdd.push({ wf: wf, uc: uc });
  });

  return { db: db, toAdd: toAdd, skipped: skipped, missingWf: missingWf };
}

/** In gọn phân tích ra Logger. */
function _tsaLog_(a) {
  Logger.log('════ Bổ sung US Team Số — nhóm "' + TEAM_SO_ADD_GROUP + '" ════');
  Logger.log('Sẽ THÊM: ' + a.toAdd.length + ' | BỎ QUA (đã có): ' + a.skipped.length);
  a.toAdd.forEach(function (x) { Logger.log('   + [' + x.wf + '] ' + x.uc); });
  a.skipped.forEach(function (u) { Logger.log('   = (đã có) ' + u); });
  if (a.missingWf.length) {
    Logger.log('⚠️ CẢNH BÁO: WF đích sau KHÔNG thấy trong nhóm (nghi gõ lệch tên → sẽ tạo WF mới):');
    a.missingWf.forEach(function (w) { Logger.log('   • "' + w + '"'); });
    Logger.log('   → Đối chiếu tên WF (action=workflow-list) trước khi seed.');
  }
}

/** DRY-RUN — chỉ đọc & in. Chạy TRƯỚC seed. */
function dryRunSeedTeamSoAddUS() {
  var a = _tsaAnalyze_();
  _tsaLog_(a);
  Logger.log(a.toAdd.length
    ? '→ Chạy seedTeamSoAddUS() để ghi ' + a.toAdd.length + ' US.'
    : '→ Không có gì để thêm (đã đủ).');
  return { willAdd: a.toAdd.length, willSkip: a.skipped.length, missingWf: a.missingWf };
}

/** Ghi US bổ sung (idempotent, chỉ append). Catalog_ID = WFC-#### nối tiếp max hiện có. */
function seedTeamSoAddUS() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var a = _tsaAnalyze_();
    _tsaLog_(a);
    if (!a.toAdd.length) return { added: 0, skipped: a.skipped.length, message: 'Không có US mới — đã đủ.' };

    var sheet = a.db.sheet;
    var maxN  = a.db.maxN;
    var now   = new Date().toISOString();
    var appendRows = a.toAdd.map(function (x) {
      maxN++;
      // Thứ tự cột chuẩn _TSA_HEADERS: Catalog_ID, Nhom, Workflow, UseCase, Active, Updated_At
      return ['WFC-' + String(maxN).padStart(4, '0'), TEAM_SO_ADD_GROUP, x.wf, x.uc, true, now];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, _TSA_HEADERS.length).setValues(appendRows);

    var msg = 'Đã thêm ' + appendRows.length + ' US vào nhóm "' + TEAM_SO_ADD_GROUP +
              '", bỏ qua ' + a.skipped.length + '.' +
              (a.missingWf.length ? ' ⚠️ ' + a.missingWf.length + ' WF đích lệch tên (xem log).' : '');
    Logger.log('✅ ' + msg);
    return { added: appendRows.length, skipped: a.skipped.length, missingWf: a.missingWf, message: msg };
  } finally {
    lock.releaseLock();
  }
}
