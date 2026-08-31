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
 * Ưu tiên (nguồn user DUY NHẤT = User_Master trên SHTD):
 *   1. User_Master — Role=Admin, Active=TRUE (single source of truth)
 *   2. CONFIG sheet — key=ADMIN_EMAILS (comma-separated, cho phép update không deploy)
 *   3. Config.gs ADMIN_EMAILS — hardcoded fallback cứu hộ khi User_Master offline
 */
function getAdminEmails_() {
  // Priority 1: User_Master dùng chung với SHTD (H2 — nguồn user duy nhất)
  try {
    var fromMaster = getAdminUsernamesFromMaster_();
    if (fromMaster.length > 0) return fromMaster;
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
 *   filter      = 'pending' → Submitted + Under Review
 *   status      = 'Approved' → lọc theo status cụ thể
 *   team        = 'CNTT' → lọc theo team
 *   owner_login = username (Owner_Email) → lọc UC của 1 user (My Cases)
 *   owner_name  = display name (Owner_Name) → khớp thêm để bắt data lệch login/name
 *   limit       = 100 (default). limit <= 0 → không cắt (trả full).
 *
 * LƯU Ý: khi có owner filter, luôn trả FULL set của owner (bỏ qua limit) để
 * "Use case của tôi" không bị mất UC cũ do global cap cắt trước khi lọc owner.
 *
 * @param {Object} [filters]
 * @returns {Object[]}
 */
function listUseCases_(filters) {
  filters = filters || {};

  // (Tuning T1) Cache theo version + bộ filter → bỏ đọc full MASTER + User_Master khi không đổi.
  var _ck  = 'list:' + _aiusVer() + ':' + _aiusHashFilters_(filters);
  var _hit = _aiusCacheGet(_ck);
  if (_hit) return _hit;

  var all          = readSheetAsObjects_(SHEETS.MASTER);
  var filterPreset = String(filters.filter || '').trim().toLowerCase();
  var statusFilter = String(filters.status || '').trim();
  var teamFilter   = String(filters.team   || '').trim();

  // limit: rỗng → 100 (default org-wide); <=0 → không cắt
  var rawLimit = filters.limit;
  var limit;
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    limit = 100;
  } else {
    limit = parseInt(rawLimit, 10);
    if (isNaN(limit)) limit = 100;
  }

  // owner filter (My Cases): khớp theo login (Owner_Email) HOẶC display (Owner_Name),
  // case-insensitive + normalizeUser_ để bắt cả trường hợp Owner_Name/Owner_Email lệch nhau
  var ownerLoginF = normalizeUser_(filters.owner_login || filters.owner || '');
  var ownerNameF  = String(filters.owner_name || '').trim().toLowerCase();
  var hasOwnerF   = !!(ownerLoginF || ownerNameF);

  // Build username → Display_Name từ User_Master để enrich owner info (best-effort)
  var userDisplayMap = {};
  try {
    getAllUsersFromMaster_().forEach(function(u) {
      var key = normalizeUser_(u.username);
      if (key) userDisplayMap[key] = sanitizeStr_(u.display_name) || key;
    });
  } catch (e) { /* không chặn list nếu User_Master lỗi */ }

  var filtered = all.filter(function(uc) {
    if (filterPreset === 'pending') {
      return uc.Status === STATUS.SUBMITTED || uc.Status === 'Under Review';
    }
    if (statusFilter && uc.Status !== statusFilter) return false;
    if (teamFilter   && uc.Team   !== teamFilter)   return false;
    if (hasOwnerF) {
      var ucLogin = normalizeUser_(uc.Owner_Email || '');
      var ucName  = String(uc.Owner_Name  == null ? '' : uc.Owner_Name).trim().toLowerCase();
      var ucEmail = String(uc.Owner_Email == null ? '' : uc.Owner_Email).trim().toLowerCase();
      var ownerMatch =
        (ownerLoginF && (ucLogin === ownerLoginF || ucName === ownerLoginF || ucEmail === ownerLoginF)) ||
        (ownerNameF  && (ucName === ownerNameF   || ucEmail === ownerNameF || ucLogin === normalizeUser_(ownerNameF)));
      if (!ownerMatch) return false;
    }
    return true;
  });

  // Sắp xếp mới nhất lên đầu
  filtered.sort(function(a, b) {
    return new Date(b.Created_At || 0) - new Date(a.Created_At || 0);
  });

  // owner filter → full set; ngược lại limit<=0 → full, limit>0 → cắt
  var out = (hasOwnerF || limit <= 0) ? filtered : filtered.slice(0, limit);

  var result = out.map(function(uc) {
    var ownerLogin = normalizeUser_(uc.Owner_Email || '');
    return {
      record_id:           uc.Record_ID,
      usecase_id:          uc.UseCase_ID,
      name:                uc.UseCase_Name,
      owner_name:          uc.Owner_Name,
      owner_email:         uc.Owner_Email,
      owner_login:         ownerLogin,
      owner_display:       userDisplayMap[ownerLogin] || '',
      team:                uc.Team,
      category:            uc.Business_Category,
      usecase_category:    uc.UseCase_Category    || '',
      workflow:            uc.Workflow            || '',   // CR2b/2c: tổng hợp + độ phủ theo workflow
      workflow_group:      uc.Workflow_Group      || '',
      status:              uc.Status,
      stage:               uc.Current_Stage,
      demo_status:         uc.Demo_Status         || '',
      demo_link:           uc.Demo_Link           || '',
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
      active_user_count:   safeNum_(uc.Active_User_Count),
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

  _aiusCachePut(_ck, result);
  return result;
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
  ensureSheetColumns_(SHEETS.WEEKLY_LOG, WEEKLY_LOG_HEADERS); // self-heal schema milestone

  var existing = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!existing) throw new Error('Không tìm thấy use case: ' + recordId);

  var now = new Date().toISOString();

  // Ghi chú/tiến độ — luôn ghi ngay, không cần duyệt, không tính KPI.
  var TEXT_FIELDS = ['Weekly_Update', 'Next_Milestone', 'Blocker', 'Manager_Support'];
  // Số-liệu-điểm — chỉ ghi ngay khi KHÔNG phải milestone; nếu milestone thì giữ pending.
  var SCORE_NUM_FIELDS = [
    'Active_User_Count', 'Monthly_Usage_Count', 'Hours_Saved_Actual', 'Reuse_Count_Tracked'
  ];
  // Prompt & Luồng AI (Mục tiêu 1) — nội dung, KHÔNG phải điểm → ghi ngay khi user
  // sửa (cờ Prompt_Updated). Không ảnh hưởng milestone/KPI.
  var PROMPT_FIELDS = [
    'Flow_Description', 'Prompt_Role', 'Prompt_Task', 'Prompt_Goal', 'Prompt_Context',
    'Prompt_Input', 'Prompt_Steps', 'Prompt_Output_Format', 'Prompt_Evaluation'
  ];
  var promptUpdated = data.Prompt_Updated === true || String(data.Prompt_Updated) === 'true';

  // ── Stage transition đề xuất ───────────────────────────────────
  var prevStage     = sanitizeStr_(existing.Current_Stage || '');
  var proposedStage = sanitizeStr_(data.New_Stage || '');
  var validStages   = ['S1 - Idea', 'S2 - Pilot', 'S3 - Standardized', 'S4 - Scale'];
  var stageChanged  = (
    proposedStage &&
    proposedStage !== prevStage &&
    validStages.indexOf(proposedStage) !== -1
  );

  // ── Probe: tính điểm đề xuất để phát hiện "nâng điểm" ──────────
  // Ghép existing + toàn bộ dữ liệu đề xuất (text + số liệu + stage) rồi score thử.
  var prevScore = safeNum_(existing.Total_Score);
  var probe = {};
  Object.keys(existing).forEach(function(k) { probe[k] = existing[k]; });
  TEXT_FIELDS.forEach(function(f) {
    if (data[f] !== undefined) probe[f] = sanitizeStr_(String(data[f]), 2000);
  });
  SCORE_NUM_FIELDS.forEach(function(f) {
    if (data[f] !== undefined) probe[f] = safeNum_(data[f]);
  });
  if (data.Current_Progress !== undefined) probe.Current_Progress = safeNum_(data.Current_Progress);
  if (stageChanged) probe.Current_Stage = proposedStage;

  // H1 auto-score đã GỠ → milestone CHỈ theo đổi Stage (bỏ hẳn "milestone theo điểm tăng").
  // proposedScore giữ = prevScore (không đổi điểm) để tương thích schema WEEKLY_LOG.
  var proposedScore = prevScore;

  // ── Milestone = chuyển Stage → cần Admin duyệt ──
  var isMilestone   = stageChanged;
  var milestoneType = stageChanged ? 'STAGE' : '';

  // ── Ghi MASTER_DATA ───────────────────────────────────────────
  // Luôn ghi: ghi chú + tiến độ. Chỉ ghi số-liệu-điểm/stage/điểm khi KHÔNG milestone.
  var updates = { Record_ID: recordId, Last_Weekly_Report: now, Updated_At: now };
  TEXT_FIELDS.forEach(function(f) {
    if (data[f] !== undefined) updates[f] = sanitizeStr_(String(data[f]), 2000);
  });
  if (data.Current_Progress !== undefined) updates.Current_Progress = safeNum_(data.Current_Progress);

  // Prompt/Luồng AI: ghi ngay khi user sửa (không gate theo milestone — là nội dung).
  if (promptUpdated) {
    PROMPT_FIELDS.forEach(function(f) {
      if (data[f] !== undefined) updates[f] = sanitizeStr_(String(data[f]), 5000);
    });
  }

  if (!isMilestone) {
    SCORE_NUM_FIELDS.forEach(function(f) {
      if (data[f] !== undefined) updates[f] = safeNum_(data[f]);
    });
    // H1 auto-score đã GỠ — không tính lại điểm khi cập nhật tuần.
  }
  // Nếu isMilestone: KHÔNG ghi Current_Stage/score/số-liệu-điểm → chờ approveMilestone_.
  updateRowByRecordId_(SHEETS.MASTER, recordId, updates);

  // ── Ghi WEEKLY_LOG (1 row / lần submit — giữ toàn bộ lịch sử) ─
  var logId  = Utilities.getUuid();
  var logRow = {
    Log_ID:               logId,
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
    Active_User_Count:    safeNum_(data.Active_User_Count),
    Monthly_Usage_Count:  safeNum_(data.Monthly_Usage_Count),
    Hours_Saved_Actual:   safeNum_(data.Hours_Saved_Actual),
    Reuse_Count_Tracked:  safeNum_(data.Reuse_Count_Tracked),
    Scale_Plan:           sanitizeStr_(data.Scale_Plan  || '', 2000),
    Scale_Risks:          sanitizeStr_(data.Scale_Risks || '', 2000),
    Reporter:             sanitizeStr_(data.reporter_email || existing.Owner_Email || '', 200),
    Is_Milestone:         isMilestone ? 'TRUE' : 'FALSE',
    Milestone_Type:       milestoneType,
    Previous_Total_Score: prevScore,
    Proposed_Total_Score: proposedScore,
    Approval_Status:      isMilestone ? MILESTONE_STATUS.PENDING : MILESTONE_STATUS.NA,
    Approved_By:          '',
    Approved_At:          '',
    Milestone_Comment:    '',
    // ── Snapshot Prompt & Luồng AI (Mục tiêu 1) — chỉ ghi khi user sửa ──
    Prompt_Updated:       promptUpdated ? 'TRUE' : 'FALSE',
    Flow_Description:     promptUpdated ? sanitizeStr_(String(data.Flow_Description     || ''), 5000) : '',
    Prompt_Role:          promptUpdated ? sanitizeStr_(String(data.Prompt_Role          || ''), 5000) : '',
    Prompt_Task:          promptUpdated ? sanitizeStr_(String(data.Prompt_Task          || ''), 5000) : '',
    Prompt_Goal:          promptUpdated ? sanitizeStr_(String(data.Prompt_Goal          || ''), 5000) : '',
    Prompt_Context:       promptUpdated ? sanitizeStr_(String(data.Prompt_Context       || ''), 5000) : '',
    Prompt_Input:         promptUpdated ? sanitizeStr_(String(data.Prompt_Input         || ''), 5000) : '',
    Prompt_Steps:         promptUpdated ? sanitizeStr_(String(data.Prompt_Steps         || ''), 5000) : '',
    Prompt_Output_Format: promptUpdated ? sanitizeStr_(String(data.Prompt_Output_Format || ''), 5000) : '',
    Prompt_Evaluation:    promptUpdated ? sanitizeStr_(String(data.Prompt_Evaluation    || ''), 5000) : ''
  };
  appendRowFromObject_(SHEETS.WEEKLY_LOG, logRow);

  // ── ACTIVITY_LOG ───────────────────────────────────────────────
  var actDetails = 'Cập nhật tuần: ' + (data.Current_Progress || '?') + '% — ' +
    String(data.Weekly_Update || '').substring(0, 80);
  if (isMilestone) {
    actDetails = '[MILESTONE ' + milestoneType + ' — chờ Admin duyệt] ' + actDetails;
  }
  logActivity_(existing.UseCase_ID, recordId, 'WEEKLY_UPDATE',
    actDetails, data.reporter_email || existing.Owner_Email,
    existing.Status, existing.Status);
  // Lưu ý: STAGE_TRANSITION chỉ log khi Admin duyệt milestone (xem approveMilestone_).

  return {
    record_id:            recordId,
    updated_at:           now,
    log_id:               logId,
    is_milestone:         isMilestone,
    milestone_type:       milestoneType,
    pending_milestone:    isMilestone,          // FE hiển thị "chờ Admin duyệt"
    prev_total_score:     prevScore,
    proposed_total_score: proposedScore,
    // Milestone: điểm/stage CHƯA áp → trả giá trị hiện tại để FE không hiển thị nhầm.
    total_score:          isMilestone ? prevScore : (safeNum_(updates.Total_Score) || prevScore),
    stage_changed:        isMilestone ? false : stageChanged,
    new_stage:            isMilestone ? prevStage : (stageChanged ? proposedStage : prevStage),
    proposed_stage:       stageChanged ? proposedStage : ''
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
      reporter:            String(row.Reporter    || ''),
      log_id:              String(row.Log_ID      || ''),
      is_milestone:        row.Is_Milestone === 'TRUE' || row.Is_Milestone === true,
      milestone_type:      String(row.Milestone_Type || ''),
      previous_total_score:safeNum_(row.Previous_Total_Score),
      proposed_total_score:safeNum_(row.Proposed_Total_Score),
      approval_status:     String(row.Approval_Status || 'N/A'),
      prompt_updated:      row.Prompt_Updated === 'TRUE' || row.Prompt_Updated === true
    });
  }

  logs.sort(function(a, b) {
    return new Date(b.log_date) - new Date(a.log_date);
  });
  return logs;
}

// ── Milestone Approval (v3.14.0) ──────────────────────────────────
// Milestone = dòng WEEKLY_LOG có chuyển Stage hoặc nâng điểm. Phải Admin duyệt
// mới áp Stage/điểm lên MASTER và mới +1 KPI cho Owner (tuần Log_Date).

/**
 * Liệt kê milestone theo trạng thái duyệt, join thông tin UC (owner/team/name).
 * @param {string} filter - 'pending' | 'approved' | 'rejected' | 'all' (mặc định pending)
 * @returns {Object[]} sorted desc theo log_date
 */
function listMilestones_(filter) {
  ensureSheetColumns_(SHEETS.WEEKLY_LOG, WEEKLY_LOG_HEADERS);
  var want = String(filter || 'pending').toLowerCase();
  var logs = readSheetAsObjects_(SHEETS.WEEKLY_LOG);

  // Đọc MASTER 1 lần → map theo Record_ID để join owner/name/team
  var byRid = {};
  readSheetAsObjects_(SHEETS.MASTER).forEach(function(uc) {
    byRid[String(uc.Record_ID)] = uc;
  });

  var out = [];
  logs.forEach(function(row) {
    if (!(row.Is_Milestone === 'TRUE' || row.Is_Milestone === true)) return;
    var st = String(row.Approval_Status || '').toLowerCase();
    if (want !== 'all' && st !== want) return;
    var uc = byRid[String(row.Record_ID)] || {};
    out.push({
      log_id:               String(row.Log_ID || ''),
      record_id:            String(row.Record_ID || ''),
      usecase_id:           String(row.UseCase_ID || uc.UseCase_ID || ''),
      name:                 String(uc.UseCase_Name || ''),
      owner_name:           String(uc.Owner_Name || ''),
      owner_email:          String(uc.Owner_Email || ''),
      team:                 String(uc.Team || ''),
      log_date:             String(row.Log_Date || ''),
      previous_stage:       String(row.Previous_Stage || ''),
      new_stage:            String(row.New_Stage || ''),
      stage_changed:        row.Stage_Changed === 'TRUE' || row.Stage_Changed === true,
      milestone_type:       String(row.Milestone_Type || ''),
      previous_total_score: safeNum_(row.Previous_Total_Score),
      proposed_total_score: safeNum_(row.Proposed_Total_Score),
      progress:             safeNum_(row.Progress),
      weekly_update:        String(row.Weekly_Update || ''),
      active_user_count:    safeNum_(row.Active_User_Count),
      monthly_usage_count:  safeNum_(row.Monthly_Usage_Count),
      hours_saved_actual:   safeNum_(row.Hours_Saved_Actual),
      reuse_count_tracked:  safeNum_(row.Reuse_Count_Tracked),
      approval_status:      String(row.Approval_Status || 'N/A'),
      approved_by:          String(row.Approved_By || ''),
      approved_at:          String(row.Approved_At || ''),
      reporter:             String(row.Reporter || '')
    });
  });

  out.sort(function(a, b) { return new Date(b.log_date) - new Date(a.log_date); });
  return out;
}

/**
 * Admin duyệt một milestone → áp Stage + số-liệu-điểm lên MASTER, re-score.
 * Sau khi Approved, milestone được tính +1 KPI (client-side) cho Owner ở tuần Log_Date.
 * @param {string} logId
 * @param {string} adminEmail
 * @param {string} [comment]
 */
function approveMilestone_(logId, adminEmail, comment) {
  if (!logId) throw new Error('Thiếu log_id');
  if (!isAdminEmail_(adminEmail)) throw new Error('Không có quyền duyệt milestone: ' + adminEmail);
  ensureSheetColumns_(SHEETS.WEEKLY_LOG, WEEKLY_LOG_HEADERS);

  var logRow = findObjectByField_(SHEETS.WEEKLY_LOG, 'Log_ID', logId);
  if (!logRow) throw new Error('Không tìm thấy milestone: ' + logId);
  if (String(logRow.Approval_Status || '') !== MILESTONE_STATUS.PENDING) {
    throw new Error('Milestone không ở trạng thái chờ duyệt (hiện tại: ' + logRow.Approval_Status + ')');
  }

  var recordId = String(logRow.Record_ID);
  var existing = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!existing) throw new Error('Không tìm thấy use case: ' + recordId);

  var now       = new Date().toISOString();
  var prevStage = String(existing.Current_Stage || '');

  // Áp số-liệu-điểm đã đề xuất + stage (nếu có)
  var updates = { Record_ID: recordId, Updated_At: now };
  ['Active_User_Count', 'Monthly_Usage_Count', 'Hours_Saved_Actual', 'Reuse_Count_Tracked']
    .forEach(function(f) { updates[f] = safeNum_(logRow[f]); });
  var stageChanged = (logRow.Stage_Changed === 'TRUE' || logRow.Stage_Changed === true);
  if (stageChanged && logRow.New_Stage) updates.Current_Stage = String(logRow.New_Stage);

  // H1 auto-score đã GỠ — duyệt milestone chỉ áp stage/tiến độ, không tính lại điểm (điểm do hội đồng H2).

  updateRowByRecordId_(SHEETS.MASTER, recordId, updates);

  updateRowByField_(SHEETS.WEEKLY_LOG, 'Log_ID', logId, {
    Approval_Status:      MILESTONE_STATUS.APPROVED,
    Approved_By:          adminEmail,
    Approved_At:          now,
    Proposed_Total_Score: safeNum_(updates.Total_Score),
    Milestone_Comment:    sanitizeStr_(comment || '', 500)
  });

  logActivity_(existing.UseCase_ID, recordId, 'MILESTONE_APPROVED',
    'Duyệt milestone ' + String(logRow.Milestone_Type || '') + ' bởi ' + adminEmail +
      ' — điểm: ' + safeNum_(logRow.Previous_Total_Score) + ' → ' + safeNum_(updates.Total_Score),
    adminEmail, existing.Status, existing.Status);
  if (stageChanged && logRow.New_Stage) {
    logActivity_(existing.UseCase_ID, recordId, 'STAGE_TRANSITION',
      'Chuyển giai đoạn (đã duyệt): ' + prevStage + ' → ' + String(logRow.New_Stage),
      adminEmail, prevStage, String(logRow.New_Stage));
  }

  return {
    log_id:          logId,
    record_id:       recordId,
    approval_status: MILESTONE_STATUS.APPROVED,
    total_score:     safeNum_(updates.Total_Score),
    new_stage:       stageChanged ? String(logRow.New_Stage) : prevStage
  };
}

/**
 * Admin từ chối một milestone → KHÔNG áp gì, đánh dấu Rejected. Bắt buộc có lý do.
 * @param {string} logId
 * @param {string} adminEmail
 * @param {string} comment - lý do (bắt buộc)
 */
function rejectMilestone_(logId, adminEmail, comment) {
  if (!logId) throw new Error('Thiếu log_id');
  if (!isAdminEmail_(adminEmail)) throw new Error('Không có quyền từ chối milestone: ' + adminEmail);
  if (!comment || String(comment).trim() === '') throw new Error('Lý do từ chối là bắt buộc');
  ensureSheetColumns_(SHEETS.WEEKLY_LOG, WEEKLY_LOG_HEADERS);

  var logRow = findObjectByField_(SHEETS.WEEKLY_LOG, 'Log_ID', logId);
  if (!logRow) throw new Error('Không tìm thấy milestone: ' + logId);
  if (String(logRow.Approval_Status || '') !== MILESTONE_STATUS.PENDING) {
    throw new Error('Milestone không ở trạng thái chờ duyệt (hiện tại: ' + logRow.Approval_Status + ')');
  }

  var now = new Date().toISOString();
  updateRowByField_(SHEETS.WEEKLY_LOG, 'Log_ID', logId, {
    Approval_Status:   MILESTONE_STATUS.REJECTED,
    Approved_By:       adminEmail,
    Approved_At:       now,
    Milestone_Comment: sanitizeStr_(comment, 500)
  });

  logActivity_(String(logRow.UseCase_ID || ''), String(logRow.Record_ID || ''), 'MILESTONE_REJECTED',
    'Từ chối milestone bởi ' + adminEmail + ': ' + String(comment).substring(0, 200),
    adminEmail, '', '');

  return {
    log_id:          logId,
    record_id:       String(logRow.Record_ID || ''),
    approval_status: MILESTONE_STATUS.REJECTED
  };
}

/**
 * PUBLIC (chạy trong GAS Editor một lần sau khi deploy):
 * Thêm các cột milestone vào sheet WEEKLY_LOG hiện có mà không mất dữ liệu cũ.
 * An toàn để chạy nhiều lần (idempotent). submitWeeklyUpdate_/listMilestones_ cũng
 * tự gọi ensureSheetColumns_ nên bước này chỉ là chủ động.
 */
function migrateWeeklyLogSchema() {
  var added = ensureSheetColumns_(SHEETS.WEEKLY_LOG, WEEKLY_LOG_HEADERS);
  Logger.log('WEEKLY_LOG migrate — cột thêm: ' + (added.length ? added.join(', ') : '(đã đủ)'));
  return { added: added };
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
// (H1 submitManagerReview_ đã GỠ — governance H1, xem archive/h1)

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
    var users = getAllUsersFromMaster_();
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var uEmail  = String(u.username || u.email || '').toLowerCase().trim();
      var uRole   = String(u.role || '').toLowerCase().trim();
      var uActive = u.active === true;
      var uTeam   = String(u.team || '').toLowerCase().trim();
      if (uEmail === normalizedEmail && (uRole === 'teamlead' || uRole === 'champion') && uActive && uTeam === normalizedTeam) {
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
// (H1 submitChampionReview_ đã GỠ — governance H1, xem archive/h1)
