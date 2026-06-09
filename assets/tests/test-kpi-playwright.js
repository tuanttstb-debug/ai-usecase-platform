/**
 * test-kpi-playwright.js
 * Playwright integration tests cho KPI & Tiến độ tab.
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

  // ── Helper: inject mock _allList + _usersList via page evaluate ──
  async function injectMockData(page) {
    await page.evaluate(() => {
      // Patch Api.listUseCases to return mock data immediately
      if (typeof Api !== 'undefined') {
        Api.listUseCases = () => Promise.resolve([
          { usecase_id: 'AIUS-0001', name: 'UC Test 1', owner_name: 'Tuan Tran', owner_email: 'tuantt4', team: 'CV2', status: 'Approved',  submit_date: '2026-06-02' },
          { usecase_id: 'AIUS-0002', name: 'UC Test 2', owner_name: 'Tuan Tran', owner_email: 'tuantt4', team: 'CV2', status: 'Submitted', submit_date: '2026-06-03' },
          { usecase_id: 'AIUS-0003', name: 'UC Test 3', owner_name: 'Nguyen Van A', owner_email: 'nguyenva', team: 'IT',  status: 'Approved',  submit_date: '2026-06-04' },
        ]);
        Api.getDashboard = () => Promise.resolve({ status_breakdown: {}, recent_submissions: [], refreshed_at: '' });
        Api.getUsers     = () => Promise.resolve([]);
      }
    });
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

  // ── T1: KPI tab exists ────────────────────────────────────────────
  console.log('\n=== T1: KPI tab button exists & is clickable ===');
  const kpiBtn = await page.$('[data-tab="kpi"]');
  assert(kpiBtn !== null, 'T1.1: [data-tab="kpi"] button found in DOM');

  // ── T2: KPI tab content renders ──────────────────────────────────
  console.log('\n=== T2: Click KPI tab — content renders ===');
  if (kpiBtn) {
    await kpiBtn.click();
    await page.waitForTimeout(3500);

    const content = await page.evaluate(() => {
      const el = document.getElementById('kpiTabContent');
      return el ? el.innerHTML : '';
    });

    assert(content.length > 0, 'T2.1: kpiTabContent is non-empty after click');
    const hasHeader = content.includes('kpi-week-header') || content.includes('empty-state');
    assert(hasHeader, 'T2.2: Content has kpi-week-header or empty-state');
  }

  // ── T3: No JS errors ─────────────────────────────────────────────
  console.log('\n=== T3: No JS errors on KPI tab load ===');
  assert(errors.length === 0, 'T3.1: Zero JS errors: ' + (errors.length ? errors.join('; ') : 'none'));

  // ── T4: Panel visibility ──────────────────────────────────────────
  console.log('\n=== T4: Tab panel visibility ===');
  const kpiPanel = await page.$('#tab-kpi');
  assert(kpiPanel !== null, 'T4.1: #tab-kpi panel exists in DOM');

  const isVisible = await page.evaluate(() => {
    const panel = document.getElementById('tab-kpi');
    return panel && !panel.classList.contains('hidden');
  });
  assert(isVisible, 'T4.2: #tab-kpi panel is visible (not hidden) after tab click');

  // ── T5: Regular user — KPI tab still visible ──────────────────────
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

  // ── T6: "Xem US" buttons render in KPI tables ─────────────────────
  console.log('\n=== T6: "Xem US" buttons exist in KPI tables ===');
  await page.evaluate(() => {
    sessionStorage.setItem('ai_user_session', JSON.stringify({
      email: 'tuantt4', displayName: 'Tuan Tran', role: 'admin', loginAt: Date.now()
    }));
    sessionStorage.setItem('ai_admin_email', 'tuantt4');
  });
  await page.goto('http://localhost:8787/dashboard.html');
  await page.waitForTimeout(1500);

  const kpiBtn2 = await page.$('[data-tab="kpi"]');
  if (kpiBtn2) {
    await kpiBtn2.click();
    await page.waitForTimeout(4000);

    const hasXemUS = await page.evaluate(() => {
      const content = document.getElementById('kpiTabContent');
      if (!content) return false;
      const btns = Array.from(content.querySelectorAll('button'));
      return btns.some(b => b.textContent.trim() === 'Xem US');
    });
    assert(hasXemUS, 'T6.1: At least one "Xem US" button renders in KPI tab (requires data from GAS)');

    // Check Dashboard._openKPIUserList is exposed
    const apiExposed = await page.evaluate(() => {
      return typeof window.Dashboard !== 'undefined' &&
             typeof window.Dashboard._openKPIUserList === 'function';
    });
    assert(apiExposed, 'T6.2: Dashboard._openKPIUserList is a function in public API');
  }

  // ── T7: _openKPIUserList opens listModal ──────────────────────────
  console.log('\n=== T7: _openKPIUserList opens listModal ===');
  const listModalHidden = await page.evaluate(() => {
    const modal = document.getElementById('listModal');
    return modal ? modal.classList.contains('hidden') : true;
  });
  assert(listModalHidden, 'T7.1: listModal is hidden before calling _openKPIUserList');

  await page.evaluate(() => {
    if (typeof Dashboard !== 'undefined' && Dashboard._openKPIUserList) {
      Dashboard._openKPIUserList('tuantt4', 'Tuan Tran');
    }
  });

  const listModalVisible = await page.evaluate(() => {
    const modal = document.getElementById('listModal');
    return modal ? !modal.classList.contains('hidden') : false;
  });
  assert(listModalVisible, 'T7.2: listModal is visible after calling _openKPIUserList');

  const listModalTitle = await page.evaluate(() => {
    const el = document.getElementById('listModalTitle');
    return el ? el.textContent : '';
  });
  assert(listModalTitle.includes('Tuan Tran'), 'T7.3: listModal title contains user displayName');

  // Close modal then verify Escape closes it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const listModalClosedAfterEsc = await page.evaluate(() => {
    const modal = document.getElementById('listModal');
    return modal ? modal.classList.contains('hidden') : true;
  });
  assert(listModalClosedAfterEsc, 'T7.4: Escape key closes listModal');

  // ── T8: No new JS errors after T6+T7 ─────────────────────────────
  console.log('\n=== T8: No JS errors after drill-down ===');
  assert(errors.length === 0, 'T8.1: Zero JS errors total: ' + (errors.length ? errors.join('; ') : 'none'));

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n────────────────────────────────');
  console.log('Playwright results: ' + passed + ' passed, ' + failed + ' failed');
  if (errors.length) console.error('JS errors encountered:', errors);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
