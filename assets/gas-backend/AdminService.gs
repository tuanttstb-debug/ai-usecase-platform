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
      record_id:   uc.Record_ID,
      usecase_id:  uc.UseCase_ID,
      name:        uc.UseCase_Name,
      owner_name:  uc.Owner_Name,
      owner_email: uc.Owner_Email,
      team:        uc.Team,
      category:    uc.Business_Category,
      status:      uc.Status,
      stage:       uc.Current_Stage,
      submit_date: uc.Submit_Date,
      created_at:  uc.Created_At,
      // Truncate để tránh response quá lớn
      pain_point:  String(uc.Pain_Point || '').substring(0, 200)
    };
  });
}
