// ─────────────────────────────────────────────────────────────────
// ui-confirm.js — Hộp thoại xác nhận dùng chung (Promise-based)
//
// Chuẩn hóa mọi thao tác KHÔNG hoàn tác (xóa / từ chối / rời trang chưa lưu)
// qua 1 hộp thoại thống nhất thay vì window.confirm() hoặc chạy thẳng.
// API (mô phỏng SHTD uiConfirm):
//   uiConfirm({ title, body, okLabel, cancelLabel, danger }) -> Promise<boolean>
//   uiConfirm(title, body, okLabel, danger)                  -> Promise<boolean>
// Dùng lại component modal chuẩn (.modal-overlay / .modal-card).
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';
  if (window.uiConfirm) return;

  var _el = null, _resolve = null;

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _ensure() {
    if (_el) return _el;
    _el = document.createElement('div');
    _el.className = 'modal-overlay hidden';
    _el.id = 'uiConfirmModal';
    _el.setAttribute('role', 'alertdialog');
    _el.setAttribute('aria-modal', 'true');
    _el.innerHTML =
      '<div class="modal-card" style="max-width:420px">' +
        '<div class="modal-header"><h3 id="uiConfirmTitle" style="margin:0"></h3>' +
          '<button type="button" class="modal-close" data-uic="cancel" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<div class="modal-body"><p id="uiConfirmBody" style="margin:0"></p></div>' +
        '<div class="modal-footer">' +
          '<button type="button" class="btn btn-outline" data-uic="cancel"></button>' +
          '<button type="button" class="btn" data-uic="ok"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(_el);

    _el.addEventListener('click', function (e) {
      if (e.target === _el) _done(false);                    // click nền = hủy
      var b = e.target.closest && e.target.closest('[data-uic]');
      if (b) _done(b.getAttribute('data-uic') === 'ok');
    });
    document.addEventListener('keydown', function (e) {
      if (_el && !_el.classList.contains('hidden') && e.key === 'Escape') _done(false);
    });
    return _el;
  }

  function _done(val) {
    if (_el) _el.classList.add('hidden');
    var r = _resolve; _resolve = null;
    if (r) r(!!val);
  }

  function uiConfirm(a, b, c, d) {
    var opt = (a && typeof a === 'object')
      ? a
      : { title: a, body: b, okLabel: c, danger: d };
    var title  = opt.title  || 'Xác nhận';
    var body   = opt.body   || 'Bạn có chắc muốn tiếp tục?';
    var okLbl  = opt.okLabel || 'Xác nhận';
    var cancel = opt.cancelLabel || 'Hủy';
    var danger = !!opt.danger;

    var el = _ensure();
    el.querySelector('#uiConfirmTitle').textContent = title;
    el.querySelector('#uiConfirmBody').innerHTML = _esc(body);
    var okBtn = el.querySelector('[data-uic="ok"]');
    okBtn.textContent = okLbl;
    okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    el.querySelector('[data-uic="cancel"].btn').textContent = cancel;
    el.classList.remove('hidden');
    setTimeout(function () { try { okBtn.focus(); } catch (e) {} }, 0);

    return new Promise(function (res) { _resolve = res; });
  }

  window.uiConfirm = uiConfirm;
})();
