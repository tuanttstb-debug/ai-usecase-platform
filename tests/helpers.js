/**
 * Shared test helpers for AI-US-SPTD Playwright tests.
 * Handles: session injection, GAS JSONP mocking, common assertions.
 */

/** @param {import('@playwright/test').Page} page */
async function setSession(page, user) {
  await page.addInitScript((u) => {
    sessionStorage.setItem('ai_user_session', JSON.stringify(u));
  }, user);
}

/**
 * Intercept all script.google.com requests and return mock JSONP responses.
 * @param {import('@playwright/test').Page} page
 * @param {Object} actionMap  — { 'action-name': responseData }
 *   responseData is the `data` field. Pass null to simulate GAS error.
 */
async function mockGAS(page, actionMap) {
  await page.route('**/script.google.com/**', async (route) => {
    const url   = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb    = url.searchParams.get('callback') || '__gasCb_test';

    if (action in actionMap) {
      const payload = actionMap[action];
      const gasResp = payload !== null
        ? { success: true, data: payload, message: 'ok' }
        : { success: false, data: null, message: 'Mock error' };
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: `${cb}(${JSON.stringify(gasResp)})`,
      });
    } else {
      // Unknown action — return success with empty data so pages don't stall
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":true,"data":null,"message":"unmocked:${action}"})`,
      });
    }
  });
}

// ── Fixture users ─────────────────────────────────────────────────
const ADMIN_USER = {
  email: 'tuantt4',
  displayName: 'Tuan TT4',
  role: 'admin',
  team: 'Team Số',
  loginAt: new Date().toISOString(),
};

const CHAMPION_USER = {
  email: 'champion01',
  displayName: 'Champion Test',
  role: 'champion',
  team: 'Team Số',
  loginAt: new Date().toISOString(),
};

const REGULAR_USER = {
  email: 'user01',
  displayName: 'User Test',
  role: 'user',
  team: 'Team ABC',
  loginAt: new Date().toISOString(),
};

// ── Mock GAS data ─────────────────────────────────────────────────
const MOCK_UC_LIST = [
  {
    record_id: 'REC-001', usecase_id: 'AIUS-001',
    name: 'UC Chờ đánh giá A', team: 'Team Số', owner_name: 'User A',
    status: 'Submitted', total_score: 0, auto_score: 32, manual_score: 0,
  },
  {
    record_id: 'REC-002', usecase_id: 'AIUS-002',
    name: 'UC Đang review B', team: 'Team Số', owner_name: 'User B',
    status: 'Under Review', total_score: 0, auto_score: 45, manual_score: 0,
  },
  {
    record_id: 'REC-003', usecase_id: 'AIUS-003',
    name: 'UC Đã hoàn thành C', team: 'Team Số', owner_name: 'User C',
    status: 'Approved', total_score: 75, auto_score: 55, manual_score: 20,
  },
  {
    record_id: 'REC-004', usecase_id: 'AIUS-004',
    name: 'UC Team khác (hidden for champion)', team: 'Team Khác', owner_name: 'User D',
    status: 'Submitted', total_score: 0, auto_score: 18, manual_score: 0,
  },
];

const MOCK_USER_LIST = [
  { username: 'tuantt4',   display_name: 'Tuan TT4',       role: 'admin',    team: 'Team Số', email: '', active: true,  last_login: '2026-06-17T08:00:00Z' },
  { username: 'champion01',display_name: 'Champion Test',   role: 'champion', team: 'Team Số', email: '', active: true,  last_login: '2026-06-16T10:00:00Z' },
  { username: 'user01',    display_name: 'User Test',       role: 'user',     team: 'Team ABC', email: '', active: true, last_login: '2026-06-10T09:00:00Z' },
];

const MOCK_LOOKUP = {
  teams: ['Team Số', 'Team Khác'],
  categories: ['Automation', 'Analytics'],
  stages: ['POC', 'Production'],
  reuse_levels: ['Cá nhân', 'Team', 'Cross-team'],
};

module.exports = {
  setSession, mockGAS,
  ADMIN_USER, CHAMPION_USER, REGULAR_USER,
  MOCK_UC_LIST, MOCK_USER_LIST, MOCK_LOOKUP,
};
