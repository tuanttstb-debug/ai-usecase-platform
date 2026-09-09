/* weekly-update.js — tách từ inline weekly-update.html (SPA module) */
(function () {
  'use strict';
var _currentUser = null;
var _selectedUc  = null;
var _myUseCases  = [];

// Prompt/Luồng AI (Mục tiêu 1): chỉ gửi khi đã nạp được full detail VÀ user đã mở
// mục để sửa — tránh ghi đè rỗng lên dữ liệu prompt cũ khi fetch lỗi hoặc user
// không đụng tới.
var _fullDetailLoaded = false;
var _promptTouched    = false;
// map field payload ↔ id textarea
var _PROMPT_FIELDS = [
  ['Flow_Description',      'wuFlowDescription'],
  ['Prompt_Role',          'wuPromptRole'],
  ['Prompt_Task',          'wuPromptTask'],
  ['Prompt_Goal',          'wuPromptGoal'],
  ['Prompt_Context',       'wuPromptContext'],
  ['Prompt_Input',         'wuPromptInput'],
  ['Prompt_Steps',         'wuPromptSteps'],
  ['Prompt_Output_Format', 'wuPromptOutputFormat'],
  ['Prompt_Evaluation',    'wuPromptEvaluation']
];

// SPA: init do router gọi (shell lo auth/sidebar/logout/nav)
function _wuInit() {
  _currentUser = AuthService.getUser();
  document.getElementById('progressSlider').addEventListener('input', function() {
    updateProgressDisplay(this.value);
  });
  document.getElementById('upgradeToggle').addEventListener('change', onUpgradeToggle);
  loadMyUseCases();
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePicker();
});

// ── Load UC list ──────────────────────────────────────────────────

var _pickerBuilt = false;

function loadMyUseCases() {
  var btn = document.getElementById('ucPickerBtn');
  if (btn) btn.disabled = true;

  Api.jsonp(API.list({ limit: 500 }), function(res) {
    if (btn) btn.disabled = false;
    if (!res || !res.success) { showToast('Không tải được danh sách UC', 'error'); return; }

    var all   = res.data || [];
    var role  = _currentUser.role || 'user';
    var email = (_currentUser.email || '').toLowerCase();
    var team  = (_currentUser.team  || '').toLowerCase();

    _myUseCases = all.filter(function(uc) {
      if (role === 'admin') return true;
      if (role === 'champion') {
        // Champion thấy UC của team mình (so sánh không phân biệt hoa thường)
        return team && (uc.team || '').toLowerCase() === team;
      }
      // user: chỉ UC của chính mình
      return (uc.owner_email && uc.owner_email.toLowerCase().indexOf(email) !== -1) ||
             (uc.owner_name  && uc.owner_name.toLowerCase().indexOf(email)  !== -1);
    });
    window._myUseCases = _myUseCases; // expose cho test (module IIFE)

    // Scope label cho picker header
    var scopeEl = document.getElementById('pickerScope');
    if (scopeEl) {
      if (role === 'admin')          scopeEl.textContent = 'Admin · Toàn bộ';
      else if (role === 'champion')  scopeEl.textContent = 'Champion · ' + (_currentUser.team || 'Team');
      else                           scopeEl.textContent = 'Use case của tôi';
    }

    _pickerBuilt = false; // mark cần render lại
  });
}

// ── Picker open / close ───────────────────────────────────────────

function openPicker() {
  document.getElementById('pickerOverlay').classList.add('visible');
  document.getElementById('pickerModal').classList.add('visible');
  document.getElementById('ucPickerBtn').classList.add('open');

  if (!_pickerBuilt) {
    buildPickerTable();
    _pickerBuilt = true;
  }
  // Focus search input
  setTimeout(function() {
    var s = document.getElementById('pickerSearch');
    if (s) { s.value = ''; s.focus(); filterPickerTable(); }
  }, 50);
}

function closePicker() {
  document.getElementById('pickerOverlay').classList.remove('visible');
  document.getElementById('pickerModal').classList.remove('visible');
  document.getElementById('ucPickerBtn').classList.remove('open');
}

// ── Build picker table (once after data loads) ────────────────────

function buildPickerTable() {
  var role = _currentUser.role || 'user';
  var showOwner = (role === 'admin' || role === 'champion');

  var html = '<table class="picker-table" id="pickerTable">' +
    '<thead><tr>' +
    '<th class="picker-td-id">Mã UC</th>' +
    '<th>Tên Use Case</th>' +
    (showOwner ? '<th>Chủ sở hữu</th>' : '') +
    '<th>Team</th>' +
    '<th>Stage</th>' +
    '<th class="picker-td-prog">Tiến độ</th>' +
    '<th>Cập nhật</th>' +
    '</tr></thead><tbody id="pickerTbody">';

  if (!_myUseCases.length) {
    html += '<tr><td colspan="7"><div class="picker-empty">Không có use case nào trong phạm vi quyền của bạn</div></td></tr>';
  } else {
    _myUseCases.forEach(function(uc) {
      var stage    = uc.stage || uc.current_stage || '';
      var sl       = STAGE_LABELS[stage] || { short: stage || '—', color: '#6D6D7A', bg: '#F5F5F7' };
      var prog     = parseInt(uc.current_progress, 10) || 0;
      var daysSince = uc.last_weekly_report
        ? Math.floor((Date.now() - new Date(uc.last_weekly_report)) / 86400000)
        : -1;
      var updTxt  = daysSince < 0  ? 'Chưa có'
                  : daysSince === 0 ? 'Hôm nay'
                  : daysSince + ' ngày trước';
      var updCls  = daysSince < 0  ? '' : daysSince > 7 ? 'overdue' : 'fresh';

      // Searchable text stored in data attrs
      var searchText = [
        uc.usecase_id, uc.name, uc.owner_name, uc.owner_email, uc.team
      ].join(' ').toLowerCase();

      html += '<tr data-rid="' + esc(uc.record_id) + '"' +
        ' data-search="' + esc(searchText) + '"' +
        ' data-stage="' + esc(stage) + '"' +
        ' data-upd="' + (daysSince < 0 ? 'never' : daysSince > 7 ? 'overdue' : 'fresh') + '"' +
        ' onclick="onPickerRowClick(\'' + esc(uc.record_id) + '\')"' +
        ((_selectedUc && _selectedUc.record_id === uc.record_id) ? ' class="is-selected"' : '') +
        '>' +
        '<td class="picker-td-id">' + esc(uc.usecase_id || '') + '</td>' +
        '<td class="picker-td-name">' + esc(uc.name || '') +
          (uc.status ? '<small>' + esc(uc.status) + '</small>' : '') + '</td>' +
        (showOwner ? '<td class="picker-td-team">' + esc(uc.owner_name || uc.owner_email || '') + '</td>' : '') +
        '<td class="picker-td-team">' + esc(uc.team || '') + '</td>' +
        '<td class="picker-td-stage"><span class="stage-pill" style="background:' + sl.bg + ';color:' + sl.color + '">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:' + sl.color + ';display:inline-block;flex-shrink:0"></span>' +
          esc(sl.short) + '</span></td>' +
        '<td class="picker-td-prog">' +
          '<div class="picker-prog-bar"><div class="picker-prog-fill" style="width:' + prog + '%"></div></div>' +
          '<div class="picker-prog-lbl">' + prog + '%</div></td>' +
        '<td class="picker-td-upd ' + updCls + '">' + esc(updTxt) + '</td>' +
        '</tr>';
    });
  }

  html += '</tbody></table>';
  document.getElementById('pickerTableContainer').innerHTML = html;
  updatePickerCount();
}

// ── Filter picker table ───────────────────────────────────────────

function filterPickerTable() {
  var q     = (document.getElementById('pickerSearch').value || '').toLowerCase().trim();
  var stage = document.getElementById('pickerStageFilter').value;
  var upd   = document.getElementById('pickerUpdFilter').value;

  var rows = document.querySelectorAll('#pickerTbody tr[data-rid]');
  rows.forEach(function(row) {
    var matchQ     = !q     || row.dataset.search.indexOf(q) !== -1;
    var matchStage = !stage || row.dataset.stage === stage;
    var matchUpd   = !upd   || row.dataset.upd   === upd;
    row.classList.toggle('is-hidden', !(matchQ && matchStage && matchUpd));
  });
  updatePickerCount();
}

function updatePickerCount() {
  var rows    = document.querySelectorAll('#pickerTbody tr[data-rid]');
  var visible = 0;
  rows.forEach(function(r) { if (!r.classList.contains('is-hidden')) visible++; });
  var countEl = document.getElementById('pickerCount');
  if (countEl) countEl.textContent = visible + ' / ' + _myUseCases.length + ' use case';
}

// ── Pick a row ───────────────────────────────────────────────────

function onPickerRowClick(rid) {
  closePicker();
  onSelectUseCase(rid);
}

// ── UC select ────────────────────────────────────────────────────

function onSelectUseCase(rid) {
  // Reset everything
  document.getElementById('ucCard').classList.remove('visible');
  document.getElementById('wuForm').style.display       = 'none';
  document.getElementById('stageSection').style.display = 'none';
  document.getElementById('successState').style.display = 'none';
  document.getElementById('timelineWrap').style.display  = 'none';
  document.getElementById('overdueWarn').classList.remove('visible');
  document.getElementById('upgradeToggle').checked = false;
  document.getElementById('upgradePanel').classList.remove('visible');
  _resetPromptSection();

  if (!rid) { _selectedUc = null; updatePickerButton(null); return; }

  _selectedUc = _myUseCases.find(function(u) { return u.record_id === rid; });
  if (!_selectedUc) return;

  updatePickerButton(_selectedUc);

  // Highlight selected row in table
  var rows = document.querySelectorAll('#pickerTbody tr[data-rid]');
  rows.forEach(function(r) {
    r.classList.toggle('is-selected', r.dataset.rid === rid);
  });

  renderUcCard(_selectedUc);
  renderStageSection(_selectedUc);
  prefillForm(_selectedUc);
  checkOverdue(_selectedUc);
  _loadPromptFields(_selectedUc.record_id);

  document.getElementById('wuForm').style.display       = '';
  document.getElementById('stageSection').style.display = '';

  loadTimeline(_selectedUc.record_id);
}

// ── Prompt & Luồng AI (Mục tiêu 1) ────────────────────────────────

function togglePromptAccordion() {
  var acc = document.getElementById('promptAccordion');
  var toggle = document.getElementById('promptAccordionToggle');
  var open = acc.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { _promptTouched = true; window._promptTouched = true; } // đã mở để sửa → cho phép gửi prompt/luồng
}

function _resetPromptSection() {
  _fullDetailLoaded = false;
  _promptTouched    = false;
  window._fullDetailLoaded = false; window._promptTouched = false; // sync test
  var acc = document.getElementById('promptAccordion');
  if (acc) acc.classList.remove('open');
  var toggle = document.getElementById('promptAccordionToggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  _PROMPT_FIELDS.forEach(function (pair) {
    var el = document.getElementById(pair[1]);
    if (el) el.value = '';
  });
}

// Nạp full detail để prefill prompt/luồng (endpoint `list` không trả các field này).
function _loadPromptFields(recordId) {
  if (!recordId || typeof Api.getUseCase !== 'function') return;
  Api.getUseCase(recordId).then(function (data) {
    // UC có thể đã đổi trong lúc chờ → chỉ áp nếu vẫn đúng UC đang chọn.
    if (!_selectedUc || _selectedUc.record_id !== recordId) return;
    var map = {
      wuFlowDescription:    data.Flow_Description,
      wuPromptRole:         data.Prompt_Role,
      wuPromptTask:         data.Prompt_Task,
      wuPromptGoal:         data.Prompt_Goal,
      wuPromptContext:      data.Prompt_Context,
      wuPromptInput:        data.Prompt_Input,
      wuPromptSteps:        data.Prompt_Steps,
      wuPromptOutputFormat: data.Prompt_Output_Format,
      wuPromptEvaluation:   data.Prompt_Evaluation
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = map[id] || '';
    });
    _fullDetailLoaded = true; window._fullDetailLoaded = true; // sync test
  }).catch(function () {
    // GAS lỗi → không prefill; guard _fullDetailLoaded=false chặn gửi (không ghi đè rỗng).
  });
}

// ── Update picker button display ──────────────────────────────────

function updatePickerButton(uc) {
  var textEl  = document.getElementById('ucPickerBtnText');
  var badgeEl = document.getElementById('ucPickerBtnBadge');
  var clearEl = document.getElementById('ucPickerBtnClear');

  if (!uc) {
    textEl.textContent = '— Nhấn để chọn use case —';
    textEl.className   = 'uc-picker-btn-text';
    badgeEl.style.display = 'none';
    clearEl.classList.remove('visible');
    return;
  }

  var stage = uc.stage || uc.current_stage || '';
  var sl    = STAGE_LABELS[stage];
  textEl.textContent = '[' + (uc.usecase_id || '') + '] ' + (uc.name || '');
  textEl.className   = 'uc-picker-btn-text has-value';

  if (sl) {
    badgeEl.textContent = sl.short;
    badgeEl.style.cssText = 'display:inline-block;background:' + sl.bg + ';color:' + sl.color;
  } else {
    badgeEl.style.display = 'none';
  }
  clearEl.classList.add('visible');
}

function clearUcSelection(e) {
  e.stopPropagation();
  _selectedUc = null;
  updatePickerButton(null);
  document.getElementById('ucCard').classList.remove('visible');
  document.getElementById('wuForm').style.display       = 'none';
  document.getElementById('stageSection').style.display = 'none';
  document.getElementById('successState').style.display = 'none';
  document.getElementById('timelineWrap').style.display  = 'none';
  document.getElementById('overdueWarn').classList.remove('visible');
  var rows = document.querySelectorAll('#pickerTbody tr');
  rows.forEach(function(r) { r.classList.remove('is-selected'); });
}

// ── UC card ──────────────────────────────────────────────────────

function renderUcCard(uc) {
  document.getElementById('ucCardName').textContent = uc.name || '';
  document.getElementById('ucCardMeta').textContent =
    (uc.usecase_id || '') + ' · ' + (uc.team || '') + ' · ' + (uc.status || '');

  var chipsHtml = '';

  // Score chip
  var scoreVal = uc.total_score || uc.auto_score || 0;
  if (scoreVal > 0) {
    chipsHtml += '<span class="chip chip--score">Điểm: <strong>' + scoreVal + '</strong>/100</span>';
  }

  // Stage chip
  var stage = uc.stage || uc.current_stage || '';
  if (stage && STAGE_LABELS[stage]) {
    var sl = STAGE_LABELS[stage];
    chipsHtml += '<span class="chip" style="background:' + sl.bg + ';color:' + sl.color + '">' + sl.short + '</span>';
  }

  // Last update chip
  if (uc.last_weekly_report) {
    var daysSince = Math.floor((Date.now() - new Date(uc.last_weekly_report)) / 86400000);
    var chipCls   = daysSince > 7 ? 'chip--overdue' : 'chip--update';
    chipsHtml += '<span class="chip ' + chipCls + '">Cập nhật: ' + daysSince + ' ngày trước</span>';
  }

  document.getElementById('ucCardChips').innerHTML = chipsHtml;
  document.getElementById('ucCard').classList.add('visible');
}

// ── Stage section ────────────────────────────────────────────────

function renderStageSection(uc) {
  var stage     = uc.stage || uc.current_stage || 'S1 - Idea';
  var stageIdx  = STAGE_ORDER.indexOf(stage);
  var nextStage = stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 1
                  ? STAGE_ORDER[stageIdx + 1]
                  : null;

  // Current stage badge
  var sl = STAGE_LABELS[stage] || { short: stage, color: '#6D6D7A', bg: '#F5F5F7' };
  document.getElementById('currentStageBadge').innerHTML =
    '<span style="width:8px;height:8px;border-radius:50%;background:' + sl.color + ';display:inline-block"></span> ' + esc(sl.short);
  document.getElementById('currentStageBadge').style.cssText =
    'background:' + sl.bg + ';color:' + sl.color;

  // Mini badge for upgrade panel header
  document.getElementById('currentStageMini').innerHTML =
    '<span style="width:6px;height:6px;border-radius:50%;background:' + sl.color + ';display:inline-block"></span> ' + esc(sl.short);
  document.getElementById('currentStageMini').style.cssText =
    'background:' + sl.bg + ';color:' + sl.color;

  if (nextStage) {
    var nsl = STAGE_LABELS[nextStage] || { short: nextStage, color: '#7B2CBF', bg: '#F5F0FF' };
    document.getElementById('upgradeToggleWrap').style.display = '';
    document.getElementById('stageAtMax').style.display         = 'none';

    // Target stage badge in panel
    document.getElementById('targetStageBadge').innerHTML =
      '<span style="width:6px;height:6px;border-radius:50%;background:' + nsl.color + ';display:inline-block"></span> ' + esc(nsl.short);
    document.getElementById('targetStageBadge').style.cssText =
      'background:' + nsl.bg + ';color:' + nsl.color + ';border:1px solid ' + nsl.color + '40';

    // Render checklist
    var criteria = STAGE_CRITERIA[nextStage] || [];
    var html = criteria.map(function(c) {
      return '<div class="stage-checklist-item">' +
        '<input type="checkbox" id="' + c.id + '" onchange="onChecklistChange()">' +
        '<label for="' + c.id + '">' + esc(c.text) + '</label>' +
        '</div>';
    }).join('');
    document.getElementById('checklistItems').innerHTML = html;

    // S4 extra fields
    document.getElementById('s4Fields').classList.toggle('visible', nextStage === 'S4 - Scale');

  } else {
    document.getElementById('upgradeToggleWrap').style.display = 'none';
    document.getElementById('stageAtMax').style.display         = '';
  }
}

function onUpgradeToggle() {
  var checked = document.getElementById('upgradeToggle').checked;
  document.getElementById('upgradePanel').classList.toggle('visible', checked);
  document.getElementById('checklistWarn').classList.remove('visible');
}

function onChecklistChange() {
  document.getElementById('checklistWarn').classList.remove('visible');
}

function getTargetStage() {
  var stage    = (_selectedUc && (_selectedUc.stage || _selectedUc.current_stage)) || 'S1 - Idea';
  var stageIdx = STAGE_ORDER.indexOf(stage);
  return (stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 1) ? STAGE_ORDER[stageIdx + 1] : null;
}

function validateChecklist() {
  var nextStage = getTargetStage();
  if (!nextStage) return true;
  var criteria = STAGE_CRITERIA[nextStage] || [];
  return criteria.every(function(c) {
    var el = document.getElementById(c.id);
    return el && el.checked;
  });
}

// ── Form prefill + display ────────────────────────────────────────

// Chỉ prefill số nếu giá trị hợp lệ trong phạm vi [0, maxSane].
// Google Sheets đôi khi trả về Date serial hoặc float bất hợp lệ
// khi cột bị đổi định dạng — guard này ngăn hiển thị số nhảm lên form.
function _safeNum(v, maxSane) {
  var n = parseFloat(v);
  return (isFinite(n) && n >= 0 && n <= (maxSane || 99999)) ? n : '';
}

function prefillForm(uc) {
  var prog = parseInt(uc.current_progress, 10) || 0;
  if (prog < 0 || prog > 100) prog = 0;
  document.getElementById('progressSlider').value    = prog;
  document.getElementById('activeUsers').value       = _safeNum(uc.active_user_count,   99999);
  document.getElementById('monthlyUsage').value      = _safeNum(uc.monthly_usage_count, 9999);
  document.getElementById('hoursSaved').value        = _safeNum(uc.hours_saved_actual,  9999);
  document.getElementById('weeklyUpdate').value      = '';
  document.getElementById('nextMilestone').value     = '';
  document.getElementById('blocker').value           = '';
  document.getElementById('managerSupport').value    = '';
  document.getElementById('reuseCount').value        = _safeNum(uc.reuse_count_tracked, 99999);
  updateProgressDisplay(prog);
}

function updateProgressDisplay(val) {
  val = parseInt(val, 10) || 0;
  document.getElementById('progressFill').style.width  = val + '%';
  document.getElementById('progressLabel').textContent = val + '%';
}

function checkOverdue(uc) {
  var warn = document.getElementById('overdueWarn');
  var msg  = document.getElementById('overdueMsg');
  warn.classList.remove('visible');
  if (!uc.last_weekly_report) {
    msg.textContent = 'Use case này chưa có báo cáo tuần nào. Hãy cập nhật ngay!';
    warn.classList.add('visible');
  } else {
    var daysSince = Math.floor((Date.now() - new Date(uc.last_weekly_report)) / 86400000);
    if (daysSince > 7) {
      msg.textContent = 'Đã ' + daysSince + ' ngày không cập nhật! Use case có thể bị đánh dấu overdue.';
      warn.classList.add('visible');
    }
  }
}

// ── Submit ────────────────────────────────────────────────────────

function submitWeeklyUpdate() {
  if (!_selectedUc) { showToast('Vui lòng chọn use case', 'error'); return; }

  var weeklyUpdate = document.getElementById('weeklyUpdate').value.trim();
  if (!weeklyUpdate) { showToast('Vui lòng nhập nội dung cập nhật tuần này', 'error'); return; }

  // Stage upgrade validation
  var wantUpgrade = document.getElementById('upgradeToggle').checked;
  if (wantUpgrade && !validateChecklist()) {
    document.getElementById('checklistWarn').classList.add('visible');
    document.getElementById('upgradePanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // S4 scale plan required
  var targetStage = wantUpgrade ? getTargetStage() : null;
  if (targetStage === 'S4 - Scale') {
    var scalePlan = document.getElementById('scalePlan').value.trim();
    if (!scalePlan) {
      showToast('Vui lòng điền Kế hoạch scale-up (bắt buộc cho S4)', 'error');
      document.getElementById('scalePlan').focus();
      return;
    }
  }

  var payload = {
    Record_ID:           _selectedUc.record_id,
    Current_Progress:    parseInt(document.getElementById('progressSlider').value, 10) || 0,
    Weekly_Update:       weeklyUpdate,
    Next_Milestone:      document.getElementById('nextMilestone').value.trim(),
    Blocker:             document.getElementById('blocker').value.trim(),
    Manager_Support:     document.getElementById('managerSupport').value.trim(),
    Active_User_Count:   parseInt(document.getElementById('activeUsers').value, 10) || 0,
    Monthly_Usage_Count: parseInt(document.getElementById('monthlyUsage').value, 10) || 0,
    Hours_Saved_Actual:  parseFloat(document.getElementById('hoursSaved').value) || 0,
    Reuse_Count_Tracked: parseInt(document.getElementById('reuseCount').value, 10) || 0,
    reporter_email:      _currentUser.email
  };

  if (wantUpgrade && targetStage) {
    payload.New_Stage   = targetStage;
    payload.Scale_Plan  = document.getElementById('scalePlan')  ? document.getElementById('scalePlan').value.trim()  : '';
    payload.Scale_Risks = document.getElementById('scaleRisks') ? document.getElementById('scaleRisks').value.trim() : '';
  }

  // Prompt/Luồng AI: CHỈ gửi khi đã nạp được bản hiện tại (prefill) và user đã mở
  // mục để sửa → không ghi đè rỗng lên dữ liệu prompt cũ.
  if (_fullDetailLoaded && _promptTouched) {
    _PROMPT_FIELDS.forEach(function (pair) {
      var el = document.getElementById(pair[1]);
      payload[pair[0]] = el ? el.value.trim() : '';
    });
    payload.Prompt_Updated = true; // cờ để backend chụp snapshot vào WEEKLY_LOG
  }

  var btn = document.getElementById('btnSubmit');
  btn.disabled    = true;
  btn.textContent = 'Đang gửi...';

  Api.submitWeeklyUpdate(payload).then(function(res) {
    btn.disabled  = false;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg> Gửi cập nhật';

    var successIcon  = document.getElementById('successIcon');
    var successTitle = document.getElementById('successTitle');

    if (res && res.pending_milestone) {
      // Milestone (chuyển Stage / nâng điểm) — chờ Admin duyệt mới áp & tính KPI
      successIcon.textContent  = '⏳';
      successTitle.textContent = 'Đã gửi — chờ Admin duyệt';
      var mParts = [];
      if (res.proposed_stage) {
        var psl = STAGE_LABELS[res.proposed_stage] || { short: res.proposed_stage };
        mParts.push('Đề xuất chuyển Stage → ' + psl.short);
      }
      if (res.proposed_total_score > res.prev_total_score) {
        mParts.push('Đề xuất nâng điểm ' + res.prev_total_score + ' → ' + res.proposed_total_score + '/100');
      }
      mParts.push('Sẽ ghi nhận vào KPI sau khi Admin duyệt.');
      document.getElementById('successDetail').textContent = mParts.join(' · ');
    } else {
      successIcon.textContent  = '✅';
      successTitle.textContent = 'Đã cập nhật thành công!';
      var detailParts = [];
      if (res && res.total_score) detailParts.push('Điểm mới: ' + res.total_score + '/100');
      if (res && res.stage_changed && res.new_stage) {
        var nsl = STAGE_LABELS[res.new_stage] || { short: res.new_stage };
        detailParts.push('Stage mới: ' + nsl.short);
      }
      document.getElementById('successDetail').textContent = detailParts.join(' · ');
    }
    document.getElementById('wuForm').style.display       = 'none';
    document.getElementById('stageSection').style.display = 'none';
    document.getElementById('successState').style.display = '';

    // Reload timeline to show new entry
    loadTimeline(_selectedUc.record_id);
  }).catch(function(err) {
    btn.disabled  = false;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg> Gửi cập nhật';
    showToast((err && err.message) || 'Lỗi gửi dữ liệu', 'error');
  });
}

// ── Timeline ──────────────────────────────────────────────────────

function loadTimeline(recordId) {
  document.getElementById('timelineWrap').style.display = 'none';
  Api.getWeeklyLog(recordId).then(function(logs) {
    renderTimeline(logs || []);
  }).catch(function() {
    renderTimeline([]);
  });
}

function renderTimeline(logs) {
  var wrap = document.getElementById('timelineWrap');
  var content = document.getElementById('timelineContent');
  document.getElementById('timelineCount').textContent = logs.length ? '(' + logs.length + ' lần)' : '';

  if (!logs.length) {
    content.innerHTML = '<div class="wu-timeline-empty">Chưa có lịch sử cập nhật. Hãy gửi báo cáo tuần đầu tiên!</div>';
    wrap.style.display = '';
    return;
  }

  var items = logs.map(function(log) {
    var isStageChange = log.stage_changed && log.previous_stage !== log.new_stage;
    var dotClass      = isStageChange ? 'timeline-dot--stage' : '';
    var cardClass     = isStageChange ? 'timeline-card--stage' : '';

    var dateStr = '';
    try {
      var d = new Date(log.log_date);
      dateStr = d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) +
                ' ' + d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });
    } catch(e) { dateStr = log.log_date; }

    var headerHtml = '<span class="timeline-date">' + esc(dateStr) + '</span>';
    headerHtml += '<span class="timeline-progress-pill">' + log.progress + '%</span>';

    // Milestone approval badge (v3.14.0)
    if (log.is_milestone) {
      var ap = String(log.approval_status || 'Pending');
      var badge = { text: '⏳ Chờ Admin duyệt', bg: '#FFF4D6', fg: '#946200' };
      if (ap === 'Approved') badge = { text: '✓ Đã duyệt (tính KPI)', bg: '#E6F4EA', fg: '#1E7B34' };
      else if (ap === 'Rejected') badge = { text: '✕ Bị từ chối', bg: '#FDECEC', fg: '#B3261E' };
      headerHtml += '<span style="margin-left:6px;font-size:var(--text-xs);font-weight:700;padding:2px 8px;' +
        'border-radius:999px;background:' + badge.bg + ';color:' + badge.fg + '">' + badge.text + '</span>';
    }

    // Badge: đã cập nhật Prompt/Luồng AI ở lần này (Mục tiêu 1)
    if (log.prompt_updated) {
      headerHtml += '<span style="margin-left:6px;font-size:var(--text-xs);font-weight:700;padding:2px 8px;' +
        'border-radius:999px;background:#F5F0FF;color:#7B2CBF">✦ Cập nhật Prompt/Luồng AI</span>';
    }

    if (isStageChange) {
      var psl = STAGE_LABELS[log.previous_stage] || { short: log.previous_stage, color: '#6D6D7A' };
      var nsl = STAGE_LABELS[log.new_stage]      || { short: log.new_stage,      color: '#7B2CBF' };
      headerHtml += '<span class="timeline-stage-arrow">' +
        '<span style="color:' + psl.color + '">' + esc(psl.short) + '</span>' +
        ' → ' +
        '<span style="color:' + nsl.color + ';font-weight:800">' + esc(nsl.short) + '</span>' +
        '</span>';
    }

    var textHtml = log.weekly_update
      ? '<div class="timeline-text">' + esc(log.weekly_update) + '</div>'
      : '<div class="timeline-text muted">Không có nội dung cập nhật</div>';

    var metrics = [];
    if (log.monthly_usage_count) metrics.push('Sử dụng: ' + log.monthly_usage_count + ' lần/tháng');
    if (log.hours_saved_actual)  metrics.push('Tiết kiệm: ' + log.hours_saved_actual + 'h');
    if (log.reuse_count_tracked) metrics.push('Tái sử dụng: ' + log.reuse_count_tracked + ' lần');
    var metricsHtml = metrics.length
      ? '<div class="timeline-metrics">' + metrics.map(function(m) {
          return '<span class="timeline-metric">' + esc(m) + '</span>';
        }).join('') + '</div>'
      : '';

    var blockerHtml = '';
    if (log.blocker) {
      blockerHtml = '<div style="margin-top:var(--space-2);font-size:var(--text-xs);color:var(--color-error);background:var(--color-error-light);padding:4px 8px;border-radius:var(--radius-sm)">' +
        '⚠ ' + esc(log.blocker.substring(0, 150)) + (log.blocker.length > 150 ? '…' : '') +
        '</div>';
    }

    return '<li class="timeline-item">' +
      '<div class="timeline-dot ' + dotClass + '"></div>' +
      '<div class="timeline-card ' + cardClass + '">' +
        '<div class="timeline-header">' + headerHtml + '</div>' +
        textHtml + metricsHtml + blockerHtml +
      '</div>' +
      '</li>';
  }).join('');

  content.innerHTML = '<ul class="timeline-list">' + items + '</ul>';
  wrap.style.display = '';
}

// ── Reset ─────────────────────────────────────────────────────────

function resetForm() {
  document.getElementById('weeklyUpdate').value   = '';
  document.getElementById('nextMilestone').value  = '';
  document.getElementById('blocker').value        = '';
  document.getElementById('managerSupport').value = '';
  if (document.getElementById('scalePlan'))  document.getElementById('scalePlan').value  = '';
  if (document.getElementById('scaleRisks')) document.getElementById('scaleRisks').value = '';
  document.getElementById('upgradeToggle').checked = false;
  document.getElementById('upgradePanel').classList.remove('visible');
  document.getElementById('checklistWarn').classList.remove('visible');
}

function resetAll() {
  _selectedUc = null;
  updatePickerButton(null);
  document.getElementById('ucCard').classList.remove('visible');
  document.getElementById('wuForm').style.display       = 'none';
  document.getElementById('stageSection').style.display = 'none';
  document.getElementById('successState').style.display = 'none';
  document.getElementById('timelineWrap').style.display = 'none';
  document.getElementById('overdueWarn').classList.remove('visible');
  var rows = document.querySelectorAll('#pickerTbody tr');
  rows.forEach(function(r) { r.classList.remove('is-selected'); });
  resetForm();
  _resetPromptSection();
  // Rebuild table to reflect any stage changes from latest submit
  _pickerBuilt = false;
  loadMyUseCases();
}

// ── Toast + helpers ───────────────────────────────────────────────

function showToast(msg, type) {
  var el = document.createElement('div');
  el.style.cssText = 'background:' + (type === 'error' ? '#F44336' : '#4CAF50') +
    ';color:#fff;padding:10px 18px;border-radius:10px;font-size:14px;margin-top:8px;box-shadow:0 4px 12px rgba(0,0,0,.15)';
  el.textContent = msg;
  document.getElementById('toastArea').appendChild(el);
  setTimeout(function() { el.remove(); }, 4000);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

  // expose cho onclick/oninput trong HTML
  window.openPicker = openPicker; window.closePicker = closePicker;
  window.clearUcSelection = clearUcSelection; window.onPickerRowClick = onPickerRowClick;
  window.filterPickerTable = filterPickerTable; window.togglePromptAccordion = togglePromptAccordion;
  window.resetForm = resetForm; window.resetAll = resetAll; window.submitWeeklyUpdate = submitWeeklyUpdate;
  if (window.Router) window.Router.register('weekly-update', { title: 'Cập nhật tiến độ tuần', init: _wuInit });
})();
