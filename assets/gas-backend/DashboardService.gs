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
 * Tính toán dashboard summary từ MASTER_DATA.
 * Được gọi nội bộ hoặc từ trigger time-based.
 */
function computeDashboardSummary_() {
  var all = readSheetAsObjects_(SHEETS.MASTER);

  var statusCounts   = {};
  var teamCounts     = {};
  var categoryCounts = {};
  var recentList     = [];

  var totalTimeSavedMin   = 0;
  var totalHoursSavedMonth = 0;
  var countWithMeasurement = 0;
  var countApproved        = 0;
  var countWithDemo        = 0;

  all.forEach(function(uc) {
    // ── Status breakdown ───────────────────────────────────────
    var st = uc.Status || 'Unknown';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    if (st === STATUS.APPROVED) countApproved++;

    // ── Team breakdown ─────────────────────────────────────────
    var team = uc.Team || 'Unknown';
    teamCounts[team] = (teamCounts[team] || 0) + 1;

    // ── Category breakdown ─────────────────────────────────────
    var cat = uc.Business_Category || 'Unknown';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    // ── Time saving metrics ────────────────────────────────────
    var hours = safeNum_(uc.Estimated_Hours_Saved_Month);
    totalHoursSavedMonth += hours;

    var before = safeNum_(uc.Before_Time_Min);
    var after  = safeNum_(uc.After_Time_Min);
    if (before > 0 && after >= 0) {
      totalTimeSavedMin += Math.max(0, before - after);
      countWithMeasurement++;
    }

    // ── Demo count ────────────────────────────────────────────
    if (uc.Demo_Status && uc.Demo_Status !== 'Chưa có') countWithDemo++;

    // ── Recent submissions (top 5 mới nhất theo Submit_Date) ──
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

  // Sort recent submissions và lấy top 5
  recentList.sort(function(a, b) {
    return new Date(b.submitted_at) - new Date(a.submitted_at);
  });
  var recentSubmissions = recentList.slice(0, 5);

  return {
    refreshed_at:              new Date().toISOString(),
    total_use_cases:           all.length,
    status_breakdown:          statusCounts,
    team_breakdown:            teamCounts,
    category_breakdown:        categoryCounts,
    total_time_saved_min:      Math.round(totalTimeSavedMin),
    total_hours_saved_month:   Math.round(totalHoursSavedMonth * 100) / 100,
    use_cases_with_measurement:countWithMeasurement,
    approved_count:            countApproved,
    with_demo_count:           countWithDemo,
    recent_submissions:        recentSubmissions
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
