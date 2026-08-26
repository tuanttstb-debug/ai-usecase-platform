// ─────────────────────────────────────────────────────────────────
// Utils.gs — Các hàm tiện ích dùng chung toàn project
// ─────────────────────────────────────────────────────────────────

// ── Response Helpers ──────────────────────────────────────────────

/**
 * Tạo object response chuẩn.
 * @param {boolean} success
 * @param {string}  message
 * @param {*}       data
 * @param {string}  [errorDetail] - Stack trace hoặc thông tin debug (chỉ dùng nội bộ)
 */
function createResponse_(success, message, data, errorDetail) {
  var response = {
    success: success,
    message: message || '',
    data:    data    || null
  };
  // Chỉ expose error detail khi không thành công (để debug)
  if (!success && errorDetail) {
    response.error = String(errorDetail);
  }
  return response;
}

/**
 * Serialize response thành JSON.
 * Lưu ý: GAS ContentService không hỗ trợ custom headers (addHeader không tồn tại).
 * CORS được xử lý bởi Google infrastructure — không cần set thủ công.
 * Dùng cho direct browser access / doPost fallback (không qua JSONP).
 */
function sendJson_(response) {
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Serialize response dạng JSONP: callback({...})
 * Dùng cho GET request — frontend inject <script> tag để bypass CORS redirect.
 * @param {Object} response  - createResponse_() output
 * @param {string} callback  - Tên hàm callback (đã validate là safe identifier)
 */
function sendJsonP_(response, callback) {
  var json = JSON.stringify(response);
  var body = callback + '(' + json + ');';
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ── Spreadsheet Helpers ───────────────────────────────────────────

/**
 * Mở spreadsheet (không cache — GAS tự cache nội bộ).
 */
function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Lấy sheet theo tên, tạo mới nếu chưa tồn tại và tự động tạo headers.
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
/**
 * Normalize username: trim + lowercase → so sánh case-insensitive.
 * "Tuantt4" → "tuantt4". (Chuyển từ UserService.gs cũ — nguồn user duy nhất nay là User_Master.)
 */
function normalizeUser_(str) {
  return String(str || '').trim().toLowerCase();
}

function getOrCreateSheet_(sheetName) {
  // GUARD (fix "sinh nhiều Sheet rỗng"): tên rỗng/undefined → insertSheet() đặt tên mặc định
  // 'SheetN' và getSheetByName(undefined) không bao giờ khớp → MỖI lần gọi lại tạo 1 sheet mới.
  // Nguyên nhân thường gặp: deploy LỆCH phiên bản (code tham chiếu SHEETS.X mà Config.gs cũ
  // chưa có key → SHEETS.X = undefined). Ném lỗi rõ thay vì đẻ sheet rác.
  if (typeof sheetName !== 'string' || sheetName.trim() === '') {
    throw new Error('getOrCreateSheet_: sheetName rỗng/không hợp lệ (' + JSON.stringify(sheetName) +
      '). Có thể do SHEETS.* undefined vì deploy thiếu Config.gs — KHÔNG tạo sheet mặc định.');
  }
  var ss    = getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);

  switch (sheetName) {
    case SHEETS.MASTER:
      sheet.appendRow(HEADERS);
      formatHeaderRow_(sheet);
      break;
    case SHEETS.LOOKUP:
      sheet.appendRow(['Field', 'Value', 'Sort_Order', 'Active']);
      formatHeaderRow_(sheet);
      break;
    case SHEETS.ACTIVITY:
      sheet.appendRow(ACTIVITY_HEADERS);
      formatHeaderRow_(sheet);
      break;
    case SHEETS.DASHBOARD:
      sheet.appendRow(DASHBOARD_HEADERS);
      formatHeaderRow_(sheet);
      break;
    case SHEETS.CONFIG:
      sheet.appendRow(['Key', 'Value', 'Description']);
      sheet.appendRow(['NEXT_ID', String(CONFIG_DEFAULTS.NEXT_ID), 'Auto-increment ID counter']);
      formatHeaderRow_(sheet);
      break;
    case SHEETS.WEEKLY_LOG:
      sheet.appendRow(WEEKLY_LOG_HEADERS);
      formatHeaderRow_(sheet);
      break;
  }

  return sheet;
}

/**
 * DỌN SHEET RÁC — xóa các sheet tên mặc định 'SheetN' đang RỖNG (do bug insertSheet name rỗng).
 * An toàn: CHỈ xóa sheet (a) tên khớp /^Sheet\d+$/, (b) không trùng bất kỳ tên nghiệp vụ trong SHEETS,
 * (c) thực sự rỗng (0 dòng dữ liệu). Giữ tối thiểu 1 sheet (Sheets không cho xóa sheet cuối cùng).
 * Chạy TAY trong GAS Editor: `cleanupEmptyDefaultSheets` (xóa) hoặc `dryRunCleanupEmptySheets` (chỉ liệt kê).
 * @param {boolean} commit  true = xóa; false = chỉ liệt kê.
 * @returns {{ candidates:string[], deleted:string[], kept:string[], message:string }}
 */
function _cleanupEmptyDefaultSheets_(commit) {
  var ss = getSpreadsheet_();
  var known = {};
  Object.keys(SHEETS).forEach(function (k) { known[String(SHEETS[k])] = true; });
  var sheets = ss.getSheets();
  var candidates = [], deleted = [], kept = [];

  // Tên mặc định Google theo LOCALE: EN 'Sheet', VI 'Trang tính' + vài locale phổ biến.
  // (Bug tạo sheet rỗng đặt tên mặc định theo ngôn ngữ của bảng tính — vd tiếng Việt 'Trang tính65'.)
  var DEFAULT_NAME_RE = /^(Sheet|Trang tính|Trang tinh|Hoja|Feuille|Blatt|Foglio de cálculo|Foglio|Sayfa|Список|Лист|시트|シート|工作表)\s*\d+$/;
  sheets.forEach(function (sh) {
    var name = sh.getName();
    var isDefault = DEFAULT_NAME_RE.test(name);         // tên mặc định Google (đa ngôn ngữ)
    var isKnown   = !!known[name];                      // sheet nghiệp vụ → KHÔNG đụng
    var isEmpty   = sh.getLastRow() === 0 && sh.getLastColumn() === 0;
    if (isDefault && !isKnown && isEmpty) candidates.push(name);
  });

  if (commit) {
    candidates.forEach(function (name) {
      if (ss.getSheets().length <= 1) { kept.push(name); return; } // không xóa sheet cuối cùng
      try { ss.deleteSheet(ss.getSheetByName(name)); deleted.push(name); }
      catch (e) { kept.push(name + ' (lỗi: ' + e.message + ')'); }
    });
  }

  var msg = 'Sheet rỗng tên mặc định: ' + candidates.length + ' ứng viên'
    + (commit ? (' → đã xóa ' + deleted.length + (kept.length ? ', giữ ' + kept.length : '')) : ' (dry-run, chưa xóa)');
  Logger.log(msg + '\n  candidates: ' + candidates.join(', '));
  return { candidates: candidates, deleted: deleted, kept: kept, message: msg };
}
/** Liệt kê (không xóa) sheet rỗng tên mặc định — chạy tay trong GAS Editor. */
function dryRunCleanupEmptySheets() { return _cleanupEmptyDefaultSheets_(false); }
/** XÓA sheet rỗng tên mặc định 'SheetN' — chạy tay trong GAS Editor sau khi đã redeploy đủ. */
function cleanupEmptyDefaultSheets() { return _cleanupEmptyDefaultSheets_(true); }

/**
 * Đảm bảo sheet có đủ các cột trong `wantHeaders`.
 * Thêm cột còn thiếu vào CUỐI hàng header (không đụng data cũ, không đổi thứ tự cột cũ).
 * Idempotent — chỉ ghi khi thực sự thiếu cột. Dùng để migrate schema tại chỗ.
 *
 * @param {string}   sheetName
 * @param {string[]} wantHeaders  Danh sách header mong muốn (vd WEEKLY_LOG_HEADERS)
 * @returns {string[]} Các cột vừa được thêm (rỗng nếu đã đủ)
 */
function ensureSheetColumns_(sheetName, wantHeaders) {
  var sheet   = getOrCreateSheet_(sheetName);
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(wantHeaders);
    formatHeaderRow_(sheet);
    return wantHeaders.slice();
  }
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var missing  = wantHeaders.filter(function(h) { return existing.indexOf(h) === -1; });
  if (missing.length === 0) return [];

  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  formatHeaderRow_(sheet);
  return missing;
}

/**
 * Format hàng header: bold, freeze, background.
 */
function formatHeaderRow_(sheet) {
  try {
    var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    headerRange.setFontWeight('bold')
               .setBackground('#e8f0fe')
               .setWrap(true);
    sheet.setFrozenRows(1);
  } catch (e) { /* bỏ qua lỗi format */ }
}

/**
 * Đọc toàn bộ sheet và trả về mảng object (key = header, value = cell value).
 * Bỏ qua các hàng rỗng hoàn toàn.
 * @param {string} sheetName
 * @returns {Object[]}
 */
function readSheetAsObjects_(sheetName) {
  var sheet = getOrCreateSheet_(sheetName);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(String);

  return data.slice(1)
    .filter(function(row) {
      // Bỏ qua hàng hoàn toàn rỗng
      return row.some(function(cell) {
        return cell !== '' && cell !== null && cell !== undefined;
      });
    })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = (row[i] !== undefined && row[i] !== null) ? row[i] : '';
      });
      return obj;
    });
}

/**
 * Thêm hàng mới vào sheet dựa theo object (key = header).
 * Thứ tự cột theo headers của sheet, không theo thứ tự object.
 * OPT: Chỉ đọc hàng header (1×lastCol) thay vì toàn bộ data (N×lastCol).
 */
function appendRowFromObject_(sheetName, obj) {
  var sheet   = getOrCreateSheet_(sheetName);
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) throw new Error('Sheet ' + sheetName + ' không có headers');

  // Đọc CHỈ hàng 1 (headers) — tránh đọc N hàng data thừa chỉ để lấy headers
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var row = headers.map(function(h) {
    var val = (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '';
    // toSheetValue_: prefix formula-starting strings với ' để tránh Sheets interpret làm formula
    return toSheetValue_(val);
  });
  sheet.appendRow(row);
}

/**
 * Cập nhật hàng trong sheet MASTER dựa theo Record_ID.
 * Ghi toàn bộ hàng (không partial update) để tránh cell drift.
 */
function updateRowByRecordId_(sheetName, recordId, obj) {
  var sheet = getOrCreateSheet_(sheetName);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('Sheet ' + sheetName + ' không có dữ liệu');

  var headers   = data[0].map(String);
  var recordCol = headers.indexOf('Record_ID');
  if (recordCol === -1) throw new Error('Cột Record_ID không tìm thấy trong sheet ' + sheetName);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][recordCol]) === String(recordId)) {
      var row = headers.map(function(h, j) {
        var val = (obj[h] !== undefined && obj[h] !== null) ? obj[h] : data[i][j];
        // toSheetValue_: prefix formula-starting strings với ' để tránh Sheets interpret làm formula
        return toSheetValue_(val);
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return true;
    }
  }
  throw new Error('Không tìm thấy Record_ID: ' + recordId);
}

/**
 * Cập nhật hàng đầu tiên khớp `field = value` trong sheet bất kỳ.
 * Ghi toàn bộ hàng (merge obj lên giá trị cũ). Dùng cho WEEKLY_LOG (khóa = Log_ID).
 * @returns {boolean} true nếu tìm thấy & cập nhật
 */
function updateRowByField_(sheetName, field, value, obj) {
  var sheet = getOrCreateSheet_(sheetName);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return false;

  var headers = data[0].map(String);
  var keyCol  = headers.indexOf(field);
  if (keyCol === -1) throw new Error('Cột ' + field + ' không tìm thấy trong sheet ' + sheetName);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyCol]) === String(value)) {
      var row = headers.map(function(h, j) {
        var val = (obj[h] !== undefined && obj[h] !== null) ? obj[h] : data[i][j];
        return toSheetValue_(val);
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return true;
    }
  }
  return false;
}

/**
 * Tìm object đầu tiên trong sheet theo field = value.
 * @returns {Object|null}
 */
function findObjectByField_(sheetName, field, value) {
  var objects = readSheetAsObjects_(sheetName);
  for (var i = 0; i < objects.length; i++) {
    if (String(objects[i][field]) === String(value)) return objects[i];
  }
  return null;
}

/**
 * Tìm hàng trong sheet theo field = value — single sheet read.
 * Trả về đủ thông tin để write sau đó mà KHÔNG cần đọc lại sheet.
 *
 * Dùng thay cho findObjectByField_ + updateRowByRecordId_ khi cần read+write
 * trong một operation (tránh double read → giảm ~30-50% execution time).
 *
 * @param {string} sheetName
 * @param {string} field  - Tên cột để tìm (vd: 'Record_ID')
 * @param {string} value  - Giá trị cần khớp
 * @returns {{ obj: Object, rowIndex: number, headers: string[], sheet: Sheet } | null}
 */
function findRowByField_(sheetName, field, value) {
  var sheet   = getOrCreateSheet_(sheetName);
  var data    = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var headers  = data[0].map(String);
  var fieldCol = headers.indexOf(field);
  if (fieldCol === -1) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][fieldCol]) === String(value)) {
      var obj = {};
      headers.forEach(function(h, j) {
        obj[h] = (data[i][j] !== undefined && data[i][j] !== null) ? data[i][j] : '';
      });
      return { obj: obj, rowIndex: i + 1, headers: headers, sheet: sheet };
    }
  }
  return null;
}

/**
 * (Tuning T3) Như findRowByField_ nhưng đọc CHỈ cột khóa (N×1) để định vị dòng,
 * rồi đọc DUY NHẤT dòng khớp (1×lastCol) — thay vì đọc toàn sheet (N×lastCol).
 * Trên MASTER 99 cột × nhiều dòng, giảm mạnh thời gian đọc cho update + verify-sau-ghi.
 * Trả cùng shape { obj, rowIndex, headers, sheet } để tương thích findRowByField_.
 *
 * @param {string} sheetName
 * @param {string} field   Tên cột khóa (vd 'Record_ID' / 'UseCase_ID')
 * @param {string} value   Giá trị cần khớp
 * @returns {{ obj:Object, rowIndex:number, headers:string[], sheet:Sheet } | null}
 */
function findRowByKeyColumn_(sheetName, field, value) {
  var sheet   = getOrCreateSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return null;

  var headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var fieldCol = headers.indexOf(field);
  if (fieldCol === -1) return null;

  // Đọc CHỈ cột khóa để tìm dòng
  var keyVals = sheet.getRange(2, fieldCol + 1, lastRow - 1, 1).getValues();
  var target  = String(value);
  for (var i = 0; i < keyVals.length; i++) {
    if (String(keyVals[i][0]) === target) {
      var rowIndex = i + 2;                                    // 0-based array → 1-based sheet row
      var rowVals  = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];  // đọc 1 dòng
      var obj = {};
      headers.forEach(function(h, j) {
        obj[h] = (rowVals[j] !== undefined && rowVals[j] !== null) ? rowVals[j] : '';
      });
      return { obj: obj, rowIndex: rowIndex, headers: headers, sheet: sheet };
    }
  }
  return null;
}

// ── String & Math Utilities ───────────────────────────────────────

/**
 * Normalize chuỗi để so sánh similarity:
 * lowercase, giữ ký tự Latin + tiếng Việt + số, bỏ ký tự đặc biệt.
 */
function normalizeStr_(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dice Coefficient similarity sử dụng multiset bigrams (FIX: dùng Map thay Set).
 * Set-based implementation cũ mất các bigram trùng lặp → kết quả sai với text ngắn.
 * @param {string} str1
 * @param {string} str2
 * @returns {number} 0.0 – 1.0
 */
function diceSimilarity_(str1, str2) {
  str1 = normalizeStr_(str1);
  str2 = normalizeStr_(str2);
  if (!str1 || !str2)         return 0;
  if (str1 === str2)           return 1;
  if (str1.length < 2 || str2.length < 2) return 0;

  // Đếm bigrams với Map để giữ số lần xuất hiện
  function makeBigrams(s) {
    var map = {};
    for (var i = 0; i < s.length - 1; i++) {
      var bg = s.substring(i, i + 2);
      map[bg] = (map[bg] || 0) + 1;
    }
    return map;
  }

  var a = makeBigrams(str1);
  var b = makeBigrams(str2);

  var intersection = 0;
  Object.keys(a).forEach(function(bg) {
    if (b[bg]) intersection += Math.min(a[bg], b[bg]);
  });

  var totalA = Object.values(a).reduce(function(s, v) { return s + v; }, 0);
  var totalB = Object.values(b).reduce(function(s, v) { return s + v; }, 0);

  return (2 * intersection) / (totalA + totalB);
}

/**
 * Parse float an toàn — trả về 0 thay vì NaN.
 */
function safeNum_(val) {
  var n = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
}

/**
 * Tính % tiết kiệm thời gian từ Before/After time.
 * @returns {string} e.g. "50 phút (83.3%)" hoặc ''
 */
function computeTimeSaving_(beforeMin, afterMin) {
  var b = safeNum_(beforeMin);
  var a = safeNum_(afterMin);
  if (b <= 0) return '';
  var saving = b - a;
  if (saving <= 0) return '0 phút (0%)';
  var pct = ((saving / b) * 100).toFixed(1);
  return saving + ' phút (' + pct + '%)';
}

/**
 * Ước tính giờ tiết kiệm mỗi tháng (giả sử task chạy 1 lần/ngày làm việc).
 * @returns {number} số giờ/tháng, làm tròn 2 chữ số thập phân
 */
function computeHoursSavedMonth_(beforeMin, afterMin) {
  var b = safeNum_(beforeMin);
  var a = safeNum_(afterMin);
  if (b <= 0) return 0;
  var savingMin = Math.max(0, b - a);
  return Math.round((savingMin / 60) * WORKING_DAYS_PER_MONTH * 100) / 100;
}

/**
 * Sanitize string đầu vào: trim, giới hạn độ dài, strip ký tự không an toàn.
 * - Strip null bytes (\0): Google Sheets setValues() có thể fail nếu có \0
 * - Strip lone surrogates: chuỗi UTF-16 không hợp lệ có thể gây lỗi JSON
 * - Strip \r: normalize về \n để tránh hiển thị không nhất quán trong Sheets
 */
function sanitizeStr_(val, maxLen) {
  if (val === null || val === undefined) return '';
  var s = String(val).trim();
  // Strip null bytes (Google Sheets không chấp nhận \0 trong cell values)
  s = s.replace(/\0/g, '');
  // Strip lone surrogates (UTF-16 không hợp lệ, gây lỗi JSON.stringify/parse).
  // Regex giữ surrogate pair hợp lệ (emoji, ký tự BMP mở rộng), chỉ strip lone surrogate.
  s = s.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, function(m, pair) {
    return pair || '';
  });
  // Normalize \r\n và lone \r → \n (Windows CRLF → Unix LF)
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

/**
 * Escape giá trị trước khi ghi vào Google Sheets cell để tránh formula injection.
 * GAS appendRow()/setValues() interpret strings bắt đầu bằng =, +, -, @ như formulas.
 * Google Sheets hiểu prefix ' là "force text mode" — khi đọc lại getValue() không có '.
 *
 * Chỉ dùng hàm này khi BUILD ROW ARRAY để ghi sheet, KHÔNG dùng trong JSON_Backup
 * (vì JSON_Backup cần lưu giá trị gốc, không phải giá trị với prefix ').
 *
 * @param {*} val - Giá trị cell
 * @returns {*} Giá trị an toàn để ghi vào Sheets
 */
function toSheetValue_(val) {
  if (typeof val !== 'string') return val;
  if (/^[=+\-@|]/.test(val)) return "'" + val;
  return val;
}

/**
 * Kiểm tra URL hợp lệ (bắt đầu bằng http:// hoặc https://).
 */
function isValidUrl_(url) {
  if (!url) return true; // optional field
  return /^https?:\/\/.+\..+/.test(String(url).trim());
}
