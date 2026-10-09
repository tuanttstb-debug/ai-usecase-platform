// ─────────────────────────────────────────────────────────────────
// ExerciseService.gs — CR (2026-09-12): "Bài tập AI"
//
// Chia sẻ các thao tác AI nhỏ (chưa đủ thành Use Case): mô tả ngắn + prompt +
// link demo (ổ chung). Có trang tra cứu như thư viện.
// Sheet: AI_EXERCISE. Demo = link ổ chung (KHÔNG upload file → data-boundary an toàn).
//
// CR-A (2026-10-09, D69/D70): bài tập TÍNH KPI M-KPI-2.
//   • Bài nộp thêm 4 ô: giờ trước/sau · kiểm chứng lỗi AI · mẫu dùng lại · gắn hạng mục việc lớn.
//   • Cho CHỌN TUẦN khi nộp/sửa (nộp bù tuần trước — không cho tuần tương lai).
//   • Teamlead (hoặc admin/PM) chấm Đạt/Chưa đạt TỪNG BÀI qua route exercise-review:
//     bài Đạt = ≥3/4 tiêu chí (1 việc thật có đầu vào/ra · 2 giờ trước/sau · 3 kiểm chứng lỗi AI · 4 mẫu dùng lại).
//     Không tự chấm bài của mình (bài của teamlead do PM/admin chấm).
//   • Chủ bài sửa bài đã chấm → bài về "Chờ chấm" (teamlead chấm lại). Bài cũ tuần 40–41 bổ sung ô mới
//     bằng nút Sửa, teamlead chấm bù — không phải nộp lại.
//
// Routes (Code.gs): exercise-list · exercise-create · exercise-update · exercise-delete · exercise-review
// Auth create/update/delete: mô hình nhẹ như weekly-update (client gửi requester_email + is_admin);
//   sửa/xóa chỉ chủ bài (email khớp Owner_Email) HOẶC admin. Xóa = mềm (Active=FALSE).
// Auth review: token (validateToken_) → fallback reviewer_email; admin hoặc teamlead của team bài.
// ─────────────────────────────────────────────────────────────────

// Sinh Exercise_ID dạng EX-000N (đọc max hiện có +1). Volume thấp → không cần lock.
function _nextExerciseId_() {
  var all;
  try { all = readSheetAsObjects_(SHEETS.AI_EXERCISE); } catch (e) { all = []; }
  var max = 0;
  (all || []).forEach(function (r) {
    var m = /^EX-(\d+)$/.exec(String(r.Exercise_ID || '').trim());
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  var next = max + 1;
  return 'EX-' + (next < 1000 ? ('000' + next).slice(-4) : String(next));
}

// Tuần của bài: tuần client chọn (hợp lệ, không vượt tuần hiện tại) — mặc định tuần hiện tại.
function _exWeekFor_(week) {
  var cur = _isoWeek_();
  if (!_validWeek_(week)) return cur;
  if (String(week) > cur) throw new Error('Không nộp bài cho tuần tương lai (' + week + ')');
  return String(week);
}

// Giờ làm (giờ/lần): rỗng → '' ; số âm/không phải số → lỗi.
function _exHours_(v, label) {
  var s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!s) return '';
  var n = parseFloat(s);
  if (isNaN(n) || n < 0) throw new Error(label + ' phải là số giờ ≥ 0');
  return Math.round(n * 100) / 100;
}

// 4 ô mới (CR-A). Dùng chung create/update.
function _exExtraFields_(data) {
  return {
    Hours_Before:   _exHours_(data.Hours_Before, 'Giờ làm trước khi có AI'),
    Hours_After:    _exHours_(data.Hours_After, 'Giờ làm sau khi có AI'),
    AI_Check:       sanitizeStr_(data.AI_Check || '', 2000),
    Reuse_Template: sanitizeStr_(data.Reuse_Template || '', 1000),
    Big_Task_Ref:   sanitizeStr_(data.Big_Task_Ref || '', 60)
  };
}

function createExercise_(data) {
  data = data || {};
  var title  = sanitizeStr_(data.Title  || '', 200);
  var prompt = sanitizeStr_(data.Prompt || '', 8000);
  if (!title)  throw new Error('Thiếu Tiêu đề bài tập');
  if (!prompt) throw new Error('Thiếu Prompt');

  ensureSheetColumns_(SHEETS.AI_EXERCISE, AI_EXERCISE_HEADERS);
  var now = new Date().toISOString();
  var week = _exWeekFor_(data.Week);
  var id  = _nextExerciseId_();
  var row = _learnMerge_({
    Exercise_ID: id,
    Title:       title,
    Description: sanitizeStr_(data.Description || '', 2000),
    Prompt:      prompt,
    Demo_Link:   sanitizeStr_(data.Demo_Link || '', 1000),
    Owner_Name:  sanitizeStr_(data.Owner_Name  || '', 200),
    Owner_Email: sanitizeStr_(data.Owner_Email || '', 200),
    Team:        sanitizeStr_(data.Team || '', 120),
    Created_At:  now,
    Updated_At:  now,
    Active:      'TRUE',
    Week:        week,
    Review_Status: ''
  }, _exExtraFields_(data));
  appendRowFromObject_(SHEETS.AI_EXERCISE, row);
  // CR (2026-10-01 #2): bài nộp = bài tập tuần → đánh dấu "Đã nộp" ở BAI_TAP_TUAN (không chặn nếu lỗi)
  try { _learnMarkSubmitted_(row.Owner_Email, week, id, row.Owner_Name, row.Team); }
  catch (e) { logError_('exercise-create markSubmitted', e, { id: id }); }
  return { exercise_id: id, week: week };
}

function _exerciseOut_(r) {
  return {
    exercise_id:     r.Exercise_ID || '',
    title:           r.Title       || '',
    description:     r.Description  || '',
    prompt:          r.Prompt       || '',
    demo_link:       r.Demo_Link    || '',
    owner_name:      r.Owner_Name   || '',
    owner_email:     r.Owner_Email  || '',
    team:            r.Team         || '',
    week:            r.Week         || '',
    created_at:      r.Created_At   || '',
    hours_before:    r.Hours_Before === undefined ? '' : r.Hours_Before,
    hours_after:     r.Hours_After  === undefined ? '' : r.Hours_After,
    ai_check:        r.AI_Check       || '',
    reuse_template:  r.Reuse_Template || '',
    big_task_ref:    r.Big_Task_Ref   || '',
    review_status:   String(r.Review_Status || '').trim(),
    review_criteria: String(r.Review_Criteria || ''),
    reviewed_by:     r.Reviewed_By    || '',
    reviewed_at:     r.Reviewed_At    || '',
    review_comment:  r.Review_Comment || ''
  };
}

function listExercises_() {
  var all;
  try { all = readSheetAsObjects_(SHEETS.AI_EXERCISE); } catch (e) { return []; }
  if (!all || !all.length) return [];
  // Sheets tự ép chuỗi 'TRUE'/'FALSE' thành boolean → đọc lại là false/true.
  // So khớp bất biến hoa/thường + boolean (đồng nhất LookupService/AuthTokenService).
  var out = all.filter(function (r) { return r.Active !== false && String(r.Active).toUpperCase() !== 'FALSE'; });
  out.sort(function (a, b) { return new Date(b.Created_At || 0) - new Date(a.Created_At || 0); });
  return out.map(_exerciseOut_);
}

// Kiểm quyền: chủ bài (email khớp) hoặc admin.
function _canManageExercise_(existing, data) {
  var reqEmail = normalizeUser_(data.requester_email || data.Owner_Email || '');
  var isAdmin  = (String(data.is_admin) === 'true' || data.is_admin === true);
  var ownerEmail = normalizeUser_(existing.Owner_Email || '');
  return isAdmin || (!!reqEmail && reqEmail === ownerEmail);
}

function updateExercise_(data) {
  data = data || {};
  var id = sanitizeStr_(data.Exercise_ID || '');
  if (!id) throw new Error('Thiếu Exercise_ID');
  var existing = findObjectByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id);
  if (!existing) throw new Error('Không tìm thấy bài tập: ' + id);
  if (!_canManageExercise_(existing, data)) throw new Error('Bạn không có quyền sửa bài này');

  var title  = sanitizeStr_(data.Title  || '', 200);
  var prompt = sanitizeStr_(data.Prompt || '', 8000);
  if (!title)  throw new Error('Thiếu Tiêu đề bài tập');
  if (!prompt) throw new Error('Thiếu Prompt');

  ensureSheetColumns_(SHEETS.AI_EXERCISE, AI_EXERCISE_HEADERS);
  var updates = _learnMerge_({
    Title:       title,
    Description: sanitizeStr_(data.Description || '', 2000),
    Prompt:      prompt,
    Demo_Link:   sanitizeStr_(data.Demo_Link || '', 1000),
    Updated_At:  new Date().toISOString()
  }, _exExtraFields_(data));

  // Đổi tuần (nộp bù / gắn nhầm tuần) — chỉ khi client gửi tuần hợp lệ khác tuần cũ.
  var oldWeek = String(existing.Week || '').trim();
  var newWeek = _validWeek_(data.Week) ? _exWeekFor_(data.Week) : oldWeek;
  if (newWeek && newWeek !== oldWeek) updates.Week = newWeek;

  // Chủ bài tự sửa bài đã chấm → về "Chờ chấm" để teamlead chấm lại (admin sửa hộ thì giữ kết quả chấm).
  var requester = normalizeUser_(data.requester_email || '');
  var reviewed = String(existing.Review_Status || '').trim() !== '';
  var resetReview = reviewed && requester && requester === normalizeUser_(existing.Owner_Email);
  if (resetReview) {
    updates.Review_Status = ''; updates.Review_Criteria = '';
    updates.Reviewed_By = ''; updates.Reviewed_At = '';
    updates.Review_Comment = 'Chủ bài sửa sau khi chấm — chờ chấm lại';
  }
  updateRowByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id, updates);

  if (updates.Week) {
    try {
      _learnMarkSubmitted_(existing.Owner_Email, newWeek, id, existing.Owner_Name, existing.Team);
      _learnUnmarkSubmitted_(existing.Owner_Email, oldWeek, id);
    } catch (e) { logError_('exercise-update week move', e, { id: id }); }
  }
  return { exercise_id: id, week: newWeek, review_reset: !!resetReview };
}

function deleteExercise_(data) {
  data = data || {};
  var id = sanitizeStr_(data.Exercise_ID || '');
  if (!id) throw new Error('Thiếu Exercise_ID');
  var existing = findObjectByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id);
  if (!existing) throw new Error('Không tìm thấy bài tập: ' + id);
  if (!_canManageExercise_(existing, data)) throw new Error('Bạn không có quyền xóa bài này');
  updateRowByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id, { Active: 'FALSE', Updated_At: new Date().toISOString() });
  // Gỡ mã bài khỏi dòng tuần (hết bài → tuần về "Kế hoạch") — lỗi phát hiện khi nghiệm thu live 09/10.
  try { _learnUnmarkSubmitted_(existing.Owner_Email, String(existing.Week || ''), id); } catch (e) { /* không chặn xóa */ }
  return { exercise_id: id, deleted: true };
}

// "1,2,4" | [1,2,4] | ['1','3'] → [1,2,4] (duy nhất, chỉ 1..4, tăng dần).
function _exCriteria_(v) {
  var arr = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;\s]+/);
  var seen = {};
  arr.forEach(function (x) { var n = parseInt(x, 10); if (n >= 1 && n <= 4) seen[n] = 1; });
  return Object.keys(seen).map(Number).sort();
}

/**
 * CR-A: teamlead chấm Đạt/Chưa đạt 1 bài. body: { Exercise_ID, action: 'pass'|'fail'|'reset',
 *   Criteria: "1,2,4" | [..], Review_Comment?, token?/reviewer_email? }
 * Đạt bắt buộc ≥3/4 tiêu chí. Không tự chấm bài của mình. Auth: admin hoặc teamlead team của bài.
 */
function reviewExercise_(body) {
  body = body || {};
  var id = sanitizeStr_(body.Exercise_ID || '');
  if (!id) throw new Error('Thiếu Exercise_ID');
  var action = String(body.action || '').toLowerCase();
  if (['pass', 'fail', 'reset'].indexOf(action) === -1) throw new Error('action phải là pass/fail/reset');

  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người chấm (token hoặc reviewer_email).');

  var ex = findObjectByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id);
  if (!ex || ex.Active === false || String(ex.Active).toUpperCase() === 'FALSE') throw new Error('Không tìm thấy bài tập: ' + id);
  var owner = normalizeUser_(ex.Owner_Email);
  if (owner && owner === rv.username) throw new Error('Không tự chấm bài của chính mình — bài của teamlead do PM chấm.');

  var team = String(ex.Team || '').trim();
  if (!team) {
    try {
      getAllUsersFromMaster_().forEach(function (u) { if (normalizeUser_(u.username) === owner) team = u.team || ''; });
    } catch (e) { /* best-effort */ }
  }
  if (!isAdminEmail_(rv.username) && !isChampionForTeam_(rv.username, team)) {
    throw new Error('Chỉ teamlead của team "' + team + '" (hoặc admin) mới được chấm bài này.');
  }

  var crit = _exCriteria_(body.Criteria);
  if (action === 'pass' && crit.length < EXERCISE_PASS_MIN_CRITERIA) {
    throw new Error('Bài Đạt cần ≥' + EXERCISE_PASS_MIN_CRITERIA + '/4 tiêu chí (đang chọn ' + crit.length + ').');
  }
  var comment = sanitizeStr_(body.Review_Comment || body.comment || '', 500);
  var now = new Date().toISOString();
  var status = action === 'pass' ? EXERCISE_REVIEW.PASS : (action === 'fail' ? EXERCISE_REVIEW.FAIL : '');

  ensureSheetColumns_(SHEETS.AI_EXERCISE, AI_EXERCISE_HEADERS);
  updateRowByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id, {
    Review_Status:   status,
    Review_Criteria: action === 'reset' ? '' : crit.join(','),
    Reviewed_By:     action === 'reset' ? '' : rv.username,
    Reviewed_At:     action === 'reset' ? '' : now,
    Review_Comment:  comment
  });
  logActivity_('', '', 'EXERCISE_REVIEW',
    rv.username + ' chấm ' + id + ' (' + owner + ', ' + (ex.Week || '') + '): ' + (status || 'mở lại') +
    (crit.length ? ' · tiêu chí ' + crit.join(',') : '') + (comment ? ' — ' + comment : ''),
    rv.username, null, null);
  return { exercise_id: id, review_status: status, criteria: crit, week: String(ex.Week || '') };
}
