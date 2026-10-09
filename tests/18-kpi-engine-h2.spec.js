// @ts-check
// 18-kpi-engine-h2.spec.js — Engine KPI khung D70 (2026-10-09) chạy THẲNG code GAS (Config.gs + KpiEngineH2.gs)
// trong Node vm — không cần trình duyệt. Đối chiếu ví dụ tính ở bản trình 06/10
// (hub comms/EMAIL_TRINH_KPI_CA_NHAN_20261006.md §3): Thành viên A = 92% đạt · Thành viên B = 40% không đạt.
// Tên người/team trong test là HƯ CẤU.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAS = path.join(__dirname, '..', 'assets', 'gas-backend');
function loadEngine() {
  const ctx = vm.createContext({});
  ['Config.gs', 'KpiEngineH2.gs'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(GAS, f), 'utf8'), ctx, { filename: f }));
  return ctx;
}
const E = loadEngine();

// ── Dữ liệu ví dụ: 2 team, mỗi team 1 việc lớn + 1 chỉ số "giờ/vòng" (trước 100 → mục tiêu khát vọng 50) ──
function weeks(from, n) { return Array.from({ length: n }, (_, i) => '2026-W' + String(from + i).padStart(2, '0')); }
function ex(owner, week, status) { return { Exercise_ID: owner + week, Owner_Email: owner, Week: week, Review_Status: status, Active: 'TRUE' }; }
function course(user, done, paid) {
  return { Course_ID: 'KH-' + user + Math.random(), Username: user, Status: done ? 'Hoàn thành' : 'Đã đăng ký',
           Cert_Link: done ? 'https://cert.example/x' : '', Paid: paid ? 'Có' : 'Không', Active: 'TRUE' };
}
function assign(user, task, pass, due, acc) {
  return { Assign_ID: 'PC-' + user + Math.random(), Task_ID: task, Username: user, Status: pass ? 'Đạt' : 'Đang làm',
           Due_Date: due || '2026-10-31', Accepted_Date: pass ? (acc || '2026-10-20') : '', Active: 'TRUE' };
}

function exampleInput() {
  return {
    users: [
      { username: 'tv.a',  display_name: 'Thành viên A', role: 'user',     team: 'Đội X', active: true },
      { username: 'tv.b',  display_name: 'Thành viên B', role: 'user',     team: 'Đội Y', active: true },
      { username: 'tv.c',  display_name: 'Thành viên C', role: 'user',     team: 'Đội X', active: true },
      { username: 'tl.x',  display_name: 'Trưởng nhóm X', role: 'teamlead', team: 'Đội X', active: true },
      { username: 'gd.z',  display_name: 'Lãnh đạo Z',   role: 'admin',    team: 'Ban',   active: true },
      { username: 'off.q', display_name: 'Đã nghỉ',      role: 'user',     team: 'Đội X', active: false },
    ],
    bigTasks: [{ Task_ID: 'VL-X', Team: 'Đội X' }, { Task_ID: 'VL-Y', Team: 'Đội Y' }],
    krs: [
      // Đội X: 100 → thực tế 60 (mục tiêu 50) = 80% mục tiêu khát vọng
      { KR_ID: 'KR-1', Task_ID: 'VL-X', Before_Value: 100, Target_Value: 50, Actual_Value: 60, Active: 'TRUE' },
      // Đội Y: 100 → thực tế 75 = 50%
      { KR_ID: 'KR-2', Task_ID: 'VL-Y', Before_Value: '100 giờ', Target_Value: '50', Actual_Value: '75', Active: 'TRUE' },
    ],
    assigns: [
      assign('tv.a', 'VL-X', true), assign('tv.a', 'VL-X', true), assign('tv.a', 'VL-X', true), assign('tv.a', 'VL-X', true),
      assign('tv.b', 'VL-Y', true), assign('tv.b', 'VL-Y', true), assign('tv.b', 'VL-Y', false), assign('tv.b', 'VL-Y', false),
    ],
    exercises: [
      ...weeks(41, 8).map((w) => ex('tv.a', w, 'Đạt')),
      ex('tv.a', '2026-W41', 'Đạt'),            // tuần 41 nộp 2 bài Đạt → chỉ tính 1
      ex('tv.a', '2026-W49', 'Chưa đạt'),       // bài Chưa đạt không tính
      ex('tv.a', '2026-W39', 'Đạt'),            // ngoài kỳ 40–52 không tính
      ...weeks(41, 4).map((w) => ex('tv.b', w, 'Đạt')),
      ex('tv.b', '2026-W45', ''),               // chờ chấm không tính
    ],
    courses: [
      course('tv.a', true), course('tv.a', true), course('tv.a', true),
      { Course_ID: 'KH-nocert', Username: 'tv.a', Status: 'Hoàn thành', Cert_Link: '', Paid: 'Không', Active: 'TRUE' }, // thiếu chứng chỉ
      course('tv.b', true), course('tv.b', false),
    ],
    claims: [
      { Claim_ID: 'SC-1', Username: 'tv.a', Status: 'Approved', Claim_Type: 'AI Clinic / buổi chia sẻ' },
      { Claim_ID: 'SC-2', Username: 'tv.b', Status: 'Submitted', Claim_Type: 'Bài đăng bản tin AI tuần' },
    ],
    reuseByOwner: {},
    personalRows: [],
    rdRows: [
      { Period: 'T10/2026', Username: 'tl.x', Due_Date: '2026-10-31', Submitted_Date: '2026-10-30' },
      { Period: 'T11/2026', Username: 'tl.x', Due_Date: '2026-11-30', Submitted_Date: '2026-12-02' }, // trễ
    ],
  };
}

test.describe('CR-D · Engine KPI D70 — ví dụ tính bản trình 06/10', () => {
  test('Thang OKR: <30 → 0 · 50 → 71 · 70 → 100 · 80 → 107 · ≥100 → 120', () => {
    expect(E._kpiOkrScore_(29)).toBe(0);
    expect(Math.round(E._kpiOkrScore_(50))).toBe(71);
    expect(E._kpiOkrScore_(70)).toBe(100);
    expect(Math.round(E._kpiOkrScore_(80))).toBe(107);
    expect(E._kpiOkrScore_(100)).toBe(120);
    expect(E._kpiOkrScore_(150)).toBe(120);
    expect(E._kpiOkrScore_(null)).toBe(0);
  });

  test('% đạt chỉ số: giảm giờ và tăng phủ đều đúng chiều; thiếu số → null', () => {
    expect(E._kpiKrRatio_({ Before_Value: 100, Target_Value: 50, Actual_Value: 60 })).toBe(80);
    expect(E._kpiKrRatio_({ Before_Value: 2, Target_Value: 20, Actual_Value: 11 })).toBe(50);   // chỉ số tăng
    expect(E._kpiKrRatio_({ Before_Value: 100, Target_Value: 50, Actual_Value: 120 })).toBe(0); // tệ hơn trước → 0
    expect(E._kpiKrRatio_({ Before_Value: 100, Target_Value: 50, Actual_Value: '' })).toBeNull();
  });

  test('Thành viên A = 92% ĐẠT (M1 103 · M2 80 · M3 75 · M4 100)', () => {
    const res = E._kpiComputeAll_(exampleInput());
    const a = res.members.find((m) => m.username === 'tv.a');
    expect(Math.round(a.detail.m1_team_score)).toBe(107);
    expect(a.detail.m1_personal).toBe(100);
    expect(Math.round(a.m1)).toBe(103);
    expect(a.m2).toBe(80);
    expect(a.detail.m2_pass_weeks.length).toBe(8);
    expect(a.m3).toBe(75);
    expect(a.m4).toBe(100);
    expect(Math.round(a.final)).toBe(92);
    expect(a.pass).toBe(true);
  });

  test('Thành viên B = 40% KHÔNG ĐẠT (M1 61 · M2 40 · M3 25 · M4 0)', () => {
    const res = E._kpiComputeAll_(exampleInput());
    const b = res.members.find((m) => m.username === 'tv.b');
    expect(Math.round(b.detail.m1_team_score)).toBe(71);
    expect(b.detail.m1_personal).toBe(50);
    expect(Math.round(b.m1)).toBe(61);
    expect(b.m2).toBe(40);
    expect(b.m3).toBe(25);
    expect(b.m4).toBe(0);
    expect(Math.round(b.final)).toBe(40);
    expect(b.pass).toBe(false);
  });

  test('Bảng KPI cá nhân nhận MỌI role active (teamlead + admin/lãnh đạo), bỏ user đã khóa', () => {
    const res = E._kpiComputeAll_(exampleInput());
    const names = res.members.map((m) => m.username).sort();
    expect(names).toEqual(['gd.z', 'tl.x', 'tv.a', 'tv.b', 'tv.c']);
  });

  test('Teamlead 40/30/20/10: T2 chia cho TOÀN BỘ member team (kể cả người chưa có điểm)', () => {
    const res = E._kpiComputeAll_(exampleInput());
    const tl = res.teamleads.find((t) => t.username === 'tl.x');
    expect(tl.team_size).toBe(2);          // tv.a + tv.c (off.q đã khóa không tính)
    expect(tl.pass_count).toBe(1);         // chỉ tv.a ≥70
    expect(tl.t2).toBe(50);
    expect(Math.round(tl.t3)).toBe(107);   // việc lớn Đội X đạt 80% → OKR 107
    expect(tl.t4).toBeCloseTo(33.3, 1);    // R&D: T10 đúng hạn, T11 trễ
    // T1 của teamlead (chưa có hoạt động cá nhân, chưa được giao hạng mục) = 50% × 106.7 × 0.4
    expect(tl.t1).toBeCloseTo(21.3, 1);
    const expected = tl.t1 * 0.4 + tl.t2 * 0.3 + tl.t3 * 0.2 + tl.t4 * 0.1;
    expect(tl.final).toBeCloseTo(expected, 0);
  });

  test('Trần 120: từng chỉ tiêu và tổng KPI không vượt 120; trừ chậm mốc tối đa −10', () => {
    const inp = exampleInput();
    inp.krs[0].Actual_Value = 40;                                         // vượt mục tiêu → 120
    inp.exercises.push(...weeks(41, 12).map((w) => ex('tv.c', w, 'Đạt')));
    inp.courses.push(...Array.from({ length: 6 }, () => course('tv.c', true, true)));
    inp.claims.push({ Username: 'tv.c', Status: 'Approved' }, { Username: 'tv.c', Status: 'Approved' }, { Username: 'tv.c', Status: 'Approved' });
    inp.assigns.push(assign('tv.c', 'VL-X', true));
    const c = E._kpiComputeAll_(inp).members.find((m) => m.username === 'tv.c');
    expect(c.m1).toBe(110);   // 50% × 120 + 50% × 100
    expect(c.m2).toBe(120);
    expect(c.m3).toBe(120);
    expect(c.m4).toBe(120);
    expect(c.final).toBe(116);
    inp.personalRows.push({ Username: 'tv.c', Month: 'Tháng 10/2026', Milestones_Late: 7 });
    const c2 = E._kpiComputeAll_(inp).members.find((m) => m.username === 'tv.c');
    expect(c2.penalty).toBe(10);
    expect(c2.final).toBe(106);
  });

  test('Hạng mục nghiệm thu TRỄ hạn không được tính', () => {
    const inp = exampleInput();
    inp.assigns = [assign('tv.c', 'VL-X', true, '2026-10-16', '2026-10-20'), assign('tv.c', 'VL-X', true, '2026-10-31', '2026-10-30')];
    const c = E._kpiComputeAll_(inp).members.find((m) => m.username === 'tv.c');
    expect(c.detail.m1_items_assigned).toBe(2);
    expect(c.detail.m1_items_passed).toBe(1);
    expect(c.detail.m1_personal).toBe(50);
  });

  test('Lan tỏa: UC được ≥3 người tái dùng = 1 hoạt động; cộng claim đã duyệt = 2 → 120', () => {
    const inp = exampleInput();
    inp.reuseByOwner = { 'tv.a': 3 };
    const a = E._kpiComputeAll_(inp).members.find((m) => m.username === 'tv.a');
    expect(a.detail.m4_activities).toBe(2);
    expect(a.m4).toBe(120);
  });
});
