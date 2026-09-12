// @ts-check
// weekly-update.spec.js — CR (2026-09-12): màn "Cập nhật US đã đăng ký"
// (thay "Cập nhật tuần"). Đã bỏ luồng nâng Stage; thêm Action Plan theo tháng + Demo;
// Prompt/Luồng AI là nội dung chính (accordion mở sẵn sau khi nạp full detail).
//
// KHÁC bản cũ: dùng GAS MOCK (page.route) → deterministic, không ghi production.
const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

const UC_SUMMARY = {
  record_id: 'REC-WU1', usecase_id: 'AIUS-WU1',
  name: 'Tóm tắt hồ sơ tín dụng bằng AI', team: 'Team Số',
  owner_name: 'Tuan TT4', owner_email: 'tuantt4',
  status: 'Submitted', stage: 'S1 - Idea', current_stage: 'S1 - Idea',
  current_progress: 20, monthly_usage_count: 3, active_user_count: 2,
  hours_saved_actual: 4, reuse_count_tracked: 0,
  demo_status: 'Đã có demo', demo_link: 'https://demo.example.com/uc1',
  total_score: 0, last_weekly_report: '',
};

// Full detail (endpoint usecase) — có Prompt/Luồng AI + Action Plan theo tháng.
const UC_FULL = {
  Record_ID: 'REC-WU1', UseCase_ID: 'AIUS-WU1', UseCase_Name: 'Tóm tắt hồ sơ tín dụng bằng AI',
  Owner_Name: 'Tuan TT4', Owner_Email: 'tuantt4', Team: 'Team Số', Current_Stage: 'S1 - Idea',
  Flow_Description: 'B1: nhập hồ sơ; B2: AI tóm tắt; B3: trả kết quả',
  Prompt_Role: 'Bạn là chuyên viên tín dụng', Prompt_Task: 'Tóm tắt hồ sơ',
  Prompt_Goal: '', Prompt_Context: '', Prompt_Input: '', Prompt_Steps: '',
  Prompt_Output_Format: '', Prompt_Evaluation: '',
  Demo_Status: 'Đã có demo', Demo_Link: 'https://demo.example.com/uc1',
  Action_Plan_M09: 'T9: chạy thử với 3 hồ sơ mẫu',
  Action_Plan_M10: 'T10: mở rộng cho cả nhóm',
  Action_Plan_M11: '', Action_Plan_M12: '',
};

const WEEKLY_LOG = [
  { log_id: 'L1', record_id: 'REC-WU1', log_date: '2026-09-10T02:00:00Z',
    progress: 20, weekly_update: 'Khởi tạo và chạy thử', stage_changed: false,
    monthly_usage_count: 3 },
];

// Mock mọi GAS action cần cho màn "Cập nhật US". Trả success + data phù hợp.
// captured: mảng {action, url} để test khẳng định request đã bắn.
async function mockWU(page, opts) {
  opts = opts || {};
  const captured = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    captured.push({ action, url: url.href });

    let data = null;
    if (action === 'list')             data = [UC_SUMMARY];
    else if (action === 'usecase')     data = UC_FULL;
    else if (action === 'weekly-update') data = opts.wuResult || { total_score: 0 };
    else if (action === 'weekly-log')  data = WEEKLY_LOG;
    else if (action === 'lookup')      data = { Team: ['Team Số', 'Team Khác'] };
    // các action khác (users/dashboard/reuse-counts/…) → success null (không chặn trang)

    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})`,
    });
  });
  return captured;
}

async function selectFirstUc(page) {
  await page.waitForFunction(
    () => typeof _myUseCases !== 'undefined' && _myUseCases.length > 0,
    { timeout: 10000 }
  );
  await page.locator('#ucPickerBtn').click();
  await expect(page.locator('#pickerModal')).toBeVisible({ timeout: 3000 });
  await page.waitForSelector('#pickerTbody tr[data-rid]', { timeout: 8000 });
  await page.locator('#pickerTbody tr[data-rid]').first().click();
  await expect(page.locator('#pickerModal')).not.toBeVisible({ timeout: 3000 });
}

test.describe('Cập nhật US đã đăng ký (CR 2026-09-12)', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => { await setSession(page, ADMIN_USER); });

  test('T01 — Page tải, tiêu đề "Cập nhật US", picker + UC list', async ({ page }) => {
    await mockWU(page);
    await page.goto('/weekly-update.html');
    await expect(page).not.toHaveURL(/login\.html/);
    await expect(page.locator('.wu-page-title')).toContainText('Cập nhật US');
    await expect(page.locator('#ucPickerBtn')).toBeVisible();
    await page.waitForFunction(() => typeof _myUseCases !== 'undefined' && _myUseCases.length > 0, { timeout: 10000 });
    expect(await page.evaluate(() => _myUseCases.length)).toBeGreaterThan(0);
  });

  test('T02 — Mở picker, bảng UC hiển thị', async ({ page }) => {
    await mockWU(page);
    await page.goto('/weekly-update.html');
    await page.waitForFunction(() => typeof _myUseCases !== 'undefined' && _myUseCases.length > 0, { timeout: 10000 });
    await page.locator('#ucPickerBtn').click();
    await expect(page.locator('#pickerModal')).toBeVisible({ timeout: 3000 });
    await page.waitForSelector('#pickerTbody tr[data-rid]', { timeout: 8000 });
    expect(await page.locator('#pickerTbody tr[data-rid]').count()).toBeGreaterThan(0);
  });

  test('T03 — Chọn UC → form hiện, KHÔNG hiện stageSection, prompt mở sẵn + Action Plan prefill', async ({ page }) => {
    await mockWU(page);
    await page.goto('/weekly-update.html');
    await selectFirstUc(page);

    await expect(page.locator('#ucCard')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#wuForm')).toBeVisible();
    // CR: bỏ nâng Stage → stageSection KHÔNG được hiện
    await expect(page.locator('#stageSection')).not.toBeVisible();

    // Chờ full detail nạp → accordion prompt mở sẵn + Action Plan prefill
    await page.waitForFunction(
      () => typeof _fullDetailLoaded !== 'undefined' && _fullDetailLoaded === true,
      { timeout: 10000 }
    );
    await expect(page.locator('#promptAccordion')).toHaveClass(/open/);
    await expect(page.locator('#wuFlowDescription')).toBeVisible();
    await expect(page.locator('#wuPlanM09')).toHaveValue(/chạy thử/);
    await expect(page.locator('#wuDemoStatus')).toHaveValue('Đã có demo');
    // prompt được đánh dấu sẵn sàng gửi (nội dung chính)
    expect(await page.evaluate(() => _promptTouched)).toBe(true);
  });

  test('T04 — Submit KHÔNG cần ghi chú → success + fire weekly-update kèm Action Plan', async ({ page }) => {
    const captured = await mockWU(page);
    await page.goto('/weekly-update.html');
    await selectFirstUc(page);
    await page.waitForFunction(() => window._fullDetailLoaded === true, { timeout: 10000 });

    // Sửa Action Plan T11 rồi gửi — KHÔNG điền ô ghi chú (không còn bắt buộc)
    await page.locator('#wuPlanM11').fill('T11: chuẩn hóa hướng dẫn dùng');
    await page.locator('#btnSubmit').click();

    await expect(page.locator('#successState')).toBeVisible({ timeout: 15000 });
    const wu = captured.find((c) => c.action === 'weekly-update');
    expect(wu, 'weekly-update request đã bắn').toBeTruthy();
  });

  test('T05 — Timeline "Lịch sử cập nhật" hiển thị sau khi chọn UC', async ({ page }) => {
    await mockWU(page);
    await page.goto('/weekly-update.html');
    await selectFirstUc(page);
    await expect(page.locator('#timelineWrap')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#timelineContent')).toContainText('Khởi tạo và chạy thử');
  });
});
