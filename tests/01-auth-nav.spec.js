// 01-auth-nav.spec.js — Role-based sidebar navigation tests
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER, CHAMPION_USER, REGULAR_USER, MOCK_UC_LIST, MOCK_LOOKUP } = require('./helpers');

const PAGES_WITH_NAV = ['index.html', 'register.html', 'dashboard.html'];

for (const page_path of PAGES_WITH_NAV) {
  test.describe(`[${page_path}] Role-based sidebar nav`, () => {

    test('Admin sees navDashboard + navUsers + navReviewQueue', async ({ page }) => {
      await setSession(page, ADMIN_USER);
      await mockGAS(page, {
        lookup:    MOCK_LOOKUP,
        list:      MOCK_UC_LIST,
        dashboard: { total: 0, teams: [], categories: [] },
        'next-id': { next_id: 'AIUS-999' },
      });
      await page.goto(`/${page_path}`);
      await page.waitForLoadState('networkidle');

      // navReviewQueue visible for admin
      const navRQ = page.locator('#navReviewQueue');
      await expect(navRQ).toBeVisible();

      // navUsers visible for admin
      const navUsers = page.locator('#navUsers');
      await expect(navUsers).toBeVisible();
    });

    test('Champion sees navReviewQueue only (not navUsers)', async ({ page }) => {
      await setSession(page, CHAMPION_USER);
      await mockGAS(page, {
        lookup:    MOCK_LOOKUP,
        list:      MOCK_UC_LIST,
        dashboard: { total: 0, teams: [], categories: [] },
        'next-id': { next_id: 'AIUS-999' },
      });
      await page.goto(`/${page_path}`);
      await page.waitForLoadState('networkidle');

      const navRQ    = page.locator('#navReviewQueue');
      const navUsers = page.locator('#navUsers');
      await expect(navRQ).toBeVisible();
      await expect(navUsers).not.toBeVisible();
    });

    test('Regular user sees neither navUsers nor navReviewQueue', async ({ page }) => {
      await setSession(page, REGULAR_USER);
      await mockGAS(page, {
        lookup:    MOCK_LOOKUP,
        list:      MOCK_UC_LIST,
        dashboard: { total: 0, teams: [], categories: [] },
        'next-id': { next_id: 'AIUS-999' },
      });
      await page.goto(`/${page_path}`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#navReviewQueue')).not.toBeVisible();
      await expect(page.locator('#navUsers')).not.toBeVisible();
    });

    test('Sidebar shows correct role label', async ({ page }) => {
      await setSession(page, CHAMPION_USER);
      await mockGAS(page, {
        lookup:    MOCK_LOOKUP,
        list:      MOCK_UC_LIST,
        dashboard: { total: 0, teams: [], categories: [] },
        'next-id': { next_id: 'AIUS-999' },
      });
      await page.goto(`/${page_path}`);
      await page.waitForLoadState('networkidle');

      const roleEl = page.locator('#sidebarUserRole');
      await expect(roleEl).toHaveText('Teamlead');
    });

    test('Unauthenticated user redirects to login', async ({ page }) => {
      // No session set — requireAuth should redirect
      await mockGAS(page, {});
      await page.goto(`/${page_path}`);
      await expect(page).toHaveURL(/login\.html/);
    });

  });
}
