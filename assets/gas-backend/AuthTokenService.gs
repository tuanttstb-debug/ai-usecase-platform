// ─────────────────────────────────────────────────────────────────
// AuthTokenService.gs — Đăng nhập dùng chung với SHTD-Dashboard (H2)
//
// Nguồn user DUY NHẤT = sheet `User_Master` trên spreadsheet của SHTD.
// AI US và SHTD dùng CHUNG:
//   - sheet User_Master (username, password hash SHA-256, role, team…)
//   - AUTH_SECRET (Script Property) → token cấp bởi bên nào cũng verify được
//
// Token scheme (khớp SHTD backend/AuthService.gs):
//   base64(payload) + '.' + HMAC-SHA256-hex(payload, AUTH_SECRET)
//   payload = { u, dn, r, t, exp }  — exp = Unix ms, 24h kể từ khi cấp
//
// Role trong User_Master: 'Admin' | 'Teamlead' | 'User'
//   → normalize về 'admin' | 'teamlead' | 'user' cho toàn bộ AI US.
//
// SETUP THỦ CÔNG (làm 1 lần trong GAS Editor của AI US project):
//   1. Project Settings → Script Properties → thêm AUTH_SECRET
//      = ĐÚNG giá trị AUTH_SECRET đang dùng ở GAS project SHTD.
//   2. Đảm bảo tài khoản chạy GAS AI US có quyền đọc/ghi spreadsheet SHTD
//      (mở spreadsheet lần đầu để authorize khi được hỏi).
// ─────────────────────────────────────────────────────────────────

// Spreadsheet + sheet chứa user dùng chung (của SHTD-Dashboard).
var USER_SPREADSHEET_ID = '1cpg1p_8TGGbvZNNWZmjsKANqHW1tQijbiQBFLYn56Hk';
var USER_MASTER_SHEET   = 'User_Master';

// ── Secret + hash helpers (port từ SHTD) ─────────────────────────

function _authSecret_() {
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  if (!secret) {
    throw new Error('AUTH_SECRET chưa cấu hình trong Script Properties. Liên hệ Admin.');
  }
  return secret;
}

function _sha256Hex_(plain) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, plain, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function _hmacHex_(payload) {
  var sig = Utilities.computeHmacSha256Signature(
    payload, _authSecret_(), Utilities.Charset.UTF_8);
  return sig.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

// ── Token ─────────────────────────────────────────────────────────

function _makeToken_(u, dn, r, t) {
  var exp     = Date.now() + 24 * 60 * 60 * 1000;
  var payload = JSON.stringify({ u: u, dn: dn, r: r, t: t, exp: exp });
  var b64     = Utilities.base64Encode(payload, Utilities.Charset.UTF_8).replace(/[\r\n]/g, '');
  return b64 + '.' + _hmacHex_(payload);
}

/**
 * Validate token → payload {u,dn,r,t,exp} hoặc null nếu sai/hết hạn.
 * Dùng để verify server-side các thao tác nhạy cảm (approve, chấm điểm…).
 */
function validateToken_(token) {
  if (!token) return null;
  try {
    var parts = String(token).split('.');
    if (parts.length !== 2) return null;
    var payload = Utilities.newBlob(
      Utilities.base64Decode(parts[0].replace(/[\r\n]/g, ''))
    ).getDataAsString();
    if (_hmacHex_(payload) !== parts[1]) return null;
    var data = JSON.parse(payload);
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// ── User_Master access ────────────────────────────────────────────

function _openUserSheet_() {
  var ss    = SpreadsheetApp.openById(USER_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(USER_MASTER_SHEET);
  if (!sheet) throw new Error('Không tìm thấy sheet ' + USER_MASTER_SHEET + '. Liên hệ Admin.');
  return sheet;
}

function _normRole_(role) {
  var r = String(role || 'user').trim().toLowerCase();
  return (r === 'admin' || r === 'teamlead') ? r : 'user';
}

/**
 * Đăng nhập bằng username + password → { token, user }.
 * Throw Error với message tiếng Việt nếu thất bại.
 */
function authLogin_(username, password) {
  if (!username || !password) throw new Error('Thiếu thông tin đăng nhập.');

  var sheet = _openUserSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('Không tìm thấy người dùng trong hệ thống.');

  var H       = data[0].map(function (h) { return String(h).trim(); });
  var iUser   = H.indexOf('Username');
  var iDisp   = H.indexOf('Display_Name');
  var iRole   = H.indexOf('Role');
  var iTeam   = H.indexOf('Team');
  var iEmail  = H.indexOf('Email');
  var iActive = H.indexOf('Active');
  var iHash   = H.indexOf('Password_Hash');
  var iLogin  = H.indexOf('Last_Login');

  var inputHash  = _sha256Hex_(password);
  var inputLower = String(username).trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[iUser]).trim().toLowerCase() !== inputLower) continue;

    if (row[iActive] === false || String(row[iActive]).toLowerCase() === 'false') {
      throw new Error('Tài khoản đã bị vô hiệu hóa. Liên hệ Admin.');
    }
    if (String(row[iHash]).toLowerCase() !== inputHash) {
      throw new Error('Sai mật khẩu. Vui lòng thử lại.');
    }

    if (iLogin >= 0) {
      sheet.getRange(i + 1, iLogin + 1).setValue(new Date().toISOString());
      SpreadsheetApp.flush();
    }

    var uName = String(row[iUser]).trim();
    var dName = String(row[iDisp] || '').trim() || uName;
    var role  = _normRole_(row[iRole]);
    var team  = String(row[iTeam] || '').trim();
    var email = iEmail >= 0 ? String(row[iEmail] || '').trim() : '';

    return {
      token: _makeToken_(uName, dName, role, team),
      user:  { username: uName, displayName: dName, role: role, team: team, email: email }
    };
  }

  throw new Error('Không tìm thấy tài khoản. Vui lòng kiểm tra lại.');
}

/**
 * Đổi mật khẩu — tokenData phải đã validate ở caller (route).
 */
function authChangePassword_(tokenData, oldPassword, newPassword) {
  if (!tokenData || !tokenData.u) throw new Error('Phiên đăng nhập không hợp lệ.');
  if (!oldPassword || !newPassword) throw new Error('Vui lòng nhập đủ mật khẩu cũ và mới.');
  if (newPassword.length < 6)  throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
  if (oldPassword === newPassword) throw new Error('Mật khẩu mới phải khác mật khẩu cũ.');

  var sheet = _openUserSheet_();
  var data  = sheet.getDataRange().getValues();
  var H     = data[0].map(function (h) { return String(h).trim(); });
  var iUser = H.indexOf('Username');
  var iHash = H.indexOf('Password_Hash');
  var oldHash = _sha256Hex_(oldPassword);
  var target  = String(tokenData.u).toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iUser]).toLowerCase() !== target) continue;
    if (String(data[i][iHash]).toLowerCase() !== oldHash) throw new Error('Mật khẩu cũ không đúng.');
    sheet.getRange(i + 1, iHash + 1).setValue(_sha256Hex_(newPassword));
    SpreadsheetApp.flush();
    return true;
  }
  throw new Error('Không tìm thấy tài khoản.');
}

// ── User list từ User_Master (thay nguồn USERS nội bộ cho AI US) ──

/**
 * Trả toàn bộ user từ User_Master (KHÔNG kèm Password_Hash), chuẩn hóa
 * về shape mà AI US FE đang dùng (giống route `users` cũ).
 */
function getAllUsersFromMaster_() {
  var sheet = _openUserSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var H       = data[0].map(function (h) { return String(h).trim(); });
  var iUser   = H.indexOf('Username');
  var iDisp   = H.indexOf('Display_Name');
  var iRole   = H.indexOf('Role');
  var iTeam   = H.indexOf('Team');
  var iEmail  = H.indexOf('Email');
  var iActive = H.indexOf('Active');
  var iCreated= H.indexOf('Created_At');
  var iLogin  = H.indexOf('Last_Login');

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var uname = String(row[iUser] || '').trim();
    if (!uname) continue;
    out.push({
      username:     uname.toLowerCase(),
      display_name: String(row[iDisp] || '').trim(),
      role:         _normRole_(row[iRole]),
      team:         String(row[iTeam] || '').trim(),
      email:        iEmail  >= 0 ? String(row[iEmail]  || '').trim() : '',
      active:       (row[iActive] === true || String(row[iActive]).toUpperCase() === 'TRUE'),
      created_at:   iCreated >= 0 ? String(row[iCreated] || '') : '',
      last_login:   iLogin   >= 0 ? String(row[iLogin]   || '') : ''
    });
  }
  return out;
}

/**
 * Danh sách username (lowercase) có Role=admin & Active — dùng cho isAdminEmail_.
 */
function getAdminUsernamesFromMaster_() {
  try {
    return getAllUsersFromMaster_()
      .filter(function (u) { return u.role === 'admin' && u.active; })
      .map(function (u) { return u.username; });
  } catch (e) {
    return [];
  }
}

// ── User admin (ghi vào User_Master dùng chung) ──────────────────

// Role chuẩn hóa về dạng canonical của User_Master (khớp SHTD).
function _canonRole_(role) {
  var r = String(role || 'user').trim().toLowerCase();
  if (r === 'admin')    return 'Admin';
  if (r === 'teamlead' || r === 'champion') return 'Teamlead';
  return 'User';
}

function _userHeaderIdx_(H) {
  var idx = {};
  H.forEach(function (h, i) { idx[String(h).trim()] = i; });
  return idx;
}

/**
 * Tạo mới HOẶC cập nhật user trong User_Master (upsert theo username, case-insensitive).
 * - Tạo mới: bắt buộc có password (>=6 ký tự) → hash SHA-256.
 * - Cập nhật: sửa Display_Name/Role/Team/Email/Active (không đụng Username/Password).
 * @param {Object} data — { Username, Display_Name?, Role?, Team?, Email?, Active?, Password? }
 * @returns {{ created: boolean, username: string }}
 */
function userUpsertInMaster_(data) {
  if (!data || !data.Username) throw new Error('Thiếu Username');
  var username = String(data.Username).trim();
  var target   = username.toLowerCase();

  var lock = LockService.getScriptLock();
  try { lock.waitLock(LOCK_TIMEOUT_MS); } catch (e) { throw new Error('Hệ thống đang bận, thử lại sau.'); }
  try {
    var sheet = _openUserSheet_();
    var values = sheet.getDataRange().getValues();
    var H   = values[0].map(function (h) { return String(h).trim(); });
    var idx = _userHeaderIdx_(H);
    if (idx['Username'] === undefined) throw new Error('User_Master thiếu cột Username.');

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idx['Username']]).trim().toLowerCase() !== target) continue;
      // ── UPDATE ──
      if (data.Display_Name !== undefined && idx['Display_Name'] !== undefined)
        sheet.getRange(i + 1, idx['Display_Name'] + 1).setValue(String(data.Display_Name).trim());
      if (data.Role !== undefined && idx['Role'] !== undefined)
        sheet.getRange(i + 1, idx['Role'] + 1).setValue(_canonRole_(data.Role));
      if (data.Team !== undefined && idx['Team'] !== undefined)
        sheet.getRange(i + 1, idx['Team'] + 1).setValue(String(data.Team).trim());
      if (data.Email !== undefined && idx['Email'] !== undefined)
        sheet.getRange(i + 1, idx['Email'] + 1).setValue(String(data.Email).trim());
      if (data.Active !== undefined && idx['Active'] !== undefined)
        sheet.getRange(i + 1, idx['Active'] + 1).setValue(
          data.Active === true || String(data.Active).toUpperCase() === 'TRUE');
      SpreadsheetApp.flush();
      return { created: false, username: username };
    }

    // ── CREATE ──
    var pass = String(data.Password || '');
    if (pass.length < 6) throw new Error('Mật khẩu (>=6 ký tự) là bắt buộc khi tạo user mới.');
    var now = new Date().toISOString();
    var row = new Array(H.length).fill('');
    if (idx['Username']      !== undefined) row[idx['Username']]      = username;
    if (idx['Display_Name']  !== undefined) row[idx['Display_Name']]  = String(data.Display_Name || username).trim();
    if (idx['Role']          !== undefined) row[idx['Role']]          = _canonRole_(data.Role);
    if (idx['Team']          !== undefined) row[idx['Team']]          = String(data.Team  || '').trim();
    if (idx['Email']         !== undefined) row[idx['Email']]         = String(data.Email || '').trim();
    if (idx['Active']        !== undefined) row[idx['Active']]        = (data.Active === false || String(data.Active).toUpperCase() === 'FALSE') ? false : true;
    if (idx['Created_At']    !== undefined) row[idx['Created_At']]    = now;
    if (idx['Last_Login']    !== undefined) row[idx['Last_Login']]    = '';
    if (idx['Password_Hash'] !== undefined) row[idx['Password_Hash']] = _sha256Hex_(pass);
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return { created: true, username: username };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Admin đặt lại mật khẩu cho 1 user trong User_Master.
 */
function userResetPasswordInMaster_(username, newPassword) {
  if (!username || !newPassword) throw new Error('Thiếu username hoặc mật khẩu mới.');
  if (String(newPassword).length < 6) throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
  var sheet  = _openUserSheet_();
  var values = sheet.getDataRange().getValues();
  var H   = values[0].map(function (h) { return String(h).trim(); });
  var idx = _userHeaderIdx_(H);
  var target = String(username).trim().toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idx['Username']]).trim().toLowerCase() !== target) continue;
    sheet.getRange(i + 1, idx['Password_Hash'] + 1).setValue(_sha256Hex_(newPassword));
    SpreadsheetApp.flush();
    return { username: username };
  }
  throw new Error('Không tìm thấy user "' + username + '".');
}

/**
 * Đồng bộ owner từ MASTER_DATA (AI US) vào User_Master — user chưa có thì tạo mới
 * với Role=User, Active=TRUE, mật khẩu mặc định = username (case-insensitive dedup).
 * @returns {{ synced, skipped, total_unique }}
 */
function syncUsersToMaster_() {
  var masterRows  = readSheetAsObjects_(SHEETS.MASTER);
  var existing    = {};
  getAllUsersFromMaster_().forEach(function (u) { existing[u.username] = true; });

  var uniqueUsers = {};
  masterRows.forEach(function (row) {
    var raw  = String(row.Owner_Email || row.Owner_Name || '').trim();
    var norm = raw.toLowerCase();
    if (!norm) return;
    if (!uniqueUsers[norm]) {
      uniqueUsers[norm] = {
        displayName: String(row.Owner_Name || '').trim() || norm,
        team:        String(row.Team || '').trim()
      };
    }
  });

  var keys = Object.keys(uniqueUsers), synced = 0, skipped = 0;
  keys.forEach(function (norm) {
    if (existing[norm]) { skipped++; return; }
    var info = uniqueUsers[norm];
    userUpsertInMaster_({
      Username: norm, Display_Name: info.displayName, Role: 'User',
      Team: info.team, Email: '', Active: true, Password: norm
    });
    synced++;
  });
  return { synced: synced, skipped: skipped, total_unique: keys.length };
}

/**
 * Danh sách username (lowercase) là thành viên hội đồng chấm điểm US.
 * Hội đồng H2 = 4 teamlead: TuanTT4, MaiTTT7, TuTV3, QuynhNNY.
 * Nguồn: Script Property COUNCIL_USERS (CSV) → fallback hằng số dưới đây.
 */
function getCouncilUsernames_() {
  var prop = PropertiesService.getScriptProperties().getProperty('COUNCIL_USERS');
  var raw  = prop ? prop.split(',') : ['tuantt4', 'maittt7', 'tutv3', 'quynhnny'];
  return raw.map(function (s) { return String(s).trim().toLowerCase(); }).filter(Boolean);
}
