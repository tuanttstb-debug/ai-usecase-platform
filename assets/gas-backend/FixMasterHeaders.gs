// ─────────────────────────────────────────────────────────────────
// FixMasterHeaders.gs — Khôi phục hàng TIÊU ĐỀ (row 1) của tab MASTER_DATA
// về đúng chuẩn HEADERS.  ★ BẢN ĐỘC LẬP (STANDALONE) ★
//
// Chạy được trong BẤT KỲ Apps Script project nào (kể cả script rỗng) — KHÔNG cần
// Config.gs / Utils.gs của backend AIUS. Tự mở spreadsheet theo ID, tự nhúng
// danh sách tiêu đề chuẩn, tự có helper.
//
// BỐI CẢNH (BUG-1): hàng header sống của MASTER_DATA bị lệch tên → hệ map obj→cột
// THEO TÊN → cột định danh (UseCase_ID/Record_ID) ghi ô RỖNG → create vẫn báo
// "thành công" nhưng dữ liệu như MẤT. Sửa = trả đúng TÊN cho row 1 (KHÔNG đụng data).
//
// ⚠️ AN TOÀN: chỉ được ghi đè header khi DỮ LIỆU còn đúng THỨ TỰ CỘT VẬT LÝ.
//   3 lớp chặn: (1) dry-run bắt buộc trước; (2) guard số cột = 106; (3) quét dữ
//   liệu thật xác nhận cột AIUS/UUID đúng vị trí. Backup header cũ trước khi ghi (undo được).
//
// CÁCH DÙNG (chạy TAY trong Editor):
//   0) KIỂM `_MHFIX_SS_ID` bên dưới = đúng spreadsheet MASTER_DATA (nếu đang mở
//      Editor TỪ chính spreadsheet đó qua Extensions→Apps Script thì để trống cũng được).
//   1) `dryRunFixMasterHeaders()`  → đọc verdict + diff (không ghi). Xem Executions/Logs.
//   2) verdict SAFE  → `fixMasterHeaders()` ghi (tự backup).
//      verdict BLOCK → đọc lý do, đối chiếu tab "Data H1"; chỉ `fixMasterHeaders(true)` khi CHẮC.
//   3) Lỡ tay → `restoreMasterHeaders()` (khôi phục header cũ).
// ─────────────────────────────────────────────────────────────────

// ⚙️ ID spreadsheet chứa MASTER_DATA. Để '' nếu chạy Editor bound-với-spreadsheet
//    (sẽ dùng SpreadsheetApp.getActive()). Nguồn: AI_CONTEXT (BUG-1, 2026-09-15).
var _MHFIX_SS_ID     = '1xLMQLTgj2sRf1l9C6s6AHCT5zWJLQOofL375t8Pv_NA';
var _MHFIX_SHEET     = 'MASTER_DATA';
var _MHFIX_H1_SHEET  = 'Data H1';           // tab tham chiếu (header đang ĐÚNG) — nguồn copyHeaderFromH1
var _MHFIX_SCAN_ROWS = 300;                 // số dòng data tối đa quét để dò cột định danh
var _MHFIX_LAST_KEY  = 'MHFIX_LAST_BACKUP_KEY';

// ── Tiêu đề CHUẨN — copy nguyên từ Config.gs `HEADERS` (106 cột). ─────────────
// Nếu Config.gs đổi, cập nhật lại mảng này cho khớp trước khi chạy.
var _MHFIX_HEADERS = [
  // Metadata hệ thống
  'Record_ID', 'UseCase_ID', 'Created_At', 'Updated_At', 'Submit_Date',
  // Workflow
  'Status', 'Current_Stage', 'Reviewer', 'Review_Date', 'Review_Comment',
  'Priority', 'AI_Day_Flag', 'AI_Day_Date',
  // Thông tin cơ bản (Step 1)
  'UseCase_Name', 'Owner_Name', 'Owner_Email', 'Team', 'Business_Category',
  'Co_Owner', 'Department', 'Pain_Point', 'Current_Process', 'Current_Time_Min',
  'Current_Problem', 'User_Type', 'Expected_Goals',
  // Luồng AI (Step 2)
  'Flow_Description', 'Input_Types',
  'Prompt_Role', 'Prompt_Task', 'Prompt_Goal', 'Prompt_Context', 'Prompt_Input',
  'Prompt_Steps', 'Prompt_Output_Format', 'Prompt_Evaluation',
  // Demo & ROI (Step 3)
  'Demo_Status', 'Demo_Link', 'Before_Time_Min', 'After_Time_Min',
  'Estimated_Time_Saving', 'Quality_Improvement', 'Improvement_Note',
  // Tái sử dụng (Step 3)
  'Reuse_Level', 'Reuse_Adjustment', 'Cross_Team_Flag', 'Reuse_Count',
  'Active_User_Count', 'Last_Used_Date', 'Adoption_Score', 'Standardized_Flag',
  // Hướng dẫn (Step 4)
  'When_To_Use', 'Usage_Steps', 'Usage_Notes',
  // Impact metrics
  'Estimated_Hours_Saved_Month', 'Estimated_Cost_Impact', 'Business_Value',
  'Scale_Potential', 'Risk_Level', 'Leadership_Support_Needed',
  // Dedup & versioning
  'Similarity_Score', 'Duplicate_Flag', 'Edit_Version', 'JSON_Backup',
  // GOVERNANCE v3.0 — Execution Tracking
  'UseCase_Category', 'Execution_Plan', 'Planned_Start_Date', 'Planned_End_Date',
  'Current_Progress', 'Weekly_Update', 'Next_Milestone', 'Blocker',
  'Manager_Support', 'Last_Weekly_Report',
  // GOVERNANCE v3.0 — Scoring Engine
  'Efficiency_Score', 'Adoption_Score_Calc', 'Reuse_Score', 'Frequency_Score',
  'Documentation_Score', 'Auto_Score', 'Business_Value_Score', 'Quality_Score',
  'Innovation_Score', 'Manual_Score', 'Total_Score', 'Rank_Category', 'Score_Updated_At',
  // GOVERNANCE v3.0 — Performance Tracking
  'Monthly_Usage_Count', 'Hours_Saved_Actual', 'Reuse_Count_Tracked', 'Department_Ranking',
  'Center_Ranking', 'Category_Ranking', 'Reward_Eligible', 'Warning_Flag',
  // GOVERNANCE v3.0 — Multi-Layer Review
  'Review_Status', 'Self_Assessment_Score', 'Manager_Review_Score',
  'Committee_Review_Score', 'Review_Committee_Comment',
  // H2 Giai đoạn 2 — Nhập liệu theo Workflow
  'Workflow', 'Workflow_Group',
  // CR (2026-09-12) — Action Plan theo tháng
  'Action_Plan_M09', 'Action_Plan_M10', 'Action_Plan_M11', 'Action_Plan_M12'
];

// ── Helper tự chứa ───────────────────────────────────────────────
/** Mở sheet MASTER_DATA (openById nếu có _MHFIX_SS_ID, else spreadsheet đang active). */
function _mhSheet_() {
  var ss = _MHFIX_SS_ID
    ? SpreadsheetApp.openById(_MHFIX_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Không mở được spreadsheet. Đặt _MHFIX_SS_ID = ID bảng MASTER_DATA.');
  var sh = ss.getSheetByName(_MHFIX_SHEET);
  if (!sh) throw new Error('Không tìm thấy tab "' + _MHFIX_SHEET + '" trong spreadsheet ' + ss.getId());
  return sh;
}

/** Format hàng header: bold, nền, freeze. Nuốt lỗi (không chặn nghiệp vụ). */
function _mhFormat_(sheet, nCol) {
  try {
    sheet.getRange(1, 1, 1, nCol).setFontWeight('bold').setBackground('#e8f0fe').setWrap(true);
    sheet.setFrozenRows(1);
  } catch (e) { /* bỏ qua lỗi format */ }
}

/** argmax của map {colIndex: count} → colIndex có count lớn nhất (>=1), else -1. */
function _mhArgmax_(hits) {
  var best = -1, bestN = 0;
  Object.keys(hits).forEach(function (k) {
    if (hits[k] > bestN) { bestN = hits[k]; best = parseInt(k, 10); }
  });
  return best;
}

/**
 * Quét vài trăm dòng data để định vị cột VẬT LÝ đang chứa UseCase_ID (AIUS-####)
 * và Record_ID (UUID) — xác nhận thứ tự cột chưa bị đảo trước khi ghi header.
 */
function _mhDetectIdColumns_(sheet, lastCol) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { idCol: -1, recCol: -1, sampled: 0 };

  var nScan  = Math.min(lastRow - 1, _MHFIX_SCAN_ROWS);
  var data   = sheet.getRange(2, 1, nScan, lastCol).getValues();
  var idRe   = /^AIUS-\d+$/i;
  var uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var idHits = {}, recHits = {};

  for (var r = 0; r < data.length; r++) {
    for (var c = 0; c < lastCol; c++) {
      var v = String(data[r][c]).trim();
      if (!v) continue;
      if (idRe.test(v))   idHits[c]  = (idHits[c]  || 0) + 1;
      if (uuidRe.test(v)) recHits[c] = (recHits[c] || 0) + 1;
    }
  }
  return { idCol: _mhArgmax_(idHits), recCol: _mhArgmax_(recHits), sampled: data.length };
}

/**
 * Phân tích header sống của MASTER_DATA vs bộ chuẩn `expectedOverride`
 * (mặc định = _MHFIX_HEADERS nhúng). KHÔNG ghi. Lõi dùng chung mọi lệnh.
 * @param {string[]} [expectedOverride]  Bộ header chuẩn khác (vd header của Data H1).
 */
function _mhAnalyze_(expectedOverride) {
  var sheet    = _mhSheet_();
  var lastCol  = sheet.getLastColumn();
  var expected = (expectedOverride && expectedOverride.length ? expectedOverride : _MHFIX_HEADERS).slice();
  var idIdx    = expected.indexOf('UseCase_ID');   // 1
  var recIdx   = expected.indexOf('Record_ID');    // 0

  var live = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x); })
    : [];

  var posDiff = [];
  var n = Math.min(live.length, expected.length);
  for (var i = 0; i < n; i++) {
    if (live[i] !== expected[i]) {
      posDiff.push({ col: i + 1, live: live[i], expected: expected[i],
                     whitespaceOnly: live[i].trim() === expected[i].trim() });
    }
  }

  var liveTrim = live.map(function (s) { return s.trim(); });
  var missing  = expected.filter(function (h) { return liveTrim.indexOf(h) === -1; });
  var extra    = live.filter(function (s) { return expected.indexOf(s.trim()) === -1; });

  var det = _mhDetectIdColumns_(sheet, lastCol);
  var idColLooksRight  = (det.idCol  === -1) || (det.idCol  === idIdx);
  var recColLooksRight = (det.recCol === -1) || (det.recCol === recIdx);

  var reasons = [];
  var countMatch = (live.length === expected.length);
  if (!countMatch) reasons.push('SỐ CỘT sống=' + live.length + ' ≠ chuẩn=' + expected.length + ' (chèn/xóa cột → không tự sửa được).');
  if (!idColLooksRight)  reasons.push('Dữ liệu AIUS-#### đang ở CỘT ' + (det.idCol + 1) + ' (kỳ vọng ' + (idIdx + 1) + ') → nghi ĐẢO cột.');
  if (!recColLooksRight) reasons.push('Dữ liệu UUID đang ở CỘT ' + (det.recCol + 1) + ' (kỳ vọng ' + (recIdx + 1) + ') → nghi ĐẢO cột.');

  var alreadyOk = countMatch && posDiff.length === 0;
  var verdict = alreadyOk ? 'ALREADY_OK' : (reasons.length ? 'BLOCK' : 'SAFE');

  return { verdict: verdict, live: live, expected: expected,
           liveCount: live.length, expectedCount: expected.length,
           posDiff: posDiff, missing: missing, extra: extra,
           detect: det, reasons: reasons };
}

/** In gọn phân tích ra Logger. */
function _mhLog_(a) {
  Logger.log('════ MASTER_DATA header — VERDICT: ' + a.verdict + ' ════');
  Logger.log('Số cột: sống=' + a.liveCount + ' | chuẩn=' + a.expectedCount +
             (a.liveCount === a.expectedCount ? ' (khớp)' : ' (LỆCH)'));
  Logger.log('Cột chứa AIUS-#### (dò từ data): ' + (a.detect.idCol + 1) +
             ' | UUID: ' + (a.detect.recCol + 1) + ' | mẫu quét: ' + a.detect.sampled + ' dòng');
  if (a.posDiff.length) {
    Logger.log('— Lệch tên theo vị trí (' + a.posDiff.length + '):');
    a.posDiff.slice(0, 40).forEach(function (d) {
      Logger.log('   cột ' + d.col + ': "' + d.live + '"  →  "' + d.expected + '"' +
                 (d.whitespaceOnly ? '   (chỉ khác khoảng trắng)' : ''));
    });
    if (a.posDiff.length > 40) Logger.log('   … và ' + (a.posDiff.length - 40) + ' cột nữa.');
  }
  if (a.missing.length) Logger.log('— Thiếu (có trong chuẩn, vắng ở sheet): ' + a.missing.join(', '));
  if (a.extra.length)   Logger.log('— Thừa (có ở sheet, không trong chuẩn): ' + a.extra.map(function (s) { return '"' + s + '"'; }).join(', '));
  if (a.reasons.length) { Logger.log('— LÝ DO CHẶN:'); a.reasons.forEach(function (r) { Logger.log('   • ' + r); }); }
}

/** DRY-RUN — chỉ đọc & in, KHÔNG ghi. Chạy TRƯỚC khi fix. */
function dryRunFixMasterHeaders() {
  var a = _mhAnalyze_();
  _mhLog_(a);
  switch (a.verdict) {
    case 'ALREADY_OK': Logger.log('→ Header đã chuẩn. KHÔNG cần fixMasterHeaders().'); break;
    case 'SAFE':       Logger.log('→ AN TOÀN. Chạy `fixMasterHeaders()` để ghi (tự backup).'); break;
    case 'BLOCK':      Logger.log('→ CHẶN. Đối chiếu tab "Data H1" + lý do trên. Chỉ `fixMasterHeaders(true)` khi CHẮC thứ tự cột vật lý còn đúng.'); break;
  }
  return a;
}

/**
 * Ghi đè hàng header (row 1) = chuẩn. Mặc định chỉ ghi khi verdict SAFE.
 * @param {boolean} [force=false] Bỏ qua chặn BLOCK (chỉ khi đã tự kiểm thứ tự cột).
 */
function fixMasterHeaders(force) {
  var a = _mhAnalyze_();
  _mhLog_(a);

  if (a.verdict === 'ALREADY_OK') {
    return { written: false, verdict: a.verdict, message: 'Header đã chuẩn — không ghi.' };
  }
  if (a.verdict === 'BLOCK' && !force) {
    throw new Error('CHẶN ghi header (rủi ro mất/dán-sai dữ liệu): ' + a.reasons.join(' ') +
      ' — Nếu đã đối chiếu tab "Data H1" và chắc thứ tự cột vật lý còn đúng thì chạy fixMasterHeaders(true).');
  }
  if (a.liveCount !== a.expectedCount) {
    throw new Error('KHÔNG thể ghi: số cột sống (' + a.liveCount + ') ≠ chuẩn (' + a.expectedCount +
      '). Đây là chèn/xóa cột — phải xử lý tay, không dùng script overwrite.');
  }

  var sheet = _mhSheet_();

  // BACKUP header cũ (undo được)
  var backupKey = 'MHFIX_BACKUP_' + new Date().toISOString().replace(/[:.]/g, '-');
  var props = PropertiesService.getScriptProperties();
  props.setProperty(backupKey, JSON.stringify(a.live));
  props.setProperty(_MHFIX_LAST_KEY, backupKey);
  Logger.log('Đã BACKUP header cũ → Script Property: ' + backupKey);

  // Ghi header chuẩn (chỉ row 1) + format
  sheet.getRange(1, 1, 1, _MHFIX_HEADERS.length).setValues([_MHFIX_HEADERS.slice()]);
  _mhFormat_(sheet, _MHFIX_HEADERS.length);

  var msg = 'ĐÃ ghi ' + _MHFIX_HEADERS.length + ' tiêu đề chuẩn vào MASTER_DATA' +
            (force && a.verdict === 'BLOCK' ? ' (FORCE)' : '') + '. Backup: ' + backupKey;
  Logger.log('✅ ' + msg);
  return { written: true, verdict: a.verdict, backupKey: backupKey, message: msg };
}

/** KHÔI PHỤC header MASTER_DATA từ backup (undo). Bỏ trống → backup gần nhất. */
function restoreMasterHeaders(backupKey) {
  var props = PropertiesService.getScriptProperties();
  var key   = backupKey || props.getProperty(_MHFIX_LAST_KEY);
  if (!key) throw new Error('Không có backup nào để khôi phục.');
  var raw = props.getProperty(key);
  if (!raw) throw new Error('Không tìm thấy backup với key: ' + key);

  var old = JSON.parse(raw);
  var sheet = _mhSheet_();
  sheet.getRange(1, 1, 1, old.length).setValues([old]);
  _mhFormat_(sheet, old.length);
  var msg = 'ĐÃ khôi phục ' + old.length + ' tiêu đề cũ từ backup ' + key;
  Logger.log('↩️ ' + msg);
  return { restored: true, backupKey: key, message: msg };
}

/** Liệt kê backup header đang lưu. */
function listMasterHeaderBackups() {
  var all  = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(all).filter(function (k) { return k.indexOf('MHFIX_BACKUP_') === 0; }).sort();
  Logger.log('Backups (' + keys.length + '):\n' + (keys.join('\n') || '(trống)') +
             '\nGần nhất: ' + (all[_MHFIX_LAST_KEY] || '(chưa có)'));
  return { count: keys.length, keys: keys };
}
