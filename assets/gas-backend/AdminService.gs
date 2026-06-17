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
      pain_point:          String(uc.Pain_Point    || '').substring(0, 200)
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
      current_progress:   safeNum_(uc.Current_Progress)
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
  var ALLOWED_FIELDS = [
    'Current_Progress', 'Weekly_Update', 'Next_Milestone', 'Blocker',
    'Manager_Support', 'Monthly_Usage_Count', 'Hours_Saved_Actual',
    'Reuse_Count_Tracked'
  ];

  var updates = { Record_ID: recordId };
  ALLOWED_FIELDS.forEach(function(field) {
    if (data[field] !== undefined) updates[field] = data[field];
  });
  updates.Last_Weekly_Report = now;
  updates.Updated_At         = now;

  // Re-score với dữ liệu usage mới
  var merged = {};
  Object.keys(existing).forEach(function(k) { merged[k] = existing[k]; });
  Object.keys(updates).forEach(function(k) { merged[k] = updates[k]; });
  try {
    var scores = scoreUseCase_(merged);
    Object.keys(scores).forEach(function(k) { updates[k] = scores[k]; });
  } catch (e) {
    logError_('submitWeeklyUpdate_ scoring', e, { recordId: recordId });
  }

  updateRowByRecordId_(SHEETS.MASTER, recordId, updates);
  logActivity_(existing.UseCase_ID, recordId, 'WEEKLY_UPDATE',
    'Cập nhật tiến độ tuần: ' + (data.Current_Progress || '?') + '% — ' +
    String(data.Weekly_Update || '').substring(0, 100),
    data.reporter_email || existing.Owner_Email, existing.Status, existing.Status);

  return { record_id: recordId, updated_at: now, total_score: updates.Total_Score };
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
