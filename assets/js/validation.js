/* ─────────────────────────────────────────
   Validator — form validation
   Preserved: step1(), step2(), all() — same logic, same API
   Added: markErrors() — highlight invalid fields after Next click
          clearErrors() — clear all error highlights
   ───────────────────────────────────────── */
var Validator = {

  step1(data) {
    const err = [];
    // H2: Workflow bắt buộc — nhưng chỉ khi catalog đã nạp (offline không chặn đăng ký)
    if (typeof window !== 'undefined' && window.__WF_CATALOG_READY && !data[FIELDS.WORKFLOW]) {
      err.push('Vui lòng chọn Workflow');
    }
    if (!data[FIELDS.USE_CASE_NAME])   err.push('Tên Use Case không được để trống');
    if (!data[FIELDS.OWNER_NAME])      err.push('Họ tên người đăng ký không được để trống');
    if (!data[FIELDS.TEAM])            err.push('Vui lòng chọn Team');
    if (!data[FIELDS.BUSINESS_CATEGORY]) err.push('Vui lòng chọn Lĩnh vực nghiệp vụ');
    if (!data[FIELDS.PAIN_POINT])      err.push('Vui lòng mô tả Điểm đau nghiệp vụ');
    if (!data[FIELDS.CURRENT_PROCESS]) err.push('Vui lòng mô tả Quy trình hiện tại');
    return err;
  },

  step2(data) {
    const err = [];
    if (!data[FIELDS.FLOW_DESC]) err.push('Vui lòng mô tả luồng xử lý AI');
    return err;
  },

  // step3 & step4: no required fields (optional enrichment data)

  all(data) {
    return [...this.step1(data), ...this.step2(data)];
  },

  /* Mark form fields as invalid after clicking Next/Submit */
  markErrors(errors, currentStep) {
    // Map error message to field name for targeted highlighting
    const errorFieldMap = {
      'Workflow': FIELDS.WORKFLOW,
      'Tên Use Case': FIELDS.USE_CASE_NAME,
      'người đăng ký': FIELDS.OWNER_NAME,
      'Team': FIELDS.TEAM,
      'Lĩnh vực': FIELDS.BUSINESS_CATEGORY,
      'Điểm đau': FIELDS.PAIN_POINT,
      'Quy trình': FIELDS.CURRENT_PROCESS,
      'luồng xử lý': FIELDS.FLOW_DESC,
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
