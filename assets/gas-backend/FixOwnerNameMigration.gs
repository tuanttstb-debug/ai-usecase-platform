// ─────────────────────────────────────────────────────────────────
// FixOwnerNameMigration.gs — Chuẩn hóa cột Owner_Name trong MASTER_DATA
//
// Vấn đề: do nhiều lần CR, cột Owner_Name bị lẫn lộn giữa:
//   - Tên đăng nhập  : "tutv3", "tuantt4"   (= Username trong USERS sheet)
//   - Tên hiển thị   : "Trần Văn Tú"        (= Display_Name trong USERS sheet)
//
// Nguồn truth: USERS sheet (Username → Display_Name).
// Script lookup Owner_Email (= username) → lấy Display_Name chuẩn → ghi lại
// vào Owner_Name nếu khác.
//
// Cách dùng:
//   1. Paste file này vào GAS Editor
//   2. Bước 1 — Chọn "dryRunFixOwnerName" → Run → xem Logs (preview thay đổi)
//   3. Bước 2 — Xác nhận log đúng → chọn "commitFixOwnerName" → Run
//   4. Xóa file sau khi hoàn thành (optional)
// ─────────────────────────────────────────────────────────────────

/** Bước 1 — Preview: chỉ log, KHÔNG ghi vào sheet */
function dryRunFixOwnerName() {
  _fixOwnerName_(true);
}

/** Bước 2 — Commit: ghi thật vào MASTER_DATA + clear cache */
function commitFixOwnerName() {
  _fixOwnerName_(false);
}

// ─────────────────────────────────────────────────────────────────

/**
 * Chuẩn hóa Owner_Name trong MASTER_DATA về Display_Name từ USERS sheet.
 *
 * Logic:
 *   - Owner_Email (cột trong MASTER_DATA) = username đăng nhập (e.g. "tutv3")
 *   - Tra USERS sheet → lấy Display_Name tương ứng
 *   - Nếu Owner_Name hiện tại ≠ Display_Name → cập nhật
 *
 * @param {boolean} dryRun - true: chỉ log. false: ghi thật.
 */
function _fixOwnerName_(dryRun) {
  if (typeof dryRun === 'undefined') dryRun = true;

  var log = [];
  log.push('=== _fixOwnerName_ [DRY_RUN=' + dryRun + '] bắt đầu ===');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ── 1. Build lookup map: normalizedUsername → Display_Name ──────
  var userMap = _buildUserDisplayMap_(ss, log);

  // ── 2. Chuẩn hóa Owner_Name trong MASTER_DATA ──────────────────
  var changed = _normalizeOwnerNameInMaster_(ss, userMap, dryRun, log);

  // ── 3. Clear cache nếu có thay đổi thật ────────────────────────
  if (!dryRun && changed > 0) {
    _clearDashboardCache_(ss, dryRun, log);
  }

  log.push('=== _fixOwnerName_ XONG — ' + changed + ' rows cập nhật ===');
  log.forEach(function(line) { Logger.log(line); });

  return log;
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Đọc USERS sheet → trả về map normalizedUsername → Display_Name.
 */
function _buildUserDisplayMap_(ss, log) {
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    log.push('[USERS] Sheet không tìm thấy — không thể build lookup map');
    return {};
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    log.push('[USERS] Sheet rỗng — không có user nào');
    return {};
  }

  var headers  = data[0].map(String);
  var uCol     = headers.indexOf('Username');
  var dCol     = headers.indexOf('Display_Name');

  if (uCol < 0 || dCol < 0) {
    log.push('[USERS] Không tìm thấy cột Username hoặc Display_Name — abort');
    return {};
  }

  var map = {};
  for (var r = 1; r < data.length; r++) {
    var username    = String(data[r][uCol] || '').trim().toLowerCase();
    var displayName = String(data[r][dCol] || '').trim();
    if (username) {
      map[username] = displayName || _buildDisplayNameFallback_(username);
    }
  }

  log.push('[USERS] Loaded ' + Object.keys(map).length + ' users vào lookup map');
  return map;
}

/**
 * Quét MASTER_DATA, so sánh Owner_Name với Display_Name từ map, cập nhật nếu khác.
 * Batch read/write để tiết kiệm quota.
 */
function _normalizeOwnerNameInMaster_(ss, userMap, dryRun, log) {
  var sheet = ss.getSheetByName(SHEETS.MASTER);
  if (!sheet) {
    log.push('[MASTER_DATA] Sheet không tìm thấy — bỏ qua');
    return 0;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log.push('[MASTER_DATA] Không có dữ liệu — bỏ qua');
    return 0;
  }

  // Tìm vị trí cột Owner_Name và Owner_Email từ header row
  var headers      = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var ownerNameCol = headers.indexOf('Owner_Name');   // 0-indexed
  var ownerEmailCol= headers.indexOf('Owner_Email');  // 0-indexed (= username login)

  if (ownerNameCol < 0 || ownerEmailCol < 0) {
    log.push('[MASTER_DATA] Không tìm thấy cột Owner_Name / Owner_Email — abort');
    return 0;
  }

  // Đọc 2 cột cần thiết — 1 API call
  var dataRows    = lastRow - 1;
  var leftCol     = Math.min(ownerNameCol, ownerEmailCol) + 1;        // 1-indexed
  var rightCol    = Math.max(ownerNameCol, ownerEmailCol) + 1;        // 1-indexed
  var colCount    = rightCol - leftCol + 1;
  var fullRange   = sheet.getRange(2, leftCol, dataRows, colCount);
  var allValues   = fullRange.getValues();

  // Offset trong allValues
  var nameOff  = ownerNameCol  - (leftCol - 1);
  var emailOff = ownerEmailCol - (leftCol - 1);

  var changed       = 0;
  var noUser        = [];
  var noEmail       = [];
  var previewLines  = [];
  var MAX_PREVIEW   = 30;

  for (var r = 0; r < allValues.length; r++) {
    var currentName = String(allValues[r][nameOff]  || '').trim();
    var ownerEmail  = String(allValues[r][emailOff] || '').trim().toLowerCase();

    if (!ownerEmail) {
      noEmail.push('  row ' + (r + 2) + ': Owner_Email trống — bỏ qua');
      continue;
    }

    var canonicalName = userMap[ownerEmail];
    if (!canonicalName) {
      noUser.push('  row ' + (r + 2) + ': username="' + ownerEmail + '" không có trong USERS sheet');
      continue;
    }

    if (currentName === canonicalName) continue; // đã đúng, bỏ qua

    // Cần cập nhật
    if (previewLines.length < MAX_PREVIEW) {
      previewLines.push('  row ' + (r + 2) + ': "' + currentName + '" → "' + canonicalName + '"  (login: ' + ownerEmail + ')');
    } else if (previewLines.length === MAX_PREVIEW) {
      previewLines.push('  ... (còn nhiều hơn, xem log commitFixOwnerName để thấy hết)');
    }

    allValues[r][nameOff] = canonicalName;
    changed++;
  }

  // Log warnings
  if (noEmail.length > 0) {
    log.push('[MASTER_DATA] ⚠ ' + noEmail.length + ' row Owner_Email trống:');
    noEmail.slice(0, 10).forEach(function(l) { log.push(l); });
    if (noEmail.length > 10) log.push('  ... và ' + (noEmail.length - 10) + ' row nữa');
  }

  if (noUser.length > 0) {
    log.push('[MASTER_DATA] ⚠ ' + noUser.length + ' row username chưa có trong USERS sheet:');
    noUser.slice(0, 10).forEach(function(l) { log.push(l); });
    if (noUser.length > 10) log.push('  ... và ' + (noUser.length - 10) + ' row nữa');
  }

  if (changed === 0) {
    log.push('[MASTER_DATA] Tất cả Owner_Name đã đúng — không có gì thay đổi');
    return 0;
  }

  log.push('[MASTER_DATA] ' + changed + ' rows cần cập nhật Owner_Name:');
  previewLines.forEach(function(l) { log.push(l); });

  if (!dryRun) {
    fullRange.setValues(allValues);
    log.push('[MASTER_DATA] ✅ Đã ghi ' + changed + ' rows');
  } else {
    log.push('[MASTER_DATA] (dry-run) Chưa ghi — chạy commitFixOwnerName để áp dụng');
  }

  return changed;
}

/**
 * Fallback: sinh Display_Name từ username khi USERS sheet không có Display_Name.
 * "tutv3" → "Tutv3"  |  "tuan.tt" → "Tuan Tt"
 */
function _buildDisplayNameFallback_(username) {
  return String(username || '')
    .split(/[._\-]/)
    .map(function(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; })
    .join(' ')
    .trim() || String(username);
}
