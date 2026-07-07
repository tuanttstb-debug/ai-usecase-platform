// ─────────────────────────────────────────────────────────────────
// MigrationService.gs — One-time data migrations
// ─────────────────────────────────────────────────────────────────
// Cách dùng:
//   1. Paste file này vào GAS Editor
//   2. Chọn hàm "dryRunTeamBL" trong dropdown → Run → xem Logs (preview)
//   3. Xác nhận log đúng → chọn hàm "commitTeamBL" → Run để commit
//   4. Xóa file khỏi GAS Editor sau khi hoàn thành (optional, harmless)
//
// LƯU Ý: Hàm tên có dấu _ ở cuối (vd: migrateTeamsBL_) là private,
//         không hiển thị trong menu Run của GAS. Dùng 2 hàm dưới đây.
// ─────────────────────────────────────────────────────────────────

// ── Entry points (hiển thị trong GAS Run menu) ───────────────────

/** Bước 1 — Preview: chỉ log, KHÔNG ghi vào sheet */
function dryRunTeamBL() {
  migrateTeamsBL_(true);
}

/** Bước 2 — Commit: ghi thật vào LOOKUP + MASTER_DATA + USERS + clear cache */
function commitTeamBL() {
  migrateTeamsBL_(false);
}

// ─────────────────────────────────────────────────────────────────

/**
 * Gộp Team BL1 + BL2 → Team BL trong LOOKUP, MASTER_DATA, USERS sheet.
 *
 * @param {boolean} dryRun - true: chỉ log, không ghi. false: commit.
 * @returns {string[]} log - Danh sách các thay đổi đã thực hiện.
 */
function migrateTeamsBL_(dryRun) {
  if (typeof dryRun === 'undefined') dryRun = true; // mặc định safe

  var OLD_TEAMS = ['BL1', 'BL2'];
  var NEW_TEAM  = 'BL';
  var log       = [];

  log.push('=== migrateTeamsBL_ [DRY_RUN=' + dryRun + '] bắt đầu ===');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ── 1. LOOKUP sheet ─────────────────────────────────────────────
  // Cấu trúc: col 0 = Field | col 1 = Value | col 2 = Sort_Order | col 3 = Active
  _migrateLookupTeams_(ss, OLD_TEAMS, NEW_TEAM, dryRun, log);

  // ── 2. MASTER_DATA sheet ────────────────────────────────────────
  _migrateSheetTeamColumn_(ss, SHEETS.MASTER, OLD_TEAMS, NEW_TEAM, dryRun, log);

  // ── 3. USERS sheet ──────────────────────────────────────────────
  _migrateSheetTeamColumn_(ss, SHEETS.USERS, OLD_TEAMS, NEW_TEAM, dryRun, log);

  // ── 4. Clear DASHBOARD_READY cache ─────────────────────────────
  _clearDashboardCache_(ss, dryRun, log);

  log.push('=== migrateTeamsBL_ XONG ===');
  log.forEach(function (line) { Logger.log(line); });

  return log;
}

// ── Helpers ──────────────────────────────────────────────────────

function _migrateLookupTeams_(ss, oldTeams, newTeam, dryRun, log) {
  var sheet = ss.getSheetByName(SHEETS.LOOKUP);
  if (!sheet) {
    log.push('[LOOKUP] Sheet không tìm thấy — bỏ qua');
    return;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    log.push('[LOOKUP] Sheet rỗng — bỏ qua');
    return;
  }

  // Scan: tìm rows team cũ và kiểm tra newTeam đã tồn tại chưa
  var toRemove   = []; // 1-indexed row numbers cần xóa (hoặc deactivate)
  var toUpdate   = []; // { row1idx, col1idx } cần đổi value
  var newTeamExists = false;

  for (var r = 1; r < data.length; r++) {
    var category = String(data[r][0] || '').trim().toLowerCase(); // col 0
    var value    = String(data[r][1] || '').trim();               // col 1
    var active   = data[r][3];                                    // col 3

    if (category !== 'team') continue;

    if (value === newTeam) {
      newTeamExists = true;
    } else if (oldTeams.indexOf(value) >= 0) {
      toRemove.push({ rowSheet: r + 1, value: value }); // 1-indexed
    }
  }

  if (toRemove.length === 0) {
    log.push('[LOOKUP] Không tìm thấy row Team BL1/BL2 — không có gì thay đổi');
    return;
  }

  // Nếu newTeam chưa tồn tại → đổi row đầu tiên thành newTeam, xóa phần còn lại
  // Nếu newTeam đã tồn tại → xóa tất cả oldTeam rows
  var firstToRemove = toRemove[0];

  if (!newTeamExists) {
    log.push('[LOOKUP] Đổi row ' + firstToRemove.rowSheet + ' Team=' + firstToRemove.value + ' → "' + newTeam + '"');
    if (!dryRun) {
      sheet.getRange(firstToRemove.rowSheet, 2).setValue(newTeam); // col 2 (1-indexed)
    }
    toRemove.shift(); // không xóa row đầu tiên (đã đổi value)
  } else {
    log.push('[LOOKUP] Team="' + newTeam + '" đã tồn tại trong sheet');
  }

  // Xóa các row BL cũ còn lại (duyệt ngược để không lệch index)
  toRemove.reverse().forEach(function (item) {
    log.push('[LOOKUP] Xóa row ' + item.rowSheet + ' (Team=' + item.value + ')');
    if (!dryRun) {
      sheet.deleteRow(item.rowSheet);
    }
  });

  log.push('[LOOKUP] Tổng: ' + (newTeamExists ? 0 : 1) + ' row cập nhật, ' + toRemove.length + ' row xóa');
}


function _migrateSheetTeamColumn_(ss, sheetName, oldTeams, newTeam, dryRun, log) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    log.push('[' + sheetName + '] Sheet không tìm thấy — bỏ qua');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log.push('[' + sheetName + '] Không có dữ liệu — bỏ qua');
    return;
  }

  // Tìm cột Team từ header row
  var headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var teamColIdx = -1; // 0-indexed
  for (var c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim() === 'Team') {
      teamColIdx = c;
      break;
    }
  }

  if (teamColIdx < 0) {
    log.push('[' + sheetName + '] Không tìm thấy cột "Team" — bỏ qua');
    return;
  }

  // Đọc toàn bộ cột Team (không kể header) — 1 API call
  var dataRows    = lastRow - 1;
  var colRange    = sheet.getRange(2, teamColIdx + 1, dataRows, 1); // 1-indexed
  var colValues   = colRange.getValues(); // [[val], [val], ...]

  var changed = 0;
  var preview = [];

  for (var r = 0; r < colValues.length; r++) {
    var val = String(colValues[r][0] || '').trim();
    if (oldTeams.indexOf(val) >= 0) {
      preview.push('  row ' + (r + 2) + ': Team=' + val + ' → "' + newTeam + '"');
      colValues[r][0] = newTeam;
      changed++;
    }
  }

  if (changed === 0) {
    log.push('[' + sheetName + '] Không tìm thấy row nào có Team BL1/BL2');
    return;
  }

  // Log preview (tối đa 20 rows để không spam)
  var previewSlice = preview.slice(0, 20);
  previewSlice.forEach(function (l) { log.push(l); });
  if (preview.length > 20) log.push('  ... và ' + (preview.length - 20) + ' row nữa');

  log.push('[' + sheetName + '] Tổng: ' + changed + ' rows Team → "' + newTeam + '"');

  // Ghi lại toàn bộ cột — 1 API call
  if (!dryRun) {
    colRange.setValues(colValues);
    log.push('[' + sheetName + '] ✅ Đã ghi ' + changed + ' rows');
  }
}


function _clearDashboardCache_(ss, dryRun, log) {
  var sheet = ss.getSheetByName(SHEETS.DASHBOARD);
  if (!sheet) {
    log.push('[DASHBOARD_READY] Sheet không tìm thấy — bỏ qua');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log.push('[DASHBOARD_READY] Cache rỗng — không cần xóa');
    return;
  }

  var rowsToClear = lastRow - 1;
  log.push('[DASHBOARD_READY] Xóa ' + rowsToClear + ' row cache (Team_Breakdown_JSON sẽ stale sau migrate)');

  if (!dryRun) {
    sheet.getRange(2, 1, rowsToClear, sheet.getLastColumn()).clearContent();
    log.push('[DASHBOARD_READY] ✅ Cache cleared');
  }
}
