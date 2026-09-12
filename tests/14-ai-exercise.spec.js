// @ts-check
// 14-ai-exercise.spec.js — CR (2026-09-12): tính năng "Bài tập AI" (chia sẻ thao tác nhỏ).
// Mock exercise-list / exercise-create. Kiểm: view load, list render, validate, create, search.
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

const EX_LIST = [
  { exercise_id: 'EX-0001', title: 'Tách ý chính từ email dài', description: 'Dán email, AI trả 3 gạch đầu dòng',
    prompt: 'Bạn là trợ lý. Tóm tắt email sau thành 3 ý...', demo_link: 'https://drive.example.com/ex1',
    owner_name: 'Tuan TT4', owner_email: 'tuantt4', team: 'Team Số', created_at: '2026-09-11T02:00:00Z' },
  { exercise_id: 'EX-0002', title: 'Sinh checklist review hợp đồng', description: '',
    prompt: 'Liệt kê checklist rà soát hợp đồng tín dụng...', demo_link: '',
    owner_name: 'Nguyễn B', owner_email: 'b', team: 'Team Khác', created_at: '2026-09-10T02:00:00Z' },
];

async function mockEx(page) {
  const captured = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    captured.push({ action, url: url.href });
    let data = null;
    if (action === 'exercise-list')        data = EX_LIST;
    else if (action === 'exercise-create') data = { exercise_id: 'EX-0003' };
    else if (action === 'exercise-update') data = { exercise_id: url.searchParams.get('id') || 'EX-X' };
    else if (action === 'exercise-delete') data = { deleted: true };
    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})`,
    });
  });
  return captured;
}

test.describe('Bài tập AI (CR 2026-09-12)', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => { await setSession(page, ADMIN_USER); });

  test('T01 — Nav + view load, form đăng bài + danh sách render', async ({ page }) => {
    await mockEx(page);
    await page.goto('/index.html#ai-exercise');
    await expect(page.locator('.sidebar-nav-item[data-view="ai-exercise"]')).toBeVisible();
    await expect(page.locator('#exFormCard')).toBeVisible();
    await page.waitForFunction(() => window._exercises && window._exercises.length > 0, { timeout: 10000 });
    await expect(page.locator('#exList .dash-card')).toHaveCount(2);
    await expect(page.locator('#exList')).toContainText('Tách ý chính từ email dài');
  });

  test('T02 — Validate: thiếu Tiêu đề / thiếu Prompt → báo lỗi, không gửi', async ({ page }) => {
    const captured = await mockEx(page);
    await page.goto('/index.html#ai-exercise');
    await page.waitForFunction(() => window._exercises !== undefined, { timeout: 10000 });

    await page.locator('#exSubmitBtn').click();
    await expect(page.locator('#exFormMsg')).toContainText('Tiêu đề');

    await page.locator('#exTitle').fill('Bài mới test');
    await page.locator('#exSubmitBtn').click();
    await expect(page.locator('#exFormMsg')).toContainText('Prompt');

    expect(captured.find((c) => c.action === 'exercise-create')).toBeFalsy();
  });

  test('T03 — Đăng hợp lệ → fire exercise-create', async ({ page }) => {
    const captured = await mockEx(page);
    await page.goto('/index.html#ai-exercise');
    await page.waitForFunction(() => window._exercises !== undefined, { timeout: 10000 });

    await page.locator('#exTitle').fill('Dùng AI viết mô tả sản phẩm');
    await page.locator('#exPrompt').fill('Bạn là copywriter. Viết mô tả 3 câu cho sản phẩm...');
    await page.locator('#exDemoLink').fill('https://drive.example.com/new');
    await page.locator('#exSubmitBtn').click();

    await expect.poll(() => captured.some((c) => c.action === 'exercise-create'), { timeout: 8000 }).toBe(true);
  });

  test('T04 — Tìm kiếm lọc đúng bài', async ({ page }) => {
    await mockEx(page);
    await page.goto('/index.html#ai-exercise');
    await page.waitForFunction(() => window._exercises && window._exercises.length > 0, { timeout: 10000 });
    await page.locator('#exSearch').fill('checklist');
    await expect(page.locator('#exList .dash-card')).toHaveCount(1);
    await expect(page.locator('#exList')).toContainText('Sinh checklist review hợp đồng');
  });
});
