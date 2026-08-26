// ─────────────────────────────────────────────────────────────────
// score-slider.js — Component chuẩn hóa thanh kéo chấm điểm (CR#3, 2026-08-26)
//
// Dùng chung cho MỌI màn chấm điểm (chấm cá nhân + hội đồng review-queue):
//   • Giá trị hiển thị NGAY TRÊN thanh (bong bóng theo núm kéo) → tiết kiệm diện tích,
//     bỏ nhãn giá trị chiếm dòng riêng.
//   • Căn lề chuẩn: bong bóng bám núm, không tràn 2 mép.
//   • Mặc định 0 khi chấm mới (do trang set value=0); giữ điểm đã lưu khi sửa (trang set value=saved).
//
// API: ScoreSlider.enhance(el) · ScoreSlider.enhanceAll(scope) · ScoreSlider.refresh(el)
//   - enhance: bọc 1 input.range, gắn bong bóng + cập nhật khi kéo.
//   - refresh: cập nhật bong bóng sau khi set .value bằng code (không phát 'input').
// ─────────────────────────────────────────────────────────────────
(function (root) {
  'use strict';

  function _pct(el) {
    var min = parseFloat(el.min); if (isNaN(min)) min = 0;
    var max = parseFloat(el.max); if (isNaN(max)) max = 100;
    var v = parseFloat(el.value); if (isNaN(v)) v = min;
    return max > min ? ((v - min) / (max - min)) * 100 : 0;
  }

  function _position(el, bubble) {
    var p = _pct(el);
    bubble.textContent = el.value;
    // Bù bán kính núm (~16px) để bong bóng không tràn mép: dịch (8 - p*0.16)px.
    bubble.style.left = 'calc(' + p + '% + ' + (8 - p * 0.16) + 'px)';
  }

  function enhance(el) {
    if (!el || el.__ssEnhanced) { refresh(el); return; }
    el.__ssEnhanced = true;
    var wrap = document.createElement('span');
    wrap.className = 'score-slider-wrap';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    var bubble = document.createElement('output');
    bubble.className = 'score-slider-bubble';
    wrap.appendChild(bubble);
    var upd = function () { _position(el, bubble); };
    el.addEventListener('input', upd);
    el.__ssUpdate = upd;
    upd();
  }

  function refresh(el) { if (el && el.__ssUpdate) el.__ssUpdate(); }

  function enhanceAll(scope) {
    var list = (scope || document).querySelectorAll('.score-slider');
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }

  root.ScoreSlider = { enhance: enhance, enhanceAll: enhanceAll, refresh: refresh };

})(typeof window !== 'undefined' ? window : this);
