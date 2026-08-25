// 06-sptd-tab.spec.js — H2 Giai đoạn 3: tab "Điểm SPTD" (80-10-10) ĐÃ ẩn;
// thay bằng Leaderboard KPI mới (Điểm US hội đồng / Điểm cá nhân / KPI tổng hợp / KPI Teamlead + PM card).
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER, REGULAR_USER } = require('./helpers');

const MOCK_H2 = {
  uc_ranking: [
    { rank: 1, record_id: 'REC-001', usecase_id: 'AIUS-001', name: 'UC A', team: 'Team Số',
      owner_name: 'User A', uc_score: 80, rank_category: 'STRONG_CONTRIBUTOR', scored_count: 4, council_size: 4 },
  ],
  personal_ranking: [
    { rank: 1, username: 'user01', display_name: 'User Test', team: 'Team ABC', final_score: 70, rank_category: 'STRONG_CONTRIBUTOR' },
  ],
  council_size: 4, filter_team: 'all',
};

const MOCK_KPI = {
  member_ranking: [
    { rank: 1, username: 'tuantt4', display_name: 'Tuan TT4', team: 'Team Số', m1: 90, m2: 90, m3: 100, m4: 100, penalty: 0, final: 90, rank_category: 'TOP_PERFORMER' },
    { rank: 2, username: 'user01', display_name: 'User Test', team: 'Team ABC', m1: 80, m2: 70, m3: 50, m4: 100, penalty: 0, final: 74.5, rank_category: 'STRONG_CONTRIBUTOR' },
  ],
  teamlead_ranking: [
    { rank: 1, username: 'champion01', display_name: 'Champion Test', team: 'Team Số', t1: 80, t2: 100, team_size: 2, pass_count: 2, final: 88, rank_category: 'TOP_PERFORMER' },
  ],
  center_avg: 74.5, kpi_pass: 70, council_size: 4, filter_team: 'all',
};

const LB_MOCK = {
  'h2-leaderboard':  MOCK_H2,
  'kpi-leaderboard': MOCK_KPI,
};

async function gotoLeaderboard(page, user) {
  await setSession(page, user);
  await mockGAS(page, LB_MOCK);
  await page.goto('/leaderboard.html');
  await page.waitForLoadState('networkidle');
}

test('T01: Leaderboard loads with 4 KPI tabs', async ({ page }) => {
  await gotoLeaderboard(page, ADMIN_USER);
  await expect(page.locator('.lb-tab[data-tab="top"]')).toBeVisible();
  await expect(page.locator('.lb-tab[data-tab="personal"]')).toBeVisible();
  await expect(page.locator('.lb-tab[data-tab="kpiMember"]')).toBeVisible();
  await expect(page.locator('.lb-tab[data-tab="kpiTeamlead"]')).toBeVisible();
});

test('T02: UC ranking (Điểm US) tab renders rows from h2-leaderboard', async ({ page }) => {
  await gotoLeaderboard(page, ADMIN_USER);
  const rows = page.locator('#topTable table tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(page.locator('#topTable')).toContainText('UC A');
});

test('T03: KPI tổng hợp tab shows member breakdown', async ({ page }) => {
  await gotoLeaderboard(page, ADMIN_USER);
  await page.click('.lb-tab[data-tab="kpiMember"]');
  await expect(page.locator('#tabKpiMember')).toBeVisible();
  const rows = page.locator('#kpiMemberTable table tbody tr');
  await expect(rows).toHaveCount(2);
  // final score column present
  await expect(page.locator('#kpiMemberTable')).toContainText('74.5');
});

test('T04: KPI Teamlead tab renders teamlead ranking', async ({ page }) => {
  await gotoLeaderboard(page, ADMIN_USER);
  await page.click('.lb-tab[data-tab="kpiTeamlead"]');
  await expect(page.locator('#tabKpiTeamlead')).toBeVisible();
  const rows = page.locator('#kpiTeamleadTable table tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(page.locator('#kpiTeamleadTable')).toContainText('Champion Test');
});

test('T05: PM card visible for admin with A1/A2 auto', async ({ page }) => {
  await gotoLeaderboard(page, ADMIN_USER);
  await expect(page.locator('#pmKpiCard')).toBeVisible();
  // A1 = tuantt4 member final = 90; A2 = center_avg = 74.5
  await expect(page.locator('#pmA1')).toHaveText('90');
  await expect(page.locator('#pmA2')).toHaveText('74.5');
});

test('T06: PM card final recomputes when A3/A4 entered', async ({ page }) => {
  await gotoLeaderboard(page, ADMIN_USER);
  await page.locator('#pmA3').fill('100');
  await page.locator('#pmA3').dispatchEvent('input');
  await page.locator('#pmA4').fill('100');
  await page.locator('#pmA4').dispatchEvent('input');
  // 90*.3 + 74.5*.2 + 100*.3 + 100*.2 = 27 + 14.9 + 30 + 20 = 91.9
  await expect(page.locator('#pmKpiFinal')).toHaveText('91.9');
});

test('T07: PM card hidden for non-admin', async ({ page }) => {
  await gotoLeaderboard(page, REGULAR_USER);
  await expect(page.locator('#pmKpiCard')).not.toBeVisible();
});

test('T08: SPTD tab button is hidden on dashboard', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, {});
  await page.goto('/dashboard.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#tab-btn-sptd')).toBeHidden();
});

test('T09: No JS console errors on leaderboard', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await gotoLeaderboard(page, ADMIN_USER);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
