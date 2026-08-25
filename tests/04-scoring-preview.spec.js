// 04-scoring-preview.spec.js — ScoringH2 client-side scoring logic (H2 Giai đoạn 3)
// Mô hình auto-score 70/30 + preview khi đăng ký ĐÃ GỠ. Thay bằng ScoringH2 (mirror GAS).
const { test, expect } = require('@playwright/test');

const FIXTURE = '/tests/scoring-h2-test.html';

test.describe('ScoringH2 — Điểm US (hội đồng) 30/40/30', () => {
  test('Cả 3 tiêu chí max → 100', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.councilMemberScore(10, 10, 10))).toBe(100);
  });
  test('Chỉ Tự động hóa (0,10,0) → 40', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.councilMemberScore(0, 10, 0))).toBe(40);
  });
  test('Đồng đều 5/5/5 → 50', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.councilMemberScore(5, 5, 5))).toBe(50);
  });
  test('Clamp tiêu chí >10 → về 10', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.councilMemberScore(20, 10, 10))).toBe(100);
  });
  test('Bình quân hội đồng [100,50] → 75', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.councilAverage([100, 50]))).toBe(75);
  });
});

test.describe('ScoringH2 — Điểm cá nhân 30/20/30/20', () => {
  test('Cả 4 max → 100', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.personalFinalScore(10, 10, 10, 10))).toBe(100);
  });
  test('Chỉ Thành thạo AI (0,10,0,0) → 20', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.personalFinalScore(0, 10, 0, 0))).toBe(20);
  });
});

test.describe('ScoringH2 — KPI tổng hợp', () => {
  test('Khóa học: 4 thường → 100', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.courseScore(4, 0))).toBe(100);
  });
  test('Khóa học: 2 trả phí → 100 (x2)', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.courseScore(2, 2))).toBe(100);
  });
  test('Lan tỏa true → 100', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.sharingScore(true))).toBe(100);
  });
  test('Điểm trừ: 3 milestone chậm → 6', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.milestonePenalty(3))).toBe(6);
  });
  test('Điểm trừ: cap −10', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.milestonePenalty(6))).toBe(10);
  });
  test('Member KPI: cả 4=100, trừ 10 → 90', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.memberKpiFinal(100, 100, 100, 100, 10))).toBe(90);
  });
  test('Member KPI: chỉ M1=100 → 40', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.memberKpiFinal(100, 0, 0, 0, 0))).toBe(40);
  });
  test('Teamlead KPI: T1=80 T2=50 → 68', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.teamleadKpiFinal(80, 50))).toBe(68);
  });
  test('PM KPI bản A: cả 4=100 → 100', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.pmKpiFinal(100, 100, 100, 100))).toBe(100);
  });
  test('PM KPI bản A: chỉ A1=100 → 30', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.pmKpiFinal(100, 0, 0, 0))).toBe(30);
  });
});

test.describe('ScoringH2 — Rank ngưỡng 85/70/50', () => {
  test('≥85 → TOP_PERFORMER', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.rankInfo(90).key)).toBe('TOP_PERFORMER');
  });
  test('≥70 → STRONG_CONTRIBUTOR', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.rankInfo(72).key)).toBe('STRONG_CONTRIBUTOR');
  });
  test('≥50 → AVERAGE', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.rankInfo(55).key)).toBe('AVERAGE');
  });
  test('<50 → BOTTOM_PERFORMER', async ({ page }) => {
    await page.goto(FIXTURE);
    expect(await page.evaluate(() => ScoringH2.rankInfo(30).key)).toBe('BOTTOM_PERFORMER');
  });
});
