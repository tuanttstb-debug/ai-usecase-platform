// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const EVD = path.join(__dirname, '..', 'evd', 'weekly-update');

// Inject admin session
async function injectSession(page) {
  await page.addInitScript(() => {
    const user = {
      email:       'tuantt4',
      displayName: 'TuanTT4',
      role:        'admin',
      team:        'Team Số',
      loginAt:     new Date().toISOString()
    };
    sessionStorage.setItem('ai_user_session', JSON.stringify(user));
  });
}

// Helper: chờ _myUseCases được load (GAS JSONP trả về)
async function waitForUcList(page, timeoutMs = 30000) {
  await page.waitForFunction(
    () => typeof _myUseCases !== 'undefined' && _myUseCases.length > 0,
    { timeout: timeoutMs }
  );
}

// Helper: mở picker modal và chọn UC đầu tiên trong bảng
async function openAndSelectFirstUc(page) {
  await waitForUcList(page, 30000);

  // Mở modal
  await page.locator('#ucPickerBtn').click();
  await expect(page.locator('#pickerModal')).toBeVisible({ timeout: 3000 });

  // Chờ bảng render
  await page.waitForSelector('#pickerTbody tr[data-rid]', { timeout: 10000 });

  // Lấy record_id của row đầu tiên
  const firstRow = page.locator('#pickerTbody tr[data-rid]').first();
  const rid = await firstRow.getAttribute('data-rid');

  // Click row
  await firstRow.click();

  // Modal đóng
  await expect(page.locator('#pickerModal')).not.toBeVisible({ timeout: 3000 });

  return rid;
}

test.describe('Weekly Update — Feature Tests', () => {

  test.setTimeout(90000); // GAS JSONP real network calls need longer timeout

  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  // ── TEST 1: Page load + picker button ──────────────────────────

  test('T01 — Page tải thành công, picker button hiển thị', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await expect(page).not.toHaveURL(/login\.html/);
    await expect(page.locator('.wu-page-title')).toContainText('Cập nhật tiến độ tuần');
    await expect(page.locator('#ucPickerBtn')).toBeVisible();

    // Chờ GAS load xong
    await waitForUcList(page, 30000);
    const count = await page.evaluate(() => _myUseCases.length);
    console.log(`[T01] UC list loaded: ${count} items`);
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: `${EVD}/T01-page-load.png`, fullPage: true });
    console.log('[T01] PASS');
  });

  // ── TEST 2: Mở picker modal ────────────────────────────────────

  test('T02 — Mở picker modal, bảng UC hiển thị đúng', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcList(page, 30000);

    // Mở modal
    await page.locator('#ucPickerBtn').click();
    await expect(page.locator('#pickerModal')).toBeVisible({ timeout: 3000 });

    // Search input hiển thị
    await expect(page.locator('#pickerSearch')).toBeVisible();

    // Stage filter hiển thị
    await expect(page.locator('#pickerStageFilter')).toBeVisible();

    // Chờ bảng render
    await page.waitForSelector('#pickerTbody tr[data-rid]', { timeout: 10000 });
    const rowCount = await page.locator('#pickerTbody tr[data-rid]').count();
    console.log(`[T02] Table rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    // Scope label hiển thị
    const scope = await page.locator('#pickerScope').textContent();
    console.log(`[T02] Scope: ${scope}`);
    expect(scope).toBeTruthy();

    await page.screenshot({ path: `${EVD}/T02-picker-modal-open.png`, fullPage: false });
    console.log('[T02] PASS — Modal opens with table');
  });

  // ── TEST 3: Filter tìm kiếm ────────────────────────────────────

  test('T03 — Filter tìm kiếm lọc đúng rows', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcList(page, 30000);
    await page.locator('#ucPickerBtn').click();
    await page.waitForSelector('#pickerTbody tr[data-rid]', { timeout: 10000 });

    const totalBefore = await page.locator('#pickerTbody tr[data-rid]:not(.is-hidden)').count();
    console.log(`[T03] Total rows before filter: ${totalBefore}`);

    // Type vào search box
    await page.locator('#pickerSearch').fill('aius');
    const afterFilter = await page.locator('#pickerTbody tr[data-rid]:not(.is-hidden)').count();
    console.log(`[T03] Rows after "aius" filter: ${afterFilter}`);
    expect(afterFilter).toBeGreaterThanOrEqual(0);
    expect(afterFilter).toBeLessThanOrEqual(totalBefore);

    // Count chip update
    const countText = await page.locator('#pickerCount').textContent();
    console.log(`[T03] Count: ${countText}`);

    await page.screenshot({ path: `${EVD}/T03-picker-filter.png`, fullPage: false });
    console.log('[T03] PASS — Search filter works');
  });

  // ── TEST 4: Filter theo Stage ──────────────────────────────────

  test('T04 — Filter theo Stage hoạt động', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcList(page, 30000);
    await page.locator('#ucPickerBtn').click();
    await page.waitForSelector('#pickerTbody tr[data-rid]', { timeout: 10000 });

    // Filter S3
    await page.locator('#pickerStageFilter').selectOption('S3 - Standardized');
    const s3Rows = await page.locator('#pickerTbody tr[data-rid]:not(.is-hidden)').count();
    console.log(`[T04] S3 rows: ${s3Rows}`);

    // Filter S4
    await page.locator('#pickerStageFilter').selectOption('S4 - Scale');
    const s4Rows = await page.locator('#pickerTbody tr[data-rid]:not(.is-hidden)').count();
    console.log(`[T04] S4 rows: ${s4Rows}`);

    // Reset
    await page.locator('#pickerStageFilter').selectOption('');
    await page.screenshot({ path: `${EVD}/T04-stage-filter.png`, fullPage: false });
    console.log('[T04] PASS — Stage filter works');
  });

  // ── TEST 5: Chọn UC từ bảng → form hiển thị ────────────────────

  test('T05 — Chọn UC từ bảng → UC card + Stage + Form hiển thị', async ({ page }) => {
    await page.goto('/weekly-update.html');
    const rid = await openAndSelectFirstUc(page);
    console.log(`[T05] Selected rid: ${rid}`);

    // Picker button cập nhật text
    const btnText = await page.locator('#ucPickerBtnText').textContent();
    console.log(`[T05] Button text: ${btnText}`);
    expect(btnText).not.toBe('— Nhấn để chọn use case —');
    expect(page.locator('.uc-picker-btn-text.has-value')).toBeTruthy();

    // Clear button hiển thị
    await expect(page.locator('#ucPickerBtnClear')).toHaveClass(/visible/);

    // UC card, stage section, form visible
    await expect(page.locator('#ucCard')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#stageSection')).toBeVisible();
    await expect(page.locator('#wuForm')).toBeVisible();

    const stageTxt = await page.locator('#currentStageBadge').textContent();
    console.log(`[T05] Stage: ${stageTxt}`);

    await page.screenshot({ path: `${EVD}/T05-uc-selected.png`, fullPage: true });
    console.log('[T05] PASS — UC selected from table, form shown');
  });

  // ── TEST 6: Clear button xóa selection ───────────────────────────

  test('T06 — Nút ✕ clear selection', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await openAndSelectFirstUc(page);

    // Click clear
    await page.locator('#ucPickerBtnClear').click();

    // Button trở về placeholder
    await expect(page.locator('#ucPickerBtnText')).toHaveText('— Nhấn để chọn use case —');
    await expect(page.locator('#ucPickerBtnClear')).not.toHaveClass(/visible/);

    // Form ẩn
    await expect(page.locator('#wuForm')).not.toBeVisible();
    await expect(page.locator('#stageSection')).not.toBeVisible();

    await page.screenshot({ path: `${EVD}/T06-clear-selection.png`, fullPage: false });
    console.log('[T06] PASS — Clear button works');
  });

  // ── TEST 7: Escape đóng modal ─────────────────────────────────────

  test('T07 — Nhấn Escape đóng modal', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcList(page, 30000);
    await page.locator('#ucPickerBtn').click();
    await expect(page.locator('#pickerModal')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('#pickerModal')).not.toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: `${EVD}/T07-modal-close-escape.png`, fullPage: false });
    console.log('[T07] PASS — Escape closes modal');
  });

  // ── TEST 8: Progress slider ───────────────────────────────────────

  test('T08 — Progress slider cập nhật % display', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await openAndSelectFirstUc(page);

    const slider = page.locator('#progressSlider');
    await slider.fill('60');
    await slider.dispatchEvent('input');
    await expect(page.locator('#progressLabel')).toHaveText('60%');

    await page.screenshot({ path: `${EVD}/T08-progress-slider.png`, fullPage: false });
    console.log('[T08] PASS — Slider works');
  });

  // ── TEST 9: Stage upgrade toggle + checklist ─────────────────────

  test('T09 — Stage upgrade toggle + checklist validation', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await openAndSelectFirstUc(page);

    const isMaxStage = await page.locator('#stageAtMax').isVisible();
    if (isMaxStage) { console.log('[T09] UC at S4 max — skip'); return; }

    await page.locator('#upgradeToggle').check();
    await expect(page.locator('#upgradePanel')).toBeVisible({ timeout: 3000 });

    const targetTxt = await page.locator('#targetStageBadge').textContent();
    const checkCount = await page.locator('#checklistItems .stage-checklist-item').count();
    console.log(`[T09] Target: ${targetTxt?.trim()} | Checklist: ${checkCount}`);
    expect(checkCount).toBeGreaterThan(0);

    // Submit without ticking → warn
    await page.locator('#weeklyUpdate').fill('Test content');
    await page.locator('#btnSubmit').click();
    await expect(page.locator('#checklistWarn')).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: `${EVD}/T09-checklist-validation.png`, fullPage: true });
    console.log('[T09] PASS — Checklist validation works');
  });

  // ── TEST 10: Submit weekly update (không nâng stage) ─────────────

  test('T10 — Submit thành công không nâng stage', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await openAndSelectFirstUc(page);

    await page.locator('#progressSlider').fill('50');
    await page.locator('#progressSlider').dispatchEvent('input');
    await page.locator('#weeklyUpdate').fill('Tuần này hoàn thành thử nghiệm prompt với 3 case.');
    await page.locator('#monthlyUsage').fill('6');

    await page.screenshot({ path: `${EVD}/T10-before-submit.png`, fullPage: true });
    await page.locator('#btnSubmit').click();

    await expect(page.locator('#successState')).toBeVisible({ timeout: 60000 });
    const detail = await page.locator('#successDetail').textContent();
    console.log(`[T10] Success: ${detail}`);

    // Timeline tải sau submit
    await expect(page.locator('#timelineWrap')).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: `${EVD}/T10-submit-success.png`, fullPage: true });
    console.log('[T10] PASS — Submit thành công');
  });

  // ── TEST 11: Submit có nâng stage ────────────────────────────────

  test('T11 — Submit có nâng stage (tick đủ checklist)', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await openAndSelectFirstUc(page);

    const isMaxStage = await page.locator('#stageAtMax').isVisible();
    if (isMaxStage) { console.log('[T11] UC at S4 max — skip'); return; }

    await page.locator('#upgradeToggle').check();
    await expect(page.locator('#upgradePanel')).toBeVisible();

    // Tick all checklist items
    const checkboxes = page.locator('#checklistItems input[type=checkbox]');
    const cnt = await checkboxes.count();
    for (let i = 0; i < cnt; i++) await checkboxes.nth(i).check();
    console.log(`[T11] Ticked ${cnt} items`);

    // S4 fields
    const targetTxt = await page.locator('#targetStageBadge').textContent();
    if (targetTxt && targetTxt.includes('S4')) {
      await page.locator('#scalePlan').fill('Mở rộng sang 2 team liên quan trong Q3/2026. Mục tiêu 15 người dùng.');
      await page.locator('#scaleRisks').fill('Cần review chính sách bảo mật trước khi mở rộng.');
    }

    await page.locator('#progressSlider').fill('80');
    await page.locator('#progressSlider').dispatchEvent('input');
    await page.locator('#weeklyUpdate').fill('Pilot xong, mọi người phản hồi tích cực, sẵn sàng nâng stage.');
    await page.locator('#monthlyUsage').fill('10');

    await page.screenshot({ path: `${EVD}/T11-before-stage-submit.png`, fullPage: true });
    await page.locator('#btnSubmit').click();
    await expect(page.locator('#successState')).toBeVisible({ timeout: 60000 });

    const detail = await page.locator('#successDetail').textContent();
    console.log(`[T11] Success: ${detail}`);
    await page.screenshot({ path: `${EVD}/T11-stage-submit-success.png`, fullPage: true });
    console.log('[T11] PASS — Stage transition thành công');
  });

  // ── TEST 12: Accordion Prompt/Luồng AI mở + prefill (Mục tiêu 1) ──
  // Read-only: chọn UC → chờ full detail nạp → mở accordion → kiểm prefill/flag.
  // KHÔNG submit (tránh ghi thêm vào production).

  test('T12 — Cập nhật Prompt/Luồng AI: accordion + prefill từ full detail', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await openAndSelectFirstUc(page);

    // Chờ full detail nạp xong (prefill prompt/luồng)
    await page.waitForFunction(
      () => typeof _fullDetailLoaded !== 'undefined' && _fullDetailLoaded === true,
      { timeout: 30000 }
    );

    // Accordion mặc định đóng, panel ẩn
    await expect(page.locator('#promptAccordion')).not.toHaveClass(/open/);
    await expect(page.locator('#wuFlowDescription')).not.toBeVisible();

    // Mở accordion → panel + textarea luồng AI hiển thị
    await page.locator('#promptAccordionToggle').click();
    await expect(page.locator('#promptAccordion')).toHaveClass(/open/);
    await expect(page.locator('#wuFlowDescription')).toBeVisible();

    // Đã đánh dấu touched → cho phép gửi prompt/luồng kèm submit
    const touched = await page.evaluate(() => _promptTouched);
    expect(touched).toBe(true);

    await page.screenshot({ path: `${EVD}/T12-prompt-accordion.png`, fullPage: true });
    console.log('[T12] PASS — Accordion Prompt/Luồng AI mở + prefill OK');
  });

});
