// 10-idempotency.spec.js — Round 2 T2: chống timeout/mất/trùng khi ghi.
// Kiểm hành vi CLIENT (api.js): (1) Req_ID được gửi trong payload; (2) khi lỗi
// transport, retry dùng LẠI cùng Req_ID (server dedup → không trùng); (3) KHÔNG
// có Req_ID → KHÔNG retry (giữ hành vi an toàn cũ). Dedup phía server test riêng
// bằng hàm GAS testIdempotency() (chạy trong GAS Editor).
const { test, expect } = require('@playwright/test');
const { setSession, mockGAS, ADMIN_USER } = require('./helpers');

// Giải mã payload base64url (GET ?payload=…) → object, để đọc Req_ID trong route.
function decodePayload(b64url) {
  if (!b64url) return {};
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try { return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); }
  catch (_e) { return {}; }
}

async function gotoRegister(page) {
  await setSession(page, ADMIN_USER);
  await mockGAS(page, {});               // baseline: mọi action trả rỗng an toàn
  await page.goto('/register.html');
  await page.waitForLoadState('networkidle');
}

test('T01: create gửi kèm Req_ID trong payload', async ({ page }) => {
  await gotoRegister(page);
  const seen = [];
  // Override route riêng cho action=create để bắt payload.
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__cb';
    if (action === 'create') {
      const body = decodePayload(url.searchParams.get('payload'));
      seen.push(body.Req_ID || null);
      await route.fulfill({ status: 200, contentType: 'application/javascript',
        body: `${cb}({"success":true,"data":{"record_id":"REC-NEW","usecase_id":"AIUS-9999"},"message":"ok"})` });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/javascript',
        body: `${cb}({"success":true,"data":null,"message":"ok"})` });
    }
  });

  const res = await page.evaluate(async () => {
    return await Api.createUseCase({
      UseCase_ID: 'AIUS-9999', UseCase_Name: 'Test', Owner_Email: 'x@y.z', Owner_Name: 'X',
      Req_ID: 'req-fixed-001'
    });
  });
  expect(res.usecase_id).toBe('AIUS-9999');
  expect(seen).toContain('req-fixed-001');
});

test('T02: lỗi transport + có Req_ID → RETRY cùng Req_ID rồi thành công', async ({ page }) => {
  await gotoRegister(page);
  let calls = 0;
  const reqIds = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__cb';
    if (action === 'create') {
      calls++;
      reqIds.push(decodePayload(url.searchParams.get('payload')).Req_ID || null);
      if (calls === 1) { await route.abort(); return; }   // lần 1: script.onerror (transient)
      await route.fulfill({ status: 200, contentType: 'application/javascript',
        body: `${cb}({"success":true,"data":{"record_id":"REC-NEW","usecase_id":"AIUS-9999"},"message":"ok"})` });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/javascript',
        body: `${cb}({"success":true,"data":null,"message":"ok"})` });
    }
  });

  const res = await page.evaluate(async () => {
    return await Api.createUseCase({
      UseCase_ID: 'AIUS-9999', UseCase_Name: 'Test', Owner_Email: 'x@y.z', Owner_Name: 'X',
      Req_ID: 'req-fixed-002'
    });
  });
  expect(calls).toBe(2);                       // đã retry đúng 1 lần
  expect(res.usecase_id).toBe('AIUS-9999');    // retry thành công
  expect(reqIds).toEqual(['req-fixed-002', 'req-fixed-002']); // CÙNG reqId → server dedup an toàn
});

test('T03: lỗi transport + KHÔNG Req_ID → KHÔNG retry (reject)', async ({ page }) => {
  await gotoRegister(page);
  let calls = 0;
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__cb';
    if (action === 'create') { calls++; await route.abort(); return; }
    await route.fulfill({ status: 200, contentType: 'application/javascript',
      body: `${cb}({"success":true,"data":null,"message":"ok"})` });
  });

  const outcome = await page.evaluate(async () => {
    try { await Api.createUseCase({ UseCase_ID: 'AIUS-1', UseCase_Name: 'T', Owner_Email: 'a@b.c', Owner_Name: 'A' }); return 'resolved'; }
    catch (e) { return 'rejected'; }
  });
  expect(outcome).toBe('rejected');
  expect(calls).toBe(1);                        // KHÔNG retry khi thiếu Req_ID
});

test('T04: update gửi kèm Req_ID + retry cùng Req_ID', async ({ page }) => {
  await gotoRegister(page);
  let calls = 0;
  const reqIds = [];
  await page.route('**/script.google.com/**', async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb = url.searchParams.get('callback') || '__cb';
    if (action === 'update') {
      calls++;
      reqIds.push(decodePayload(url.searchParams.get('payload')).Req_ID || null);
      if (calls === 1) { await route.abort(); return; }
      await route.fulfill({ status: 200, contentType: 'application/javascript',
        body: `${cb}({"success":true,"data":{"record_id":"REC-1","usecase_id":"AIUS-1"},"message":"ok"})` });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/javascript',
        body: `${cb}({"success":true,"data":null,"message":"ok"})` });
    }
  });

  const res = await page.evaluate(async () => {
    return await Api.updateUseCase({ Record_ID: 'REC-1', UseCase_Name: 'Sửa', Req_ID: 'req-upd-001' });
  });
  expect(calls).toBe(2);
  expect(res.record_id).toBe('REC-1');
  expect(reqIds).toEqual(['req-upd-001', 'req-upd-001']);
});
