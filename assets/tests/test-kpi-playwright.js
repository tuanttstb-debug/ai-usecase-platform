/**
 * test-kpi-playwright.js
 * Playwright integration tests cho KPI & Tiến độ tab sau refactor.
 * Chạy: node assets/tests/test-kpi-playwright.js
 * Yêu cầu: local server trên http://localhost:8787
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  let passed = 0, failed = 0;
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

  function assert(condition, label) {
    if (condition) { console.log('  ✅ PASS: ' + label); passed++; }
    else           { console.error('  ❌ FAIL: ' + label); failed++; }
  }

  // ── Setup: inject admin session ──────────────────────────────────
  await page.goto('http://localhost:8787/dashboard.html');
  await page.evaluate(() => {
    sessionStorage.setItem('ai_user_session', JSON.stringify({
      email: 'tuantt4', displayName: 'Tuan Tran', role: 'admin', loginAt: Date.now()
    }));
    sessionStorage.setItem('ai_admin_email', 'tuantt4');
  });
  await page.goto('http://localhost:8787/dashboard.html');
  await page.waitForTimeout(1500);

  console.log('\n=== T1: KPI tab button exists & is clickable ===');
  const kpiBtn = await page.$('[data-tab="kpi"]');
  assert(kpiBtn !== null, 'T1.1: [data-tab="kpi"] button found in DOM');

  console.log('\n=== T2: Click KPI tab — content renders ===');
  if (kpiBtn) {
    await kpiBtn.click();
    // Wait for either real GAS response or timeout fallback (3s should be enough for fallback)
    await page.waitForTimeout(3500);

    const content = await page.evaluate(() => {
      const el = document.getElementById('kpiTabContent');
      return el ? el.innerHTML : '';
    });

    // Should render something — either data or "loading" message
    assert(content.length > 0, 'T2.1: kpiTabContent is non-empty after click');

    // Check for known structural elements (header bar or loading state)
    const hasHeader = content.includes('kpi-week-header') || content.includes('empty-state');
    assert(hasHeader, 'T2.2: Content has kpi-week-header or empty-state');
  }

  console.log('\n=== T3: No JS errors on KPI tab load ===');
  assert(errors.length === 0, 'T3.1: Zero JS errors: ' + (errors.length ? errors.join('; ') : 'none'));

  console.log('\n=== T4: Tab panel visibility ===');
  const kpiPanel = await page.$('#tab-kpi');
  assert(kpiPanel !== null, 'T4.1: #tab-kpi panel exists in DOM');

  const isVisible = await page.evaluate(() => {
    const panel = document.getElementById('tab-kpi');
    return panel && !panel.classList.contains('hidden');
  });
  assert(isVisible, 'T4.2: #tab-kpi panel is visible (not hidden) after tab click');

  console.log('\n=== T5: Regular user — KPI tab still visible ===');
  await page.evaluate(() => {
    sessionStorage.setItem('ai_user_session', JSON.stringify({
      email: 'regular_user', displayName: 'Regular', role: 'user', loginAt: Date.now()
    }));
  });
  await page.goto('http://localhost:8787/dashboard.html');
  await page.waitForTimeout(1000);

  const kpiTabUser = await page.$('[data-tab="kpi"]');
  assert(kpiTabUser !== null, 'T5.1: KPI tab button exists for regular user');

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n────────────────────────────────');
  console.log('Playwright results: ' + passed + ' passed, ' + failed + ' failed');
  if (errors.length) console.error('JS errors encountered:', errors);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
