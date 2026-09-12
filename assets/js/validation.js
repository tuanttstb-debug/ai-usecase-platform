/* ─────────────────────────────────────────
   Validator — form validation
   Preserved: step1(), step2(), all() — same logic, same API
   Added: markErrors() — highlight invalid fields after Next click
          clearErrors() — clear all error highlights
   ───────────────────────────────────────── */
var Validator = {

  // CR (2026-09-12): Đăng ký tối giản 1 bước.
  // Bắt buộc: Workflow (khi catalog đã nạp) + Use Case + Team + Action Plan ≥1 tháng.
  // Owner inject từ session lúc submit (không kiểm ở đây); nội dung nghiệp vụ/prompt/demo
  // đã dời sang màn "Cập nhật US".
  step1(data) {
    const err = [];
    // H2: Workflow bắt buộc — nhưng chỉ khi catalog đã nạp (offline không chặn đăng ký)
    if (typeof window !== 'undefined' && window.__WF_CATALOG_READY && !data[FIELDS.WORKFLOW]) {
      err.push('Vui lòng chọn Workflow');
    }
    if (!data[FIELDS.USE_CASE_NAME])   err.push('Tên Use Case không được để trống');
    if (!data[FIELDS.TEAM])            err.push('Vui lòng chọn Team');
    // Action Plan: bắt buộc điền ít nhất 1 tháng (T9–T12)
    var _planFields = [FIELDS.ACTION_PLAN_M09, FIELDS.ACTION_PLAN_M10, FIELDS.ACTION_PLAN_M11, FIELDS.ACTION_PLAN_M12];
    var _anyPlan = _planFields.some(function (f) { return data[f] && String(data[f]).trim(); });
    if (!_anyPlan) err.push('Vui lòng nhập Kế hoạch hành động cho ít nhất 1 tháng (T9–T12)');
    return err;
  },

  // step2 đã gỡ (không còn bước Luồng AI trong đăng ký).

  all(data) {
    return this.step1(data);
  },

  /* Mark form fields as invalid after clicking Next/Submit */
  markErrors(errors, currentStep) {
    // Map error message to field name for targeted highlighting
    const errorFieldMap = {
      'Workflow': FIELDS.WORKFLOW,
      'Tên Use Case': FIELDS.USE_CASE_NAME,
      'Team': FIELDS.TEAM,
      'Kế hoạch hành động': FIELDS.ACTION_PLAN_M09,
    };

    errors.forEach(errMsg => {
      const matchKey = Object.keys(errorFieldMap).find(k => errMsg.includes(k));
      if (!matchKey) return;
      const fieldName = errorFieldMap[matchKey];
      const wrapper = document.querySelector(`[data-field="${fieldName}"]`);
      if (!wrapper) return;
      wrapper.classList.add('has-error');
      const input = wrapper.querySelector('input, select, textarea');
      if (input) input.setAttribute('aria-invalid', 'true');
      const errorEl = wrapper.querySelector('.field-error');
      if (errorEl && !errorEl.textContent) errorEl.textContent = 'Trường này là bắt buộc';
    });
  },

  /* Clear all error highlights (call before re-validating) */
  clearErrors() {
    document.querySelectorAll('.form-group.has-error').forEach(wrapper => {
      wrapper.classList.remove('has-error');
      const input = wrapper.querySelector('input, select, textarea');
      if (input) input.removeAttribute('aria-invalid');
      const errorEl = wrapper.querySelector('.field-error');
      if (errorEl) errorEl.textContent = '';
    });
  }
};
