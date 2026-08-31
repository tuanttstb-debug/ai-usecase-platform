// 11-dashboard-workflow.spec.js — CR2b: Dashboard tổng hợp theo Nhóm workflow (thay Lĩnh vực).
// Ép CSS-fallback (chặn CDN Chart.js) để assert grouping theo workflow_group hiện trong DOM.
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER } = require('./helpers');

const GRP_SO = '4. Workflow đặc thù Số hóa tín dụng';
const GRP_PO = '2. Workflow đặc thù PO';
const LIST = [
  { record_id: 'R1', usecase_id: 'AIUS-1', name: 'UC1', team: 'Số',  status: 'Submitted', workflow: 'WF A', workflow_group: GRP_SO, category: 'Tín dụng' },
  { record_id: 'R2', usecase_id: 'AIUS-2', name: 'UC2', team: 'CV1', status: 'Approved',  workflow: 'WF B', workflow_group: GRP_PO, category: 'Vận hành' },
  { record_id: 'R3', usecase_id: 'AIUS-3', name: 'UC3', team: 'Số',  status: 'Submitted', workflow: 'WF A', workflow_group: GRP_SO, category: 'Tín dụng' },
];

test('CR2b: dashboard gom theo Nhóm workflow, không theo Lĩnh vực', async ({ page }) => {
  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort()); // Chart.js undefined → CSS fallback render tên nhóm ra DOM
  await setSession(page, ADMIN_USER);
  await mockGAS(page, { list: LIST, dashboard: { status_breakdown: {}, recent_submissions: [] } });
  await page.goto('/dashboard.html');
  await page.waitForLoadState('networkidle');

  // Heading đổi sang Nhóm workflow
  await expect(page.locator('h3', { hasText: 'Phân bổ theo Nhóm workflow' })).toBeVisible();

  // Chart gom theo workflow_group (CSS fallback in tên nhóm)
  const cat = page.locator('#categoryChart');
  await expect(cat).toContainText('Workflow đặc thù Số hóa tín dụng');
  await expect(cat).toContainText('Workflow đặc thù PO');
  // KHÔNG còn gom theo Lĩnh vực (giá trị category không xuất hiện làm nhãn nhóm)
  await expect(cat).not.toContainText('Tín dụng');
});

test('CR2b: _openListByField(workflow_group) drill đúng US của nhóm', async ({ page }) => {
  await setSession(page, ADMIN_USER);
  await mockGAS(page, { list: LIST, dashboard: { status_breakdown: {}, recent_submissions: [] } });
  await page.goto('/dashboard.html');
  await page.waitForLoadState('networkidle');
  const count = await page.evaluate((grp) => {
    Dashboard._openListByField('workflow_group', grp);
    return document.querySelectorAll('#listModalBody tbody tr').length;
  }, GRP_SO);
  expect(count).toBe(2); // R1 + R3 thuộc nhóm Số hóa tín dụng
});
