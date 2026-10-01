// @ts-check
// 14-ai-exercise.spec.js — "Bài tập AI" (CR 2026-09-12), từ CR 2026-10-01 #2 nằm trong màn gộp
// "Bài tập & Học tập": form = tab "Bài tập tuần" (Nộp bài), danh sách = tab "Thư viện bài tập".
// Mock exercise-* + learning-list. Kiểm: link cũ #ai-exercise chuyển tab Thư viện · list render ·
// validate · nộp bài gửi kèm Week · tìm kiếm.
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

const EX_LIST = [
  { exercise_id: 'EX-0001', title: 'Tách ý chính từ email dài', description: 'Dán email, AI trả 3 gạch đầu dòng',
    prompt: 'Bạn là trợ lý. Tóm tắt email sau thành 3 ý...', demo_link: 'https://drive.example.com/ex1',
    owner_name: 'Tuan TT4', owner_email: 'tuantt4', team: 'Team Số', week: '2026-W40', created_at: '2026-09-29T02:00:00Z' },
  { exercise_id: 'EX-0002', title: 'Sinh checklist review hợp đồng', description: '',
    prompt: 'Liệt kê checklist rà soát hợp đồng tín dụng...', demo_link: '',
    owner_name: 'Nguyễn B', owner_email: 'b', team: 'Team Khác', week: '2026-W40', created_at: '2026-09-30T02:00:00Z' },
];
const LEARN = { members: [], courses: [], big_tasks: [], weeks: [], current_week: '2026-W40' };

function _decodePayload(url) {
  const p = url.searchParams.get('payload');
  if (!p) return null;
  try { return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); }
  catch (e) { return null; }
}

async function mockEx(page) {
  const captured = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    captured.push({ action, body: _decodePayload(url) });
    let data = null;
    if (action === 'exercise-list')        data = EX_LIST;
    else if (action === 'learning-list')   data = LEARN;
    else if (action === 'exercise-create') data = { exercise_id: 'EX-0003', week: '2026-W40' };
    else if (action === 'exercise-update') data = { exercise_id: 'EX-X' };
    else if (action === 'exercise-delete') data = { deleted: true };
    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})`,
    });
  });
  return captured;
}

test.describe('Bài tập AI trong màn "Bài tập & Học tập"', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-01T09:00:00+07:00'));
    await setSession(page, ADMIN_USER);
  });

  test('T01 — Link cũ #ai-exercise → tab Thư viện; menu không còn mục "Bài tập AI" riêng', async ({ page }) => {
    await mockEx(page);
    await page.goto('/index.html#ai-exercise');
    await expect(page).toHaveURL(/#learning-plan\/library$/);
    await expect(page.locator('.sidebar-nav-item[data-view="ai-exercise"]')).toHaveCount(0);
    await expect(page.locator('.sidebar-nav-item[data-view="learning-plan"]')).toContainText('Bài tập & Học tập');
    await page.waitForFunction(() => window._exercises && window._exercises.length > 0, { timeout: 10000 });
    await expect(page.locator('#exList .dash-card')).toHaveCount(2);
    await expect(page.locator('#exList')).toContainText('Tuần 40');
  });

  test('T02 — Validate: thiếu Tiêu đề / thiếu Prompt → báo lỗi, không gửi', async ({ page }) => {
    const captured = await mockEx(page);
    await page.goto('/index.html#learning-plan/week');
    await page.waitForFunction(() => window._exercises !== undefined, { timeout: 10000 });
    await page.locator('#exSubmitBtn').click();
    await expect(page.locator('#exFormMsg')).toContainText('Tiêu đề');
    await page.locator('#exTitle').fill('Bài mới test');
    await page.locator('#exSubmitBtn').click();
    await expect(page.locator('#exFormMsg')).toContainText('Prompt');
    expect(captured.find((c) => c.action === 'exercise-create')).toBeFalsy();
  });

  test('T03 — Nộp bài hợp lệ → exercise-create gửi kèm Week tuần hiện tại', async ({ page }) => {
    const captured = await mockEx(page);
    await page.goto('/index.html#learning-plan/week');
    await page.waitForFunction(() => window._learningPlan && window._exercises !== undefined, { timeout: 10000 });
    await page.locator('#exTitle').fill('Dùng AI viết mô tả sản phẩm');
    await page.locator('#exPrompt').fill('Bạn là copywriter. Viết mô tả 3 câu cho sản phẩm...');
    await page.locator('#exSubmitBtn').click();
    await expect.poll(() => captured.filter((c) => c.action === 'exercise-create').length, { timeout: 8000 }).toBe(1);
    const body = captured.find((c) => c.action === 'exercise-create').body;
    expect(body.Week).toBe('2026-W40');
    expect(body.Title).toBe('Dùng AI viết mô tả sản phẩm');
  });

  test('T04 — Tìm kiếm lọc đúng bài', async ({ page }) => {
    await mockEx(page);
    await page.goto('/index.html#learning-plan/library');
    await page.waitForFunction(() => window._exercises && window._exercises.length > 0, { timeout: 10000 });
    await page.locator('#exSearch').fill('checklist');
    await expect(page.locator('#exList .dash-card')).toHaveCount(1);
    await expect(page.locator('#exList')).toContainText('Sinh checklist review hợp đồng');
  });
});
