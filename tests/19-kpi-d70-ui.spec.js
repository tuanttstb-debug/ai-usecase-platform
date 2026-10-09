// @ts-check
// 19-kpi-d70-ui.spec.js — Khung KPI D70 (2026-10-09), phần giao diện:
//   CR-A  form nộp bài: chọn tuần (nộp bù) + 4 ô mới + gắn hạng mục việc lớn; bài cũ thiếu ô → "Bổ sung"
//   CR-C  tab Việc lớn: số đo trước/mục tiêu/thực tế + phân công hạng mục + nghiệm thu (teamlead team đó)
//   CR-D  Leaderboard: bảng KPI cá nhân mọi role (/120) + KPI teamlead 4 cột T1–T4
// Ngày cố định 2026-10-14 (tuần 42). Tên trong mock là hư cấu.
const { test, expect } = require('@playwright/test');
const { setSession, REGULAR_USER, ADMIN_USER } = require('./helpers');

const MEMBER = Object.assign({}, REGULAR_USER, { team: 'CV' });                                   // user01
const LEAD   = { email: 'lead.cv', displayName: 'Trưởng nhóm CV', role: 'teamlead', team: 'CV', loginAt: new Date().toISOString() };

function learningData() {
  return {
    current_week: '2026-W42',
    members: [
      { username: 'user01', display_name: 'User Test', team: 'CV', status: 'Đã đăng ký' },
      { username: 'tv.b', display_name: 'Thành viên B', team: 'CV', status: 'Đã đăng ký' },
      { username: 'tv.k', display_name: 'Thành viên K', team: 'BL', status: 'Đã đăng ký' },
    ],
    weeks: [{ username: 'user01', team: 'CV', week: '2026-W40', plan: '', status: 'Đã nộp', exercise_ids: 'EX-0040' }],
    courses: [],
    big_tasks: [
      { task_id: 'VL-03', task_name: 'Cập nhật thị trường, biến động ngành', team: 'CV', source_type: 'Team tự chọn', lead: 'lead.cv',
        pilot_deadline: '2026-10-31', status: 'Đang làm', ratio: 80, okr_score: 106.7, kr_count: 1, measured_count: 1, assign_count: 2, pass_count: 1 },
      { task_id: 'VL-07', task_name: 'Rà soát hồ sơ bảo lãnh', team: 'BL', source_type: 'PM đề xuất', lead: 'lead.bl',
        pilot_deadline: '2026-10-31', status: 'Đang làm', ratio: null, okr_score: 0, kr_count: 0, measured_count: 0, assign_count: 0, pass_count: 0 },
    ],
    krs: [{ kr_id: 'KR-0001', task_id: 'VL-03', kr_name: 'Thời gian 1 vòng', unit: 'giờ/vòng', before_value: 100, target_value: 50, actual_value: 60, ratio: 80, measured_at: '2026-10-13' }],
    assigns: [
      { assign_id: 'PC-0001', task_id: 'VL-03', username: 'user01', display_name: 'User Test', team: 'CV', role: 'xây', item: 'Bộ prompt tóm tắt', due_date: '2026-10-16', acceptance_criteria: 'Chạy được 3 hồ sơ', status: 'Đạt', accepted_date: '2026-10-15', on_time_pass: true },
      { assign_id: 'PC-0002', task_id: 'VL-03', username: 'tv.b', display_name: 'Thành viên B', team: 'CV', role: 'đo', item: 'Đo giờ sau', due_date: '2026-10-23', acceptance_criteria: '≥3 lần đo', status: 'Đang làm', on_time_pass: false },
    ],
  };
}
const EXERCISES = [
  { exercise_id: 'EX-0040', title: 'Bài tuần 40 (cũ)', description: 'Tóm tắt văn bản', prompt: 'Hãy tóm tắt...', owner_name: 'User Test', owner_email: 'user01', team: 'CV', week: '2026-W40', created_at: '2026-10-02T02:00:00Z', review_status: '' },
];

function decode(url) {
  const p = url.searchParams.get('payload');
  if (!p) return null;
  try { return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
}
async function mock(page, extra) {
  const cap = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    cap.push({ action, body: decode(url) });
    let data = null;
    if (action === 'learning-list') data = learningData();
    else if (action === 'exercise-list') data = EXERCISES;
    else if (action === 'exercise-create') data = { exercise_id: 'EX-0099', week: '2026-W41' };
    else if (action === 'exercise-update') data = { exercise_id: 'EX-0040', week: '2026-W40' };
    else if (action === 'big-task-kr-save') data = { kr_id: 'KR-0002' };
    else if (action === 'big-task-assign-save') data = { assign_id: 'PC-0003' };
    else if (extra && action in extra) data = extra[action];
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})` });
  });
  return cap;
}
async function open(page, tab) {
  await page.goto('/index.html#learning-plan' + (tab ? '/' + tab : ''));
  await page.waitForFunction(() => window._learningPlan && window._learningPlan.members.length > 0, { timeout: 10000 });
}

test.describe('CR-A — Nộp bài: chọn tuần + 4 ô mới + gắn việc lớn', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-14T09:00:00+07:00'));
    await setSession(page, MEMBER);
  });

  test('A1 — Chọn tuần: tuần này + nộp bù tới tuần 40; gắn hạng mục được giao; gửi đủ 4 ô', async ({ page }) => {
    const cap = await mock(page);
    await open(page);
    await expect(page.locator('#exWeek option')).toHaveCount(3);
    await expect(page.locator('#exWeek')).toHaveValue('2026-W42');
    await expect(page.locator('#exWeek option').first()).toContainText('Tuần 42 (tuần này)');
    await expect(page.locator('#exBigTask option[value="PC-0001"]')).toContainText('VL-03 · Bộ prompt tóm tắt');
    await expect(page.locator('#exBigTask option[value="VL-03"]')).toHaveCount(1);
    await expect(page.locator('#exBigTask option[value="VL-07"]')).toHaveCount(0);   // việc lớn team khác không hiện
    await page.fill('#exTitle', 'Tóm tắt biến động ngành');
    await page.fill('#exDescription', 'Đầu vào: 5 bản tin; đầu ra: 1 trang tóm tắt');
    await page.fill('#exPrompt', 'Bạn là chuyên viên...');
    await page.selectOption('#exWeek', '2026-W41');
    await page.fill('#exHoursBefore', '3');
    await page.fill('#exHoursAfter', '0.5');
    await page.fill('#exAiCheck', 'AI bịa số liệu tăng trưởng — đối chiếu nguồn gốc');
    await page.fill('#exReuse', 'https://drive.example/mau');
    await page.selectOption('#exBigTask', 'PC-0001');
    await page.click('#exSubmitBtn');
    await expect.poll(() => cap.filter((c) => c.action === 'exercise-create').length).toBe(1);
    const b = cap.find((c) => c.action === 'exercise-create').body;
    expect(b.Week).toBe('2026-W41');
    expect(b.Hours_Before).toBe('3');
    expect(b.Hours_After).toBe('0.5');
    expect(b.AI_Check).toContain('đối chiếu');
    expect(b.Reuse_Template).toBe('https://drive.example/mau');
    expect(b.Big_Task_Ref).toBe('PC-0001');
  });

  test('A2 — Bài cũ tuần 40 thiếu ô mới → nút "Bổ sung" mở form giữ tuần 40, báo ô thiếu; lưu gửi update', async ({ page }) => {
    const cap = await mock(page);
    await open(page);
    const row = page.locator('#lpMyWeeks tr[data-week="2026-W40"]');
    await expect(row.locator('[data-review="pending"]')).toHaveText('Chờ chấm');
    await row.locator('button[data-supplement="EX-0040"]').click();
    await expect(page.locator('#exWeek')).toHaveValue('2026-W40');
    await expect(page.locator('#exFormMsg')).toContainText('giờ trước/sau');
    await page.fill('#exHoursBefore', '2');
    await page.fill('#exHoursAfter', '1');
    await page.fill('#exAiCheck', 'Kiểm lại số liệu');
    await page.fill('#exReuse', 'Dùng lại prompt cho bản tin tuần');
    await page.click('#exSubmitBtn');
    await expect.poll(() => cap.filter((c) => c.action === 'exercise-update').length).toBe(1);
    const b = cap.find((c) => c.action === 'exercise-update').body;
    expect(b.Exercise_ID).toBe('EX-0040');
    expect(b.Week).toBe('2026-W40');
    expect(b.Hours_Before).toBe('2');
  });
});

test.describe('CR-C — Việc lớn: số đo + phân công + nghiệm thu', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-14T09:00:00+07:00')); });

  test('C1 — Bảng hiện kết quả OKR + phân công; thành viên xem chi tiết (chỉ đọc)', async ({ page }) => {
    await setSession(page, MEMBER);
    await mock(page);
    await open(page, 'bigtasks');
    const r = page.locator('#lpBigTasks tr[data-task="VL-03"]');
    await expect(r).toContainText('80% mục tiêu → 106.7%');
    await expect(r).toContainText('1/2 đạt');
    await expect(page.locator('#lpBigTasks tr[data-task="VL-07"]')).toContainText('Chưa đo');
    await r.locator('button', { hasText: 'Chi tiết' }).click();
    await expect(page.locator('#lpBtDetail')).toBeVisible();
    await expect(page.locator('#lpBtKrs tr[data-kr="KR-0001"]')).toContainText('60');
    await expect(page.locator('#lpBtAssigns tr[data-assign="PC-0001"]')).toContainText('Đạt');
    await expect(page.locator('#lpBtKrForm')).toBeHidden();                 // member không sửa
    await expect(page.locator('#lpBtAssigns button', { hasText: 'Đạt' })).toHaveCount(0);
  });

  test('C2 — Teamlead team CV: thêm chỉ số (validate trước ≠ mục tiêu) + giao hạng mục + nghiệm thu Đạt', async ({ page }) => {
    await setSession(page, LEAD);
    const cap = await mock(page);
    await open(page, 'bigtasks');
    await page.locator('#lpBigTasks tr[data-task="VL-03"] button', { hasText: 'Chi tiết' }).click();
    await expect(page.locator('#lpBtKrForm')).toBeVisible();
    await page.fill('#lpKrName', 'Số vòng sửa');
    await page.fill('#lpKrBefore', '4');
    await page.fill('#lpKrTarget', '4');
    await page.click('#lpKrBtn');
    await expect(page.locator('#lpBtMsg')).toContainText('khác số trước');
    await page.fill('#lpKrTarget', '1');
    await page.click('#lpKrBtn');
    await expect.poll(() => cap.filter((c) => c.action === 'big-task-kr-save').length).toBe(1);
    const kr = cap.find((c) => c.action === 'big-task-kr-save').body;
    expect(kr.Task_ID).toBe('VL-03');
    expect(kr.Before_Value).toBe('4');
    expect(kr.Target_Value).toBe('1');
    expect(kr.reviewer_email).toBe('lead.cv');

    await page.selectOption('#lpAsUser', 'tv.b');
    await page.fill('#lpAsItem', 'Viết HDSD 1 trang');
    await page.fill('#lpAsDue', '2026-10-30');
    await page.click('#lpAsBtn');
    await expect.poll(() => cap.filter((c) => c.action === 'big-task-assign-save').length).toBe(1);
    const as = cap.find((c) => c.action === 'big-task-assign-save').body;
    expect(as.Username).toBe('tv.b');
    expect(as.Item).toBe('Viết HDSD 1 trang');
    expect(as.Due_Date).toBe('2026-10-30');

    await page.locator('#lpBtAssigns tr[data-assign="PC-0002"] button.btn-success').click();
    await expect.poll(() => cap.filter((c) => c.action === 'big-task-assign-save').length).toBe(2);
    const acc = cap.filter((c) => c.action === 'big-task-assign-save')[1].body;
    expect(acc.Assign_ID).toBe('PC-0002');
    expect(acc.Status).toBe('Đạt');
  });

  test('C3 — Teamlead team CV không sửa được việc lớn team BL', async ({ page }) => {
    await setSession(page, LEAD);
    await mock(page);
    await open(page, 'bigtasks');
    await page.locator('#lpBigTasks tr[data-task="VL-07"] button', { hasText: 'Chi tiết' }).click();
    await expect(page.locator('#lpBtDetail')).toBeVisible();
    await expect(page.locator('#lpBtKrForm')).toBeHidden();
    await expect(page.locator('#lpBtAsForm')).toBeHidden();
  });
});

test.describe('CR-D — Leaderboard khung D70', () => {
  test.setTimeout(30000);
  test('D1 — KPI cá nhân mọi role (/120, cột ≥70%) + KPI teamlead T1–T4', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mock(page, {
      'h2-leaderboard': { uc_ranking: [], personal_ranking: [] },
      'kpi-leaderboard': {
        member_ranking: [
          { rank: 1, username: 'tv.a', display_name: 'Thành viên A', team: 'CV', role: 'user', m1: 103.3, m2: 80, m3: 75, m4: 100, penalty: 0, final: 91.6, rank_category: 'TOP_PERFORMER' },
          { rank: 2, username: 'tuantt4', display_name: 'Tuan TT4', team: 'Team Số', role: 'admin', m1: 0, m2: 40, m3: 50, m4: 100, penalty: 0, final: 34.5, rank_category: 'BOTTOM_PERFORMER' },
        ],
        teamlead_ranking: [
          { rank: 1, username: 'lead.cv', display_name: 'Trưởng nhóm CV', team: 'CV', t1: 21.3, t2: 50, t3: 106.7, t4: 33.3, team_size: 2, pass_count: 1, final: 47.2, rank_category: 'BOTTOM_PERFORMER' },
        ],
        center_avg: 91.6,
      },
    });
    await page.goto('/index.html#leaderboard');
    await page.locator('.lb-tab[data-tab="kpiMember"]').click();
    await expect(page.locator('#kpiMemberTable')).toContainText('/120');
    await expect(page.locator('#kpiMemberTable tr[data-user="tv.a"]')).toContainText('Đạt');
    await expect(page.locator('#kpiMemberTable tr[data-user="tuantt4"]')).toContainText('admin');
    await expect(page.locator('#pmA1')).toHaveText('34.5');                 // PM-A1 lấy được KPI cá nhân admin
    await page.locator('.lb-tab[data-tab="kpiTeamlead"]').click();
    await expect(page.locator('#kpiTeamleadTable thead')).toContainText('Việc lớn·20');
    await expect(page.locator('#kpiTeamleadTable thead')).toContainText('R&D·10');
    await expect(page.locator('#kpiTeamleadTable tbody')).toContainText('1/2');
    await expect(page.locator('#kpiTeamleadTable tbody')).toContainText('106.7');
  });
});
