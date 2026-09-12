// @ts-check
// 13-us-h1.spec.js — CR (2026-09-12): view "US H1" (chỉ đọc, đọc từ sheet 'Data H1').
// Mock action h1-list. Kiểm: bảng render, cột đúng, tìm kiếm lọc, tách khỏi H2.
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

const H1_LIST = [
  { record_id: 'H1-1', usecase_id: 'AIUS-H1-001', name: 'Trợ lý soạn email H1',
    owner_name: 'Nguyễn A', owner_email: 'a', team: 'Team Số', workflow: 'Workflow chung',
    stage: 'S3 - Standardized', status: 'Approved', total_score: 70,
    action_plan_m09: '', action_plan_m10: '', action_plan_m11: '', action_plan_m12: '',
    pain_point: 'Soạn email lặp lại tốn thời gian', flow_description: 'Nhập ý → AI soạn',
    prompt_task: 'Soạn email chuyên nghiệp từ gạch đầu dòng', when_to_use: 'Khi trả lời KH',
    demo_link: 'https://drive.example.com/h1-1' },
  { record_id: 'H1-2', usecase_id: 'AIUS-H1-002', name: 'Phân tích số liệu bán hàng',
    owner_name: 'Trần B', owner_email: 'b', team: 'Team Khác', workflow: 'Workflow PO',
    stage: 'S2 - Pilot', status: 'Submitted', total_score: 0,
    action_plan_m09: 'T9: gom dữ liệu', action_plan_m10: '', action_plan_m11: '', action_plan_m12: '',
    pain_point: '', prompt_task: '' },
];

async function mockH1(page, list) {
  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    const data   = (action === 'h1-list') ? (list || H1_LIST) : null;
    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})`,
    });
  });
}

test.describe('View US H1 (CR 2026-09-12)', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => { await setSession(page, ADMIN_USER); });

  test('T01 — Nav "US H1" hiển thị + mở view render bảng đúng số dòng', async ({ page }) => {
    await mockH1(page);
    await page.goto('/index.html#us-h1');
    await expect(page.locator('.sidebar-nav-item[data-view="us-h1"]')).toBeVisible();
    await page.waitForFunction(() => window._h1UseCases && window._h1UseCases.length > 0, { timeout: 10000 });
    await expect(page.locator('#h1Content table.h1-table tbody tr')).toHaveCount(2);
    // Cột dữ liệu chính có mặt
    await expect(page.locator('#h1Content')).toContainText('AIUS-H1-001');
    await expect(page.locator('#h1Content')).toContainText('Trợ lý soạn email H1');
    await expect(page.locator('#h1Content')).toContainText('T9: gom dữ liệu'); // Kế hoạch tháng
  });

  test('T02 — Tìm kiếm lọc đúng dòng', async ({ page }) => {
    await mockH1(page);
    await page.goto('/index.html#us-h1');
    await page.waitForFunction(() => window._h1UseCases && window._h1UseCases.length > 0, { timeout: 10000 });
    await page.locator('#h1Search').fill('bán hàng');
    await expect(page.locator('#h1Content table.h1-table tbody tr')).toHaveCount(1);
    await expect(page.locator('#h1Content')).toContainText('Phân tích số liệu bán hàng');
  });

  test('T03 — Sheet trống → thông báo rỗng, không lỗi', async ({ page }) => {
    await mockH1(page, []);
    await page.goto('/index.html#us-h1');
    await expect(page.locator('#h1Content')).toContainText('Chưa có dữ liệu US H1', { timeout: 10000 });
  });

  test('T04 — Bấm dòng → modal chi tiết hiện nội dung đầy đủ', async ({ page }) => {
    await mockH1(page);
    await page.goto('/index.html#us-h1');
    await page.waitForFunction(() => window._h1UseCases && window._h1UseCases.length > 0, { timeout: 10000 });
    await page.locator('#h1Content table.h1-table tbody tr').first().click();
    await expect(page.locator('#h1Modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#h1ModalTitle')).toHaveText('Trợ lý soạn email H1');
    await expect(page.locator('#h1ModalBody')).toContainText('Soạn email lặp lại tốn thời gian'); // pain_point
    await expect(page.locator('#h1ModalBody')).toContainText('Soạn email chuyên nghiệp');          // prompt_task
    await expect(page.locator('#h1ModalBody a[href="https://drive.example.com/h1-1"]')).toBeVisible(); // demo
    // Đóng modal
    await page.locator('#h1Modal button', { hasText: '✕' }).first().click();
    await expect(page.locator('#h1Modal')).toBeHidden();
  });

  test('T05 — Lọc theo Team thu hẹp danh sách', async ({ page }) => {
    await mockH1(page);
    await page.goto('/index.html#us-h1');
    await page.waitForFunction(() => window._h1UseCases && window._h1UseCases.length > 0, { timeout: 10000 });
    await page.locator('#h1TeamFilter').selectOption('Team Khác');
    await expect(page.locator('#h1Content table.h1-table tbody tr')).toHaveCount(1);
    await expect(page.locator('#h1Content')).toContainText('Phân tích số liệu bán hàng');
  });
});
