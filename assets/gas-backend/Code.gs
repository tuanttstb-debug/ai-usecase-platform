// ─────────────────────────────────────────────────────────────────
// Code.gs — Entry point của GAS Web App
//
// Transport: 100% GET + JSONP
//   Frontend inject <script src="exec?action=X&callback=fn&payload=B64">
//   GAS trả về: fn({success, data, message})
//
// Tại sao không dùng POST?
//   ContentService.addHeader() không đảm bảo trả CORS header với POST
//   trên GAS infrastructure → ERR_FAILED dù HTTP 200.
//   JSONP (script tag) hoàn toàn bypass CORS → không cần header.
//
// Endpoints — tất cả đều là GET:
//   ?action=health
//   ?action=lookup
//   ?action=usecase&id={Record_ID}
//   ?action=dashboard
//   ?action=create             + payload=base64url(JSON)
//   ?action=update             + payload=base64url(JSON)
//   ?action=duplicate-check    + payload=base64url(JSON)
// ─────────────────────────────────────────────────────────────────

function doGet(e) {
  var params   = e.parameter || {};
  var action   = String(params.action || '').trim();
  var callback = String(params.callback || '').trim();

  // Fallback: pathInfo (backward compat nếu dùng URL cũ)
  if (!action && e.pathInfo) {
    action = String(e.pathInfo).replace(/^\/+/, '').trim();
  }

  // Decode base64url payload → object (dùng cho create/update/duplicate-check)
  var body = {};
  if (params.payload) {
    body = decodePayload_(params.payload);
  }

  var response;
  try {
    response = route_(action, params, body);
  } catch (err) {
    logError_('doGet action=' + action, err, { action: action });
    response = createResponse_(false, err.message || 'Lỗi server nội bộ');
  }

  // Validate callback name (chỉ cho phép safe JS identifier)
  if (callback && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(callback)) {
    return sendJsonP_(response, callback);
  }

  // Không có callback → trả JSON thường (cho test trực tiếp trên browser)
  return sendJson_(response);
}

// doPost — dùng cho write ops LỚN (create/update) gửi qua hidden-iframe form POST (v3.15.0).
// FE POST form-urlencoded với field: action + payload(base64url). POST body không giới hạn
// độ dài như GET URL → fix triệt để lỗi link demo dài (ổ chung) làm vỡ URL → HTTP 400.
// Cũng chấp nhận raw JSON body (backward compat).
function doPost(e) {
  var params = e.parameter || {};
  var action = String(params.action || '').trim();
  var body   = {};

  if (params.payload) {
    // Đường chính: payload base64url trong form field (giống doGet)
    body = decodePayload_(params.payload);
  } else if (e.postData && e.postData.contents) {
    // Backward compat: raw JSON body
    try { body = JSON.parse(e.postData.contents); }
    catch (ex) {
      return sendJson_(createResponse_(false, 'Request body không hợp lệ: ' + ex.message));
    }
  }

  if (!action && body.action) action = String(body.action).trim();
  if (!action && e.pathInfo)  action = String(e.pathInfo).replace(/^\/+/, '').trim();

  var callback = String(params.callback || '').trim();
  var response;
  try {
    response = route_(action, params, body);
  } catch (err) {
    logError_('doPost action=' + action, err, { action: action });
    response = createResponse_(false, err.message || 'Lỗi server nội bộ');
  }

  // FE iframe POST không đọc response, nhưng hỗ trợ JSONP callback nếu có (test/tương thích).
  if (callback && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(callback)) {
    return sendJsonP_(response, callback);
  }
  return sendJson_(response);
}

// ─────────────────────────────────────────────────────────────────
// Router chung
// ─────────────────────────────────────────────────────────────────

function route_(action, params, body) {

  // ── GET endpoints ──────────────────────────────────────────────

  if (action === 'health') {
    return createResponse_(true, 'OK', {
      status: 'healthy', version: '3.0.0',
      timestamp: new Date().toISOString()
    });
  }

  if (action === 'lookup') {
    return createResponse_(true, 'Lookup data', getLookupData_());
  }

  if (action === 'next-id') {
    return createResponse_(true, 'Next available UseCase ID', peekNextUseCaseId_());
  }

  // Debug endpoint: xem raw LOOKUP sheet (dùng khi cần troubleshoot)
  if (action === 'lookup-debug') {
    var sheet = getOrCreateSheet_(SHEETS.LOOKUP);
    var raw   = sheet.getDataRange().getValues();
    return createResponse_(true, 'LOOKUP sheet raw', {
      row_count:  raw.length,
      headers:    raw.length > 0 ? raw[0] : [],
      first_5_rows: raw.slice(1, 6)
    });
  }

  if (action === 'usecase' || action.indexOf('usecase/') === 0) {
    var id = params.id || action.replace('usecase/', '').trim();
    if (!id) return createResponse_(false, 'Thiếu ?id= hoặc Record_ID');
    return createResponse_(true, 'Use case found', getUseCaseById_(id));
  }

  if (action === 'dashboard' || action === 'dashboard-summary') {
    return createResponse_(true, 'Dashboard summary', getDashboardSummary_());
  }

  // ── POST-like endpoints (data đến qua payload param) ──────────

  if (action === 'create' || action === 'usecase/create') {
    return createResponse_(true, 'Use case đã được tạo', createUseCase_(body));
  }

  if (action === 'update' || action === 'usecase/update') {
    var recordId = body.Record_ID;
    if (!recordId) return createResponse_(false, 'Thiếu Record_ID');
    return createResponse_(true, 'Use case đã được cập nhật', updateUseCase_(recordId, body));
  }

  if (action === 'duplicate-check') {
    return createResponse_(true, 'Kiểm tra duplicate hoàn tất',
      checkDuplicate_(body.UseCase_Name, body.Pain_Point, body.Exclude_Record_ID || null));
  }

  // ── Dashboard: list use cases (dùng URL params, không phải payload) ──
  if (action === 'list') {
    var listFilters = {
      filter:      params.filter      || '',
      status:      params.status      || '',
      team:        params.team        || '',
      category:    params.category    || '',
      owner_login: params.owner_login || params.owner || '',
      owner_name:  params.owner_name  || '',
      limit:       (params.limit == null || params.limit === '') ? '100' : params.limit
    };
    return createResponse_(true, 'Use case list', listUseCases_(listFilters));
  }

  // ── Governance: Weekly Report ──────────────────────────────────
  if (action === 'weekly-report') {
    var weekOptions = { week_start: params.week_start || body.week_start || '' };
    return createResponse_(true, 'Báo cáo tuần', getWeeklyReport_(weekOptions));
  }

  // ── Governance: Leaderboard (top/bottom + category ranking) ───
  if (action === 'leaderboard') {
    var lbCategory = params.category || body.category || '';
    var lbTeam     = params.team     || body.team     || '';
    var lbLimit    = parseInt(params.limit || body.limit || '20', 10);
    return createResponse_(true, 'Leaderboard', getLeaderboard_(lbCategory, lbTeam, lbLimit));
  }

  // ── Governance: Weekly Update (user submits progress) ─────────
  if (action === 'weekly-update') {
    var wuRecordId = body.Record_ID || body.record_id;
    if (!wuRecordId) return createResponse_(false, 'Thiếu Record_ID');
    return createResponse_(true, 'Cập nhật tiến độ tuần thành công',
      submitWeeklyUpdate_(wuRecordId, body));
  }

  // ── Governance: Weekly Log (lịch sử update của 1 UC) ──────────
  if (action === 'weekly-log') {
    var wlRecordId = params.record_id || body.record_id || '';
    if (!wlRecordId) return createResponse_(false, 'Thiếu record_id');
    return createResponse_(true, 'Weekly log', getWeeklyLog_(wlRecordId));
  }

  // ── Milestone: danh sách milestone cập nhật tuần theo trạng thái ─
  if (action === 'milestone-list') {
    var mlFilter = params.filter || body.filter || 'pending';
    return createResponse_(true, 'Milestone list', listMilestones_(mlFilter));
  }

  // ── Milestone: Admin duyệt milestone ──────────────────────────
  if (action === 'milestone-approve') {
    var maLogId = body.log_id || body.Log_ID;
    var maEmail = body.reviewer_email || body.Reviewer || body.admin_email;
    var maComment = body.comment || body.Milestone_Comment || '';
    if (!maLogId) return createResponse_(false, 'Thiếu log_id');
    if (!maEmail) return createResponse_(false, 'Thiếu reviewer_email');
    return createResponse_(true, 'Milestone đã được duyệt',
      approveMilestone_(maLogId, maEmail, maComment));
  }

  // ── Milestone: Admin từ chối milestone ────────────────────────
  if (action === 'milestone-reject') {
    var mrLogId = body.log_id || body.Log_ID;
    var mrEmail = body.reviewer_email || body.Reviewer || body.admin_email;
    var mrComment = body.comment || body.Milestone_Comment || '';
    if (!mrLogId) return createResponse_(false, 'Thiếu log_id');
    if (!mrEmail) return createResponse_(false, 'Thiếu reviewer_email');
    return createResponse_(true, 'Milestone đã bị từ chối',
      rejectMilestone_(mrLogId, mrEmail, mrComment));
  }

  // ── Governance: Self Assessment ───────────────────────────────
  if (action === 'self-assessment') {
    var saRecordId = body.Record_ID || body.record_id;
    if (!saRecordId) return createResponse_(false, 'Thiếu Record_ID');
    return createResponse_(true, 'Tự đánh giá đã được ghi nhận',
      submitSelfAssessment_(saRecordId, body));
  }

  // ── Governance: Manager Review ────────────────────────────────
  if (action === 'manager-review') {
    var mrRecordId = body.Record_ID || body.record_id;
    if (!mrRecordId) return createResponse_(false, 'Thiếu Record_ID');
    return createResponse_(true, 'Manager review đã được ghi nhận',
      submitManagerReview_(mrRecordId, body));
  }

  // ── Governance: Champion Review ───────────────────────────────
  if (action === 'champion-review') {
    var crRecordId = body.Record_ID || body.record_id;
    if (!crRecordId) return createResponse_(false, 'Thiếu Record_ID');
    return createResponse_(true, 'Champion review đã được ghi nhận',
      submitChampionReview_(crRecordId, body));
  }

  // ── Governance: Recalculate all scores (admin only) ───────────
  if (action === 'score-recalc') {
    var rcAdmin = body.admin_email || params.admin_email || '';
    if (!isAdminEmail_(rcAdmin)) {
      return createResponse_(false, 'Không có quyền recalculate scores: ' + rcAdmin);
    }
    return createResponse_(true, 'Recalculate hoàn tất', recalculateAllScores_());
  }

  // ── Governance: Recalculate rankings (admin only) ─────────────
  if (action === 'rank-recalc') {
    var rrAdmin = body.admin_email || params.admin_email || '';
    if (!isAdminEmail_(rrAdmin)) {
      return createResponse_(false, 'Không có quyền recalculate rankings: ' + rrAdmin);
    }
    return createResponse_(true, 'Ranking recalculate hoàn tất', recalculateRankings_());
  }

  // ── Approval endpoints (data qua base64url payload) ──────────────
  if (action === 'approve') {
    var approveRecordId = body.record_id || body.Record_ID;
    var approveEmail    = body.reviewer_email || body.Reviewer;
    var approveComment  = body.comment || body.Review_Comment || '';
    if (!approveRecordId) return createResponse_(false, 'Thiếu record_id');
    if (!approveEmail)    return createResponse_(false, 'Thiếu reviewer_email');
    return createResponse_(true, 'Use case đã được duyệt',
      approveUseCase_(approveRecordId, approveEmail, approveComment));
  }

  if (action === 'reject') {
    var rejectRecordId = body.record_id || body.Record_ID;
    var rejectEmail    = body.reviewer_email || body.Reviewer;
    var rejectComment  = body.comment || body.Review_Comment || '';
    if (!rejectRecordId) return createResponse_(false, 'Thiếu record_id');
    if (!rejectEmail)    return createResponse_(false, 'Thiếu reviewer_email');
    return createResponse_(true, 'Use case đã bị từ chối',
      rejectUseCase_(rejectRecordId, rejectEmail, rejectComment));
  }

  // ── Auth dùng chung với SHTD (H2) ──────────────────────────────

  // Đăng nhập bằng username + password → { token, user }
  if (action === 'auth-login') {
    var alUser = body.username || params.username || '';
    var alPass = body.password || params.password || '';
    if (!alUser || !alPass) return createResponse_(false, 'Thiếu tên đăng nhập hoặc mật khẩu');
    return createResponse_(true, 'Đăng nhập thành công', authLogin_(alUser, alPass));
  }

  // Đổi mật khẩu (yêu cầu token hợp lệ)
  if (action === 'auth-change-password') {
    var cpToken = validateToken_(body.token || params.token || '');
    if (!cpToken) return createResponse_(false, 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
    authChangePassword_(cpToken, body.old_password || '', body.new_password || '');
    return createResponse_(true, 'Đổi mật khẩu thành công', { status: 'ok' });
  }

  // ── User (chỉ ĐỌC — nguồn duy nhất = User_Master trên SHTD) ────
  // Quản lý user (tạo/sửa/đặt lại mật khẩu/sync) CHỈ làm ở SHTD-Dashboard.
  // AI US chỉ đọc danh sách user (phục vụ KPI + resolve admin) + đổi mật khẩu tự phục vụ (auth-change-password).

  // Danh sách tất cả user (đọc từ User_Master, không kèm Password_Hash)
  if (action === 'users') {
    return createResponse_(true, 'Danh sách user', getAllUsersFromMaster_());
  }

  // ── Workflow catalog endpoints (H2 Giai đoạn 2) ────────────────

  // Cây Workflow → Use case đã LỌC theo Team (droplist đăng ký). Public (mọi user đăng nhập).
  if (action === 'workflow-catalog') {
    var wcTeam = params.team || body.team || '';
    return createResponse_(true, 'Workflow catalog', getWorkflowCatalog_(wcTeam));
  }

  // Toàn bộ catalog + Nhóm + Team map (trang quản lý admin)
  if (action === 'workflow-list') {
    return createResponse_(true, 'Danh sách workflow', listWorkflowCatalog_());
  }

  // Thêm/sửa 1 dòng US (admin only)
  if (action === 'workflow-upsert') {
    if (!isAdminEmail_(body.reviewer_email || body.admin_email || '')) {
      return createResponse_(false, 'Không có quyền cấu hình workflow');
    }
    var wuRes = workflowUpsert_(body);
    return createResponse_(true, wuRes.created ? 'Đã thêm Use case' : 'Đã cập nhật Use case', wuRes);
  }

  // Xóa 1 dòng US (admin only)
  if (action === 'workflow-delete') {
    if (!isAdminEmail_(body.reviewer_email || body.admin_email || '')) {
      return createResponse_(false, 'Không có quyền cấu hình workflow');
    }
    return createResponse_(true, 'Đã xóa', workflowDelete_(body));
  }

  // Đổi tên Workflow (áp cho mọi US của workflow đó) (admin only)
  if (action === 'workflow-rename') {
    if (!isAdminEmail_(body.reviewer_email || body.admin_email || '')) {
      return createResponse_(false, 'Không có quyền cấu hình workflow');
    }
    return createResponse_(true, 'Đã đổi tên workflow', workflowRename_(body));
  }

  // ── H2 Giai đoạn 3: Chấm điểm mới (hội đồng US + cá nhân) ──────

  // Hội đồng chấm điểm 1 UC (upsert theo reviewer). Auth: council member hoặc admin.
  if (action === 'council-score-submit') {
    return createResponse_(true, 'Đã ghi điểm hội đồng', submitCouncilScore_(body));
  }

  // Tiến độ chấm hội đồng của TẤT CẢ UC (map record_id → count/final). Public (đăng nhập).
  if (action === 'council-progress') {
    return createResponse_(true, 'Tiến độ chấm hội đồng', getCouncilProgress_());
  }

  // Danh sách điểm hội đồng của 1 UC + ai đã/chưa chấm + điểm cuối. Public (đăng nhập).
  if (action === 'council-score-list') {
    var csRid = params.record_id || body.record_id || body.Record_ID || '';
    if (!csRid) return createResponse_(false, 'Thiếu record_id');
    return createResponse_(true, 'Điểm hội đồng', listCouncilScores_(csRid));
  }

  // Teamlead chấm điểm cá nhân 1 thành viên (upsert theo Username). Auth: teamlead team đó / admin.
  if (action === 'personal-score-submit') {
    return createResponse_(true, 'Đã ghi điểm cá nhân', submitPersonalScore_(body));
  }

  // Danh sách điểm cá nhân (lọc theo team nếu có). Public (đăng nhập).
  if (action === 'personal-score-list') {
    var psTeam = params.team || body.team || '';
    return createResponse_(true, 'Điểm cá nhân', listPersonalScores_(psTeam));
  }

  // (CR#2) Xem trước KPI 1 member (M1 US do hội đồng + M2..M4 + trừ) cho panel chấm điểm. Public.
  if (action === 'member-kpi-preview') {
    var mkUser = params.username || body.username || body.Username || '';
    return createResponse_(true, 'KPI member', getMemberKpiPreview_(mkUser));
  }

  // Leaderboard H2: UC (bình quân hội đồng) + cá nhân. Public (đăng nhập).
  if (action === 'h2-leaderboard') {
    var h2Team  = params.team || body.team || '';
    var h2Limit = parseInt(params.limit || body.limit || '50', 10);
    return createResponse_(true, 'Leaderboard H2', getH2Leaderboard_(h2Team, h2Limit));
  }

  // KPI tổng hợp (Đợt 2): member (M1..M4−trừ) + teamlead (60/40) + center_avg (cho PM). Public.
  if (action === 'kpi-leaderboard') {
    var klTeam = params.team || body.team || '';
    return createResponse_(true, 'KPI tổng hợp', getKpiLeaderboard_(klTeam));
  }

  // Xác nhận tái dùng UC (T05/M05). Auth: người đăng nhập (token/reviewer_email); không tự UC mình.
  if (action === 'reuse-confirm') {
    return createResponse_(true, 'Đã ghi nhận tái dùng', submitReuseConfirm_(body));
  }

  // Số người tái dùng mỗi UC (map record_id → count). Public (đăng nhập).
  if (action === 'reuse-counts') {
    return createResponse_(true, 'Số lượt tái dùng', getReuseCounts_());
  }

  return createResponse_(false, 'Endpoint không tồn tại: ' + action);
}

// ─────────────────────────────────────────────────────────────────
// Keep-warm: chạy mỗi 4 phút qua Apps Script Time-driven trigger
//
// Cách setup (làm 1 lần trong GAS console):
//   1. Mở project GAS → bên trái chọn "Triggers" (⏰)
//   2. "+ Add Trigger" → Function: keepWarm_
//   3. Event source: Time-driven → Minutes timer → Every 4 minutes
//   4. Save
//
// Mục đích: Giữ GAS V8 runtime luôn warm → loại bỏ cold start 5-15s
// khi user submit use case.
// ─────────────────────────────────────────────────────────────────
function keepWarm_() {
  // Lightweight no-op: chỉ log timestamp để trigger runtime khởi động
  Logger.log('[keep-warm] ' + new Date().toISOString());
}

// ─────────────────────────────────────────────────────────────────
// Payload decoder — base64url → UTF-8 JSON string → object
// ─────────────────────────────────────────────────────────────────

function decodePayload_(payloadParam) {
  try {
    // base64url → base64 chuẩn
    var b64 = payloadParam
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    // Pad nếu cần
    while (b64.length % 4 !== 0) b64 += '=';

    // GAS: base64Decode trả byte[]
    var bytes  = Utilities.base64Decode(b64);
    // Chuyển bytes → string UTF-8 (hỗ trợ tiếng Việt)
    var str    = Utilities.newBlob(bytes).getDataAsString('UTF-8');
    return JSON.parse(str);
  } catch (decErr) {
    Logger.log('decodePayload_ error: ' + decErr.message + ' | input: ' + payloadParam.substring(0, 100));
    return {};
  }
}
