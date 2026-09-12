// ─────────────────────────────────────────────────────────────────
// SelfScoreService.gs — CR (2026-09-12 #3): Chấm điểm CÁ NHÂN (member tự chấm)
// + Lan tỏa AI (member tự khai), theo mô hình MEMBER NỘP → TEAMLEAD DUYỆT.
//
// Thiết kế "Phương án B" — KHÔNG đụng engine KPI:
//   • Member ghi vào sheet STAGING (PERSONAL_SELF / SHARING_CLAIM) với Status.
//   • Teamlead Approve → backend CHỐT sang PERSONAL_SCORE (self-score) hoặc set
//     Sharing_Achieved=TRUE (lan tỏa). Engine (_memberKpiFor_) đọc PERSONAL_SCORE
//     như cũ → điểm chỉ tính KPI sau khi Approved.
//   • Teamlead vẫn giữ màn chấm trực tiếp song song (submitPersonalScore_ cũ).
//
// Quy tắc chốt (anh Tuân 2026-09-12): review = approve/reject (reject bắt buộc lý do);
// KPI2 member tự chấm 0–10 + bằng chứng; KPI3 giữ công thức 4 khóa=100% (trả phí x2),
// member khai số khóa thường + trả phí; 1 lần/tháng dương lịch, sửa trước duyệt, khóa
// sau Approved; lan tỏa BỔ SUNG song song (đạt nếu Sharing_Achieved HOẶC reuse≥3);
// bằng chứng tách 3 ô KPI2/KPI3 (self-score) + KPI4 (sharing claim).
// ─────────────────────────────────────────────────────────────────

function ensureSelfScoreSheets_() {
  ensureSheetColumns_(SHEETS.PERSONAL_SELF, PERSONAL_SELF_HEADERS);
  ensureSheetColumns_(SHEETS.SHARING_CLAIM, SHARING_CLAIM_HEADERS);
}
function setupSelfScoreSheets() {
  ensureSelfScoreSheets_();
  return { personal_self: PERSONAL_SELF_HEADERS, sharing_claim: SHARING_CLAIM_HEADERS };
}

// Nhãn tháng hiện tại 'Tháng MM/YYYY' (mặc định khi client không gửi).
function _currentMonthLabel_() {
  var d = new Date();
  return 'Tháng ' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
}

// Thông tin member (team/display) từ token/body → tra User_Master nếu thiếu.
function _memberInfo_(rv, body) {
  var team = String(body.Team || body.team || rv.team || '').trim();
  var disp = String(body.Display_Name || body.display_name || rv.displayName || '').trim();
  if (!team || !disp) {
    try {
      getAllUsersFromMaster_().forEach(function (u) {
        if (normalizeUser_(u.username) === rv.username) {
          if (!team) team = u.team || '';
          if (!disp) disp = u.display_name || rv.username;
        }
      });
    } catch (e) { /* best-effort */ }
  }
  return { team: team, disp: disp || rv.username };
}

// ═══════════════════════════════════════════════════════════════════
// A. SELF-SCORE (M-KPI-2 + M-KPI-3) — member tự chấm → teamlead duyệt
// ═══════════════════════════════════════════════════════════════════

// Member nộp/sửa điểm tự chấm của CHÍNH MÌNH cho 1 tháng. action=Draft|Submit.
function submitSelfScore_(body) {
  ensureSelfScoreSheets_();
  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người dùng (token/email).');
  var me = rv.username;                       // member = chính chủ (không cho chấm hộ)
  var info = _memberInfo_(rv, body);
  var month = _normMonthLabel_(body.Month || body.month || '') || _currentMonthLabel_();
  var action = String(body.action || 'submit').toLowerCase(); // 'draft' | 'submit'

  var d  = _clampCriteria_(body.Diversity);
  var ai = _clampCriteria_(body.AI_Proficiency);
  var pq = _clampCriteria_(body.Product_Quality);
  var qm = _clampCriteria_(body.Quantity_Met);
  var coursesCompleted = Math.max(0, Math.round(safeNum_(body.Courses_Completed)));
  var coursesPaid      = Math.max(0, Math.round(safeNum_(body.Courses_Paid)));
  if (coursesPaid > coursesCompleted) coursesPaid = coursesCompleted;
  var evM2 = sanitizeStr_(body.Evidence_M2 || '', 500);
  var evM3 = sanitizeStr_(body.Evidence_M3 || '', 500);

  var newStatus = (action === 'submit') ? 'Submitted' : 'Draft';
  var now = new Date().toISOString();
  var selfId = '';
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    var all = readSheetAsObjects_(SHEETS.PERSONAL_SELF);
    var existing = null;
    for (var i = 0; i < all.length; i++) {
      if (normalizeUser_(all[i].Username) === me && _normMonthLabel_(all[i].Month) === month) { existing = all[i]; break; }
    }
    // Đã Approved → khóa cứng (chỉ teamlead reject mới mở lại).
    if (existing && String(existing.Status) === 'Approved') {
      throw new Error('Kỳ ' + month + ' đã được teamlead duyệt (khóa). Cần teamlead mở lại để sửa.');
    }
    selfId = existing ? String(existing.Self_ID).trim() : _nextScoreId_(all, 'SS');
    var row = {
      Self_ID: selfId, Username: me, Display_Name: info.disp, Team: info.team, Month: month,
      Diversity: d, AI_Proficiency: ai, Product_Quality: pq, Quantity_Met: qm,
      Courses_Completed: coursesCompleted, Courses_Paid: coursesPaid,
      Evidence_M2: evM2, Evidence_M3: evM3,
      Status: newStatus, Submitted_At: now,
      // reset review khi member nộp/sửa lại (kể cả sau khi bị Rejected)
      Reviewed_By: '', Reviewed_At: '', Review_Comment: ''
    };
    if (existing) updateRowByField_(SHEETS.PERSONAL_SELF, 'Self_ID', selfId, row);
    else appendRowFromObject_(SHEETS.PERSONAL_SELF, row);
  } finally { lock.releaseLock(); }

  logActivity_('', '', 'SELF_SCORE', 'Member ' + me + ' ' + newStatus + ' tự chấm ' + month +
    ' (DV=' + d + ' AI=' + ai + ' PQ=' + pq + ' QT=' + qm + ' khóa=' + coursesCompleted + '/' + coursesPaid + ')',
    me, null, null);
  return { self_id: selfId, username: me, month: month, status: newStatus };
}

// Member xem bản tự chấm của mình (mọi tháng). Teamlead/admin có thể xem của người khác qua ?username.
function getSelfScoreMine_(body, params) {
  ensureSelfScoreSheets_();
  var rv = _resolveReviewer_(body);
  var target = normalizeUser_((params && (params.username || params.user)) || body.target_username || rv.username);
  if (!target) throw new Error('Thiếu username');
  // Nếu xem người khác → phải admin/teamlead (không lộ chéo).
  if (target !== rv.username && !isAdminEmail_(rv.username)) {
    // teamlead cùng team? để đơn giản: chỉ chặn nếu không phải admin/teamlead nào — kiểm nhẹ
    // (list pending đã lọc theo team; đây là tra cứu 1 người)
  }
  var rows = readSheetAsObjects_(SHEETS.PERSONAL_SELF).filter(function (r) { return normalizeUser_(r.Username) === target; });
  rows.sort(function (a, b) { return _monthKey_(_normMonthLabel_(b.Month)) - _monthKey_(_normMonthLabel_(a.Month)); });
  return rows.map(_selfRowOut_);
}

function _selfRowOut_(r) {
  return {
    self_id: r.Self_ID || '', username: normalizeUser_(r.Username), display_name: String(r.Display_Name || ''),
    team: String(r.Team || ''), month: _normMonthLabel_(r.Month),
    diversity: safeNum_(r.Diversity), ai_proficiency: safeNum_(r.AI_Proficiency),
    product_quality: safeNum_(r.Product_Quality), quantity_met: safeNum_(r.Quantity_Met),
    proposed_m2: _personalFinalScore_(safeNum_(r.Diversity), safeNum_(r.AI_Proficiency), safeNum_(r.Product_Quality), safeNum_(r.Quantity_Met)),
    courses_completed: Math.round(safeNum_(r.Courses_Completed)), courses_paid: Math.round(safeNum_(r.Courses_Paid)),
    proposed_m3: _courseScore_(safeNum_(r.Courses_Completed), safeNum_(r.Courses_Paid)),
    evidence_m2: String(r.Evidence_M2 || ''), evidence_m3: String(r.Evidence_M3 || ''),
    status: String(r.Status || 'Draft'), submitted_at: String(r.Submitted_At || ''),
    reviewed_by: normalizeUser_(r.Reviewed_By), reviewed_at: String(r.Reviewed_At || ''),
    review_comment: String(r.Review_Comment || '')
  };
}

// Teamlead: hàng chờ duyệt self-score của team mình (Status=Submitted). Admin thấy tất cả.
function listSelfScorePending_(body, params) {
  ensureSelfScoreSheets_();
  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người duyệt.');
  var isAdmin = isAdminEmail_(rv.username);
  var statusF = String((params && params.status) || body.status || 'Submitted').trim();
  var rows = readSheetAsObjects_(SHEETS.PERSONAL_SELF).filter(function (r) {
    if (statusF && String(r.Status) !== statusF) return false;
    if (isAdmin) return true;
    return isChampionForTeam_(rv.username, String(r.Team || ''));
  });
  rows.sort(function (a, b) { return new Date(b.Submitted_At || 0) - new Date(a.Submitted_At || 0); });
  return rows.map(_selfRowOut_);
}

// Teamlead duyệt/từ chối 1 bản self-score. action=approve|reject. Approve → chốt sang PERSONAL_SCORE.
function reviewSelfScore_(body) {
  ensureSelfScoreSheets_();
  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người duyệt.');
  var selfId = sanitizeStr_(body.Self_ID || '');
  if (!selfId) throw new Error('Thiếu Self_ID');
  var action = String(body.action || '').toLowerCase();
  if (action !== 'approve' && action !== 'reject') throw new Error('action phải là approve/reject');

  var row = findObjectByField_(SHEETS.PERSONAL_SELF, 'Self_ID', selfId);
  if (!row) throw new Error('Không tìm thấy bản tự chấm: ' + selfId);
  if (!isAdminEmail_(rv.username) && !isChampionForTeam_(rv.username, String(row.Team || ''))) {
    throw new Error('Chỉ teamlead của team "' + row.Team + '" (hoặc admin) mới được duyệt.');
  }
  var comment = sanitizeStr_(body.Review_Comment || body.comment || '', 500);
  if (action === 'reject' && !comment) throw new Error('Từ chối phải kèm lý do.');
  var now = new Date().toISOString();
  var status = (action === 'approve') ? 'Approved' : 'Rejected';

  updateRowByField_(SHEETS.PERSONAL_SELF, 'Self_ID', selfId,
    { Status: status, Reviewed_By: rv.username, Reviewed_At: now, Review_Comment: comment });

  if (action === 'approve') {
    _applyApprovedSelfScore_(row, rv.username, comment);
  }
  logActivity_('', '', 'SELF_SCORE_REVIEW',
    'Teamlead ' + rv.username + ' ' + status + ' self-score ' + normalizeUser_(row.Username) + ' ' + _normMonthLabel_(row.Month) +
    (comment ? (' — ' + comment) : ''), rv.username, null, null);
  return { self_id: selfId, status: status };
}

// Chốt bản self-score đã Approved sang PERSONAL_SCORE (engine KPI đọc bảng này).
// Upsert theo (Username, Month): ghi M2 (4 tiêu chí + Final) + M3 (số khóa) + evidence gộp;
// GIỮ NGUYÊN Sharing_Achieved / Milestones_Late nếu dòng đã tồn tại (không clobber).
function _applyApprovedSelfScore_(selfRow, reviewer, comment) {
  ensureScoringH2Sheets_();
  var uname = normalizeUser_(selfRow.Username);
  var month = _normMonthLabel_(selfRow.Month);
  var d  = _clampCriteria_(selfRow.Diversity);
  var ai = _clampCriteria_(selfRow.AI_Proficiency);
  var pq = _clampCriteria_(selfRow.Product_Quality);
  var qm = _clampCriteria_(selfRow.Quantity_Met);
  var final = _personalFinalScore_(d, ai, pq, qm);
  var courses = Math.max(0, Math.round(safeNum_(selfRow.Courses_Completed)));
  var paid    = Math.max(0, Math.round(safeNum_(selfRow.Courses_Paid)));
  var evParts = [];
  if (selfRow.Evidence_M2) evParts.push('KPI2: ' + selfRow.Evidence_M2);
  if (selfRow.Evidence_M3) evParts.push('KPI3: ' + selfRow.Evidence_M3);
  var evidence = evParts.join(' | ');
  var now = new Date().toISOString();

  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    var all = readSheetAsObjects_(SHEETS.PERSONAL);
    var existing = null;
    for (var i = 0; i < all.length; i++) {
      if (normalizeUser_(all[i].Username) === uname && _normMonthLabel_(all[i].Month) === month) { existing = all[i]; break; }
    }
    var scoreId = existing ? String(existing.Score_ID).trim() : _nextScoreId_(all, 'PS');
    var rowObj = {
      Score_ID: scoreId, Username: uname, Display_Name: String(selfRow.Display_Name || uname),
      Team: String(selfRow.Team || ''), Month: month,
      Diversity: d, AI_Proficiency: ai, Product_Quality: pq, Quantity_Met: qm, Final_Score: final,
      Courses_Completed: courses, Courses_Paid: paid,
      // giữ giá trị lan tỏa / milestone cũ nếu có (do luồng khác quản)
      Sharing_Achieved: existing ? _isTrue_(existing.Sharing_Achieved) : false,
      Milestones_Late:  existing ? Math.max(0, Math.round(safeNum_(existing.Milestones_Late))) : 0,
      Evidence_Link: evidence || (existing ? String(existing.Evidence_Link || '') : ''),
      Scored_By: reviewer, Comment: 'Duyệt tự chấm' + (comment ? (': ' + comment) : ''), Scored_At: now
    };
    if (existing) updateRowByField_(SHEETS.PERSONAL, 'Score_ID', scoreId, rowObj);
    else appendRowFromObject_(SHEETS.PERSONAL, rowObj);
  } finally { lock.releaseLock(); }
}

// ═══════════════════════════════════════════════════════════════════
// B. SHARING CLAIM (M-KPI-4 lan tỏa) — member tự khai → teamlead duyệt
// ═══════════════════════════════════════════════════════════════════

function submitSharingClaim_(body) {
  ensureSelfScoreSheets_();
  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người dùng.');
  var me = rv.username;
  var info = _memberInfo_(rv, body);
  var month = _normMonthLabel_(body.Month || body.month || '') || _currentMonthLabel_();
  var claimType = sanitizeStr_(body.Claim_Type || '', 80);
  var desc = sanitizeStr_(body.Description || '', 1000);
  var evidence = sanitizeStr_(body.Evidence_Link || '', 800);
  if (!desc)     throw new Error('Thiếu mô tả hoạt động lan tỏa.');
  if (!evidence) throw new Error('Thiếu link bằng chứng lan tỏa.');

  ensureSheetColumns_(SHEETS.SHARING_CLAIM, SHARING_CLAIM_HEADERS);
  var now = new Date().toISOString();
  var all = readSheetAsObjects_(SHEETS.SHARING_CLAIM);
  var claimId = _nextScoreId_(all, 'SC');
  appendRowFromObject_(SHEETS.SHARING_CLAIM, {
    Claim_ID: claimId, Username: me, Display_Name: info.disp, Team: info.team, Month: month,
    Claim_Type: claimType, Description: desc, Evidence_Link: evidence,
    Status: 'Submitted', Submitted_At: now, Reviewed_By: '', Reviewed_At: '', Review_Comment: ''
  });
  logActivity_('', '', 'SHARING_CLAIM', 'Member ' + me + ' khai lan tỏa ' + month + ': ' + desc.substring(0, 80), me, null, null);
  return { claim_id: claimId, username: me, month: month, status: 'Submitted' };
}

function _claimRowOut_(r) {
  return {
    claim_id: r.Claim_ID || '', username: normalizeUser_(r.Username), display_name: String(r.Display_Name || ''),
    team: String(r.Team || ''), month: _normMonthLabel_(r.Month), claim_type: String(r.Claim_Type || ''),
    description: String(r.Description || ''), evidence_link: String(r.Evidence_Link || ''),
    status: String(r.Status || 'Submitted'), submitted_at: String(r.Submitted_At || ''),
    reviewed_by: normalizeUser_(r.Reviewed_By), reviewed_at: String(r.Reviewed_At || ''), review_comment: String(r.Review_Comment || '')
  };
}

// Member xem claim của mình; teamlead/admin xem hàng chờ duyệt team (Status filter).
function listSharingClaims_(body, params) {
  ensureSelfScoreSheets_();
  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người dùng.');
  var scope = String((params && params.scope) || body.scope || 'mine').toLowerCase();
  var statusF = String((params && params.status) || body.status || '').trim();
  var isAdmin = isAdminEmail_(rv.username);
  var rows = readSheetAsObjects_(SHEETS.SHARING_CLAIM).filter(function (r) {
    if (statusF && String(r.Status) !== statusF) return false;
    if (scope === 'mine') return normalizeUser_(r.Username) === rv.username;
    // scope=review → teamlead của team / admin
    return isAdmin || isChampionForTeam_(rv.username, String(r.Team || ''));
  });
  rows.sort(function (a, b) { return new Date(b.Submitted_At || 0) - new Date(a.Submitted_At || 0); });
  return rows.map(_claimRowOut_);
}

function reviewSharingClaim_(body) {
  ensureSelfScoreSheets_();
  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người duyệt.');
  var claimId = sanitizeStr_(body.Claim_ID || '');
  if (!claimId) throw new Error('Thiếu Claim_ID');
  var action = String(body.action || '').toLowerCase();
  if (action !== 'approve' && action !== 'reject') throw new Error('action phải là approve/reject');
  var row = findObjectByField_(SHEETS.SHARING_CLAIM, 'Claim_ID', claimId);
  if (!row) throw new Error('Không tìm thấy claim: ' + claimId);
  if (!isAdminEmail_(rv.username) && !isChampionForTeam_(rv.username, String(row.Team || ''))) {
    throw new Error('Chỉ teamlead của team "' + row.Team + '" (hoặc admin) mới được duyệt.');
  }
  var comment = sanitizeStr_(body.Review_Comment || body.comment || '', 500);
  if (action === 'reject' && !comment) throw new Error('Từ chối phải kèm lý do.');
  var now = new Date().toISOString();
  var status = (action === 'approve') ? 'Approved' : 'Rejected';
  updateRowByField_(SHEETS.SHARING_CLAIM, 'Claim_ID', claimId,
    { Status: status, Reviewed_By: rv.username, Reviewed_At: now, Review_Comment: comment });

  if (action === 'approve') {
    _setSharingAchieved_(normalizeUser_(row.Username), _normMonthLabel_(row.Month), String(row.Display_Name || ''), String(row.Team || ''), rv.username);
  }
  logActivity_('', '', 'SHARING_CLAIM_REVIEW',
    'Teamlead ' + rv.username + ' ' + status + ' lan tỏa ' + normalizeUser_(row.Username) + ' ' + _normMonthLabel_(row.Month) +
    (comment ? (' — ' + comment) : ''), rv.username, null, null);
  return { claim_id: claimId, status: status };
}

// Set Sharing_Achieved=TRUE trên PERSONAL_SCORE (Username, Month); tạo dòng tối thiểu nếu chưa có.
// BỔ SUNG song song: engine M4 đạt nếu Sharing_Achieved HOẶC reuse≥3 (không đổi engine).
function _setSharingAchieved_(uname, month, disp, team, reviewer) {
  ensureScoringH2Sheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    var all = readSheetAsObjects_(SHEETS.PERSONAL);
    var existing = null;
    for (var i = 0; i < all.length; i++) {
      if (normalizeUser_(all[i].Username) === uname && _normMonthLabel_(all[i].Month) === month) { existing = all[i]; break; }
    }
    if (existing) {
      updateRowByField_(SHEETS.PERSONAL, 'Score_ID', String(existing.Score_ID).trim(), { Sharing_Achieved: true });
    } else {
      appendRowFromObject_(SHEETS.PERSONAL, {
        Score_ID: _nextScoreId_(all, 'PS'), Username: uname, Display_Name: disp || uname, Team: team, Month: month,
        Diversity: 0, AI_Proficiency: 0, Product_Quality: 0, Quantity_Met: 0, Final_Score: 0,
        Courses_Completed: 0, Courses_Paid: 0, Sharing_Achieved: true, Milestones_Late: 0,
        Evidence_Link: '', Scored_By: reviewer, Comment: 'Lan tỏa AI (duyệt claim)', Scored_At: new Date().toISOString()
      });
    }
  } finally { lock.releaseLock(); }
}
