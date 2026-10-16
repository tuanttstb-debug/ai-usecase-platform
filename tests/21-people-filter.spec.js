// @ts-check
// 21-people-filter.spec.js — CR 2026-10-16:
//   (1) BỘ LỌC CHUẨN Team + Nhân sự (people-filter.js, nhãn "Username-Họ tên") trên màn "Bài tập & Học tập":
//       tab Thư viện · Theo dõi · Việc lớn (Bài tập tuần / Khóa học là dữ liệu của chính mình — không lọc).
//   (2) Bảng "Bài tập của tôi theo tuần": mọi bài của mình đều có nút sửa (Bổ sung · Sửa để chấm lại · Sửa + xác nhận khi Đạt).
// Tên trong mock là hư cấu.
const { test, expect } = require('@playwright/test');
const { setSession, REGULAR_USER } = require('./helpers');

const ME = Object.assign({}, REGULAR_USER, { team: 'BL' }); // username 'user01'

const DATA = {
  current_week: '2026-W41',
  members: [
    { username: 'user01', display_name: 'User Test', team: 'BL', status: 'Đã đăng ký' },
    { username: 'a2', display_name: 'Thành viên A2', team: 'CV', status: 'Đã đăng ký' },
    { username: 'a3', display_name: 'Thành viên A3', team: 'CV', status: 'Đã đăng ký' },
  ],
  weeks: [],
  courses: [
    { course_id: 'KH-1', username: 'a2', display_name: 'Thành viên A2', team: 'CV', course_name: 'Khóa A', target_date: '2026-11-30', status: 'Đã đăng ký' },
    { course_id: 'KH-2', username: 'user01', display_name: 'User Test', team: 'BL', course_name: 'Khóa B', target_date: '2026-11-30', status: 'Đã đăng ký' },
  ],
  big_tasks: [
    { task_id: 'VL-03', task_name: 'Việc lớn CV', team: 'CV', source_type: 'Team tự chọn', lead: 'a2', pilot_deadline: '2026-10-31' },
    { task_id: 'VL-07', task_name: 'Việc lớn BL', team: 'BL', source_type: 'PM đề xuất', lead: 'lead.bl', pilot_deadline: '2026-10-31' },
  ],
  krs: [],
  assigns: [{ assign_id: 'AS-1', task_id: 'VL-07', username: 'user01', display_name: 'User Test', team: 'BL', item: 'Hạng mục', status: 'Đang làm' }],
};

const FULL = { description: 'việc thật', hours_before: 2, hours_after: 1, ai_check: 'đã kiểm', reuse_template: 'mẫu' };
const EXERCISES = [
  Object.assign({ exercise_id: 'EX-0001', title: 'Bài của tôi Đạt', prompt: 'p', owner_email: 'user01', owner_name: 'User Test', team: 'BL', week: '2026-W40', review_status: 'Đạt', review_criteria: '1,2,3,4' }, FULL),
  { exercise_id: 'EX-0002', title: 'Bài của tôi Chưa đạt', description: 'x', prompt: 'p', owner_email: 'user01', owner_name: 'User Test', team: 'BL', week: '2026-W41', review_status: 'Chưa đạt' },
  { exercise_id: 'EX-0003', title: 'Bài của tôi thiếu ô', description: 'x', prompt: 'p', owner_email: 'user01', owner_name: 'User Test', team: 'BL', week: '2026-W41', review_status: '' },
  Object.assign({ exercise_id: 'EX-0004', title: 'Bài A2', prompt: 'p', owner_email: 'a2', owner_name: 'Thành viên A2', team: 'CV', week: '2026-W41', review_status: '' }, FULL),
  // không có owner_name → nhãn lấy họ tên từ danh bạ learning-list
  Object.assign({ exercise_id: 'EX-0005', title: 'Bài A3', prompt: 'p', owner_email: 'a3', team: 'CV', week: '2026-W41', review_status: '' }, FULL),
];

async function mock(page) {
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__gasCb_test';
    let data = null;
    if (action === 'learning-list') data = DATA;
    else if (action === 'exercise-list') data = EXERCISES;
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})` });
  });
}

async function open(page, tab) {
  await page.goto('/index.html#learning-plan' + (tab ? '/' + tab : ''));
  await page.waitForFunction(() => window._learningPlan && window._learningPlan.members.length > 0 && window._exercises && window._exercises.length > 0, { timeout: 10000 });
}
const opts = (page, id) => page.locator('#' + id + ' option');

test.describe('Bộ lọc chuẩn Team + Nhân sự + nút sửa bài ở bảng tuần (CR 2026-10-16)', () => {
  test.setTimeout(30000);
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-14T09:00:00+07:00'));
    await setSession(page, ME);
    await mock(page);
  });

  test('T01 — PeopleFilter.label: "Username-Họ tên", thiếu tên → Username', async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => [PeopleFilter.label('tuantt4', 'Trần Thế Tuân'), PeopleFilter.label('a2', ''), PeopleFilter.label('a2', 'a2')]);
    expect(r).toEqual(['Tuantt4-Trần Thế Tuân', 'A2', 'A2']);
  });

  test('T02 — Thư viện: lọc team → nhân sự thu hẹp; lọc người; nhãn lấy họ tên từ danh bạ khi bài thiếu', async ({ page }) => {
    await open(page, 'library');
    await expect(page.locator('#exList .dash-card')).toHaveCount(5);
    await expect(opts(page, 'exTeamFilter')).toHaveText(['Tất cả team', 'BL', 'CV']);
    await expect(opts(page, 'exUserFilter')).toHaveText(['Tất cả nhân sự', 'A2-Thành viên A2', 'A3-Thành viên A3', 'User01-User Test']);
    await page.selectOption('#exTeamFilter', 'cv');
    await expect(page.locator('#exList .dash-card')).toHaveCount(2);
    await expect(opts(page, 'exUserFilter')).toHaveText(['Tất cả nhân sự', 'A2-Thành viên A2', 'A3-Thành viên A3']);
    await page.selectOption('#exUserFilter', 'a3');
    await expect(page.locator('#exList .dash-card')).toHaveCount(1);
    await expect(page.locator('#exList')).toContainText('Bài A3');
    // đổi team khác → người đang chọn không thuộc team → về "Tất cả nhân sự"
    await page.selectOption('#exTeamFilter', 'bl');
    await expect(page.locator('#exUserFilter')).toHaveValue('');
    await expect(page.locator('#exList .dash-card')).toHaveCount(3);
  });

  test('T03 — Theo dõi: lọc team + nhân sự áp cả ma trận tuần và bảng khóa học', async ({ page }) => {
    await open(page, 'tracking');
    await expect(opts(page, 'lpTeamFilter')).toHaveText(['Tất cả team', 'BL', 'CV']);
    await page.selectOption('#lpUserFilter', 'a2');
    await expect(page.locator('#lpWeekMatrix tbody tr')).toHaveCount(1);
    await expect(page.locator('#lpWeekMatrix tbody')).toContainText('Thành viên A2');
    await expect(page.locator('#lpTable tbody tr')).toHaveCount(1);
    await expect(page.locator('#lpTable tbody')).toContainText('Khóa A');
    await page.selectOption('#lpUserFilter', '');
    await page.selectOption('#lpTeamFilter', 'CV');      // chọn theo nhãn vẫn được (test cũ)
    await expect(page.locator('#lpWeekMatrix tbody tr')).toHaveCount(2);
  });

  test('T04 — Việc lớn: lọc team; lọc nhân sự khớp người làm chính hoặc được giao hạng mục', async ({ page }) => {
    await open(page, 'bigtasks');
    await expect(page.locator('#lpBigTasks tbody tr')).toHaveCount(2);
    await expect(page.locator('#btCount')).toHaveText('2/2 việc lớn');
    await page.selectOption('#btTeamFilter', 'cv');
    await expect(page.locator('#lpBigTasks tbody tr')).toHaveCount(1);
    await expect(page.locator('#lpBigTasks')).toContainText('Việc lớn CV');
    await page.selectOption('#btTeamFilter', '');
    await page.selectOption('#btUserFilter', 'user01');  // được giao AS-1 của VL-07
    await expect(page.locator('#lpBigTasks tbody tr')).toHaveCount(1);
    await expect(page.locator('#lpBigTasks tbody tr')).toHaveAttribute('data-task', 'VL-07');
  });

  test('T05 — Bảng tuần: mọi bài của mình có nút sửa đúng loại; bài Đạt hỏi xác nhận trước khi mở form', async ({ page }) => {
    await open(page);
    const btn = (id) => page.locator('#lpMyWeeks [data-edit-ex="' + id + '"]');
    await expect(btn('EX-0001')).toHaveAttribute('data-edit-kind', 'pass');
    await expect(btn('EX-0001')).toHaveText('Sửa');
    await expect(btn('EX-0002')).toHaveText('Sửa để chấm lại');
    await expect(btn('EX-0003')).toHaveText('Bổ sung');
    // Chưa đạt → mở thẳng form sửa
    await btn('EX-0002').click();
    await expect(page.locator('#exFormTitle')).toHaveText('Sửa bài tập EX-0002');
    await page.locator('#exCancelBtn').click();
    // Đạt → hỏi xác nhận; Hủy thì không mở form, "Vẫn sửa" thì mở
    await btn('EX-0001').click();
    await expect(page.locator('#uiConfirmTitle')).toHaveText('Sửa bài đã Đạt');
    await page.locator('[data-uic="cancel"].btn').click();
    await expect(page.locator('#exFormTitle')).toHaveText('Nộp bài tuần này');
    await btn('EX-0001').click();
    await page.locator('[data-uic="ok"]').click();
    await expect(page.locator('#exFormTitle')).toHaveText('Sửa bài tập EX-0001');
    await expect(page.locator('#exCriteriaStatus')).toContainText('Đủ 4/4');
  });
});
