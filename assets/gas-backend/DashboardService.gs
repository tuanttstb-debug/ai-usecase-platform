// ─────────────────────────────────────────────────────────────────
// DashboardService.gs — Tổng hợp metrics và caching dashboard
// ─────────────────────────────────────────────────────────────────

/**
 * Lấy summary dashboard.
 * - Đọc từ DASHBOARD_READY nếu cache còn mới (< CACHE_TTL_MINUTES).
 * - Nếu cache cũ hoặc không có → tính lại từ MASTER_DATA và ghi cache.
 * @returns {Object} Dashboard summary data
 */
function getDashboardSummary_() {
  var CACHE_TTL_MINUTES = 30;

  // ── 1. Thử đọc cache từ DASHBOARD_READY ───────────────────────
  try {
    var cached = readDashboardCache_();
    if (cached) return cached;
  } catch (e) {
    // Cache lỗi → tính lại
    logError_('getDashboardSummary_ cache read', e);
  }

  // ── 2. Tính lại từ MASTER_DATA ────────────────────────────────
  var summary = computeDashboardSummary_();

  // ── 3. Ghi cache vào DASHBOARD_READY ──────────────────────────
  try {
    writeDashboardCache_(summary);
  } catch (e) {
    logError_('getDashboardSummary_ cache write', e);
  }

  return summary;
}

/**
 * Tính toán dashboard summary từ MASTER_DATA (Governance v3.0).
 * Bổ sung: top/bottom performers, ranking metrics, reward/warning lists,
 *          category distribution, score averages theo team.
 */
function computeDashboardSummary_() {
  var all = readSheetAsObjects_(SHEETS.MASTER);

  var statusCounts    = {};
  var teamCounts      = {};
  var categoryCounts  = {};
  var ucCategoryCounts= {};
  var recentList      = [];
  var scoredList      = [];
  var teamScoreMap    = {}; // team → [scores]

  var totalTimeSavedMin    = 0;
  var totalHoursSavedMonth = 0;
  var totalHoursSavedActual= 0;
  var countWithMeasurement = 0;
  var countApproved        = 0;
  var countWithDemo        = 0;
  var countStandardized    = 0;

  all.forEach(function(uc) {
    // ── Status breakdown ───────────────────────────────────────
    var st = uc.Status || 'Unknown';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    if (st === STATUS.APPROVED) countApproved++;

    // ── Team breakdown ─────────────────────────────────────────
    var team = uc.Team || 'Unknown';
    teamCounts[team] = (teamCounts[team] || 0) + 1;

    // ── Business Category breakdown ───────────────────────────
    var cat = uc.Business_Category || 'Unknown';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    // ── UseCase_Category breakdown ────────────────────────────
    var ucCat = uc.UseCase_Category || 'UNCATEGORIZED';
    ucCategoryCounts[ucCat] = (ucCategoryCounts[ucCat] || 0) + 1;

    // ── Time saving metrics ────────────────────────────────────
    var hours = safeNum_(uc.Estimated_Hours_Saved_Month);
    totalHoursSavedMonth += hours;
    totalHoursSavedActual += safeNum_(uc.Hours_Saved_Actual);

    var before = safeNum_(uc.Before_Time_Min);
    var after  = safeNum_(uc.After_Time_Min);
    if (before > 0 && after >= 0) {
      totalTimeSavedMin += Math.max(0, before - after);
      countWithMeasurement++;
    }

    // ── Demo + Standardized count ─────────────────────────────
    if (uc.Demo_Status && uc.Demo_Status !== 'Chưa có') countWithDemo++;
    if (String(uc.Standardized_Flag).toUpperCase() === 'TRUE') countStandardized++;

    // ── Scoring data collection ───────────────────────────────
    var totalScore = safeNum_(uc.Total_Score);
    if (totalScore > 0 || uc.Rank_Category) {
      scoredList.push({
        record_id:          uc.Record_ID,
        usecase_id:         uc.UseCase_ID,
        name:               uc.UseCase_Name,
        team:               uc.Team || '',
        owner_name:         uc.Owner_Name || '',
        owner_email:        uc.Owner_Email || '',
        usecase_category:   uc.UseCase_Category || '',
        total_score:        totalScore,
        auto_score:         safeNum_(uc.Auto_Score),
        manual_score:       safeNum_(uc.Manual_Score),
        rank_category:      uc.Rank_Category || '',
        center_ranking:     safeNum_(uc.Center_Ranking),
        department_ranking: safeNum_(uc.Department_Ranking),
        reward_eligible:    uc.Reward_Eligible || 'FALSE',
        warning_flag:       uc.Warning_Flag    || 'FALSE',
        current_progress:   safeNum_(uc.Current_Progress),
        hours_saved_actual: safeNum_(uc.Hours_Saved_Actual),
        status:             uc.Status
      });
    }

    // ── Team score accumulation ───────────────────────────────
    if (totalScore > 0) {
      if (!teamScoreMap[team]) teamScoreMap[team] = [];
      teamScoreMap[team].push(totalScore);
    }

    // ── Recent submissions ────────────────────────────────────
    if (uc.Submit_Date && uc.Status === STATUS.SUBMITTED) {
      recentList.push({
        record_id:    uc.Record_ID,
        usecase_id:   uc.UseCase_ID,
        name:         uc.UseCase_Name,
        team:         uc.Team,
        owner_name:   uc.Owner_Name,
        status:       uc.Status,
        submitted_at: uc.Submit_Date
      });
    }
  });

  // ── Sort & slice performers ────────────────────────────────────
  scoredList.sort(function(a, b) { return b.total_score - a.total_score; });
  var top10    = scoredList.slice(0, 10);
  var bottom10 = scoredList.slice(-10).reverse();

  // ── Reward / Warning lists ────────────────────────────────────
  var rewardEligible = scoredList.filter(function(uc) {
    return String(uc.reward_eligible).toUpperCase() === 'TRUE';
  });
  var warningList = scoredList.filter(function(uc) {
    return String(uc.warning_flag).toUpperCase() === 'TRUE';
  });

  // ── Rank category breakdown ───────────────────────────────────
  var rankBreakdown = {};
  scoredList.forEach(function(uc) {
    var r = uc.rank_category || 'UNRANKED';
    rankBreakdown[r] = (rankBreakdown[r] || 0) + 1;
  });

  // ── Average score per team ────────────────────────────────────
  var avgScoreByTeam = {};
  Object.keys(teamScoreMap).forEach(function(t) {
    var scores = teamScoreMap[t];
    avgScoreByTeam[t] = Math.round(
      scores.reduce(function(s, x) { return s + x; }, 0) / scores.length * 10
    ) / 10;
  });

  // ── High impact (top score + high hours saved) ────────────────
  var highImpact = scoredList.filter(function(uc) {
    return uc.total_score >= SCORE_THRESHOLDS.STRONG && uc.hours_saved_actual >= 10;
  }).slice(0, 10);

  // ── Recent submissions ────────────────────────────────────────
  recentList.sort(function(a, b) {
    return new Date(b.submitted_at) - new Date(a.submitted_at);
  });

  return {
    refreshed_at:               new Date().toISOString(),
    total_use_cases:            all.length,
    total_scored:               scoredList.length,
    status_breakdown:           statusCounts,
    team_breakdown:             teamCounts,
    category_breakdown:         categoryCounts,
    usecase_category_breakdown: ucCategoryCounts,
    rank_breakdown:             rankBreakdown,
    total_time_saved_min:       Math.round(totalTimeSavedMin),
    total_hours_saved_month:    Math.round(totalHoursSavedMonth * 100) / 100,
    total_hours_saved_actual:   Math.round(totalHoursSavedActual * 100) / 100,
    use_cases_with_measurement: countWithMeasurement,
    approved_count:             countApproved,
    standardized_count:         countStandardized,
    with_demo_count:            countWithDemo,
    top_performers:             top10,
    bottom_performers:          bottom10,
    high_impact_cases:          highImpact,
    reward_eligible_list:       rewardEligible,
    warning_list:               warningList,
    avg_score_by_team:          avgScoreByTeam,
    recent_submissions:         recentList.slice(0, 5)
  };
}

/**
 * Đọc dashboard cache từ DASHBOARD_READY sheet.
 * @returns {Object|null} Cached summary hoặc null nếu cache cũ/không có
 */
function readDashboardCache_() {
  var CACHE_TTL_MINUTES = 30;
  var sheet = getOrCreateSheet_(SHEETS.DASHBOARD);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  var headers      = data[0].map(String);
  var refreshedIdx = headers.indexOf('Refreshed_At');
  if (refreshedIdx === -1 || !data[1][refreshedIdx]) return null;

  var refreshedAt = new Date(data[1][refreshedIdx]);
  var ageMinutes  = (Date.now() - refreshedAt.getTime()) / 60000;
  if (ageMinutes > CACHE_TTL_MINUTES) return null;

  // Parse JSON fields
  var row = data[1];
  var result = {};
  headers.forEach(function(h, i) { result[h] = row[i]; });

  ['Team_Breakdown_JSON', 'Category_Breakdown_JSON', 'Recent_Submissions_JSON'].forEach(function(col) {
    if (result[col]) {
      try { result[col] = JSON.parse(result[col]); }
      catch (e) { result[col] = {}; }
    }
  });

  return {
    refreshed_at:               result['Refreshed_At'],
    total_use_cases:            safeNum_(result['Total']),
    status_breakdown: {
      Draft:        safeNum_(result['Draft']),
      Submitted:    safeNum_(result['Submitted']),
      Approved:     safeNum_(result['Approved']),
      Rejected:     safeNum_(result['Rejected'])
    },
    team_breakdown:             result['Team_Breakdown_JSON']     || {},
    category_breakdown:         result['Category_Breakdown_JSON'] || {},
    total_time_saved_min:       safeNum_(result['Total_Time_Saved_Min']),
    total_hours_saved_month:    safeNum_(result['Total_Hours_Saved_Month']),
    use_cases_with_measurement: safeNum_(result['Use_Cases_With_Measurement']),
    recent_submissions:         result['Recent_Submissions_JSON']  || []
  };
}

/**
 * Ghi dashboard summary vào DASHBOARD_READY sheet (dùng làm cache).
 * Overwrite hàng đầu tiên (chỉ giữ 1 hàng cache).
 */
function writeDashboardCache_(summary) {
  var sheet = getOrCreateSheet_(SHEETS.DASHBOARD);

  var statusMap = summary.status_breakdown || {};
  var row = [
    summary.refreshed_at,
    summary.total_use_cases,
    safeNum_(statusMap['Draft']),
    safeNum_(statusMap['Submitted']),
    safeNum_(statusMap['Approved']),
    safeNum_(statusMap['Rejected']),
    summary.total_time_saved_min,
    summary.total_hours_saved_month,
    summary.use_cases_with_measurement,
    JSON.stringify(summary.team_breakdown     || {}),
    JSON.stringify(summary.category_breakdown || {}),
    JSON.stringify(summary.recent_submissions || [])
  ];

  // Xóa dữ liệu cũ (giữ header) và ghi hàng mới
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  sheet.getRange(2, 1, 1, row.length).setValues([row]);
}

/**
 * Trigger function — Gọi từ GAS Time-based trigger (ví dụ: mỗi 30 phút).
 * Deploy: Triggers → Add Trigger → refreshDashboardCache → Time-based → Every 30 minutes
 */
function refreshDashboardCache() {
  try {
    var summary = computeDashboardSummary_();
    writeDashboardCache_(summary);
    console.log('Dashboard cache refreshed: ' + summary.total_use_cases + ' use cases');
  } catch (e) {
    logError_('refreshDashboardCache', e);
    console.error('Dashboard cache refresh failed: ' + e.message);
  }
}
