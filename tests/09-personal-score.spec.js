// ─────────────────────────────────────────────────────────────────
// 09-personal-score.spec.js — "KPI từng người" (khung D70, 2026-10-09)
//   M1–M4 tự tính (đọc member-kpi-preview / kpi-leaderboard) · teamlead chỉ nhập số mốc chậm + nhận xét
//   · admin thấy MỌI role (D54). Thay bộ test chấm 4 tiêu chí 0–10 theo tháng (bỏ theo D69). Tên mock hư cấu.
// ─────────────────────────────────────────────────────────────────
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

const USERS = [
  { username: 'tuantt4',  display_name: 'Tuan TT4',      role: 'admin',    team: 'Team Số', active: true },
  { username: 'quangnn3', display_name: 'Quang NN3',     role: 'user',     team: 'Team Số', active: true },
  { username: 'lead.x',   display_name: 'Trưởng nhóm X', role: 'teamlead', team: 'Team Số', active: true },
  { username: 'off.y',    display_name: 'Đã nghỉ',       role: 'user',     team: 'Team Số', active: false },
];

const KPI_PREVIEW = {
  username: 'quangnn3', display_name: 'Quang NN3', team: 'Team Số', role: 'user',
  m1: 60.7, m2: 40, m3: 25, m4: 0, penalty: 0, final: 40, pass: false,
  detail: { m1_team_ratio: 50, m1_team_score: 71.4, m1_items_assigned: 4, m1_items_passed: 2,
            m2_pass_weeks: ['2026-W41', '2026-W42', '2026-W43', '2026-W44'], m3_courses_done: 1, m3_courses_paid: 0, m4_activities: 0 },
};
const KPI_BOARD = { member_ranking: [
  Object.assign({}, KPI_PREVIEW),
  { username: 'tuantt4', display_name: 'Tuan TT4', team: 'Team Số', role: 'admin', m1: 0, m2: 0, m3: 50, m4: 100, penalty: 0, final: 22.5 },
], teamlead_ranking: [], center_avg: 40 };

async function mockPS(page, capture) {
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    let data = null;
    if (action === 'users') data = USERS;
    else if (action === 'personal-score-list') data = { team: 'all', count: 0, scores: [] };
    else if (action === 'member-kpi-preview') data = KPI_PREVIEW;
    else if (action === 'kpi-leaderboard') data = KPI_BOARD;
    else if (action === 'personal-score-submit') {
      if (capture) {
        try {
          var p = url.searchParams.get('payload') || '';
          p = p.replace(/-/g, '+').replace(/_/g, '/');
          while (p.length % 4) p += '=';
          capture.body = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
        } catch (e) { capture.body = {}; }
      }
      data = { score_id: 'PS-0001', username: 'quangnn3', month: '', final_score: 0 };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `${cb}({"success":true,"data":${JSON.stringify(data)},"message":"ok"})`,
    });
  });
}

async function openPanel(page) {
  await page.goto('/personal-score.html');
  await page.waitForLoadState('networkidle');
  await page.locator('#psTable tr[data-user="quangnn3"] button').click();
  await expect(page.locator('#psPanel')).toBeVisible();
}

test.describe('KPI từng người — tự tính khung D70', () => {

  test('Bảng: admin thấy mọi role active (gồm teamlead, admin), KPI M1–M4 + tình trạng ≥70%', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockPS(page);
    await page.goto('/personal-score.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#psTable tbody tr')).toHaveCount(3);          // bỏ user đã khóa
    await expect(page.locator('#psTable')).toContainText('lead.x');
    const row = page.locator('#psTable tr[data-user="quangnn3"]');
    await expect(row).toContainText('60.7');
    await expect(row).toContainText('Chưa đạt');
  });

  test('Panel: M1–M4 tự tính + căn cứ; không còn slider 0–10', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockPS(page);
    await openPanel(page);
    await expect(page.locator('#psMonth option')).toHaveCount(5);
    await expect(page.locator('#psUsScore')).toHaveText('60.7%');
    await expect(page.locator('#psUsNote')).toContainText('2/4');
    await expect(page.locator('#psM2')).toHaveText('40%');
    await expect(page.locator('#psM2Note')).toContainText('4 tuần');
    await expect(page.locator('#psM3')).toHaveText('25');
    await expect(page.locator('#psFinalKpi')).toHaveText('40%');
    await expect(page.locator('#psSliderDiv')).toHaveCount(0);
  });

  test('Điểm trừ: 3 mốc chậm → −6, KPI xem trước 34; lưu gửi Month + Milestones_Late, không gửi 4 tiêu chí', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    const cap = {};
    await mockPS(page, cap);
    await openPanel(page);
    await expect(page.locator('#psFinalKpi')).toHaveText('40%');
    await page.fill('#psLate', '3');
    await page.locator('#psLate').dispatchEvent('input');
    await expect(page.locator('#psPenalty')).toHaveText('6');
    await expect(page.locator('#psFinalKpi')).toHaveText('34%');
    await page.click('#psSubmitBtn');
    await expect.poll(() => cap.body && cap.body.Username, { timeout: 8000 }).toBe('quangnn3');
    expect(cap.body.Milestones_Late).toBe(3);
    expect(String(cap.body.Month)).toMatch(/^Tháng \d{2}\/2026$/);
    expect(cap.body.Diversity).toBeUndefined();
  });
});
