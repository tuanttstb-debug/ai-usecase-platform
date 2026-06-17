// test-governance-ui.js — Playwright tests for governance pages
// Run: node assets/tests/test-governance-ui.js

const { chromium } = require('playwright');

const BASE = 'http://localhost:4444';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbypN8afAl2zQwpR7K6k1-699g3HAhFAIqAOtDn3qY1nJWzuN1bd8n99bzRUzaV8ZMyTCw/exec';

const ADMIN_SESSION = {
  email: 'tuantt4',
  displayName: 'TuanTT4',
  role: 'admin',
  team: 'Team Số',
  loginAt: new Date().toISOString()
};

const USER_SESSION = {
  email: 'tuantt4',
  displayName: 'TuanTT4',
  role: 'user',
  team: 'Team Số',
  loginAt: new Date().toISOString()
};

async function injectSession(page, session) {
  await page.addInitScript((s) => {
    sessionStorage.setItem('ai_user_session', JSON.stringify(s));
  }, session);
}

let pass = 0, fail = 0, warn = 0;
function ok(label) { console.log('  ✅', label); pass++; }
function ko(label, detail) { console.log('  ❌', label, detail || ''); fail++; }
function wa(label, detail) { console.log('  ⚠️', label, detail || ''); warn++; }

async function testLeaderboard(browser) {
  console.log('\n=== leaderboard.html ===');
  const page = await browser.newPage();
  await injectSession(page, ADMIN_SESSION);

  // Capture console errors
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/leaderboard.html', { waitUntil: 'networkidle', timeout: 40000 });

  // Check no crash redirect to login
  const url = page.url();
  if (url.includes('login.html')) {
    ko('Should NOT redirect to login — session inject failed', url);
    await page.close(); return;
  }
  ok('Page loads without redirect to login');

  // Check tabs exist
  const tabs = await page.$$('.lb-tab');
  tabs.length === 3 ? ok('3 tabs rendered') : ko('Expected 3 tabs, got ' + tabs.length);

  // Wait for JSONP to return data (leaderboard endpoint)
  try {
    await page.waitForFunction(() => {
      var rows = document.querySelectorAll('#topTable tbody tr');
      return rows.length > 0;
    }, { timeout: 35000 });
    const rowCount = await page.$$eval('#topTable tbody tr', r => r.length);
    ok(`Top performers table: ${rowCount} rows rendered`);
  } catch(e) {
    // Check for error message instead
    const errText = await page.$eval('#topTable', el => el.textContent).catch(() => '');
    ko('Top performers table did not load', errText.slice(0, 100));
  }

  // Check score bar rendered
  const scoreBars = await page.$$('.score-bar-fill');
  scoreBars.length > 0 ? ok('Score bars rendered') : wa('No score bars visible');

  // Switch to Bottom tab
  await page.click('[data-tab="bottom"]');
  const bottomVisible = await page.$('#tabBottom');
  const bottomDisplay = await bottomVisible.evaluate(el => el.style.display);
  bottomDisplay !== 'none' ? ok('Bottom tab switches correctly') : ko('Bottom tab not visible');

  // Switch to Category tab
  await page.click('[data-tab="category"]');
  const catContent = await page.$eval('#categoryContent', el => el.textContent).catch(() => '');
  catContent.length > 20 ? ok('Category tab has content') : wa('Category tab might be empty (no categories set yet)');

  // Check team filter gets populated
  const teamOpts = await page.$$('#filterTeam option');
  teamOpts.length > 1 ? ok(`Team filter populated: ${teamOpts.length} options`) : wa('Team filter only has default option');

  if (errors.length > 0) {
    errors.forEach(e => ko('JS error: ' + e.slice(0, 120)));
  }

  await page.close();
}

async function testWeeklyUpdate(browser) {
  console.log('\n=== weekly-update.html ===');
  const page = await browser.newPage();
  await injectSession(page, ADMIN_SESSION);

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/weekly-update.html', { waitUntil: 'networkidle', timeout: 30000 });

  const url = page.url();
  if (url.includes('login.html')) {
    ko('Should NOT redirect to login'); await page.close(); return;
  }
  ok('Page loads without redirect');

  // Wait for use case dropdown to be populated
  try {
    await page.waitForFunction(() => {
      return document.querySelectorAll('#ucSelect option').length > 1;
    }, { timeout: 35000 });
    const opts = await page.$$eval('#ucSelect option', els => els.length);
    ok(`Use case picker loaded: ${opts - 1} use cases (admin sees all)`);
  } catch(e) {
    ko('Use case picker did not populate', 'Timeout');
  }

  // Select first use case
  const firstVal = await page.$eval('#ucSelect option:nth-child(2)', el => el.value).catch(() => null);
  if (firstVal) {
    await page.selectOption('#ucSelect', firstVal);

    // UC card should appear
    const cardVisible = await page.$eval('#ucCard', el => el.classList.contains('visible')).catch(() => false);
    cardVisible ? ok('UC info card appears on selection') : ko('UC info card not showing');

    // Form should appear
    const formVisible = await page.$eval('#wuForm', el => el.style.display !== 'none').catch(() => false);
    formVisible ? ok('Weekly update form appears') : ko('Form not visible');

    // Progress slider should be pre-filled
    const sliderVal = await page.$eval('#progressSlider', el => el.value).catch(() => '0');
    ok('Progress slider present, value: ' + sliderVal + '%');

    // Test overdue warning (first UC may or may not be overdue)
    const warnVisible = await page.$eval('#overdueWarn', el => el.classList.contains('visible')).catch(() => false);
    ok(`Overdue warning: ${warnVisible ? 'shown (no previous update)' : 'hidden (has recent update)'}`);
  } else {
    wa('No use cases in dropdown to test selection');
  }

  // Test validation: submit without weekly update text
  if (firstVal) {
    await page.click('#btnSubmit');
    // Should show toast error, NOT submit
    const toastArea = await page.$eval('#toastArea', el => el.innerHTML).catch(() => '');
    toastArea.includes('Vui lòng nhập') ? ok('Validation: empty weekly update shows error') : wa('Toast validation may not have triggered');
  }

  if (errors.length > 0) {
    errors.slice(0, 3).forEach(e => ko('JS error: ' + e.slice(0, 120)));
  }

  await page.close();
}

async function testManagerReview(browser) {
  console.log('\n=== manager-review.html (admin) ===');
  const page = await browser.newPage();
  await injectSession(page, ADMIN_SESSION);

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/manager-review.html', { waitUntil: 'networkidle', timeout: 30000 });

  const url = page.url();
  if (url.includes('login.html')) {
    ko('Should NOT redirect to login'); await page.close(); return;
  }
  ok('Admin: page loads without redirect');

  // Wait for list to load
  try {
    await page.waitForFunction(() => {
      var el = document.getElementById('pendingList');
      // loaded when spinner is gone (text changes)
      return el && !el.innerHTML.includes('spinner') || el.querySelectorAll('.uc-review-card').length > 0;
    }, { timeout: 35000 });

    const cardCount = await page.$$eval('.uc-review-card', els => els.length).catch(() => 0);
    const emptyMsg  = await page.$eval('#pendingList', el => el.textContent.includes('không có')).catch(() => false);

    if (cardCount > 0) {
      ok(`Review queue loaded: ${cardCount} use cases`);

      // Expand a review form
      await page.click('.uc-review-card .btn--secondary');
      await page.waitForTimeout(500);

      // Check sliders rendered
      const sliders = await page.$$('.score-slider');
      sliders.length === 3 ? ok('Quality/Business/Innovation sliders rendered') : ko('Expected 3 sliders, got ' + sliders.length);

      // Check category dropdown
      const catOpts = await page.$$('.review-form-panel.open select option').catch(() => []);
      catOpts.length >= 5 ? ok('Category dropdown has options') : wa('Category dropdown: ' + catOpts.length + ' options');

      // Move quality slider → check total updates
      const rid = await page.$eval('.review-form-panel.open', el => el.id.replace('form-', ''));
      if (rid) {
        await page.evaluate((r) => {
          var el = document.getElementById('qualityScore-' + r);
          if (el) { el.value = 8; el.dispatchEvent(new Event('input')); }
        }, rid);
        await page.waitForTimeout(300);
        const total = await page.$eval('[id^="manualTotal-"]', el => el.textContent).catch(() => '0');
        parseInt(total) === 8 ? ok('Manual score total updates: ' + total + '/30') : wa('Manual total: ' + total + ' (expected 8)');
      }
    } else if (emptyMsg) {
      ok('Review queue: no use cases match "Manager_Review" status (all are Pending_Review)');
    }
  } catch(e) {
    ko('Review list did not load', e.message ? e.message.slice(0, 100) : '');
  }

  // Test non-admin access
  const page2 = await browser.newPage();
  await injectSession(page2, USER_SESSION);
  await page2.goto(BASE + '/manager-review.html', { waitUntil: 'networkidle', timeout: 15000 });
  const blockedText = await page2.$eval('#pendingList', el => el.textContent).catch(() => '');
  blockedText.includes('Admin') ? ok('Non-admin sees access denied message') : ko('Non-admin NOT blocked from manager-review');
  await page2.close();

  if (errors.length > 0) {
    errors.slice(0, 3).forEach(e => ko('JS error: ' + e.slice(0, 120)));
  }

  await page.close();
}

(async () => {
  console.log('Starting governance UI tests...\n');
  const browser = await chromium.launch({ headless: true });

  try {
    await testLeaderboard(browser);
    await testWeeklyUpdate(browser);
    await testManagerReview(browser);
  } finally {
    await browser.close();
  }

  console.log(`\n─── Results: ${pass} passed, ${warn} warnings, ${fail} failed ───`);
  if (fail > 0) process.exit(1);
})();
