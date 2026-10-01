// @ts-check
// 16-learning-plan.spec.js — CR (2026-10-01): "Kế hoạch học tập" (bài tập tuần, khóa học + hạn, việc lớn).
// Mock learning-*. Ngày cố định 2026-10-01 để tính tình trạng hạn ổn định.
// Kiểm: view load + ô số tổng · tình trạng hạn (quá hạn/sắp tới hạn/chưa rõ/chưa đăng ký) · lọc team/tình trạng ·
//       form đăng ký (validate + gửi) · thêm khóa (validate + gửi) · sửa khóa · việc lớn hiện nguồn.
const { test, expect } = require('@playwright/test');
const { setSession, REGULAR_USER } = require('./helpers');

const ME = Object.assign({}, REGULAR_USER, { team: 'BL' }); // username 'user01'

const DATA = {
  members: [
    { username: 'user01', display_name: 'User Test', team: 'BL', status: 'Đã đăng ký', exercise_plan: 'Tóm tắt hồ sơ', ai_tools: 'ChatGPT', usage_level: 'Hằng ngày', support_need: '', submitted_at: '2026-09-30 17:00' },
    { username: 'a2', display_name: 'Thành viên A2', team: 'CV', status: 'Đã đăng ký', exercise_plan: 'Rà soát văn bản' },
    { username: 'a3', display_name: 'Thành viên A3', team: 'CV', status: 'Đã đăng ký', exercise_plan: 'Tổng hợp ngành' },
    { username: 'a4', display_name: 'Thành viên A4', team: 'BL', status: 'Chưa đăng ký', exercise_plan: '' },
  ],
  courses: [
    { course_id: 'KH-0001', username: 'user01', display_name: 'User Test', team: 'BL', course_name: 'AI Fluency', provider: 'Anthropic Academy', paid: 'Không', target_date: '2026-10-05', status: 'Đã đăng ký' },
    { course_id: 'KH-0002', username: 'a2', display_name: 'Thành viên A2', team: 'CV', course_name: 'Làm việc thông minh hơn với AI', provider: 'Microsoft Learn', paid: 'Không', target_date: '2026-09-30', status: 'Đã đăng ký' },
    { course_id: 'KH-0003', username: 'a3', display_name: 'Thành viên A3', team: 'CV', course_name: '(Đang tìm hiểu)', provider: '', paid: 'Có', target_date: '2026-10-30', status: 'Chưa rõ khóa' },
    { course_id: 'KH-0004', username: 'a3', display_name: 'Thành viên A3', team: 'CV', course_name: 'Google AI Essentials', provider: 'Google', paid: 'Không', target_date: '2026-11-30', status: 'Đã đăng ký' },
  ],
  big_tasks: [
    { task_id: 'VL-03', task_name: 'Cập nhật thị trường, biến động ngành', team: 'CV', source_type: 'Team tự chọn', lead: 'tutv3', participants: '', hours_before: '50 giờ/tháng', target_reduction: 'Giảm 30%', pilot_deadline: '2026-10-24', status: 'Chờ chốt', note: '' },
    { task_id: 'VL-01', task_name: 'Phân tích nhanh hồ sơ vay KHDN', team: 'PTKD MB', source_type: 'PM đề xuất', lead: 'linhnv12', participants: '', hours_before: '', target_reduction: '', pilot_deadline: '2026-10-24', status: 'Chờ chốt', note: '' },
  ],
};

function _decodePayload(url) {
  const p = url.searchParams.get('payload');
  if (!p) return null;
  try { return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); }
  catch (e) { return null; }
}

async function mockLearning(page) {
  const captured = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    captured.push({ action, body: _decodePayload(url) });
    let data = null;
    if (action === 'learning-list')               data = DATA;
    else if (action === 'learning-register')      data = { username: 'user01', created: false };
    else if (action === 'learning-course-add')    data = { course_id: 'KH-0005' };
    else if (action === 'learning-course-update') data = { course_id: 'KH-0001' };
    else if (action === 'learning-course-delete') data = { deleted: true };
    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})`,
    });
  });
  return captured;
}

test.describe('Kế hoạch học tập (CR 2026-10-01)', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-01T09:00:00+07:00'));
    await setSession(page, ME);
  });

  async function open(page) {
    await page.goto('/index.html#learning-plan');
    await page.waitForFunction(() => window._learningPlan && window._learningPlan.members.length > 0, { timeout: 10000 });
  }

  test('T01 — Nav + view load, ô số tổng đúng', async ({ page }) => {
    await mockLearning(page);
    await open(page);
    await expect(page.locator('.sidebar-nav-item[data-view="learning-plan"]')).toBeVisible();
    await expect(page.locator('#lpKpiRegistered .kpi-value')).toHaveText('3/4');
    await expect(page.locator('#lpKpiCourses .kpi-value')).toHaveText('3');   // bỏ khóa "Chưa rõ"
    await expect(page.locator('#lpKpiSoon .kpi-value')).toHaveText('1');      // KH-0001 còn 4 ngày
    await expect(page.locator('#lpKpiOverdue .kpi-value')).toHaveText('1');   // KH-0002 trễ 1 ngày
    await expect(page.locator('#lpKpiUnclear .kpi-value')).toHaveText('1');
    await expect(page.locator('#lpKpiMissing .kpi-value')).toHaveText('1');
  });

  test('T02 — Bảng theo dõi: tình trạng hạn + người chưa đăng ký có dòng', async ({ page }) => {
    await mockLearning(page);
    await open(page);
    await expect(page.locator('#lpTable tr[data-state="overdue"]')).toContainText('trễ 1 ngày');
    await expect(page.locator('#lpTable tr[data-state="soon"]')).toContainText('còn 4 ngày');
    await expect(page.locator('#lpTable tr[data-state="missing"]')).toContainText('Thành viên A4');
    await expect(page.locator('#lpTable tr[data-state="unclear"]')).toHaveCount(1);
    // Quá hạn xếp đầu bảng
    await expect(page.locator('#lpTable tbody tr').first()).toHaveAttribute('data-state', 'overdue');
  });

  test('T03 — Lọc theo team và tình trạng', async ({ page }) => {
    await mockLearning(page);
    await open(page);
    await page.selectOption('#lpTeamFilter', 'CV');
    await expect(page.locator('#lpTable tbody tr')).toHaveCount(3);
    await expect(page.locator('#lpKpiRegistered .kpi-value')).toHaveText('2/2');
    await page.selectOption('#lpStateFilter', 'overdue');
    await expect(page.locator('#lpTable tbody tr')).toHaveCount(1);
    await expect(page.locator('#lpTable')).toContainText('Làm việc thông minh hơn với AI');
  });

  test('T04 — Đăng ký của tôi: nạp sẵn dữ liệu, validate, gửi đúng payload', async ({ page }) => {
    const captured = await mockLearning(page);
    await open(page);
    await expect(page.locator('#lpExercise')).toHaveValue('Tóm tắt hồ sơ');
    await expect(page.locator('#lpMyStatus')).toContainText('Đã đăng ký');
    await page.fill('#lpExercise', '');
    await page.click('#lpRegBtn');
    await expect(page.locator('#lpRegMsg')).toContainText('bài tập');
    await page.fill('#lpExercise', 'Phân tích BCTC KHDN');
    await page.selectOption('#lpUsage', '1–3 lần/tuần');
    await page.click('#lpRegBtn');
    await expect.poll(() => captured.filter(c => c.action === 'learning-register').length).toBe(1);
    const body = captured.find(c => c.action === 'learning-register').body;
    expect(body.Exercise_Plan).toBe('Phân tích BCTC KHDN');
    expect(body.Usage_Level).toBe('1–3 lần/tuần');
    expect(body.requester_email).toBe('user01');
  });

  test('T05 — Khóa học của tôi: chỉ hiện khóa của mình; thêm khóa (validate tên + hạn)', async ({ page }) => {
    const captured = await mockLearning(page);
    await open(page);
    await expect(page.locator('#lpMyCourses tbody tr')).toHaveCount(1);
    await page.click('#lpCourseBtn');
    await expect(page.locator('#lpCourseMsg')).toContainText('tên khóa');
    await page.fill('#lpCourseName', 'Prompting Essentials');
    await page.click('#lpCourseBtn');
    await expect(page.locator('#lpCourseMsg')).toContainText('hạn học xong');
    await page.fill('#lpCourseDate', '2026-10-20');
    await page.selectOption('#lpCoursePaid', 'Có');
    await page.click('#lpCourseBtn');
    await expect.poll(() => captured.filter(c => c.action === 'learning-course-add').length).toBe(1);
    const body = captured.find(c => c.action === 'learning-course-add').body;
    expect(body.Course_Name).toBe('Prompting Essentials');
    expect(body.Target_Date).toBe('2026-10-20');
    expect(body.Paid).toBe('Có');
  });

  test('T06 — Sửa khóa: nạp form, gửi update kèm Course_ID', async ({ page }) => {
    const captured = await mockLearning(page);
    await open(page);
    await page.locator('#lpMyCourses tr[data-course="KH-0001"] button', { hasText: 'Sửa' }).click();
    await expect(page.locator('#lpCourseName')).toHaveValue('AI Fluency');
    await expect(page.locator('#lpCourseDate')).toHaveValue('2026-10-05');
    await page.fill('#lpCourseDate', '2026-10-12');
    await page.click('#lpCourseBtn');
    await expect.poll(() => captured.filter(c => c.action === 'learning-course-update').length).toBe(1);
    const body = captured.find(c => c.action === 'learning-course-update').body;
    expect(body.Course_ID).toBe('KH-0001');
    expect(body.Target_Date).toBe('2026-10-12');
  });

  test('T07 — Việc lớn: hiện nguồn Team tự chọn / PM đề xuất', async ({ page }) => {
    await mockLearning(page);
    await open(page);
    await expect(page.locator('#lpBigTasks tbody tr')).toHaveCount(2);
    await expect(page.locator('#lpBigTasks')).toContainText('Team tự chọn');
    await expect(page.locator('#lpBigTasks')).toContainText('PM đề xuất');
    await expect(page.locator('#lpBigTasks')).toContainText('50 giờ/tháng → Giảm 30%');
    await expect(page.locator('#lpBigTasks')).toContainText('Teamlead điền');
  });
});
