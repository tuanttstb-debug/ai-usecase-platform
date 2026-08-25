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

  // KPI tổng hợp (Đợt 2)
  var KPI_WEIGHTS = { UC: 0.40, CAPABILITY: 0.30, COURSES: 0.15, SHARING: 0.15 };
  var COURSE_PCT_EACH = 25;             // mỗi khóa 25% (trả phí x2)
  var MILESTONE_PENALTY_EACH = 2;       // −2%/mốc
  var MILESTONE_PENALTY_MAX  = 10;      // tối đa −10%
  var TEAMLEAD_WEIGHTS = { SELF: 0.60, TEAM: 0.40 };
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

  // Rank theo thang 100 (khớp SCORE_THRESHOLDS + màu ScoringEngine cũ).
  function rankInfo(total) {
    var t = safeNum(total);
    if (t >= 85) return { key: 'TOP_PERFORMER',      label: 'Top Performer', color: '#7B2CBF' };
    if (t >= 70) return { key: 'STRONG_CONTRIBUTOR', label: 'Strong',        color: '#4CAF50' };
    if (t >= 50) return { key: 'AVERAGE',            label: 'Average',       color: '#F6B100' };
    return           { key: 'BOTTOM_PERFORMER',      label: 'Cần cải thiện', color: '#F44336' };
  }

  // ── KPI tổng hợp (Đợt 2) ────────────────────────────────────────

  // M-KPI-3: khóa học (mỗi khóa 25%, trả phí x2, tối đa 100%).
  function courseScore(completed, paid) {
    var c = Math.max(0, Math.round(safeNum(completed)));
    var p = Math.max(0, Math.round(safeNum(paid)));
    if (p > c) p = c;
    return Math.min(100, (c + p) * COURSE_PCT_EACH); // trả phí x2 = (c-p) + p*2 = c+p
  }
  // M-KPI-4: lan tỏa đạt → 100, không → 0.
  function sharingScore(achieved) {
    if (achieved === true) return 100;
    var s = String(achieved).trim().toLowerCase();
    return (s === 'true' || s === '1' || s === 'yes' || s === 'x' || s === 'có') ? 100 : 0;
  }
  // Điểm trừ milestone chậm: −2%/mốc, tối đa −10%.
  function milestonePenalty(late) {
    var n = Math.max(0, Math.round(safeNum(late)));
    return Math.min(MILESTONE_PENALTY_MAX, n * MILESTONE_PENALTY_EACH);
  }
  // Member final = M1·0.40 + M2·0.30 + M3·0.15 + M4·0.15 − trừ (clamp 0..100).
  function memberKpiFinal(m1, m2, m3, m4, penalty) {
    var raw = safeNum(m1) * KPI_WEIGHTS.UC
            + safeNum(m2) * KPI_WEIGHTS.CAPABILITY
            + safeNum(m3) * KPI_WEIGHTS.COURSES
            + safeNum(m4) * KPI_WEIGHTS.SHARING
            - safeNum(penalty);
    return round1(Math.max(0, Math.min(100, raw)));
  }
  // Teamlead final = T1·0.60 + T2·0.40 (clamp 0..100).
  function teamleadKpiFinal(t1, t2) {
    var raw = safeNum(t1) * TEAMLEAD_WEIGHTS.SELF + safeNum(t2) * TEAMLEAD_WEIGHTS.TEAM;
    return round1(Math.max(0, Math.min(100, raw)));
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
    councilMemberScore: councilMemberScore,
    personalFinalScore: personalFinalScore,
    councilAverage:     councilAverage,
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
