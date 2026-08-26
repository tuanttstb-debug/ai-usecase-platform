// 05-create-write-ops.spec.js
// Write operations (createUseCase / updateUseCase) — transport v3.16.0 (HYBRID).
//
// Bối cảnh sửa lỗi CR#1 (đăng ký US "timeout giả" + không ghi được):
//   v3.15.0 ép create/update qua hidden-iframe POST — KHÔNG đọc được response nên MỌI
//   lỗi ghi phía server (validate/lock/…) bị che thành "Timeout" và US không được ghi.
//   v3.16.0 (HYBRID): ƯU TIÊN GET-JSONP (đọc được success/lỗi THẬT của GAS) cho đa số US;
//   CHỈ fallback iframe-POST khi payload > 7500 (link demo dài) để giữ fix URL-limit.
//
// Cấu trúc:
//   A — Encode + ngưỡng 7500 cho đường GET-JSONP
//   B — Payload NHỎ → GET-JSONP (success trực tiếp + lỗi server surface RÕ, không "Timeout")
//   C — Payload LỚN (>7500) → iframe-POST + verify (success / timeout / slow / owner-mismatch)
//   D — Full UI submit flow
// ─────────────────────────────────────────────────────────────────────

const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

// ── Shared mock data ──────────────────────────────────────────────────
const MOCK_LOOKUP = {
  Team:              ['Team Số', 'Team Khác'],
  Business_Category: ['Automation', 'Analytics'],
  Current_Stage:     ['POC', 'Production'],
  Reuse_Level:       ['Cá nhân', 'Team', 'Cross-team'],
};

const MIN_VALID = {
  UseCase_ID:        'AIUS-999',            // FE luôn gán UseCase_ID trước khi create (v3.6.3)
  UseCase_Name:      'Tóm tắt tài liệu nghiệp vụ tự động',
  Owner_Name:        'Nguyễn Văn Test',
  Owner_Email:       'test@tpb.com.vn',
  Team:              'Team Số',
  Business_Category: 'Automation',
  Pain_Point:        'Tốn nhiều thời gian xử lý hồ sơ thủ công.',
  Current_Process:   'Đọc toàn bộ tài liệu và tóm tắt bằng tay.',
  Flow_Description:  'Dùng Gemini để tóm tắt tài liệu PDF và email.',
  Status:            'Submitted',
};

// Chuỗi tiếng Việt dài (đa số multi-byte UTF-8 → base64 ~4 char/char)
function viText(n) {
  const unit = 'Kiểm tra nội dung tiếng Việt để đánh giá kích thước payload gửi lên GAS. ';
  return (unit.repeat(Math.ceil(n / unit.length))).slice(0, n);
}

// Ép payload > 7500 (sau base64url) → buộc đi nhánh iframe-POST.
function bigify(data) {
  return Object.assign({}, data, {
    Pain_Point:       viText(2500),
    Current_Process:  viText(2500),
    Flow_Description: viText(2500),
  });
}

// ── Route helper ──────────────────────────────────────────────────────
// Xử lý mọi GAS action:
//   create/update + callback (GET-JSONP, payload nhỏ) → trả kết quả ghi trực tiếp
//   create/update KHÔNG callback (iframe-POST, payload lớn) → fulfill 200 opaque (không đọc)
//   usecase (verify GET)    → trả record theo opts.verify (null = GAS chưa ghi → verify fail)
//   lookup / next-id        → default
// opts:
//   verify:      object|null — record cho verify GET nhánh POST (default: matching record)
//   writeResult: object      — data trả cho GET-JSONP create/update (default REC-001/AIUS-999)
//   writeError:  string      — nếu set → GET-JSONP trả success:false + message này (mô phỏng lỗi server)
//   writeTimeout:number      — set window.__API_WRITE_TIMEOUT__ trước khi load trang
//   onWrite(route, action)   — custom cho create/update (vd giả lập HTTP 400)
async function loadRegister(page, opts) {
  opts = opts || {};
  await setSession(page, ADMIN_USER);

  if (opts.writeTimeout != null) {
    await page.addInitScript((t) => { window.__API_WRITE_TIMEOUT__ = t; }, opts.writeTimeout);
  }

  const counters = { create: 0, update: 0, usecase: 0, createGet: 0, createPost: 0 };

  await page.route('**/script.google.com/**', async (route) => {
    const req    = route.request();
    const url    = new URL(req.url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';
    const hasCb  = url.searchParams.has('callback');

    if (action === 'create' || action === 'update') {
      counters[action]++;
      if (opts.onWrite) { await opts.onWrite(route, action); return; }

      if (hasCb) {
        // Nhánh HYBRID GET-JSONP (payload nhỏ) — GAS trả kết quả ghi trực tiếp.
        if (action === 'create') counters.createGet++;
        const resp = ('writeError' in opts)
          ? { success: false, data: null, message: opts.writeError }
          : { success: true,
              data: opts.writeResult || { record_id: 'REC-001', usecase_id: 'AIUS-999' },
              message: 'ok' };
        await route.fulfill({
          status: 200, contentType: 'application/javascript; charset=utf-8',
          body: `${cb}(${JSON.stringify(resp)})`,
        });
        return;
      }
      // Nhánh iframe-POST (payload lớn) — nội dung response không được đọc.
      if (action === 'create') counters.createPost++;
      await route.fulfill({ status: 200, contentType: 'text/html', body: 'OK' });
      return;
    }

    if (action === 'usecase') {
      counters.usecase++;
      const id = url.searchParams.get('id') || '';
      // 'verify' === null → GAS chưa ghi (data:null) → verify thất bại
      const hasVerify = !('verify' in opts) || opts.verify !== null;
      const rec = hasVerify
        ? Object.assign(
            { Record_ID: 'REC-001', UseCase_ID: id || 'AIUS-999',
              Owner_Name: 'Nguyễn Văn Test', Owner_Email: 'test@tpb.com.vn' },
            opts.verify || {}
          )
        : null;
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}(${JSON.stringify({ success: true, data: rec, message: 'ok' })})`,
      });
      return;
    }

    const defaults = { lookup: MOCK_LOOKUP, 'next-id': { next_id: 'AIUS-999' } };
    const data = (action in defaults) ? defaults[action] : null;
    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}(${JSON.stringify({ success: true, data, message: 'ok' })})`,
    });
  });

  await page.goto('/register.html');
  await page.waitForLoadState('networkidle');
  return counters;
}

async function fillAndGoToSubmit(page, data) {
  await page.waitForFunction(
    () => { const s = document.querySelector('[name="Team"]'); return s && s.options.length > 1; },
    { timeout: 5000 }
  );
  await page.evaluate((d) => {
    FormMapper.populateData(d);
    // H2: UseCase_Name giờ là dependent select — route giá trị test qua cascade
    // (catalog mock rỗng → dùng nhánh "Khác — nhập tự do" bằng ô text tự do).
    if (typeof FieldBuilder !== 'undefined' && FieldBuilder.syncWorkflowSelection) {
      FieldBuilder.syncWorkflowSelection(d.Workflow || '', d.UseCase_Name || '');
    }
    Wizard.goTo(Wizard.totalSteps);
  }, data);
  await page.waitForSelector('#submitBtn', { state: 'visible' });
}

// ═══════════════════════════════════════════════════════════════════════
// A — Encode + ngưỡng 7500 cho đường GET-JSONP
// ═══════════════════════════════════════════════════════════════════════

test.describe('A — Encode & GET-path size limit', () => {

  test('A1: _encodePayload trả base64url (chỉ [A-Za-z0-9-_], không +/=)', async ({ page }) => {
    await loadRegister(page);
    const payload = await page.evaluate(() =>
      Api._encodePayload({ a: 'Tiếng Việt 🚀 <>&"', b: 12 })
    );
    expect(payload.length).toBeGreaterThan(0);
    expect(payload).toMatch(/^[A-Za-z0-9\-_]+$/); // không còn +, /, =
  });

  test('A2: duplicate-check (GET-JSONP) vẫn chặn payload > 7500 → "quá lớn"', async ({ page }) => {
    let gasCalled = false;
    await loadRegister(page, { onWrite: async () => { gasCalled = true; } });
    // duplicate-check đi qua _request (GET) → còn ngưỡng 7500
    const result = await page.evaluate(async (big) => {
      try   { await Api.duplicateCheck(big, big); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, viText(3000));
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('quá lớn');
    expect(gasCalled).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════════════
// B — Payload NHỎ → GET-JSONP (đường mặc định của đa số US)
// ═══════════════════════════════════════════════════════════════════════

test.describe('B — Small payload via GET-JSONP', () => {

  test('B1: create nhỏ → GET-JSONP trả record_id + usecase_id (KHÔNG cần verify)', async ({ page }) => {
    const counters = await loadRegister(page);
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, rid: r.record_id, uid: r.usecase_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);
    expect(result.ok).toBe(true);
    expect(result.rid).toBe('REC-001');
    expect(result.uid).toBe('AIUS-999');
    expect(counters.createGet).toBe(1);   // đi nhánh GET-JSONP
    expect(counters.createPost).toBe(0);  // KHÔNG dùng iframe-POST
    expect(counters.usecase).toBe(0);     // GET đọc được kết quả → không cần verify
  });

  test('B2: update nhỏ → GET-JSONP trả record', async ({ page }) => {
    const counters = await loadRegister(page, { writeResult: { record_id: 'REC-042', usecase_id: 'AIUS-042' } });
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.updateUseCase(data); return { ok: true, rid: r.record_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { Record_ID: 'REC-042', UseCase_Name: 'Cập nhật test', Status: 'Draft' });
    expect(result.ok).toBe(true);
    expect(result.rid).toBe('REC-042');
    expect(counters.update).toBe(1);
  });

  // ── CORE FIX CR#1: lỗi server phải hiện MESSAGE THẬT, không còn "Timeout" giả ──
  test('B3: create nhỏ mà GAS trả success:false → reject bằng MESSAGE THẬT (không "Timeout")', async ({ page }) => {
    await loadRegister(page, { writeError: 'Thiếu trường bắt buộc: Owner_Email' });
    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Owner_Email');   // message server thật
    expect(result.msg).not.toContain('Timeout');   // KHÔNG bị che thành timeout
  });

  test('B4: create nhỏ chỉ gọi GAS đúng 1 lần (không duplicate ghi)', async ({ page }) => {
    const counters = await loadRegister(page);
    await page.evaluate(async (data) => { try { await Api.createUseCase(data); } catch (e) {} }, MIN_VALID);
    expect(counters.create).toBe(1);
  });

});

// ═══════════════════════════════════════════════════════════════════════
// C — Payload LỚN (>7500) → iframe-POST + verify (giữ fix link demo dài)
// ═══════════════════════════════════════════════════════════════════════

test.describe('C — Large payload via POST + verify', () => {

  test('C1: create khổng lồ (link demo dài) → POST + verify success', async ({ page }) => {
    const counters = await loadRegister(page);
    const longDemo = 'https://drive.company.local/shared/' + viText(3000).replace(/\s/g, '-');
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, rid: r.record_id, uid: r.usecase_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, Object.assign(bigify(MIN_VALID), { Demo_Status: 'Đã có demo', Demo_Link: longDemo }));
    expect(result.ok).toBe(true);            // KHÔNG còn lỗi "quá lớn"
    expect(result.uid).toBe('AIUS-999');
    expect(counters.createPost).toBe(1);     // đi nhánh iframe-POST
    expect(counters.createGet).toBe(0);
    expect(counters.usecase).toBeGreaterThanOrEqual(1); // có verify GET
  });

  test('C2: POST nhưng GAS không ghi (verify=null) → reject "Timeout" sau writeTimeout', async ({ page }) => {
    test.setTimeout(20000);
    await loadRegister(page, { writeTimeout: 5000, verify: null });
    const result = await page.evaluate(async (data) => {
      const t0 = Date.now();
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message, ms: Date.now() - t0 }; }
    }, bigify(MIN_VALID));
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Timeout');
    expect(result.ms).toBeGreaterThanOrEqual(4500);
  });

  test('C3: POST verify chậm (2 lần null rồi có record) → cuối cùng resolve', async ({ page }) => {
    test.setTimeout(30000);
    await setSession(page, ADMIN_USER);
    await page.addInitScript(() => { window.__API_WRITE_TIMEOUT__ = 20000; });
    let usecaseHits = 0;
    await page.route('**/script.google.com/**', async (route) => {
      const url    = new URL(route.request().url());
      const action = url.searchParams.get('action') || '';
      const cb     = url.searchParams.get('callback') || '__gasCb_test';
      const hasCb  = url.searchParams.has('callback');
      if (action === 'create' && !hasCb) { await route.fulfill({ status: 200, contentType: 'text/html', body: 'OK' }); return; }
      if (action === 'usecase') {
        usecaseHits++;
        const rec = usecaseHits >= 3
          ? { Record_ID: 'REC-LATE', UseCase_ID: 'AIUS-999', Owner_Name: 'Nguyễn Văn Test' }
          : null;
        await route.fulfill({
          status: 200, contentType: 'application/javascript; charset=utf-8',
          body: `${cb}(${JSON.stringify({ success: true, data: rec, message: 'ok' })})`,
        });
        return;
      }
      const defaults = { lookup: MOCK_LOOKUP, 'next-id': { next_id: 'AIUS-999' } };
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}(${JSON.stringify({ success: true, data: (action in defaults) ? defaults[action] : null, message: 'ok' })})`,
      });
    });
    await page.goto('/register.html');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, rid: r.record_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, bigify(MIN_VALID));
    expect(result.ok).toBe(true);
    expect(result.rid).toBe('REC-LATE');
  });

  test('C4: POST verify owner mismatch → không nhận nhầm UC người khác → Timeout', async ({ page }) => {
    await loadRegister(page, {
      writeTimeout: 5000,
      verify: { Owner_Name: 'Người Khác', Owner_Email: 'other@x.vn' },
    });
    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, bigify(MIN_VALID));
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Timeout');
  });

});

// ═══════════════════════════════════════════════════════════════════════
// D — Full UI submit flow
// ═══════════════════════════════════════════════════════════════════════

test.describe('D — Full UI submit flow', () => {

  test('D1: Create nhỏ (GET-JSONP) → success screen hiển thị UC ID', async ({ page }) => {
    await loadRegister(page);
    await fillAndGoToSubmit(page, MIN_VALID);
    await page.click('#submitBtn');
    await expect(page.locator('#successScreen')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#successIdBadge')).toHaveText('AIUS-999');
  });

  test('D2: Link demo dài (ổ chung) → POST path → vẫn tạo thành công', async ({ page }) => {
    await loadRegister(page);
    const longDemo = '\\\\fileserver\\Thư mục Chung\\AI\\' + viText(1500).replace(/\s/g, '_');
    await fillAndGoToSubmit(page, Object.assign(bigify(MIN_VALID), {
      Demo_Status: 'Đã có demo', Demo_Link: longDemo,
    }));
    await page.click('#submitBtn');
    await expect(page.locator('#successScreen')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#successIdBadge')).toHaveText('AIUS-999');
  });

  test('D3: POST không xác nhận → warning toast chứa "mã dự kiến: AIUS-999"', async ({ page }) => {
    test.setTimeout(20000);
    await loadRegister(page, { writeTimeout: 6000, verify: null });
    await fillAndGoToSubmit(page, bigify(MIN_VALID));
    await page.click('#submitBtn');
    const toast = page.locator('.toast-warning .toast-message');
    await expect(toast).toBeVisible({ timeout: 12000 });
    const text = await toast.textContent();
    expect(text).toContain('mã dự kiến');
    expect(text).toContain('AIUS-999');
  });

  test('D4: Create nhỏ mà GAS báo lỗi → hiện MESSAGE THẬT (không "timeout")', async ({ page }) => {
    await loadRegister(page, { writeError: 'Thiếu trường bắt buộc: Owner_Email' });
    await fillAndGoToSubmit(page, MIN_VALID);
    await page.click('#submitBtn');
    const toast = page.locator('.toast-error .toast-message');
    await expect(toast).toBeVisible({ timeout: 10000 });
    const text = await toast.textContent();
    expect(text).toContain('Owner_Email');
  });

});
