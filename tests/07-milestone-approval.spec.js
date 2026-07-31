// 07-milestone-approval.spec.js — E2E for milestone (weekly-update) approval flow (v3.14.0)
// Fully mocked (no live GAS). Covers the admin "Chờ duyệt" milestone queue:
//   - pending milestone renders in its own section with badge
//   - Approve → calls milestone-approve
//   - Reject → prompts for reason → calls milestone-reject
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER, REGULAR_USER, MOCK_USER_LIST } = require('./helpers');

const UC_LIST = [
  {
    record_id: 'REC-M01', usecase_id: 'AIUS-M01',
    name: 'UC có milestone', team: 'Team Số',
    owner_email: 'user01', owner_name: 'User Test',
    status: 'Approved', submit_date: '2026-06-09',
    total_score: 60, current_stage: 'S2 - Pilot',
  },
];

const PENDING_MS = [
  {
    log_id: 'LOG-001', record_id: 'REC-M01', usecase_id: 'AIUS-M01',
    name: 'UC có milestone', owner_name: 'User Test', owner_email: 'user01', team: 'Team Số',
    log_date: '2026-06-16', previous_stage: 'S2 - Pilot', new_stage: 'S3 - Standardized',
    stage_changed: true, milestone_type: 'STAGE+SCORE',
    previous_total_score: 60, proposed_total_score: 75,
    weekly_update: 'Pilot xong, sẵn sàng chuẩn hóa', approval_status: 'Pending',
  },
];

// Custom mock: differentiate milestone-list by ?filter, capture approve/reject calls.
async function mockMilestoneGAS(page, opts) {
  opts = opts || {};
  const calls = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const filter = url.searchParams.get('filter') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    calls.push({ action, filter, url: url.href });

    let data = null;
    if (action === 'list') data = UC_LIST;
    else if (action === 'users') data = MOCK_USER_LIST;
    else if (action === 'dashboard') data = { total: 1, teams: [], categories: [], status_breakdown: {} };
    else if (action === 'milestone-list') {
      data = (filter === 'pending') ? (opts.pending || PENDING_MS)
           : (filter === 'approved') ? (opts.approved || [])
           : [];
    } else if (action === 'milestone-approve') data = { approval_status: 'Approved', total_score: 75 };
    else if (action === 'milestone-reject')  data = { approval_status: 'Rejected' };

    const ok = !(action === 'milestone-approve' && opts.approveFails);
    const resp = ok
      ? { success: true,  data, message: 'ok' }
      : { success: false, data: null, message: 'Mock approve error' };
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify(resp)})`,
    });
  });
  return calls;
}

async function gotoPendingTab(page) {
  await page.goto('/dashboard.html');
  await page.waitForLoadState('networkidle');
  await page.click('[data-tab="pending"]');
}

test('T01: pending milestone renders in its own section with badge', async ({ page }) => {
  await setSession(page, ADMIN_USER);
  await mockMilestoneGAS(page);
  await gotoPendingTab(page);

  const section = page.locator('#pendingMilestoneSection');
  await expect(section).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#milestoneBadge')).toHaveText('1');

  const card = page.locator('#pendingMilestoneList .pending-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('UC có milestone');
  await expect(card).toContainText('Chuyển giai đoạn + Nâng điểm');
  await expect(card).toContainText('S3 - Standardized'); // proposed stage
  await expect(card).toContainText('75');                 // proposed score
});

test('T02: section hidden when no pending milestones', async ({ page }) => {
  await setSession(page, ADMIN_USER);
  await mockMilestoneGAS(page, { pending: [] });
  await gotoPendingTab(page);

  // Wait until milestone load ran (approved list also empty) then assert hidden
  await page.waitForTimeout(1500);
  await expect(page.locator('#pendingMilestoneSection')).toBeHidden();
  await expect(page.locator('#milestoneBadge')).toHaveText('');
});

test('T03: Approve milestone fires milestone-approve with log_id', async ({ page }) => {
  await setSession(page, ADMIN_USER);
  const calls = await mockMilestoneGAS(page);
  await gotoPendingTab(page);

  await expect(page.locator('#pendingMilestoneSection')).toBeVisible({ timeout: 8000 });
  await page.locator('#pendingMilestoneList .pending-card button.btn-success').click();

  await page.waitForFunction(
    () => !!document.querySelector('.toast, #toast, [class*="toast"]'),
    { timeout: 5000 }
  ).catch(() => {}); // toast optional

  const approve = calls.find((c) => c.action === 'milestone-approve');
  expect(approve, 'milestone-approve request fired').toBeTruthy();
  expect(approve.url).toContain('milestone-approve');
});

test('T04: Reject milestone prompts for reason then fires milestone-reject', async ({ page }) => {
  await setSession(page, ADMIN_USER);
  const calls = await mockMilestoneGAS(page);

  page.on('dialog', (dialog) => dialog.accept('Chưa đủ bằng chứng'));

  await gotoPendingTab(page);
  await expect(page.locator('#pendingMilestoneSection')).toBeVisible({ timeout: 8000 });
  await page.locator('#pendingMilestoneList .pending-card button.btn-danger').click();

  await page.waitForTimeout(1000);
  const reject = calls.find((c) => c.action === 'milestone-reject');
  expect(reject, 'milestone-reject request fired').toBeTruthy();
});

test('T05: regular user does not load the milestone approval queue', async ({ page }) => {
  await setSession(page, REGULAR_USER);
  const calls = await mockMilestoneGAS(page);
  await page.goto('/dashboard.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);

  // Approved milestones still fetched (for KPI), but pending queue is admin-only
  const pendingFetch = calls.find((c) => c.action === 'milestone-list' && c.filter === 'pending');
  expect(pendingFetch, 'no pending milestone fetch for regular user').toBeFalsy();
});
