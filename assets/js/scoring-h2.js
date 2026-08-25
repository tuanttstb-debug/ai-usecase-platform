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

  var ScoringH2 = {
    CRITERIA_MAX:       CRITERIA_MAX,
    UC_WEIGHTS:         UC_WEIGHTS,
    PERSONAL_WEIGHTS:   PERSONAL_WEIGHTS,
    councilMemberScore: councilMemberScore,
    personalFinalScore: personalFinalScore,
    councilAverage:     councilAverage,
    rankInfo:           rankInfo
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ScoringH2;
  else root.ScoringH2 = ScoringH2;

})(typeof window !== 'undefined' ? window : this);
