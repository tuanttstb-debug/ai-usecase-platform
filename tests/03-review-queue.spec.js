// 03-review-queue.spec.js — review-queue.html tests
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER, CHAMPION_USER, REGULAR_USER, MOCK_UC_LIST } = require('./helpers');

test.describe('review-queue.html — Review Queue Page', () => {

  test('Admin can access page', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/review-queue\.html/);
  });

  test('Champion can access page', async ({ page }) => {
    await setSession(page, CHAMPION_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/review-queue\.html/);
  });

  test('Regular user is redirected away', async ({ page }) => {
    await setSession(page, REGULAR_USER);
    await mockGAS(page, {});
    await page.goto('/review-queue.html');
    await expect(page).toHaveURL(/index\.html/);
  });

  test('Unauthenticated redirects to login', async ({ page }) => {
    await mockGAS(page, {});
    await page.goto('/review-queue.html');
    await expect(page).toHaveURL(/login\.html/);
  });

  test('Admin sees all 3 queue sections rendered', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#rqContent')).toBeVisible();
    await expect(page.locator('#rqSectionPending')).toBeVisible();
    await expect(page.locator('#rqSectionUnderReview')).toBeVisible();
    await expect(page.locator('#rqSectionDone')).toBeVisible();
  });

  test('Admin sees correct badge counts (4 UCs total)', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    // Pending: 1 (REC-001 Submitted Team Số) + 1 (REC-004 Submitted Team Khác) = 2
    await expect(page.locator('#rqBadgePending')).toHaveText('2');
    // Under Review: 1 (REC-002)
    await expect(page.locator('#rqBadgeUnderReview')).toHaveText('1');
    // Done: 1 (REC-003 Approved + total_score > 0)
    await expect(page.locator('#rqBadgeDone')).toHaveText('1');
  });

  test('Champion sees only their team (Team Số) UCs', async ({ page }) => {
    await setSession(page, CHAMPION_USER); // team = 'Team Số'
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    // Champion sees Team Số only: REC-001 Submitted, not REC-004 (Team Khác)
    await expect(page.locator('#rqBadgePending')).toHaveText('1');
    // Under Review: 1 (Team Số)
    await expect(page.locator('#rqBadgeUnderReview')).toHaveText('1');
    // Done: 1 (Team Số)
    await expect(page.locator('#rqBadgeDone')).toHaveText('1');
  });

  test('navReviewQueue is marked as active', async ({ page }) => {
    await setSession(page, CHAMPION_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#navReviewQueue')).toHaveClass(/is-active/);
  });

  test('Review panel opens when clicking Review button', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    const reviewPanel = page.locator('#reviewPanel');
    await expect(reviewPanel).not.toBeVisible();

    // Click first Review button in pending queue
    const firstReviewBtn = page.locator('#rqTablePending button').first();
    await firstReviewBtn.click();

    await expect(reviewPanel).toBeVisible();
    // UC ID should be filled
    await expect(page.locator('#rpUcId')).toHaveText('AIUS-001');
  });

  test('Review panel close button works', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();

    await page.click('#reviewPanelClose');
    // Panel animates out — wait for CSS transition
    await page.waitForTimeout(300);
    await expect(page.locator('#reviewPanel')).not.toBeVisible();
  });

  test('Quality slider updates displayed value', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();

    // Set quality slider to 8
    await page.locator('#rpSliderQuality').fill('8');
    await page.locator('#rpSliderQuality').dispatchEvent('input');
    await expect(page.locator('#rpValQuality')).toHaveText('8');
  });

  test('Projected score updates when sliders change', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { list: MOCK_UC_LIST });
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();

    // REC-001 has auto_score=32. Set Q=10, BV=10, Inn=10 → total=32+30=62
    await page.locator('#rpSliderQuality').fill('10');
    await page.locator('#rpSliderQuality').dispatchEvent('input');
    await page.locator('#rpSliderBiz').fill('10');
    await page.locator('#rpSliderBiz').dispatchEvent('input');
    await page.locator('#rpSliderInn').fill('10');
    await page.locator('#rpSliderInn').dispatchEvent('input');

    await expect(page.locator('#rpProjectedTotal')).toHaveText('62');
  });

  test('Submit champion review calls API and reloads', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    let reviewCallMade = false;
    await mockGAS(page, {
      list: MOCK_UC_LIST,
      'champion-review': async (route, cb) => {
        reviewCallMade = true;
        return { record_id: 'REC-001', total_score: 62 };
      },
    });

    // Override to capture the champion-review call
    await page.route('**/script.google.com/**', async (route) => {
      const url   = new URL(route.request().url());
      const action = url.searchParams.get('action');
      const cb    = url.searchParams.get('callback') || '__gasCb_test';

      if (action === 'champion-review') {
        reviewCallMade = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: `${cb}({"success":true,"data":{"record_id":"REC-001","total_score":62},"message":"ok"})`,
        });
      } else {
        const mock = { list: MOCK_UC_LIST };
        const data = mock[action] || null;
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: `${cb}({"success":true,"data":${JSON.stringify(data)},"message":"ok"})`,
        });
      }
    });

    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();

    await page.click('#rpSubmitBtn');

    // Wait for reload — queues re-render
    await page.waitForLoadState('networkidle');
    expect(reviewCallMade).toBe(true);
  });

});
