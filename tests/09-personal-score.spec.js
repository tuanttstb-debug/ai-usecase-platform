// ─────────────────────────────────────────────────────────────────
// 09-personal-score.spec.js — Chấm điểm cá nhân theo THÁNG (CR 2026-08-26)
//   CR#1 droplist tháng + M2 TB tháng · CR#2 hiện điểm US + nhóm điểm rõ
//   CR#3 slider mặc định 0 + bubble trên thanh · CR#4 dòng EVD (đọc-only)
// ─────────────────────────────────────────────────────────────────
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

const USERS = [
  { username: 'tuantt4',  display_name: 'Tuan TT4',  role: 'admin', team: 'Team Số', active: true },
  { username: 'quangnn3', display_name: 'Quang NN3', role: 'user',  team: 'Team Số', active: true },
];

const KPI_PREVIEW = {
  username: 'quangnn3', display_name: 'Quang NN3', team: 'Team Số',
  m1: 80, m2: 0, m3: 0, m4: 0, penalty: 0, final: 32,
  rank_category: 'BOTTOM_PERFORMER', uc_count: 2, months_scored: 0, has_data: true,
};

// Mock GAS + capture submit payload.
async function mockPS(page, capture) {
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    let data = null;
    if (action === 'users') data = USERS;
    else if (action === 'personal-score-list') data = { team: 'all', count: 0, scores: [] };
    else if (action === 'member-kpi-preview') data = KPI_PREVIEW;
    else if (action === 'personal-score-submit') {
      // Payload đi qua JSONP: base64url(JSON) ở query param 'payload'.
      if (capture) {
        try {
          var p = url.searchParams.get('payload') || '';
          p = p.replace(/-/g, '+').replace(/_/g, '/');
          while (p.length % 4) p += '=';
          capture.body = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
        } catch (e) { capture.body = {}; }
      }
      data = { score_id: 'PS-0001', username: 'quangnn3', month: (capture && capture.body && capture.body.Month) || '', final_score: 100 };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `${cb}({"success":true,"data":${JSON.stringify(data)},"message":"ok"})`,
    });
  });
}

test.describe('Chấm điểm cá nhân — theo tháng + US + slider + EVD', () => {

  test('Bảng hiện thành viên + nút Chấm', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockPS(page);
    await page.goto('/personal-score.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#psTable')).toContainText('quangnn3');
    await expect(page.locator('#psTable button')).toBeVisible();
  });

  test('Panel: droplist 5 tháng + slider mặc định 0 + US 80 + EVD', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockPS(page);
    await page.goto('/personal-score.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#psTable button').first().click();
    await expect(page.locator('#psPanel')).toBeVisible();

    // CR#1: droplist kỳ tháng H2 = 5 (08→12/2026)
    await expect(page.locator('#psMonth option')).toHaveCount(5);

    // CR#3: slider mặc định 0 (tháng chưa chấm)
    await expect(page.locator('#psSliderDiv')).toHaveValue('0');
    await expect(page.locator('#psSliderQt')).toHaveValue('0');

    // CR#2: hiển thị điểm US (M-KPI-1) do hội đồng chấm
    await expect(page.locator('#psUsScore')).toContainText('80');

    // CR#4: dòng EVD hiển thị
    await expect(page.locator('#psEvdRow')).toBeVisible();
    await expect(page.locator('#psEvdRow .ps-evd-label')).toContainText('Bằng chứng');
  });

  test('CR#3: giá trị hiện trên thanh (bubble) + M2 preview = 100 khi 4 tiêu chí = 10', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockPS(page);
    await page.goto('/personal-score.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#psTable button').first().click();
    await expect(page.locator('#psPanel')).toBeVisible();

    for (const id of ['#psSliderDiv', '#psSliderAi', '#psSliderPq', '#psSliderQt']) {
      await page.locator(id).fill('10');
      await page.locator(id).dispatchEvent('input');
    }
    await expect(page.locator('#psSliderDiv + .score-slider-bubble')).toHaveText('10');
    await expect(page.locator('#psProjected')).toHaveText('100');
  });

  test('CR#1: submit gửi kèm Month (kỳ tháng)', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    const cap = {};
    await mockPS(page, cap);
    await page.goto('/personal-score.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#psTable button').first().click();
    await expect(page.locator('#psPanel')).toBeVisible();
    await page.locator('#psSliderDiv').fill('8');
    await page.locator('#psSliderDiv').dispatchEvent('input');
    await page.click('#psSubmitBtn');
    await page.waitForLoadState('networkidle');

    expect(cap.body).toBeTruthy();
    expect(cap.body.Username).toBe('quangnn3');
    expect(String(cap.body.Month)).toMatch(/^Tháng \d{2}\/2026$/);
  });

});
