// @ts-check
// 20-gas-routes-d70.spec.js — Chạy THẲNG code GAS (Config/Utils/KpiEngineH2/ExerciseService/LearningPlanService)
// trong Node vm với bảng tính GIẢ trong bộ nhớ (không gọi Google). Kiểm luật server của khung D70:
//   CR-A  exercise-create chọn tuần (chặn tuần tương lai) + 4 ô mới · exercise-review (≥3/4 tiêu chí, không tự chấm,
//         chỉ teamlead team đó/admin) · chủ bài sửa bài đã chấm → về Chờ chấm · đổi tuần chuyển dấu "Đã nộp"
//   CR-C  big-task-kr-save / big-task-assign-save (quyền teamlead team việc lớn, nghiệm thu, không tự nghiệm thu)
//         + learning-list trả % đạt / điểm OKR · tự tạo tab/cột qua ensureSheetColumns_ (không phá dữ liệu cũ)
//   CR-B/D getKpiLeaderboard_ đọc từ sheet → engine (M3 chỉ đếm khóa có chứng chỉ; mọi role).
// Tên/tài khoản trong test là HƯ CẤU.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAS = path.join(__dirname, '..', 'assets', 'gas-backend');
const NOW = new Date('2026-10-14T03:00:00Z');   // 10:00 giờ VN thứ 4, tuần 42

// ── Bảng tính giả: 1 sheet = mảng 2 chiều (hàng 1 = header). Ghi có dấu ' đầu → bỏ như Sheets thật. ──
function makeBook(seed) {
  const book = {};
  const unq = (v) => (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1) : v;
  function sheet(name) {
    const rows = book[name] || (book[name] = []);
    const width = () => rows.reduce((m, r) => Math.max(m, r.length), 0);
    const range = (r, c, nr, nc) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
        const row = rows[r - 1 + i] || []; const v = row[c - 1 + j]; return v === undefined ? '' : v;
      })),
      setValues: (vals) => vals.forEach((vr, i) => vr.forEach((v, j) => {
        rows[r - 1 + i] = rows[r - 1 + i] || []; rows[r - 1 + i][c - 1 + j] = unq(v);
      })),
      setFontWeight() { return this; }, setBackground() { return this; }, setWrap() { return this; },
    });
    return {
      getName: () => name,
      getLastColumn: () => width(),
      getLastRow: () => rows.length,
      getDataRange: () => range(1, 1, rows.length, width()),
      getRange: range,
      appendRow: (arr) => { rows.push(arr.map(unq)); },
      setFrozenRows() {},
    };
  }
  Object.keys(seed || {}).forEach((n) => { book[n] = seed[n].map((r) => r.slice()); });
  return { book, sheet };
}
function objs(book, name) {
  const rows = book[name] || [];
  if (rows.length < 2) return [];
  const h = rows[0];
  return rows.slice(1).map((r) => { const o = {}; h.forEach((k, i) => { o[k] = r[i] === undefined ? '' : r[i]; }); return o; });
}

const USERS = [
  { username: 'lead.cv', display_name: 'Trưởng nhóm CV', role: 'teamlead', team: 'CV', active: true },
  { username: 'tv.a',    display_name: 'Thành viên A',   role: 'user',     team: 'CV', active: true },
  { username: 'tv.b',    display_name: 'Thành viên B',   role: 'user',     team: 'CV', active: true },
  { username: 'tv.k',    display_name: 'Thành viên K',   role: 'user',     team: 'BL', active: true },
  { username: 'pm.z',    display_name: 'PM Z',           role: 'admin',    team: 'Số', active: true },
];

function loadGas(seed) {
  const { book, sheet } = makeBook(seed);
  const pad = (n) => String(n).padStart(2, '0');
  const ctx = vm.createContext({
    Logger: { log() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const v = new Date(d.getTime() + 7 * 3600 * 1000);   // giờ VN
        const ymd = v.getUTCFullYear() + '-' + pad(v.getUTCMonth() + 1) + '-' + pad(v.getUTCDate());
        if (fmt === 'yyyy-MM-dd') return ymd;
        if (fmt === 'yyyy-MM-dd HH:mm') return ymd + ' ' + pad(v.getUTCHours()) + ':' + pad(v.getUTCMinutes());
        if (fmt === 'MM/yyyy') return pad(v.getUTCMonth() + 1) + '/' + v.getUTCFullYear();
        return ymd;
      },
    },
  });
  ['Config.gs', 'Utils.gs', 'KpiEngineH2.gs', 'ExerciseService.gs', 'LearningPlanService.gs', 'ScoringServiceH2.gs']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(GAS, f), 'utf8'), ctx, { filename: f }));
  // Thay phần chạm Google bằng giả lập.
  Object.assign(ctx, {
    getOrCreateSheet_: sheet,
    getSpreadsheet_: () => ({ getSpreadsheetTimeZone: () => 'Asia/Ho_Chi_Minh' }),
    getAllUsersFromMaster_: () => USERS.map((u) => Object.assign({}, u)),
    isAdminEmail_: (u) => String(u || '').toLowerCase() === 'pm.z',
    isChampionForTeam_: (u, team) => USERS.some((x) => x.username === String(u).toLowerCase() && x.role === 'teamlead' && x.team.toLowerCase() === String(team).toLowerCase()),
    _resolveReviewer_: (b) => ({ username: String(b.reviewer_email || b.requester_email || '').toLowerCase(), role: '', team: '', viaToken: false }),
    getCouncilUsernames_: () => [],
    logActivity_() {}, logError_() {},
  });
  vm.runInContext('Date = (function (D) { function F(a, b, c, d, e, f, g) { if (arguments.length === 0) return new D(' + NOW.getTime() + '); return new (Function.prototype.bind.apply(D, [null].concat([].slice.call(arguments))))(); } F.UTC = D.UTC; F.parse = D.parse; F.now = function () { return ' + NOW.getTime() + '; }; F.prototype = D.prototype; return F; })(Date);', ctx);
  return { ctx, book };
}

const EX_HEAD = ['Exercise_ID', 'Title', 'Description', 'Prompt', 'Demo_Link', 'Owner_Name', 'Owner_Email', 'Team', 'Created_At', 'Updated_At', 'Active', 'Week'];
function seedBase() {
  return {
    AI_EXERCISE: [EX_HEAD, ['EX-0001', 'Bài tuần 40', 'mô tả', 'p', '', 'Thành viên A', 'tv.a', 'CV', '2026-10-02T00:00:00Z', '', 'TRUE', '2026-W40']],
    VIEC_LON: [['Task_ID', 'Task_Name', 'Team', 'Source_Type', 'Lead', 'Participants', 'Hours_Before', 'Target_Reduction', 'Pilot_Deadline', 'Status', 'Note'],
               ['VL-03', 'Cập nhật thị trường', 'CV', 'Team tự chọn', 'lead.cv', '', '', '', '2026-10-31', 'Đang làm', ''],
               ['VL-07', 'Rà soát bảo lãnh', 'BL', 'PM đề xuất', 'lead.bl', '', '', '', '2026-10-31', 'Đang làm', '']],
  };
}

test.describe('CR-A — server: nộp bài chọn tuần + 4 ô + teamlead chấm từng bài', () => {
  test('exercise-create: tự thêm cột mới (giữ dữ liệu cũ), lưu 4 ô, nộp bù tuần 41, chặn tuần tương lai', () => {
    const { ctx, book } = loadGas(seedBase());
    const r = ctx.createExercise_({ Title: 'Tóm tắt', Prompt: 'p', Owner_Email: 'tv.a', Owner_Name: 'Thành viên A', Team: 'CV',
      Week: '2026-W41', Hours_Before: '3', Hours_After: '0,5', AI_Check: 'AI sai số', Reuse_Template: 'https://mau', Big_Task_Ref: 'PC-0001' });
    expect(r.week).toBe('2026-W41');
    expect(book.AI_EXERCISE[0]).toEqual(expect.arrayContaining(['Hours_Before', 'Review_Status', 'Review_Criteria']));
    const rows = objs(book, 'AI_EXERCISE');
    expect(rows[0].Exercise_ID).toBe('EX-0001');              // dữ liệu cũ còn nguyên
    expect(rows[0].Week).toBe('2026-W40');
    const n = rows.find((x) => x.Exercise_ID === r.exercise_id);
    expect(n.Hours_Before).toBe(3);
    expect(n.Hours_After).toBe(0.5);
    expect(n.Big_Task_Ref).toBe('PC-0001');
    expect(() => ctx.createExercise_({ Title: 'x', Prompt: 'p', Owner_Email: 'tv.a', Week: '2026-W45' })).toThrow(/tương lai/);
    expect(() => ctx.createExercise_({ Title: 'x', Prompt: 'p', Owner_Email: 'tv.a', Hours_Before: '-1' })).toThrow(/≥ 0/);
    const wk = objs(book, 'BAI_TAP_TUAN').find((w) => w.Username === 'tv.a' && w.Week === '2026-W41');
    expect(wk.Status).toBe('Đã nộp');
  });

  test('exercise-review: Đạt cần ≥3/4; không tự chấm; teamlead team khác bị chặn; admin chấm được', () => {
    const { ctx, book } = loadGas(seedBase());
    expect(() => ctx.reviewExercise_({ Exercise_ID: 'EX-0001', action: 'pass', Criteria: '1,2', reviewer_email: 'lead.cv' })).toThrow(/≥3\/4/);
    expect(() => ctx.reviewExercise_({ Exercise_ID: 'EX-0001', action: 'pass', Criteria: '1,2,3', reviewer_email: 'tv.a' })).toThrow(/chính mình/);
    expect(() => ctx.reviewExercise_({ Exercise_ID: 'EX-0001', action: 'pass', Criteria: '1,2,3', reviewer_email: 'tv.k' })).toThrow(/teamlead/);
    const ok = ctx.reviewExercise_({ Exercise_ID: 'EX-0001', action: 'pass', Criteria: [4, 1, 3, 3, 9], reviewer_email: 'lead.cv', Review_Comment: 'Tốt' });
    expect(ok.review_status).toBe('Đạt');
    expect(ok.criteria).toEqual([1, 3, 4]);
    const row = objs(book, 'AI_EXERCISE')[0];
    expect(row.Review_Status).toBe('Đạt');
    expect(row.Review_Criteria).toBe('1,3,4');
    expect(row.Reviewed_By).toBe('lead.cv');
    const f = ctx.reviewExercise_({ Exercise_ID: 'EX-0001', action: 'fail', Criteria: '', reviewer_email: 'pm.z' });
    expect(f.review_status).toBe('Chưa đạt');
  });

  test('exercise-update: chủ bài sửa bài đã chấm → về Chờ chấm; đổi tuần chuyển dấu Đã nộp sang tuần mới', () => {
    const { ctx, book } = loadGas(seedBase());
    ctx._learnMarkSubmitted_('tv.a', '2026-W40', 'EX-0001', 'Thành viên A', 'CV');
    ctx.reviewExercise_({ Exercise_ID: 'EX-0001', action: 'pass', Criteria: '1,2,3', reviewer_email: 'lead.cv' });
    const r = ctx.updateExercise_({ Exercise_ID: 'EX-0001', Title: 'Bài tuần 40', Prompt: 'p', requester_email: 'tv.a',
      Week: '2026-W41', Hours_Before: '2', Hours_After: '1', AI_Check: 'đã kiểm', Reuse_Template: 'mẫu' });
    expect(r.review_reset).toBe(true);
    expect(r.week).toBe('2026-W41');
    const row = objs(book, 'AI_EXERCISE')[0];
    expect(row.Review_Status).toBe('');
    expect(row.Week).toBe('2026-W41');
    const weeks = objs(book, 'BAI_TAP_TUAN');
    expect(weeks.find((w) => w.Week === '2026-W41').Status).toBe('Đã nộp');
    expect(weeks.find((w) => w.Week === '2026-W40').Status).toBe('Kế hoạch');
  });

  test('exercise-delete: gỡ mã bài khỏi dòng tuần; còn bài khác thì vẫn "Đã nộp", hết bài về "Kế hoạch" (lỗi live 09/10)', () => {
    const { ctx, book } = loadGas(seedBase());
    ctx._learnMarkSubmitted_('tv.a', '2026-W40', 'EX-0001', 'Thành viên A', 'CV');
    const r = ctx.createExercise_({ Title: 'Bài 2', Prompt: 'p', Owner_Email: 'tv.a', Owner_Name: 'Thành viên A', Team: 'CV', requester_email: 'tv.a', Week: '2026-W40' });
    let wk = objs(book, 'BAI_TAP_TUAN').find((w) => w.Username === 'tv.a' && w.Week === '2026-W40');
    expect(wk.Exercise_IDs).toBe('EX-0001, ' + r.exercise_id);
    ctx.deleteExercise_({ Exercise_ID: r.exercise_id, requester_email: 'tv.a' });
    wk = objs(book, 'BAI_TAP_TUAN').find((w) => w.Username === 'tv.a' && w.Week === '2026-W40');
    expect(wk.Exercise_IDs).toBe('EX-0001');
    expect(wk.Status).toBe('Đã nộp');
    ctx.deleteExercise_({ Exercise_ID: 'EX-0001', requester_email: 'tv.a' });
    wk = objs(book, 'BAI_TAP_TUAN').find((w) => w.Username === 'tv.a' && w.Week === '2026-W40');
    expect(wk.Exercise_IDs).toBe('');
    expect(wk.Status).toBe('Kế hoạch');
  });
});

test.describe('CR-C — server: số đo + phân công việc lớn', () => {
  test('big-task-kr-save + assign-save: quyền, validate, nghiệm thu; learning-list trả % đạt + OKR', () => {
    const { ctx, book } = loadGas(seedBase());
    expect(() => ctx.saveBigTaskKr_({ Task_ID: 'VL-03', KR_Name: 'Giờ/vòng', Before_Value: 100, Target_Value: 50, reviewer_email: 'tv.k' })).toThrow(/teamlead/);
    expect(() => ctx.saveBigTaskKr_({ Task_ID: 'VL-03', KR_Name: 'Giờ/vòng', Before_Value: 100, Target_Value: 100, reviewer_email: 'lead.cv' })).toThrow(/khác số trước/);
    const kr = ctx.saveBigTaskKr_({ Task_ID: 'VL-03', KR_Name: 'Giờ/vòng', Unit: 'giờ', Before_Value: '100', Target_Value: '50', reviewer_email: 'lead.cv' });
    expect(kr.kr_id).toBe('KR-0001');
    ctx.saveBigTaskKr_({ Task_ID: 'VL-03', KR_ID: 'KR-0001', KR_Name: 'Giờ/vòng', Before_Value: '100', Target_Value: '50', Actual_Value: '60', reviewer_email: 'lead.cv' });
    expect(objs(book, 'VIEC_LON_SO')[0].Measured_At).toBe('2026-10-14');

    const a1 = ctx.saveBigTaskAssign_({ Task_ID: 'VL-03', Username: 'tv.a', Item: 'Bộ prompt', Due_Date: '2026-10-16', reviewer_email: 'lead.cv' });
    const a2 = ctx.saveBigTaskAssign_({ Task_ID: 'VL-03', Username: 'tv.b', Item: 'Đo giờ', Due_Date: '2026-10-10', reviewer_email: 'lead.cv' });
    expect(a1.assign_id).toBe('PC-0001');
    expect(objs(book, 'VIEC_LON_PHAN_CONG')[0].Display_Name).toBe('Thành viên A');
    expect(() => ctx.saveBigTaskAssign_({ Task_ID: 'VL-03', Username: 'lead.cv', Item: 'x', Status: 'Đạt', reviewer_email: 'lead.cv' })).toThrow(/chính mình/);
    ctx.saveBigTaskAssign_({ Task_ID: 'VL-03', Assign_ID: a1.assign_id, Status: 'Đạt', reviewer_email: 'lead.cv' });          // đúng hạn (14 ≤ 16)
    ctx.saveBigTaskAssign_({ Task_ID: 'VL-03', Assign_ID: a2.assign_id, Status: 'Đạt', reviewer_email: 'lead.cv' });          // trễ (14 > 10)
    expect(() => ctx.saveBigTaskAssign_({ Task_ID: 'VL-03', Assign_ID: a2.assign_id, Status: 'Đạt', Accepted_Date: '2026-10-20', reviewer_email: 'lead.cv' })).toThrow(/sau hôm nay/);
    const acc = objs(book, 'VIEC_LON_PHAN_CONG')[0];
    expect(acc.Accepted_Date).toBe('2026-10-14');
    expect(acc.Accepted_By).toBe('lead.cv');

    const lp = ctx.listLearningPlan_();
    const t = lp.big_tasks.find((x) => x.task_id === 'VL-03');
    expect(t.ratio).toBe(80);
    expect(t.okr_score).toBe(106.7);
    expect(t.assign_count).toBe(2);
    expect(t.pass_count).toBe(1);
    expect(lp.assigns.find((a) => a.assign_id === a2.assign_id).on_time_pass).toBe(false);
    expect(lp.krs[0].ratio).toBe(80);
    // Xóa mềm
    ctx.saveBigTaskAssign_({ Task_ID: 'VL-03', Assign_ID: a2.assign_id, Delete: 'true', reviewer_email: 'lead.cv' });
    expect(ctx.listLearningPlan_().assigns.length).toBe(1);
  });
});

test.describe('CR-B/CR-D — server: KPI leaderboard đọc sheet → engine', () => {
  test('M3 chỉ đếm khóa Hoàn thành có chứng chỉ; mọi role active có KPI; teamlead có T1–T4', () => {
    const seed = seedBase();
    seed.HOC_TAP_KHOA = [['Course_ID', 'Username', 'Status', 'Cert_Link', 'Paid', 'Active'],
      ['KH-1', 'tv.a', 'Hoàn thành', 'https://cert/1', 'Có', 'TRUE'],
      ['KH-2', 'tv.a', ' Hoàn thành ', '', 'Không', 'TRUE'],           // thiếu chứng chỉ → không tính
      ['KH-3', 'tv.a', 'Đã đăng ký', 'https://cert/3', 'Không', 'TRUE'],
      ['KH-4', 'pm.z', 'Hoàn thành', 'https://cert/4', 'Không', 'TRUE']];
    const { ctx } = loadGas(seed);
    ctx.reviewExercise_({ Exercise_ID: 'EX-0001', action: 'pass', Criteria: '1,2,3', reviewer_email: 'lead.cv' });   // tuần 40 → trong kỳ M2 (40–52, anh chốt 09/10)
    const lb = ctx.getKpiLeaderboard_('');
    const a = lb.member_ranking.find((m) => m.username === 'tv.a');
    expect(a.m3).toBe(50);              // 1 khóa trả phí ×2
    expect(a.m2).toBe(10);             // 1 tuần Đạt = 10%
    expect(lb.member_ranking.map((m) => m.username).sort()).toEqual(['lead.cv', 'pm.z', 'tv.a', 'tv.b', 'tv.k']);
    expect(lb.member_ranking.find((m) => m.username === 'pm.z').m3).toBe(25);
    const tl = lb.teamlead_ranking.find((t) => t.username === 'lead.cv');
    expect(tl.team_size).toBe(2);
    expect(tl).toHaveProperty('t3');
    expect(tl).toHaveProperty('t4');
    expect(lb.kpi_cap).toBe(120);
    const pv = ctx.getMemberKpiPreview_('tv.a');
    expect(pv.detail.m3_courses_done).toBe(1);
  });
});
