/* ─────────────────────────────────────────────────────────────────
   test-scoring-h2.js — Unit tests cho ScoringH2 (H2 Giai đoạn 3)
   Run: node assets/tests/test-scoring-h2.js

   Kiểm tra công thức chấm điểm mới:
     - Điểm US (hội đồng): 3 tiêu chí 0–10, trọng số 30/40/30 → 0–100.
     - Điểm US cuối = bình quân Member_Score.
     - Điểm cá nhân: 4 tiêu chí 0–10, trọng số 30/20/30/20 → 0–100.
     - Rank theo ngưỡng 85/70/50.
   ───────────────────────────────────────────────────────────────── */

var ScoringH2 = require('../../assets/js/scoring-h2.js');

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  PASS  ' + name); passed++; }
  catch (e) { console.error('  FAIL  ' + name + '\n        ' + e.message); failed++; }
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || '') + ' — expected ' + expected + ', got ' + actual);
}

console.log('\n── ScoringH2: Điểm US (hội đồng) — 30/40/30 ──');

test('Cả 3 tiêu chí max (10/10/10) → 100', function () {
  eq(ScoringH2.councilMemberScore(10, 10, 10), 100);
});
test('Cả 3 tiêu chí 0 → 0', function () {
  eq(ScoringH2.councilMemberScore(0, 0, 0), 0);
});
test('Chỉ Tiết kiệm thời gian (10,0,0) → 30 (trọng số 30%)', function () {
  eq(ScoringH2.councilMemberScore(10, 0, 0), 30);
});
test('Chỉ Tự động hóa (0,10,0) → 40 (trọng số 40%)', function () {
  eq(ScoringH2.councilMemberScore(0, 10, 0), 40);
});
test('Chỉ Sáng tạo (0,0,10) → 30 (trọng số 30%)', function () {
  eq(ScoringH2.councilMemberScore(0, 0, 10), 30);
});
test('Đồng đều 5/5/5 → 50', function () {
  eq(ScoringH2.councilMemberScore(5, 5, 5), 50);
});
test('Hỗn hợp 8/6/4 → 60 (2.4+2.4+1.2=6.0 → 60)', function () {
  eq(ScoringH2.councilMemberScore(8, 6, 4), 60);
});
test('Clamp: tiêu chí >10 bị chặn về 10', function () {
  eq(ScoringH2.councilMemberScore(20, 10, 10), 100);
});
test('Clamp: tiêu chí âm về 0', function () {
  eq(ScoringH2.councilMemberScore(-5, 0, 0), 0);
});

console.log('\n── ScoringH2: Điểm US cuối = bình quân hội đồng ──');

test('Bình quân [100, 50] → 75', function () {
  eq(ScoringH2.councilAverage([100, 50]), 75);
});
test('Bình quân rỗng → 0', function () {
  eq(ScoringH2.councilAverage([]), 0);
});
test('Bình quân 1 người [80] → 80', function () {
  eq(ScoringH2.councilAverage([80]), 80);
});
test('Bình quân 4 người [100,90,80,70] → 85', function () {
  eq(ScoringH2.councilAverage([100, 90, 80, 70]), 85);
});

console.log('\n── ScoringH2: Điểm cá nhân — 30/20/30/20 ──');

test('Cả 4 max (10/10/10/10) → 100', function () {
  eq(ScoringH2.personalFinalScore(10, 10, 10, 10), 100);
});
test('Chỉ Đa dạng (10,0,0,0) → 30', function () {
  eq(ScoringH2.personalFinalScore(10, 0, 0, 0), 30);
});
test('Chỉ Thành thạo AI (0,10,0,0) → 20', function () {
  eq(ScoringH2.personalFinalScore(0, 10, 0, 0), 20);
});
test('Chỉ Chất lượng SP (0,0,10,0) → 30', function () {
  eq(ScoringH2.personalFinalScore(0, 0, 10, 0), 30);
});
test('Chỉ Số lượng đủ (0,0,0,10) → 20', function () {
  eq(ScoringH2.personalFinalScore(0, 0, 0, 10), 20);
});
test('Đồng đều 5/5/5/5 → 50', function () {
  eq(ScoringH2.personalFinalScore(5, 5, 5, 5), 50);
});
test('Trọng số cộng đúng 100% (max mỗi tiêu chí riêng cộng lại)', function () {
  var sum = ScoringH2.personalFinalScore(10,0,0,0) + ScoringH2.personalFinalScore(0,10,0,0) +
            ScoringH2.personalFinalScore(0,0,10,0) + ScoringH2.personalFinalScore(0,0,0,10);
  eq(sum, 100, 'tổng 4 trọng số quy về 100');
});

console.log('\n── ScoringH2: Rank theo ngưỡng 85/70/50 ──');

test('85 → TOP_PERFORMER', function () { eq(ScoringH2.rankInfo(85).key, 'TOP_PERFORMER'); });
test('84.9 → STRONG_CONTRIBUTOR', function () { eq(ScoringH2.rankInfo(84.9).key, 'STRONG_CONTRIBUTOR'); });
test('70 → STRONG_CONTRIBUTOR', function () { eq(ScoringH2.rankInfo(70).key, 'STRONG_CONTRIBUTOR'); });
test('69.9 → AVERAGE', function () { eq(ScoringH2.rankInfo(69.9).key, 'AVERAGE'); });
test('50 → AVERAGE', function () { eq(ScoringH2.rankInfo(50).key, 'AVERAGE'); });
test('49.9 → BOTTOM_PERFORMER', function () { eq(ScoringH2.rankInfo(49.9).key, 'BOTTOM_PERFORMER'); });
test('0 → BOTTOM_PERFORMER', function () { eq(ScoringH2.rankInfo(0).key, 'BOTTOM_PERFORMER'); });

console.log('\n────────────────────────────────────────');
console.log('  ' + passed + ' passed, ' + failed + ' failed');
console.log('────────────────────────────────────────\n');
process.exit(failed > 0 ? 1 : 0);
