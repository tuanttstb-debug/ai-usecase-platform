import { chromium } from 'playwright';
import path from 'path';

const BASE_URL = 'https://tuanttstb-debug.github.io/ai-usecase-platform';
const OUT_DIR = path.join(process.cwd(), 'screenshots');

const CHAMPION_SESSION = JSON.stringify({
  email: 'tuantt4', displayName: 'Trần Thế Tuân (Champion)',
  role: 'champion', team: 'Team Số', loginAt: new Date().toISOString()
});

const ADMIN_SESSION = JSON.stringify({
  email: 'tuantt4', displayName: 'Trần Thế Tuân',
  role: 'admin', team: 'Team Số', loginAt: new Date().toISOString()
});

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function gotoWithAuth(page, targetPath, sessionJson) {
  // Land on login page first to establish the origin
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
  // Inject session while on correct origin
  await page.evaluate((s) => sessionStorage.setItem('ai_user_session', s), sessionJson);
  // Now navigate to target
  await page.goto(`${BASE_URL}/${targetPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  const page = await ctx.newPage();

  // Retake 03 - dashboard Của tôi
  console.log('Retake: Dashboard champion...');
  await gotoWithAuth(page, 'dashboard.html', CHAMPION_SESSION);
  try { await page.waitForFunction(() => !document.querySelector('.spinner, [class*="spin"]'), { timeout: 8000 }); } catch {}
  await page.waitForTimeout(1500);
  await shot(page, '03_dashboard_my');

  // Admin review queue
  console.log('Retake: Review queue (admin)...');
  await gotoWithAuth(page, 'review-queue.html', ADMIN_SESSION);
  try { await page.waitForFunction(() => !document.querySelector('.spinner, [class*="spin"]'), { timeout: 8000 }); } catch {}
  await page.waitForTimeout(1500);
  await shot(page, '05b_review_queue_admin');

  // Try opening first review item
  console.log('Retake: Review panel open...');
  try {
    const allBtns = await page.$$('button');
    let opened = false;
    for (const btn of allBtns) {
      const txt = (await btn.textContent() || '').trim();
      if (/duyệt|review|xem|chi tiết|đánh giá/i.test(txt)) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ force: true });
        await page.waitForTimeout(2500);
        await shot(page, '06_review_panel_open');
        opened = true;
        break;
      }
    }
    if (!opened) {
      // try clicking first data row
      const row = page.locator('tbody tr').first();
      if (await row.count() > 0) {
        await row.click({ force: true });
        await page.waitForTimeout(2500);
        await shot(page, '06_review_panel_open');
      } else {
        console.log('  ! No rows found, skipping panel screenshot');
      }
    }
  } catch (e) {
    console.log('  ! Panel error:', e.message);
  }

  await browser.close();
  console.log('\nDone.');
})();
