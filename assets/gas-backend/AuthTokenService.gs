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

// NOTE (2026-08-18): Đã gỡ toàn bộ hàm GHI user (userUpsertInMaster_, userResetPasswordInMaster_,
// syncUsersToMaster_) — quản lý user CHỈ làm ở SHTD-Dashboard. AI US chỉ ĐỌC User_Master
// (getAllUsersFromMaster_, getAdminUsernamesFromMaster_) + đổi mật khẩu tự phục vụ (authChangePassword_).

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
