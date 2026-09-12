// @ts-check
// 15-self-score.spec.js — CR (2026-09-12 #3): member tự chấm KPI + lan tỏa → teamlead duyệt.
// Mock các action self-score-* / sharing-claim-*. Kiểm: my-score render+preview+submit;
// sharing claim validate+submit; score-review render pending + approve/reject.
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

const PENDING_SELF = [
  { self_id: 'SS-1', username: 'user01', display_name: 'User Một', team: 'Team Số', month: 'Tháng 09/2026',
    diversity: 8, ai_proficiency: 7, product_quality: 9, quantity_met: 6, proposed_m2: 78,
    courses_completed: 5, courses_paid: 2, proposed_m3: 100,
    evidence_m2: 'https://drive/ev2', evidence_m3: 'https://drive/ev3', status: 'Submitted' },
];
const CLAIMS = [
  { claim_id: 'SC-1', username: 'user01', display_name: 'User Một', team: 'Team Số', month: 'Tháng 09/2026',
    claim_type: 'Đào tạo', description: 'Tổ chức buổi chia sẻ AI cho team', evidence_link: 'https://drive/share', status: 'Submitted' },
];

async function mockScore(page) {
  const cap = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    cap.push({ action });
    let data = null;
    if (action === 'self-score-mine')        data = [];            // chưa có bản tháng này
    else if (action === 'self-score-submit')  data = { self_id: 'SS-NEW', status: 'Submitted' };
    else if (action === 'self-score-pending') data = PENDING_SELF;
    else if (action === 'self-score-review')  data = { self_id: 'SS-1', status: 'Approved' };
    else if (action === 'sharing-claim-submit') data = { claim_id: 'SC-NEW', status: 'Submitted' };
    else if (action === 'sharing-claim-list')   data = CLAIMS;
    else if (action === 'sharing-claim-review') data = { claim_id: 'SC-1', status: 'Approved' };
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})` });
  });
  return cap;
}

test.describe('Chấm điểm cá nhân (CR 2026-09-12 #3)', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => { await setSession(page, ADMIN_USER); });

  test('T01 — my-score: view load, preview KPI2/KPI3 tính đúng', async ({ page }) => {
    await mockScore(page);
    await page.goto('/index.html#my-score');
    await expect(page.locator('.sidebar-nav-item[data-view="my-score"]')).toBeVisible();
    await expect(page.locator('#myScoreMonth')).toContainText('Tháng');
    // KPI2 = DV*.3+AI*.2+PQ*.3+QM*.2, *10 → 10,10,10,10 = 100
    await page.locator('#ssDiv').fill('10'); await page.locator('#ssAi').fill('10');
    await page.locator('#ssPq').fill('10'); await page.locator('#ssQm').fill('10');
    await page.locator('#ssQm').dispatchEvent('input');
    await expect(page.locator('#ssPrevM2')).toHaveText('100/100');
    // KPI3: 4 khóa (0 trả phí) = 100
    await page.locator('#ssCourses').fill('4'); await page.locator('#ssCourses').dispatchEvent('input');
    await expect(page.locator('#ssPrevM3')).toHaveText('100/100');
  });

  test('T02 — my-score: nộp tự chấm → fire self-score-submit', async ({ page }) => {
    const cap = await mockScore(page);
    await page.goto('/index.html#my-score');
    await page.locator('#ssDiv').fill('8'); await page.locator('#ssAi').fill('7');
    await page.locator('#ssPq').fill('9'); await page.locator('#ssQm').fill('6');
    await page.locator('#ssCourses').fill('3');
    await page.locator('#ssSubmitBtn').click();
    await expect.poll(() => cap.some(c => c.action === 'self-score-submit'), { timeout: 8000 }).toBe(true);
  });

  test('T03 — my-score: khai lan tỏa thiếu bằng chứng → chặn; đủ → fire submit', async ({ page }) => {
    const cap = await mockScore(page);
    await page.goto('/index.html#my-score');
    await page.locator('#scDesc').fill('Chia sẻ AI');       // thiếu evidence
    await page.locator('#scSubmitBtn').click();
    await expect.poll(() => cap.some(c => c.action === 'sharing-claim-submit'), { timeout: 2000 }).toBe(false);
    await page.locator('#scEvidence').fill('https://drive/proof');
    await page.locator('#scSubmitBtn').click();
    await expect.poll(() => cap.some(c => c.action === 'sharing-claim-submit'), { timeout: 8000 }).toBe(true);
  });

  test('T04 — score-review: pending render + approve fires + reject cần lý do', async ({ page }) => {
    const cap = await mockScore(page);
    await page.goto('/index.html#score-review');
    await expect(page.locator('#srSelfList')).toContainText('User Một', { timeout: 10000 });
    await expect(page.locator('#srSelfList')).toContainText('78/100'); // proposed_m2
    await expect(page.locator('#srClaimList')).toContainText('buổi chia sẻ AI');

    // Reject không lý do → KHÔNG fire
    await page.locator('#srSelfList .dash-card button', { hasText: 'Từ chối' }).first().click();
    await expect.poll(() => cap.filter(c => c.action === 'self-score-review').length, { timeout: 2000 }).toBe(0);
    // Approve → fire self-score-review
    await page.locator('#srSelfList .dash-card button', { hasText: 'Duyệt' }).first().click();
    await expect.poll(() => cap.some(c => c.action === 'self-score-review'), { timeout: 8000 }).toBe(true);
  });
});
