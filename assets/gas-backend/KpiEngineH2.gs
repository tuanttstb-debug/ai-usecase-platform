// ─────────────────────────────────────────────────────────────────
// KpiEngineH2.gs — Bộ máy tính KPI cá nhân + teamlead theo khung D70 (2026-10-09)
//
// Nguồn: hub AIUS-001 DECISIONS D62 (teamlead 40/30/20/10) · D65 (thang OKR) · D67 (M1 = việc lớn)
//        · D68 (từng chỉ tiêu trần 120, tổng vượt tới 120, "đạt" ≥70) · D69 (M2 chấm từng bài, M3 4 khóa,
//        M4 0/100/120) · D70 (tạm áp dụng bản trình 06/10). Đặc tả: comms/EMAIL_TRINH_KPI_CA_NHAN_20261006.md.
//
// THUẦN TÍNH TOÁN — không gọi SpreadsheetApp/PropertiesService. Đầu vào = mảng object đã đọc sẵn
// (ScoringServiceH2._kpiLoadInput_ đọc sheet, chuẩn hóa ngày về 'yyyy-MM-dd'). Nhờ vậy test được bằng Node
// (tests/18-kpi-engine-h2.spec.js nạp Config.gs + file này qua vm) — engine là 1 nguồn duy nhất.
// Hằng số (trọng số, trần, kỳ tuần, thang OKR) ở Config.gs.
// ─────────────────────────────────────────────────────────────────

function _kNum_(v) {                       // số hoặc null (ô trống / chữ)
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).trim().replace(',', '.');
  if (!s) return null;
  var m = /-?\d+(\.\d+)?/.exec(s);
  return m ? parseFloat(m[0]) : null;
}
function _kU_(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function _kTxt_(v) {                       // chuẩn hóa chữ tiếng Việt để so trạng thái (trim + NFC + thường)
  var s = String(v == null ? '' : v).trim();
  if (s.normalize) s = s.normalize('NFC');
  return s.toLowerCase();
}
function _kActive_(r) { return r.Active !== false && String(r.Active).toUpperCase() !== 'FALSE'; }
function _kRound1_(n) { return Math.round(n * 10) / 10; }
function _kClamp_(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function _kYmd_(v) { var s = String(v == null ? '' : v).trim(); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''; }

/** Thang OKR (D65): ratio = % đạt mục tiêu khát vọng (0..∞) → điểm 0..120. null/không số → 0. */
function _kpiOkrScore_(ratio) {
  var r = _kNum_(ratio);
  if (r === null) return 0;
  if (r < H2_OKR.FLOOR) return 0;
  if (r < H2_OKR.FULL) return r / H2_OKR.FULL * H2_OKR.FULL_SCORE;
  if (r < H2_OKR.MAX_RATIO) {
    return H2_OKR.FULL_SCORE + (r - H2_OKR.FULL) / (H2_OKR.MAX_RATIO - H2_OKR.FULL) * (H2_OKR.MAX_SCORE - H2_OKR.FULL_SCORE);
  }
  return H2_OKR.MAX_SCORE;
}

/** % đạt 1 chỉ số = (Trước − Thực tế) / (Trước − Mục tiêu), chặn 0..100. Thiếu số / Trước = Mục tiêu → null. */
function _kpiKrRatio_(kr) {
  var b = _kNum_(kr.Before_Value), t = _kNum_(kr.Target_Value), a = _kNum_(kr.Actual_Value);
  if (b === null || t === null || a === null || b === t) return null;
  return _kClamp_((b - a) / (b - t) * 100, 0, 100);
}

/**
 * Tóm tắt từng việc lớn: % đạt (TB các chỉ số đã có số thực tế) + điểm OKR + đếm phân công.
 * @returns {Object<string,{task_id,team,ratio,okr_score,kr_count,measured_count,assign_count,pass_count}>}
 */
function _kpiBigTaskSummary_(bigTasks, krs, assigns) {
  var out = {};
  (bigTasks || []).forEach(function (t) {
    var id = String(t.Task_ID || '').trim();
    if (!id) return;
    out[id] = { task_id: id, team: String(t.Team || '').trim(), ratio: null, okr_score: 0,
                kr_count: 0, measured_count: 0, assign_count: 0, pass_count: 0, _sum: 0 };
  });
  (krs || []).forEach(function (k) {
    if (!_kActive_(k)) return;
    var s = out[String(k.Task_ID || '').trim()];
    if (!s) return;
    s.kr_count++;
    var r = _kpiKrRatio_(k);
    if (r !== null) { s.measured_count++; s._sum += r; }
  });
  (assigns || []).forEach(function (a) {
    if (!_kActive_(a)) return;
    var s = out[String(a.Task_ID || '').trim()];
    if (!s) return;
    s.assign_count++;
    if (_kpiAssignPassedOnTime_(a)) s.pass_count++;
  });
  Object.keys(out).forEach(function (id) {
    var s = out[id];
    s.ratio = s.measured_count ? _kRound1_(s._sum / s.measured_count) : null;
    s.okr_score = _kRound1_(_kpiOkrScore_(s.ratio));
    delete s._sum;
  });
  return out;
}

/** Hạng mục đạt nghiệm thu ĐÚNG HẠN: Status 'Đạt' và (không có hạn | không ghi ngày nghiệm thu | nghiệm thu ≤ hạn). */
function _kpiAssignPassedOnTime_(a) {
  if (_kTxt_(a.Status) !== _kTxt_(ASSIGN_STATUS.PASS)) return false;
  var due = _kYmd_(a.Due_Date), acc = _kYmd_(a.Accepted_Date);
  return !due || !acc || acc <= due;
}

/** Kết quả việc lớn của 1 team = TB % đạt các việc lớn của team (việc chưa đo = 0%) → thang OKR. */
function _kpiTeamBigTask_(teamL, taskSummary, fallbackTaskIds) {
  var ids = Object.keys(taskSummary).filter(function (id) { return _kU_(taskSummary[id].team) === teamL && teamL; });
  if (!ids.length && fallbackTaskIds && fallbackTaskIds.length) {
    ids = fallbackTaskIds.filter(function (id) { return !!taskSummary[id]; });
  }
  if (!ids.length) return { ratio: null, score: 0, task_ids: [] };
  var anyMeasured = false, sum = 0;
  ids.forEach(function (id) { var r = taskSummary[id].ratio; if (r !== null) anyMeasured = true; sum += (r || 0); });
  var ratio = anyMeasured ? _kRound1_(sum / ids.length) : null;
  return { ratio: ratio, score: _kpiOkrScore_(ratio), task_ids: ids };
}

function _kpiWeekInRange_(w) {
  var m = /^(\d{4})-W(\d{2})$/.exec(String(w || '').trim());
  if (!m) return false;
  var y = +m[1], n = +m[2];
  return y === H2_M2_YEAR && n >= H2_M2_WEEK_FROM && n <= H2_M2_WEEK_TO;
}
function _kpiMonthKey_(label) {
  var m = /(\d{1,2})\s*\/\s*(\d{4})/.exec(String(label || ''));
  return m ? (parseInt(m[2], 10) * 100 + parseInt(m[1], 10)) : 0;
}

/** Chỉ mục theo username cho 1 lần tính (O(n) mỗi bảng). */
function _kpiIndex_(input) {
  var idx = { ex: {}, course: {}, claim: {}, assign: {}, penalty: {}, rd: {} };
  (input.exercises || []).forEach(function (e) {
    if (!_kActive_(e)) return;
    var u = _kU_(e.Owner_Email); if (!u) return;
    (idx.ex[u] = idx.ex[u] || []).push(e);
  });
  (input.courses || []).forEach(function (c) {
    if (!_kActive_(c)) return;
    var u = _kU_(c.Username); if (!u) return;
    (idx.course[u] = idx.course[u] || []).push(c);
  });
  (input.claims || []).forEach(function (c) {
    var u = _kU_(c.Username); if (!u) return;
    (idx.claim[u] = idx.claim[u] || []).push(c);
  });
  (input.assigns || []).forEach(function (a) {
    if (!_kActive_(a)) return;
    var u = _kU_(a.Username); if (!u) return;
    (idx.assign[u] = idx.assign[u] || []).push(a);
  });
  // Điểm trừ: Milestones_Late ở dòng PERSONAL_SCORE tháng mới nhất (teamlead nhập ở màn Chấm điểm cá nhân).
  var latestKey = {};
  (input.personalRows || []).forEach(function (r) {
    var u = _kU_(r.Username); if (!u) return;
    var k = _kpiMonthKey_(r.Month);
    if (latestKey[u] === undefined || k >= latestKey[u]) { latestKey[u] = k; idx.penalty[u] = _kNum_(r.Milestones_Late) || 0; }
  });
  (input.rdRows || []).forEach(function (r) {
    var u = _kU_(r.Username); if (!u) return;
    (idx.rd[u] = idx.rd[u] || []).push(r);
  });
  idx.tasks = _kpiBigTaskSummary_(input.bigTasks, input.krs, input.assigns);
  return idx;
}

/**
 * KPI cá nhân 1 người (mọi role — D54/D62: teamlead, admin, lãnh đạo cũng có KPI cá nhân).
 * @returns {{username, display_name, team, role, m1, m2, m3, m4, penalty, final, pass, detail}}
 */
function _kpiMemberFor_(user, idx, reuseByOwner) {
  var u = _kU_(user.username), teamL = _kU_(user.team);

  // M1 — việc lớn: 50% kết quả việc lớn team (OKR) + 50% hạng mục cá nhân đạt nghiệm thu đúng hạn.
  var myAssigns = idx.assign[u] || [];
  var passed = myAssigns.filter(_kpiAssignPassedOnTime_).length;
  var personal = myAssigns.length ? passed / myAssigns.length * 100 : 0;
  var myTaskIds = myAssigns.map(function (a) { return String(a.Task_ID || '').trim(); });
  var teamBt = _kpiTeamBigTask_(teamL, idx.tasks, myTaskIds);
  var m1 = _kClamp_(H2_M1_TEAM_SHARE * teamBt.score + (1 - H2_M1_TEAM_SHARE) * personal, 0, H2_KPI_CAP);

  // M2 — số tuần 40→52 có ≥1 bài "Đạt" (mỗi tuần tối đa 1 bài).
  var weeks = {};
  (idx.ex[u] || []).forEach(function (e) {
    if (_kTxt_(e.Review_Status) !== _kTxt_(EXERCISE_REVIEW.PASS)) return;
    var w = String(e.Week || '').trim();
    if (_kpiWeekInRange_(w)) weeks[w] = 1;
  });
  var passWeeks = Object.keys(weeks).sort();
  var m2 = Math.min(H2_KPI_CAP, passWeeks.length * H2_M2_PCT_EACH);

  // M3 — khóa "Hoàn thành" + có link chứng chỉ; trả phí ×2.
  var courseDone = 0, coursePaid = 0;
  (idx.course[u] || []).forEach(function (c) {
    if (_kTxt_(c.Status) !== 'hoàn thành') return;
    if (!/^https?:\/\//i.test(String(c.Cert_Link || '').trim())) return;
    courseDone++;
    if (_kTxt_(c.Paid) === 'có') coursePaid++;
  });
  var m3 = Math.min(H2_KPI_CAP, (courseDone + coursePaid) * H2_COURSE_PCT_EACH);

  // M4 — hoạt động lan tỏa đã duyệt (+1 nếu UC/bài của mình được ≥3 người khác tái dùng).
  var approved = (idx.claim[u] || []).filter(function (c) { return String(c.Status || '').trim() === 'Approved'; }).length;
  var reuseOk = ((reuseByOwner && reuseByOwner[u]) || 0) >= H2_REUSE_THRESHOLD;
  var acts = approved + (reuseOk ? 1 : 0);
  var m4 = acts === 0 ? 0 : (acts === 1 ? 100 : H2_KPI_CAP);

  var late = Math.max(0, Math.round(idx.penalty[u] || 0));
  var penalty = Math.min(H2_MILESTONE_PENALTY_MAX, late * H2_MILESTONE_PENALTY_EACH);

  var raw = m1 * H2_KPI_WEIGHTS.UC + m2 * H2_KPI_WEIGHTS.CAPABILITY
          + m3 * H2_KPI_WEIGHTS.COURSES + m4 * H2_KPI_WEIGHTS.SHARING - penalty;
  var final = _kRound1_(_kClamp_(raw, 0, H2_KPI_CAP));

  return {
    username: u, display_name: String(user.display_name || user.username || ''),
    team: String(user.team || ''), role: String(user.role || ''),
    m1: _kRound1_(m1), m2: m2, m3: m3, m4: m4, penalty: penalty,
    final: final, pass: final >= H2_KPI_PASS,
    detail: {
      m1_team_ratio: teamBt.ratio, m1_team_score: _kRound1_(teamBt.score), m1_task_ids: teamBt.task_ids,
      m1_items_assigned: myAssigns.length, m1_items_passed: passed, m1_personal: _kRound1_(personal),
      m2_pass_weeks: passWeeks,
      m3_courses_done: courseDone, m3_courses_paid: coursePaid,
      m4_activities: acts, m4_claims_approved: approved, m4_reuse_ok: reuseOk,
      milestones_late: late
    }
  };
}

/** T-KPI-4: số kỳ R&D (T10/T11/T12) nộp đúng hạn / 3 × 100. */
function _kpiRdScore_(rows) {
  var ok = {};
  (rows || []).forEach(function (r) {
    var p = String(r.Period || '').trim().toUpperCase();
    if (H2_RD_PERIODS.indexOf(p) === -1) return;
    var due = _kYmd_(r.Due_Date), sub = _kYmd_(r.Submitted_Date);
    if (sub && (!due || sub <= due)) ok[p] = 1;
  });
  var n = Object.keys(ok).length;
  return { score: _kRound1_(n / H2_RD_PERIODS.length * 100), on_time: n };
}

/**
 * Tính toàn bộ: KPI cá nhân mọi user active + KPI teamlead + bình quân toàn Trung tâm (member).
 * input: { users, exercises, courses, claims, reuseByOwner, personalRows, bigTasks, krs, assigns, rdRows }
 * @returns {{ members:Array, teamleads:Array, center_avg:number, tasks:Object }}
 */
function _kpiComputeAll_(input) {
  input = input || {};
  var idx = _kpiIndex_(input);
  var users = (input.users || []).filter(function (u) { return u && u.username && u.active !== false; });

  var members = users.map(function (u) { return _kpiMemberFor_(u, idx, input.reuseByOwner); });
  var byUser = {};
  members.forEach(function (m) { byUser[m.username] = m; });

  var roleUser = members.filter(function (m) { return _kU_(m.role) === 'user'; });
  var centerAvg = roleUser.length
    ? _kRound1_(roleUser.reduce(function (s, m) { return s + m.final; }, 0) / roleUser.length) : 0;

  var teamleads = users.filter(function (u) { return _kU_(u.role) === 'teamlead'; }).map(function (u) {
    var self = byUser[_kU_(u.username)];
    var teamL = _kU_(u.team);
    var team = roleUser.filter(function (m) { return teamL && _kU_(m.team) === teamL; });   // mẫu số = toàn bộ member active
    var passCount = team.filter(function (m) { return m.pass; }).length;
    var t2 = team.length ? _kRound1_(passCount / team.length * 100) : 0;
    var bt = _kpiTeamBigTask_(teamL, idx.tasks, null);
    var t3 = _kRound1_(bt.score);
    var rd = _kpiRdScore_(idx.rd[_kU_(u.username)]);
    var raw = self.final * H2_TEAMLEAD_WEIGHTS.SELF + t2 * H2_TEAMLEAD_WEIGHTS.TEAM
            + t3 * H2_TEAMLEAD_WEIGHTS.BIG_TASK + rd.score * H2_TEAMLEAD_WEIGHTS.RD;
    var final = _kRound1_(_kClamp_(raw, 0, H2_KPI_CAP));
    return {
      username: self.username, display_name: self.display_name, team: self.team,
      t1: self.final, t2: t2, t3: t3, t4: rd.score,
      team_size: team.length, pass_count: passCount,
      big_task_ratio: bt.ratio, rd_on_time: rd.on_time,
      final: final, pass: final >= H2_KPI_PASS
    };
  });

  return { members: members, teamleads: teamleads, center_avg: centerAvg, tasks: idx.tasks };
}
