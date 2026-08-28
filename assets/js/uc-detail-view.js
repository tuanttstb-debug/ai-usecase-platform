// ─────────────────────────────────────────────────────────────────
// uc-detail-view.js — Bộ render chi tiết Use Case dùng chung
//
// Tách từ dashboard.js (_renderDetailBody + helpers) để các trang khác
// (review-queue…) tái dùng cùng một layout chi tiết, tránh trùng lặp.
//
// Dùng chung các class CSS `detail-section` / `detail-field` … đã có trong
// dashboard.css (mọi trang import stylesheet này).
//
// API:
//   UCDetailView.normalize(rawGasObject)  → object field thường hoá (snake_case)
//   UCDetailView.render(uc)               → HTML string các mục chi tiết
//   UCDetailView.hasPrompt(uc)            → bool (có dữ liệu prompt không)
//   UCDetailView.buildPromptText(uc)      → string prompt gộp (để copy)
//   UCDetailView._copyB64(b64)            → copy link nội bộ (dùng trong onclick)
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d)) return String(v);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Chuẩn hoá object thô từ GAS (getUseCase) → field snake_case FE dùng.
  function normalize(d) {
    if (!d) return {};
    return {
      record_id:            d.Record_ID              || '',
      usecase_id:           d.UseCase_ID             || '',
      name:                 d.UseCase_Name           || '',
      owner_name:           d.Owner_Name             || '',
      owner_email:          d.Owner_Email            || '',
      team:                 d.Team                   || '',
      category:             d.Business_Category      || '',
      stage:                d.Current_Stage          || '',
      status:               d.Status                 || '',
      submit_date:          d.Submit_Date            || d.Created_At || '',
      pain_point:           d.Pain_Point             || '',
      current_process:      d.Current_Process        || '',
      current_time_min:     d.Current_Time_Min       || '',
      current_problem:      d.Current_Problem        || '',
      user_type:            d.User_Type              || '',
      expected_goals:       d.Expected_Goals         || '',
      flow_description:     d.Flow_Description        || '',
      input_types:          d.Input_Types            || '',
      prompt_role:          d.Prompt_Role            || '',
      prompt_task:          d.Prompt_Task            || '',
      prompt_goal:          d.Prompt_Goal            || '',
      prompt_context:       d.Prompt_Context         || '',
      prompt_input:         d.Prompt_Input           || '',
      prompt_steps:         d.Prompt_Steps           || '',
      prompt_output_format: d.Prompt_Output_Format   || '',
      prompt_evaluation:    d.Prompt_Evaluation      || '',
      demo_status:          d.Demo_Status            || '',
      demo_link:            d.Demo_Link              || '',
      before_time_min:      d.Before_Time_Min        || '',
      after_time_min:       d.After_Time_Min         || '',
      quality_improvement:  d.Quality_Improvement    || '',
      improvement_note:     d.Improvement_Note       || '',
      reuse_level:          d.Reuse_Level            || '',
      reuse_adjustment:     d.Reuse_Adjustment       || '',
      when_to_use:          d.When_To_Use            || '',
      usage_steps:          d.Usage_Steps            || '',
      usage_notes:          d.Usage_Notes            || '',
      review_comment:       d.Review_Comment         || '',
      reviewer_email:       d.Reviewer               || d.reviewer_email || '',
      total_score:          (parseFloat(d.Total_Score || d.total_score) || 0)
    };
  }

  // ── Render helpers ──────────────────────────────────────────────
  function _dsection(step, title, parts, extra) {
    var body = parts.join('');
    if (!body.trim()) return '';
    return '<div class="detail-section ' + (extra || '') + '">' +
      '<div class="detail-section-title">' +
        '<span class="detail-step-badge">' + step + '</span>' +
        '<span>' + esc(title) + '</span>' +
      '</div>' +
      '<div class="detail-section-body">' + body + '</div>' +
    '</div>';
  }

  function _dsubsec(title, parts) {
    var body = parts.join('');
    if (!body.trim()) return '';
    return '<div class="detail-subsection">' +
      '<div class="detail-subsection-title">' + esc(title) + '</div>' +
      '<div class="detail-section-body">' + body + '</div>' +
    '</div>';
  }

  function _dgrid(pairs) {
    var cells = pairs.filter(function (p) { return p[1] && String(p[1]).trim(); });
    if (!cells.length) return '';
    return '<div class="detail-grid-2col">' +
      cells.map(function (p) {
        return '<div class="detail-field">' +
          '<div class="detail-label">' + esc(p[0]) + '</div>' +
          '<div class="detail-value">'  + esc(String(p[1])) + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function _dfield(label, value, pre) {
    if (!value && value !== 0) return '';
    var val = String(value).trim();
    if (!val) return '';
    return '<div class="detail-field detail-field--full">' +
      '<div class="detail-label">' + esc(label) + '</div>' +
      '<div class="detail-value' + (pre ? ' detail-value--pre' : '') + '">' + esc(val) + '</div>' +
    '</div>';
  }

  function _demoLinkHtml(url) {
    var raw = String(url == null ? '' : url).trim();
    if (!raw) return '';
    var b64 = '';
    try { b64 = btoa(unescape(encodeURIComponent(raw))); } catch (_e) { b64 = ''; }
    var body;
    if (/^https?:\/\//i.test(raw)) {
      body = '<a href="' + encodeURI(raw) + '" target="_blank" rel="noopener noreferrer" class="demo-link">' + esc(raw) + ' ↗</a>';
    } else {
      body = '<span class="demo-link demo-link--nonweb" title="Link nội bộ / ổ chung — bấm Copy rồi mở bằng File Explorer">' + esc(raw) + '</span>';
    }
    var copyBtn = b64 ? ' <button type="button" class="demo-copy-btn" onclick="UCDetailView._copyB64(\'' + b64 + '\')">📋 Copy</button>' : '';
    return body + copyBtn;
  }

  function _demoField(label, url) {
    var inner = _demoLinkHtml(url);
    if (!inner) return '';
    return '<div class="detail-field detail-field--full">' +
      '<div class="detail-label">' + esc(label) + '</div>' +
      '<div class="detail-value detail-value--demo">' + inner + '</div>' +
    '</div>';
  }

  function hasPrompt(uc) {
    return !!(uc && (uc.prompt_role || uc.prompt_task || uc.prompt_goal || uc.prompt_context ||
                     uc.prompt_input || uc.prompt_steps || uc.prompt_output_format || uc.prompt_evaluation));
  }

  function buildPromptText(uc) {
    var parts = [];
    if (uc.prompt_role)          parts.push('# Vai trò (Role)\n'                    + uc.prompt_role);
    if (uc.prompt_task)          parts.push('# Nhiệm vụ (Task)\n'                   + uc.prompt_task);
    if (uc.prompt_goal)          parts.push('# Mục tiêu (Goal)\n'                   + uc.prompt_goal);
    if (uc.prompt_context)       parts.push('# Ngữ cảnh (Context)\n'               + uc.prompt_context);
    if (uc.prompt_input)         parts.push('# Đầu vào (Input)\n'                   + uc.prompt_input);
    if (uc.prompt_steps)         parts.push('# Các bước xử lý (Steps)\n'           + uc.prompt_steps);
    if (uc.prompt_output_format) parts.push('# Định dạng đầu ra (Output Format)\n' + uc.prompt_output_format);
    if (uc.prompt_evaluation)    parts.push('# Tiêu chí đánh giá (Evaluation)\n'   + uc.prompt_evaluation);
    return parts.join('\n\n');
  }

  // Render toàn bộ thân chi tiết. `opts.hideScore` bỏ mục Điểm US (review panel
  // đã có khối điểm hội đồng riêng bên cột phải → tránh lặp).
  function render(uc, opts) {
    opts = opts || {};
    var html = '';

    // ── 1: Thông tin nghiệp vụ ──
    html += _dsection('1', 'Thông tin nghiệp vụ', [
      _dgrid([
        ['Người đăng ký', uc.owner_name],
        ['Team',          uc.team],
        ['Lĩnh vực',      uc.category],
        ['Giai đoạn',     uc.stage],
        ['Ngày nộp',      fmtDate(uc.submit_date || uc.submitted_at)]
      ]),
      _dfield('Điểm đau nghiệp vụ', uc.pain_point,      true),
      _dfield('Quy trình hiện tại',  uc.current_process, true),
      _dgrid([
        ['Thời gian xử lý hiện tại', uc.current_time_min ? uc.current_time_min + ' phút' : ''],
        ['Hệ quả / Rủi ro',          uc.current_problem]
      ]),
      _dfield('Đối tượng sử dụng', uc.user_type,      false),
      _dfield('Mục tiêu kỳ vọng',  uc.expected_goals, false)
    ]);

    // ── 2: Luồng AI & Prompt ──
    var s2 = _dfield('Mô tả luồng xử lý AI', uc.flow_description, true) +
             _dfield('Loại dữ liệu đầu vào',  uc.input_types,      false) +
             _dsubsec('Thiết kế Prompt', [
               _dfield('Vai trò AI (Role)',              uc.prompt_role,          true),
               _dfield('Nhiệm vụ cụ thể (Task)',         uc.prompt_task,          true),
               _dfield('Mục tiêu đầu ra (Goal)',         uc.prompt_goal,          true),
               _dfield('Ngữ cảnh bổ sung (Context)',     uc.prompt_context,       true),
               _dfield('Mô tả đầu vào (Input)',          uc.prompt_input,         true),
               _dfield('Các bước xử lý (Steps)',         uc.prompt_steps,         true),
               _dfield('Định dạng đầu ra (Output)',      uc.prompt_output_format, true),
               _dfield('Tiêu chí đánh giá (Evaluation)', uc.prompt_evaluation,    true)
             ]);
    if (s2.trim()) html += _dsection('2', 'Luồng AI & Prompt', [s2]);

    // ── 3: Demo & Tái sử dụng ──
    var timeSaved = '';
    if (uc.before_time_min && uc.after_time_min) {
      var before = parseFloat(uc.before_time_min), after = parseFloat(uc.after_time_min);
      if (before > 0) timeSaved = ' (' + Math.round(((before - after) / before) * 100) + '% tiết kiệm)';
    }
    var s3 = _dgrid([
               ['Trạng thái demo',           uc.demo_status],
               ['Thời gian trước khi có AI', uc.before_time_min ? uc.before_time_min + ' phút' : ''],
               ['Thời gian sau khi có AI',   uc.after_time_min  ? uc.after_time_min  + ' phút' + timeSaved : '']
             ]) +
             _demoField('Link demo / tài liệu', uc.demo_link) +
             _dfield('Cải thiện chất lượng',                  uc.quality_improvement, true) +
             _dfield('Ghi chú thêm về hiệu quả',              uc.improvement_note,    true) +
             _dfield('Phạm vi tái sử dụng',                   uc.reuse_level,         false) +
             _dfield('Hướng dẫn điều chỉnh khi tái sử dụng', uc.reuse_adjustment,     true);
    if (s3.trim()) html += _dsection('3', 'Demo & Tái sử dụng', [s3]);

    // ── 4: Hướng dẫn sử dụng ──
    var s4 = _dfield('Khi nào nên dùng use case này?', uc.when_to_use, true) +
             _dfield('Hướng dẫn thực hiện từng bước',  uc.usage_steps, true) +
             _dfield('Lưu ý & hạn chế',                uc.usage_notes, true);
    if (s4.trim()) html += _dsection('4', 'Hướng dẫn sử dụng', [s4]);

    return html || '<p class="empty-state-text" style="padding:var(--space-6)">Không có nội dung chi tiết</p>';
  }

  function _copyText(text) {
    if (!text) return;
    var done = function () { if (window.Toast) Toast.show('Đã copy', 'success'); };
    var fail = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { if (window.Toast) Toast.show('Không copy được', 'error'); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
    else fail();
  }

  window.UCDetailView = {
    normalize:       normalize,
    render:          render,
    hasPrompt:       hasPrompt,
    buildPromptText: buildPromptText,
    copyPrompt:      function (uc) { var t = buildPromptText(uc); if (t) _copyText(t); else if (window.Toast) Toast.show('Use case này chưa có prompt', 'info'); },
    _copyB64:        function (b64) { try { _copyText(decodeURIComponent(escape(atob(b64)))); } catch (_e) {} }
  };

})();
