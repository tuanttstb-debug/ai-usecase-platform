// ─────────────────────────────────────────────────────────────────
// UserService.gs — Quản lý danh sách user từ sheet USERS
//
// Sheet USERS (xem USERS_HEADERS trong Config.gs):
//   Username | Display_Name | Role | Team | Email | Active | Created_At | Last_Login
//
// Case-insensitive: mọi lookup đều qua normalizeUser_()
//   Tuantt4 = tuantt4 = TUANTT4 → normalize về "tuantt4"
//
// Nguồn truth cho role resolution (thay thế ADMIN_EMAILS tĩnh):
//   Admin detection: USERS sheet → CONFIG sheet → Config.gs fallback
// ─────────────────────────────────────────────────────────────────

/**
 * Normalize username: trim + lowercase.
 * Dùng cho MỌI so sánh username — đảm bảo case-insensitive.
 * VD: "Tuantt4" → "tuantt4"  |  " ADMIN " → "admin"
 */
function normalizeUser_(str) {
  return String(str || '').trim().toLowerCase();
}

/**
 * Build display name từ normalized username.
 * "tuantt4" → "Tuantt4"  |  "tuan.tt" → "Tuan Tt"
 */
function _buildDisplayNameGas_(username) {
  return String(username || '')
    .split(/[._\-]/)
    .map(function(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; })
    .join(' ')
    .trim() || String(username);
}

/**
 * Đảm bảo sheet USERS tồn tại, đúng headers và có seed dữ liệu.
 * Seed admin từ ADMIN_EMAILS (Config.gs) khi sheet mới tạo hoặc headers sai.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function initUsersSheet_() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var needSeed = false;

  if (!sheet) {
    sheet    = ss.insertSheet(SHEETS.USERS);
    needSeed = true;
  }

  var vals  = sheet.getDataRange().getValues();
  var hasOk = vals.length > 0 && String(vals[0][0]) === USERS_HEADERS[0];
  if (!hasOk) {
    sheet.clearContents();
    sheet.appendRow(USERS_HEADERS);
    formatHeaderRow_(sheet);
    needSeed = true;
  }

  if (needSeed) {
    var now = new Date().toISOString();
    (ADMIN_EMAILS || []).forEach(function(u) {
      var norm = normalizeUser_(u);
      if (!norm) return;
      sheet.appendRow([norm, _buildDisplayNameGas_(norm), 'admin', '', '', true, now, '']);
    });
  }

  return sheet;
}

/**
 * Đọc tất cả user từ sheet USERS.
 * @returns {Object[]}
 */
function getAllUsers_() {
  getOrCreateSheet_(SHEETS.USERS);
  return readSheetAsObjects_(SHEETS.USERS);
}

/**
 * Tìm user theo username — case-insensitive.
 * "Tuantt4", "tuantt4", "TUANTT4" → cùng 1 user.
 * @param {string} username
 * @returns {Object|null}
 */
function getUserByUsername_(username) {
  var norm = normalizeUser_(username);
  if (!norm) return null;
  var list = getAllUsers_();
  for (var i = 0; i < list.length; i++) {
    if (normalizeUser_(list[i].Username) === norm) return list[i];
  }
  return null;
}

/**
 * Kiểm tra username có tồn tại và Active=TRUE trong USERS sheet.
 * @param {string} username
 * @returns {boolean}
 */
function isActiveUser_(username) {
  var u = getUserByUsername_(username);
  if (!u) return false;
  return u.Active === true || String(u.Active).toUpperCase() === 'TRUE';
}

/**
 * Trả về danh sách username (đã normalize) của admin đang active.
 * Dùng bởi AdminService.getAdminEmails_() làm nguồn ưu tiên cao nhất.
 * @returns {string[]}
 */
function getAdminUsernamesFromSheet_() {
  try {
    return getAllUsers_()
      .filter(function(u) {
        return normalizeUser_(u.Role) === 'admin'
          && (u.Active === true || String(u.Active).toUpperCase() === 'TRUE');
      })
      .map(function(u) { return normalizeUser_(u.Username); })
      .filter(Boolean);
  } catch(e) {
    return [];
  }
}

/**
 * Tạo mới hoặc cập nhật user (upsert) theo normalized Username.
 * Match case-insensitive: "Tuantt4" và "tuantt4" = cùng 1 user.
 * @param {Object} data — { Username, Display_Name?, Role?, Team?, Email?, Active? }
 * @returns {{ created: boolean, user: Object }}
 */
function upsertUser_(data) {
  if (!data || !data.Username) throw new Error('Thiếu Username');

  var norm    = normalizeUser_(data.Username);
  var sheet   = getOrCreateSheet_(SHEETS.USERS);
  var values  = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  var now     = new Date().toISOString();

  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  // Tìm row hiện tại (case-insensitive)
  for (var r = 1; r < values.length; r++) {
    if (normalizeUser_(String(values[r][idx['Username']] || '')) === norm) {
      var updated = _buildUserRow_(norm, data, headers, values[r], now, false);
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([updated]);
      return { created: false, user: getUserByUsername_(norm) };
    }
  }

  // Không tìm thấy → insert mới
  var newRow = _buildUserRow_(norm, data, headers, null, now, true);
  sheet.appendRow(newRow);
  return { created: true, user: getUserByUsername_(norm) };
}

/**
 * Xây dựng row array theo thứ tự USERS_HEADERS.
 * @private
 */
function _buildUserRow_(normUsername, data, headers, existing, now, isNew) {
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var row = existing ? existing.slice() : new Array(headers.length).fill('');

  row[idx['Username']] = normUsername;

  row[idx['Display_Name']] = sanitizeStr_(
    data.Display_Name !== undefined
      ? data.Display_Name
      : (existing ? (existing[idx['Display_Name']] || '') : '')
  ) || _buildDisplayNameGas_(normUsername);

  var rawRole = data.Role !== undefined
    ? data.Role
    : (existing ? (existing[idx['Role']] || 'user') : 'user');
  var normRole = normalizeUser_(rawRole);
  row[idx['Role']] = (normRole === 'admin' || normRole === 'champion') ? normRole : 'user';

  row[idx['Team']]  = sanitizeStr_(
    data.Team  !== undefined ? data.Team  : (existing ? existing[idx['Team']]  || '' : '')
  );
  row[idx['Email']] = sanitizeStr_(
    data.Email !== undefined ? data.Email : (existing ? existing[idx['Email']] || '' : '')
  );

  if (data.Active !== undefined) {
    row[idx['Active']] = (data.Active === true || String(data.Active).toUpperCase() === 'TRUE');
  } else if (isNew) {
    row[idx['Active']] = true;
  }

  if (isNew) {
    row[idx['Created_At']] = now;
    row[idx['Last_Login']] = '';
  }

  return row;
}

/**
 * Cập nhật Last_Login timestamp cho user (case-insensitive).
 * @param {string} username
 */
function updateLastLogin_(username) {
  var norm   = normalizeUser_(username);
  var sheet  = getOrCreateSheet_(SHEETS.USERS);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  var uCol   = headers.indexOf('Username');
  var lCol   = headers.indexOf('Last_Login');
  if (uCol === -1 || lCol === -1) return;

  for (var r = 1; r < values.length; r++) {
    if (normalizeUser_(String(values[r][uCol] || '')) === norm) {
      sheet.getRange(r + 1, lCol + 1).setValue(new Date().toISOString());
      return;
    }
  }
}

/**
 * Đồng bộ USERS sheet với MASTER_DATA:
 * - Scan tất cả Owner_Email từ MASTER_DATA (= username được inject khi submit)
 * - Case-insensitive dedup: "Tuantt4" và "tuantt4" được merge thành 1 entry
 * - Upsert user chưa có → Role='user', Active=TRUE
 * - User đã có → bỏ qua (không overwrite role/team đã cấu hình)
 * @returns {{ synced: number, skipped: number, total_unique: number }}
 */
function syncUsersFromMasterData_() {
  var masterRows  = readSheetAsObjects_(SHEETS.MASTER);
  var uniqueUsers = {}; // key: normalized username → { displayName, team }

  masterRows.forEach(function(row) {
    var rawUser = String(row.Owner_Email || row.Owner_Name || '').trim();
    var norm    = normalizeUser_(rawUser);
    if (!norm) return;
    if (!uniqueUsers[norm]) {
      uniqueUsers[norm] = {
        displayName: sanitizeStr_(String(row.Owner_Name || '').trim()) || _buildDisplayNameGas_(norm),
        team:        sanitizeStr_(String(row.Team || '').trim())
      };
    }
  });

  var keys    = Object.keys(uniqueUsers);
  var synced  = 0;
  var skipped = 0;

  keys.forEach(function(norm) {
    if (!getUserByUsername_(norm)) {
      var info = uniqueUsers[norm];
      upsertUser_({
        Username:     norm,
        Display_Name: info.displayName,
        Role:         'user',
        Team:         info.team,
        Email:        '',
        Active:       true
      });
      synced++;
    } else {
      skipped++;
    }
  });

  return { synced: synced, skipped: skipped, total_unique: keys.length };
}

/**
 * Validate user khi đăng nhập — lookup USERS sheet, update Last_Login.
 * Nếu không tìm thấy: auto-create với Role='user' (backward-compatible).
 * Nếu Active=FALSE: từ chối.
 * @param {string} username
 * @returns {{ username, displayName, role, team, email }}
 */
function validateUserLogin_(username) {
  var norm = normalizeUser_(username);
  if (!norm) throw new Error('Tên đăng nhập không được để trống');

  var user = getUserByUsername_(norm);

  if (!user) {
    upsertUser_({
      Username:     norm,
      Display_Name: _buildDisplayNameGas_(norm),
      Role:         'user',
      Active:       true
    });
    user = getUserByUsername_(norm);
  }

  var active = (user.Active === true || String(user.Active).toUpperCase() === 'TRUE');
  if (!active) {
    throw new Error('Tài khoản "' + norm + '" đã bị vô hiệu hóa. Liên hệ quản trị viên.');
  }

  updateLastLogin_(norm);

  var _resolvedRole = normalizeUser_(user.Role);
  return {
    username:    norm,
    displayName: sanitizeStr_(user.Display_Name) || _buildDisplayNameGas_(norm),
    role:        (_resolvedRole === 'admin' || _resolvedRole === 'champion') ? _resolvedRole : 'user',
    team:        sanitizeStr_(user.Team  || ''),
    email:       sanitizeStr_(user.Email || '')
  };
}
