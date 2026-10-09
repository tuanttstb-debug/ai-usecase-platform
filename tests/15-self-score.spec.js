// @ts-check
// 15-self-score.spec.js — Khung KPI D70 (2026-10-09): "KPI của tôi" TỰ TÍNH + khai lan tỏa có LOẠI (CR-E)
// + màn "Chấm bài & lan tỏa": teamlead chấm Đạt/Chưa đạt TỪNG BÀI (CR-A, bài Đạt = ≥3/4 tiêu chí).
// (Thay bộ test CR 2026-09-12 #3 member tự chấm KPI2/KPI3 0–10 — đã bỏ theo D69.) Tên trong mock là hư cấu.
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER, REGULAR_USER } = require('./helpers');

const KPI_ME = {
  username: 'user01', display_name: 'User Test', team: 'Team ABC', role: 'user',
  m1: 103.3, m2: 80, m3: 75, m4: 100, penalty: 0, final: 91.6, pass: true, kpi_pass: 70, kpi_cap: 120,
  detail: { m1_team_ratio: 80, m1_team_score: 106.7, m1_items_assigned: 4, m1_items_passed: 4, m1_personal: 100,
            m2_pass_weeks: ['2026-W41', '2026-W42'], m3_courses_done: 3, m3_courses_paid: 0,
            m4_activities: 1, milestones_late: 0 },
};
const CLAIMS = [
  { claim_id: 'SC-1', username: 'user02', display_name: 'Thành viên Hai', team: 'Team Số', month: 'Tháng 10/2026',
    claim_type: 'AI Clinic / buổi chia sẻ', description: 'Trình bày buổi chia sẻ AI cho team', evidence_link: 'https://drive/share', status: 'Submitted' },
];
const EXERCISES = [
  // Đủ 4 ô → gợi ý tick 4/4
  { exercise_id: 'EX-0101', title: 'Tóm tắt hồ sơ vay', description: 'Đầu vào: hồ sơ; đầu ra: bản tóm tắt', prompt: 'p',
    owner_name: 'Thành viên Hai', owner_email: 'user02', team: 'Team Số', week: '2026-W41',
    hours_before: 3, hours_after: 1, ai_check: 'AI tính sai tỷ lệ — đã đối chiếu', reuse_template: 'https://drive/mau', review_status: '' },
  // Chỉ có mô tả → gợi ý 1/4 → nút Đạt bị khóa
  { exercise_id: 'EX-0102', title: 'Soạn email', description: 'Email trả lời ĐVKD', prompt: 'p',
    owner_name: 'Thành viên Ba', owner_email: 'user03', team: 'Team Số', week: '2026-W40', review_status: '' },
  // Bài của chính admin → không hiện (không tự chấm)
  { exercise_id: 'EX-0103', title: 'Bài của tôi', description: 'x', prompt: 'p', owner_email: 'tuantt4', team: 'Team Số', week: '2026-W41', review_status: '' },
  // Đã chấm → chỉ hiện ở bộ lọc "Đã chấm"
  { exercise_id: 'EX-0104', title: 'Bài đã chấm', description: 'x', prompt: 'p', owner_name: 'Thành viên Hai', owner_email: 'user02',
    team: 'Team Số', week: '2026-W40', review_status: 'Đạt', review_criteria: '1,2,3' },
];

function decode(url) {
  const p = url.searchParams.get('payload');
  if (!p) return null;
  try { return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
}

async function mockScore(page) {
  const cap = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    cap.push({ action, body: decode(url), username: url.searchParams.get('username') });
    let data = null;
    if (action === 'member-kpi-preview')        data = KPI_ME;
    else if (action === 'sharing-claim-submit') data = { claim_id: 'SC-NEW', status: 'Submitted' };
    else if (action === 'sharing-claim-list')   data = CLAIMS;
    else if (action === 'sharing-claim-review') data = { claim_id: 'SC-1', status: 'Approved' };
    else if (action === 'exercise-list')        data = EXERCISES;
    else if (action === 'exercise-review')      data = { exercise_id: 'EX-0101', review_status: 'Đạt' };
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})` });
  });
  return cap;
}

test.describe('KPI của tôi (tự tính) + khai lan tỏa có loại — CR-B/CR-E', () => {
  test.setTimeout(30000);

  test('T01 — my-score: KPI tự tính hiện đủ M1–M4 + tổng + Đạt; không còn ô tự khai số khóa', async ({ page }) => {
    await setSession(page, REGULAR_USER);
    const cap = await mockScore(page);
    await page.goto('/index.html#my-score');
    await expect(page.locator('.sidebar-nav-item[data-view="my-score"]')).toContainText('KPI của tôi');
    await expect(page.locator('#myKpiFinalNum')).toHaveText('91.6%');
    await expect(page.locator('#myKpiFinal')).toContainText('Đạt KPI');
    await expect(page.locator('#myKpiTable tr[data-kpi="M1"]')).toContainText('103.3%');
    await expect(page.locator('#myKpiTable tr[data-kpi="M1"]')).toContainText('4/4');
    await expect(page.locator('#myKpiTable tr[data-kpi="M2"]')).toContainText('Tuần 41, Tuần 42');
    await expect(page.locator('#myKpiTable tr[data-kpi="M3"]')).toContainText('3 khóa hoàn thành có chứng chỉ');
    await expect(page.locator('#myKpiTable tr[data-kpi="M4"]')).toContainText('100%');
    await expect(page.locator('#ssCourses')).toHaveCount(0);   // CR-B: bỏ tự khai
    expect(cap.find((c) => c.action === 'member-kpi-preview').username).toBe('user01');
  });

  test('T02 — CR-E: khai lan tỏa phải chọn loại + bằng chứng; gửi Claim_Type đúng loại', async ({ page }) => {
    await setSession(page, REGULAR_USER);
    const cap = await mockScore(page);
    await page.goto('/index.html#my-score');
    await page.locator('#scDesc').fill('Trình bày AI Clinic số 1');
    await page.locator('#scEvidence').fill('https://drive/proof');
    await page.locator('#scSubmitBtn').click();                       // chưa chọn loại → chặn
    await expect.poll(() => cap.some((c) => c.action === 'sharing-claim-submit'), { timeout: 1500 }).toBe(false);
    await expect(page.locator('#scType option')).toHaveCount(4);
    await page.selectOption('#scType', 'AI Clinic / buổi chia sẻ');
    await page.locator('#scSubmitBtn').click();
    await expect.poll(() => cap.some((c) => c.action === 'sharing-claim-submit'), { timeout: 8000 }).toBe(true);
    expect(cap.find((c) => c.action === 'sharing-claim-submit').body.Claim_Type).toBe('AI Clinic / buổi chia sẻ');
  });
});

test.describe('Chấm bài Đạt/Chưa đạt từng bài + duyệt lan tỏa — CR-A', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => { await setSession(page, ADMIN_USER); });

  test('T03 — danh sách chờ chấm: bỏ bài của chính mình + bài đã chấm; tick gợi ý theo 4 ô', async ({ page }) => {
    await mockScore(page);
    await page.goto('/index.html#score-review');
    await expect(page.locator('#srExList .dash-card[data-ex]')).toHaveCount(2, { timeout: 10000 });
    await expect(page.locator('#srExList')).not.toContainText('Bài của tôi');
    await expect(page.locator('#srExCount')).toHaveText('2 chờ chấm');
    const full = page.locator('#srExList .dash-card[data-ex="EX-0101"]');
    await expect(full.locator('.srCritCount')).toHaveText('4/4 tiêu chí');
    await expect(full.locator('.srPass')).toBeEnabled();
    const thin = page.locator('#srExList .dash-card[data-ex="EX-0102"]');
    await expect(thin.locator('.srCritCount')).toHaveText('1/4 tiêu chí');
    await expect(thin.locator('.srPass')).toBeDisabled();             // <3/4 → không cho Đạt
    await page.selectOption('#srExFilter', 'reviewed');
    await expect(page.locator('#srExList .dash-card[data-ex]')).toHaveCount(1);
    await expect(page.locator('#srExList')).toContainText('Bài đã chấm');
  });

  test('T04 — chấm Đạt gửi exercise-review kèm tiêu chí; bỏ tick còn 2/4 → khóa nút Đạt; Chưa đạt vẫn gửi được', async ({ page }) => {
    const cap = await mockScore(page);
    await page.goto('/index.html#score-review');
    const card = page.locator('#srExList .dash-card[data-ex="EX-0101"]');
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator('.srCrit[value="4"]').uncheck();
    await expect(card.locator('.srCritCount')).toHaveText('3/4 tiêu chí');
    await card.locator('.srCrit[value="3"]').uncheck();
    await expect(card.locator('.srPass')).toBeDisabled();
    await card.locator('.srCrit[value="3"]').check();
    await card.locator('.srComment').fill('Tốt');
    await card.locator('.srPass').click();
    await expect.poll(() => cap.filter((c) => c.action === 'exercise-review').length, { timeout: 8000 }).toBe(1);
    const body = cap.find((c) => c.action === 'exercise-review').body;
    expect(body.Exercise_ID).toBe('EX-0101');
    expect(body.action).toBe('pass');
    expect(body.Criteria).toBe('1,2,3');
    expect(body.Review_Comment).toBe('Tốt');
    // Bài thiếu ô: chấm Chưa đạt
    await page.locator('#srExList .dash-card[data-ex="EX-0102"] button', { hasText: 'Chưa đạt' }).click();
    await expect.poll(() => cap.filter((c) => c.action === 'exercise-review').length, { timeout: 8000 }).toBe(2);
    expect(cap.filter((c) => c.action === 'exercise-review')[1].body.action).toBe('fail');
  });

  test('T05 — duyệt lan tỏa: từ chối cần lý do; duyệt gửi sharing-claim-review', async ({ page }) => {
    const cap = await mockScore(page);
    await page.goto('/index.html#score-review');
    await expect(page.locator('#srClaimList')).toContainText('buổi chia sẻ AI', { timeout: 10000 });
    await expect(page.locator('#srClaimList')).toContainText('AI Clinic / buổi chia sẻ');
    await page.locator('#srClaimList .dash-card button', { hasText: 'Từ chối' }).first().click();
    await expect.poll(() => cap.filter((c) => c.action === 'sharing-claim-review').length, { timeout: 1500 }).toBe(0);
    await page.locator('#srClaimList .dash-card button', { hasText: 'Duyệt' }).first().click();
    await expect.poll(() => cap.some((c) => c.action === 'sharing-claim-review'), { timeout: 8000 }).toBe(true);
  });
});
