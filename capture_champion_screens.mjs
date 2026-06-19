import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://tuanttstb-debug.github.io/ai-usecase-platform';
const OUT_DIR = path.join(process.cwd(), 'screenshots');

const CHAMPION_SESSION = JSON.stringify({
  email: 'tuantt4',
  displayName: 'Trần Thế Tuân (Champion)',
  role: 'champion',
  team: 'Team Số',
  loginAt: new Date().toISOString()
});

const ADMIN_SESSION = JSON.stringify({
  email: 'tuantt4',
  displayName: 'Trần Thế Tuân',
  role: 'admin',
  team: 'Team Số',
  loginAt: new Date().toISOString()
});

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
  return file;
}

async function injectSession(page, url, sessionJson) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => sessionStorage.setItem('ai_user_session', s), sessionJson);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  const page = await ctx.newPage();

  // 1. Login page
  console.log('1. Chụp trang đăng nhập...');
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '01_login');

  // 2. Home page (Champion role)
  console.log('2. Chụp trang chủ (Champion)...');
  await injectSession(page, `${BASE_URL}/index.html`, CHAMPION_SESSION);
  await shot(page, '02_home_champion');

  // 3. Dashboard - tab Của tôi
  console.log('3. Chụp Dashboard...');
  await injectSession(page, `${BASE_URL}/dashboard.html`, CHAMPION_SESSION);
  // Try clicking "Của tôi" tab if visible
  try {
    const myTab = page.locator('text=Của tôi').first();
    if (await myTab.isVisible({ timeout: 2000 })) await myTab.click();
    await page.waitForTimeout(800);
  } catch {}
  await shot(page, '03_dashboard_my');

  // 4. Explore tab on dashboard
  console.log('4. Chụp Dashboard - tab Khám phá...');
  try {
    const exploreTab = page.locator('text=Khám phá').first();
    if (await exploreTab.isVisible({ timeout: 2000 })) {
      await exploreTab.click();
      await page.waitForTimeout(800);
    }
  } catch {}
  await shot(page, '04_dashboard_explore');

  // 5. Review Queue - list view
  console.log('5. Chụp hàng đợi duyệt (Review Queue)...');
  await injectSession(page, `${BASE_URL}/review-queue.html`, CHAMPION_SESSION);
  await shot(page, '05_review_queue_list');

  // 6. Review Queue - try to open first item for sliding panel
  console.log('6. Chụp panel duyệt chi tiết...');
  try {
    const firstBtn = page.locator('button, .review-btn, [data-action="review"]').first();
    if (await firstBtn.isVisible({ timeout: 2000 })) {
      await firstBtn.click();
      await page.waitForTimeout(1200);
      await shot(page, '06_review_panel_open');
    } else {
      // Try clicking any table row
      const row = page.locator('tr[data-id], .uc-row, .card').first();
      if (await row.isVisible({ timeout: 2000 })) {
        await row.click();
        await page.waitForTimeout(1200);
        await shot(page, '06_review_panel_open');
      } else {
        console.log('  ! Không có UC để mở panel — bỏ qua');
      }
    }
  } catch (e) {
    console.log('  ! Lỗi mở panel:', e.message);
  }

  // 7. Register page - UC submission form (admin to see full form)
  console.log('7. Chụp form đăng ký Use Case...');
  await injectSession(page, `${BASE_URL}/register.html`, ADMIN_SESSION);
  await shot(page, '07_register_form');

  // 8. Register - step 2 if wizard
  console.log('8. Chụp bước wizard (nếu có)...');
  try {
    const nextBtn = page.locator('button:has-text("Tiếp theo"), button:has-text("Next"), .btn-next').first();
    if (await nextBtn.isVisible({ timeout: 2000 })) {
      // fill required field step 1
      const titleInput = page.locator('input[name="title"], input[placeholder*="tên"], input[placeholder*="tiêu đề"]').first();
      if (await titleInput.isVisible({ timeout: 1000 })) {
        await titleInput.fill('Use Case Kiểm tra AI');
      }
      await nextBtn.click();
      await page.waitForTimeout(800);
      await shot(page, '08_register_step2');
    }
  } catch {}

  // 9. Leaderboard (scoring & ranking)
  console.log('9. Chụp bảng xếp hạng...');
  await injectSession(page, `${BASE_URL}/leaderboard.html`, CHAMPION_SESSION);
  await shot(page, '09_leaderboard');

  await browser.close();
  console.log('\nHoàn thành! Screenshots trong thư mục:', OUT_DIR);
})();
