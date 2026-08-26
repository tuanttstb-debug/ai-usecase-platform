// ─────────────────────────────────────────────────────────────────
// CacheLayer.gs — (Tuning T1) Version-gated cache cho các read nặng
//
// Vấn đề: `list` (readSheetAsObjects_ full MASTER N×99 + đọc User_Master) và `dashboard`
// đọc/tính lại mỗi lần gọi → load rất chậm + dễ timeout. Dashboard cũ cache theo THỜI GIAN
// (30') → stale sau khi ghi, lại lossy (mất top_performers…).
//
// Giải pháp: DATA_VERSION (bump SAU mỗi write, tập trung ở doGet/doPost) + CacheService (gzip).
//   - Read: key gắn version → không đổi = trả cache (bỏ đọc sheet); ĐỔI = tính live rồi cache.
//   - Vừa TƯƠI (mọi write bump version → cache tự vô hiệu) vừa NHANH (câu lặp dùng lại).
// ─────────────────────────────────────────────────────────────────

var _AIUS_CACHE_TTL = 21600;   // 6h — an toàn vì key gắn version (write bump → key đổi ngay)
var _AIUS_CACHE_MAX = 95000;   // < 100KB/key của CacheService; vượt → bỏ cache, tính live lần sau

// Danh sách action LÀM ĐỔI dữ liệu → bump version (vô hiệu hoá cache list/dashboard).
var _AIUS_WRITE_ACTIONS = {
  'create': 1, 'usecase/create': 1, 'update': 1, 'usecase/update': 1,
  'approve': 1, 'reject': 1, 'weekly-update': 1,
  'milestone-approve': 1, 'milestone-reject': 1, 'self-assessment': 1,
  'council-score-submit': 1, 'personal-score-submit': 1, 'reuse-confirm': 1,
  'workflow-upsert': 1, 'workflow-delete': 1, 'workflow-rename': 1
};

function _aiusVer() {
  return PropertiesService.getScriptProperties().getProperty('AIUS_DATA_VER') || '0';
}

function _aiusBumpVer() {
  PropertiesService.getScriptProperties().setProperty('AIUS_DATA_VER', String(Date.now()));
}

// Bump version nếu action vừa chạy là write THÀNH CÔNG. Gọi ở doGet/doPost sau route_.
function _aiusBumpIfWrite(action, response) {
  try {
    if (response && response.success && _AIUS_WRITE_ACTIONS[action]) _aiusBumpVer();
  } catch (e) { /* không để lỗi bump chặn response */ }
}

function _aiusCacheGet(key) {
  try {
    var raw = CacheService.getScriptCache().get(key);
    if (!raw) return null;
    var blob = Utilities.newBlob(Utilities.base64Decode(raw), 'application/x-gzip');
    return JSON.parse(Utilities.ungzip(blob).getDataAsString());
  } catch (e) { return null; }
}

function _aiusCachePut(key, obj) {
  try {
    var gz  = Utilities.gzip(Utilities.newBlob(JSON.stringify(obj)));
    var b64 = Utilities.base64Encode(gz.getBytes());
    if (b64.length > _AIUS_CACHE_MAX) return;   // quá lớn → không cache (tính live lần sau)
    CacheService.getScriptCache().put(key, b64, _AIUS_CACHE_TTL);
  } catch (e) {}
}

// Hash ngắn cho bộ filter của `list` → giữ CacheService key < 250 ký tự.
function _aiusHashFilters_(f) {
  f = f || {};
  var s = [
    f.filter || '', f.status || '', f.team || '', f.category || '',
    f.owner_login || f.owner || '', f.owner_name || '',
    (f.limit == null ? '' : f.limit)
  ].join('|');
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return String(h);
}
