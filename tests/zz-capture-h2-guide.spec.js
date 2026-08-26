// ─────────────────────────────────────────────────────────────────
// zz-capture-h2-guide.spec.js — Chụp ảnh minh họa cho HDSD H2 (teamlead + nhân sự)
//   Render từng trang với dữ liệu MOCK (không lộ dữ liệu thật) → screenshots/h2/*.png
//   Chạy:  npx playwright test tests/zz-capture-h2-guide.spec.js
//   Sau đó dựng .docx:  python build_h2_guide.py
// ─────────────────────────────────────────────────────────────────
const { test, expect } = require('@playwright/test');
const { setSession } = require('./helpers');
const path = require('path');
const fs = require('fs');

const OUT = path.join(process.cwd(), 'screenshots', 'h2');
fs.mkdirSync(OUT, { recursive: true });

// Tên HƯ CẤU cho ảnh minh họa (repo public — không dùng tên nhân sự thật).
const MEMBER = { email: 'thanhvien.a', displayName: 'Nguyễn Văn A', role: 'user',  team: 'CV1', loginAt: new Date().toISOString() };
const LEAD   = { email: 'teamlead.x', displayName: 'Trưởng nhóm X', role: 'admin', team: 'CV1', loginAt: new Date().toISOString() };

// ── Dữ liệu mock theo action (tên hư cấu) ──
const UC_LIST = [
  { record_id: 'REC-101', usecase_id: 'AIUS-101', name: 'Trợ lý soạn thảo tờ trình sản phẩm', team: 'CV1', owner_name: 'Nguyễn Văn A', owner_login: 'thanhvien.a', status: 'Approved', total_score: 82, demo_link: 'https://drive.example/vd/soan-thao', workflow: 'Soạn thảo & xử lý thông tin', usecase_category: '1. Workflow chung' },
  { record_id: 'REC-102', usecase_id: 'AIUS-102', name: 'Radar thay đổi sản phẩm đối thủ', team: 'CV1', owner_name: 'Trần Thị B', owner_login: 'thanhvien.b', status: 'Approved', total_score: 74, demo_link: 'https://drive.example/vd/radar', workflow: 'Nghiên cứu sản phẩm, đối thủ & định giá', usecase_category: '2. Workflow đặc thù PO' },
  { record_id: 'REC-103', usecase_id: 'AIUS-103', name: 'Tổng hợp dữ liệu phục vụ báo cáo', team: 'BL', owner_name: 'Lê Văn C', owner_login: 'thanhvien.c', status: 'Approved', total_score: 68, demo_link: '', workflow: 'Quản trị & phân tích dữ liệu', usecase_category: '1. Workflow chung' },
];

const WORKFLOW_CATALOG = { groups: [
  { nhom: '1. Workflow chung', workflows: [
    { name: 'Soạn thảo & xử lý thông tin', usecases: ['Soạn thảo email, báo cáo, tờ trình và tài liệu nghiệp vụ', 'Rà soát, kiểm tra căn cứ, số liệu và tính nhất quán'] },
    { name: 'Quản trị & phân tích dữ liệu', usecases: ['Thu thập, tổng hợp và chuẩn hóa dữ liệu từ nhiều nguồn'] },
  ] },
  { nhom: '2. Workflow đặc thù PO', workflows: [
    { name: 'Quản trị sản phẩm', usecases: ['Cập nhật thông tin thị trường, biến động ngành định kỳ', 'Rà soát, cập nhật sản phẩm theo quy định và chính sách mới'] },
    { name: 'Thúc đẩy bán sản phẩm', usecases: ['Truyền thông giới thiệu, đào tạo sản phẩm tới ĐVKD'] },
  ] },
] };

const PERSONAL_LIST = { team: 'all', count: 3, scores: [
  { username: 'thanhvien.a', display_name: 'Nguyễn Văn A', team: 'CV1', final_score: 76.5, rank_category: 'STRONG_CONTRIBUTOR', months_scored: 2, scored_by: 'teamlead.x',
    months: [ { month: 'Tháng 08/2026', diversity: 8, ai_proficiency: 7, product_quality: 8, quantity_met: 7, final_score: 76.5, comment: '' } ],
    courses_completed: 3, courses_paid: 1, sharing_achieved: true, milestones_late: 0, evidence_link: 'https://drive.example/evd/thanhvien.a' },
  { username: 'thanhvien.b', display_name: 'Trần Thị B', team: 'CV1', final_score: 64, rank_category: 'AVERAGE', months_scored: 1, scored_by: 'teamlead.x', months: [], courses_completed: 1, courses_paid: 0, sharing_achieved: false, milestones_late: 1, evidence_link: '' },
  { username: 'thanhvien.c', display_name: 'Lê Văn C', team: 'BL', final_score: 0, rank_category: 'BOTTOM_PERFORMER', months_scored: 0, scored_by: '', months: [], courses_completed: 0, courses_paid: 0, sharing_achieved: false, milestones_late: 0, evidence_link: '' },
] };

const USERS = [
  { username: 'teamlead.x',  display_name: 'Trưởng nhóm X', role: 'admin', team: 'CV1', active: true },
  { username: 'thanhvien.a', display_name: 'Nguyễn Văn A', role: 'user', team: 'CV1', active: true },
  { username: 'thanhvien.b',   display_name: 'Trần Thị B',   role: 'user', team: 'CV1', active: true },
];

const KPI_PREVIEW = { username: 'thanhvien.a', display_name: 'Nguyễn Văn A', team: 'CV1', m1: 80, m2: 76.5, m3: 75, m4: 100, penalty: 0, final: 82.6, rank_category: 'STRONG_CONTRIBUTOR', uc_count: 2, months_scored: 2, has_data: true };

const COUNCIL_LIST = { record_id: 'REC-101', final: 78, rank_category: 'STRONG_CONTRIBUTOR', scored_count: 2, council_size: 4,
  scores: [ { reviewer: 'teamlead.x', time_saving: 8, automation: 8, creativity: 7, member_score: 77, comment: '' } ], pending: ['hoidong.1', 'hoidong.2'] };

const H2_LB = { uc_ranking: UC_LIST.map((u, i) => ({ record_id: u.record_id, usecase_id: u.usecase_id, name: u.name, team: u.team, owner_name: u.owner_name, uc_score: u.total_score, rank_category: 'STRONG_CONTRIBUTOR', scored_count: 3, council_size: 4, rank: i + 1 })),
  personal_ranking: PERSONAL_LIST.scores.map((s, i) => ({ ...s, rank: i + 1 })), council_size: 4, filter_team: 'all' };

const KPI_LB = {
  member_ranking: [
    { username: 'thanhvien.a', display_name: 'Nguyễn Văn A', team: 'CV1', m1: 80, m2: 76.5, m3: 75, m4: 100, penalty: 0, final: 82.6, rank_category: 'STRONG_CONTRIBUTOR', uc_count: 2, months_scored: 2, rank: 1 },
    { username: 'thanhvien.b',   display_name: 'Trần Thị B',   team: 'CV1', m1: 60, m2: 64, m3: 25, m4: 0, penalty: 2, final: 52.6, rank_category: 'AVERAGE', uc_count: 1, months_scored: 1, rank: 2 },
  ],
  teamlead_ranking: [ { username: 'teamlead.x', display_name: 'Trưởng nhóm X', team: 'CV1', t1: 82.6, t2: 50, team_size: 2, pass_count: 1, final: 69.6, rank_category: 'AVERAGE', rank: 1 } ],
  center_avg: 67.6, kpi_pass: 70, council_size: 4, filter_team: 'all',
};

function dataFor(action) {
  switch (action) {
    case 'list': return UC_LIST;
    case 'workflow-catalog': return WORKFLOW_CATALOG;
    case 'lookup': return { teams: ['CV1', 'CV2', 'BL'], categories: ['Tự động hóa', 'Phân tích'], stages: ['POC', 'Production'] };
    case 'next-id': case 'nextId': return { next_id: 'AIUS-104' };
    case 'personal-score-list': return PERSONAL_LIST;
    case 'member-kpi-preview': return KPI_PREVIEW;
    case 'users': return USERS;
    case 'council-progress': return { map: { 'REC-101': { count: 2, final: 78, reviewers: ['teamlead.x'] } }, council_size: 4 };
    case 'council-score-list': return COUNCIL_LIST;
    case 'h2-leaderboard': return H2_LB;
    case 'kpi-leaderboard': return KPI_LB;
    case 'reuse-counts': return { map: { 'REC-101': { count: 3, reusers: ['a', 'b', 'c'] }, 'REC-102': { count: 1, reusers: ['x'] } }, threshold: 3 };
    case 'weekly-log-get': case 'weekly-log': return { logs: [] };
    default: return null;
  }
}

async function mock(page) {
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    const data = dataFor(action);
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}({"success":true,"data":${JSON.stringify(data)},"message":"ok"})` });
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
}

test.describe.configure({ mode: 'serial' });

test.use({ viewport: { width: 1400, height: 900 } });

test('capture — đăng nhập + trang chủ + đăng ký + tuần', async ({ page }) => {
  await mock(page);

  // 01 Login
  await page.goto('/login.html'); await page.waitForTimeout(700); await shot(page, '01_login');

  // 02 Home (nhân sự)
  await setSession(page, MEMBER); await page.goto('/index.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600); await shot(page, '02_home_member');

  // 03 Đăng ký UC — chọn Workflow → US
  await page.goto('/register.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200); await shot(page, '03_register_workflow');

  // 04 Cập nhật tuần
  await page.goto('/weekly-update.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000); await shot(page, '04_weekly_update');

  // 05 Thư viện AI + tái dùng
  await page.goto('/library.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000); await shot(page, '05_library_reuse');
});

test('capture — teamlead: chấm điểm cá nhân + hội đồng', async ({ page }) => {
  await mock(page);
  await setSession(page, LEAD);

  // 06 Chấm điểm cá nhân — danh sách
  await page.goto('/personal-score.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000); await shot(page, '06_personal_list');

  // 07 Panel chấm điểm cá nhân theo tháng (US + M2 + KPI khác + EVD)
  try {
    await page.locator('#psTable button').first().click();
    await expect(page.locator('#psPanel')).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, '07_personal_panel');
  } catch (e) { await shot(page, '07_personal_panel'); }

  // 08 Hàng đợi review
  await page.goto('/review-queue.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000); await shot(page, '08_review_list');

  // 09 Panel chấm điểm US hội đồng
  try {
    await page.locator('#rqTablePending button, .rq-name-link').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, '09_review_panel');
  } catch (e) { await shot(page, '09_review_panel'); }
});

test('capture — leaderboard KPI + heatmap + đổi mật khẩu', async ({ page }) => {
  await mock(page);
  await setSession(page, LEAD);

  await page.goto('/leaderboard.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
  // 10 Tab KPI tổng hợp
  try { await page.locator('.lb-tab[data-tab="kpiMember"]').click(); await page.waitForTimeout(800); } catch (e) {}
  await shot(page, '10_leaderboard_kpi');
  // 11 Tab Heatmap
  try { await page.locator('.lb-tab[data-tab="heatmap"]').click(); await page.waitForTimeout(800); } catch (e) {}
  await shot(page, '11_leaderboard_heatmap');

  // 12 Đổi mật khẩu
  await page.goto('/change-password.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700); await shot(page, '12_change_password');
});
