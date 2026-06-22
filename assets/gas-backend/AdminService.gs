// ─────────────────────────────────────────────────────────────────
// AdminService.gs — Phân quyền và approval workflow
//
// RBAC model:
//   - admin:       có trong ADMIN_EMAILS (Config.gs hoặc CONFIG sheet)
//   - normal user: không có trong list trên
//
// Bảo mật: đây là validation phía backend (defense in depth).
// Phía frontend cũng check ADMIN_EMAILS trong env.js để ẩn/hiện UI.
// Lưu ý: không có auth layer thực sự — ai biết admin email đều có thể call API.
// Nâng cấp lên OAuth/SSO khi cần bảo mật production.
// ─────────────────────────────────────────────────────────────────

// ── Admin Validation ──────────────────────────────────────────────

/**
 * Đọc danh sách admin usernames (đã normalize lowercase).
 * Ưu tiên:
 *   1. USERS sheet — Role=admin, Active=TRUE (single source of truth)
 *   2. CONFIG sheet — key=ADMIN_EMAILS (comma-separated, cho phép update không deploy)
 *   3. Config.gs ADMIN_EMAILS — hardcoded fallback cuối cùng
 */
function getAdminEmails_() {
  // Priority 1: USERS sheet
  try {
    var fromSheet = getAdminUsernamesFromSheet_();
    if (fromSheet.length > 0) return fromSheet;
  } catch(e) { /* Fallback */ }

  // Priority 2: CONFIG sheet
  try {
    var entry = findObjectByField_(SHEETS.CONFIG, 'Key', 'ADMIN_EMAILS');
    if (entry && entry.Value) {
      return String(entry.Value).split(',')
        .map(function(e) { return normalizeUser_(e); })
        .filter(Boolean);
    }
  } catch(e) { /* Fallback */ }

  // Priority 3: Config.gs hardcoded
  return (ADMIN_EMAILS || []).map(function(e) { return normalizeUser_(e); });
}

/**
 * Kiểm tra email có phải admin không.
 * @param {string} email
 * @returns {boolean}
 */
function isAdminEmail_(email) {
  if (!email) return false;
  return getAdminEmails_().indexOf(String(email).trim().toLowerCase()) !== -1;
}

// ── Approve / Reject ──────────────────────────────────────────────

/**
 * Duyệt một use case.
 * Chỉ admin mới được gọi. Chỉ status Submitted/Under Review mới được duyệt.
 * @param {string} recordId       - Record_ID của use case
 * @param {string} reviewerEmail  - Email admin thực hiện duyệt
 * @param {string} [comment]      - Nhận xét (tùy chọn)
 * @returns {{ record_id, new_status }}
 */
function approveUseCase_(recordId, reviewerEmail, comment) {
  if (!isAdminEmail_(reviewerEmail)) {
    throw new Error('Email không có quyền duyệt use case: ' + reviewerEmail);
  }
  return changeUseCaseStatus_(recordId, STATUS.APPROVED, reviewerEmail, comment || '', 'APPROVED');
}

/**
 * Từ chối một use case.
 * Bắt buộc có comment (lý do từ chối).
 * @param {string} recordId
 * @param {string} reviewerEmail
 * @param {string} comment         - Lý do từ chối (bắt buộc)
 * @returns {{ record_id, new_status }}
 */
function rejectUseCase_(recordId, reviewerEmail, comment) {
  if (!isAdminEmail_(reviewerEmail)) {
    throw new Error('Email không có quyền từ chối use case: ' + reviewerEmail);
  }
  if (!comment || String(comment).trim() === '') {
    throw new Error('Lý do từ chối là bắt buộc');
  }
  return changeUseCaseStatus_(recordId, STATUS.REJECTED, reviewerEmail, comment, 'REJECTED');
}

/**
 * Internal: thay đổi status + ghi reviewer info + audit log.
 */
function changeUseCaseStatus_(recordId, newStatus, reviewerEmail, comment, logAction) {
  var existing = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!existing) throw new Error('Không tìm thấy use case: ' + recordId);

  var allowedFrom = [STATUS.SUBMITTED, 'Under Review'];
  if (allowedFrom.indexOf(existing.Status) === -1) {
    throw new Error(
      'Chỉ duyệt/từ chối được khi trạng thái là Submitted hoặc Under Review. ' +
      'Hiện tại: "' + existing.Status + '"'
    );
  }

  var now    = new Date().toISOString();
  var merged = {};
  Object.keys(existing).forEach(function(k) { merged[k] = existing[k]; });

  merged.Status         = newStatus;
  merged.Reviewer       = reviewerEmail;
  merged.Review_Date    = now;
  merged.Review_Comment = comment;
  merged.Updated_At     = now;
  merged.Edit_Version   = (parseInt(merged.Edit_Version, 10) || 0) + 1;

  // JSON_Backup
  var backupData = {};
  HEADERS.forEach(function(h) { if (h !== 'JSON_Backup') backupData[h] = merged[h]; });
  merged.JSON_Backup = JSON.stringify(backupData);

  updateRowByRecordId_(SHEETS.MASTER, recordId, merged);
  logActivity_(
    merged.UseCase_ID, recordId, logAction,
    (logAction === 'APPROVED' ? 'Duyệt' : 'Từ chối') + ' bởi ' + reviewerEmail +
      (comment ? ': ' + comment.substring(0, 200) : ''),
    reviewerEmail, existing.Status, newStatus
  );

  return { record_id: recordId, new_status: newStatus };
}

// ── List Use Cases ────────────────────────────────────────────────

/**
 * Lấy danh sách use cases (slim view — chỉ các field cần cho list/dashboard).
 *
 * filters:
 *   filter  = 'pending' → Submitted + Under Review
 *   status  = 'Approved' → lọc theo status cụ thể
 *   team    = 'CNTT' → lọc theo team
 *   limit   = 100 (default)
 *
 * @param {Object} [filters]
 * @returns {Object[]}
 */
function listUseCases_(filters) {
  filters = filters || {};

  var all          = readSheetAsObjects_(SHEETS.MASTER);
  var filterPreset = String(filters.filter || '').trim().toLowerCase();
  var statusFilter = String(filters.status || '').trim();
  var teamFilter   = String(filters.team   || '').trim();
  var limit        = parseInt(filters.limit, 10) || 100;

  var filtered = all.filter(function(uc) {
    if (filterPreset === 'pending') {
      return uc.Status === STATUS.SUBMITTED || uc.Status === 'Under Review';
    }
    if (statusFilter && uc.Status !== statusFilter) return false;
    if (teamFilter   && uc.Team   !== teamFilter)   return false;
    return true;
  });

  // Sắp xếp mới nhất lên đầu
  filtered.sort(function(a, b) {
    return new Date(b.Created_At || 0) - new Date(a.Created_At || 0);
  });

  return filtered.slice(0, limit).map(function(uc) {
    return {
      record_id:           uc.Record_ID,
      usecase_id:          uc.UseCase_ID,
      name:                uc.UseCase_Name,
      owner_name:          uc.Owner_Name,
      owner_email:         uc.Owner_Email,
      team:                uc.Team,
      category:            uc.Business_Category,
      usecase_category:    uc.UseCase_Category    || '',
      status:              uc.Status,
      stage:               uc.Current_Stage,
      review_status:       uc.Review_Status       || '',
      submit_date:         uc.Submit_Date,
      created_at:          uc.Created_At,
      // Governance fields
      total_score:         safeNum_(uc.Total_Score),
      auto_score:          safeNum_(uc.Auto_Score),
      manual_score:        safeNum_(uc.Manual_Score),
      rank_category:       uc.Rank_Category        || '',
      center_ranking:      safeNum_(uc.Center_Ranking),
      department_ranking:  safeNum_(uc.Department_Ranking),
      reward_eligible:     uc.Reward_Eligible      || 'FALSE',
      warning_flag:        uc.Warning_Flag         || 'FALSE',
      current_progress:    safeNum_(uc.Current_Progress),
      monthly_usage_count: safeNum_(uc.Monthly_Usage_Count),
      hours_saved_actual:  safeNum_(uc.Hours_Saved_Actual),
      blocker:             String(uc.Blocker       || '').substring(0, 200),
      last_weekly_report:  uc.Last_Weekly_Report   || '',
      pain_point:          String(uc.Pain_Point    || '').substring(0, 200),
      review_comment:      String(uc.Review_Comment || '').substring(0, 300),
      reviewer_email:      uc.Reviewer             || '',
      quality_score:       safeNum_(uc.Quality_Score),
      business_value_score: safeNum_(uc.Business_Value_Score),
      innovation_score:    safeNum_(uc.Innovation_Score)
    };
  });
}

// ── Governance: Leaderboard ──────────────────────────────────────

/**
 * Lấy danh sách xếp hạng theo category và/hoặc team.
 * @param {string} category - UseCase_Category filter (rỗng = tất cả)
 * @param {string} team     - Team filter (rỗng = tất cả)
 * @param {number} limit    - Số records trả về (mỗi bucket top/bottom)
 */
function getLeaderboard_(category, team, limit) {
  limit = limit || 20;

  var all = readSheetAsObjects_(SHEETS.MASTER).filter(function(uc) {
    var score = safeNum_(uc.Total_Score);
    if (score <= 0 && !uc.Rank_Category) return false;
    if (category && uc.UseCase_Category !== category) return false;
    if (team     && uc.Team !== team) return false;
    return true;
  });

  all.sort(function(a, b) { return safeNum_(b.Total_Score) - safeNum_(a.Total_Score); });

  var mapItem = function(uc, rank) {
    return {
      rank:               rank,
      record_id:          uc.Record_ID,
      usecase_id:         uc.UseCase_ID,
      name:               uc.UseCase_Name,
      team:               uc.Team               || '',
      owner_name:         uc.Owner_Name         || '',
      usecase_category:   uc.UseCase_Category   || '',
      total_score:        safeNum_(uc.Total_Score),
      auto_score:         safeNum_(uc.Auto_Score),
      manual_score:       safeNum_(uc.Manual_Score),
      efficiency_score:   safeNum_(uc.Efficiency_Score),
      adoption_score:     safeNum_(uc.Adoption_Score_Calc),
      reuse_score:        safeNum_(uc.Reuse_Score),
      rank_category:      uc.Rank_Category      || '',
      reward_eligible:    uc.Reward_Eligible    || 'FALSE',
      warning_flag:       uc.Warning_Flag       || 'FALSE',
      hours_saved_actual: safeNum_(uc.Hours_Saved_Actual),
      current_progress:   safeNum_(uc.Current_Progress),
      review_comment:     uc.Review_Comment || ''
    };
  };

  // Category breakdown rankings
  var byCategory = {};
  all.forEach(function(uc) {
    var cat = uc.UseCase_Category || 'UNCATEGORIZED';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(uc);
  });

  var categoryRankings = {};
  Object.keys(byCategory).forEach(function(cat) {
    categoryRankings[cat] = byCategory[cat].slice(0, limit).map(mapItem);
  });

  return {
    top_performers:      all.slice(0, limit).map(mapItem),
    bottom_performers:   all.slice(-Math.min(limit, all.length)).reverse().map(mapItem),
    category_rankings:   categoryRankings,
    total_ranked:        all.length,
    filter_category:     category || 'all',
    filter_team:         team     || 'all'
  };
}

// ── Governance: Weekly Update ─────────────────────────────────────

/**
 * Xử lý báo cáo tiến độ hàng tuần từ người dùng.
 * @param {string} recordId
 * @param {Object} data - { Current_Progress, Weekly_Update, Next_Milestone,
 *                          Blocker, Monthly_Usage_Count, Hours_Saved_Actual,
 *                          Reuse_Count_Tracked, reporter_email }
 */
function submitWeeklyUpdate_(recordId, data) {
  if (!recordId) throw new Error('Record_ID là bắt buộc');

  var existing = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!existing) throw new Error('Không tìm thấy use case: ' + recordId);

  var now = new Date().toISOString();

  // ── Fields được phép update trong MASTER_DATA ──────────────────
  var updates = { Record_ID: recordId };
  var TEXT_FIELDS = [
    'Weekly_Update', 'Next_Milestone', 'Blocker', 'Manager_Support'
  ];
  var NUM_FIELDS = [
    'Current_Progress', 'Monthly_Usage_Count', 'Hours_Saved_Actual', 'Reuse_Count_Tracked'
  ];
  TEXT_FIELDS.forEach(function(field) {
    if (data[field] !== undefined) updates[field] = sanitizeStr_(String(data[field]), 2000);
  });
  NUM_FIELDS.forEach(function(field) {
    if (data[field] !== undefined) updates[field] = safeNum_(data[field]);
  });
  updates.Last_Weekly_Report = now;
  updates.Updated_At         = now;

  // ── Stage transition ───────────────────────────────────────────
  var prevStage    = sanitizeStr_(existing.Current_Stage || '');
  var proposedStage = sanitizeStr_(data.New_Stage || '');
  var validStages  = ['S1 - Idea', 'S2 - Pilot', 'S3 - Standardized', 'S4 - Scale'];
  var stageChanged = (
    proposedStage &&
    proposedStage !== prevStage &&
    validStages.indexOf(proposedStage) !== -1
  );
  if (stageChanged) {
    updates.Current_Stage = proposedStage;
  }

  // ── Re-score với dữ liệu mới (kể cả stage mới nếu thay đổi) ──
  var merged = {};
  Object.keys(existing).forEach(function(k) { merged[k] = existing[k]; });
  Object.keys(updates).forEach(function(k) { merged[k] = updates[k]; });
  try {
    var scores = scoreUseCase_(merged);
    Object.keys(scores).forEach(function(k) { updates[k] = scores[k]; });
  } catch (e) {
    logError_('submitWeeklyUpdate_ scoring', e, { recordId: recordId });
  }

  // ── Ghi MASTER_DATA ───────────────────────────────────────────
  updateRowByRecordId_(SHEETS.MASTER, recordId, updates);

  // ── Ghi WEEKLY_LOG (1 row / lần submit — giữ toàn bộ lịch sử) ─
  var logRow = {
    Record_ID:            recordId,
    UseCase_ID:           existing.UseCase_ID || '',
    Log_Date:             now,
    Previous_Stage:       prevStage,
    New_Stage:            stageChanged ? proposedStage : prevStage,
    Stage_Changed:        stageChanged ? 'TRUE' : 'FALSE',
    Progress:             safeNum_(data.Current_Progress),
    Weekly_Update:        sanitizeStr_(data.Weekly_Update    || '', 2000),
    Next_Milestone:       sanitizeStr_(data.Next_Milestone   || '', 500),
    Blocker:              sanitizeStr_(data.Blocker          || '', 1000),
    Manager_Support:      sanitizeStr_(data.Manager_Support  || '', 500),
    Monthly_Usage_Count:  safeNum_(data.Monthly_Usage_Count),
    Hours_Saved_Actual:   safeNum_(data.Hours_Saved_Actual),
    Reuse_Count_Tracked:  safeNum_(data.Reuse_Count_Tracked),
    Scale_Plan:           sanitizeStr_(data.Scale_Plan  || '', 2000),
    Scale_Risks:          sanitizeStr_(data.Scale_Risks || '', 2000),
    Reporter:             sanitizeStr_(data.reporter_email || existing.Owner_Email || '', 200)
  };
  appendRowFromObject_(SHEETS.WEEKLY_LOG, logRow);

  // ── ACTIVITY_LOG ───────────────────────────────────────────────
  var actDetails = 'Cập nhật tuần: ' + (data.Current_Progress || '?') + '% — ' +
    String(data.Weekly_Update || '').substring(0, 80);
  if (stageChanged) {
    actDetails = '[STAGE: ' + prevStage + ' → ' + proposedStage + '] ' + actDetails;
  }
  logActivity_(existing.UseCase_ID, recordId, 'WEEKLY_UPDATE',
    actDetails, data.reporter_email || existing.Owner_Email,
    existing.Status, existing.Status);

  if (stageChanged) {
    logActivity_(existing.UseCase_ID, recordId, 'STAGE_TRANSITION',
      'Chuyển giai đoạn: ' + prevStage + ' → ' + proposedStage,
      data.reporter_email || existing.Owner_Email, prevStage, proposedStage);
  }

  return {
    record_id:     recordId,
    updated_at:    now,
    total_score:   updates.Total_Score || 0,
    stage_changed: stageChanged,
    new_stage:     stageChanged ? proposedStage : prevStage
  };
}

/**
 * Lấy lịch sử weekly update của một UC từ WEEKLY_LOG.
 * @param {string} recordId
 * @returns {Object[]} Array of log entries, sorted desc by log_date
 */
function getWeeklyLog_(recordId) {
  var sheet = getOrCreateSheet_(SHEETS.WEEKLY_LOG);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(String);
  var ridIdx  = headers.indexOf('Record_ID');
  if (ridIdx === -1) return [];

  var logs = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][ridIdx]).trim() !== String(recordId).trim()) continue;
    var row = {};
    headers.forEach(function(h, j) { row[h] = data[i][j]; });
    logs.push({
      log_date:            String(row.Log_Date    || ''),
      previous_stage:      String(row.Previous_Stage || ''),
      new_stage:           String(row.New_Stage   || ''),
      stage_changed:       row.Stage_Changed === 'TRUE',
      progress:            safeNum_(row.Progress),
      weekly_update:       String(row.Weekly_Update   || ''),
      next_milestone:      String(row.Next_Milestone  || ''),
      blocker:             String(row.Blocker          || ''),
      monthly_usage_count: safeNum_(row.Monthly_Usage_Count),
      hours_saved_actual:  safeNum_(row.Hours_Saved_Actual),
      reuse_count_tracked: safeNum_(row.Reuse_Count_Tracked),
      scale_plan:          String(row.Scale_Plan  || ''),
      scale_risks:         String(row.Scale_Risks || ''),
      reporter:            String(row.Reporter    || '')
    });
  }

  logs.sort(function(a, b) {
    return new Date(b.log_date) - new Date(a.log_date);
  });
  return logs;
}

// ── Governance: Self Assessment ───────────────────────────────────

/**
 * Người dùng tự đánh giá (Layer 1 review — 20% weight).
 * @param {string} recordId
 * @param {Object} data - { Self_Assessment_Score (0-100), reporter_email }
 */
function submitSelfAssessment_(recordId, data) {
  if (!recordId) throw new Error('Record_ID là bắt buộc');

  var score    = Math.min(100, Math.max(0, safeNum_(data.Self_Assessment_Score)));
  var now      = new Date().toISOString();
  var existing = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!existing) throw new Error('Không tìm thấy use case: ' + recordId);

  var updates = {
    Record_ID:             recordId,
    Self_Assessment_Score: score,
    Updated_At:            now
  };
  if (!existing.Review_Status || existing.Review_Status === REVIEW_STATUS.PENDING) {
    updates.Review_Status = REVIEW_STATUS.MANAGER;
  }

  updateRowByRecordId_(SHEETS.MASTER, recordId, updates);
  logActivity_(existing.UseCase_ID, recordId, 'SELF_ASSESSMENT',
    'Tự đánh giá: ' + score + '/100',
    data.reporter_email || existing.Owner_Email,
    existing.Review_Status, updates.Review_Status || existing.Review_Status);

  return { record_id: recordId, self_assessment_score: score };
}

// ── Governance: Manager Review ────────────────────────────────────

/**
 * Quản lý đánh giá use case (Layer 2 review — 20% weight).
 * @param {string} recordId
 * @param {Object} data - { Manager_Review_Score (0-100), Quality_Score (0-10),
 *                          Business_Value_Score (0-10), Innovation_Score (0-10),
 *                          UseCase_Category, Review_Committee_Comment,
 *                          reviewer_email, escalate_to_committee: bool }
 */
function submitManagerReview_(recordId, data) {
  if (!recordId) throw new Error('Record_ID là bắt buộc');
  if (!isAdminEmail_(data.reviewer_email)) {
    throw new Error('Không có quyền thực hiện manager review: ' + data.reviewer_email);
  }

  var score    = Math.min(100, Math.max(0, safeNum_(data.Manager_Review_Score)));
  var now      = new Date().toISOString();
  var existing = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!existing) throw new Error('Không tìm thấy use case: ' + recordId);

  var nextReviewStatus = data.escalate_to_committee
    ? REVIEW_STATUS.COMMITTEE
    : REVIEW_STATUS.FINALIZED;

  var updates = {
    Record_ID:                recordId,
    Manager_Review_Score:     score,
    Review_Committee_Comment: String(data.Review_Committee_Comment || '').substring(0, 500),
    Review_Status:            nextReviewStatus,
    Reviewer:                 data.reviewer_email || '',
    Review_Date:              now,
    Updated_At:               now
  };

  // Áp dụng manual scores từ reviewer
  if (data.Quality_Score         !== undefined) updates.Quality_Score         = safeNum_(data.Quality_Score);
  if (data.Business_Value_Score  !== undefined) updates.Business_Value_Score  = safeNum_(data.Business_Value_Score);
  if (data.Innovation_Score      !== undefined) updates.Innovation_Score      = safeNum_(data.Innovation_Score);
  if (data.UseCase_Category      !== undefined) updates.UseCase_Category      = String(data.UseCase_Category);

  // Re-score với manual scores mới
  var merged = {};
  Object.keys(existing).forEach(function(k) { merged[k] = existing[k]; });
  Object.keys(updates).forEach(function(k) { merged[k] = updates[k]; });
  try {
    var scores = scoreUseCase_(merged);
    Object.keys(scores).forEach(function(k) { updates[k] = scores[k]; });
  } catch (e) {
    logError_('submitManagerReview_ scoring', e, { recordId: recordId });
  }

  updateRowByRecordId_(SHEETS.MASTER, recordId, updates);
  logActivity_(existing.UseCase_ID, recordId, 'MANAGER_REVIEW',
    'Manager review: ' + score + '/100 → ' + nextReviewStatus,
    data.reviewer_email, existing.Review_Status, nextReviewStatus);

  return {
    record_id:          recordId,
    manager_review_score: score,
    review_status:      nextReviewStatus,
    total_score:        updates.Total_Score
  };
}

// ── Champion helpers ──────────────────────────────────────────────

/**
 * Returns true if email belongs to an active champion for the given team.
 * Checks USERS sheet: Role='champion', Active=TRUE, Team matches (case-insensitive).
 */
function isChampionForTeam_(email, team) {
  if (!email || !team) return false;
  var normalizedEmail = String(email).toLowerCase().trim();
  var normalizedTeam  = String(team).toLowerCase().trim();
  try {
    var users = getAllUsers_();
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var uEmail  = String(u.Username || u.Email || '').toLowerCase().trim();
      var uRole   = String(u.Role || '').toLowerCase().trim();
      var uActive = u.Active === true || String(u.Active).toLowerCase() === 'true';
      var uTeam   = String(u.Team || '').toLowerCase().trim();
      if (uEmail === normalizedEmail && uRole === 'champion' && uActive && uTeam === normalizedTeam) {
        return true;
      }
    }
  } catch (e) {
    logError_('isChampionForTeam_', e, { email: email, team: team });
  }
  return false;
}

/**
 * Champion review: scores Quality/BusinessValue/Innovation, re-calculates total.
 * Auth: admin OR champion whose team matches the UC's team.
 */
function submitChampionReview_(recordId, data) {
  if (!recordId) throw new Error('Record_ID là bắt buộc');

  var reviewerEmail = String(data.reviewer_email || '').trim();
  var existing = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!existing) throw new Error('Không tìm thấy use case: ' + recordId);

  // Auth check: admin OR champion of the same team
  var ucTeam = String(existing.Team || '').trim();
  if (!isAdminEmail_(reviewerEmail) && !isChampionForTeam_(reviewerEmail, ucTeam)) {
    throw new Error('Không có quyền champion review cho team: ' + ucTeam);
  }

  var now = new Date().toISOString();
  var updates = {
    Record_ID:   recordId,
    Reviewer:    reviewerEmail,
    Review_Date: now,
    Updated_At:  now
  };

  if (data.Quality_Score        !== undefined) updates.Quality_Score        = Math.min(10, Math.max(0, safeNum_(data.Quality_Score)));
  if (data.Business_Value_Score !== undefined) updates.Business_Value_Score = Math.min(10, Math.max(0, safeNum_(data.Business_Value_Score)));
  if (data.Innovation_Score     !== undefined) updates.Innovation_Score     = Math.min(10, Math.max(0, safeNum_(data.Innovation_Score)));
  if (data.Review_Comment       !== undefined) updates.Review_Committee_Comment = String(data.Review_Comment).substring(0, 500);

  // Re-score with updated manual scores
  var merged = {};
  Object.keys(existing).forEach(function(k) { merged[k] = existing[k]; });
  Object.keys(updates).forEach(function(k)  { merged[k] = updates[k]; });
  try {
    var scores = scoreUseCase_(merged);
    Object.keys(scores).forEach(function(k) { updates[k] = scores[k]; });
  } catch (e) {
    logError_('submitChampionReview_ scoring', e, { recordId: recordId });
  }

  updateRowByRecordId_(SHEETS.MASTER, recordId, updates);
  logActivity_(existing.UseCase_ID, recordId, 'CHAMPION_REVIEW',
    'Champion review: Q=' + (updates.Quality_Score || 0) +
    ' BV=' + (updates.Business_Value_Score || 0) +
    ' Inn=' + (updates.Innovation_Score || 0) +
    ' Total=' + (updates.Total_Score || '?'),
    reviewerEmail, null, null);

  return {
    record_id:   recordId,
    total_score: updates.Total_Score
  };
}
