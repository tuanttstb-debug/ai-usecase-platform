// 02-users-page.spec.js — users.html standalone user management
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER, CHAMPION_USER, REGULAR_USER, MOCK_USER_LIST } = require('./helpers');

test.describe('users.html — User Management Page', () => {

  test('Admin can load page and see user table', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect
    await expect(page).toHaveURL(/users\.html/);

    // Table should render with 3 users
    const rows = page.locator('#usersTableWrap table tbody tr');
    await expect(rows).toHaveCount(3);
  });

  test('Admin user table has correct columns', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    const firstCell = page.locator('#usersTableWrap table tbody tr:first-child td:first-child');
    await expect(firstCell).toHaveText('tuantt4');
  });

  test('Admin sees navUsers as active nav item', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    const navUsers = page.locator('#navUsers');
    await expect(navUsers).toHaveClass(/is-active/);
  });

  test('Champion is redirected away (not admin)', async ({ page }) => {
    await setSession(page, CHAMPION_USER);
    await mockGAS(page, {});
    await page.goto('/users.html');
    await expect(page).toHaveURL(/index\.html/);
  });

  test('Unauthenticated user redirects to login', async ({ page }) => {
    await mockGAS(page, {});
    await page.goto('/users.html');
    await expect(page).toHaveURL(/login\.html/);
  });

  test('Add user button opens modal', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    const modal = page.locator('#userModal');
    await expect(modal).toHaveClass(/hidden/);

    await page.click('#addUserBtn');
    await expect(modal).not.toHaveClass(/hidden/);
    await expect(page.locator('#userModalTitle')).toHaveText('Thêm người dùng');
  });

  test('Close button hides modal', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    await page.click('#addUserBtn');
    const modal = page.locator('#userModal');
    await expect(modal).not.toHaveClass(/hidden/);

    await page.click('#userModalCloseBtn');
    await expect(modal).toHaveClass(/hidden/);
  });

  test('Edit button opens modal with user data', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    // Click edit on first row
    const editBtn = page.locator('#usersTableWrap table tbody tr:first-child button');
    await editBtn.click();

    const modal = page.locator('#userModal');
    await expect(modal).not.toHaveClass(/hidden/);
    await expect(page.locator('#userModalTitle')).toHaveText('Chỉnh sửa người dùng');
    await expect(page.locator('#umUsername')).toHaveValue('tuantt4');
  });

  test('Champion role option exists in modal', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    await page.click('#addUserBtn');
    const championOption = page.locator('#umRole option[value="champion"]');
    await expect(championOption).toHaveCount(1);
    await expect(championOption).toHaveText('Champion');
  });

  test('Role badges show correct colors (champion = blue)', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, { users: MOCK_USER_LIST });
    await page.goto('/users.html');
    await page.waitForLoadState('networkidle');

    // Second row should be champion
    const secondRow = page.locator('#usersTableWrap table tbody tr:nth-child(2) td:nth-child(3) span');
    await expect(secondRow).toHaveText('Champion');
  });

});
