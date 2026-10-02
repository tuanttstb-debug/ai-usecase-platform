// @ts-check
// 17-course-complete.spec.js — BUG 2026-10-02: member hoàn thành khóa học TRƯỚC HẠN nhưng trạng thái không chuyển.
// Gốc: không có hành động "Hoàn thành" trên app (chỉ Sửa/Xóa; Sửa còn ép Status về "Đã đăng ký").
// Vá: nút "Hoàn thành" → route learning-course-complete; khóa xong hiện "Hoàn thành" bất kể hạn + nút "Hoàn tác";
// form khóa có ô Link chứng chỉ; ô số Theo dõi có "Khóa hoàn thành"; Status sheet dư khoảng trắng vẫn nhận "Hoàn thành".
const { test, expect } = require('@playwright/test');
const { setSession, REGULAR_USER } = require('./helpers');

const ME = Object.assign({}, REGULAR_USER, { team: 'BL' }); // username 'user01'

function makeData(courseStatus, completedDate) {
  return {
    current_week: '2026-W40',
    members: [
      { username: 'user01', display_name: 'User Test', team: 'BL', status: 'Đã đăng ký', ai_tools: 'ChatGPT', usage_level: 'Hằng ngày' },
      { username: 'a2', display_name: 'Thành viên A2', team: 'CV', status: 'Đã đăng ký' },
    ],
    weeks: [],
    courses: [
      // Hạn còn xa (30/11) → hoàn thành TRƯỚC HẠN
      { course_id: 'KH-0001', username: 'user01', display_name: 'User Test', team: 'BL', course_name: 'AI Fluency', provider: 'Anthropic Academy', paid: 'Không', target_date: '2026-11-30', status: courseStatus, completed_date: completedDate || '', cert_link: '' },
      { course_id: 'KH-0002', username: 'user01', display_name: 'User Test', team: 'BL', course_name: '(Đang tìm hiểu)', provider: '', paid: 'Không', target_date: '2026-11-30', status: 'Chưa rõ khóa' },
      // PM gõ tay ô Status dư khoảng trắng
      { course_id: 'KH-0003', username: 'a2', display_name: 'Thành viên A2', team: 'CV', course_name: 'Google AI Essentials', provider: 'Google', paid: 'Không', target_date: '2026-09-20', status: ' Hoàn thành ', completed_date: '2026-09-18' },
    ],
    big_tasks: [],
  };
}

function _decodePayload(url) {
  const p = url.searchParams.get('payload');
  if (!p) return null;
  try { return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); }
  catch (e) { return null; }
}

// state: dữ liệu "server" — learning-course-complete đổi Status như GAS thật, learning-list đọc lại.
async function mockServer(page, initialStatus) {
  const captured = [];
  const state = { status: initialStatus, completed: '' };
  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    const body   = _decodePayload(url);
    captured.push({ action, body });
    let data = null;
    if (action === 'learning-list')         data = makeData(state.status, state.completed);
    else if (action === 'exercise-list')    data = [];
    else if (action === 'learning-course-complete') {
      if (body && body.Undo === 'true') { state.status = 'Đã đăng ký'; state.completed = ''; }
      else { state.status = 'Hoàn thành'; state.completed = '2026-10-02'; }
      data = { course_id: body && body.Course_ID, status: state.status };
    }
    else if (action === 'learning-course-update') data = { course_id: 'KH-0001' };
    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})`,
    });
  });
  return captured;
}

test.describe('Hoàn thành khóa học trước hạn (BUG 2026-10-02)', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-02T09:00:00+07:00'));
    await setSession(page, ME);
  });

  async function open(page, tab) {
    await page.goto('/index.html#learning-plan' + (tab ? '/' + tab : ''));
    await page.waitForFunction(() => window._learningPlan && window._learningPlan.members.length > 0, { timeout: 10000 });
  }

  test('C01 — Khóa còn hạn có nút "Hoàn thành" → gửi learning-course-complete → trạng thái chuyển "Hoàn thành"', async ({ page }) => {
    const captured = await mockServer(page, 'Đã đăng ký');
    await open(page, 'courses');
    const row = page.locator('#lpMyCourses tr[data-course="KH-0001"]');
    await expect(row).toContainText('Đúng tiến độ');
    await row.locator('button', { hasText: 'Hoàn thành' }).click();
    await page.locator('#uiConfirmModal [data-uic="ok"]').click();
    await expect.poll(() => captured.filter(c => c.action === 'learning-course-complete').length).toBe(1);
    const body = captured.find(c => c.action === 'learning-course-complete').body;
    expect(body.Course_ID).toBe('KH-0001');
    expect(body.Undo).toBeUndefined();
    await expect(row.locator('.badge')).toHaveText('Hoàn thành');
    await expect(row).toContainText('xong 02/10/2026');
    await expect(row.locator('button', { hasText: 'Hoàn tác' })).toBeVisible();
  });

  test('C02 — Hoàn tác: gửi Undo=true → về "Đúng tiến độ"', async ({ page }) => {
    const captured = await mockServer(page, 'Hoàn thành');
    await open(page, 'courses');
    const row = page.locator('#lpMyCourses tr[data-course="KH-0001"]');
    await row.locator('button', { hasText: 'Hoàn tác' }).click();
    await page.locator('#uiConfirmModal [data-uic="ok"]').click();
    await expect.poll(() => captured.filter(c => c.action === 'learning-course-complete').length).toBe(1);
    expect(captured.find(c => c.action === 'learning-course-complete').body.Undo).toBe('true');
    await expect(row.locator('.badge')).toHaveText('Đúng tiến độ');
  });

  test('C03 — Khóa "Chưa rõ khóa" không có nút Hoàn thành (phải điền tên trước)', async ({ page }) => {
    await mockServer(page, 'Đã đăng ký');
    await open(page, 'courses');
    const row = page.locator('#lpMyCourses tr[data-course="KH-0002"]');
    await expect(row.locator('button', { hasText: 'Hoàn thành' })).toHaveCount(0);
  });

  test('C04 — Form khóa có Link chứng chỉ, gửi Cert_Link khi sửa', async ({ page }) => {
    const captured = await mockServer(page, 'Đã đăng ký');
    await open(page, 'courses');
    await page.locator('#lpMyCourses tr[data-course="KH-0001"] button', { hasText: 'Sửa' }).click();
    await page.fill('#lpCourseCert', 'https://example.com/cert/123');
    await page.click('#lpCourseBtn');
    await expect.poll(() => captured.filter(c => c.action === 'learning-course-update').length).toBe(1);
    expect(captured.find(c => c.action === 'learning-course-update').body.Cert_Link).toBe('https://example.com/cert/123');
  });

  test('C05 — Status dư khoảng trắng " Hoàn thành " vẫn tính là Hoàn thành (không thành Quá hạn); ô số đếm khóa hoàn thành', async ({ page }) => {
    await mockServer(page, 'Hoàn thành');
    await open(page, 'tracking');
    await expect(page.locator('#lpKpiDone .kpi-value')).toHaveText('2');
    await expect(page.locator('#lpKpiOverdue .kpi-value')).toHaveText('0');
  });
});
