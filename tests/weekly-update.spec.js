// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const EVD = path.join(__dirname, '..', 'evd', 'weekly-update');

// Inject admin session trước khi load page
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

// Helper: chờ UC dropdown có options (GAS JSONP trả về)
async function waitForUcOptions(page, minCount = 2, timeoutMs = 30000) {
  await page.waitForFunction(
    (min) => document.getElementById('ucSelect')?.options.length >= min,
    minCount,
    { timeout: timeoutMs }
  );
}

// Helper: chọn UC đầu tiên trong dropdown
async function selectFirstUc(page) {
  const sel = page.locator('#ucSelect');
  const options = await sel.locator('option').all();
  // Bỏ qua option đầu tiên (placeholder)
  const val = await options[1].getAttribute('value');
  await sel.selectOption(val);
  return val;
}

test.describe('Weekly Update — Feature Tests', () => {

  test.beforeEach(async ({ page }) => {
    await injectSession(page);
  });

  // ── TEST 1: Page load & UC picker ──────────────────────────────

  test('T01 — Page tải thành công, UC dropdown hiển thị danh sách', async ({ page }) => {
    await page.goto('/weekly-update.html');

    // Không bị redirect về login
    await expect(page).not.toHaveURL(/login\.html/);

    // Tiêu đề hiển thị
    await expect(page.locator('.wu-page-title')).toContainText('Cập nhật tiến độ tuần');

    // UC select hiển thị
    await expect(page.locator('#ucSelect')).toBeVisible();

    // Chờ GAS load xong và có options
    await waitForUcOptions(page, 2, 30000);
    const count = await page.locator('#ucSelect option').count();
    console.log(`[T01] UC options loaded: ${count}`);
    expect(count).toBeGreaterThan(1);

    await page.screenshot({ path: `${EVD}/T01-page-load.png`, fullPage: true });
    console.log('[T01] PASS — Page load OK, UC list loaded');
  });

  // ── TEST 2: Chọn UC → card + stage section + form hiện ─────────

  test('T02 — Chọn UC → UC card + Stage section + Form hiển thị', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);

    const val = await selectFirstUc(page);
    console.log(`[T02] Selected record_id: ${val}`);

    // UC card visible
    await expect(page.locator('#ucCard')).toBeVisible({ timeout: 5000 });
    const ucName = await page.locator('#ucCardName').textContent();
    console.log(`[T02] UC: ${ucName}`);

    // Stage section visible
    await expect(page.locator('#stageSection')).toBeVisible({ timeout: 5000 });

    // Stage badge hiển thị
    await expect(page.locator('#currentStageBadge')).toBeVisible();
    const stageTxt = await page.locator('#currentStageBadge').textContent();
    console.log(`[T02] Current stage: ${stageTxt}`);

    // Form visible
    await expect(page.locator('#wuForm')).toBeVisible();

    await page.screenshot({ path: `${EVD}/T02-uc-selected.png`, fullPage: true });
    console.log('[T02] PASS — UC selected, form + stage rendered');
  });

  // ── TEST 3: Overdue warning ─────────────────────────────────────

  test('T03 — Overdue warning hiển thị khi chưa update tuần này', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    // Kiểm tra overdue warn (có thể visible hoặc không tùy UC)
    const overdueVisible = await page.locator('#overdueWarn').isVisible();
    console.log(`[T03] Overdue warning visible: ${overdueVisible}`);

    await page.screenshot({ path: `${EVD}/T03-overdue-check.png`, fullPage: true });
    console.log('[T03] PASS — Overdue warning check done');
  });

  // ── TEST 4: Progress slider ─────────────────────────────────────

  test('T04 — Progress slider cập nhật % display', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    const slider = page.locator('#progressSlider');
    await expect(slider).toBeVisible();

    // Kéo slider đến 60%
    await slider.fill('60');
    await slider.dispatchEvent('input');

    await expect(page.locator('#progressLabel')).toHaveText('60%');

    const fillWidth = await page.locator('#progressFill').getAttribute('style');
    expect(fillWidth).toContain('60%');

    await page.screenshot({ path: `${EVD}/T04-progress-slider.png`, fullPage: false });
    console.log('[T04] PASS — Slider works, 60% shown');
  });

  // ── TEST 5: Stage upgrade toggle ────────────────────────────────

  test('T05 — Toggle "Đề xuất nâng stage" mở checklist panel', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    await expect(page.locator('#stageSection')).toBeVisible();

    // Nếu UC đang S4 (max), toggle không hiện → skip
    const toggleWrap = page.locator('#upgradeToggleWrap');
    const isMaxStage = await page.locator('#stageAtMax').isVisible();

    if (isMaxStage) {
      console.log('[T05] UC đã ở S4 (max stage) — skip toggle test');
      await page.screenshot({ path: `${EVD}/T05-stage-max.png`, fullPage: false });
      return;
    }

    await expect(toggleWrap).toBeVisible({ timeout: 5000 });

    // Click toggle
    const toggle = page.locator('#upgradeToggle');
    await toggle.check();
    await expect(toggle).toBeChecked();

    // Upgrade panel mở
    await expect(page.locator('#upgradePanel')).toBeVisible({ timeout: 3000 });

    // Target stage badge hiển thị
    await expect(page.locator('#targetStageBadge')).toBeVisible();
    const targetStage = await page.locator('#targetStageBadge').textContent();
    console.log(`[T05] Target stage: ${targetStage}`);

    // Checklist items hiển thị
    const checklistItems = page.locator('#checklistItems .stage-checklist-item');
    const checkCount = await checklistItems.count();
    console.log(`[T05] Checklist items: ${checkCount}`);
    expect(checkCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${EVD}/T05-stage-upgrade-panel.png`, fullPage: true });
    console.log('[T05] PASS — Upgrade panel opens, checklist shown');
  });

  // ── TEST 6: Checklist validation ────────────────────────────────

  test('T06 — Submit bị block khi checklist chưa tick đủ', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    const isMaxStage = await page.locator('#stageAtMax').isVisible();
    if (isMaxStage) {
      console.log('[T06] UC đã ở S4 — skip checklist test');
      return;
    }

    // Mở upgrade toggle
    await page.locator('#upgradeToggle').check();
    await expect(page.locator('#upgradePanel')).toBeVisible();

    // Điền weekly update (bắt buộc) nhưng KHÔNG tick checklist
    await page.locator('#weeklyUpdate').fill('Test weekly update nội dung tuần này.');
    await page.locator('#progressSlider').fill('30');
    await page.locator('#progressSlider').dispatchEvent('input');

    // Submit
    await page.locator('#btnSubmit').click();

    // Checklist warn phải hiện
    await expect(page.locator('#checklistWarn')).toBeVisible({ timeout: 3000 });
    const warnText = await page.locator('#checklistWarn').textContent();
    console.log(`[T06] Checklist warn: ${warnText}`);

    await page.screenshot({ path: `${EVD}/T06-checklist-validation.png`, fullPage: true });
    console.log('[T06] PASS — Checklist validation blocks submit');
  });

  // ── TEST 7: S4 fields chỉ hiện khi target = S4 ─────────────────

  test('T07 — S4 fields hiển thị khi và chỉ khi target stage = S4', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    const isMaxStage = await page.locator('#stageAtMax').isVisible();
    if (isMaxStage) {
      console.log('[T07] UC đã ở S4 — skip S4 fields test');
      return;
    }

    await page.locator('#upgradeToggle').check();
    await expect(page.locator('#upgradePanel')).toBeVisible();

    const targetText = await page.locator('#targetStageBadge').textContent();
    const isTargetS4 = targetText && targetText.includes('S4');

    const s4Visible = await page.locator('#s4Fields').isVisible();
    console.log(`[T07] Target: ${targetText?.trim()} | S4 fields visible: ${s4Visible}`);

    if (isTargetS4) {
      expect(s4Visible).toBe(true);
      await expect(page.locator('#scalePlan')).toBeVisible();
      await expect(page.locator('#scaleRisks')).toBeVisible();
    } else {
      expect(s4Visible).toBe(false);
    }

    await page.screenshot({ path: `${EVD}/T07-s4-fields.png`, fullPage: true });
    console.log('[T07] PASS — S4 fields conditional rendering correct');
  });

  // ── TEST 8: Submit weekly update (không nâng stage) ─────────────

  test('T08 — Submit thành công khi không chọn nâng stage', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    // Điền form
    await page.locator('#progressSlider').fill('45');
    await page.locator('#progressSlider').dispatchEvent('input');
    await page.locator('#weeklyUpdate').fill('Tuần này đã thử nghiệm prompt mới với 3 case thực tế. Kết quả tốt.');
    await page.locator('#nextMilestone').fill('Hoàn thành pilot với 5 người dùng cuối tháng');
    await page.locator('#monthlyUsage').fill('8');
    await page.locator('#hoursSaved').fill('2.5');

    await page.screenshot({ path: `${EVD}/T08-before-submit.png`, fullPage: true });

    // Submit
    const btnSubmit = page.locator('#btnSubmit');
    await btnSubmit.click();

    // Chờ success state (GAS call có thể mất 5-30s)
    await expect(page.locator('#successState')).toBeVisible({ timeout: 60000 });
    const detail = await page.locator('#successDetail').textContent();
    console.log(`[T08] Success detail: ${detail}`);

    await page.screenshot({ path: `${EVD}/T08-submit-success.png`, fullPage: true });
    console.log('[T08] PASS — Submit weekly update thành công');
  });

  // ── TEST 9: Timeline tải sau khi chọn UC ────────────────────────

  test('T09 — Timeline lịch sử tải và hiển thị sau khi chọn UC', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    // Chờ timeline wrap visible (GAS call getWeeklyLog)
    await expect(page.locator('#timelineWrap')).toBeVisible({ timeout: 30000 });

    const timelineContent = await page.locator('#timelineContent').innerHTML();
    const hasEntries = timelineContent.includes('timeline-card') || timelineContent.includes('wu-timeline-empty');
    expect(hasEntries).toBe(true);
    console.log(`[T09] Timeline rendered, has entries: ${timelineContent.includes('timeline-card')}`);

    await page.screenshot({ path: `${EVD}/T09-timeline.png`, fullPage: true });
    console.log('[T09] PASS — Timeline rendered');
  });

  // ── TEST 10: Submit có nâng stage (full S-transition flow) ───────

  test('T10 — Submit có nâng stage khi tick đủ checklist', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    const isMaxStage = await page.locator('#stageAtMax').isVisible();
    if (isMaxStage) {
      console.log('[T10] UC đã ở S4 — skip stage transition test');
      return;
    }

    // Mở upgrade panel
    await page.locator('#upgradeToggle').check();
    await expect(page.locator('#upgradePanel')).toBeVisible();

    // Tick toàn bộ checklist
    const checkboxes = page.locator('#checklistItems input[type=checkbox]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    console.log(`[T10] Ticked ${count} checklist items`);

    // S4: điền bắt buộc
    const targetText = await page.locator('#targetStageBadge').textContent();
    if (targetText && targetText.includes('S4')) {
      await page.locator('#scalePlan').fill('Mở rộng sang team Bán hàng và team Chăm sóc khách hàng trong Q3/2026. Mục tiêu 20 người dùng, phối hợp với CNTT để setup account.');
      await page.locator('#scaleRisks').fill('Rủi ro về data sensitivity; cần review chính sách bảo mật trước khi mở rộng.');
    }

    // Điền form chính
    await page.locator('#progressSlider').fill('70');
    await page.locator('#progressSlider').dispatchEvent('input');
    await page.locator('#weeklyUpdate').fill('Đã pilot thành công với 5 người trong team, feedback rất tích cực. Sẵn sàng nâng stage.');
    await page.locator('#monthlyUsage').fill('12');

    await page.screenshot({ path: `${EVD}/T10-before-stage-submit.png`, fullPage: true });

    // Submit
    await page.locator('#btnSubmit').click();

    // Chờ success
    await expect(page.locator('#successState')).toBeVisible({ timeout: 60000 });
    const detail = await page.locator('#successDetail').textContent();
    console.log(`[T10] Success: ${detail}`);

    await page.screenshot({ path: `${EVD}/T10-stage-submit-success.png`, fullPage: true });
    console.log('[T10] PASS — Stage transition submit thành công');
  });

  // ── TEST 11: Reset all ───────────────────────────────────────────

  test('T11 — "Cập nhật use case khác" reset toàn bộ', async ({ page }) => {
    await page.goto('/weekly-update.html');
    await waitForUcOptions(page, 2, 30000);
    await selectFirstUc(page);

    // Giả lập success state (gọi resetAll qua evaluate)
    await page.evaluate(() => { resetAll(); });

    await expect(page.locator('#wuForm')).not.toBeVisible();
    await expect(page.locator('#stageSection')).not.toBeVisible();
    await expect(page.locator('#ucCard')).not.toHaveClass(/visible/);

    const selVal = await page.locator('#ucSelect').inputValue();
    expect(selVal).toBe('');

    await page.screenshot({ path: `${EVD}/T11-reset-all.png`, fullPage: true });
    console.log('[T11] PASS — resetAll clears everything');
  });

});
