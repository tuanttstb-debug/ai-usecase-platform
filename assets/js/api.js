// ─────────────────────────────────────────────────────────────────
// api.js — HTTP client cho Google Apps Script Web App
//
// Tại sao KHÔNG dùng fetch() (GET lẫn POST)?
//
//   GET  fetch → GAS 302 redirect → browser CORS check thất bại
//   POST fetch → GAS 200 OK nhưng thiếu Access-Control-Allow-Origin
//               (ContentService.addHeader() không đáng tin với POST)
//               → ERR_FAILED dù status 200
//
// Giải pháp: 100% JSONP cho mọi request
//   • Inject <script src="url?callback=fn&payload=base64data">
//   • Script tag KHÔNG bị CORS kiểm tra → redirect được follow tự do
//   • GAS trả: fn({success, data, message})
//   • Payload (data POST-like) → base64url encode → gắn vào query param
// ─────────────────────────────────────────────────────────────────

var Api = {

  // ── JSONP core ──────────────────────────────────────────────────
  // _retries: số lần retry còn lại khi timeout (mặc định 0 — caller quyết định)
  // Retry chỉ kích hoạt khi TIMEOUT, KHÔNG kích hoạt khi script.onerror
  // (onerror nghĩa GAS có thể đã xử lý xong → retry có thể gây duplicate ghi)
  _jsonp(url, timeoutMs, _retries) {
    timeoutMs = timeoutMs || 20000;
    _retries  = _retries  !== undefined ? _retries : 0;
    var self = this;
    return new Promise(function(resolve, reject) {
      var cbName  = '__gasCb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      var script  = document.createElement('script');
      var timer   = null;
      var settled = false;

      function cleanup() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[cbName];
      }

      window[cbName] = function(data) {
        cleanup();
        if (!data)              return reject(new Error('GAS không trả về dữ liệu'));
        if (!data.success)      return reject(new Error(data.message || 'Lỗi từ server'));
        resolve(data.data);
      };

      timer = setTimeout(function() {
        cleanup();
        if (_retries > 0) {
          // Timeout — thử lại sau 2s (chỉ áp dụng cho read operations)
          setTimeout(function() {
            self._jsonp(url, timeoutMs, _retries - 1).then(resolve, reject);
          }, 2000);
        } else {
          reject(new Error(
            'Timeout kết nối GAS (' + (timeoutMs / 1000) + 's).\n' +
            'Kiểm tra: GAS URL đúng chưa, deployment còn active không.'
          ));
        }
      }, timeoutMs);

      script.onerror = function() {
        cleanup();
        // Không retry khi onerror — GAS có thể đã ghi xong, retry có thể tạo bản ghi trùng
        reject(new Error(
          'GAS script load thất bại.\n' +
          'Kiểm tra: URL deployment và cài đặt "Who has access: Anyone".'
        ));
      };

      // Gắn callback vào URL
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      script.src = url + sep + 'callback=' + cbName;
      (document.head || document.body).appendChild(script);
    });
  },

  // ── Request với optional payload (GET + JSONP cho mọi loại) ─────
  // data sẽ được base64url-encode rồi gắn vào URL param "payload"
  // timeoutMs: override mặc định 20s — dùng 45s cho write operations (create/update)
  // Retry policy: read ops (data=null) → 2 retries × 2s delay
  //               write ops (data!=null) → 0 retries (tránh duplicate ghi)
  _request(url, data, timeoutMs) {
    // Write ops có payload → không retry (GAS có thể đã ghi trước khi timeout)
    // Read ops không có payload → retry 2 lần sau 2s mỗi lần
    var retries = (data !== undefined && data !== null) ? 0 : 2;
    if (data) {
      try {
        // Strip lone surrogates trước khi encode:
        // encodeURIComponent() throws URIError nếu gặp lone surrogate (U+D800–U+DFFF không ghép đôi).
        // Regex: giữ surrogate pair hợp lệ (emoji, ký tự ngoài BMP), strip lone surrogate.
        // ([\uD800-\uDBFF][\uDC00-\uDFFF]) = valid surrogate pair → giữ
        // [\uD800-\uDFFF] còn lại = lone surrogate → strip
        var safeData = JSON.parse(JSON.stringify(data, function(k, v) {
          if (typeof v === 'string') {
            return v.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, function(m, pair) {
              return pair || '';
            });
          }
          return v;
        }));
        var json    = JSON.stringify(safeData);
        // encode UTF-8 (Vietnamese) an toàn: JSON → %xx → bytes → base64
        var b64     = btoa(unescape(encodeURIComponent(json)));
        // base64url: thay +/= để URL-safe, không cần encodeURIComponent thêm
        var payload = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        // Check kích thước SAU khi encode (không phải trước) vì tiếng Việt expand 4× sau base64url.
        // Ví dụ: 1500 ký tự Việt → ~6,000 chars base64url → URL ~6,200 chars.
        // GAS GET URL limit ~8KB — ngưỡng 7,500 chars cho buffer an toàn.
        if (payload.length > 7500) {
          return Promise.reject(new Error(
            'Nội dung biểu mẫu quá lớn để gửi (' + payload.length + ' / 7500 chars).\n' +
            'Vui lòng rút ngắn nội dung các trường văn bản, đặc biệt:\n' +
            '• Ngữ cảnh bổ sung (Context)\n' +
            '• Các trường Prompt khác\n' +
            'Tiếng Việt chiếm nhiều dung lượng hơn tiếng Anh (~4×).'
          ));
        }
        var sep     = url.indexOf('?') === -1 ? '?' : '&';
        url = url + sep + 'payload=' + payload;
      } catch (encErr) {
        return Promise.reject(new Error(
          'Lỗi encode dữ liệu: ' + encErr.message +
          '. Kiểm tra xem có ký tự đặc biệt không hợp lệ trong form không.'
        ));
      }
    }
    return Api._jsonp(url, timeoutMs, retries);
  },

  // ── Public API ──────────────────────────────────────────────────

  getLookup()         { return Api._request(API.lookup()); },
  getUseCase(id)      { return Api._request(API.getUseCase(id)); },
  getDashboard()      { return Api._request(API.dashboard()); },
  health()            { return Api._request(API.health()); },
  getNextId()         { return Api._request(API.nextId()); },

  // Write operations dùng 90s timeout: GAS phải acquire LockService + 2 lần đọc/ghi MASTER_DATA (99 cols).
  // Cold start V8 runtime có thể thêm 5–15s → tổng thường 15–35s → buffer 90s đủ rộng.
  createUseCase(data) { return Api._request(API.create(), data, 90000); },
  updateUseCase(data) { return Api._request(API.update(), data, 90000); },

  duplicateCheck(name, pain) {
    return Api._request(API.duplicateCheck(), { UseCase_Name: name, Pain_Point: pain });
  },

  // Dashboard & Approval
  listUseCases(filters) { return Api._request(API.list(filters)); },
  approveUseCase(data)  { return Api._request(API.approve(), data); },
  rejectUseCase(data)   { return Api._request(API.reject(),  data); },

  // User management
  validateUser(username)        { return Api._request(API.userLogin(username)); },
  getUsers()                    { return Api._request(API.users()); },
  upsertUser(data)              { return Api._request(API.userUpsert(), data); },
  syncUsers(adminEmail)         { return Api._request(API.userSync(),  { reviewer_email: adminEmail }); },
  initUsersSheet(adminEmail)    { return Api._request(API.userInit(),  { reviewer_email: adminEmail }); },

  // ── Governance v3.0 ────────────────────────────────────────────
  getLeaderboard(filters)       { return Api._request(API.leaderboard(filters)); },
  getWeeklyReport(weekStart)    { return Api._request(API.weeklyReport(weekStart)); },
  submitWeeklyUpdate(data)      { return Api._request(API.weeklyUpdate(),   data, 45000); },
  getWeeklyLog(recordId)        { return Api._request(API.weeklyLog(recordId)); },

  // Milestone approval (v3.14.0)
  listMilestones(filter)        { return Api._request(API.milestoneList(filter)); },
  approveMilestone(data)        { return Api._request(API.milestoneApprove(), data, 45000); },
  rejectMilestone(data)         { return Api._request(API.milestoneReject(),  data, 45000); },
  submitSelfAssessment(data)    { return Api._request(API.selfAssessment(), data, 30000); },
  submitManagerReview(data)     { return Api._request(API.managerReview(),  data, 30000); },
  submitChampionReview(data)    { return Api._request(API.championReview(), data, 30000); },
  recalculateScores(adminEmail) { return Api._request(API.scoreRecalc(),  { admin_email: adminEmail }); },
  recalculateRankings(adminEmail){ return Api._request(API.rankRecalc(),  { admin_email: adminEmail }); },

  // ── Convenience: callback-style JSONP (for pages that don't use Promises) ──
  jsonp(url, callback) {
    var cbName  = '__gasCb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    var script  = document.createElement('script');
    var timer   = null;
    var settled = false;
    function cleanup() {
      if (settled) return; settled = true;
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[cbName];
    }
    window[cbName] = function(data) { cleanup(); callback(data); };
    timer = setTimeout(function() { cleanup(); callback(null); }, 25000);
    script.onerror = function() { cleanup(); callback(null); };
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    script.src = url + sep + 'callback=' + cbName;
    (document.head || document.body).appendChild(script);
  },

  currentUser() {
    try { return JSON.parse(sessionStorage.getItem(APP_CONFIG.USER_SESSION_KEY)); } catch(e) { return null; }
  }
};
