// ─────────────────────────────────────────────────────────────────
// WeeklyReportService.gs — Báo cáo quản trị hàng tuần
//
// Endpoint: GET ?action=weekly-report
//
// Trả về:
//   - Tổng hợp theo team: submitted, approved, avg_score, hours_saved
//   - Top performer + bottom performer của tuần
//   - Use cases bị blocked / overdue / không cập nhật
//   - Tiến độ tổng thể
// ─────────────────────────────────────────────────────────────────

/**
 * Sinh báo cáo tuần từ MASTER_DATA.
 * @param {Object} [options]
 * @param {string} [options.week_start] - ISO date string (default: đầu tuần hiện tại)
 * @returns {Object} Weekly report object
 */
function getWeeklyReport_(options) {
  options = options || {};

  var now       = new Date();
  var weekStart = options.week_start
    ? new Date(options.week_start)
    : getWeekStart_(now);
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  var all = readSheetAsObjects_(SHEETS.MASTER);

  // ── Khởi tạo buckets ───────────────────────────────────────────
  var teamMap     = {}; // team → stats
  var overdue     = [];
  var noUpdate    = [];
  var blocked     = [];
  var topScored   = [];

  var totalProgress     = 0;
  var countWithProgress = 0;

  all.forEach(function(uc) {
    var team = uc.Team || 'Unknown';
    if (!teamMap[team]) {
      teamMap[team] = {
        team:            team,
        submitted_count: 0,
        approved_count:  0,
        active_count:    0,
        total_score_sum: 0,
        scored_count:    0,
        hours_saved:     0,
        top_performer:   null,
        bottom_performer:null
      };
    }

    var t = teamMap[team];

    // Đếm theo status
    if (uc.Status === STATUS.SUBMITTED) t.submitted_count++;
    if (uc.Status === STATUS.APPROVED)  t.approved_count++;
    if (uc.Status !== STATUS.REJECTED && uc.Status !== STATUS.DRAFT) t.active_count++;

    // Tính điểm
    var score = safeNum_(uc.Total_Score);
    if (score > 0) {
      t.total_score_sum += score;
      t.scored_count++;
    }

    // Giờ tiết kiệm
    t.hours_saved += safeNum_(uc.Hours_Saved_Actual);

    // Tiến độ
    var progress = safeNum_(uc.Current_Progress);
    if (progress > 0) {
      totalProgress     += progress;
      countWithProgress++;
    }

    // ── Overdue check ───────────────────────────────────────────
    var plannedEnd = uc.Planned_End_Date;
    if (plannedEnd && uc.Status !== STATUS.APPROVED) {
      var endDate = new Date(plannedEnd);
      if (!isNaN(endDate) && endDate < now && progress < 100) {
        overdue.push(buildProgressItem_(uc, 'overdue'));
      }
    }

    // ── No update check ─────────────────────────────────────────
    var lastReport = uc.Last_Weekly_Report;
    if (uc.Status === STATUS.SUBMITTED || uc.Status === 'Under Review') {
      if (!lastReport) {
        noUpdate.push(buildProgressItem_(uc, 'never_reported'));
      } else {
        var lastDate = new Date(lastReport);
        if (!isNaN(lastDate)) {
          var daysSince = (now - lastDate) / (1000 * 60 * 60 * 24);
          if (daysSince > OVERDUE_DAYS_THRESHOLD) {
            noUpdate.push(buildProgressItem_(uc, 'no_update_' + Math.floor(daysSince) + 'd'));
          }
        }
      }
    }

    // ── Blocked check ───────────────────────────────────────────
    if (uc.Blocker && String(uc.Blocker).trim().length > 0 &&
        uc.Status !== STATUS.APPROVED && uc.Status !== STATUS.REJECTED) {
      blocked.push({
        record_id:  uc.Record_ID,
        usecase_id: uc.UseCase_ID,
        name:       uc.UseCase_Name,
        team:       uc.Team,
        owner:      uc.Owner_Name,
        blocker:    String(uc.Blocker).substring(0, 300),
        manager_support: uc.Manager_Support || ''
      });
    }

    // ── Scored list for top/bottom ────────────────────────────
    if (score > 0) topScored.push(uc);
  });

  // ── Top / bottom performer ─────────────────────────────────────
  topScored.sort(function(a, b) { return safeNum_(b.Total_Score) - safeNum_(a.Total_Score); });
  var overallTop    = topScored.slice(0, 5).map(function(uc) { return buildScoreItem_(uc); });
  var overallBottom = topScored.slice(-5).reverse().map(function(uc) { return buildScoreItem_(uc); });

  // ── Per-team top/bottom ────────────────────────────────────────
  var teamStats = Object.keys(teamMap).map(function(team) {
    var t        = teamMap[team];
    var teamUcs  = all.filter(function(u) { return (u.Team || 'Unknown') === team && safeNum_(u.Total_Score) > 0; });
    teamUcs.sort(function(a, b) { return safeNum_(b.Total_Score) - safeNum_(a.Total_Score); });

    return {
      team:               team,
      submitted_count:    t.submitted_count,
      approved_count:     t.approved_count,
      active_count:       t.active_count,
      avg_score:          t.scored_count > 0
                            ? Math.round(t.total_score_sum / t.scored_count * 10) / 10
                            : 0,
      hours_saved:        Math.round(t.hours_saved * 10) / 10,
      top_performer:      teamUcs.length > 0 ? buildScoreItem_(teamUcs[0]) : null,
      bottom_performer:   teamUcs.length > 1 ? buildScoreItem_(teamUcs[teamUcs.length - 1]) : null
    };
  });

  // Sort teams by avg_score descending
  teamStats.sort(function(a, b) { return b.avg_score - a.avg_score; });

  // ── Weekly submissions (created in current week) ───────────────
  var weeklyNew = all.filter(function(uc) {
    var createdAt = new Date(uc.Created_At);
    return !isNaN(createdAt) && createdAt >= weekStart && createdAt < weekEnd;
  }).map(function(uc) { return buildProgressItem_(uc, 'new'); });

  return {
    report_generated_at:    now.toISOString(),
    week_start:             weekStart.toISOString(),
    week_end:               weekEnd.toISOString(),
    summary: {
      total_use_cases:        all.length,
      total_scored:           topScored.length,
      weekly_new:             weeklyNew.length,
      overdue_count:          overdue.length,
      no_update_count:        noUpdate.length,
      blocked_count:          blocked.length,
      avg_progress:           countWithProgress > 0
                                ? Math.round(totalProgress / countWithProgress)
                                : 0
    },
    team_stats:               teamStats,
    top_performers:           overallTop,
    bottom_performers:        overallBottom,
    weekly_new_submissions:   weeklyNew,
    overdue_use_cases:        overdue,
    no_update_use_cases:      noUpdate,
    blocked_use_cases:        blocked
  };
}

// ── Helpers ───────────────────────────────────────────────────────

function buildScoreItem_(uc) {
  return {
    record_id:          uc.Record_ID,
    usecase_id:         uc.UseCase_ID,
    name:               uc.UseCase_Name,
    team:               uc.Team        || '',
    owner:              uc.Owner_Name  || '',
    total_score:        safeNum_(uc.Total_Score),
    rank_category:      uc.Rank_Category || '',
    center_ranking:     safeNum_(uc.Center_Ranking),
    reward_eligible:    uc.Reward_Eligible || 'FALSE',
    warning_flag:       uc.Warning_Flag    || 'FALSE',
    hours_saved_actual: safeNum_(uc.Hours_Saved_Actual)
  };
}

function buildProgressItem_(uc, flag) {
  return {
    record_id:          uc.Record_ID,
    usecase_id:         uc.UseCase_ID,
    name:               uc.UseCase_Name,
    team:               uc.Team          || '',
    owner:              uc.Owner_Name    || '',
    status:             uc.Status        || '',
    current_progress:   safeNum_(uc.Current_Progress),
    planned_end:        uc.Planned_End_Date || '',
    last_update:        uc.Last_Weekly_Report || '',
    flag:               flag
  };
}

/**
 * Trả về ngày đầu tuần (Thứ Hai) của ngày cho trước.
 */
function getWeekStart_(date) {
  var d = new Date(date);
  var day = d.getDay(); // 0=Sun, 1=Mon
  var diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
