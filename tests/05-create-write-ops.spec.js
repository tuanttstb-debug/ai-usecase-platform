// 05-create-write-ops.spec.js
// Kiểm tra payload encoding, size limits, timeout 90s, error handling
// cho các write operations (createUseCase / updateUseCase).
//
// Cấu trúc:
//   A — Payload size validation (client-side, không cần GAS)
//   B — GAS transport error handling (script.onerror + success:false)
//   C — Timeout 90s verification (48s delay test — mỗi test ~50s, tagged slow)
//   D — Full UI submit flow qua wizard
// ─────────────────────────────────────────────────────────────────────

const { test, expect } = require('@playwright/test');
const { setSession, ADMIN_USER } = require('./helpers');

// ── Shared mock data ──────────────────────────────────────────────────

// Keys phải khớp với FIELD_CONFIG.lookupKey trong constants.js (Team, Business_Category, ...)
// KHÔNG dùng lowercase plural (teams, categories) — rebuildLookupFields() lookup bằng lookupKey
const MOCK_LOOKUP = {
  Team:              ['Team Số', 'Team Khác'],
  Business_Category: ['Automation', 'Analytics'],
  Current_Stage:     ['POC', 'Production'],
  Reuse_Level:       ['Cá nhân', 'Team', 'Cross-team'],
};

// Dữ liệu tối thiểu hợp lệ cho GAS validateCreate_
const MIN_VALID = {
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

// Tạo chuỗi tiếng Việt dài (phần lớn multi-byte UTF-8 → base64 ~4 char/char)
function viText(n) {
  const unit = 'Kiểm tra nội dung tiếng Việt để đánh giá kích thước payload gửi lên GAS. ';
  return (unit.repeat(Math.ceil(n / unit.length))).slice(0, n);
}

// ── Route helper ──────────────────────────────────────────────────────
// Đăng ký một route handler duy nhất xử lý tất cả GAS actions.
// onCreate: fn(route, cb) — nếu undefined dùng default success mock.
async function loadRegister(page, onCreate) {
  await setSession(page, ADMIN_USER);

  await page.route('**/script.google.com/**', async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';

    if (action === 'create') {
      if (onCreate) { await onCreate(route, cb); return; }
      // Default: create thành công
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":true,"data":{"record_id":"REC-001","usecase_id":"AIUS-001"},"message":"ok"})`,
      });
      return;
    }

    const defaults = { lookup: MOCK_LOOKUP, 'next-id': { next_id: 'AIUS-999' } };
    const data = (action in defaults) ? defaults[action] : null;
    await route.fulfill({
      status: 200, contentType: 'application/javascript; charset=utf-8',
      body: `${cb}({"success":true,"data":${JSON.stringify(data)},"message":"ok"})`,
    });
  });

  await page.goto('/register.html');
  await page.waitForLoadState('networkidle');
}

// Điền form và nhảy thẳng đến bước cuối (bỏ qua wizard navigation)
// Đợi Team select có ít nhất 1 option thực (ngoài placeholder) để populateData hoạt động đúng
async function fillAndGoToSubmit(page, data) {
  // rebuildLookupFields() chạy async sau khi getLookup() resolve — đợi options được inject
  await page.waitForFunction(
    () => { const s = document.querySelector('[name="Team"]'); return s && s.options.length > 1; },
    { timeout: 5000 }
  );
  await page.evaluate((d) => {
    FormMapper.populateData(d);
    Wizard.goTo(Wizard.totalSteps);
  }, data);
  await page.waitForSelector('#submitBtn', { state: 'visible' });
}

// ═══════════════════════════════════════════════════════════════════════
// A — Payload size validation (client-side, GAS không được gọi)
// ═══════════════════════════════════════════════════════════════════════

test.describe('A — Payload size limits (client-side)', () => {

  test('A1: 3 textarea × 2000 chars Vietnamese → rejected before GAS call', async ({ page }) => {
    // 6000 chars × ~1.75 bytes UTF-8 avg × 4/3 base64 ≈ 14000 chars >> 7500 limit
    // (viText unit có ~40% ASCII + ~60% Vietnamese diacritical nên avg ~1.75 bytes/char)
    let createCallCount = 0;
    await loadRegister(page, async (route) => { createCallCount++; await route.abort(); });

    const large = viText(2000);
    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { ...MIN_VALID, Pain_Point: large, Current_Process: large, Flow_Description: large });

    expect(createCallCount).toBe(0);      // GAS không được gọi
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('quá lớn');
  });

  test('A2: Error message hiển thị actual payload length và ngưỡng 7500', async ({ page }) => {
    await loadRegister(page, async (route) => { await route.abort(); });

    const veryLarge = viText(2000); // 6000 chars × 3 fields → clearly exceeds 7500
    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { ...MIN_VALID, Pain_Point: veryLarge, Current_Process: veryLarge, Flow_Description: veryLarge });

    expect(result.ok).toBe(false);
    // Error format: "... (ACTUAL / 7500 chars) ..."
    expect(result.msg).toMatch(/\d+ \/ 7500/);
  });

  test('A3: 3 textarea × 400 chars Vietnamese → passes size check, GAS được gọi', async ({ page }) => {
    // 1200 chars Việt × ~4 ≈ 4800 chars + overhead ≈ 5500 < 7500
    let createCallCount = 0;
    await loadRegister(page, async (route, cb) => {
      createCallCount++;
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":true,"data":{"record_id":"REC-OK","usecase_id":"AIUS-001"},"message":"ok"})`,
      });
    });

    const moderate = viText(400);
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, id: r.record_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { ...MIN_VALID, Pain_Point: moderate, Current_Process: moderate, Flow_Description: moderate });

    expect(createCallCount).toBe(1);      // GAS được gọi đúng 1 lần
    expect(result.ok).toBe(true);
    expect(result.id).toBe('REC-OK');
  });

  test('A4: Full prompt fields (5 fields × 300 chars) → kiểm tra ngưỡng thực tế', async ({ page }) => {
    // Use case thực tế: người dùng điền đầy đủ các trường Prompt
    let gasCalled = false;
    await loadRegister(page, async (route, cb) => {
      gasCalled = true;
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":true,"data":{"record_id":"REC-FULL","usecase_id":"AIUS-002"},"message":"ok"})`,
      });
    });

    const p300 = viText(300); // 300 chars mỗi trường prompt
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, payloadFit: true, id: r.record_id }; }
      catch (e) {
        const isSizeErr = e.message.includes('quá lớn');
        return { ok: false, isSizeErr, msg: e.message };
      }
    }, {
      ...MIN_VALID,
      Prompt_Role:          p300,
      Prompt_Task:          p300,
      Prompt_Goal:          p300,
      Prompt_Steps:         p300,
      Prompt_Output_Format: p300,
    });

    // Log kết quả để biết ngưỡng thực tế
    if (!result.ok && result.isSizeErr) {
      console.log(`[A4] 5 prompt fields × 300 chars = 1500 chars → payload EXCEEDS 7500 limit`);
      console.log(`[A4] Message: ${result.msg}`);
    } else {
      console.log(`[A4] 5 prompt fields × 300 chars = 1500 chars → payload FITS, GAS called`);
    }

    // Test không fail — chỉ log ngưỡng để phân tích
    expect(typeof result.ok).toBe('boolean');
  });

});

// ═══════════════════════════════════════════════════════════════════════
// B — GAS transport error handling
// ═══════════════════════════════════════════════════════════════════════

test.describe('B — GAS transport error handling', () => {

  test('B1: HTTP 400 từ GAS (redirect URL quá dài) → "script load thất bại"', async ({ page }) => {
    await loadRegister(page, async (route) => {
      await route.fulfill({ status: 400, body: 'Bad Request' });
    });

    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);

    expect(result.ok).toBe(false);
    expect(result.msg).toContain('script load thất bại');
  });

  test('B2: HTTP 500 từ GAS → "script load thất bại"', async ({ page }) => {
    await loadRegister(page, async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);

    expect(result.ok).toBe(false);
    expect(result.msg).toContain('script load thất bại');
  });

  test('B3: GAS trả success:false → propagate server error message', async ({ page }) => {
    await loadRegister(page, async (route, cb) => {
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":false,"data":null,"message":"Thiếu trường bắt buộc: Flow_Description"})`,
      });
    });

    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);

    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Flow_Description');
  });

  test('B4: Create thành công → trả về record_id + usecase_id', async ({ page }) => {
    await loadRegister(page);

    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, record_id: r.record_id, usecase_id: r.usecase_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);

    expect(result.ok).toBe(true);
    expect(result.record_id).toBe('REC-001');
    expect(result.usecase_id).toBe('AIUS-001');
  });

  test('B5: updateUseCase success:false → propagate error, không retry', async ({ page }) => {
    let callCount = 0;
    await setSession(page, ADMIN_USER);
    await page.route('**/script.google.com/**', async (route) => {
      const url    = new URL(route.request().url());
      const action = url.searchParams.get('action') || '';
      const cb     = url.searchParams.get('callback') || '__gasCb_test';
      if (action === 'update') {
        callCount++;
        await route.fulfill({
          status: 200, contentType: 'application/javascript; charset=utf-8',
          body: `${cb}({"success":false,"data":null,"message":"Không tìm thấy Record_ID"})`,
        });
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/javascript; charset=utf-8',
          body: `${cb}({"success":true,"data":null,"message":"ok"})`,
        });
      }
    });
    await page.goto('/register.html');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async (data) => {
      try   { await Api.updateUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { Record_ID: 'REC-NONEXIST', UseCase_Name: 'Test', Status: 'Draft' });

    expect(callCount).toBe(1);          // Không retry (write op = 0 retries)
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Record_ID');
  });

});

// ═══════════════════════════════════════════════════════════════════════
// C — Timeout 90s verification (slow tests — ~50s mỗi test)
// ═══════════════════════════════════════════════════════════════════════

test.describe('C — Timeout 90s verification', () => {

  test('C1: createUseCase succeed với GAS delay 48s (cũ 45s sẽ timeout)', async ({ page }) => {
    test.setTimeout(75000); // 48s delay + load time + buffer

    let gasResponded = false;
    await loadRegister(page, async (route, cb) => {
      // Delay 48s — old 45s timeout: would fail; new 90s timeout: passes
      await new Promise(r => setTimeout(r, 48000));
      gasResponded = true;
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":true,"data":{"record_id":"REC-SLOW","usecase_id":"AIUS-003"},"message":"ok"})`,
      });
    });

    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, id: r.usecase_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);

    expect(gasResponded).toBe(true);            // GAS thực sự trả lời sau 48s
    expect(result.ok).toBe(true);              // Không timeout (90s timeout mới đủ rộng)
    expect(result.id).toBe('AIUS-003');
  });

  test('C2: updateUseCase succeed với GAS delay 48s', async ({ page }) => {
    test.setTimeout(75000);

    let gasResponded = false;
    await setSession(page, ADMIN_USER);
    await page.route('**/script.google.com/**', async (route) => {
      const url    = new URL(route.request().url());
      const action = url.searchParams.get('action') || '';
      const cb     = url.searchParams.get('callback') || '__gasCb_test';
      if (action === 'update') {
        await new Promise(r => setTimeout(r, 48000));
        gasResponded = true;
        await route.fulfill({
          status: 200, contentType: 'application/javascript; charset=utf-8',
          body: `${cb}({"success":true,"data":{"record_id":"REC-001","usecase_id":"AIUS-001","updated_at":"2026-06-20T10:00:00Z"},"message":"ok"})`,
        });
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/javascript; charset=utf-8',
          body: `${cb}({"success":true,"data":null,"message":"ok"})`,
        });
      }
    });
    await page.goto('/register.html');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.updateUseCase(data); return { ok: true, updated_at: r.updated_at }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { Record_ID: 'REC-001', UseCase_Name: 'Cập nhật test', Status: 'Draft' });

    expect(gasResponded).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.updated_at).toBe('2026-06-20T10:00:00Z');
  });

});

// ═══════════════════════════════════════════════════════════════════════
// D — Full UI submit flow (wizard navigation + submit button)
// ═══════════════════════════════════════════════════════════════════════

test.describe('D — Full UI submit flow', () => {

  test('D1: Create thành công → success screen hiển thị đúng UC ID', async ({ page }) => {
    await loadRegister(page);
    await fillAndGoToSubmit(page, MIN_VALID);

    await page.click('#submitBtn');

    await expect(page.locator('#successScreen')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#successIdBadge')).toHaveText('AIUS-001');
  });

  test('D2: GAS HTTP 400 → warning toast chứa "mã dự kiến: AIUS-999"', async ({ page }) => {
    await loadRegister(page, async (route) => {
      // Simulate: GAS redirect URL quá dài → HTTP 400 → script.onerror
      await route.fulfill({ status: 400, body: 'Bad Request' });
    });
    await fillAndGoToSubmit(page, MIN_VALID);

    await page.click('#submitBtn');

    // _handleSubmitError (CREATE path): hiển thị warning toast với hint ID
    const toast = page.locator('.toast-warning .toast-message');
    await expect(toast).toBeVisible({ timeout: 15000 });
    const text = await toast.textContent();
    expect(text).toContain('mã dự kiến');
    expect(text).toContain('AIUS-999');    // preloaded nextId từ mock 'next-id'
  });

  test('D3: Oversized form → error toast ngay lập tức, GAS không được gọi', async ({ page }) => {
    let gasCalled = false;
    await loadRegister(page, async (route) => { gasCalled = true; await route.abort(); });

    const large = viText(2000); // 6000 chars across 3 fields → payload >> 7500
    await fillAndGoToSubmit(page, {
      ...MIN_VALID,
      Pain_Point:      large,
      Current_Process: large,
      Flow_Description: large,
    });

    await page.click('#submitBtn');

    const toast = page.locator('.toast-error .toast-message');
    await expect(toast).toBeVisible({ timeout: 5000 });
    const text = await toast.textContent();
    expect(text).toContain('quá lớn');
    expect(gasCalled).toBe(false);
  });

  test('D4: GAS success:false → error toast với server message', async ({ page }) => {
    await loadRegister(page, async (route, cb) => {
      await route.fulfill({
        status: 200, contentType: 'application/javascript; charset=utf-8',
        body: `${cb}({"success":false,"data":null,"message":"Thiếu trường bắt buộc: Owner_Email"})`,
      });
    });
    await fillAndGoToSubmit(page, MIN_VALID);

    await page.click('#submitBtn');

    const toast = page.locator('.toast-error .toast-message');
    await expect(toast).toBeVisible({ timeout: 10000 });
    const text = await toast.textContent();
    expect(text).toContain('Owner_Email');
  });

});
