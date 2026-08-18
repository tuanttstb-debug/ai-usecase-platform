/* ─────────────────────────────────────────
   Wizard — step navigation controller
   Behavior preserved: goTo, next, prev, updateNav, updateProgress, bindEvents
   Fixed: progress bar targets inner .progress-fill div
   Extended: step labels in indicators, step counter, step subtitle
   ───────────────────────────────────────── */
var Wizard = {
  currentStep: 1,
  totalSteps: STEPS.length,
  isEditMode: false,

  init() {
    this.renderIndicators();
    this.renderSteps();
    this.updateNav();
    this.updateProgress();
    this.bindEvents();
  },

  renderIndicators() {
    const container = document.getElementById('stepIndicators');
    container.innerHTML = STEPS.map(s =>
      `<div class="step-indicator-item" data-step="${s.id}">
        <span class="step-dot" data-step="${s.id}" role="img" aria-label="Bước ${s.id}: ${s.title}">${s.id}</span>
        <span class="step-dot-label">${s.shortTitle}</span>
      </div>`
    ).join('');
  },

  renderSteps() {
    const form = document.getElementById('useCaseForm');
    form.innerHTML = STEPS.map((step, idx) =>
      `<div class="step" data-step="${step.id}" style="display:${idx === 0 ? 'block' : 'none'}"
            role="group" aria-labelledby="step-title-${step.id}">
        <h2 id="step-title-${step.id}">${step.title}</h2>
        ${step.subtitle ? `<p class="step-subtitle">${step.subtitle}</p>` : ''}
        <div class="form-fields" id="fields-${step.id}"></div>
      </div>`
    ).join('');
    FieldBuilder.buildAll();
  },

  goTo(step) {
    if (step < 1 || step > this.totalSteps) return;
    document.querySelectorAll('.step').forEach(el => { el.style.display = 'none'; });
    const targetStep = document.querySelector(`.step[data-step="${step}"]`);
    if (targetStep) {
      targetStep.style.display = 'block';
      // Move focus to step heading for accessibility
      const heading = targetStep.querySelector('h2');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
    }
    this.currentStep = step;
    this.updateNav();
    this.updateProgress();
    // Scroll to top of wizard
    const wizard = document.getElementById('wizardCard');
    if (wizard) wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  next() { if (this.currentStep < this.totalSteps) this.goTo(this.currentStep + 1); },
  prev() { if (this.currentStep > 1) this.goTo(this.currentStep - 1); },

  updateNav() {
    const prevBtn    = document.getElementById('prevBtn');
    const nextBtn    = document.getElementById('nextBtn');
    const submitBtn  = document.getElementById('submitBtn');
    const counter    = document.getElementById('stepCounter');

    prevBtn.disabled = this.currentStep === 1;

    if (this.currentStep === this.totalSteps) {
      nextBtn.style.display   = 'none';
      submitBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display   = 'inline-flex';
      submitBtn.style.display = 'none';
    }

    if (counter) counter.textContent = `Bước ${this.currentStep} / ${this.totalSteps}`;
  },

  updateProgress() {
    // FIX: target the inner fill div (#progressBar), not the outer track
    const percent = (this.currentStep / this.totalSteps) * 100;
    const fill = document.getElementById('progressBar');
    if (fill) fill.style.width = percent + '%';

    // Update step indicators
    document.querySelectorAll('.step-indicator-item').forEach(item => {
      const s = parseInt(item.dataset.step);
      const dot = item.querySelector('.step-dot');
      dot.classList.toggle('active', s === this.currentStep);
      dot.classList.toggle('done',   s < this.currentStep);
      item.classList.toggle('is-active', s === this.currentStep);
      item.classList.toggle('is-done',   s < this.currentStep);

      // ARIA
      if (s === this.currentStep) {
        dot.setAttribute('aria-current', 'step');
      } else {
        dot.removeAttribute('aria-current');
      }
    });
  },

  bindEvents() {
    document.getElementById('prevBtn').addEventListener('click', () => this.prev());

    document.getElementById('nextBtn').addEventListener('click', () => {
      const data = FormMapper.collectData();
      let errors = [];
      if (this.currentStep === 1) errors = Validator.step1(data);
      else if (this.currentStep === 2) errors = Validator.step2(data);

      if (errors.length) {
        Toast.show(errors.join('\n'), 'error');
        // Mark invalid fields
        Validator.markErrors(errors, this.currentStep);
        return;
      }
      this.next();
    });
    // Submit is handled by app.js
  }
};

/* ─────────────────────────────────────────
   FieldBuilder — renders form fields from FIELD_CONFIG and GROUP_CONFIG
   Behavior contract:
     - form element `name` attributes are UNCHANGED (API contract preserved)
     - collectData() and populateData() in FormMapper work as before
     - checkbox groups: same name, multiple inputs (preserved)
     - select: same name, collects via el.value (works for FormMapper)
     - textarea: same name, collects via el.value (works for FormMapper)
   ───────────────────────────────────────── */
var FieldBuilder = {

  buildAll() {
    STEPS.forEach(step => {
      const container = document.getElementById(`fields-${step.id}`);
      if (!container) return;
      const groups = this._groupFields(step.fields);
      groups.forEach(({ groupId, fields }) => {
        const groupConfig = GROUP_CONFIG[groupId] || { label: null };
        const groupEl = this._renderGroup(groupId, groupConfig, fields);
        container.appendChild(groupEl);
      });
    });

    this._bindDuplicateCheck();
    this._bindConditionals();
    this._bindWorkflowCascade();
  },

  /* Group fields by their GROUP_CONFIG key, preserving order of first occurrence */
  _groupFields(fields) {
    const order = [];
    const map = {};
    fields.forEach(fieldName => {
      const config = FIELD_CONFIG[fieldName] || {};
      const groupId = config.group || '_default';
      if (!map[groupId]) {
        map[groupId] = [];
        order.push(groupId);
      }
      map[groupId].push(fieldName);
    });
    return order.map(groupId => ({ groupId, fields: map[groupId] }));
  },

  /* Render a group of fields, with optional section header and collapsible wrapper */
  _renderGroup(groupId, groupConfig, fields) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-group';
    wrapper.dataset.groupId = groupId;

    if (groupConfig.collapsible) {
      // Collapsible section using <details>
      const details = document.createElement('details');
      details.className = 'collapsible-section';
      if (!groupConfig.collapsed) details.open = true;

      const summary = document.createElement('summary');
      summary.innerHTML = `
        <span class="collapsible-title">${groupConfig.label || ''}</span>
        ${groupConfig.hint ? `<span class="collapsible-hint">${groupConfig.hint}</span>` : ''}
        <span class="collapsible-chevron">▼</span>
      `;
      details.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'collapsible-body';
      fields.forEach(name => body.appendChild(this._createField(name)));
      details.appendChild(body);
      wrapper.appendChild(details);

    } else {
      // Regular group with optional header
      if (groupConfig.label) {
        const header = document.createElement('div');
        header.className = 'section-header';
        header.textContent = groupConfig.label;
        wrapper.appendChild(header);
      }
      fields.forEach(name => wrapper.appendChild(this._createField(name)));
    }

    return wrapper;
  },

  /* Create a single form field element from FIELD_CONFIG */
  _createField(name) {
    const config = FIELD_CONFIG[name];
    if (!config) {
      // Fallback for any field not in FIELD_CONFIG
      return this._createFallbackField(name);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    wrapper.dataset.field = name;
    if (config.conditional) {
      wrapper.dataset.conditional = JSON.stringify(config.conditional);
    }

    // Unique ID for label ↔ input linkage
    const fieldId = `field_${name}`;

    // Label
    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = fieldId;
    label.textContent = config.label || name.replace(/_/g, ' ');
    if (config.required) {
      const req = document.createElement('span');
      req.className = 'field-required-mark';
      req.textContent = '*';
      req.setAttribute('aria-label', 'bắt buộc');
      label.appendChild(req);
    }
    wrapper.appendChild(label);

    // Input element
    const inputEl = this._createInputElement(name, config, fieldId);
    wrapper.appendChild(inputEl);

    // Helper text
    if (config.helper) {
      const helper = document.createElement('span');
      helper.className = 'field-helper';
      helper.id = `${fieldId}_helper`;
      helper.textContent = config.helper;
      if (inputEl.tagName !== 'DIV') {
        inputEl.setAttribute('aria-describedby', `${fieldId}_helper`);
      }
      wrapper.appendChild(helper);
    }

    // Inline error placeholder
    const errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.id = `${fieldId}_error`;
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    wrapper.appendChild(errorEl);

    // Inline validation on blur for required fields
    if (config.required) {
      this._bindInlineValidation(inputEl, config, wrapper, fieldId);
    }

    return wrapper;
  },

  /* Create the actual input/textarea/select/checkbox element */
  _createInputElement(name, config, fieldId) {
    const { type, placeholder, rows, suffix, options, lookupKey } = config;

    if (type === 'checkbox') {
      return this._createCheckboxGroup(name, config, fieldId);
    }

    if (type === 'select') {
      return this._createSelect(name, config, fieldId);
    }

    if (type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.id = name === ta.id ? name : fieldId;
      ta.name = name;
      ta.rows = rows || 3;
      if (placeholder) ta.placeholder = placeholder;
      if (config.required) ta.required = true;
      ta.setAttribute('aria-required', config.required ? 'true' : 'false');
      return ta;
    }

    if (type === 'number' && suffix) {
      // Number + suffix unit wrapper
      const wrap = document.createElement('div');
      wrap.className = 'input-with-suffix';
      const input = document.createElement('input');
      input.type = 'number';
      input.id = fieldId;
      input.name = name;
      input.min = '0';
      if (placeholder) input.placeholder = placeholder;
      const sfx = document.createElement('span');
      sfx.className = 'input-suffix';
      sfx.textContent = suffix;
      sfx.setAttribute('aria-hidden', 'true');
      wrap.appendChild(input);
      wrap.appendChild(sfx);
      return wrap;
    }

    // Default: text / email / url / number
    const input = document.createElement('input');
    input.type = type || 'text';
    input.id = fieldId;
    input.name = name;
    if (placeholder) input.placeholder = placeholder;
    if (config.required) input.required = true;
    input.setAttribute('aria-required', config.required ? 'true' : 'false');
    if (type === 'email') input.autocomplete = 'email';
    return input;
  },

  _createSelect(name, config, fieldId) {
    const wrap = document.createElement('div');
    wrap.className = 'select-wrapper';

    const select = document.createElement('select');
    select.id = fieldId;
    select.name = name;
    if (config.required) select.required = true;
    select.setAttribute('aria-required', config.required ? 'true' : 'false');

    // Blank placeholder option
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— Chọn —';
    blank.disabled = true;
    blank.selected = true;
    select.appendChild(blank);

    const sourceOptions = config.options
      || (window.__LOOKUP && window.__LOOKUP[config.lookupKey])
      || [];

    sourceOptions.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

    // data-lookup cho rebuildLookupFields() trong app.js
    if (config.lookupKey) select.dataset.lookup = config.lookupKey;

    wrap.appendChild(select);
    return wrap;
  },

  _createCheckboxGroup(name, config, fieldId) {
    const lookup = window.__LOOKUP || {};
    const sourceOptions = config.options
      || lookup[config.lookupKey]
      || [];

    const group = document.createElement('div');
    group.className = 'checkbox-group';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', `${fieldId}_label`);
    // data-lookup và data-field-name cho rebuildLookupFields() trong app.js
    // data-field-name là bắt buộc để rebuild khi group ban đầu rỗng (không có input nào)
    if (config.lookupKey) group.dataset.lookup = config.lookupKey;
    group.dataset.fieldName = name;

    sourceOptions.forEach((opt, i) => {
      const pill = document.createElement('div');
      pill.className = 'checkbox-pill';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `${fieldId}_${i}`;
      cb.name = name;
      cb.value = opt;

      const lbl = document.createElement('label');
      lbl.htmlFor = cb.id;
      lbl.textContent = opt;

      pill.appendChild(cb);
      pill.appendChild(lbl);
      group.appendChild(pill);
    });

    return group;
  },

  _createFallbackField(name) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    wrapper.dataset.field = name;
    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = name.replace(/_/g, ' ');
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.id = `field_${name}`;
    label.htmlFor = input.id;
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  },

  /* Inline validation: required field check on blur */
  _bindInlineValidation(inputEl, config, wrapper, fieldId) {
    const actualInput = inputEl.tagName === 'DIV'
      ? inputEl.querySelector('input, select, textarea')
      : inputEl;
    if (!actualInput) return;

    const errorEl = wrapper.querySelector('.field-error');

    const validate = () => {
      const val = actualInput.value.trim();
      if (!val) {
        wrapper.classList.add('has-error');
        actualInput.setAttribute('aria-invalid', 'true');
        if (errorEl) errorEl.textContent = 'Trường này là bắt buộc';
      } else {
        this._clearFieldError(wrapper, actualInput, errorEl);
      }
    };

    actualInput.addEventListener('blur', validate);
    actualInput.addEventListener('input', () => {
      if (actualInput.value.trim()) {
        this._clearFieldError(wrapper, actualInput, errorEl);
      }
    });
  },

  _clearFieldError(wrapper, input, errorEl) {
    wrapper.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
    if (errorEl) errorEl.textContent = '';
  },

  /* Duplicate check binding (behavior preserved from original) */
  _bindDuplicateCheck() {
    const nameInput = document.querySelector(`[name="${FIELDS.USE_CASE_NAME}"]`);
    if (!nameInput) return;
    nameInput.addEventListener('blur', debounce(() => {
      const pain = document.querySelector(`[name="${FIELDS.PAIN_POINT}"]`);
      DuplicateChecker.check(nameInput.value, pain ? pain.value : '');
    }, 600));
  },

  /* Conditional field visibility: Demo_Link hides when Demo_Status = "Chưa có" */
  _bindConditionals() {
    document.querySelectorAll('[data-conditional]').forEach(wrapper => {
      try {
        const cond      = JSON.parse(wrapper.dataset.conditional);
        const triggerEl = document.querySelector(`[name="${cond.field}"]`);
        if (!triggerEl) return;

        const update = () => {
          const hide = triggerEl.value === cond.notValue || triggerEl.value === '';
          wrapper.style.display = hide ? 'none' : '';

          // FIX: Clear value khi field bị ẩn → tránh submit data không hợp lệ
          // (VD: Demo_Link = "111111111" khi Demo_Status = "Chưa có")
          if (hide) {
            const input = wrapper.querySelector('input, select, textarea');
            if (input) input.value = '';
          }
        };

        triggerEl.addEventListener('change', update);
        update(); // initial state
      } catch (_) { /* ignore parse errors */ }
    });
  },

  /* Expose for app.js to call after populateData (re-evaluate conditionals) */
  refreshConditionals() {
    this._bindConditionals();
  },

  /* ─────────────────────────────────────────
     H2 Giai đoạn 2 — Workflow → Use case dependent dropdown
     - Workflow select (name=Workflow): options nạp từ window.__WF_CATALOG (lọc theo Team ở GAS)
     - UseCase_Name select: options phụ thuộc Workflow đã chọn + option "Khác — nhập tự do"
     - Khi chọn "Khác": hiện ô text; carrier name="UseCase_Name" chuyển sang ô text
       (đảm bảo LUÔN chỉ có đúng 1 phần tử mang name="UseCase_Name" để collectData không nhầm)
     ───────────────────────────────────────── */
  _wfOther: '__OTHER__',

  _bindWorkflowCascade() {
    var self  = this;
    var wfSel  = document.getElementById('field_Workflow');
    var ucSel  = document.getElementById('field_UseCase_Name');
    if (!wfSel || !ucSel) return;

    // Tạo ô text tự do (ẩn) cho lựa chọn "Khác"
    if (!document.getElementById('field_UseCase_Name_custom')) {
      var custom = document.createElement('input');
      custom.type = 'text';
      custom.id   = 'field_UseCase_Name_custom';
      custom.name = 'UseCase_Name__custom';   // inert cho tới khi chọn "Khác"
      custom.placeholder = 'Nhập tên Use case mới…';
      custom.style.display   = 'none';
      custom.style.marginTop = 'var(--space-2)';
      var wrapper = ucSel.closest('.select-wrapper');
      if (wrapper && wrapper.parentNode) wrapper.parentNode.insertBefore(custom, wrapper.nextSibling);
      else if (ucSel.parentNode) ucSel.parentNode.appendChild(custom);
    }

    wfSel.addEventListener('change', function () { self._populateUseCaseOptions(wfSel.value); });
    ucSel.addEventListener('change', function () { self._syncUseCaseCustom(); });

    if (window.__WF_CATALOG) this.applyWorkflowCatalog();
  },

  /* Nạp options cho Workflow select từ catalog (optgroup theo Nhóm). Giữ giá trị đang chọn. */
  applyWorkflowCatalog() {
    var cat   = window.__WF_CATALOG || { groups: [] };
    var wfSel = document.getElementById('field_Workflow');
    if (!wfSel) return;
    var current = wfSel.value;
    while (wfSel.options.length > 1) wfSel.remove(1);   // giữ option "— Chọn —"
    (cat.groups || []).forEach(function (g) {
      if (!g.workflows || !g.workflows.length) return;
      var og = document.createElement('optgroup');
      og.label = g.nhom;
      g.workflows.forEach(function (w) {
        var opt = document.createElement('option');
        opt.value = w.name; opt.textContent = w.name;
        og.appendChild(opt);
      });
      wfSel.appendChild(og);
    });
    window.__WF_CATALOG_READY = !!(cat.groups && cat.groups.length);
    if (current) wfSel.value = current;
    this._populateUseCaseOptions(wfSel.value);
  },

  _wfUseCases(workflowName) {
    var cat = window.__WF_CATALOG;
    if (!cat || !cat.groups || !workflowName) return [];
    for (var i = 0; i < cat.groups.length; i++) {
      var ws = cat.groups[i].workflows || [];
      for (var j = 0; j < ws.length; j++) {
        if (ws[j].name === workflowName) return ws[j].usecases || [];
      }
    }
    return [];
  },

  /* Nạp options UseCase_Name theo Workflow đã chọn + luôn thêm "Khác — nhập tự do". */
  _populateUseCaseOptions(workflowName) {
    var ucSel = document.getElementById('field_UseCase_Name');
    if (!ucSel) return;
    var current = ucSel.value;
    while (ucSel.options.length > 1) ucSel.remove(1);   // giữ option "— Chọn —"
    this._wfUseCases(workflowName).forEach(function (uc) {
      var o = document.createElement('option');
      o.value = uc; o.textContent = uc;
      ucSel.appendChild(o);
    });
    var other = document.createElement('option');
    other.value = this._wfOther; other.textContent = 'Khác — nhập tự do';
    ucSel.appendChild(other);
    // Giữ lại lựa chọn cũ nếu còn hợp lệ
    var keep = Array.prototype.some.call(ucSel.options, function (o) { return o.value === current; });
    if (current && keep) ucSel.value = current;
    this._syncUseCaseCustom();
  },

  /* Đồng bộ ô text tự do + carrier name="UseCase_Name" theo lựa chọn hiện tại. */
  _syncUseCaseCustom() {
    var ucSel  = document.getElementById('field_UseCase_Name');
    var custom = document.getElementById('field_UseCase_Name_custom');
    if (!ucSel || !custom) return;
    if (ucSel.value === this._wfOther) {
      custom.style.display = '';
      custom.name = 'UseCase_Name';        // ô text trở thành carrier
      ucSel.name  = 'UseCase_Name__pick';  // select tạm rời khỏi collectData
    } else {
      custom.style.display = 'none';
      custom.value = '';
      custom.name = 'UseCase_Name__custom';
      ucSel.name  = 'UseCase_Name';         // select là carrier
    }
  },

  /* Áp lại lựa chọn Workflow/UseCase khi edit/khôi phục nháp (gọi sau khi catalog đã nạp). */
  syncWorkflowSelection(workflowVal, usecaseVal) {
    var wfSel  = document.getElementById('field_Workflow');
    var ucSel  = document.getElementById('field_UseCase_Name');
    var custom = document.getElementById('field_UseCase_Name_custom');
    if (wfSel && workflowVal) {
      wfSel.value = workflowVal;
      this._populateUseCaseOptions(workflowVal);
    }
    if (ucSel && usecaseVal) {
      var has = Array.prototype.some.call(ucSel.options, function (o) { return o.value === usecaseVal; });
      ucSel.value = has ? usecaseVal : this._wfOther;
      this._syncUseCaseCustom();
      if (!has && custom) custom.value = usecaseVal;   // US ngoài danh mục → nhập tự do
    }
  }
};
