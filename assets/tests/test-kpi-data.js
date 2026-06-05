/**
 * test-kpi-data.js
 * Unit tests cho _buildKPIData logic sau khi refactor:
 *   - Users với 0 UC vẫn xuất hiện (từ _usersList)
 *   - Case-insensitive matching: Tuantt4=TuanTT4=tuantt4
 *   - Fallback về _allList khi _usersList rỗng
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
    if (!uc.status || uc.status === 'Draft') return;
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

  var result  = {};
  var claimed = {};

  if (usersList && usersList.length) {
    usersList.forEach(function (u) {
      if (u.active === false) return;
      var uKey  = _norm(u.username);
      var dnKey = _norm(u.display_name);
      if (!uKey) return;

      var stats = byEmail[uKey] || byEmail[dnKey] || byName[uKey] || byName[dnKey] || null;
      if (stats) claimed[uKey] = true;

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
  { username: 'tuantt4',   display_name: 'Tuan Tran',  team: 'CV2',   role: 'admin', active: true },
  { username: 'user_b',    display_name: 'User B',      team: 'OPS',   role: 'user',  active: true },
  { username: 'user_zero', display_name: 'Zero User',   team: 'RISK',  role: 'user',  active: true },
  { username: 'inactive',  display_name: 'Inactive One',team: 'CV2',   role: 'user',  active: false }
];

var ALL_LIST = [
  // tuantt4 submits as "TuanTT4" in owner_email (different case)
  { owner_email: 'TuanTT4', owner_name: 'Tuan Tran', team: 'CV2', status: 'Submitted',  submit_date: TODAY },
  { owner_email: 'Tuantt4', owner_name: 'Tuan Tran', team: 'CV2', status: 'Approved',   submit_date: '2026-05-10' },
  // user_b submits with lowercase
  { owner_email: 'user_b',  owner_name: 'User B',    team: 'OPS', status: 'Submitted',  submit_date: TODAY },
  // Draft — should be excluded
  { owner_email: 'tuantt4', owner_name: 'Tuan Tran', team: 'CV2', status: 'Draft',      submit_date: TODAY },
  // Unknown user not in USERS sheet
  { owner_email: 'ghost',   owner_name: 'Ghost Guy',  team: 'IT',  status: 'Approved',  submit_date: TODAY }
];

// ── Test suite ────────────────────────────────────────────────────────

console.log('\n=== Suite A: With _usersList populated ===');
var res = buildKPIData(ALL_LIST, USERS_SHEET);

assert(res['tuantt4'] !== undefined, 'A1: tuantt4 entry exists');
assert(res['tuantt4'].total === 2, 'A2: tuantt4 total=2 (Submitted+Approved; Draft excluded)');
assert(res['tuantt4'].weeks[WEEK_THIS] === 1, 'A3: tuantt4 has 1 UC this week (Submitted)');

assert(res['user_b'] !== undefined, 'A4: user_b entry exists');
assert(res['user_b'].total === 1, 'A5: user_b total=1');

assert(res['user_zero'] !== undefined, 'A6: user_zero appears even with 0 UCs');
assert(res['user_zero'].total === 0, 'A7: user_zero total=0');
assert(Object.keys(res['user_zero'].weeks).length === 0, 'A8: user_zero weeks empty');

assert(res['inactive'] === undefined, 'A9: inactive user excluded');

assert(res['ghost'] !== undefined, 'A10: ghost (not in USERS sheet) still appears from _allList');
assert(res['ghost'].total === 1, 'A11: ghost total=1');

console.log('\n=== Suite B: Case-insensitive matching (Tuantt4=TuanTT4=tuantt4) ===');
var USERS2 = [
  { username: 'tuantt4', display_name: 'Tuan', team: 'CV2', active: true }
];
var LIST2 = [
  { owner_email: 'TUANTT4',  owner_name: 'Tuan', team: 'CV2', status: 'Approved',  submit_date: TODAY },
  { owner_email: 'TuanTT4',  owner_name: 'Tuan', team: 'CV2', status: 'Submitted', submit_date: '2026-05-15' },
  { owner_email: 'tuantt4',  owner_name: 'Tuan', team: 'CV2', status: 'Approved',  submit_date: '2026-04-01' }
];
var res2 = buildKPIData(LIST2, USERS2);
assert(res2['tuantt4'] !== undefined, 'B1: tuantt4 entry exists');
assert(res2['tuantt4'].total === 3, 'B2: all 3 UCs merged into one entry regardless of casing');
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

// ── Summary ───────────────────────────────────────────────────────────
console.log('\n────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) { console.error('SOME TESTS FAILED'); process.exit(1); }
else            { console.log('ALL TESTS PASSED ✅'); }
