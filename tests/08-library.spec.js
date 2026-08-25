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
