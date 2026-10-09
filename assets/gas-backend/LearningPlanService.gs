// ─────────────────────────────────────────────────────────────────
// LearningPlanService.gs — CR (2026-10-01): "Kế hoạch học tập" (AIUS-001 · 5 nhóm mục tiêu)
//
// Theo dõi (2) bài tập cá nhân đã đăng ký · (3) khóa học + hạn học xong · (1) việc lớn cấp TT.
// Nguồn chuẩn = 3 tab trên bảng tính (PM/teamlead sửa tay được, cột định dạng TEXT):
//   HOC_TAP_DANG_KY  1 row / member  (bài tập tuần, công cụ AI, mức dùng, nhu cầu hỗ trợ)
//   HOC_TAP_KHOA     1 row / khóa    (tên khóa, nơi học, trả phí, hạn học xong, trạng thái)
//   VIEC_LON         1 row / việc lớn (chỉ đọc trên app — PM nhập ở sheet)
// Dữ liệu ban đầu nạp từ email [AI-5NHOM] 30/09–01/10 (PM ghi thẳng sheet, không nằm trong repo).
//
//   BAI_TAP_TUAN     1 row / member / tuần (kế hoạch → đã nộp; nối với AI_EXERCISE qua Exercise_IDs)
//
// Routes (Code.gs): learning-list · learning-register (hồ sơ AI) · learning-week-plan ·
//                   learning-course-add · learning-course-update · learning-course-delete
// Bài nộp đi qua exercise-create (ExerciseService) → tự đánh dấu "Đã nộp" cho tuần của bài.
// Auth: mô hình nhẹ như Bài tập AI (client gửi requester_email + is_admin);
//   member chỉ sửa dòng của mình, admin sửa mọi dòng. Xóa khóa = mềm (Active=FALSE).
// Trạng thái "Hoàn thành" + link chứng chỉ: mở 2026-10-02 (learning-course-complete).
// CR-B (2026-10-09): M-KPI-3 đếm thẳng từ HOC_TAP_KHOA (KpiEngineH2) — bỏ ô tự khai số khóa.
// CR-C (2026-10-09): việc lớn có SỐ ĐO (VIEC_LON_SO) + PHÂN CÔNG hạng mục (VIEC_LON_PHAN_CONG) →
//   routes big-task-kr-save · big-task-assign-save (teamlead của team việc lớn / admin). VIEC_LON vẫn PM nhập.
// ─────────────────────────────────────────────────────────────────

var WEEK_STATUS = { PLAN: 'Kế hoạch', SUBMITTED: 'Đã nộp' };

// Tuần ISO 8601 theo giờ VN, dạng "2026-W40" (thứ 2 → CN). d: Date (mặc định bây giờ).
function _isoWeek_(d) {
  var ymd = Utilities.formatDate(d || new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd').split('-');
  var t = new Date(Date.UTC(+ymd[0], +ymd[1] - 1, +ymd[2]));
  var day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);              // thứ 5 cùng tuần quyết định năm ISO
  var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  var wk = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  return t.getUTCFullYear() + '-W' + (wk < 10 ? '0' + wk : wk);
}
function _validWeek_(w) { return /^\d{4}-W\d{2}$/.test(String(w || '')); }

var LEARN_STATUS = {
  REGISTERED:   'Đã đăng ký',
  NOT_YET:      'Chưa đăng ký',
  UNCLEAR:      'Chưa rõ khóa',
  DONE:         'Hoàn thành'
};

// Ngày/giờ: GAS setValues/appendRow vẫn tự đổi chuỗi "2026-10-20" thành kiểu ngày dù cột định dạng TEXT
// → ghi kèm dấu ' đầu chuỗi (_learnTxt_) để giữ text. Ô đã lỡ thành Date (gõ tay / ghi cũ) đọc lại theo
// MÚI GIỜ CỦA BẢNG TÍNH (đang America/Los_Angeles) — format theo giờ VN sẽ lệch sang ngày hôm sau.
var _learnTz_ = null;
function _learnSheetTz_() {
  if (!_learnTz_) {
    try { _learnTz_ = getSpreadsheet_().getSpreadsheetTimeZone(); } catch (e) { _learnTz_ = 'Asia/Ho_Chi_Minh'; }
  }
  return _learnTz_;
}
function _learnYmd_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, _learnSheetTz_(), 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}
function _learnStamp_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, _learnSheetTz_(), 'yyyy-MM-dd HH:mm');
  return String(v == null ? '' : v).trim();
}
function _learnTxt_(s) {
  return s ? "'" + s : '';
}
// Gộp object (không dùng Object.assign — giữ cú pháp ES5 như phần còn lại của backend).
function _learnMerge_(a, b) {
  var out = {}, k;
  for (k in a) if (a.hasOwnProperty(k)) out[k] = a[k];
  for (k in b) if (b.hasOwnProperty(k)) out[k] = b[k];
  return out;
}
function _learnNow_() {
  return _learnTxt_(Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm'));
}
function _learnIsActive_(r) {
  return r.Active !== false && String(r.Active).toUpperCase() !== 'FALSE';
}
function _learnIsAdmin_(data) {
  return String(data.is_admin) === 'true' || data.is_admin === true;
}
function _learnRequester_(data) {
  var me = normalizeUser_(data.requester_email || '');
  if (!me) throw new Error('Chưa đăng nhập');
  return me;
}
function _learnValidDate_(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
}

// Đọc 1 tab; tab chưa tạo → mảng rỗng (không đẻ sheet rác khi chỉ đọc).
function _learnRead_(sheetName) {
  try { return readSheetAsObjects_(sheetName) || []; } catch (e) { return []; }
}

function listLearningPlan_() {
  var members = _learnRead_(SHEETS.LEARN_REG).map(function (r) {
    return {
      username:      normalizeUser_(r.Username),
      display_name:  String(r.Display_Name || r.Username || ''),
      team:          String(r.Team || ''),
      status:        String(r.Status || LEARN_STATUS.NOT_YET),
      exercise_plan: String(r.Exercise_Plan || ''),
      ai_tools:      String(r.AI_Tools || ''),
      usage_level:   String(r.Usage_Level || ''),
      support_need:  String(r.Support_Need || ''),
      source:        String(r.Source || ''),
      submitted_at:  _learnStamp_(r.Submitted_At),
      note:          String(r.Note || '')
    };
  }).filter(function (m) { return !!m.username; });

  var courses = _learnRead_(SHEETS.LEARN_COURSE).filter(_learnIsActive_).map(function (r) {
    return {
      course_id:      String(r.Course_ID || ''),
      username:       normalizeUser_(r.Username),
      display_name:   String(r.Display_Name || r.Username || ''),
      team:           String(r.Team || ''),
      course_name:    String(r.Course_Name || ''),
      provider:       String(r.Provider || ''),
      paid:           String(r.Paid || ''),
      target_date:    _learnYmd_(r.Target_Date),
      status:         _learnIsDone_(r.Status) ? LEARN_STATUS.DONE : String(r.Status || LEARN_STATUS.REGISTERED).trim(),
      cert_link:      String(r.Cert_Link || ''),
      completed_date: _learnYmd_(r.Completed_Date),
      note:           String(r.Note || '')
    };
  }).filter(function (c) { return !!c.course_id; });

  var bigTasks = _learnRead_(SHEETS.BIG_TASK).map(function (r) {
    return {
      task_id:          String(r.Task_ID || ''),
      task_name:        String(r.Task_Name || ''),
      team:             String(r.Team || ''),
      source_type:      String(r.Source_Type || ''),
      lead:             normalizeUser_(r.Lead),
      participants:     String(r.Participants || ''),
      hours_before:     String(r.Hours_Before || ''),
      target_reduction: String(r.Target_Reduction || ''),
      pilot_deadline:   _learnYmd_(r.Pilot_Deadline),
      status:           String(r.Status || ''),
      note:             String(r.Note || '')
    };
  }).filter(function (t) { return !!t.task_id; });

  var weeks = _learnRead_(SHEETS.EXERCISE_WEEK).map(function (r) {
    return {
      username:     normalizeUser_(r.Username),
      display_name: String(r.Display_Name || r.Username || ''),
      team:         String(r.Team || ''),
      week:         String(r.Week || ''),
      plan:         String(r.Plan || ''),
      status:       String(r.Status || WEEK_STATUS.PLAN),
      exercise_ids: String(r.Exercise_IDs || ''),
      submitted_at: _learnStamp_(r.Submitted_At)
    };
  }).filter(function (w) { return !!w.username && _validWeek_(w.week); });

  // CR-C: số đo + phân công việc lớn, kèm % đạt / điểm OKR tính sẵn (engine KpiEngineH2).
  var krRows = _learnRead_(SHEETS.BIG_TASK_KR).filter(_learnIsActive_);
  var asRows = _learnRead_(SHEETS.BIG_TASK_ASSIGN).filter(_learnIsActive_).map(function (r) {
    return _learnMerge_(r, { Due_Date: _learnYmd_(r.Due_Date), Accepted_Date: _learnYmd_(r.Accepted_Date) });
  });
  var summary = _kpiBigTaskSummary_(_learnRead_(SHEETS.BIG_TASK), krRows, asRows);
  bigTasks.forEach(function (t) {
    var s = summary[t.task_id] || {};
    t.ratio = (s.ratio === undefined) ? null : s.ratio;
    t.okr_score = s.okr_score || 0;
    t.kr_count = s.kr_count || 0; t.measured_count = s.measured_count || 0;
    t.assign_count = s.assign_count || 0; t.pass_count = s.pass_count || 0;
  });
  var krs = krRows.map(function (k) {
    return {
      kr_id: String(k.KR_ID || ''), task_id: String(k.Task_ID || ''), kr_name: String(k.KR_Name || ''),
      unit: String(k.Unit || ''), before_value: _kNum_(k.Before_Value), target_value: _kNum_(k.Target_Value),
      actual_value: _kNum_(k.Actual_Value), ratio: _kpiKrRatio_(k) === null ? null : Math.round(_kpiKrRatio_(k) * 10) / 10,
      measured_at: _learnYmd_(k.Measured_At), note: String(k.Note || '')
    };
  }).filter(function (k) { return !!k.kr_id; });
  var assigns = asRows.map(function (a) {
    return {
      assign_id: String(a.Assign_ID || ''), task_id: String(a.Task_ID || ''), username: normalizeUser_(a.Username),
      display_name: String(a.Display_Name || a.Username || ''), team: String(a.Team || ''), role: String(a.Role || ''),
      item: String(a.Item || ''), due_date: a.Due_Date, acceptance_criteria: String(a.Acceptance_Criteria || ''),
      status: String(a.Status || ASSIGN_STATUS.DOING).trim(), accepted_date: a.Accepted_Date,
      accepted_by: normalizeUser_(a.Accepted_By), on_time_pass: _kpiAssignPassedOnTime_(a), note: String(a.Note || '')
    };
  }).filter(function (a) { return !!a.assign_id; });

  return { members: members, courses: courses, big_tasks: bigTasks, weeks: weeks, current_week: _isoWeek_(),
           krs: krs, assigns: assigns };
}

// Upsert 1 dòng BAI_TAP_TUAN theo (Username, Week). fields: object theo header. Ghi nguyên dòng.
function _learnUpsertWeek_(username, week, fields, defaults) {
  ensureSheetColumns_(SHEETS.EXERCISE_WEEK, EXERCISE_WEEK_HEADERS);
  var sheet = getOrCreateSheet_(SHEETS.EXERCISE_WEEK);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var cU = headers.indexOf('Username'), cW = headers.indexOf('Week');
  for (var i = 1; i < data.length; i++) {
    if (normalizeUser_(data[i][cU]) === username && String(data[i][cW]) === week) {
      var row = headers.map(function (h, j) {
        var v = (fields[h] !== undefined && fields[h] !== null) ? fields[h] : data[i][j];
        return toSheetValue_(v);
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return { row: i + 1, created: false, before: data[i] , headers: headers };
    }
  }
  appendRowFromObject_(SHEETS.EXERCISE_WEEK, _learnMerge_(_learnMerge_(defaults || {}, { Username: username, Week: week }), fields));
  return { created: true };
}

// Ghi kế hoạch tuần (không bắt buộc). Tuần đã nộp vẫn sửa được dòng kế hoạch, giữ trạng thái "Đã nộp".
function saveWeekPlan_(data) {
  data = data || {};
  var me = _learnRequester_(data);
  var target = normalizeUser_(data.Username || me);
  if (target !== me && !_learnIsAdmin_(data)) throw new Error('Bạn chỉ ghi được kế hoạch của mình');
  var week = _validWeek_(data.Week) ? String(data.Week) : _isoWeek_();
  var plan = sanitizeStr_(data.Plan || '', 1000);
  if (!plan) throw new Error('Thiếu kế hoạch tuần');
  var now = _learnNow_();
  var existing = _learnRead_(SHEETS.EXERCISE_WEEK).filter(function (r) {
    return normalizeUser_(r.Username) === target && String(r.Week) === week;
  })[0];
  var fields = { Plan: plan, Updated_At: now };
  if (!existing) {
    fields.Status = WEEK_STATUS.PLAN;
    fields.Plan_At = now;
  } else if (!existing.Plan_At) {
    fields.Plan_At = now;
  }
  _learnUpsertWeek_(target, week, fields, {
    Display_Name: sanitizeStr_(data.Display_Name || target, 200),
    Team:         sanitizeStr_(data.Team || '', 120)
  });
  return { username: target, week: week };
}

// Gọi từ ExerciseService.updateExercise_ khi bài chuyển sang tuần khác: gỡ Exercise_ID khỏi tuần cũ;
// tuần cũ không còn bài nào → về "Kế hoạch" (giữ dòng kế hoạch nếu có).
function _learnUnmarkSubmitted_(username, week, exerciseId) {
  username = normalizeUser_(username);
  if (!username || !_validWeek_(week)) return;
  var existing = _learnRead_(SHEETS.EXERCISE_WEEK).filter(function (r) {
    return normalizeUser_(r.Username) === username && String(r.Week) === week;
  })[0];
  if (!existing) return;
  var ids = String(existing.Exercise_IDs || '').split(',').map(function (s) { return s.trim(); })
    .filter(function (s) { return s && s !== exerciseId; });
  _learnUpsertWeek_(username, week, {
    Exercise_IDs: ids.join(', '),
    Status:       ids.length ? WEEK_STATUS.SUBMITTED : WEEK_STATUS.PLAN,
    Updated_At:   _learnNow_()
  });
}

// Gọi từ ExerciseService.createExercise_: đánh dấu tuần của bài là "Đã nộp" + nối Exercise_ID.
function _learnMarkSubmitted_(username, week, exerciseId, displayName, team) {
  username = normalizeUser_(username);
  if (!username || !_validWeek_(week)) return;
  var existing = _learnRead_(SHEETS.EXERCISE_WEEK).filter(function (r) {
    return normalizeUser_(r.Username) === username && String(r.Week) === week;
  })[0];
  var ids = existing ? String(existing.Exercise_IDs || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  if (ids.indexOf(exerciseId) === -1) ids.push(exerciseId);
  var now = _learnNow_();
  _learnUpsertWeek_(username, week, {
    Status:       WEEK_STATUS.SUBMITTED,
    Exercise_IDs: ids.join(', '),
    Submitted_At: (existing && existing.Submitted_At) ? existing.Submitted_At : now,
    Updated_At:   now
  }, { Display_Name: displayName || username, Team: team || '', Plan: '' });
}

// Đăng ký / cập nhật phần cá nhân (upsert theo Username). Member chỉ ghi dòng của mình.
function registerLearning_(data) {
  data = data || {};
  var me = _learnRequester_(data);
  var target = normalizeUser_(data.Username || me);
  if (target !== me && !_learnIsAdmin_(data)) throw new Error('Bạn chỉ cập nhật được đăng ký của mình');

  // Từ 2026-10-01 #2: phần này là "Hồ sơ AI" (công cụ, mức dùng, nhu cầu hỗ trợ). Bài tập theo tuần ghi ở
  // BAI_TAP_TUAN (saveWeekPlan_ / exercise-create). Exercise_Plan cũ giữ để tương thích, không bắt buộc.
  var tools = sanitizeStr_(data.AI_Tools || '', 300);
  var usage = sanitizeStr_(data.Usage_Level || '', 60);
  if (!tools && !usage) throw new Error('Vui lòng chọn mức dùng AI hoặc ghi công cụ AI bạn dùng');
  var plan = sanitizeStr_(data.Exercise_Plan || '', 1000);

  ensureSheetColumns_(SHEETS.LEARN_REG, LEARN_REG_HEADERS);
  var now = _learnNow_();
  var fields = {
    AI_Tools:      tools,
    Usage_Level:   usage,
    Support_Need:  sanitizeStr_(data.Support_Need || '', 1000),
    Status:        LEARN_STATUS.REGISTERED,
    Updated_At:    now
  };

  var existing = _learnRead_(SHEETS.LEARN_REG).filter(function (r) { return normalizeUser_(r.Username) === target; })[0];
  if (existing) {
    if (!existing.Submitted_At) fields.Submitted_At = now;
    if (!existing.Source) fields.Source = 'Tự đăng ký trên AIUS';
    // Khóa theo giá trị đang lưu (có thể viết hoa) — updateRowByField_ so khớp chuỗi tuyệt đối.
    if (plan) fields.Exercise_Plan = plan;
    updateRowByField_(SHEETS.LEARN_REG, 'Username', existing.Username, fields);
    if (plan) saveWeekPlan_({ requester_email: data.requester_email, is_admin: data.is_admin, Username: target, Plan: plan, Display_Name: data.Display_Name, Team: data.Team });
    return { username: target, created: false };
  }
  if (plan) fields.Exercise_Plan = plan;
  appendRowFromObject_(SHEETS.LEARN_REG, _learnMerge_({
    Username:     target,
    Display_Name: sanitizeStr_(data.Display_Name || target, 200),
    Team:         sanitizeStr_(data.Team || '', 120),
    Source:       'Tự đăng ký trên AIUS',
    Submitted_At: now,
    Note:         ''
  }, fields));
  if (plan) saveWeekPlan_({ requester_email: data.requester_email, is_admin: data.is_admin, Username: target, Plan: plan, Display_Name: data.Display_Name, Team: data.Team });
  return { username: target, created: true };
}

function _nextCourseId_() {
  var max = 0;
  _learnRead_(SHEETS.LEARN_COURSE).forEach(function (r) {
    var m = /^KH-(\d+)$/.exec(String(r.Course_ID || '').trim());
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  var next = max + 1;
  return 'KH-' + (next < 1000 ? ('000' + next).slice(-4) : String(next));
}

function _learnCourseFields_(data) {
  var name = sanitizeStr_(data.Course_Name || '', 300);
  var date = sanitizeStr_(data.Target_Date || '', 10);
  if (!name) throw new Error('Thiếu tên khóa học');
  if (!date) throw new Error('Thiếu hạn học xong');
  if (!_learnValidDate_(date)) throw new Error('Hạn học xong không hợp lệ (yyyy-mm-dd)');
  var paid = sanitizeStr_(data.Paid || '', 20);
  if (['Có', 'Không', 'Chưa rõ'].indexOf(paid) === -1) paid = 'Không';
  return {
    Course_Name: name,
    Provider:    sanitizeStr_(data.Provider || '', 200),
    Paid:        paid,
    Target_Date: _learnTxt_(date)
  };
}

function addLearningCourse_(data) {
  data = data || {};
  var me = _learnRequester_(data);
  var target = normalizeUser_(data.Username || me);
  if (target !== me && !_learnIsAdmin_(data)) throw new Error('Bạn chỉ thêm được khóa học của mình');

  var f = _learnCourseFields_(data);
  ensureSheetColumns_(SHEETS.LEARN_COURSE, LEARN_COURSE_HEADERS);
  var now = _learnNow_();
  var id = _nextCourseId_();
  appendRowFromObject_(SHEETS.LEARN_COURSE, _learnMerge_({
    Course_ID:      id,
    Username:       target,
    Display_Name:   sanitizeStr_(data.Display_Name || target, 200),
    Team:           sanitizeStr_(data.Team || '', 120),
    Status:         LEARN_STATUS.REGISTERED,
    Cert_Link:      '',
    Completed_Date: '',
    Source:         'Tự đăng ký trên AIUS',
    Note:           '',
    Created_At:     now,
    Updated_At:     now,
    Active:         'TRUE'
  }, f));
  return { course_id: id };
}

function _learnCourseForEdit_(data) {
  var id = sanitizeStr_(data.Course_ID || '');
  if (!id) throw new Error('Thiếu Course_ID');
  var existing = findObjectByField_(SHEETS.LEARN_COURSE, 'Course_ID', id);
  if (!existing || !_learnIsActive_(existing)) throw new Error('Không tìm thấy khóa học: ' + id);
  var me = _learnRequester_(data);
  if (normalizeUser_(existing.Username) !== me && !_learnIsAdmin_(data)) {
    throw new Error('Bạn chỉ sửa được khóa học của mình');
  }
  return { id: id, row: existing };
}

function updateLearningCourse_(data) {
  data = data || {};
  var c = _learnCourseForEdit_(data);
  var f = _learnCourseFields_(data);
  f.Updated_At = _learnNow_();
  if (data.Cert_Link !== undefined) f.Cert_Link = _learnCertLink_(data.Cert_Link);
  // Khóa "Chưa rõ khóa" được điền tên + hạn → chuyển "Đã đăng ký". "Hoàn thành" giữ nguyên
  // (so sánh sau trim/NFC — ô PM gõ tay có thể dư khoảng trắng → trước đây bị ghi đè về "Đã đăng ký").
  if (!_learnIsDone_(c.row.Status)) f.Status = LEARN_STATUS.REGISTERED;
  updateRowByField_(SHEETS.LEARN_COURSE, 'Course_ID', c.id, f);
  return { course_id: c.id };
}

// 2026-10-02: lỗi "hoàn thành khóa trước hạn không chuyển trạng thái" — trước đây KHÔNG có đường nào để
// member đánh dấu "Hoàn thành" (chỉ PM sửa tay sheet; sửa khóa còn ép Status về "Đã đăng ký").
// Route learning-course-complete: đánh dấu xong bất kể hạn (trước/sau hạn đều được), Completed_Date = hôm nay
// giờ VN, Cert_Link tùy chọn. Undo=true → về "Đã đăng ký", xóa Completed_Date.
function _learnIsDone_(s) {
  var v = String(s == null ? '' : s).trim();
  if (v.normalize) v = v.normalize('NFC');
  return v.toLowerCase() === LEARN_STATUS.DONE.toLowerCase();
}
function _learnCertLink_(s) {
  var v = sanitizeStr_(s || '', 1000);
  if (v && !/^https?:\/\//i.test(v)) throw new Error('Link chứng chỉ phải bắt đầu bằng http:// hoặc https://');
  return v;
}
function completeLearningCourse_(data) {
  data = data || {};
  var c = _learnCourseForEdit_(data);
  var undo = String(data.Undo) === 'true' || data.Undo === true;
  var f = { Updated_At: _learnNow_() };
  if (undo) {
    f.Status = LEARN_STATUS.REGISTERED;
    f.Completed_Date = '';
  } else {
    var name = String(c.row.Course_Name || '').trim();
    if (!name || /^\(.*\)$/.test(name)) throw new Error('Khóa chưa có tên — bấm Sửa để điền tên khóa trước khi hoàn thành');
    f.Status = LEARN_STATUS.DONE;
    f.Completed_Date = _learnTxt_(Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'));
    if (data.Cert_Link !== undefined && String(data.Cert_Link).trim()) f.Cert_Link = _learnCertLink_(data.Cert_Link);
  }
  updateRowByField_(SHEETS.LEARN_COURSE, 'Course_ID', c.id, f);
  return { course_id: c.id, status: f.Status };
}

function deleteLearningCourse_(data) {
  data = data || {};
  var c = _learnCourseForEdit_(data);
  updateRowByField_(SHEETS.LEARN_COURSE, 'Course_ID', c.id, { Active: 'FALSE', Updated_At: _learnNow_() });
  return { course_id: c.id, deleted: true };
}

// ══════════════════════════════════════════════════════════════════
// CR-C (2026-10-09): VIỆC LỚN — số đo (KR) + phân công hạng mục + nghiệm thu
// Auth: token (validateToken_) → fallback reviewer_email/requester_email; admin hoặc teamlead của team việc lớn
//   (isChampionForTeam_, có tính team backup). Thành viên KHÔNG tự nghiệm thu hạng mục của mình.
// ══════════════════════════════════════════════════════════════════

function _btTaskForEdit_(body) {
  var taskId = sanitizeStr_(body.Task_ID || '', 40);
  if (!taskId) throw new Error('Thiếu Task_ID (mã việc lớn)');
  var task = _learnRead_(SHEETS.BIG_TASK).filter(function (t) { return String(t.Task_ID || '').trim() === taskId; })[0];
  if (!task) throw new Error('Không tìm thấy việc lớn: ' + taskId);
  var rv = _resolveReviewer_({ token: body.token, reviewer_email: body.reviewer_email || body.requester_email });
  if (!rv.username) throw new Error('Chưa đăng nhập');
  var team = String(task.Team || '').trim();
  if (!isAdminEmail_(rv.username) && !isChampionForTeam_(rv.username, team)) {
    throw new Error('Chỉ teamlead team "' + team + '" (hoặc PM/admin) mới cập nhật được việc lớn ' + taskId);
  }
  return { taskId: taskId, task: task, team: team, rv: rv };
}

function _btNextId_(rows, field, prefix) {
  var max = 0, re = new RegExp('^' + prefix + '-(\\d+)$');
  (rows || []).forEach(function (r) { var m = re.exec(String(r[field] || '').trim()); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  var n = max + 1;
  return prefix + '-' + (n < 1000 ? ('000' + n).slice(-4) : String(n));
}

function _btNum_(v, label, required) {
  var s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!s) { if (required) throw new Error('Thiếu ' + label); return ''; }
  var n = parseFloat(s);
  if (isNaN(n)) throw new Error(label + ' phải là số');
  return n;
}

function _btToday_() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'); }

/**
 * Thêm/sửa/xóa 1 chỉ số đo của việc lớn. body: { Task_ID, KR_ID?, KR_Name, Unit?, Before_Value, Target_Value,
 *   Actual_Value?, Note?, Delete?, token?/reviewer_email? }
 */
function saveBigTaskKr_(body) {
  body = body || {};
  var ctx = _btTaskForEdit_(body);
  ensureSheetColumns_(SHEETS.BIG_TASK_KR, BIG_TASK_KR_HEADERS);
  var all = _learnRead_(SHEETS.BIG_TASK_KR);
  var krId = sanitizeStr_(body.KR_ID || '', 20);
  var existing = krId ? all.filter(function (k) { return String(k.KR_ID).trim() === krId; })[0] : null;
  if (krId && !existing) throw new Error('Không tìm thấy chỉ số: ' + krId);
  if (existing && String(existing.Task_ID).trim() !== ctx.taskId) throw new Error('Chỉ số ' + krId + ' không thuộc ' + ctx.taskId);
  var now = _learnNow_();

  if (String(body.Delete) === 'true' || body.Delete === true) {
    if (!existing) throw new Error('Thiếu KR_ID để xóa');
    updateRowByField_(SHEETS.BIG_TASK_KR, 'KR_ID', krId, { Active: 'FALSE', Updated_By: ctx.rv.username, Updated_At: now });
    return { kr_id: krId, deleted: true };
  }

  var name = sanitizeStr_(body.KR_Name || '', 300);
  if (!name) throw new Error('Thiếu tên chỉ số (VD: Thời gian 1 vòng quy trình)');
  var before = _btNum_(body.Before_Value, 'Số trước', true);
  var target = _btNum_(body.Target_Value, 'Mục tiêu khát vọng', true);
  if (before === target) throw new Error('Mục tiêu khát vọng phải khác số trước');
  var actual = _btNum_(body.Actual_Value, 'Số thực tế', false);
  var fields = {
    Task_ID: ctx.taskId, KR_Name: name, Unit: sanitizeStr_(body.Unit || '', 40),
    Before_Value: before, Target_Value: target, Actual_Value: actual,
    Note: sanitizeStr_(body.Note || '', 500), Updated_By: ctx.rv.username, Updated_At: now
  };
  var actualChanged = !existing || String(existing.Actual_Value) !== String(actual);
  if (actual !== '' && actualChanged) fields.Measured_At = _learnTxt_(_btToday_());
  if (actual === '') fields.Measured_At = '';

  if (existing) {
    updateRowByField_(SHEETS.BIG_TASK_KR, 'KR_ID', krId, fields);
  } else {
    krId = _btNextId_(all, 'KR_ID', 'KR');
    appendRowFromObject_(SHEETS.BIG_TASK_KR, _learnMerge_(fields, { KR_ID: krId, Active: 'TRUE' }));
  }
  return { kr_id: krId, task_id: ctx.taskId, ratio: _kpiKrRatio_(fields) };
}

/**
 * Thêm/sửa/xóa/nghiệm thu 1 hạng mục giao cho thành viên. body: { Task_ID, Assign_ID?, Username, Role?, Item,
 *   Due_Date?, Acceptance_Criteria?, Status? ('Đang làm'|'Đạt'|'Chưa đạt'), Accepted_Date?, Note?, Delete?, token? }
 * Status 'Đạt' → Accepted_Date = ngày gửi (mặc định hôm nay giờ VN; cho phép ghi ngày nghiệm thu thật khi chấm bù).
 */
function saveBigTaskAssign_(body) {
  body = body || {};
  var ctx = _btTaskForEdit_(body);
  ensureSheetColumns_(SHEETS.BIG_TASK_ASSIGN, BIG_TASK_ASSIGN_HEADERS);
  var all = _learnRead_(SHEETS.BIG_TASK_ASSIGN);
  var aid = sanitizeStr_(body.Assign_ID || '', 20);
  var existing = aid ? all.filter(function (a) { return String(a.Assign_ID).trim() === aid; })[0] : null;
  if (aid && !existing) throw new Error('Không tìm thấy hạng mục: ' + aid);
  if (existing && String(existing.Task_ID).trim() !== ctx.taskId) throw new Error('Hạng mục ' + aid + ' không thuộc ' + ctx.taskId);
  var now = _learnNow_();

  if (String(body.Delete) === 'true' || body.Delete === true) {
    if (!existing) throw new Error('Thiếu Assign_ID để xóa');
    updateRowByField_(SHEETS.BIG_TASK_ASSIGN, 'Assign_ID', aid, { Active: 'FALSE', Updated_At: now });
    return { assign_id: aid, deleted: true };
  }

  var uname = normalizeUser_(body.Username || (existing && existing.Username) || '');
  if (!uname) throw new Error('Thiếu thành viên được giao');
  var item = sanitizeStr_(body.Item !== undefined ? body.Item : (existing && existing.Item) || '', 500);
  if (!item) throw new Error('Thiếu hạng mục được giao');
  var due = sanitizeStr_(body.Due_Date !== undefined ? body.Due_Date : _learnYmd_(existing && existing.Due_Date), 10);
  if (due && !_learnValidDate_(due)) throw new Error('Hạn không hợp lệ (yyyy-mm-dd)');

  var status = String(body.Status || (existing && existing.Status) || ASSIGN_STATUS.DOING).trim();
  if ([ASSIGN_STATUS.DOING, ASSIGN_STATUS.PASS, ASSIGN_STATUS.FAIL].indexOf(status) === -1) status = ASSIGN_STATUS.DOING;
  var statusChanged = !existing || String(existing.Status || '').trim() !== status;
  if (status !== ASSIGN_STATUS.DOING && uname === ctx.rv.username && !isAdminEmail_(ctx.rv.username)) {
    throw new Error('Không tự nghiệm thu hạng mục của chính mình');
  }

  var disp = '', team = '';
  try {
    getAllUsersFromMaster_().forEach(function (u) { if (normalizeUser_(u.username) === uname) { disp = u.display_name; team = u.team; } });
  } catch (e) { /* best-effort */ }

  var fields = {
    Task_ID: ctx.taskId, Username: uname, Display_Name: sanitizeStr_(disp || body.Display_Name || uname, 200),
    Team: sanitizeStr_(team || body.Team || '', 120),
    Role: sanitizeStr_(body.Role !== undefined ? body.Role : (existing && existing.Role) || '', 120),
    Item: item, Due_Date: _learnTxt_(due),
    Acceptance_Criteria: sanitizeStr_(body.Acceptance_Criteria !== undefined ? body.Acceptance_Criteria : (existing && existing.Acceptance_Criteria) || '', 1000),
    Status: status,
    Note: sanitizeStr_(body.Note !== undefined ? body.Note : (existing && existing.Note) || '', 500),
    Updated_At: now
  };
  if (statusChanged || body.Accepted_Date !== undefined) {
    if (status === ASSIGN_STATUS.DOING) {
      fields.Accepted_Date = ''; fields.Accepted_By = '';
    } else {
      var acc = sanitizeStr_(body.Accepted_Date || '', 10) || _btToday_();
      if (!_learnValidDate_(acc)) throw new Error('Ngày nghiệm thu không hợp lệ (yyyy-mm-dd)');
      if (acc > _btToday_()) throw new Error('Ngày nghiệm thu không được sau hôm nay');
      fields.Accepted_Date = _learnTxt_(acc); fields.Accepted_By = ctx.rv.username;
    }
  }

  if (existing) {
    updateRowByField_(SHEETS.BIG_TASK_ASSIGN, 'Assign_ID', aid, fields);
  } else {
    aid = _btNextId_(all, 'Assign_ID', 'PC');
    appendRowFromObject_(SHEETS.BIG_TASK_ASSIGN, _learnMerge_(fields, { Assign_ID: aid, Created_At: now, Active: 'TRUE' }));
  }
  logActivity_('', '', 'BIG_TASK_ASSIGN', ctx.rv.username + ' ' + (existing ? 'cập nhật' : 'giao') + ' ' + aid + ' (' + ctx.taskId + ') → ' +
    uname + ': ' + item.substring(0, 60) + ' · ' + status, ctx.rv.username, null, null);
  return { assign_id: aid, task_id: ctx.taskId, status: status };
}
