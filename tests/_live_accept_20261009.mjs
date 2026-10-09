// Nghiệm thu LIVE KPI D70–D72 (2026-10-09) — chỉ dùng dòng [TEST], tự dọn (xóa mềm) cuối lượt.
import { call } from './_live_20261009.mjs';
const R = [];
async function step(name, fn, expectErr) {
  try {
    const r = await fn();
    const ok = r && r.success !== false;
    if (expectErr) R.push([name, ok ? 'FAIL (không bị chặn)' : 'PASS (chặn: ' + (r.message || '').slice(0, 80) + ')']);
    else R.push([name, ok ? 'PASS' : 'FAIL: ' + (r && r.message)]);
    return r;
  } catch (e) { R.push([name, (expectErr ? 'PASS? lỗi mạng ' : 'FAIL ') + e.message]); }
}
const PM = 'tuantt4';
const ex = await step('E1 tạo bài [TEST] W41 + 4 ô', () => call('exercise-create', {
  Title: '[TEST] nghiệm thu D70 09/10', Prompt: 'test', Description: '[TEST] xóa sau nghiệm thu',
  Owner_Email: PM, Owner_Name: 'Trần Thế Tuân', Team: 'Số', requester_email: PM, Week: '2026-W41',
  Hours_Before: '2', Hours_After: '1', AI_Check: '[TEST]', Reuse_Template: '[TEST]', Big_Task_Ref: 'VL-05' }));
const exId = ex && ex.data && (ex.data.exercise_id || ex.data.Exercise_ID || ex.data.id);
R.push(['  → mã bài', String(exId)]);
await step('E2 chặn nộp tuần tương lai', () => call('exercise-create', { Title: '[TEST] x', Prompt: 'p', Owner_Email: PM, requester_email: PM, Week: '2026-W45' }), true);
if (exId) {
  await step('E3 chặn tự chấm bài mình', () => call('exercise-review', { Exercise_ID: exId, action: 'pass', Criteria: '1,2,3', reviewer_email: PM }), true);
  await step('E4 chặn member chấm (dunglq1)', () => call('exercise-review', { Exercise_ID: exId, action: 'pass', Criteria: '1,2,3', reviewer_email: 'dunglq1' }), true);
}
const kr = await step('K1 thêm số đo [TEST] VL-05 (10→5, thực tế 7)', () => call('big-task-kr-save', {
  Task_ID: 'VL-05', KR_Name: '[TEST] giờ soạn 1 bộ yêu cầu', Unit: 'giờ', Before_Value: '10', Target_Value: '5', Actual_Value: '7', reviewer_email: PM }));
const krId = kr && kr.data && kr.data.kr_id;
R.push(['  → KR / tỷ lệ', krId + ' / ' + (kr && kr.data && kr.data.ratio)]);
await step('K2 chặn member sửa số đo', () => call('big-task-kr-save', { Task_ID: 'VL-05', KR_Name: '[TEST] y', Before_Value: '1', Target_Value: '2', reviewer_email: 'dunglq1' }), true);
const as = await step('A1 giao hạng mục [TEST] cho dunglq1', () => call('big-task-assign-save', {
  Task_ID: 'VL-05', Username: 'dunglq1', Item: '[TEST] hạng mục nghiệm thu', Due_Date: '2026-10-16', reviewer_email: PM }));
const aId = as && as.data && as.data.assign_id;
if (aId) await step('A2 nghiệm thu Đạt', () => call('big-task-assign-save', { Task_ID: 'VL-05', Assign_ID: aId, Status: 'Đạt', reviewer_email: PM }));
const lb = await step('L1 leaderboard đọc được sau ghi', () => call('kpi-leaderboard'));
const d = (lb && lb.data) || {};
const dung = (d.member_ranking || []).find((m) => m.username === 'dunglq1');
R.push(['  → dunglq1 m1 khi có [TEST]', dung ? String(dung.m1) : '—']);
// Dọn
if (aId) await step('X1 xóa mềm hạng mục', () => call('big-task-assign-save', { Task_ID: 'VL-05', Assign_ID: aId, Delete: 'true', reviewer_email: PM }));
if (krId) await step('X2 xóa mềm số đo', () => call('big-task-kr-save', { Task_ID: 'VL-05', KR_ID: krId, Delete: 'true', reviewer_email: PM }));
if (exId) await step('X3 xóa mềm bài [TEST]', () => call('exercise-delete', { Exercise_ID: exId, requester_email: PM }));
const lb2 = await call('kpi-leaderboard');
const dung2 = ((lb2.data || {}).member_ranking || []).find((m) => m.username === 'dunglq1');
R.push(['  → dunglq1 m1 sau dọn', dung2 ? String(dung2.m1) : '—']);
for (const [a, b] of R) console.log(a.padEnd(42), b);
