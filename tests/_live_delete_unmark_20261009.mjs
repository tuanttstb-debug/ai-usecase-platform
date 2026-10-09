// Nghiệm thu LIVE vá 7d608de: xóa bài → gỡ mã khỏi dòng tuần BAI_TAP_TUAN (dùng bài [TEST], tự dọn).
import { call } from './_live_20261009.mjs';
const PM = 'tuantt4', WEEK = '2026-W41';
async function weekRow() {
  const d = (await call('learning-list')).data || {};
  return (d.weeks || []).find((w) => String(w.Username || w.username).toLowerCase() === PM && (w.Week || w.week) === WEEK);
}
const ids = (w) => w ? (w.Exercise_IDs || w.exercise_ids || '') : '(không có dòng)';
console.log('Trước:', ids(await weekRow()));
const c = await call('exercise-create', { Title: '[TEST] vá xóa bài 09/10', Prompt: 'test', Description: '[TEST] xóa ngay',
  Owner_Email: PM, Owner_Name: 'Trần Thế Tuân', Team: 'Số', requester_email: PM, Week: WEEK });
const id = c.data && c.data.exercise_id;
console.log('Tạo:', c.success !== false ? 'OK ' + id : 'FAIL ' + c.message);
console.log('Sau tạo:', ids(await weekRow()));
const x = await call('exercise-delete', { Exercise_ID: id, requester_email: PM });
console.log('Xóa:', x.success !== false ? 'OK' : 'FAIL ' + x.message);
const after = ids(await weekRow());
console.log('Sau xóa:', after, '→', after.includes(id) ? 'FAIL (mã còn)' : 'PASS (đã gỡ)');
