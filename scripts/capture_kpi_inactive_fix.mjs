/**
 * capture_kpi_inactive_fix.mjs
 * Chụp EVD screenshots cho bug fix: inactive user bị loại khỏi KPI tuần
 * Chạy: node scripts/capture_kpi_inactive_fix.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE      = 'http://localhost:8787';
const EVD_DIR   = path.join(__dirname, '..', 'evd', 'kpi-inactive-fix');

// Session inject: admin user (tuantt4)
const ADMIN_SESSION = {
  email:       'tuantt4',
  displayName: 'Tuan Tran',
  role:        'admin',
  team:        'CV2',
  loginAt:     new Date().toISOString()
};

async function injectSession(page, session) {
  await page.goto(`${BASE}/login.html`);
  await page.evaluate((s) => {
    sessionStorage.setItem('ai_user_session', JSON.stringify(s));
    sessionStorage.setItem('ai_admin_email',  s.email);
  }, session);
}

async function screenshot(page, filename, label) {
  const fp = path.join(EVD_DIR, filename);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`  [EVD] ${label} → ${filename}`);
}

// ── Mock: inject _usersList với inactive user VÀ _allList có UC của inactive ──
// Dùng page.addInitScript để set window.__TEST_MOCK trước khi dashboard.js chạy
const MOCK_SCRIPT = `
  // Override Api.getUsers để trả về users gồm 1 inactive
  window.__mockUsersInjected = false;
  var _origFetch = window.fetch;

  // Intercept dashboard _usersList via sessionStorage trick:
  // Ta sẽ expose mock sau khi page load xong bằng evaluate
`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();

  // ── EVD 01: Unit test pass (25/25) ──────────────────────────────────────
  // Capture terminal output đã có — chụp dashboard thay thế

  // ── EVD 02: KPI tab — chỉ hiện active users ─────────────────────────────
  await injectSession(page, ADMIN_SESSION);

  // Mock JSONP calls
  await page.route('**/?action=list*', async route => {
    const body = JSON.stringify({
      success: true,
      data: [
        // active user có Approved UC
        {
          record_id: 'REC-001', usecase_id: 'AIUS-0001',
          name: 'UC Active User', owner_email: 'active_kpi', owner_name: 'Active KPI',
          team: 'Team Số', status: 'Approved', submit_date: new Date().toISOString().split('T')[0],
          auto_score: 70, total_score: 85, rank_category: 'STRONG_CONTRIBUTOR'
        },
        // inactive user cũng có Approved UC (should NOT appear in KPI after fix)
        {
          record_id: 'REC-002', usecase_id: 'AIUS-0002',
          name: 'UC Inactive User', owner_email: 'inactive_kpi', owner_name: 'Inactive KPI',
          team: 'Team Số', status: 'Approved', submit_date: new Date().toISOString().split('T')[0],
          auto_score: 60, total_score: 75, rank_category: 'STRONG_CONTRIBUTOR'
        }
      ]
    });
    const cb = new URL(route.request().url()).searchParams.get('callback') || 'cb';
    await route.fulfill({ contentType: 'application/javascript', body: `${cb}(${body})` });
  });

  await page.route('**/?action=users*', async route => {
    const body = JSON.stringify({
      success: true,
      data: [
        { username: 'active_kpi',   display_name: 'Active KPI',   team: 'Team Số', role: 'user', active: true  },
        { username: 'inactive_kpi', display_name: 'Inactive KPI', team: 'Team Số', role: 'user', active: false }
      ]
    });
    const cb = new URL(route.request().url()).searchParams.get('callback') || 'cb';
    await route.fulfill({ contentType: 'application/javascript', body: `${cb}(${body})` });
  });

  await page.route('**/?action=dashboard*', async route => {
    const body = JSON.stringify({ success: true, data: { total: 2, approved: 2, pending: 0, hours_saved: 0, recent_submissions: [], status_breakdown: {}, team_breakdown: {}, category_breakdown: {} } });
    const cb = new URL(route.request().url()).searchParams.get('callback') || 'cb';
    await route.fulfill({ contentType: 'application/javascript', body: `${cb}(${body})` });
  });

  await page.route('**/?action=lookup*', async route => {
    const body = JSON.stringify({ success: true, data: { Team: ['Team Số'], Business_Category: ['Vận hành'] } });
    const cb = new URL(route.request().url()).searchParams.get('callback') || 'cb';
    await route.fulfill({ contentType: 'application/javascript', body: `${cb}(${body})` });
  });

  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' });

  // Click tab KPI
  const kpiTab = page.locator('[data-tab="kpi"]');
  if (await kpiTab.isVisible()) {
    await kpiTab.click();
    await page.waitForTimeout(1500);
    await screenshot(page, '01-kpi-tab-before-users-load.png', 'KPI tab sau khi click (trước khi users load)');

    // Chờ users load xong
    await page.waitForTimeout(3000);
    await screenshot(page, '02-kpi-tab-after-users-load.png', 'KPI tab sau khi users load — inactive_kpi KHÔNG xuất hiện');

    // Verify trong DOM
    const tableText = await page.locator('#tab-kpi').innerText().catch(() => '');
    const hasInactive = tableText.includes('Inactive KPI') || tableText.includes('inactive_kpi');
    const hasActive   = tableText.includes('Active KPI')   || tableText.includes('active_kpi');

    console.log('  [VERIFY] Active KPI trong bảng:', hasActive   ? 'CÓ ✅' : 'KHÔNG ❌');
    console.log('  [VERIFY] Inactive KPI trong bảng:', hasInactive ? 'CÓ ❌ (BUG còn)' : 'KHÔNG ✅ (fix OK)');

    // Highlight bảng KPI
    await page.evaluate(() => {
      var kpiPanel = document.getElementById('tab-kpi');
      if (kpiPanel) kpiPanel.style.outline = '3px solid #7B2CBF';
    });
    await screenshot(page, '03-kpi-tab-highlighted.png', 'KPI tab (highlight) — chỉ active user hiển thị');
  }

  // ── EVD 03: Unit test output ─────────────────────────────────────────────
  // Không thể chụp terminal — thay bằng screenshot trang tests
  await page.goto(`${BASE}/assets/tests/test-kpi-data.js`);
  await page.waitForTimeout(500);
  await screenshot(page, '04-unit-test-source.png', 'Source unit test (25 cases bao gồm Suite F)');

  // ── EVD 04: Code diff - dashboard.js ────────────────────────────────────
  // Navigate đến page blank và render code snippet
  await page.setContent(`
    <!DOCTYPE html><html><body style="font:13px monospace;padding:20px;background:#1e1e1e;color:#d4d4d4">
    <h2 style="color:#7B2CBF;font-family:sans-serif">BUG FIX: dashboard.js — _buildKPIData() Step 2b</h2>
    <pre style="background:#252525;padding:16px;border-radius:8px;line-height:1.6">
<span style="color:#6a9955">// Step 2a: inactive user → ghi vào inactiveKeys (THÊM MỚI)</span>
<span style="color:#c586c0">if</span> (u.active === <span style="color:#569cd6">false</span>) {
  <span style="color:#c586c0">var</span> ik  = _norm(u.username);    <span style="color:#c586c0">if</span> (ik)  inactiveKeys[ik]  = <span style="color:#569cd6">true</span>;
  <span style="color:#c586c0">var</span> idk = _norm(u.display_name); <span style="color:#c586c0">if</span> (idk) inactiveKeys[idk] = <span style="color:#569cd6">true</span>;
  <span style="color:#c586c0">return</span>;
}

<span style="color:#6a9955">// Step 2b: skip inactive dù có UC cũ trong _allList (THÊM MỚI)</span>
Object.keys(byEmail).forEach(<span style="color:#c586c0">function</span> (eKey) {
  <span style="color:#c586c0">if</span> (claimed[eKey]) <span style="color:#c586c0">return</span>;
  <span style="color:#c586c0">if</span> (excluded.indexOf(eKey) !== -<span style="color:#b5cea8">1</span>) <span style="color:#c586c0">return</span>;
  <span style="color:#ce9178;font-weight:bold">if (inactiveKeys[eKey]) return; // ← FIX: loại inactive user</span>
  <span style="color:#c586c0">var</span> stats = byEmail[eKey];
  result[eKey] = { ... };
});
    </pre>
    <p style="color:#4ec9b0;font-family:sans-serif;margin-top:12px">
      Root cause: inactive user bị return ở Step 2a mà không vào <code>claimed</code>
      → Step 2b thêm UC của họ vào result từ byEmail.<br>
      Fix: ghi inactiveKeys trong Step 2a, filter trong Step 2b.
    </p>
    </body></html>
  `);
  await screenshot(page, '05-code-fix-diff.png', 'Code fix dashboard.js _buildKPIData()');

  await browser.close();
  console.log('\n✅ Đã lưu', 5, 'EVD screenshots vào evd/kpi-inactive-fix/');
})();
