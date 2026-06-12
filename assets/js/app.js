(function () {
  var currentRecordId  = null;
  // Lưu data edit mode để re-apply sau khi lookup rebuild xong (fix race condition)
  var _pendingEditData = null;
  // Pre-fetch lúc load để không block submit critical path (phương án 3 — giảm timeout)
  var _preloadedNextId = null;

  /* ── Entry Point ── */
  async function init() {
    showLoading(true, 'Đang khởi tạo...');
    try {

      // 1. Render form ngay lập tức (không cần đợi GAS)
      //    Form dùng lookup defaults từ FIELD_CONFIG nếu GAS chưa load
      Wizard.init();

      // Auto-fill và lock trường người đăng ký từ user đã đăng nhập
      _autoFillOwner();

      // 2. Load lookup data và next ID từ GAS (background, song song)
      loadLookupData(); // async, không block

      // 3. Edit mode hay new mode
      const params = new URLSearchParams(window.location.search);
      if (params.has('edit')) {
        currentRecordId = params.get('edit');
        showLoading(true, 'Đang tải use case...');
        try {
          const data = await Api.getUseCase(currentRecordId);
          _pendingEditData = data; // Lưu để rebuildLookupFields có thể re-apply
          Wizard.isEditMode = true;
          FormMapper.populateData(data);
          FieldBuilder.refreshConditionals();
          showEditModeBanner(currentRecordId);
        } catch (editErr) {
          Toast.show('Không tải được use case: ' + editErr.message, 'error');
        }
      } else {
        const draft = Storage.load();
        if (draft) showDraftBanner(draft);
        // ID sẽ được fetch và gắn vào payload lúc submit (không hiện sớm để tránh stale)
      }

      // 4. Autosave
      document.getElementById('useCaseForm').addEventListener('change', () => {
        Storage.save(FormMapper.collectData());
        showAutosaveBadge();
      });

      // 5. Submit
      document.getElementById('submitBtn').addEventListener('click', submitForm);

    } catch (err) {
      Toast.show('Lỗi khởi tạo: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /* ── Auto-fill owner fields từ session user ── */
  function _autoFillOwner() {
    if (typeof AuthService === 'undefined') return;
    var user = AuthService.getUser();
    if (!user) return;
    // Chỉ auto-fill khi không phải edit mode (edit mode đã có data riêng)
    var params = new URLSearchParams(window.location.search);
    if (params.has('edit')) return;
    FormMapper.populateData({
      Owner_Name: user.displayName || user.email
    });
  }

  /* ── Load lookup data + pre-fetch nextId song song (không block form render) ── */
  async function loadLookupData() {
    // Fetch lookup và nextId đồng thời — cả 2 là read ops, không phụ thuộc nhau
    const [lookupResult, idResult] = await Promise.allSettled([
      Api.getLookup(),
      Api.getNextId()
    ]);

    if (lookupResult.status === 'fulfilled') {
      window.__LOOKUP = lookupResult.value;
      rebuildLookupFields();
    } else {
      console.warn('Không load được lookup từ GAS, dùng defaults:', lookupResult.reason.message);
      Toast.show(
        'Không kết nối được server.\nForm dùng dữ liệu mặc định — vẫn có thể điền và gửi.\n(' + lookupResult.reason.message + ')',
        'warning',
        8000
      );
    }

    if (idResult.status === 'fulfilled' && idResult.value && idResult.value.next_id) {
      _preloadedNextId = idResult.value.next_id;
    }
  }

  /* ── Rebuild select/checkbox sau khi lookup load xong ── */
  function rebuildLookupFields() {
    const lookup = window.__LOOKUP;
    if (!lookup) return;

    // Rebuild các select dùng lookupKey
    document.querySelectorAll('select[data-lookup]').forEach(select => {
      const key = select.dataset.lookup;
      const options = lookup[key];
      if (!options || !options.length) return;
      const currentVal = select.value;
      // Giữ option đầu tiên (-- Chọn --) rồi thêm options mới
      while (select.options.length > 1) select.remove(1);
      options.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        select.appendChild(opt);
      });
      if (currentVal) select.value = currentVal;
    });

    // Rebuild checkbox groups dùng lookupKey
    // FIX BUG-A: dùng data-field-name (luôn set lúc tạo) thay vì querySelector input
    // querySelector trả null khi group được render rỗng (window.__LOOKUP chưa load)
    document.querySelectorAll('.checkbox-group[data-lookup]').forEach(group => {
      const key     = group.dataset.lookup;
      const options = lookup[key];
      if (!options || !options.length) return;
      const fieldName = group.dataset.fieldName
                     || group.querySelector('input[type="checkbox"]')?.name;
      if (!fieldName) return;
      const checkedVals = Array.from(group.querySelectorAll('input:checked')).map(cb => cb.value);
      group.innerHTML = '';
      options.forEach((opt, i) => {
        const pill  = document.createElement('div');
        pill.className = 'checkbox-pill';
        const cb    = document.createElement('input');
        cb.type  = 'checkbox';
        cb.id    = 'field_' + fieldName + '_' + i;
        cb.name  = fieldName;
        cb.value = opt;
        if (checkedVals.includes(opt)) cb.checked = true;
        const lbl   = document.createElement('label');
        lbl.htmlFor = cb.id;
        lbl.textContent = opt;
        pill.appendChild(cb); pill.appendChild(lbl);
        group.appendChild(pill);
      });
    });

    // FIX BUG-B: Re-apply edit data sau khi rebuild (fix race condition)
    // Nếu getUseCase() resolve trước getLookup(), select values có thể bị xoá
    // khi rebuild options. Re-populate ở đây đảm bảo data không bị mất.
    if (_pendingEditData) {
      FormMapper.populateData(_pendingEditData);
    }
  }

  /* ── Form Submission ── */
  async function submitForm() {
    const data = FormMapper.collectData();
    // Inject Owner_Email từ session (field ẩn, không render trên UI)
    if (typeof AuthService !== 'undefined') {
      var _u = AuthService.getUser();
      if (_u && _u.email && !data.Owner_Email) data.Owner_Email = _u.email;
    }
    const errors = Validator.all(data);
    if (errors.length) {
      Toast.show(errors.join('\n'), 'error');
      return;
    }
    showLoading(true, 'Đang gửi...');
    var submitHintId = null; // Lưu hint ID để dùng trong timeout recovery (create mode)
    try {
      if (currentRecordId) {
        data.Record_ID = currentRecordId;
        data.Status    = data.Status || 'Submitted';
        await Api.updateUseCase(data);
        Storage.clear();
        Toast.show('Cập nhật thành công!', 'success');
        showSuccessScreen('Đã cập nhật');
      } else {
        data.Status = 'Submitted';
        // Strip empty fields để giảm kích thước payload GET URL.
        // Mỗi ký tự tiếng Việt tốn 3 bytes UTF-8 → 4 chars base64url → URL dễ vượt giới hạn GAS (~8KB).
        // GAS tự khởi tạo tất cả field về '' nên bỏ qua field rỗng ở create mode là an toàn.
        Object.keys(data).forEach(function(k) {
          if (data[k] === '' || data[k] === null || data[k] === undefined) delete data[k];
        });
        // Dùng ID đã pre-fetch lúc load form — không block submit critical path.
        // Nếu pre-fetch chưa kịp hoàn tất (GAS chậm lúc load), fallback fetch trực tiếp.
        if (_preloadedNextId) {
          data.UseCase_ID = _preloadedNextId;
          submitHintId    = _preloadedNextId;
          _preloadedNextId = null; // consume — tránh dùng lại nếu user submit lần 2
        } else {
          const badge = document.getElementById('nextIdBadge');
          if (badge) { badge.textContent = 'Đang cấp mã…'; badge.className = 'nextid-badge loading'; badge.style.display = ''; }
          try {
            const idRes = await Api.getNextId();
            if (idRes && idRes.next_id) { data.UseCase_ID = idRes.next_id; submitHintId = idRes.next_id; }
          } catch (_) { /* GAS offline — GAS sẽ tự sinh ID */ }
          if (badge) badge.style.display = 'none';
        }
        const result = await Api.createUseCase(data);
        Storage.clear();
        showSuccessScreen(result.usecase_id || 'AIUS-????');
      }
    } catch (err) {
      await _handleSubmitError(err, currentRecordId, submitHintId);
    } finally {
      showLoading(false);
    }
  }

  /* ── Submit Error Handler ── */
  // Phân biệt transport error (GAS đã ghi xong nhưng response không về) vs lỗi thật.
  //
  // Có 2 loại transport error cho UPDATE:
  //   1. Timeout (45s) — GAS chậm, response chưa về
  //   2. script.onerror ("script load thất bại") — GAS chạy xong, ghi data thành công,
  //      nhưng response chứa full merged object (~7,000+ chars) → redirect URL
  //      script.googleusercontent.com/macros/echo?user_content_key=<VERY_LONG> quá dài → 400
  //      → browser nhận HTTP 400 → script.onerror fire
  //
  // Cả 2 đều có thể xảy ra SAU KHI data đã được ghi vào DB (với UPDATE).
  async function _handleSubmitError(err, recordId, hintId) {
    var isTimeout     = err.message && err.message.indexOf('Timeout') !== -1;
    var isScriptError = err.message && err.message.indexOf('script load thất bại') !== -1;
    var isTransportErr = isTimeout || isScriptError;

    if (!isTransportErr) {
      // Lỗi thật (validation, encode, GAS trả success:false) — hiện bình thường
      Toast.show('Lỗi gửi: ' + err.message, 'error');
      return;
    }

    if (recordId) {
      // ── UPDATE transport error: auto-verify bằng getUseCase ──────────────
      // Với UPDATE: GAS luôn ghi TRƯỚC khi gửi response → data rất có thể đã trong DB.
      // Gọi getUseCase (response nhỏ, không bị 400) để xác nhận.
      showLoading(true, 'Đang xác nhận kết quả...');
      try {
        var verified = await Api.getUseCase(recordId);
        if (verified && verified.Record_ID) {
          Storage.clear();
          Toast.show('Cập nhật thành công!', 'success');
          showSuccessScreen('Đã cập nhật');
          return;
        }
      } catch (_e) { /* GAS vẫn bận hoặc offline — fall through */ }
      showLoading(false);
      Toast.show(
        'Không xác nhận được kết quả — vui lòng kiểm tra dashboard\n' +
        'xem use case đã được cập nhật chưa trước khi thử lại.',
        'warning',
        10000
      );
    } else {
      // ── CREATE transport error: cảnh báo tránh submit lại ─────────────────
      // Không thể tự verify vì chưa có Record_ID. Dùng hint ID làm gợi ý.
      var hintMsg = hintId ? (' (mã dự kiến: ' + hintId + ')') : '';
      Toast.show(
        'Lỗi kết nối' + hintMsg + '.\n' +
        'Dữ liệu CÓ THỂ đã được lưu — kiểm tra dashboard trước khi nộp lại để tránh trùng lặp.',
        'warning',
        12000
      );
    }
  }

  /* ── Success Screen ── */
  function showSuccessScreen(useCaseId) {
    ['useCaseForm', 'wizardNavWrapper', 'stepIndicators', 'stepCounter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const screen = document.getElementById('successScreen');
    const badge  = document.getElementById('successIdBadge');
    if (badge)  badge.textContent = useCaseId;
    if (screen) {
      screen.classList.remove('hidden');
      screen.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ── Draft Banner ── */
  function showDraftBanner(draft) {
    const banner     = document.getElementById('draftBanner');
    const restoreBtn = document.getElementById('draftRestoreBtn');
    const discardBtn = document.getElementById('draftDiscardBtn');
    if (!banner) return;
    banner.classList.remove('hidden');
    restoreBtn.addEventListener('click', () => {
      FormMapper.populateData(draft);
      FieldBuilder.refreshConditionals();
      banner.classList.add('hidden');
      Toast.show('Đã khôi phục bản nháp', 'success');
    }, { once: true });
    discardBtn.addEventListener('click', () => {
      Storage.clear();
      banner.classList.add('hidden');
    }, { once: true });
  }

  /* ── Edit Mode Banner ── */
  function showEditModeBanner(recordId) {
    const banner = document.getElementById('editModeBanner');
    const idEl   = document.getElementById('editModeId');
    if (!banner) return;
    if (idEl) idEl.textContent = recordId.substring(0, 8) + '...';
    banner.classList.remove('hidden');
  }

  /* ── Autosave Badge ── */
  var autosaveTimer = null;
  function showAutosaveBadge() {
    const badge = document.getElementById('autosaveBadge');
    if (!badge) return;
    badge.textContent = '✓ Đã lưu nháp';
    badge.classList.add('visible', 'saved');
    badge.classList.remove('saving');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => badge.classList.remove('visible'), 3000);
  }

  /* ── Loading Overlay ── */
  function showLoading(show, label) {
    const overlay = document.getElementById('loadingOverlay');
    const labelEl = document.getElementById('loadingLabel');
    if (overlay) overlay.classList.toggle('hidden', !show);
    if (labelEl && label) labelEl.textContent = label;
  }

  window.addEventListener('DOMContentLoaded', init);
})();
