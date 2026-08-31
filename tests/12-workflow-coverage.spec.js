// 12-workflow-coverage.spec.js — CR2c: trang Độ phủ Workflow (đối chiếu catalog vs US đăng ký).
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER } = require('./helpers');

const CATALOG = {
  rows: [
    { catalog_id: 'WFC-1', nhom: 'G1', workflow: 'WF A', usecase: 'UC a1', active: 'x' },
    { catalog_id: 'WFC-2', nhom: 'G1', workflow: 'WF A', usecase: 'UC a2', active: 'x' },
    { catalog_id: 'WFC-3', nhom: 'G1', workflow: 'WF B', usecase: 'UC b1', active: 'x' },
    { catalog_id: 'WFC-4', nhom: 'G2', workflow: 'WF C', usecase: 'UC c1', active: 'x' },
  ],
  groups: ['G1', 'G2'], team_map: [],
};
const LIST = [
  { record_id: 'R1', usecase_id: 'AIUS-1', name: 'UC a1', workflow: 'WF A', team: 'Số', status: 'Submitted' },
];

async function gotoCoverage(page) {
  await setSession(page, ADMIN_USER);
  await mockGAS(page, { 'workflow-list': CATALOG, list: LIST });
  await page.goto('/workflow-coverage.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#wfcContent')).toBeVisible();
}

test('CR2c: ma trận độ phủ + tổng hợp đúng', async ({ page }) => {
  await gotoCoverage(page);
  // Summary: 1/3 workflow có US
  await expect(page.locator('#wfcSummary')).toContainText('1 / 3');
  // Nhóm + workflow hiển thị
  await expect(page.locator('#wfcContent')).toContainText('G1');
  await expect(page.locator('#wfcContent')).toContainText('G2');
  await expect(page.locator('#wfcContent')).toContainText('WF A');
  await expect(page.locator('#wfcContent')).toContainText('WF B');
  await expect(page.locator('#wfcContent')).toContainText('WF C');
  // WF A đã có US, WF B chưa
  await expect(page.locator('#wfcContent')).toContainText('Đã có US');
  await expect(page.locator('#wfcContent')).toContainText('Chưa có');
});

test('CR2c: drill workflow → US catalog covered/uncovered', async ({ page }) => {
  await gotoCoverage(page);
  await page.evaluate(() => WorkflowCoverage.openWf(0, 0)); // G1 / WF A
  const body = page.locator('#wfcModalBody');
  await expect(page.locator('#wfcModal')).not.toHaveClass(/hidden/);
  await expect(body).toContainText('UC a1'); // covered
  await expect(body).toContainText('Đã đăng ký');
  await expect(body).toContainText('UC a2'); // uncovered
  await expect(body).toContainText('Chưa');
});

test('CR2c: build tính coveredCatalog + regCount đúng', async ({ page }) => {
  await gotoCoverage(page);
  const stats = await page.evaluate(() => {
    const g = WorkflowCoverage._groups();
    const wfA = g[0].workflows.find(w => w.name === 'WF A');
    const wfB = g[0].workflows.find(w => w.name === 'WF B');
    return { aReg: wfA.regCount, aCov: wfA.coveredCatalog, aCat: wfA.catalogCount, bReg: wfB.regCount };
  });
  expect(stats).toEqual({ aReg: 1, aCov: 1, aCat: 2, bReg: 0 });
});
