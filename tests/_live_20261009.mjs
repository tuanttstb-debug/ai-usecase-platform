// _live_20261009.mjs — nghiệm thu LIVE KPI D70–D72 sau redeploy GAS (2026-10-09).
// node tests/_live_20261009.mjs read            → chỉ đọc
// node tests/_live_20261009.mjs call <action> '<json payload>'  → gọi 1 route (ghi) — chỉ dùng cho dòng [TEST]
import fs from 'node:fs';
const env = fs.readFileSync(new URL('../config/env.js', import.meta.url), 'utf8');
const BASE = env.match(/API_BASE_URL:\s*'([^']+)'/)[1];

function enc(obj) { return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export async function call(action, payload, extra = '') {
  let url = `${BASE}?action=${action}${extra}&callback=cb`;
  if (payload) url += '&payload=' + enc(payload);
  const res = await fetch(url, { redirect: 'follow' });
  const txt = await res.text();
  const m = txt.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
  return JSON.parse(m ? m[1] : txt);
}

const [, , mode, action, json] = process.argv;
if (mode === 'read') {
  const lp = await call('learning-list');
  const d = lp.data || lp;
  console.log('learning-list ok=', lp.success !== false, '| keys:', Object.keys(d).join(','));
  console.log('  krs' in d ? '' : '  ⚠ thiếu krs', 'assigns' in d ? '' : '  ⚠ thiếu assigns');
  const lb = await call('kpi-leaderboard');
  const L = lb.data || lb;
  console.log('kpi-leaderboard ok=', lb.success !== false, '| members:', (L.member_ranking || []).length, '| teamleads:', (L.teamlead_ranking || []).length);
  const me = (L.member_ranking || []).find((m) => m.username === 'tuantt4');
  console.log('  tuantt4:', me ? JSON.stringify({ m1: me.m1, m2: me.m2, m3: me.m3, m4: me.m4, final: me.final }) : 'không có');
  const tl = (L.teamlead_ranking || [])[0];
  console.log('  teamlead mẫu:', tl ? Object.keys(tl).join(',') : '—');
  const ex = await call('exercise-list');
  const rows = (ex.data || ex) || [];
  const mine = (Array.isArray(rows) ? rows : rows.items || []).filter((r) => /EX-002[45]/.test(r.Exercise_ID || r.exercise_id || ''));
  console.log('exercise-list:', Array.isArray(rows) ? rows.length : '?', '| EX-0024/25 fields:', mine[0] ? Object.keys(mine[0]).join(',') : 'không thấy');
} else if (mode === 'call') {
  console.log(JSON.stringify(await call(action, JSON.parse(json || 'null')), null, 1).slice(0, 3000));
}
