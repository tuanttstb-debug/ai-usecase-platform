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

// Giữ lại doPost để tương thích nếu có request cũ,
// nhưng convert sang GET handler bằng cách đọc body
function doPost(e) {
  var params = e.parameter || {};
  var action = String(params.action || '').trim();
  var body   = {};

  if (e.postData && e.postData.contents) {
    try { body = JSON.parse(e.postData.contents); }
    catch (ex) {
      return sendJson_(createResponse_(false, 'Request body không phải JSON: ' + ex.message));
    }
  }

  if (!action && body.action) action = String(body.action).trim();
  if (!action && e.pathInfo)  action = String(e.pathInfo).replace(/^\/+/, '').trim();

  try {
    return sendJson_(route_(action, params, body));
  } catch (err) {
    logError_('doPost action=' + action, err, { body: body });
    return sendJson_(createResponse_(false, err.message || 'Lỗi server nội bộ'));
  }
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
      filter:   params.filter   || '',
      status:   params.status   || '',
      team:     params.team     || '',
      category: params.category || '',
      limit:    params.limit    || '100'
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

  // ── User management endpoints ──────────────────────────────────

  // Validate login + update Last_Login + trả về user info từ USERS sheet
  if (action === 'user-login') {
    var loginUser = params.username || body.username || '';
    if (!loginUser) return createResponse_(false, 'Thiếu username');
    return createResponse_(true, 'Đăng nhập thành công', validateUserLogin_(loginUser));
  }

  // Danh sách tất cả user (để admin quản lý)
  if (action === 'users') {
    var rawUsers = getAllUsers_();
    return createResponse_(true, 'Danh sách user', rawUsers.map(function(u) {
      return {
        username:     normalizeUser_(u.Username),
        display_name: u.Display_Name || '',
        role:         normalizeUser_(u.Role || 'user'),
        team:         u.Team  || '',
        email:        u.Email || '',
        active:       (u.Active === true || String(u.Active).toUpperCase() === 'TRUE'),
        created_at:   u.Created_At || '',
        last_login:   u.Last_Login || ''
      };
    }));
  }

  // Tạo mới hoặc cập nhật user (admin only)
  if (action === 'user-upsert') {
    var upsertAdmin = body.reviewer_email || body.admin_email || '';
    if (!isAdminEmail_(upsertAdmin)) {
      return createResponse_(false, 'Không có quyền quản lý user: ' + upsertAdmin);
    }
    var upsertUsername = body.Username || body.username || '';
    if (!upsertUsername) return createResponse_(false, 'Thiếu Username');
    body.Username = upsertUsername;
    var upsertResult = upsertUser_(body);
    return createResponse_(true, upsertResult.created ? 'Đã tạo user mới' : 'Đã cập nhật user', upsertResult);
  }

  // Đồng bộ USERS sheet từ MASTER_DATA (admin only)
  if (action === 'user-sync') {
    var syncAdmin = body.reviewer_email || body.admin_email || params.admin_email || '';
    if (!isAdminEmail_(syncAdmin)) {
      return createResponse_(false, 'Không có quyền thực hiện sync: ' + syncAdmin);
    }
    return createResponse_(true, 'Sync hoàn tất', syncUsersFromMasterData_());
  }

  // Khởi tạo sheet USERS + seed từ ADMIN_EMAILS (admin only, gọi 1 lần)
  if (action === 'user-init') {
    var initAdmin = body.reviewer_email || body.admin_email || params.admin_email || '';
    if (!isAdminEmail_(initAdmin)) {
      return createResponse_(false, 'Không có quyền khởi tạo: ' + initAdmin);
    }
    initUsersSheet_();
    return createResponse_(true, 'Sheet USERS đã được khởi tạo', { status: 'ok' });
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
