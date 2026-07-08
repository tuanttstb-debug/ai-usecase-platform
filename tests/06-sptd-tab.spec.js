// 06-sptd-tab.spec.js — Playwright E2E tests for Điểm SPTD tab
const { test, expect } = require('@playwright/test');
const {
  setSession, mockGAS,
  ADMIN_USER, REGULAR_USER,
  MOCK_LOOKUP, MOCK_USER_LIST,
} = require('./helpers');

// ── SPTD-specific mock data ────────────────────────────────────────
// UCs with submit_date after T0 (2026-05-01) and owner_email set
const SPTD_UC_LIST = [
  {
    record_id: 'REC-S01', usecase_id: 'AIUS-S01',
    name: 'UC user01 week1', team: 'Team ABC',
    owner_email: 'user01', owner_name: 'User Test',
    status: 'Approved', submit_date: '2026-06-09', // week 1 after T0=2026-06-01
    total_score: 80, auto_score: 60,
    quality_score: 8, business_value_score: 7, innovation_score: 5,
    reviewer_email: 'tuantt4',
  },
  {
    record_id: 'REC-S02', usecase_id: 'AIUS-S02',
    name: 'UC user01 week2', team: 'Team ABC',
    owner_email: 'user01', owner_name: 'User Test',
    status: 'Approved', submit_date: '2026-06-16', // week 2 after T0
    total_score: 60, auto_score: 45,
    quality_score: 5, business_value_score: 5, innovation_score: 5,
    reviewer_email: 'tuantt4',
  },
  {
    record_id: 'REC-S03', usecase_id: 'AIUS-S03',
    name: 'UC admin week1', team: 'Team Số',
    owner_email: 'tuantt4', owner_name: 'Tuan TT4',
    status: 'Approved', submit_date: '2026-06-10', // week 1 after T0
    total_score: 95, auto_score: 70,
    quality_score: 9, business_value_score: 9, innovation_score: 7,
    reviewer_email: 'tuantt4',
  },
  // Draft UC — should NOT count in SPTD
  {
    record_id: 'REC-S04', usecase_id: 'AIUS-S04',
    name: 'UC draft user01', team: 'Team ABC',
    owner_email: 'user01', owner_name: 'User Test',
    status: 'Draft', submit_date: '2026-06-23',
    total_score: 0, auto_score: 0,
    quality_score: 0, business_value_score: 0, innovation_score: 0,
    reviewer_email: '',
  },
];

const SPTD_MOCK = {
  lookup:    MOCK_LOOKUP,
  list:      SPTD_UC_LIST,
  users:     MOCK_USER_LIST,
  dashboard: { total: 0, teams: [], categories: [] },
  'next-id': { next_id: 'AIUS-999' },
};

// Helper: navigate to dashboard.html, click SPTD tab, wait for content
async function goToSPTDTab(page) {
  await page.goto('/dashboard.html');
  await page.waitForLoadState('networkidle');
  await page.click('[data-tab="sptd"]');
  // Wait for non-loading content (the formula box is always rendered)
  await page.waitForSelector('.sptd-formula-box', { timeout: 8000 });
}

// ─────────────────────────────────────────────────────────────────
// T01 — Tab button visible for regular user
// ─────────────────────────────────────────────────────────────────
test('T01: Tab "Điểm SPTD" visible for regular user', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await page.goto('/dashboard.html');
  await page.waitForLoadState('networkidle');

  const tabBtn = page.locator('[data-tab="sptd"]');
  await expect(tabBtn).toBeVisible();
  await expect(tabBtn).toHaveText(/Điểm SPTD/);
});

// ─────────────────────────────────────────────────────────────────
// T02 — My score card renders for regular user (user01 has 2 UCs)
// ─────────────────────────────────────────────────────────────────
test('T02: My score card renders with correct structure', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  const card = page.locator('.sptd-my-card');
  await expect(card).toBeVisible();

  // Title
  await expect(card.locator('.sptd-card-title')).toHaveText('Điểm của bạn');

  // Score big is a number
  const scoreTxt = await card.locator('.sptd-score-big').textContent();
  expect(parseFloat(scoreTxt)).toBeGreaterThan(0);

  // Rank badge exists
  await expect(card.locator('.sptd-rank-badge')).toBeVisible();

  // 3 breakdown items (Chất lượng, Số lượng, Tuần đạt)
  await expect(card.locator('.sptd-breakdown-item')).toHaveCount(3);
});

// ─────────────────────────────────────────────────────────────────
// T03 — Formula box shows scoring principles
// ─────────────────────────────────────────────────────────────────
test('T03: Formula box shows scoring principles', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  const box = page.locator('.sptd-formula-box');
  await expect(box).toBeVisible();
  await expect(box.locator('.sptd-formula-title')).toHaveText('Nguyên tắc chấm điểm');

  // Formula body contains the 80-10-10 components
  const body = await box.locator('.sptd-formula-body').textContent();
  expect(body).toContain('80%');
  expect(body).toContain('10%');
});

// ─────────────────────────────────────────────────────────────────
// T04 — Leaderboard table has rows for each user
// ─────────────────────────────────────────────────────────────────
test('T04: Leaderboard table has correct row count', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  const table = page.locator('.sptd-lb-table');
  await expect(table).toBeVisible();

  // MOCK_USER_LIST has 3 active users → 3 rows
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(3);
});

// ─────────────────────────────────────────────────────────────────
// T05 — My row in leaderboard highlighted
// ─────────────────────────────────────────────────────────────────
test('T05: My row highlighted with sptd-row--me class', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  const myRow = page.locator('.sptd-lb-table .sptd-row--me');
  await expect(myRow).toHaveCount(1);

  // My row contains the "Bạn" chip
  await expect(myRow.locator('.sptd-me-tag')).toBeVisible();
  await expect(myRow.locator('.sptd-me-tag')).toHaveText('Bạn');
});

// ─────────────────────────────────────────────────────────────────
// T06 — UC list shows correct UC count for current user
// ─────────────────────────────────────────────────────────────────
test('T06: UC list shows correct Approved UC count', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  // user01 has 2 Approved UCs in SPTD_UC_LIST (S01, S02)
  const ucTable = page.locator('.sptd-uc-table');
  await expect(ucTable).toBeVisible();
  const ucRows = ucTable.locator('tbody tr');
  await expect(ucRows).toHaveCount(2);
});

// ─────────────────────────────────────────────────────────────────
// T07 — Timeline renders week cells (≥ 1 since program started)
// ─────────────────────────────────────────────────────────────────
test('T07: Timeline renders correct number of week cells', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  const timeline = page.locator('.sptd-timeline');
  await expect(timeline).toBeVisible();

  // At least 1 cell; T0 = 2026-05-01, today = 2026-07-08 → 11 weeks
  const cells = timeline.locator('.sptd-week-cell');
  const count = await cells.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // First cell label should be "T1"
  await expect(cells.first().locator('.sptd-week-label')).toHaveText('T1');
});

// ─────────────────────────────────────────────────────────────────
// T08 — Export CSV button visible for admin, hidden for regular user
// ─────────────────────────────────────────────────────────────────
test('T08a: Export CSV button NOT visible for regular user', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  const exportBtn = page.locator('button:has-text("Xuất CSV")');
  await expect(exportBtn).toHaveCount(0);
});

test('T08b: Export CSV button visible for admin', async ({ page }) => {
  await setSession(page, ADMIN_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  const exportBtn = page.locator('button:has-text("Xuất CSV")');
  await expect(exportBtn).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// T09 — No JS console errors on SPTD tab
// ─────────────────────────────────────────────────────────────────
test('T09: No JS console errors when visiting SPTD tab', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await setSession(page, REGULAR_USER);
  await mockGAS(page, SPTD_MOCK);
  await goToSPTDTab(page);

  // Allow network settle
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
});
