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
  _jsonp(url, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
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
        reject(new Error(
          'Timeout kết nối GAS (' + (timeoutMs / 1000) + 's).\n' +
          'Kiểm tra: GAS URL đúng chưa, deployment còn active không.'
        ));
      }, timeoutMs);

      script.onerror = function() {
        cleanup();
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
  _request(url, data, timeoutMs) {
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
    return Api._jsonp(url, timeoutMs);
  },

  // ── Public API ──────────────────────────────────────────────────

  getLookup()         { return Api._request(API.lookup()); },
  getUseCase(id)      { return Api._request(API.getUseCase(id)); },
  getDashboard()      { return Api._request(API.dashboard()); },
  health()            { return Api._request(API.health()); },
  getNextId()         { return Api._request(API.nextId()); },

  // Write operations dùng 45s timeout vì GAS phải acquire LockService + đọc/ghi nhiều sheet.
  // 20s mặc định thường không đủ khi sheet lớn → GAS ghi xong nhưng response chưa về → FE báo lỗi sai.
  createUseCase(data) { return Api._request(API.create(), data, 45000); },
  updateUseCase(data) { return Api._request(API.update(), data, 45000); },

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
  initUsersSheet(adminEmail)    { return Api._request(API.userInit(),  { reviewer_email: adminEmail }); }
};
