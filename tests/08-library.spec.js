// 08-library.spec.js — P15 Thư viện Prompt/Workflow/Quick Win
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER, REGULAR_USER } = require('./helpers');

const LIB_UCS = [
  { record_id: 'REC-001', usecase_id: 'AIUS-001', name: 'Soạn email tự động', team: 'Team Số',
    owner_name: 'User A', status: 'Approved', workflow: '1. Workflow chung', total_score: 80 },
  { record_id: 'REC-002', usecase_id: 'AIUS-002', name: 'Tóm tắt hợp đồng', team: 'Team ABC',
    owner_name: 'User B', status: 'Approved', workflow: '2. Workflow đặc thù PO', total_score: 70 },
  { record_id: 'REC-003', usecase_id: 'AIUS-003', name: 'UC nháp', team: 'Team Số',
    owner_name: 'User C', status: 'Draft', workflow: '1. Workflow chung', total_score: 0 },
];

const LIB_MOCK = {
  list: LIB_UCS,
  'reuse-counts': { threshold: 3, map: { 'REC-002': { count: 3, reusers: ['x', 'y', 'z'] } } },
  usecase: { Record_ID: 'REC-001', UseCase_ID: 'AIUS-001', UseCase_Name: 'Soạn email tự động',
    Prompt_Role: 'Trợ lý soạn thảo', Prompt_Task: 'Viết email chuyên nghiệp', Prompt_Goal: 'Tiết kiệm thời gian' },
};

async function gotoLibrary(page, user) {
  await setSession(page, user);
  await mockGAS(page, LIB_MOCK);
  await page.goto('/library.html');
  await page.waitForLoadState('networkidle');
}

test('T01: Library loads for any authenticated user', async ({ page }) => {
  await gotoLibrary(page, REGULAR_USER);
  await expect(page).toHaveURL(/library\.html/);
  await expect(page.locator('#libContent')).toBeVisible();
});

test('T02: Unauthenticated redirects to login', async ({ page }) => {
  await mockGAS(page, {});
  await page.goto('/library.html');
  await expect(page).toHaveURL(/login\.html/);
});

test('T03: Only Approved UCs shown, grouped by workflow', async ({ page }) => {
  await gotoLibrary(page, ADMIN_USER);
  // 2 Approved (REC-001, REC-002) trong 2 workflow → 2 section; Draft REC-003 bị loại
  const sections = page.locator('#libContent .section-panel');
  await expect(sections).toHaveCount(2);
  await expect(page.locator('#libContent')).toContainText('Soạn email tự động');
  await expect(page.locator('#libContent')).not.toContainText('UC nháp');
});

test('T04: Search filters cards', async ({ page }) => {
  await gotoLibrary(page, ADMIN_USER);
  await page.locator('#libSearch').fill('tóm tắt');
  await page.locator('#libSearch').dispatchEvent('input');
  await page.waitForTimeout(350);
  await expect(page.locator('#libContent')).toContainText('Tóm tắt hợp đồng');
  await expect(page.locator('#libContent')).not.toContainText('Soạn email tự động');
});

test('T05: Open prompt modal fetches and renders prompt', async ({ page }) => {
  await gotoLibrary(page, ADMIN_USER);
  await page.locator('#libContent button:has-text("Copy Prompt")').first().click();
  await expect(page.locator('#libModal')).toBeVisible();
  await expect(page.locator('#libModalBody')).toContainText('Viết email chuyên nghiệp');
});

test('T06: navLibrary present in sidebar', async ({ page }) => {
  await gotoLibrary(page, REGULAR_USER);
  await expect(page.locator('#navLibrary')).toHaveClass(/is-active/);
});

test('T07: Reuse badge shows count + "Lan tỏa đạt" khi ≥3', async ({ page }) => {
  await gotoLibrary(page, ADMIN_USER);
  // REC-002 có 3 người tái dùng → badge "Lan tỏa đạt"
  await expect(page.locator('#libContent')).toContainText('3 người tái dùng');
  await expect(page.locator('#libContent')).toContainText('Lan tỏa đạt');
});

test('T08: "Tôi đã tái dùng" button calls reuse-confirm', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  let reuseCalled = false;
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action');
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    let data = null;
    if (action === 'reuse-confirm') { reuseCalled = true; data = { record_id: 'REC-001', reuse_count: 1, reused: true }; }
    else if (action === 'list') data = LIB_UCS;
    else if (action === 'reuse-counts') data = { threshold: 3, map: {} };
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}({"success":true,"data":${JSON.stringify(data)},"message":"ok"})` });
  });
  await page.goto('/library.html');
  await page.waitForLoadState('networkidle');
  await page.locator('#libContent button:has-text("Tôi đã tái dùng")').first().click();
  await page.waitForTimeout(300);
  expect(reuseCalled).toBe(true);
});
