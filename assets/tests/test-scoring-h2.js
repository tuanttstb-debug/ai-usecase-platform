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

console.log('\n── ScoringH2: M-KPI-3 khóa học (25%/khóa, trả phí x2, cap 100) ──');
test('4 khóa thường → 100', function () { eq(ScoringH2.courseScore(4, 0), 100); });
test('0 khóa → 0', function () { eq(ScoringH2.courseScore(0, 0), 0); });
test('2 khóa thường → 50', function () { eq(ScoringH2.courseScore(2, 0), 50); });
test('2 khóa đều trả phí → 100 (x2)', function () { eq(ScoringH2.courseScore(2, 2), 100); });
test('1 khóa trả phí → 50', function () { eq(ScoringH2.courseScore(1, 1), 50); });
test('3 khóa thường → 75', function () { eq(ScoringH2.courseScore(3, 0), 75); });
test('5 khóa → cap 100', function () { eq(ScoringH2.courseScore(5, 0), 100); });
test('paid > completed → clamp về completed', function () { eq(ScoringH2.courseScore(2, 3), 100); });

console.log('\n── ScoringH2: M-KPI-4 lan tỏa (đạt→100) ──');
test('true → 100', function () { eq(ScoringH2.sharingScore(true), 100); });
test('false → 0', function () { eq(ScoringH2.sharingScore(false), 0); });
test('"true" → 100', function () { eq(ScoringH2.sharingScore('true'), 100); });
test('rỗng → 0', function () { eq(ScoringH2.sharingScore(''), 0); });

console.log('\n── ScoringH2: Điểm trừ milestone (−2%/mốc, cap −10%) ──');
test('0 chậm → 0', function () { eq(ScoringH2.milestonePenalty(0), 0); });
test('1 chậm → 2', function () { eq(ScoringH2.milestonePenalty(1), 2); });
test('3 chậm → 6', function () { eq(ScoringH2.milestonePenalty(3), 6); });
test('5 chậm → 10', function () { eq(ScoringH2.milestonePenalty(5), 10); });
test('6 chậm → cap 10', function () { eq(ScoringH2.milestonePenalty(6), 10); });

console.log('\n── ScoringH2: Member KPI tổng hợp (M1·.4 M2·.3 M3·.15 M4·.15 − trừ) ──');
test('Cả 4 = 100, không trừ → 100', function () { eq(ScoringH2.memberKpiFinal(100,100,100,100,0), 100); });
test('Tất cả 0 → 0', function () { eq(ScoringH2.memberKpiFinal(0,0,0,0,0), 0); });
test('Chỉ M1=100 → 40', function () { eq(ScoringH2.memberKpiFinal(100,0,0,0,0), 40); });
test('Chỉ M2=100 → 30', function () { eq(ScoringH2.memberKpiFinal(0,100,0,0,0), 30); });
test('Chỉ M3=100 → 15', function () { eq(ScoringH2.memberKpiFinal(0,0,100,0,0), 15); });
test('Chỉ M4=100 → 15', function () { eq(ScoringH2.memberKpiFinal(0,0,0,100,0), 15); });
test('Cả 4 = 100, trừ 10 → 90', function () { eq(ScoringH2.memberKpiFinal(100,100,100,100,10), 90); });
test('Tổng 4 trọng số = 100', function () {
  var s = ScoringH2.memberKpiFinal(100,0,0,0,0) + ScoringH2.memberKpiFinal(0,100,0,0,0) +
          ScoringH2.memberKpiFinal(0,0,100,0,0) + ScoringH2.memberKpiFinal(0,0,0,100,0);
  eq(s, 100);
});
test('Trừ không cho âm (clamp 0)', function () { eq(ScoringH2.memberKpiFinal(0,0,0,0,10), 0); });

console.log('\n── ScoringH2: Teamlead KPI (T1·.6 + T2·.4) ──');
test('T1=100 T2=100 → 100', function () { eq(ScoringH2.teamleadKpiFinal(100,100), 100); });
test('Chỉ T1=100 → 60', function () { eq(ScoringH2.teamleadKpiFinal(100,0), 60); });
test('Chỉ T2=100 → 40', function () { eq(ScoringH2.teamleadKpiFinal(0,100), 40); });
test('T1=80 T2=50 → 68', function () { eq(ScoringH2.teamleadKpiFinal(80,50), 68); });

console.log('\n── ScoringH2: PM KPI bản A (A1·.3 A2·.2 A3·.3 A4·.2) ──');
test('Cả 4 = 100 → 100', function () { eq(ScoringH2.pmKpiFinal(100,100,100,100), 100); });
test('Chỉ A1=100 → 30', function () { eq(ScoringH2.pmKpiFinal(100,0,0,0), 30); });
test('Chỉ A2=100 → 20', function () { eq(ScoringH2.pmKpiFinal(0,100,0,0), 20); });
test('Chỉ A3=100 → 30', function () { eq(ScoringH2.pmKpiFinal(0,0,100,0), 30); });
test('Chỉ A4=100 → 20', function () { eq(ScoringH2.pmKpiFinal(0,0,0,100), 20); });

console.log('\n── ScoringH2: Điểm cá nhân THEO THÁNG (CR#1) ──');
test('personalPeriodAvg [80] → 80', function () { eq(ScoringH2.personalPeriodAvg([80]), 80); });
test('personalPeriodAvg [60,80] → 70', function () { eq(ScoringH2.personalPeriodAvg([60, 80]), 70); });
test('personalPeriodAvg [90,60,30] → 60', function () { eq(ScoringH2.personalPeriodAvg([90, 60, 30]), 60); });
test('personalPeriodAvg rỗng (chưa tháng nào) → 0', function () { eq(ScoringH2.personalPeriodAvg([]), 0); });
test('personalPeriodAvg 1 chữ số thập phân [70,80,90,55] → 73.8', function () {
  eq(ScoringH2.personalPeriodAvg([70, 80, 90, 55]), 73.8);
});
test('h2Months = 5 tháng (08→12/2026)', function () { eq(ScoringH2.h2Months().length, 5); });
test('h2Months[0] = Tháng 08/2026', function () { eq(ScoringH2.h2Months()[0], 'Tháng 08/2026'); });
test('h2Months cuối = Tháng 12/2026', function () { eq(ScoringH2.h2Months()[4], 'Tháng 12/2026'); });
test('currentH2Month nằm trong danh sách kỳ', function () {
  var c = ScoringH2.currentH2Month();
  if (ScoringH2.h2Months().indexOf(c) === -1) throw new Error('currentH2Month "' + c + '" ngoài kỳ');
});

console.log('\n────────────────────────────────────────');
console.log('  ' + passed + ' passed, ' + failed + ' failed');
console.log('────────────────────────────────────────\n');
process.exit(failed > 0 ? 1 : 0);
