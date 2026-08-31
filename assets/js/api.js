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

  // ── Encode payload → base64url (dùng chung cho GET-JSONP lẫn POST-iframe) ──
  // Strip lone surrogates trước khi encode: encodeURIComponent() throws URIError
  // nếu gặp lone surrogate (U+D800–U+DFFF không ghép đôi).
  //   ([\uD800-\uDBFF][\uDC00-\uDFFF]) = valid surrogate pair → giữ
  //   [\uD800-\uDFFF] còn lại = lone surrogate → strip
  _encodePayload(data) {
    var safeData = JSON.parse(JSON.stringify(data, function(k, v) {
      if (typeof v === 'string') {
        return v.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, function(m, pair) {
          return pair || '';
        });
      }
      return v;
    }));
    var json = JSON.stringify(safeData);
    // encode UTF-8 (Vietnamese) an toàn: JSON → %xx → bytes → base64 → base64url
    var b64  = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },

  // ── Request với optional payload (GET + JSONP cho mọi loại) ─────
  // data sẽ được base64url-encode rồi gắn vào URL param "payload"
  // timeoutMs: override mặc định 20s — dùng cho read + write ops NHỎ (duplicate-check…).
  // Write ops LỚN (create/update) đi qua _submitViaPost (POST iframe, không giới hạn URL).
  // Retry policy: read ops (data=null) → 2 retries × 2s delay
  //               write ops (data!=null) → 0 retries (tránh duplicate ghi)
  _request(url, data, timeoutMs) {
    // Write ops có payload → không retry (GAS có thể đã ghi trước khi timeout)
    // Read ops không có payload → retry 2 lần sau 2s mỗi lần
    var retries = (data !== undefined && data !== null) ? 0 : 2;
    if (data) {
      try {
        var payload = Api._encodePayload(data);
        // Check kích thước SAU khi encode vì tiếng Việt expand 4× sau base64url.
        // GAS GET URL limit ~8KB — ngưỡng 7,500 chars cho buffer an toàn.
        // Chỉ áp dụng cho đường GET-JSONP (payload nhỏ: duplicate-check, approve…).
        if (payload.length > 7500) {
          return Promise.reject(new Error(
            'Nội dung biểu mẫu quá lớn để gửi (' + payload.length + ' / 7500 chars).'
          ));
        }
        var sep = url.indexOf('?') === -1 ? '?' : '&';
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

  // ── Write op qua hidden-iframe form POST (v3.15.0) ────────────────
  // Vì sao: create/update nhét payload vào URL GET bị giới hạn ~8KB của GAS →
  // link demo dài (ổ chung/SharePoint) + nhiều field tiếng Việt làm vượt ngưỡng → HTTP 400.
  // Form POST KHÔNG giới hạn độ dài body và KHÔNG vướng CORS (ta không đọc response iframe).
  // Đổi lại không đọc được kết quả → xác nhận bằng verifyFn() (JSONP GET nhỏ, an toàn).
  //   actionUrl : URL kiểu `${base}?action=create` — ta tách base + action ra field POST
  //   verifyFn  : () => Promise<record|null> — resolve record khi đã ghi xong, null nếu chưa
  //   timeoutMs : quá hạn mà verify chưa xác nhận → reject('Timeout ...')
  // Timeout write-op — cho phép test rút ngắn qua window.__API_WRITE_TIMEOUT__.
  _writeTimeout() {
    return (typeof window !== 'undefined' && window.__API_WRITE_TIMEOUT__) || 90000;
  },

  _submitViaPost(actionUrl, data, verifyFn, timeoutMs) {
    timeoutMs = timeoutMs || 90000;
    return new Promise(function(resolve, reject) {
      var payload;
      try {
        payload = Api._encodePayload(data);
      } catch (e) {
        return reject(new Error('Lỗi encode dữ liệu: ' + (e && e.message)));
      }

      var name    = '__gasPost_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      var iframe  = document.createElement('iframe');
      iframe.name = name;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      // POST tới full actionUrl (giữ ?action= trên query — GAS e.parameter gộp query + form field).
      // Chỉ payload đi vào body POST → không giới hạn độ dài.
      var form = document.createElement('form');
      form.method = 'POST';
      form.action = actionUrl;
      form.target = name;
      form.style.display = 'none';
      var pInput = document.createElement('input');
      pInput.type = 'hidden'; pInput.name = 'payload'; pInput.value = payload;
      form.appendChild(pInput);
      document.body.appendChild(form);

      var settled = false, pollTimer = null, hardTimer = null;
      function cleanup() {
        clearInterval(pollTimer); clearTimeout(hardTimer);
        if (form.parentNode)   form.parentNode.removeChild(form);
        // Giữ iframe thêm chút rồi mới gỡ (tránh hủy request đang bay)
        setTimeout(function() { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
      }
      function done(rec)  { if (settled) return; settled = true; cleanup(); resolve(rec); }
      function fail(err)  { if (settled) return; settled = true; cleanup(); reject(err); }

      function tryVerify() {
        if (settled) return;
        verifyFn().then(function(rec) { if (rec) done(rec); }, function() { /* chưa xong */ });
      }

      // GAS phản hồi (write xong) → iframe load. Không đọc được nội dung → verify ngay.
      iframe.onload = function() { tryVerify(); };
      // Backup: poll verify mỗi 3s phòng khi onload không kích hoạt.
      pollTimer = setInterval(tryVerify, 3000);
      hardTimer = setTimeout(function() {
        fail(new Error('Timeout kết nối GAS (' + (timeoutMs / 1000) + 's) — chưa xác nhận được kết quả.'));
      }, timeoutMs);

      form.submit();
    });
  },

  // ── Write hybrid (v3.16.0) — FIX create/update "timeout giả" ──────
  // Bối cảnh: đường iframe-POST (v3.15.0) KHÔNG đọc được response → mọi lỗi ghi
  // phía server (validate/lock/…) đều bị che thành "Timeout" và US không được ghi.
  // Sửa: ƯU TIÊN GET-JSONP (đọc được success/lỗi THẬT của GAS, đã kiểm chứng ghi OK);
  //      CHỈ fallback iframe-POST khi payload vượt URL-limit (~link demo dài).
  //   actionUrl : `${base}?action=create|update`
  //   verify    : dùng cho nhánh POST (không đọc được response)
  _writeHybrid(actionUrl, data, verify) {
    var payload = null;
    try { payload = Api._encodePayload(data); } catch (e) { /* để _request báo lỗi encode rõ */ }
    var isSmall = (payload === null || payload.length <= 7500);

    // Round 2 T2: RETRY AN TOÀN — chỉ bật khi có Req_ID (server dedup theo reqId →
    // request lặp trả record cũ, KHÔNG tạo dòng trùng). Không Req_ID → giữ hành vi cũ.
    // CHỈ retry đường GET-JSONP (isSmall): timeout ngắn + ca phổ biến. Đường iframe-POST
    // (payload lớn) đã có verify-polling tự bắt success; retry ở đó vô nghĩa mà trễ lâu
    // (mỗi lần tới 90s) — giữ 1 lần, reqId vẫn bảo vệ nếu user chủ động gửi lại.
    var hasReqId  = !!(data && (data.Req_ID || data.req_id));
    var maxRetry  = (hasReqId && isSmall) ? 2 : 0;   // tối đa 3 lần thử (1 + 2 retry)
    var backoffMs = 1500;

    function once() {
      // Nhỏ (hoặc encode lỗi) → GET-JSONP: resolve {record_id, usecase_id}; reject = message GAS thật.
      // Lớn → iframe-POST + verify (giữ fix link demo dài của v3.15.0).
      return isSmall
        ? Api._request(actionUrl, data, Api._writeTimeout())
        : Api._submitViaPost(actionUrl, data, verify, Api._writeTimeout());
    }

    function attempt(n) {
      return once().catch(function (err) {
        var msg = (err && err.message) || '';
        // Chỉ retry lỗi TRANSPORT (timeout / script load / không trả dữ liệu) — KHÔNG retry
        // lỗi nghiệp vụ thật (validate, status transition…) để hiện message ngay.
        var transient = /Timeout|script load thất bại|GAS không trả về dữ liệu|GAS script load/.test(msg);
        if (n > 0 && transient && hasReqId) {
          return new Promise(function (res) { setTimeout(res, backoffMs); }).then(function () { return attempt(n - 1); });
        }
        throw err;
      });
    }
    return attempt(maxRetry);
  },

  // ── Public API ──────────────────────────────────────────────────

  getLookup()         { return Api._request(API.lookup()); },
  getUseCase(id)      { return Api._request(API.getUseCase(id)); },
  getDashboard()      { return Api._request(API.dashboard()); },
  health()            { return Api._request(API.health()); },
  getNextId()         { return Api._request(API.nextId()); },

  // Write operations dùng POST iframe (v3.15.0) — không giới hạn độ dài payload,
  // fix triệt để lỗi link demo dài (ổ chung) làm vỡ URL GET → HTTP 400.
  // Xác nhận kết quả bằng verify GET (JSONP nhỏ). Timeout 90s: GAS acquire LockService +
  // đọc/ghi MASTER_DATA (99 cols) + cold start 5–15s → tổng thường 15–35s.
  createUseCase(data) {
    var usecaseId  = data.UseCase_ID  || '';
    var ownerEmail = String(data.Owner_Email || '').trim().toLowerCase();
    var ownerName  = String(data.Owner_Name  || '').trim().toLowerCase();
    var verify = function() {
      // Verify create: tra theo UseCase_ID đã gán client-side (GAS usecase route fallback UseCase_ID).
      // Hardening: khớp owner để tránh false-positive khi hint ID trùng 1 UC có sẵn của người khác
      // (hiếm — GAS chỉ dùng hint nếu còn free, ngược lại tự sinh ID mới).
      if (!usecaseId) return Promise.resolve(null);
      return Api.getUseCase(usecaseId).then(function(o) {
        if (!o || !(o.Record_ID || o.record_id)) return null;
        var oe = String(o.Owner_Email || o.owner_email || '').trim().toLowerCase();
        var on = String(o.Owner_Name  || o.owner_name  || '').trim().toLowerCase();
        var ownerOk = (!ownerEmail && !ownerName) ||
                      (ownerEmail && oe === ownerEmail) ||
                      (ownerName  && on === ownerName);
        if (!ownerOk) return null; // ID này thuộc UC khác → chờ tiếp (thường sẽ timeout → cảnh báo)
        return {
          record_id:  o.Record_ID  || o.record_id,
          usecase_id: o.UseCase_ID || o.usecase_id || usecaseId
        };
      }, function() { return null; });
    };
    return Api._writeHybrid(API.create(), data, verify);
  },
  updateUseCase(data) {
    var recordId = data.Record_ID || '';
    var verify = function() {
      if (!recordId) return Promise.resolve(null);
      return Api.getUseCase(recordId).then(function(o) {
        return (o && (o.Record_ID || o.record_id)) ? {
          record_id:  o.Record_ID  || o.record_id,
          usecase_id: o.UseCase_ID || o.usecase_id || ''
        } : null;
      }, function() { return null; });
    };
    return Api._writeHybrid(API.update(), data, verify);
  },

  duplicateCheck(name, pain) {
    return Api._request(API.duplicateCheck(), { UseCase_Name: name, Pain_Point: pain });
  },

  // Dashboard & Approval
  listUseCases(filters) { return Api._request(API.list(filters)); },
  approveUseCase(data)  { return Api._request(API.approve(), data); },
  rejectUseCase(data)   { return Api._request(API.reject(),  data); },

  // Auth dùng chung SHTD (H2) — username + password → { token, user }
  authLogin(username, password) { return Api._request(API.authLogin(), { username: username, password: password }); },
  changePassword(token, oldPassword, newPassword) {
    return Api._request(API.authChangePassword(), { token: token, old_password: oldPassword, new_password: newPassword });
  },

  // Workflow catalog (H2 Giai đoạn 2)
  getWorkflowCatalog(team)      { return Api._request(API.workflowCatalog(team)); },
  listWorkflowCatalog()         { return Api._request(API.workflowList()); },
  upsertWorkflow(data)          { return Api._request(API.workflowUpsert(), data); },
  deleteWorkflow(data)          { return Api._request(API.workflowDelete(), data); },
  renameWorkflow(data)          { return Api._request(API.workflowRename(), data); },

  // User — chỉ ĐỌC (danh sách từ User_Master, phục vụ KPI). Quản lý user làm ở SHTD-Dashboard.
  getUsers()                    { return Api._request(API.users()); },

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
  // H1 governance (submitManagerReview/submitChampionReview/recalculate*) đã GỠ — xem archive/h1.

  // ── H2 Giai đoạn 3: chấm điểm mới ──────────────────────────────
  // token đính vào payload để GAS verify server-side (fallback reviewer_email nếu thiếu token).
  submitCouncilScore(data)      { return Api._request(API.councilScoreSubmit(), data, 30000); },
  listCouncilScores(recordId)   { return Api._request(API.councilScoreList(recordId)); },
  getCouncilProgress()          { return Api._request(API.councilProgress()); },
  submitPersonalScore(data)     { return Api._request(API.personalScoreSubmit(), data, 30000); },
  listPersonalScores(team)      { return Api._request(API.personalScoreList(team)); },
  getMemberKpiPreview(username)  { return Api._request(API.memberKpiPreview(username)); },
  getH2Leaderboard(filters)     { return Api._request(API.h2Leaderboard(filters)); },
  getKpiLeaderboard(filters)    { return Api._request(API.kpiLeaderboard(filters)); },
  submitReuseConfirm(data)      { return Api._request(API.reuseConfirm(), data, 30000); },
  getReuseCounts()              { return Api._request(API.reuseCounts()); },

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
