// scoring.js — Client-side mirror of ScoringEngine.gs
// Returns live score breakdown for wizard preview and explore display.

var ScoringEngine = (function () {
  'use strict';

  function safeNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  function calcEfficiency(uc) {
    var before = safeNum(uc.Before_Time_Min), after = safeNum(uc.After_Time_Min);
    if (before <= 0) return 0;
    return Math.round(Math.max(0, Math.min(1, (before - after) / before)) * 20);
  }

  function calcAdoption(uc) {
    var u = safeNum(uc.Active_User_Count);
    if (u >= 20) return 20;
    if (u >= 6)  return 15;
    if (u >= 2)  return 10;
    if (u === 1) return 5;
    return 0;
  }

  function calcReuse(uc) {
    var l = String(uc.Reuse_Level || '').toLowerCase();
    if (l.indexOf('toàn') !== -1 || l.indexOf('center') !== -1 || l.indexOf('tt sptd') !== -1) return 20;
    if (l.indexOf('cross') !== -1 || l.indexOf('liên team') !== -1 || l.indexOf('khác') !== -1) return 15;
    if (l.indexOf('team') !== -1) return 10;
    if (l.indexOf('cá nhân') !== -1 || l.indexOf('personal') !== -1) return 5;
    if (safeNum(uc.Reuse_Count) > 0) return 5;
    return 0;
  }

  function calcFrequency(uc) {
    var m = safeNum(uc.Monthly_Usage_Count);
    if (m === 0) {
      var hasDemo   = uc.Demo_Status && uc.Demo_Status !== 'Chưa có';
      var userCount = safeNum(uc.Active_User_Count);
      if (userCount >= 10 && hasDemo) return 8;
      if (userCount >= 1  && hasDemo) return 2;
      return 0;
    }
    if (m >= 20) return 15;
    if (m >= 4)  return 8;
    if (m >= 1)  return 2;
    return 0;
  }

  function calcDocumentation(uc) {
    var s = 0;
    if (uc.Prompt_Role || uc.Prompt_Task || uc.Prompt_Goal || uc.Prompt_Steps || uc.Prompt_Output_Format) s += 2;
    if (uc.When_To_Use || uc.Usage_Steps || uc.Usage_Notes) s += 1;
    if (uc.Demo_Status && uc.Demo_Status !== 'Chưa có') s += 1;
    if (uc.Flow_Description && String(uc.Flow_Description).length > 50) s += 1;
    return Math.min(s, 5);
  }

  function getRankInfo(total) {
    if (total >= 85) return { key: 'TOP_PERFORMER',     label: 'Top Performer', color: '#7B2CBF' };
    if (total >= 70) return { key: 'STRONG_CONTRIBUTOR', label: 'Strong',        color: '#4CAF50' };
    if (total >= 50) return { key: 'AVERAGE',            label: 'Average',       color: '#F6B100' };
    return           { key: 'BOTTOM_PERFORMER',          label: 'Cần cải thiện', color: '#F44336' };
  }

  return {
    compute: function (uc) {
      var e = calcEfficiency(uc),
          a = calcAdoption(uc),
          r = calcReuse(uc),
          f = calcFrequency(uc),
          d = calcDocumentation(uc);
      var autoTotal = Math.min(e + a + r + f + d, 70);

      var q   = Math.min(10, Math.max(0, safeNum(uc.Quality_Score)));
      var bv  = Math.min(10, Math.max(0, safeNum(uc.Business_Value_Score)));
      var inn = Math.min(10, Math.max(0, safeNum(uc.Innovation_Score)));
      var manualTotal = q + bv + inn;

      var total = autoTotal + manualTotal;
      return {
        efficiency: e, adoption: a, reuse: r, frequency: f, documentation: d,
        auto_total: autoTotal,
        quality: q, business_value: bv, innovation: inn,
        manual_total: manualTotal,
        total: total,
        rank: getRankInfo(total)
      };
    },

    getRankInfo: getRankInfo
  };
})();
