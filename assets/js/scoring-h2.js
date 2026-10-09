// ─────────────────────────────────────────────────────────────────
// scoring-h2.js — Client mirror của ScoringServiceH2.gs (H2 Giai đoạn 3)
//
// Tính điểm xem trước (preview) cho UI chấm điểm + dùng chung cho unit test.
// PHẢI khớp công thức GAS: mọi tiêu chí nhập 0–10, quy đổi thang 100 qua trọng số.
//   - Điểm US (hội đồng):  Time_Saving 30% · Automation 40% · Creativity 30%
//   - Điểm cá nhân:        Diversity 30% · AI_Proficiency 20% · Product_Quality 30% · Quantity_Met 20%
//   - Điểm US cuối = BÌNH QUÂN Member_Score các thành viên đã chấm.
// ─────────────────────────────────────────────────────────────────

(function (root) {
  'use strict';

  var CRITERIA_MAX = 10;

  var UC_WEIGHTS = { TIME_SAVING: 0.30, AUTOMATION: 0.40, CREATIVITY: 0.30 };
  var PERSONAL_WEIGHTS = {
    DIVERSITY: 0.30, AI_PROFICIENCY: 0.20, PRODUCT_QUALITY: 0.30, QUANTITY_MET: 0.20
  };

  // KPI tổng hợp — khung D70 (2026-10-09). Nguồn chuẩn: GAS KpiEngineH2.gs + Config.gs (bản này chỉ để
  // xem trước trên UI). Member 40/30/15/15, từng chỉ tiêu + tổng trần 120; teamlead 40/30/20/10.
  var KPI_WEIGHTS = { UC: 0.40, CAPABILITY: 0.30, COURSES: 0.15, SHARING: 0.15 };
  var KPI_CAP = 120;
  var COURSE_PCT_EACH = 25;             // mỗi khóa 25% (trả phí x2)
  var M2_PCT_EACH = 10;                 // mỗi tuần có bài Đạt = 10% (10 bài = 100%)
  var MILESTONE_PENALTY_EACH = 2;       // −2%/mốc
  var MILESTONE_PENALTY_MAX  = 10;      // tối đa −10%
  var TEAMLEAD_WEIGHTS = { SELF: 0.40, TEAM: 0.30, BIG_TASK: 0.20, RD: 0.10 };
  var OKR = { FLOOR: 30, FULL: 70, MAX_RATIO: 100, FULL_SCORE: 100, MAX_SCORE: 120 };
  var KPI_PASS = 70;
  var PM_WEIGHTS = { A1: 0.30, A2: 0.20, A3: 0.30, A4: 0.20 };

  function safeNum(v) { var n = parseFloat(v); return isNaN(n) || n < 0 ? 0 : n; }
  function clamp(v) { var n = safeNum(v); return n > CRITERIA_MAX ? CRITERIA_MAX : n; }
  function round1(n) { return Math.round(n * 10) / 10; }

  // Điểm 1 thành viên hội đồng (0–100) từ 3 tiêu chí 0–10.
  function councilMemberScore(timeSaving, automation, creativity) {
    var raw = clamp(timeSaving) * UC_WEIGHTS.TIME_SAVING
            + clamp(automation) * UC_WEIGHTS.AUTOMATION
            + clamp(creativity) * UC_WEIGHTS.CREATIVITY;
    return round1((raw / CRITERIA_MAX) * 100);
  }

  // Điểm cá nhân (0–100) từ 4 tiêu chí 0–10.
  function personalFinalScore(diversity, aiProf, productQuality, quantityMet) {
    var raw = clamp(diversity)      * PERSONAL_WEIGHTS.DIVERSITY
            + clamp(aiProf)         * PERSONAL_WEIGHTS.AI_PROFICIENCY
            + clamp(productQuality) * PERSONAL_WEIGHTS.PRODUCT_QUALITY
            + clamp(quantityMet)    * PERSONAL_WEIGHTS.QUANTITY_MET;
    return round1((raw / CRITERIA_MAX) * 100);
  }

  // Bình quân các Member_Score (0–100).
  function councilAverage(memberScores) {
    var arr = (memberScores || []).map(safeNum);
    if (!arr.length) return 0;
    var sum = arr.reduce(function (s, v) { return s + v; }, 0);
    return round1(sum / arr.length);
  }

  // ── Điểm cá nhân THEO THÁNG (CR#1, 2026-08-26) ────────────────────
  // Kỳ H2: 08–12/2026 (nhãn 'Tháng MM/YYYY').
  var H2_PERIOD = { startY: 2026, startM: 8, endY: 2026, endM: 12 };

  function monthLabel(y, m) { return 'Tháng ' + (m < 10 ? '0' + m : '' + m) + '/' + y; }

  // Danh sách nhãn tháng trong kỳ H2 (dùng cho droplist).
  function h2Months() {
    var out = [];
    for (var y = H2_PERIOD.startY; y <= H2_PERIOD.endY; y++) {
      var mFrom = (y === H2_PERIOD.startY) ? H2_PERIOD.startM : 1;
      var mTo   = (y === H2_PERIOD.endY)   ? H2_PERIOD.endM   : 12;
      for (var m = mFrom; m <= mTo; m++) out.push(monthLabel(y, m));
    }
    return out;
  }

  // Nhãn tháng hiện tại nếu nằm trong kỳ, ngược lại tháng gần nhất trong kỳ.
  function currentH2Month() {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1;
    var cur = monthLabel(y, m), all = h2Months();
    if (all.indexOf(cur) !== -1) return cur;
    var k = y * 100 + m;
    if (k < H2_PERIOD.startY * 100 + H2_PERIOD.startM) return all[0];
    return all[all.length - 1];
  }

  // Điểm năng lực CUỐI KỲ (M-KPI-2) = TRUNG BÌNH điểm các tháng ĐÃ chấm (tháng trống bỏ qua).
  function personalPeriodAvg(monthlyFinals) {
    var arr = (monthlyFinals || []).map(safeNum);
    if (!arr.length) return 0;
    return round1(arr.reduce(function (s, v) { return s + v; }, 0) / arr.length);
  }

  // Rank theo thang 100 (khớp SCORE_THRESHOLDS + màu ScoringEngine cũ).
  function rankInfo(total) {
    var t = safeNum(total);
    if (t >= 85) return { key: 'TOP_PERFORMER',      label: 'Top Performer', color: '#7B2CBF' };
    if (t >= 70) return { key: 'STRONG_CONTRIBUTOR', label: 'Strong',        color: '#4CAF50' };
    if (t >= 50) return { key: 'AVERAGE',            label: 'Average',       color: '#F6B100' };
    return           { key: 'BOTTOM_PERFORMER',      label: 'Cần cải thiện', color: '#F44336' };
  }

  // ── KPI tổng hợp (Đợt 2) ────────────────────────────────────────

  // Thang OKR (D65): ratio = % đạt mục tiêu khát vọng → <30: 0 · 30–70: r/70 · 70–100: 100→120 · ≥100: 120.
  function okrScore(ratio) {
    if (ratio === null || ratio === undefined || ratio === '') return 0;
    var r = parseFloat(ratio);
    if (isNaN(r) || r < OKR.FLOOR) return 0;
    if (r < OKR.FULL) return r / OKR.FULL * OKR.FULL_SCORE;
    if (r < OKR.MAX_RATIO) return OKR.FULL_SCORE + (r - OKR.FULL) / (OKR.MAX_RATIO - OKR.FULL) * (OKR.MAX_SCORE - OKR.FULL_SCORE);
    return OKR.MAX_SCORE;
  }
  // % đạt 1 chỉ số việc lớn = (trước − thực tế) / (trước − mục tiêu), chặn 0..100; thiếu số → null.
  function krRatio(before, target, actual) {
    var b = parseFloat(before), t = parseFloat(target), a = parseFloat(actual);
    if (isNaN(b) || isNaN(t) || isNaN(a) || b === t) return null;
    return Math.max(0, Math.min(100, (b - a) / (b - t) * 100));
  }
  // M-KPI-1: 50% kết quả việc lớn team (thang OKR) + 50% hạng mục cá nhân đạt / được giao.
  function bigTaskScore(teamRatio, itemsPassed, itemsAssigned) {
    var personal = safeNum(itemsAssigned) ? safeNum(itemsPassed) / safeNum(itemsAssigned) * 100 : 0;
    return round1(Math.min(KPI_CAP, 0.5 * okrScore(teamRatio) + 0.5 * personal));
  }
  // M-KPI-2: số tuần (40→52) có bài Đạt × 10%, trần 120.
  function exerciseScore(passWeeks) { return Math.min(KPI_CAP, Math.max(0, Math.round(safeNum(passWeeks))) * M2_PCT_EACH); }
  // M-KPI-3: khóa hoàn thành + chứng chỉ (mỗi khóa 25%, trả phí x2), trần 120.
  function courseScore(completed, paid) {
    var c = Math.max(0, Math.round(safeNum(completed)));
    var p = Math.max(0, Math.round(safeNum(paid)));
    if (p > c) p = c;
    return Math.min(KPI_CAP, (c + p) * COURSE_PCT_EACH); // trả phí x2 = (c-p) + p*2 = c+p
  }
  // M-KPI-4: lan tỏa — số hoạt động đã duyệt: 0 → 0 · 1 → 100 · ≥2 → 120. (true/false cũ: đạt → 100.)
  function sharingScore(achieved) {
    if (typeof achieved === 'number') return achieved <= 0 ? 0 : (achieved === 1 ? 100 : KPI_CAP);
    if (achieved === true) return 100;
    var s = String(achieved).trim().toLowerCase();
    return (s === 'true' || s === '1' || s === 'yes' || s === 'x' || s === 'có') ? 100 : 0;
  }
  // Điểm trừ milestone chậm: −2%/mốc, tối đa −10%.
  function milestonePenalty(late) {
    var n = Math.max(0, Math.round(safeNum(late)));
    return Math.min(MILESTONE_PENALTY_MAX, n * MILESTONE_PENALTY_EACH);
  }
  // Member final = M1·0.40 + M2·0.30 + M3·0.15 + M4·0.15 − trừ (clamp 0..120 — D68).
  function memberKpiFinal(m1, m2, m3, m4, penalty) {
    var cap = function (v) { return Math.min(KPI_CAP, safeNum(v)); };
    var raw = cap(m1) * KPI_WEIGHTS.UC
            + cap(m2) * KPI_WEIGHTS.CAPABILITY
            + cap(m3) * KPI_WEIGHTS.COURSES
            + cap(m4) * KPI_WEIGHTS.SHARING
            - safeNum(penalty);
    return round1(Math.max(0, Math.min(KPI_CAP, raw)));
  }
  // Teamlead final = T1·0.40 + T2·0.30 + T3·0.20 + T4·0.10 (clamp 0..120) — D62.
  function teamleadKpiFinal(t1, t2, t3, t4) {
    var raw = safeNum(t1) * TEAMLEAD_WEIGHTS.SELF + safeNum(t2) * TEAMLEAD_WEIGHTS.TEAM
            + safeNum(t3) * TEAMLEAD_WEIGHTS.BIG_TASK + safeNum(t4) * TEAMLEAD_WEIGHTS.RD;
    return round1(Math.max(0, Math.min(KPI_CAP, raw)));
  }
  // PM final (bản A) = A1·0.30 + A2·0.20 + A3·0.30 + A4·0.20 (clamp 0..100).
  function pmKpiFinal(a1, a2, a3, a4) {
    var raw = safeNum(a1) * PM_WEIGHTS.A1 + safeNum(a2) * PM_WEIGHTS.A2
            + safeNum(a3) * PM_WEIGHTS.A3 + safeNum(a4) * PM_WEIGHTS.A4;
    return round1(Math.max(0, Math.min(100, raw)));
  }

  var ScoringH2 = {
    CRITERIA_MAX:       CRITERIA_MAX,
    UC_WEIGHTS:         UC_WEIGHTS,
    PERSONAL_WEIGHTS:   PERSONAL_WEIGHTS,
    KPI_WEIGHTS:        KPI_WEIGHTS,
    TEAMLEAD_WEIGHTS:   TEAMLEAD_WEIGHTS,
    PM_WEIGHTS:         PM_WEIGHTS,
    KPI_PASS:           KPI_PASS,
    KPI_CAP:            KPI_CAP,
    okrScore:           okrScore,
    krRatio:            krRatio,
    bigTaskScore:       bigTaskScore,
    exerciseScore:      exerciseScore,
    councilMemberScore: councilMemberScore,
    personalFinalScore: personalFinalScore,
    councilAverage:     councilAverage,
    h2Months:           h2Months,
    currentH2Month:     currentH2Month,
    personalPeriodAvg:  personalPeriodAvg,
    courseScore:        courseScore,
    sharingScore:       sharingScore,
    milestonePenalty:   milestonePenalty,
    memberKpiFinal:     memberKpiFinal,
    teamleadKpiFinal:   teamleadKpiFinal,
    pmKpiFinal:         pmKpiFinal,
    rankInfo:           rankInfo
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ScoringH2;
  else root.ScoringH2 = ScoringH2;

})(typeof window !== 'undefined' ? window : this);
