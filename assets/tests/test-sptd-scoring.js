/* ─────────────────────────────────────────────────────────────────
   test-sptd-scoring.js — Unit tests for SPTDScoring module
   Run: node assets/tests/test-sptd-scoring.js
   ───────────────────────────────────────────────────────────────── */

// ── Minimal shims — use global so required modules can read them ───
global.APP_CONFIG = {
  PROGRAM_START_DATE:   '2026-06-01',
  SPTD_EXCLUDED_USERS:  ['excluded_user']
};

// Load module (Node.js export added in sptd-scoring.js for test compat)
var SPTDScoring = require('../../assets/js/sptd-scoring.js');

// ── Test harness ───────────────────────────────────────────────────
var passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
    passed++;
  } catch (e) {
    console.error('  FAIL  ' + name + '\n        ' + e.message);
    failed++;
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// T0 = 2026-06-01 (Monday) → Monday of that week = 2026-06-01 itself
// Week 0: 2026-06-01 – 2026-06-07
// Week 1: 2026-06-08 – 2026-06-14
// Week 2: 2026-06-15 – 2026-06-21

function makeUC(overrides) {
  return Object.assign({
    usecase_id:            'AIUS-0001',
    record_id:             'rec-001',
    name:                  'Test UC',
    status:                'Approved',
    owner_email:           'testuser',
    owner_name:            'Test User',
    team:                  'Team A',
    submit_date:           '2026-06-09', // week 1 (Mon 06-08)
    total_score:           80,
    auto_score:            60,
    quality_score:         8,
    business_value_score:  7,
    innovation_score:      5,
    reviewer_email:        'reviewer'
  }, overrides);
}

function makeUser(overrides) {
  return Object.assign({
    username:     'testuser',
    display_name: 'Test User',
    team:         'Team A',
    active:       true
  }, overrides);
}

// ── Suite A: computeAllScores — basic ──────────────────────────────
console.log('\nSuite A: computeAllScores basic');

test('A1: single user with 1 Approved UC returns 1 entry', function () {
  var uc   = makeUC();
  var user = makeUser();
  var res  = SPTDScoring.computeAllScores([uc], [user]);
  eq(res.length, 1, 'entries');
  eq(res[0].username, 'testuser');
});

test('A2: total score formula is 80-10-10', function () {
  var uc   = makeUC({ total_score: 100, submit_date: '2026-06-09' });
  var user = makeUser();
  var res  = SPTDScoring.computeAllScores([uc], [user]);
  var u    = res[0];
  // avg_quality = 100, n_approved=1, nWeeks varies but check components
  eq(u.s_quality, 80, 's_quality when avg=100');
  ok(u.s_quantity > 0 && u.s_quantity <= 10, 's_quantity in [0,10]');
  ok(u.s_weeks   > 0 && u.s_weeks   <= 10, 's_weeks in [0,10]');
  ok(u.total     <= 100,                    'total <= 100');
});

test('A3: Draft UC excluded from score', function () {
  var uc   = makeUC({ status: 'Draft', total_score: 100 });
  var user = makeUser();
  var res  = SPTDScoring.computeAllScores([uc], [user]);
  eq(res[0].n_approved, 0, 'n_approved = 0 for Draft');
  eq(res[0].total,      0, 'total = 0');
});

test('A4: Submitted UC excluded from score', function () {
  var uc   = makeUC({ status: 'Submitted', total_score: 90 });
  var user = makeUser();
  var res  = SPTDScoring.computeAllScores([uc], [user]);
  eq(res[0].n_approved, 0);
  eq(res[0].total,      0);
});

test('A5: result sorted descending by total', function () {
  var uc1 = makeUC({ owner_email: 'user1', total_score: 50 });
  var uc2 = makeUC({ owner_email: 'user2', total_score: 100 });
  var res = SPTDScoring.computeAllScores([uc1, uc2], [
    makeUser({ username: 'user1', display_name: 'User One' }),
    makeUser({ username: 'user2', display_name: 'User Two' })
  ]);
  ok(res[0].total >= res[1].total, 'sorted descending');
});

test('A6: avg_quality = mean of total_scores across Approved UCs', function () {
  var ucs = [
    makeUC({ total_score: 80, submit_date: '2026-06-09' }),
    makeUC({ usecase_id: 'AIUS-0002', record_id: 'rec-002', total_score: 60, submit_date: '2026-06-16' })
  ];
  var res = SPTDScoring.computeAllScores(ucs, [makeUser()]);
  eq(res[0].avg_quality, 70, 'avg of 80 and 60 = 70');
  eq(res[0].s_quality,   Math.round(0.8 * 70 * 10) / 10, 's_quality = 70/100*80');
});

test('A7: quantity capped at 1 UC/week (max 10pt)', function () {
  // Submit many UCs in one week — min(n/nWeeks, 1) × 10 = 10
  var ucs = [1,2,3,4,5,6,7,8,9,10,11,12].map(function (i) {
    return makeUC({ usecase_id: 'AIUS-' + i, record_id: 'rec-' + i, submit_date: '2026-06-09' });
  });
  var res = SPTDScoring.computeAllScores(ucs, [makeUser()]);
  eq(res[0].s_quantity, 10, 'capped at 10');
});

test('A8: UC before T0 (2026-06-01) not counted', function () {
  var uc = makeUC({ submit_date: '2026-04-01' }); // before T0 Monday (2026-06-01) → wkIdx = -1
  var res = SPTDScoring.computeAllScores([uc], [makeUser()]);
  eq(res[0].n_approved,  0, 'UC before T0 not counted');
  eq(res[0].n_weeks_hit, 0, 'no week hit');
});

test('A9: multiple UCs same week count as 1 week hit', function () {
  var ucs = [
    makeUC({ usecase_id: 'A', record_id: 'r1', submit_date: '2026-06-09' }),
    makeUC({ usecase_id: 'B', record_id: 'r2', submit_date: '2026-06-10' })
  ];
  var res = SPTDScoring.computeAllScores(ucs, [makeUser()]);
  eq(res[0].n_weeks_hit, 1, 'same ISO week counts as 1');
  eq(res[0].n_approved, 2, 'still 2 UCs');
});

// ── Suite B: edge cases ────────────────────────────────────────────
console.log('\nSuite B: edge cases');

test('B1: user with no UCs has total=0', function () {
  var user = makeUser({ username: 'nouc', display_name: 'No UC' });
  var res  = SPTDScoring.computeAllScores([], [user]);
  eq(res.length, 1);
  eq(res[0].total,      0);
  eq(res[0].n_approved, 0);
});

test('B2: excluded user not in results', function () {
  var uc   = makeUC({ owner_email: 'excluded_user' });
  var user = makeUser({ username: 'excluded_user' });
  var res  = SPTDScoring.computeAllScores([uc], [user]);
  eq(res.length, 0, 'excluded user absent');
});

test('B3: inactive user not in results', function () {
  var uc   = makeUC({ owner_email: 'inactiveuser' });
  var user = makeUser({ username: 'inactiveuser', active: false });
  var res  = SPTDScoring.computeAllScores([uc], [user]);
  eq(res.length, 0, 'inactive user excluded');
});

test('B4: no usersList falls back to allList owners', function () {
  var uc  = makeUC({ owner_email: 'solouser', owner_name: 'Solo User', total_score: 75 });
  var res = SPTDScoring.computeAllScores([uc], []);
  eq(res.length, 1, 'derived from allList');
  eq(res[0].username, 'solouser');
  eq(res[0].n_approved, 1);
});

test('B5: UC with total_score=0 (unscored) gives avg_quality=0', function () {
  var uc   = makeUC({ total_score: 0, reviewer_email: '' });
  var user = makeUser();
  var res  = SPTDScoring.computeAllScores([uc], [user]);
  eq(res[0].avg_quality, 0);
  eq(res[0].s_quality,   0);
  ok(res[0].n_approved   === 1, 'still counted in n_approved');
});

// ── Suite C: computeUserDetails ────────────────────────────────────
console.log('\nSuite C: computeUserDetails');

test('C1: returns correct number of weeks in timeline', function () {
  var details = SPTDScoring.computeUserDetails('testuser', [makeUC()]);
  ok(details.nWeeks > 0, 'nWeeks > 0');
  eq(details.weekTimeline.length, details.nWeeks, 'timeline length = nWeeks');
});

test('C2: week with UC marked as hit', function () {
  var uc      = makeUC({ submit_date: '2026-06-09' }); // week 1 (Mon 2026-06-08)
  var details = SPTDScoring.computeUserDetails('testuser', [uc]);
  var hitWeeks = details.weekTimeline.filter(function (w) { return w.hit; });
  ok(hitWeeks.length >= 1, 'at least 1 week marked hit');
  eq(hitWeeks[0].ucCount, 1, 'ucCount = 1');
});

test('C3: weeks before UC submit are not hit', function () {
  var uc      = makeUC({ submit_date: '2026-06-16' }); // week 2 (Mon 2026-06-15)
  var details = SPTDScoring.computeUserDetails('testuser', [uc]);
  eq(details.weekTimeline[0].hit, false, 'week 0 (before submit) not hit');
});

test('C4: non-Approved UCs not included in user details', function () {
  var ucApproved  = makeUC({ usecase_id: 'A', record_id: 'r1', status: 'Approved' });
  var ucSubmitted = makeUC({ usecase_id: 'B', record_id: 'r2', status: 'Submitted' });
  var details     = SPTDScoring.computeUserDetails('testuser', [ucApproved, ucSubmitted]);
  eq(details.ucs.length, 1, 'only Approved UC returned');
});

test('C5: owner_name fallback works when owner_email missing', function () {
  var uc = makeUC({ owner_email: '', owner_name: 'testuser', submit_date: '2026-06-09' });
  var details = SPTDScoring.computeUserDetails('testuser', [uc]);
  eq(details.ucs.length, 1, 'matched via owner_name');
});

test('C6: timeline label format T1, T2, ...', function () {
  var details = SPTDScoring.computeUserDetails('testuser', [makeUC()]);
  eq(details.weekTimeline[0].label, 'T1', 'first week label = T1');
  eq(details.weekTimeline[1].label, 'T2', 'second week label = T2');
});

// ── Suite D: getRank thresholds ────────────────────────────────────
console.log('\nSuite D: getRank');

test('D1: score 80 = Xuất sắc', function () {
  eq(SPTDScoring.getRank(80).label, 'Xuất sắc');
});
test('D2: score 79.9 = Tốt', function () {
  eq(SPTDScoring.getRank(79.9).label, 'Tốt');
});
test('D3: score 65 = Tốt', function () {
  eq(SPTDScoring.getRank(65).label, 'Tốt');
});
test('D4: score 64.9 = Trung bình', function () {
  eq(SPTDScoring.getRank(64.9).label, 'Trung bình');
});
test('D5: score 45 = Trung bình', function () {
  eq(SPTDScoring.getRank(45).label, 'Trung bình');
});
test('D6: score 44.9 = Cần cải thiện', function () {
  eq(SPTDScoring.getRank(44.9).label, 'Cần cải thiện');
});
test('D7: score 0 = Cần cải thiện', function () {
  eq(SPTDScoring.getRank(0).label, 'Cần cải thiện');
});

// ── Suite E: duplicate-key merge (owner_email = display_name) ──────
console.log('\nSuite E: duplicate-key merge');

test('E1: UCs with owner_email=username and owner_email=display_name merge into one row', function () {
  var user = makeUser({ username: 'phuong', display_name: 'Nguyễn Phương' });
  var uc1  = makeUC({ usecase_id: 'A', record_id: 'r1', owner_email: 'phuong',        submit_date: '2026-06-09' });
  var uc2  = makeUC({ usecase_id: 'B', record_id: 'r2', owner_email: 'nguyễn phương', submit_date: '2026-06-16' });
  var res  = SPTDScoring.computeAllScores([uc1, uc2], [user]);
  eq(res.length, 1, 'merged into 1 row');
  eq(res[0].n_approved, 2, 'both UCs counted');
  eq(res[0].n_weeks_hit, 2, 'both weeks counted');
});

test('E2: no double-count when merging duplicate buckets', function () {
  var user = makeUser({ username: 'phuong', display_name: 'Nguyễn Phương' });
  var uc1  = makeUC({ usecase_id: 'A', record_id: 'r1', owner_email: 'phuong',        total_score: 80, submit_date: '2026-06-09' });
  var uc2  = makeUC({ usecase_id: 'B', record_id: 'r2', owner_email: 'nguyễn phương', total_score: 60, submit_date: '2026-06-16' });
  var res  = SPTDScoring.computeAllScores([uc1, uc2], [user]);
  eq(res[0].avg_quality, 70, 'avg_quality = (80+60)/2 = 70, no double-count');
});

// ── Suite F: milestone đã duyệt (v3.14.0) ──────────────────────────
console.log('\nSuite F: approved milestones feed quantity + weeks');

function makeMs(overrides) {
  return Object.assign({
    owner_email:     'testuser',
    owner_name:      'Test User',
    team:            'Team A',
    log_date:        '2026-06-16', // week 2
    approval_status: 'Approved'
  }, overrides);
}

test('F1: milestone cộng vào quantity + weeks nhưng KHÔNG đổi avg_quality', function () {
  var uc  = makeUC({ total_score: 80, submit_date: '2026-06-09' }); // week 1
  var ms  = makeMs({ log_date: '2026-06-16' });                     // week 2
  var res = SPTDScoring.computeAllScores([uc], [makeUser()], [ms]);
  eq(res[0].n_approved,  2, 'n_approved = 1 UC + 1 milestone');
  eq(res[0].n_weeks_hit, 2, 'week1 (UC) + week2 (milestone)');
  eq(res[0].avg_quality, 80, 'avg_quality vẫn = 80 (milestone không tính quality)');
});

test('F2: milestone Pending/Rejected bị bỏ qua', function () {
  var uc  = makeUC({ submit_date: '2026-06-09' });
  var res = SPTDScoring.computeAllScores([uc], [makeUser()], [
    makeMs({ approval_status: 'Pending'  }),
    makeMs({ approval_status: 'Rejected' })
  ]);
  eq(res[0].n_approved, 1, 'chỉ UC gốc, milestone chưa duyệt không tính');
});

test('F3: user chỉ có milestone (không UC Approved) vẫn có quantity + weeks, quality=0', function () {
  var user = makeUser({ username: 'msonly', display_name: 'Ms Only' });
  var ms   = makeMs({ owner_email: 'msonly', owner_name: 'Ms Only', log_date: '2026-06-16' });
  var res  = SPTDScoring.computeAllScores([], [user], [ms]);
  eq(res[0].n_approved,  1, 'quantity từ milestone');
  eq(res[0].n_weeks_hit, 1, 'week hit từ milestone');
  eq(res[0].avg_quality, 0, 'không có UC → quality avg = 0');
});

test('F4: nhiều milestone cùng tuần = 1 week hit (nhưng quantity cộng dồn)', function () {
  var uc  = makeUC({ submit_date: '2026-06-09' }); // week 1
  var res = SPTDScoring.computeAllScores([uc], [makeUser()], [
    makeMs({ log_date: '2026-06-16' }), // week 2
    makeMs({ log_date: '2026-06-17' })  // week 2 (cùng tuần)
  ]);
  eq(res[0].n_approved,  3, '1 UC + 2 milestone');
  eq(res[0].n_weeks_hit, 2, 'week1 + week2 (2 milestone cùng week2 = 1 hit)');
});

test('F5: computeUserDetails đánh dấu tuần milestone trên timeline', function () {
  var uc      = makeUC({ submit_date: '2026-06-09' }); // week 1
  var ms      = makeMs({ log_date: '2026-06-16' });    // week 2
  var details = SPTDScoring.computeUserDetails('testuser', [uc], [ms]);
  eq(details.weekTimeline[1].hit, true, 'week 2 (index 1) được đánh dấu hit do milestone');
});

// ── Summary ────────────────────────────────────────────────────────
console.log('\n────────────────────────────────');
console.log('Results: ' + passed + '/' + (passed + failed) + ' PASS' + (failed ? '  (' + failed + ' FAIL)' : ''));
if (failed) process.exit(1);
