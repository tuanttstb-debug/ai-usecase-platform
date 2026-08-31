// ─────────────────────────────────────────────────────────────────
// IdempotencyService.gs — Chống ghi TRÙNG / MẤT / TIMEOUT (Round 2 T2)
//
// Vấn đề gốc: transport GAS (GET-JSONP / iframe-POST) khi timeout là MƠ HỒ —
// client không biết server đã ghi xong hay chưa. Nếu không retry → MẤT; nếu
// retry/bấm-lại → TRÙNG (create sinh Record_ID = UUID mới mỗi lần).
//
// Giải pháp: client gửi kèm `Req_ID` (uuid) ỔN ĐỊNH theo phiên soạn form.
// Server dedup theo Req_ID → retry cùng Req_ID luôn AN TOÀN (idempotent):
//   • đã ghi rồi  → trả lại kết quả cũ (record_id/usecase_id), KHÔNG ghi lần 2.
//   • chưa ghi    → ghi + nhớ Req_ID.
//
// Lưu 2 tầng (hybrid — [TT] chốt):
//   1. CacheService (fast-path, TTL 6h) — trị auto-retry khi timeout tức thì.
//   2. Sheet REQ_DEDUP (bền vĩnh viễn) — trị cả retry THỦ CÔNG sau nhiều giờ /
//      khi cache bị evict. Nguồn sự thật khi cache miss.
// ─────────────────────────────────────────────────────────────────

var _IDEM_CACHE_TTL   = 21600;  // 6h (trần CacheService)
var _IDEM_PRUNE_MAX   = 5000;   // REQ_DEDUP vượt ngưỡng → prune bớt dòng cũ nhất
var _IDEM_PRUNE_KEEP  = 3000;   // sau prune giữ lại N dòng mới nhất

function _idemCacheKey_(reqId) {
  return 'AIUS_IDEM_' + String(reqId);
}

/**
 * Tra kết quả đã ghi cho reqId. Trả {record_id, usecase_id} hoặc null.
 * Best-effort: mọi lỗi cache/sheet đều nuốt (trả null → coi như chưa ghi).
 */
function _idemLookup_(reqId) {
  if (!reqId) return null;

  // 1. CacheService (nhanh)
  try {
    var cached = CacheService.getScriptCache().get(_idemCacheKey_(reqId));
    if (cached) {
      var o = JSON.parse(cached);
      if (o && o.record_id) return o;
    }
  } catch (_e) { /* cache lỗi → thử sheet */ }

  // 2. Sheet REQ_DEDUP (bền)
  try {
    var found = findRowByKeyColumn_(SHEETS.REQ_DEDUP, 'Req_ID', String(reqId));
    if (found && found.obj && found.obj.Record_ID) {
      var res = {
        record_id:  found.obj.Record_ID,
        usecase_id: found.obj.UseCase_ID || ''
      };
      // Nạp lại cache để lần sau nhanh
      try { CacheService.getScriptCache().put(_idemCacheKey_(reqId), JSON.stringify(res), _IDEM_CACHE_TTL); } catch (_c) {}
      return res;
    }
  } catch (_s) { /* sheet lỗi → coi như chưa ghi */ }

  return null;
}

/**
 * Nhớ kết quả cho reqId (sau khi ghi thành công): cache + sheet REQ_DEDUP.
 * Best-effort: lỗi ghi dedup KHÔNG làm hỏng write chính (đã ghi xong).
 * @param {string} reqId
 * @param {string} action  'create' | 'update'
 * @param {{record_id:string, usecase_id:string}} result
 */
function _idemRemember_(reqId, action, result) {
  if (!reqId || !result || !result.record_id) return;

  try {
    CacheService.getScriptCache().put(
      _idemCacheKey_(reqId),
      JSON.stringify({ record_id: result.record_id, usecase_id: result.usecase_id || '' }),
      _IDEM_CACHE_TTL
    );
  } catch (_c) { /* cache lỗi → vẫn còn sheet */ }

  try {
    // ensureSheetColumns_ tạo sheet + header nếu chưa có (idempotent)
    ensureSheetColumns_(SHEETS.REQ_DEDUP, REQ_DEDUP_HEADERS);
    var sheet = getOrCreateSheet_(SHEETS.REQ_DEDUP);
    sheet.appendRow([
      String(reqId),
      String(action || ''),
      String(result.record_id),
      String(result.usecase_id || ''),
      new Date().toISOString()
    ]);
    _idemPruneIfLarge_(sheet);
  } catch (_s) { /* ghi sheet dedup lỗi → chấp nhận (write chính đã xong) */ }
}

/**
 * Prune REQ_DEDUP khi quá lớn — xóa các dòng CŨ NHẤT, giữ _IDEM_PRUNE_KEEP dòng mới.
 * Chạy cơ hội (opportunistic) trong _idemRemember_. Không đụng header.
 */
function _idemPruneIfLarge_(sheet) {
  try {
    var lastRow = sheet.getLastRow();          // gồm header
    var dataRows = lastRow - 1;
    if (dataRows <= _IDEM_PRUNE_MAX) return;
    var removeCount = dataRows - _IDEM_PRUNE_KEEP;  // số dòng cũ cần xóa
    if (removeCount > 0) sheet.deleteRows(2, removeCount); // xóa từ dòng 2 (cũ nhất) trở đi
  } catch (_e) { /* prune lỗi → bỏ qua, không ảnh hưởng đúng đắn */ }
}

// ── Setup / bảo trì (chạy tay trong GAS Editor) ───────────────────

/** Tạo sheet REQ_DEDUP + header (idempotent). Gọi 1 lần sau redeploy (hoặc tự tạo khi ghi lần đầu). */
function setupReqDedupSheet() {
  var added = ensureSheetColumns_(SHEETS.REQ_DEDUP, REQ_DEDUP_HEADERS);
  return { sheet: SHEETS.REQ_DEDUP, headers_added: added, message: 'REQ_DEDUP sẵn sàng' };
}

/** Prune thủ công REQ_DEDUP về _IDEM_PRUNE_KEEP dòng mới nhất. */
function pruneReqDedup() {
  var sheet = getOrCreateSheet_(SHEETS.REQ_DEDUP);
  _idemPruneIfLarge_(sheet);
  return { last_row: sheet.getLastRow(), message: 'Đã prune REQ_DEDUP (nếu vượt ngưỡng)' };
}

/**
 * TEST self-clean (chạy tay GAS Editor) — kiểm tầng dedup KHÔNG đụng MASTER_DATA.
 * Remember 1 reqId giả → lookup phải trả đúng → xóa dòng test. An toàn cho production.
 * @returns {{pass:boolean, steps:string[]}}
 */
function testIdempotencyStore() {
  var steps = [], pass = true;
  var reqId = 'TEST-IDEM-' + Utilities.getUuid();
  var expect = { record_id: 'REC-TEST-' + Date.now(), usecase_id: 'AIUS-TEST' };
  try {
    // 1. Trước khi remember → lookup phải null
    var before = _idemLookup_(reqId);
    steps.push('lookup trước remember = ' + (before ? 'CÓ (SAI)' : 'null (đúng)'));
    if (before) pass = false;

    // 2. Remember → lookup phải trả đúng record
    _idemRemember_(reqId, 'create', expect);
    var after = _idemLookup_(reqId);
    var ok = after && after.record_id === expect.record_id && after.usecase_id === expect.usecase_id;
    steps.push('lookup sau remember khớp = ' + (ok ? 'ĐÚNG' : 'SAI (' + JSON.stringify(after) + ')'));
    if (!ok) pass = false;

    // 3. Bỏ cache → lookup phải vẫn trả từ SHEET (bền)
    try { CacheService.getScriptCache().remove(_idemCacheKey_(reqId)); } catch (_c) {}
    var fromSheet = _idemLookup_(reqId);
    var okSheet = fromSheet && fromSheet.record_id === expect.record_id;
    steps.push('lookup từ sheet sau khi xóa cache = ' + (okSheet ? 'ĐÚNG (bền)' : 'SAI'));
    if (!okSheet) pass = false;
  } catch (e) {
    pass = false; steps.push('EXCEPTION: ' + e.message);
  } finally {
    // Dọn: xóa dòng test trong REQ_DEDUP + cache
    try {
      var found = findRowByKeyColumn_(SHEETS.REQ_DEDUP, 'Req_ID', reqId);
      if (found) found.sheet.deleteRow(found.rowIndex);
      CacheService.getScriptCache().remove(_idemCacheKey_(reqId));
      steps.push('đã dọn dòng test');
    } catch (_e) { steps.push('dọn lỗi: ' + _e.message); }
  }
  Logger.log((pass ? 'PASS' : 'FAIL') + '\n' + steps.join('\n'));
  return { pass: pass, steps: steps };
}
