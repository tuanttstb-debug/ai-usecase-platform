/**
 * test-kpi-data.js
 * Unit tests cho _buildKPIData logic:
 *   - Users với 0 UC vẫn xuất hiện (từ _usersList)
 *   - Case-insensitive matching: Tuantt4=TuanTT4=tuantt4
 *   - Fallback về _allList khi _usersList rỗng
 *   - Inactive users (active=false) bị loại kể cả khi có UC cũ trong _allList (BUG FIX 2026-06-29)
 *   - Duplicate user khi owner_email = display_name thay vì username (BUG FIX 2026-06-29)
 * Chạy: node assets/tests/test-kpi-data.js
 */

// ── Replicate helpers from dashboard.js ──────────────────────────────

function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

function _getWeekStart(date) {
  var d = new Date(date);
  if (isNaN(d.getTime())) return null;
  var day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function _getWeekKey(date) {
  var ws = _getWeekStart(date);
  if (!ws) return null;
  var y = ws.getFullYear();
  var m = String(ws.getMonth() + 1).padStart(2, '0');
  var d = String(ws.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

// ── Core function under test (extracted from dashboard.js IIFE) ──────

function buildKPIData(allList, usersList) {
  var byEmail = {};
  var byName  = {};

  allList.forEach(function (uc) {
    if (uc.status !== 'Approved') return; // chỉ đếm UC được duyệt
    var dateStr = uc.submit_date || uc.submitted_at;
    if (!dateStr) return;
    var weekKey = _getWeekKey(new Date(dateStr));
    if (!weekKey) return;

    var eKey = _norm(uc.owner_email);
    var nKey = _norm(uc.owner_name);
    var team = uc.team || '--';
    var rawName = String(uc.owner_name == null ? '' : uc.owner_name).trim();

    function addTo(map, key) {
      if (!key) return;
      if (!map[key]) map[key] = { team: team, weeks: {}, total: 0, rawName: rawName || key };
      map[key].weeks[weekKey] = (map[key].weeks[weekKey] || 0) + 1;
      map[key].total++;
    }
    if (eKey) addTo(byEmail, eKey);
    if (nKey && nKey !== eKey) addTo(byName, nKey);
  });

  var result       = {};
  var claimed      = {};
  var inactiveKeys = {}; // BUG FIX 2026-06-29: norm keys của inactive users để filter ở Step 2b

  // Merge hai byEmail stat buckets — an toàn vì owner_email là single value (không double-count).
  function mergeKPIStats_(a, b) {
    if (!a) return b;
    if (!b) return a;
    var m = { team: (a.team !== '--' ? a.team : b.team), rawName: a.rawName || b.rawName, weeks: {}, total: 0 };
    [a.weeks, b.weeks].forEach(function(w) {
      Object.keys(w).forEach(function(wk) { m.weeks[wk] = (m.weeks[wk] || 0) + w[wk]; });
    });
    m.total = (a.total || 0) + (b.total || 0);
    return m;
  }

  if (usersList && usersList.length) {
    usersList.forEach(function (u) {
      if (u.active === false) {
        var ik  = _norm(u.username);    if (ik)  inactiveKeys[ik]  = true;
        var idk = _norm(u.display_name); if (idk) inactiveKeys[idk] = true;
        return;
      }
      var uKey  = _norm(u.username);
      var dnKey = _norm(u.display_name);
      if (!uKey) return;

      // BUG FIX 2026-06-29: claim cả uKey lẫn dnKey để Step 2b không tạo ghost row duplicate.
      claimed[uKey] = true;
      if (dnKey) claimed[dnKey] = true;

      // Merge byEmail từ cả username key lẫn display_name key (disjoint — không double-count).
      // Fall back sang byName chỉ khi byEmail không có gì cho user này.
      var eA = byEmail[uKey] || null;
      var eB = (dnKey && dnKey !== uKey) ? (byEmail[dnKey] || null) : null;
      var stats;
      if (eA || eB) {
        stats = mergeKPIStats_(eA, eB);
      } else {
        stats = byName[uKey] || (dnKey && dnKey !== uKey ? byName[dnKey] : null) || null;
      }

      result[uKey] = {
        username: uKey,
        name: u.display_name || u.username,
        team: (stats && stats.team && stats.team !== '--') ? stats.team : (u.team || '--'),
        weeks: stats ? stats.weeks : {},
        total: stats ? stats.total : 0
      };
    });

    Object.keys(byEmail).forEach(function (eKey) {
      if (claimed[eKey]) return;
      if (inactiveKeys[eKey]) return; // BUG FIX: loại inactive dù có UC cũ
      var stats = byEmail[eKey];
      result[eKey] = {
        username: eKey,
        name: stats.rawName || eKey,
        team: stats.team,
        weeks: stats.weeks,
        total: stats.total
      };
    });
  } else {
    Object.keys(byEmail).forEach(function (key) {
      var stats = byEmail[key];
      result[key] = { username: key, name: stats.rawName || key, team: stats.team, weeks: stats.weeks, total: stats.total };
    });
    Object.keys(byName).forEach(function (key) {
      if (result[key]) return;
      var stats = byName[key];
      result[key] = { username: key, name: stats.rawName || key, team: stats.team, weeks: stats.weeks, total: stats.total };
    });
  }

  return result;
}

// ── Test runner ────────────────────────────────────────────────────────
var passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) { console.log('  ✅ PASS: ' + label); passed++; }
  else           { console.error('  ❌ FAIL: ' + label); failed++; }
}

// ── Fixtures ──────────────────────────────────────────────────────────

var WEEK_THIS = (function() {
  var d = new Date(); var day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0,0,0,0);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
})();

var TODAY = new Date().toISOString().split('T')[0];

var USERS_SHEET = [
  { username: 'tuantt4',   display_name: 'Tuan Tran',   team: 'CV2',  role: 'admin', active: true },
  { username: 'user_b',    display_name: 'User B',       team: 'OPS',  role: 'user',  active: true },
  { username: 'user_zero', display_name: 'Zero User',    team: 'RISK', role: 'user',  active: true },
  { username: 'inactive',  display_name: 'Inactive One', team: 'CV2',  role: 'user',  active: false }
];

var ALL_LIST = [
  // tuantt4 submits as "TuanTT4" in owner_email (different case) — both Approved
  { owner_email: 'TuanTT4',  owner_name: 'Tuan Tran',   team: 'CV2', status: 'Approved', submit_date: TODAY },
  { owner_email: 'Tuantt4',  owner_name: 'Tuan Tran',   team: 'CV2', status: 'Approved', submit_date: '2026-05-10' },
  // user_b — Approved
  { owner_email: 'user_b',   owner_name: 'User B',       team: 'OPS', status: 'Approved', submit_date: TODAY },
  // Draft — should be excluded
  { owner_email: 'tuantt4',  owner_name: 'Tuan Tran',   team: 'CV2', status: 'Draft',    submit_date: TODAY },
  // Unknown user not in USERS sheet
  { owner_email: 'ghost',    owner_name: 'Ghost Guy',    team: 'IT',  status: 'Approved', submit_date: TODAY },
  // BUG CASE: inactive user has an Approved UC — must NOT appear in KPI after fix
  { owner_email: 'inactive', owner_name: 'Inactive One', team: 'CV2', status: 'Approved', submit_date: TODAY }
];

// ── Test suite ────────────────────────────────────────────────────────

console.log('\n=== Suite A: With _usersList populated ===');
var res = buildKPIData(ALL_LIST, USERS_SHEET);

assert(res['tuantt4'] !== undefined, 'A1: tuantt4 entry exists');
assert(res['tuantt4'].total === 2, 'A2: tuantt4 total=2 (Approved×2; Draft excluded)');
assert(res['tuantt4'].weeks[WEEK_THIS] === 1, 'A3: tuantt4 has 1 UC this week (Approved TODAY)');

assert(res['user_b'] !== undefined, 'A4: user_b entry exists');
assert(res['user_b'].total === 1, 'A5: user_b total=1');

assert(res['user_zero'] !== undefined, 'A6: user_zero appears even with 0 UCs');
assert(res['user_zero'].total === 0, 'A7: user_zero total=0');
assert(Object.keys(res['user_zero'].weeks).length === 0, 'A8: user_zero weeks empty');

assert(res['inactive'] === undefined, 'A9: inactive user excluded even though they have an Approved UC in _allList');

assert(res['ghost'] !== undefined, 'A10: ghost (not in USERS sheet) still appears from _allList');
assert(res['ghost'].total === 1, 'A11: ghost total=1');

console.log('\n=== Suite B: Case-insensitive matching (Tuantt4=TuanTT4=tuantt4) ===');
var USERS2 = [
  { username: 'tuantt4', display_name: 'Tuan', team: 'CV2', active: true }
];
var LIST2 = [
  { owner_email: 'TUANTT4', owner_name: 'Tuan', team: 'CV2', status: 'Approved', submit_date: TODAY },
  { owner_email: 'TuanTT4', owner_name: 'Tuan', team: 'CV2', status: 'Approved', submit_date: '2026-05-15' },
  { owner_email: 'tuantt4', owner_name: 'Tuan', team: 'CV2', status: 'Approved', submit_date: '2026-04-01' }
];
var res2 = buildKPIData(LIST2, USERS2);
assert(res2['tuantt4'] !== undefined, 'B1: tuantt4 entry exists');
assert(res2['tuantt4'].total === 3, 'B2: all 3 Approved UCs merged into one entry regardless of casing');
assert(Object.keys(res2).length === 1, 'B3: only 1 entry — no duplicates from TUANTT4/TuanTT4/tuantt4');

console.log('\n=== Suite C: Fallback when _usersList is empty ===');
var LIST3 = [
  { owner_email: 'alice', owner_name: 'Alice', team: 'A', status: 'Approved', submit_date: TODAY },
  { owner_email: 'bob',   owner_name: 'Bob',   team: 'B', status: 'Draft',    submit_date: TODAY }
];
var res3 = buildKPIData(LIST3, []);
assert(res3['alice'] !== undefined, 'C1: alice appears (fallback from _allList)');
assert(res3['alice'].total === 1, 'C2: alice total=1');
assert(res3['bob'] === undefined, 'C3: bob excluded (Draft)');

console.log('\n=== Suite D: owner_email missing — fall back to owner_name index ===');
var USERS4 = [
  { username: 'carol', display_name: 'Carol', team: 'X', active: true }
];
var LIST4 = [
  { owner_email: '', owner_name: 'carol', team: 'X', status: 'Approved', submit_date: TODAY }
];
var res4 = buildKPIData(LIST4, USERS4);
assert(res4['carol'] !== undefined, 'D1: carol entry exists');
assert(res4['carol'].total === 1, 'D2: UC matched via owner_name when owner_email empty');

console.log('\n=== Suite E: username == curUserKey matching logic ===');
var USERS5 = [
  { username: 'testuser', display_name: 'Test User', team: 'T', active: true }
];
var LIST5 = [
  { owner_email: 'TestUser', owner_name: 'Test User', team: 'T', status: 'Approved', submit_date: TODAY }
];
var res5 = buildKPIData(LIST5, USERS5);
var curKey = 'testuser'; // simulating _user.email.toLowerCase()
var entry = res5['testuser'];
var isMe  = entry && (entry.username === curKey || entry.name.toLowerCase() === curKey);
assert(isMe === true, 'E1: isMe detected via entry.username === curUserKey');

console.log('\n=== Suite F: BUG FIX — Inactive user với UC cũ phải bị loại khỏi KPI ===');
// Trước khi fix: inactive user bị skip ở Step 2a (không vào claimed),
// nhưng UC của họ trong byEmail vẫn được Step 2b thêm vào result.
// Sau khi fix: inactiveKeys được ghi ở Step 2a, Step 2b filter theo inactiveKeys.

var USERS_F = [
  { username: 'active_user',   display_name: 'Active User',   team: 'A', active: true  },
  { username: 'inactive_user', display_name: 'Inactive User', team: 'A', active: false }
];
var LIST_F = [
  { owner_email: 'active_user',   owner_name: 'Active User',   team: 'A', status: 'Approved', submit_date: TODAY },
  { owner_email: 'inactive_user', owner_name: 'Inactive User', team: 'A', status: 'Approved', submit_date: TODAY }
];
var resF = buildKPIData(LIST_F, USERS_F);

assert(resF['active_user'] !== undefined,   'F1: active user xuất hiện trong KPI');
assert(resF['active_user'].total === 1,     'F2: active user total=1');
assert(resF['inactive_user'] === undefined, 'F3: inactive user bị loại dù có Approved UC trong _allList (bug fix)');
assert(Object.keys(resF).length === 1,      'F4: chỉ 1 entry trong result — không bị rò rỉ inactive');

// Edge case: inactive user submit với display_name khác username
var USERS_F2 = [
  { username: 'inact2', display_name: 'Ngoc Bui', team: 'B', active: false }
];
var LIST_F2 = [
  { owner_email: 'Ngoc Bui', owner_name: 'Ngoc Bui', team: 'B', status: 'Approved', submit_date: TODAY }
];
var resF2 = buildKPIData(LIST_F2, USERS_F2);
assert(resF2['ngoc bui'] === undefined, 'F5: inactive user bị loại theo display_name key');

console.log('\n=== Suite G: BUG FIX — User xuất hiện 2 lần khi owner_email = display_name ===');
// Kịch bản: user "phuongnpl" nộp 2 UC với owner_email="phuongnpl",
// nhưng nộp 3 UC khác với owner_email="Nguyen Pham Lam Phuong" (display_name).
// Trước fix: user xuất hiện 2 row riêng biệt.
// Sau fix: merge thành 1 row với total=5, không có ghost row.

var USERS_G = [
  { username: 'phuongnpl', display_name: 'Nguyen Pham Lam Phuong', team: 'OPS', active: true }
];
var LIST_G = [
  { owner_email: 'phuongnpl',              owner_name: 'Nguyen Pham Lam Phuong', team: 'OPS', status: 'Approved', submit_date: TODAY },
  { owner_email: 'phuongnpl',              owner_name: 'Nguyen Pham Lam Phuong', team: 'OPS', status: 'Approved', submit_date: '2026-05-01' },
  { owner_email: 'Nguyen Pham Lam Phuong', owner_name: 'Nguyen Pham Lam Phuong', team: 'OPS', status: 'Approved', submit_date: TODAY },
  { owner_email: 'Nguyen Pham Lam Phuong', owner_name: 'Nguyen Pham Lam Phuong', team: 'OPS', status: 'Approved', submit_date: TODAY },
  { owner_email: 'Nguyen Pham Lam Phuong', owner_name: 'Nguyen Pham Lam Phuong', team: 'OPS', status: 'Approved', submit_date: '2026-04-15' }
];
var resG = buildKPIData(LIST_G, USERS_G);

assert(resG['phuongnpl'] !== undefined,         'G1: entry tồn tại với key username');
assert(resG['phuongnpl'].total === 5,            'G2: total=5 (2 via username + 3 via display_name — merged)');
assert((resG['phuongnpl'].weeks[WEEK_THIS] || 0) === 3, 'G3: tuần này = 3 UC (1 username + 2 display_name)');
assert(resG['nguyen pham lam phuong'] === undefined, 'G4: không có ghost row cho display_name key');
assert(Object.keys(resG).length === 1,           'G5: chỉ 1 entry — không duplicate');

// ── Summary ───────────────────────────────────────────────────────────
console.log('\n────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) { console.error('SOME TESTS FAILED'); process.exit(1); }
else            { console.log('ALL TESTS PASSED ✅'); }
