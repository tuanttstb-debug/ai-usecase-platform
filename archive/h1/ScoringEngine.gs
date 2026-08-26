// ─────────────────────────────────────────────────────────────────
// ScoringEngine.gs — Tự động tính điểm AI Use Case
//
// Mô hình 100 điểm:
//   70 điểm AUTO  — hệ thống tự tính
//   30 điểm MANUAL — reviewer nhập
//
// AUTO SCORE (70pt):
//   Efficiency Score    : (before-after)/before × 20   → max 20
//   Adoption Score      : theo Active_User_Count        → max 20
//   Reuse Score         : theo Reuse_Level              → max 20
//   Frequency Score     : theo Monthly_Usage_Count      → max 15
//   Documentation Score : kiểm tra prompt+guide+demo    → max 5
//
// MANUAL SCORE (30pt):
//   Quality Score       : reviewer nhập 0-10
//   Business Value Score: reviewer nhập 0-10
//   Innovation Score    : reviewer nhập 0-10
// ─────────────────────────────────────────────────────────────────

/**
 * Tính toán toàn bộ auto score cho một use case object.
 * @param {Object} uc - Use case data object
 * @returns {Object} { efficiency_score, adoption_score_calc, reuse_score,
 *                     frequency_score, documentation_score, auto_score }
 */
function computeAutoScore_(uc) {
  var efficiency    = calcEfficiencyScore_(uc);
  var adoption      = calcAdoptionScore_(uc);
  var reuse         = calcReuseScore_(uc);
  var frequency     = calcFrequencyScore_(uc);
  var documentation = calcDocumentationScore_(uc);

  var autoTotal = efficiency + adoption + reuse + frequency + documentation;

  return {
    efficiency_score:    efficiency,
    adoption_score_calc: adoption,
    reuse_score:         reuse,
    frequency_score:     frequency,
    documentation_score: documentation,
    auto_score:          Math.min(autoTotal, 70) // cap tại 70
  };
}

/**
 * Tính điểm hiệu quả thời gian.
 * Công thức: (Before_Time_Min - After_Time_Min) / Before_Time_Min × 20
 * Tối đa 20 điểm.
 */
function calcEfficiencyScore_(uc) {
  var before = safeNum_(uc.Before_Time_Min);
  var after  = safeNum_(uc.After_Time_Min);

  if (before <= 0) return 0; // Không có dữ liệu trước → 0

  var ratio = (before - after) / before;
  ratio = Math.max(0, Math.min(1, ratio)); // clamp [0,1]
  return Math.round(ratio * SCORE_WEIGHTS.EFFICIENCY_MAX);
}

/**
 * Tính điểm adoption dựa theo số người dùng thực tế.
 * 1 user → 5pt | 2-5 → 10pt | 6-20 → 15pt | 20+ → 20pt
 */
function calcAdoptionScore_(uc) {
  var users = safeNum_(uc.Active_User_Count);
  if (users >= 20) return 20;
  if (users >= 6)  return 15;
  if (users >= 2)  return 10;
  if (users === 1) return 5;
  return 0;
}

/**
 * Tính điểm reuse dựa theo phạm vi tái sử dụng.
 * Cá nhân → 5 | Cùng team → 10 | Cross-team → 15 | Toàn TT → 20
 */
function calcReuseScore_(uc) {
  var level = String(uc.Reuse_Level || '').toLowerCase();

  // Map multiple Vietnamese phrasings → score
  if (level.indexOf('toàn') !== -1 || level.indexOf('center') !== -1 ||
      level.indexOf('tt sptd') !== -1 || level.indexOf('toàn tt') !== -1) {
    return 20;
  }
  if (level.indexOf('cross') !== -1 || level.indexOf('team khác') !== -1 ||
      level.indexOf('liên team') !== -1 || level.indexOf('khác') !== -1) {
    return 15;
  }
  if (level.indexOf('team') !== -1 || level.indexOf('cùng team') !== -1 ||
      level.indexOf('nội bộ team') !== -1) {
    return 10;
  }
  if (level.indexOf('cá nhân') !== -1 || level.indexOf('personal') !== -1) {
    return 5;
  }
  // Nếu có Reuse_Count hoặc Cross_Team_Flag → ít nhất 5
  if (safeNum_(uc.Reuse_Count) > 0) return 5;
  return 0;
}

/**
 * Tính điểm tần suất sử dụng hàng tháng.
 * Hiếm (<4 lần/tháng) → 2 | Hàng tuần (4-19) → 8 | Hàng ngày (20+) → 15
 */
function calcFrequencyScore_(uc) {
  // Ưu tiên Monthly_Usage_Count (tracking thực tế); fallback sang field cũ
  var monthly = safeNum_(uc.Monthly_Usage_Count);

  if (monthly === 0) {
    // Không có dữ liệu tracking → suy ra từ Active_User_Count + Demo_Status
    var hasDemo   = uc.Demo_Status && uc.Demo_Status !== 'Chưa có';
    var userCount = safeNum_(uc.Active_User_Count);
    if (userCount >= 10 && hasDemo) return 8;  // Estimate hàng tuần
    if (userCount >= 1  && hasDemo) return 2;  // Estimate hiếm
    return 0;
  }

  if (monthly >= 20) return 15;
  if (monthly >= 4)  return 8;
  if (monthly >= 1)  return 2;
  return 0;
}

/**
 * Tính điểm tài liệu hóa.
 * Kiểm tra 4 thành phần: prompt (2pt), guide (1pt), demo (1pt), examples (1pt)
 * Tổng tối đa 5 điểm.
 */
function calcDocumentationScore_(uc) {
  var score = 0;

  // 1. Prompt (2pt) — ít nhất 1 trong các prompt fields được điền
  var hasPrompt = (uc.Prompt_Role || uc.Prompt_Task || uc.Prompt_Goal ||
                   uc.Prompt_Steps || uc.Prompt_Output_Format);
  if (hasPrompt) score += 2;

  // 2. Usage guide (1pt)
  var hasGuide = (uc.When_To_Use || uc.Usage_Steps || uc.Usage_Notes);
  if (hasGuide) score += 1;

  // 3. Demo (1pt)
  var hasDemo = uc.Demo_Status && uc.Demo_Status !== 'Chưa có';
  if (hasDemo) score += 1;

  // 4. Examples / Flow description (1pt) — đủ chi tiết
  var hasExamples = (uc.Flow_Description && String(uc.Flow_Description).length > 50);
  if (hasExamples) score += 1;

  return Math.min(score, SCORE_WEIGHTS.DOCUMENTATION_MAX);
}

/**
 * Tính manual score từ các trường reviewer đã nhập.
 * @returns {Object} { quality_score, business_value_score, innovation_score, manual_score }
 */
function computeManualScore_(uc) {
  var quality   = Math.min(10, Math.max(0, safeNum_(uc.Quality_Score)));
  var business  = Math.min(10, Math.max(0, safeNum_(uc.Business_Value_Score)));
  var innovation= Math.min(10, Math.max(0, safeNum_(uc.Innovation_Score)));

  return {
    quality_score:        quality,
    business_value_score: business,
    innovation_score:     innovation,
    manual_score:         quality + business + innovation
  };
}

/**
 * Tính tổng điểm và xác định Rank_Category.
 * @param {Object} uc - Use case object (đã có hoặc chưa có scoring fields)
 * @returns {Object} Complete scoring result với tất cả fields
 */
function scoreUseCase_(uc) {
  var autoResult   = computeAutoScore_(uc);
  var manualResult = computeManualScore_(uc);

  var totalScore = autoResult.auto_score + manualResult.manual_score;
  var rankCategory = getRankCategory_(totalScore);

  return {
    Efficiency_Score:    autoResult.efficiency_score,
    Adoption_Score_Calc: autoResult.adoption_score_calc,
    Reuse_Score:         autoResult.reuse_score,
    Frequency_Score:     autoResult.frequency_score,
    Documentation_Score: autoResult.documentation_score,
    Auto_Score:          autoResult.auto_score,
    Business_Value_Score: manualResult.business_value_score,
    Quality_Score:       manualResult.quality_score,
    Innovation_Score:    manualResult.innovation_score,
    Manual_Score:        manualResult.manual_score,
    Total_Score:         totalScore,
    Rank_Category:       rankCategory,
    Score_Updated_At:    new Date().toISOString()
  };
}

/**
 * Xác định Rank_Category từ tổng điểm.
 * 85-100 → TOP_PERFORMER
 * 70-84  → STRONG_CONTRIBUTOR
 * 50-69  → AVERAGE
 * <50    → BOTTOM_PERFORMER
 */
function getRankCategory_(totalScore) {
  if (totalScore >= SCORE_THRESHOLDS.TOP)    return RANK.TOP;
  if (totalScore >= SCORE_THRESHOLDS.STRONG) return RANK.STRONG;
  if (totalScore >= SCORE_THRESHOLDS.AVERAGE)return RANK.AVERAGE;
  return RANK.BOTTOM;
}

/**
 * Tái tính điểm tất cả use cases trong MASTER_DATA.
 * Dùng để batch recalculate khi thay đổi scoring algorithm.
 * @returns {Object} { updated_count, errors }
 */
function recalculateAllScores_() {
  var all = readSheetAsObjects_(SHEETS.MASTER);
  var updated = 0;
  var errors  = [];

  all.forEach(function(uc) {
    try {
      var scores = scoreUseCase_(uc);
      // Chỉ cập nhật scoring fields — không chạm các fields khác
      var updateData = {};
      updateData.Record_ID = uc.Record_ID;
      Object.keys(scores).forEach(function(k) { updateData[k] = scores[k]; });
      updateRowByRecordId_(SHEETS.MASTER, uc.Record_ID, updateData);
      updated++;
    } catch (e) {
      errors.push({ id: uc.Record_ID, error: e.message });
    }
  });

  return { updated_count: updated, total: all.length, errors: errors };
}

/**
 * Tính ranking trong từng nhóm (category + center level).
 * Ghi Department_Ranking, Center_Ranking, Category_Ranking vào từng record.
 */
function recalculateRankings_() {
  var all = readSheetAsObjects_(SHEETS.MASTER);

  // Sắp xếp toàn trung tâm theo Total_Score giảm dần
  var sorted = all.slice().sort(function(a, b) {
    return safeNum_(b.Total_Score) - safeNum_(a.Total_Score);
  });

  // Gán Center_Ranking
  var centerRankMap = {};
  sorted.forEach(function(uc, idx) {
    centerRankMap[uc.Record_ID] = idx + 1;
  });

  // Tính Department_Ranking theo Team
  var teamGroups = {};
  all.forEach(function(uc) {
    var team = uc.Team || 'Unknown';
    if (!teamGroups[team]) teamGroups[team] = [];
    teamGroups[team].push(uc);
  });
  var deptRankMap = {};
  Object.keys(teamGroups).forEach(function(team) {
    teamGroups[team]
      .sort(function(a, b) { return safeNum_(b.Total_Score) - safeNum_(a.Total_Score); })
      .forEach(function(uc, idx) { deptRankMap[uc.Record_ID] = idx + 1; });
  });

  // Tính Category_Ranking theo UseCase_Category
  var catGroups = {};
  all.forEach(function(uc) {
    var cat = uc.UseCase_Category || 'UNCATEGORIZED';
    if (!catGroups[cat]) catGroups[cat] = [];
    catGroups[cat].push(uc);
  });
  var catRankMap = {};
  Object.keys(catGroups).forEach(function(cat) {
    catGroups[cat]
      .sort(function(a, b) { return safeNum_(b.Total_Score) - safeNum_(a.Total_Score); })
      .forEach(function(uc, idx) { catRankMap[uc.Record_ID] = idx + 1; });
  });

  // Xác định Reward_Eligible và Warning_Flag
  var totalCount = all.length;
  var rewardCutoff = Math.ceil(totalCount * 0.2); // Top 20%
  var warnCutoff   = Math.floor(totalCount * 0.9); // Bottom 10%

  var updated = 0;
  all.forEach(function(uc) {
    try {
      var cRank = centerRankMap[uc.Record_ID] || 0;
      var updateData = {
        Record_ID:         uc.Record_ID,
        Center_Ranking:    cRank,
        Department_Ranking:deptRankMap[uc.Record_ID] || 0,
        Category_Ranking:  catRankMap[uc.Record_ID]  || 0,
        Reward_Eligible:   (cRank > 0 && cRank <= rewardCutoff) ? 'TRUE' : 'FALSE',
        Warning_Flag:      (cRank > warnCutoff) ? 'TRUE' : 'FALSE'
      };
      updateRowByRecordId_(SHEETS.MASTER, uc.Record_ID, updateData);
      updated++;
    } catch (e) {
      logError_('recalculateRankings_', e, { id: uc.Record_ID });
    }
  });

  return { updated_count: updated, total: all.length };
}
