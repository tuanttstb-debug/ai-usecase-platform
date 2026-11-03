// @ts-check
// 22-next-id.spec.js — lỗi 03/11 (hub AIUS-001 D102): _nextScoreId_ chỉ đọc cột Score_ID → mọi claim lan tỏa
// đều ra SC-0001 (SHARING_CLAIM dùng Claim_ID) + Display_Name = username khi gọi route không token.
// Chạy THẲNG code GAS (Utils.gs + ScoringServiceH2.gs + SelfScoreService.gs) trong Node vm. Tên người HƯ CẤU.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAS = path.join(__dirname, '..', 'assets', 'gas-backend');
function load() {
  const ctx = vm.createContext({});
  ['Config.gs', 'Utils.gs', 'ScoringServiceH2.gs', 'SelfScoreService.gs']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(GAS, f), 'utf8'), ctx, { filename: f }));
  return ctx;
}
const G = load();

test.describe('_nextScoreId_ — đọc đúng cột ID', () => {
  test('mặc định Score_ID (PS/CS giữ nguyên hành vi)', () => {
    expect(G._nextScoreId_([{ Score_ID: 'PS-0007' }, { Score_ID: 'PS-0002' }], 'PS')).toBe('PS-0008');
    expect(G._nextScoreId_([], 'CS')).toBe('CS-0001');
  });
  test('Claim_ID: đã có SC-0004 → SC-0005 (trước sửa ra SC-0001)', () => {
    const rows = ['SC-0001', 'SC-0002', 'SC-0003', 'SC-0004'].map((id) => ({ Claim_ID: id }));
    expect(G._nextScoreId_(rows, 'SC', 'Claim_ID')).toBe('SC-0005');
  });
  test('Reuse_ID / Self_ID', () => {
    expect(G._nextScoreId_([{ Reuse_ID: 'RZ-0003' }], 'RZ', 'Reuse_ID')).toBe('RZ-0004');
    expect(G._nextScoreId_([{ Self_ID: 'SS-0001' }], 'SS', 'Self_ID')).toBe('SS-0002');
  });
  test('bỏ qua ID khác tiền tố / sai dạng', () => {
    expect(G._nextScoreId_([{ Claim_ID: 'XX-0009' }, { Claim_ID: 'SC-abc' }, { Claim_ID: ' SC-0002 ' }], 'SC', 'Claim_ID')).toBe('SC-0003');
  });
  test('mọi chỗ gọi trên sheet có cột ID riêng đều truyền idField', () => {
    const src = ['ScoringServiceH2.gs', 'SelfScoreService.gs'].map((f) => fs.readFileSync(path.join(GAS, f), 'utf8')).join('\n');
    ['SC', 'RZ', 'SS'].forEach((p) => {
      const calls = src.match(new RegExp("_nextScoreId_\\(all, '" + p + "'[^)]*\\)", 'g')) || [];
      expect(calls.length).toBeGreaterThan(0);
      calls.forEach((c) => expect(c).toMatch(/, '(Claim_ID|Reuse_ID|Self_ID)'\)$/));
    });
  });
});

test.describe('_memberInfo_ — họ tên khi gọi không token', () => {
  const users = [{ username: 'tv.a', display_name: 'Thành viên A', team: 'Đội X' }];
  test.beforeEach(() => { G.getAllUsersFromMaster_ = () => users; });

  test('displayName = username → tra User_Master lấy họ tên + team', () => {
    const info = G._memberInfo_({ username: 'tv.a', displayName: 'tv.a', team: '' }, {});
    expect(info).toEqual({ team: 'Đội X', disp: 'Thành viên A' });
  });
  test('có token (displayName là họ tên) → giữ nguyên', () => {
    const info = G._memberInfo_({ username: 'tv.a', displayName: 'Tên Trên Token', team: 'Đội Y' }, {});
    expect(info).toEqual({ team: 'Đội Y', disp: 'Tên Trên Token' });
  });
  test('không có trong User_Master → về username', () => {
    const info = G._memberInfo_({ username: 'la.b', displayName: 'la.b', team: '' }, {});
    expect(info.disp).toBe('la.b');
  });
});
