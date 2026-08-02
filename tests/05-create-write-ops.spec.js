// 05-create-write-ops.spec.js
// Write operations (createUseCase / updateUseCase) — transport v3.15.0.
//
// v3.15.0: create/update KHÔNG còn đi qua GET-JSONP (giới hạn URL ~8KB) mà qua
// hidden-iframe FORM POST + verify bằng GET nhỏ. Mục tiêu: fix triệt để lỗi link demo
// dài (ổ chung/SharePoint) làm payload vượt URL limit → HTTP 400 khi tạo US.
//
// Cấu trúc:
//   A — Encode + giới hạn 7500 CHỈ còn áp cho đường GET-JSONP (duplicate-check…)
//   B — Create/Update qua POST + verify (success paths)
//   C — Transport timeout (verify không xác nhận) — dùng seam __API_WRITE_TIMEOUT__
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

// ── Route helper ──────────────────────────────────────────────────────
// Xử lý mọi GAS action:
//   create / update (POST)  → đếm + fulfill 200 (iframe không đọc nội dung)
//   usecase (verify GET)    → trả record theo opts.verify (null = GAS chưa ghi → verify fail)
//   lookup / next-id        → default
// opts:
//   verify:      object|null — record cho verify GET (default: matching record)
//   writeTimeout:number      — set window.__API_WRITE_TIMEOUT__ trước khi load trang
//   onWrite(route, action)   — custom cho create/update (vd giả lập HTTP 400)
async function loadRegister(page, opts) {
  opts = opts || {};
  await setSession(page, ADMIN_USER);

  if (opts.writeTimeout != null) {
    await page.addInitScript((t) => { window.__API_WRITE_TIMEOUT__ = t; }, opts.writeTimeout);
  }

  const counters = { create: 0, update: 0, usecase: 0 };

  await page.route('**/script.google.com/**', async (route) => {
    const req    = route.request();
    const url    = new URL(req.url());
    const action = url.searchParams.get('action') || '';
    const cb     = url.searchParams.get('callback') || '__gasCb_test';

    if (action === 'create' || action === 'update') {
      counters[action]++;
      if (opts.onWrite) { await opts.onWrite(route, action); return; }
      // iframe POST — nội dung response không được đọc; chỉ cần hoàn tất request
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
    Wizard.goTo(Wizard.totalSteps);
  }, data);
  await page.waitForSelector('#submitBtn', { state: 'visible' });
}

// ═══════════════════════════════════════════════════════════════════════
// A — Encode + giới hạn 7500 chỉ còn cho đường GET-JSONP
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

  test('A3: create payload KHỔNG LỒ (link demo dài) KHÔNG bị chặn client — đi POST + verify', async ({ page }) => {
    // Đây là ca lỗi cũ: link ổ chung dài + nhiều field Việt → vượt 7500 → create hỏng.
    // v3.15.0: create qua POST → không giới hạn → verify thành công.
    const counters = await loadRegister(page);
    const longDemo = 'https://drive.company.local/shared/' + viText(3000).replace(/\s/g, '-');
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, id: r.usecase_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, Object.assign({}, MIN_VALID, {
      Demo_Status: 'Đã có demo', Demo_Link: longDemo,
      Pain_Point: viText(2000), Current_Process: viText(2000), Flow_Description: viText(2000),
    }));
    expect(result.ok).toBe(true);            // KHÔNG còn lỗi "quá lớn"
    expect(result.id).toBe('AIUS-999');
    expect(counters.create).toBe(1);         // POST được gửi
  });

});

// ═══════════════════════════════════════════════════════════════════════
// B — Create/Update qua POST + verify (success paths)
// ═══════════════════════════════════════════════════════════════════════

test.describe('B — POST + verify success', () => {

  test('B1: create thành công → verify trả record_id + usecase_id', async ({ page }) => {
    const counters = await loadRegister(page);
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.createUseCase(data); return { ok: true, rid: r.record_id, uid: r.usecase_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);
    expect(result.ok).toBe(true);
    expect(result.rid).toBe('REC-001');
    expect(result.uid).toBe('AIUS-999');
    expect(counters.create).toBe(1);
    expect(counters.usecase).toBeGreaterThanOrEqual(1); // có verify GET
  });

  test('B2: update thành công → verify trả record', async ({ page }) => {
    const counters = await loadRegister(page, { verify: { Record_ID: 'REC-042', UseCase_ID: 'AIUS-042' } });
    const result = await page.evaluate(async (data) => {
      try   { const r = await Api.updateUseCase(data); return { ok: true, rid: r.record_id }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { Record_ID: 'REC-042', UseCase_Name: 'Cập nhật test', Status: 'Draft' });
    expect(result.ok).toBe(true);
    expect(result.rid).toBe('REC-042');
    expect(counters.update).toBe(1);
  });

  test('B3: create chỉ POST đúng 1 lần (không duplicate ghi)', async ({ page }) => {
    const counters = await loadRegister(page);
    await page.evaluate(async (data) => { try { await Api.createUseCase(data); } catch (e) {} }, MIN_VALID);
    expect(counters.create).toBe(1);
  });

  test('B4: verify owner mismatch → không nhận nhầm UC người khác', async ({ page }) => {
    // Hint ID trùng 1 UC có sẵn của người khác → owner khác → verify không confirm → timeout.
    const counters = await loadRegister(page, {
      writeTimeout: 5000,
      verify: { Owner_Name: 'Người Khác', Owner_Email: 'other@x.vn' },
    });
    const result = await page.evaluate(async (data) => {
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, MIN_VALID);
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Timeout');
  });

});

// ═══════════════════════════════════════════════════════════════════════
// C — Transport timeout (verify không xác nhận)
// ═══════════════════════════════════════════════════════════════════════

test.describe('C — Timeout khi verify không xác nhận', () => {

  test('C1: GAS không ghi (verify=null) → reject "Timeout" sau writeTimeout', async ({ page }) => {
    test.setTimeout(20000);
    await loadRegister(page, { writeTimeout: 5000, verify: null });
    const result = await page.evaluate(async (data) => {
      const t0 = Date.now();
      try   { await Api.createUseCase(data); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message, ms: Date.now() - t0 }; }
    }, MIN_VALID);
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Timeout');
    expect(result.ms).toBeGreaterThanOrEqual(4500);
  });

  test('C2: verify chậm (2 lần null rồi có record) → cuối cùng resolve', async ({ page }) => {
    test.setTimeout(30000);
    // usecase trả null 2 lần đầu, sau đó trả record
    await setSession(page, ADMIN_USER);
    await page.addInitScript(() => { window.__API_WRITE_TIMEOUT__ = 20000; });
    let usecaseHits = 0;
    await page.route('**/script.google.com/**', async (route) => {
      const url    = new URL(route.request().url());
      const action = url.searchParams.get('action') || '';
      const cb     = url.searchParams.get('callback') || '__gasCb_test';
      if (action === 'create') { await route.fulfill({ status: 200, contentType: 'text/html', body: 'OK' }); return; }
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
    }, MIN_VALID);
    expect(result.ok).toBe(true);
    expect(result.rid).toBe('REC-LATE');
  });

});

// ═══════════════════════════════════════════════════════════════════════
// D — Full UI submit flow
// ═══════════════════════════════════════════════════════════════════════

test.describe('D — Full UI submit flow', () => {

  test('D1: Create thành công → success screen hiển thị UC ID (verify)', async ({ page }) => {
    await loadRegister(page);
    await fillAndGoToSubmit(page, MIN_VALID);
    await page.click('#submitBtn');
    await expect(page.locator('#successScreen')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#successIdBadge')).toHaveText('AIUS-999');
  });

  test('D2: Link demo dài (ổ chung) → vẫn tạo thành công (fix triệt để)', async ({ page }) => {
    await loadRegister(page);
    const longDemo = '\\\\fileserver\\Thư mục Chung\\AI\\' + viText(1500).replace(/\s/g, '_');
    await fillAndGoToSubmit(page, Object.assign({}, MIN_VALID, {
      Demo_Status: 'Đã có demo', Demo_Link: longDemo,
    }));
    await page.click('#submitBtn');
    await expect(page.locator('#successScreen')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#successIdBadge')).toHaveText('AIUS-999');
  });

  test('D3: GAS không xác nhận → warning toast chứa "mã dự kiến: AIUS-999"', async ({ page }) => {
    test.setTimeout(20000);
    await loadRegister(page, { writeTimeout: 6000, verify: null });
    await fillAndGoToSubmit(page, MIN_VALID);
    await page.click('#submitBtn');
    const toast = page.locator('.toast-warning .toast-message');
    await expect(toast).toBeVisible({ timeout: 12000 });
    const text = await toast.textContent();
    expect(text).toContain('mã dự kiến');
    expect(text).toContain('AIUS-999');
  });

});
