/* ─────────────────────────────────────────
   FormMapper — collect and populate form data
   Behavior preserved: same data structure, same API contract
   Compatible with: text, textarea, select, checkbox, number, email, url
   ───────────────────────────────────────── */
var FormMapper = {

  /* Collect all form field values into a flat object.
     Output format unchanged — string values, arrays joined as comma-separated. */
  collectData() {
    const form = document.getElementById('useCaseForm');
    const elements = form.querySelectorAll('input, select, textarea');
    const data = {};

    elements.forEach(el => {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        // Accumulate checked checkbox values into array
        if (el.checked) {
          if (!data[el.name]) data[el.name] = [];
          data[el.name].push(el.value);
        }
      } else {
        // Normalize CRLF → LF for textarea (Windows clipboard pastes \r\n)
        var raw = el.value;
        data[el.name] = el.tagName === 'TEXTAREA'
          ? raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          : raw;
      }
    });

    // Convert checkbox arrays to comma-separated strings (backend contract)
    Object.keys(data).forEach(key => {
      if (Array.isArray(data[key])) data[key] = data[key].join(', ');
    });

    return data;
  },

  /* Populate form fields from a data object (edit mode / draft restore).
     Works with: text input, textarea, select, number, email, url, checkbox groups. */
  populateData(data) {
    if (!data) return;
    const form = document.getElementById('useCaseForm');
    if (!form) return;

    Object.keys(data).forEach(key => {
      if (data[key] === undefined || data[key] === null) return;
      const value = String(data[key]);

      // Checkbox groups: find all checkboxes with this name
      const checkboxes = form.querySelectorAll(`input[type="checkbox"][name="${key}"]`);
      if (checkboxes.length > 0) {
        const values = value.split(',').map(v => v.trim()).filter(Boolean);
        checkboxes.forEach(cb => { cb.checked = values.includes(cb.value); });
        return;
      }

      // Single element (input, select, textarea)
      const el = form.querySelector(`[name="${key}"]`);
      if (el) el.value = value;
    });
  }
};
