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
  _request(url, data) {
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
        // Cảnh báo nếu payload quá lớn (> 50,000 chars) — có thể vượt GAS param limit
        if (payload.length > 50000) {
          return Promise.reject(new Error(
            'Nội dung biểu mẫu quá dài (' + payload.length + ' chars). ' +
            'Vui lòng rút gọn các trường văn bản (đặc biệt phần Prompt).'
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
    return Api._jsonp(url);
  },

  // ── Public API ──────────────────────────────────────────────────

  getLookup()         { return Api._request(API.lookup()); },
  getUseCase(id)      { return Api._request(API.getUseCase(id)); },
  getDashboard()      { return Api._request(API.dashboard()); },
  health()            { return Api._request(API.health()); },
  getNextId()         { return Api._request(API.nextId()); },

  createUseCase(data) { return Api._request(API.create(), data); },
  updateUseCase(data) { return Api._request(API.update(), data); },

  duplicateCheck(name, pain) {
    return Api._request(API.duplicateCheck(), { UseCase_Name: name, Pain_Point: pain });
  },

  // Dashboard & Approval
  listUseCases(filters) { return Api._request(API.list(filters)); },
  approveUseCase(data)  { return Api._request(API.approve(), data); },
  rejectUseCase(data)   { return Api._request(API.reject(),  data); }
};
