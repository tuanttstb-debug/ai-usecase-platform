// 03-review-queue.spec.js — review-queue.html (H2 Giai đoạn 3: Hội đồng chấm điểm US)
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER, CHAMPION_USER, REGULAR_USER } = require('./helpers');

// UC Approved (chỉ UC đã duyệt mới được hội đồng chấm)
const MOCK_APPROVED = [
  { record_id: 'REC-001', usecase_id: 'AIUS-001', name: 'UC A', team: 'Team Số',  owner_name: 'User A', status: 'Approved' },
  { record_id: 'REC-002', usecase_id: 'AIUS-002', name: 'UC B', team: 'Team Khác', owner_name: 'User B', status: 'Approved' },
  { record_id: 'REC-003', usecase_id: 'AIUS-003', name: 'UC C', team: 'Team Số',  owner_name: 'User C', status: 'Approved' },
  { record_id: 'REC-004', usecase_id: 'AIUS-004', name: 'UC D', team: 'Team Số',  owner_name: 'User D', status: 'Approved' },
];

// Tiến độ hội đồng: REC-003 đủ 4 (done); REC-004 admin đã chấm, 2/4 (underReview cho admin);
// REC-001/002 chưa ai chấm (pending). council_size = 4.
const MOCK_PROGRESS = {
  council_size: 4,
  map: {
    'REC-003': { count: 4, final: 80, reviewers: ['tuantt4', 'maittt7', 'tutv3', 'quynhnny'] },
    'REC-004': { count: 2, final: 60, reviewers: ['tuantt4', 'maittt7'] },
  },
};

const MOCK_COUNCIL_LIST = {
  record_id: 'REC-001', final: 0, rank_category: 'BOTTOM_PERFORMER',
  scored_count: 0, council_size: 4, scores: [], pending: ['tuantt4', 'maittt7', 'tutv3', 'quynhnny'],
};

const BASE_MOCK = {
  list: MOCK_APPROVED,
  'council-progress': MOCK_PROGRESS,
  'council-score-list': MOCK_COUNCIL_LIST,
  'council-score-submit': { score_id: 'CS-0001', member_score: 100, uc_final: 100, scored_count: 1, council_size: 4 },
};

test.describe('review-queue.html — Hội đồng chấm điểm US', () => {

  test('Admin (council) can access page', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/review-queue\.html/);
  });

  test('Teamlead can access page', async ({ page }) => {
    await setSession(page, CHAMPION_USER);
    await mockGAS(page, BASE_MOCK);
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
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#rqContent')).toBeVisible();
    await expect(page.locator('#rqSectionPending')).toBeVisible();
    await expect(page.locator('#rqSectionUnderReview')).toBeVisible();
    await expect(page.locator('#rqSectionDone')).toBeVisible();
  });

  test('Council progress → correct badge counts', async ({ page }) => {
    await setSession(page, ADMIN_USER); // tuantt4 ∈ hội đồng
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    // pending: REC-001 + REC-002 (chưa ai chấm, admin chưa chấm) = 2
    await expect(page.locator('#rqBadgePending')).toHaveText('2');
    // underReview: REC-004 (admin đã chấm, 2/4) = 1
    await expect(page.locator('#rqBadgeUnderReview')).toHaveText('1');
    // done: REC-003 (đủ 4) = 1
    await expect(page.locator('#rqBadgeDone')).toHaveText('1');
  });

  test('US nộp xong (Submitted) vào review luôn; Rejected/Draft bị loại (bỏ bước duyệt)', async ({ page }) => {
    const MIXED = [
      { record_id: 'REC-S', usecase_id: 'AIUS-S', name: 'UC Submitted',   team: 'Số', owner_name: 'U', status: 'Submitted' },
      { record_id: 'REC-A', usecase_id: 'AIUS-A', name: 'UC Approved',    team: 'Số', owner_name: 'U', status: 'Approved' },
      { record_id: 'REC-U', usecase_id: 'AIUS-U', name: 'UC UnderReview', team: 'Số', owner_name: 'U', status: 'Under Review' },
      { record_id: 'REC-R', usecase_id: 'AIUS-R', name: 'UC Rejected',    team: 'Số', owner_name: 'U', status: 'Rejected' },
      { record_id: 'REC-D', usecase_id: 'AIUS-D', name: 'UC Draft',       team: 'Số', owner_name: 'U', status: 'Draft' },
    ];
    await setSession(page, ADMIN_USER);
    await mockGAS(page, Object.assign({}, BASE_MOCK, { list: MIXED, 'council-progress': { map: {}, council_size: 4 } }));
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    // 3 US "đã nộp" (Submitted + Approved + Under Review) vào review; Rejected + Draft bị loại.
    await expect(page.locator('#rqResultCount')).toHaveText('3 use case');
    await expect(page.locator('#rqContent')).toContainText('UC Submitted');
    await expect(page.locator('#rqContent')).toContainText('UC Approved');
    await expect(page.locator('#rqContent')).not.toContainText('UC Rejected');
    await expect(page.locator('#rqContent')).not.toContainText('UC Draft');
  });

  test('navReviewQueue is marked as active', async ({ page }) => {
    await setSession(page, CHAMPION_USER);
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#navReviewQueue')).toHaveClass(/is-active/);
  });

  test('Council panel opens when clicking Chấm điểm button', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#reviewPanel')).not.toBeVisible();
    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();
    await expect(page.locator('#rpUcId')).toHaveText('AIUS-001');
  });

  test('Panel close button works', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();
    await page.click('#reviewPanelClose');
    await page.waitForTimeout(300);
    await expect(page.locator('#reviewPanel')).not.toBeVisible();
  });

  test('Slider mặc định 0 + giá trị hiện trên thanh (bubble) — CR#3', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();
    // Mặc định 0 khi chấm mới
    await expect(page.locator('#rpSliderTime')).toHaveValue('0');
    // Giá trị hiện NGAY TRÊN thanh (bubble)
    await page.locator('#rpSliderTime').fill('8');
    await page.locator('#rpSliderTime').dispatchEvent('input');
    await expect(page.locator('#rpSliderTime + .score-slider-bubble')).toHaveText('8');
  });

  test('EVD dạng dòng hiển thị trong panel review — CR#4', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();
    await expect(page.locator('#rpEvdRow')).toBeVisible();
    await expect(page.locator('#rpEvdRow .ps-evd-label')).toContainText('Bằng chứng');
  });

  test('Panel review 2 cột: chi tiết US + chấm điểm đồng thời — Mục tiêu 2', async ({ page }) => {
    const MOCK_UC_FULL = {
      Record_ID: 'REC-001', UseCase_ID: 'AIUS-001', UseCase_Name: 'UC A',
      Owner_Name: 'User A', Team: 'Team Số', Business_Category: 'Automation',
      Current_Stage: 'S2 - Pilot', Status: 'Approved',
      Pain_Point: 'Xử lý thủ công tốn thời gian mỗi ngày',
      Flow_Description: 'Bước 1: nhập email; Bước 2: AI tóm tắt; Bước 3: trả kết quả',
      Prompt_Role: 'Bạn là trợ lý phân tích tài chính',
      Prompt_Task: 'Tóm tắt nội dung email khách hàng',
      Demo_Link: 'https://example.com/demo'
    };
    await setSession(page, ADMIN_USER);
    await mockGAS(page, Object.assign({}, BASE_MOCK, { usecase: MOCK_UC_FULL }));
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();
    // Panel dạng 2 cột (mở rộng)
    await expect(page.locator('#reviewPanel')).toHaveClass(/review-panel--split/);
    // Cột chi tiết + cột chấm điểm cùng hiển thị (vừa xem vừa duyệt)
    await expect(page.locator('#rpDetailCol')).toBeVisible();
    await expect(page.locator('#rpSubmitBtn')).toBeVisible();
    // Chi tiết US được nạp từ full detail (luồng AI + prompt)
    await expect(page.locator('#rpDetail')).toContainText('Luồng AI & Prompt');
    await expect(page.locator('#rpDetail')).toContainText('Tóm tắt nội dung email khách hàng');
    await expect(page.locator('#rpDetail')).toContainText('Xử lý thủ công tốn thời gian');
    // Nút copy prompt hiện vì UC có prompt
    await expect(page.locator('#rpCopyPromptBtn')).toBeVisible();
  });

  test('Member score preview = 100 when all criteria = 10', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    await mockGAS(page, BASE_MOCK);
    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();

    for (const id of ['#rpSliderTime', '#rpSliderAuto', '#rpSliderCreative']) {
      await page.locator(id).fill('10');
      await page.locator(id).dispatchEvent('input');
    }
    // 10*.3 + 10*.4 + 10*.3 = 10 → /10*100 = 100
    await expect(page.locator('#rpProjectedTotal')).toHaveText('100');
  });

  test('Submit council score calls council-score-submit', async ({ page }) => {
    await setSession(page, ADMIN_USER);
    let submitCalled = false;

    await page.route('**/script.google.com/**', async (route) => {
      const url    = new URL(route.request().url());
      const action = url.searchParams.get('action');
      const cb     = url.searchParams.get('callback') || '__gasCb_test';
      let data = null;
      if (action === 'council-score-submit') {
        submitCalled = true;
        data = BASE_MOCK['council-score-submit'];
      } else if (action in BASE_MOCK) {
        data = BASE_MOCK[action];
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":true,"data":${JSON.stringify(data)},"message":"ok"})`,
      });
    });

    await page.goto('/review-queue.html');
    await page.waitForLoadState('networkidle');
    await page.locator('#rqTablePending button').first().click();
    await expect(page.locator('#reviewPanel')).toBeVisible();
    await page.click('#rpSubmitBtn');
    await page.waitForLoadState('networkidle');
    expect(submitCalled).toBe(true);
  });

});
