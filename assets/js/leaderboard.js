/* leaderboard.js — tách từ inline leaderboard.html (SPA module) */
(function () {
  'use strict';
var _lbData      = null;
var _kpiData     = null;
var _lbCache     = {};   // usecase_id → leaderboard row object
var _lbDetailUc  = null; // currently-open UC (merged leaderboard + full data)
var _activeTab   = 'top';

// SPA: init do router gọi (shell lo auth/sidebar/logout/nav)
function _lbInit() {
  loadLeaderboard();
  ['pmA3', 'pmA4'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', _recomputePm);
  });
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modal = document.getElementById('lbDetailModal');
    if (modal && !modal.classList.contains('hidden')) lbCloseDetail();
  }
});

function loadLeaderboard() {
  var team = document.getElementById('filterTeam').value;

  setLoading(true);
  Api.jsonp(API.h2Leaderboard({ team: team, limit: 50 }), function(res) {
    if (!res || !res.success) { setError('Không tải được dữ liệu'); return; }
    _lbData = res.data;
    _lbCache = {};
    renderAll(_lbData);
    setLoading(false);
  });
  loadKpi(team);
}

function loadKpi(team) {
  Api.jsonp(API.kpiLeaderboard({ team: team }), function(res) {
    if (!res || !res.success) return;
    _kpiData = res.data;
    renderKpiMember('kpiMemberTable', _kpiData.member_ranking || []);
    renderKpiTeamlead('kpiTeamleadTable', _kpiData.teamlead_ranking || []);
    document.getElementById('kpiMemberCount').textContent   = (_kpiData.member_ranking   || []).length + ' thành viên';
    document.getElementById('kpiTeamleadCount').textContent = (_kpiData.teamlead_ranking || []).length + ' teamlead';
    renderPmCard(_kpiData);
    renderHeatmap(_kpiData);
  });
}

// P06 Heatmap: lưới team × cá nhân tô màu theo rank KPI (xanh ≥70 · vàng 50–69 · đỏ <50).
function _heatColor(final) {
  var t = parseFloat(final) || 0;
  if (t >= 85) return { bg: 'rgba(123,44,191,.14)', bd: '#7B2CBF', tx: '#5b1f95' }; // tím = xuất sắc
  if (t >= 70) return { bg: 'rgba(76,175,80,.16)',  bd: '#4CAF50', tx: '#2e7d32' }; // xanh = đạt
  if (t >= 50) return { bg: 'rgba(246,177,0,.18)',  bd: '#F6B100', tx: '#a06f00' }; // vàng
  return           { bg: 'rgba(244,67,54,.14)',  bd: '#F44336', tx: '#c62828' };     // đỏ
}
function renderHeatmap(data) {
  var el = document.getElementById('heatmapBody');
  if (!el) return;
  var members = (data && data.member_ranking) || [];
  var legend = document.getElementById('heatmapLegend');
  if (legend) legend.innerHTML =
    '<span style="color:#5b1f95">■ ≥85 xuất sắc</span> · <span style="color:#2e7d32">■ ≥70 đạt</span> · ' +
    '<span style="color:#a06f00">■ 50–69</span> · <span style="color:#c62828">■ &lt;50</span>';

  if (!members.length) {
    el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted)">Chưa có dữ liệu KPI để dựng heatmap</div>';
    return;
  }

  // Gom theo team
  var byTeam = {}; var order = [];
  members.forEach(function(m) {
    var t = m.team || '(không team)';
    if (!byTeam[t]) { byTeam[t] = []; order.push(t); }
    byTeam[t].push(m);
  });

  var html = order.map(function(team) {
    var list = byTeam[team].slice().sort(function(a,b){ return b.final - a.final; });
    var avg = Math.round((list.reduce(function(s,m){ return s + (m.final||0); }, 0) / list.length) * 10) / 10;
    var avgC = _heatColor(avg);
    var cells = list.map(function(m) {
      var c = _heatColor(m.final);
      return '<div title="' + esc(m.username) + '" style="flex:0 0 auto;min-width:110px;padding:8px 10px;border-radius:10px;' +
        'background:' + c.bg + ';border:1px solid ' + c.bd + '40">' +
        '<div style="font-weight:600;font-size:12px;color:var(--color-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + esc(m.display_name || m.username) + '</div>' +
        '<div style="font-size:18px;font-weight:800;color:' + c.tx + '">' + (m.final || 0) + '</div>' +
        '</div>';
    }).join('');
    return '<div class="section-panel" style="margin-bottom:var(--space-4)">' +
      '<div class="section-panel-header">' +
        '<span class="section-panel-title">' + esc(team) + '</span>' +
        '<span style="font-size:var(--text-sm);font-weight:700;color:' + avgC.tx + '">TB team: ' + avg + '</span>' +
      '</div>' +
      '<div class="section-panel-body"><div style="display:flex;flex-wrap:wrap;gap:8px">' + cells + '</div></div>' +
      '</div>';
  }).join('');
  el.innerHTML = html;
}

// KPI tổng hợp Member — breakdown M1..M4 − trừ
function renderKpiMember(containerId, items) {
  var el = document.getElementById(containerId);
  if (!items || items.length === 0) {
    el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted)">Chưa có dữ liệu KPI (cần điểm US hội đồng hoặc điểm cá nhân)</div>';
    return;
  }
  var rows = items.map(function(m, i) {
    var rank = m.rank || (i + 1);
    var cls  = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal';
    var rc = m.rank_category || '';
    var pill = RANK_LABELS[rc] ? ('background:' + RANK_LABELS[rc].bg + ';color:' + RANK_LABELS[rc].color) : '';
    var pen = m.penalty ? ('−' + m.penalty) : '0';
    return '<tr>' +
      '<td><div class="rank-num ' + cls + '">' + rank + '</div></td>' +
      '<td><div class="owner-cell"><span class="owner-name">' + esc(m.display_name || m.username) + '</span><span class="owner-team">' + esc(m.username) + '</span></div></td>' +
      '<td>' + esc(m.team || '—') + '</td>' +
      '<td class="lb-score-num" style="text-align:center">' + (m.m1 || 0) + '</td>' +
      '<td class="lb-score-num" style="text-align:center">' + (m.m2 || 0) + '</td>' +
      '<td class="lb-score-num" style="text-align:center">' + (m.m3 || 0) + '</td>' +
      '<td class="lb-score-num" style="text-align:center">' + (m.m4 || 0) + '</td>' +
      '<td class="lb-score-num" style="text-align:center;color:var(--color-error,#c62828)">' + pen + '</td>' +
      '<td><span class="rank-pill" style="' + pill + '">' + (RANK_LABELS[rc] ? RANK_LABELS[rc].label : (rc || '—')) + '</span></td>' +
      '<td class="lb-score-num lb-score-total">' + (m.final || 0) + '</td>' +
      '</tr>';
  }).join('');
  el.innerHTML = '<table class="rank-table"><thead><tr>' +
    '<th style="width:48px">#</th><th>Thành viên</th><th>Team</th>' +
    '<th class="lb-score-head">M1<br><small style="font-weight:400;opacity:.7">US·40</small></th>' +
    '<th class="lb-score-head">M2<br><small style="font-weight:400;opacity:.7">NL·30</small></th>' +
    '<th class="lb-score-head">M3<br><small style="font-weight:400;opacity:.7">Khóa·15</small></th>' +
    '<th class="lb-score-head">M4<br><small style="font-weight:400;opacity:.7">Lan·15</small></th>' +
    '<th class="lb-score-head">Trừ</th><th>Hạng</th>' +
    '<th class="lb-score-head">KPI<br><small style="font-weight:400;opacity:.7">/100</small></th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

// KPI Teamlead — T1 (60%) + T2 (% team ≥70%, 40%)
function renderKpiTeamlead(containerId, items) {
  var el = document.getElementById(containerId);
  if (!items || items.length === 0) {
    el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted)">Chưa có dữ liệu KPI Teamlead</div>';
    return;
  }
  var rows = items.map(function(t, i) {
    var rank = t.rank || (i + 1);
    var cls  = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal';
    var rc = t.rank_category || '';
    var pill = RANK_LABELS[rc] ? ('background:' + RANK_LABELS[rc].bg + ';color:' + RANK_LABELS[rc].color) : '';
    return '<tr>' +
      '<td><div class="rank-num ' + cls + '">' + rank + '</div></td>' +
      '<td><div class="owner-cell"><span class="owner-name">' + esc(t.display_name || t.username) + '</span><span class="owner-team">' + esc(t.username) + '</span></div></td>' +
      '<td>' + esc(t.team || '—') + '</td>' +
      '<td class="lb-score-num" style="text-align:center">' + (t.t1 || 0) + '</td>' +
      '<td class="lb-score-num" style="text-align:center">' + (t.t2 || 0) + '%<br><small style="color:var(--color-text-muted)">' + (t.pass_count || 0) + '/' + (t.team_size || 0) + '</small></td>' +
      '<td><span class="rank-pill" style="' + pill + '">' + (RANK_LABELS[rc] ? RANK_LABELS[rc].label : (rc || '—')) + '</span></td>' +
      '<td class="lb-score-num lb-score-total">' + (t.final || 0) + '</td>' +
      '</tr>';
  }).join('');
  el.innerHTML = '<table class="rank-table"><thead><tr>' +
    '<th style="width:48px">#</th><th>Teamlead</th><th>Team</th>' +
    '<th class="lb-score-head">T1<br><small style="font-weight:400;opacity:.7">KPI·60</small></th>' +
    '<th class="lb-score-head">T2<br><small style="font-weight:400;opacity:.7">team≥70·40</small></th>' +
    '<th>Hạng</th>' +
    '<th class="lb-score-head">KPI<br><small style="font-weight:400;opacity:.7">/100</small></th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

// PM card (bản A) — chỉ admin. A1 = KPI cá nhân PM (tìm trong member_ranking), A2 = center_avg.
function renderPmCard(data) {
  var card = document.getElementById('pmKpiCard');
  if (!card) return;
  var user = AuthService.getUser();
  var isAdmin = AuthService.isAdmin();
  if (!isAdmin) { card.style.display = 'none'; return; }
  card.style.display = '';

  var me = user ? String(user.email || '').toLowerCase() : '';
  var mine = (data.member_ranking || []).filter(function(m){ return m.username === me; })[0];
  var a1 = mine ? mine.final : 0;
  var a2 = data.center_avg || 0;
  document.getElementById('pmA1').textContent = a1;
  document.getElementById('pmA2').textContent = a2;
  card.setAttribute('data-a1', a1);
  card.setAttribute('data-a2', a2);
  _recomputePm();
}

function _recomputePm() {
  var card = document.getElementById('pmKpiCard');
  if (!card) return;
  var a1 = parseFloat(card.getAttribute('data-a1')) || 0;
  var a2 = parseFloat(card.getAttribute('data-a2')) || 0;
  var a3 = Math.max(0, Math.min(100, parseFloat(document.getElementById('pmA3').value) || 0));
  var a4 = Math.max(0, Math.min(100, parseFloat(document.getElementById('pmA4').value) || 0));
  var final = (typeof ScoringH2 !== 'undefined') ? ScoringH2.pmKpiFinal(a1, a2, a3, a4) : 0;
  var el = document.getElementById('pmKpiFinal');
  el.textContent = final;
  if (typeof ScoringH2 !== 'undefined') el.style.color = ScoringH2.rankInfo(final).color;
}

function renderAll(data) {
  if (!data) return;
  var uc = data.uc_ranking || [];
  var personal = data.personal_ranking || [];
  renderUcTable('topTable', uc);
  renderPersonalTable('personalTable', personal);
  document.getElementById('topCount').textContent      = uc.length + ' use cases';
  document.getElementById('personalCount').textContent = personal.length + ' thành viên';

  // Populate team dropdown from data
  var currentTeam = document.getElementById('filterTeam').value;
  var teams = {};
  uc.concat(personal).forEach(function(r) { if (r.team) teams[r.team] = 1; });
  var sel = document.getElementById('filterTeam');
  while (sel.options.length > 1) sel.remove(1);
  Object.keys(teams).sort().forEach(function(t) {
    var opt = document.createElement('option'); opt.value = t; opt.textContent = t;
    if (t === currentTeam) opt.selected = true;
    sel.appendChild(opt);
  });
}

// UC ranking = bình quân điểm hội đồng (Điểm US /100)
function renderUcTable(containerId, items) {
  var el = document.getElementById(containerId);
  if (!items || items.length === 0) {
    el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted)">Chưa có UC nào được hội đồng chấm</div>';
    return;
  }
  var rows = items.map(function(uc, i) {
    _lbCache[uc.usecase_id] = uc;
    var rank  = uc.rank || (i + 1);
    var cls   = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal';
    var rankCat = uc.rank_category || '';
    var pillStyle = RANK_LABELS[rankCat] ? ('background:' + RANK_LABELS[rankCat].bg + ';color:' + RANK_LABELS[rankCat].color) : '';
    var council = (uc.scored_count || 0) + '/' + (uc.council_size || 4);
    var uid = esc(uc.usecase_id).replace(/'/g, '\\\'');
    return '<tr class="lb-row-clickable" onclick="lbOpenDetail(\'' + uid + '\')">' +
      '<td><div class="rank-num ' + cls + '">' + rank + '</div></td>' +
      '<td><div class="owner-cell"><span class="owner-name">' + esc(uc.name) + '</span><span class="owner-team">' + esc(uc.usecase_id) + ' · ' + esc(uc.team) + '</span></div></td>' +
      '<td><div class="owner-cell"><span class="owner-name">' + esc(uc.owner_name) + '</span></div></td>' +
      '<td><span class="rank-pill" style="' + pillStyle + '">' + (RANK_LABELS[rankCat] ? RANK_LABELS[rankCat].label : (rankCat || '—')) + '</span></td>' +
      '<td class="lb-score-num" style="text-align:center">' + council + '</td>' +
      '<td class="lb-score-num lb-score-total">' + (uc.uc_score || 0) + '</td>' +
      '</tr>';
  }).join('');

  el.innerHTML = '<table class="rank-table">' +
    '<thead><tr>' +
    '<th style="width:48px">#</th>' +
    '<th>Use Case</th>' +
    '<th>Người đăng ký</th>' +
    '<th>Hạng</th>' +
    '<th class="lb-score-head">Hội đồng</th>' +
    '<th class="lb-score-head">Điểm US<br><small style="font-weight:400;opacity:.7">/100</small></th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
}

// Personal ranking = điểm cá nhân do teamlead chấm (Điểm CN /100)
function renderPersonalTable(containerId, items) {
  var el = document.getElementById(containerId);
  if (!items || items.length === 0) {
    el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted)">Chưa có thành viên nào được chấm điểm cá nhân</div>';
    return;
  }
  var rows = items.map(function(p, i) {
    var rank  = p.rank || (i + 1);
    var cls   = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal';
    var rankCat = p.rank_category || '';
    var pillStyle = RANK_LABELS[rankCat] ? ('background:' + RANK_LABELS[rankCat].bg + ';color:' + RANK_LABELS[rankCat].color) : '';
    return '<tr>' +
      '<td><div class="rank-num ' + cls + '">' + rank + '</div></td>' +
      '<td><div class="owner-cell"><span class="owner-name">' + esc(p.display_name || p.username) + '</span><span class="owner-team">' + esc(p.username) + '</span></div></td>' +
      '<td>' + esc(p.team || '—') + '</td>' +
      '<td><span class="rank-pill" style="' + pillStyle + '">' + (RANK_LABELS[rankCat] ? RANK_LABELS[rankCat].label : (rankCat || '—')) + '</span></td>' +
      '<td class="lb-score-num lb-score-total">' + (p.final_score || 0) + '</td>' +
      '</tr>';
  }).join('');

  el.innerHTML = '<table class="rank-table">' +
    '<thead><tr>' +
    '<th style="width:48px">#</th>' +
    '<th>Thành viên</th>' +
    '<th>Team</th>' +
    '<th>Hạng</th>' +
    '<th class="lb-score-head">Điểm CN<br><small style="font-weight:400;opacity:.7">/100</small></th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
}

// ── Detail popup ─────────────────────────────────────────────────────

function lbOpenDetail(uid) {
  var uc = _lbCache[uid];
  if (!uc) return;
  _lbDetailUc = uc;
  document.getElementById('lbDetailTitle').textContent = uc.name || 'Chi tiết Use Case';
  document.getElementById('lbDetailId').textContent    = uc.usecase_id || '';
  document.getElementById('lbDetailView').innerHTML    = _lbRenderBody(uc, false);
  document.getElementById('lbDetailModal').classList.remove('hidden');
  if (uc.record_id) _lbFetchFull(uc.record_id);
}

function lbCloseDetail() {
  document.getElementById('lbDetailModal').classList.add('hidden');
  _lbDetailUc = null;
}

async function _lbFetchFull(recordId) {
  try {
    var data = await Api.getUseCase(recordId);
    var full = _lbNormalize(data);
    if (_lbDetailUc && _lbDetailUc.record_id === recordId) {
      _lbDetailUc = Object.assign({}, _lbDetailUc, full);
      document.getElementById('lbDetailView').innerHTML = _lbRenderBody(_lbDetailUc, true);
    }
  } catch (_) {
    // GAS unavailable — partial view already shown
  }
}

function _lbNormalize(d) {
  if (!d) return {};
  return {
    record_id:            d.Record_ID              || '',
    usecase_id:           d.UseCase_ID             || '',
    name:                 d.UseCase_Name            || '',
    owner_name:           d.Owner_Name              || '',
    owner_email:          d.Owner_Email             || '',
    team:                 d.Team                    || '',
    category:             d.Business_Category       || '',
    stage:                d.Current_Stage           || '',
    status:               d.Status                  || '',
    submit_date:          d.Submit_Date             || d.Created_At || '',
    pain_point:           d.Pain_Point              || '',
    current_process:      d.Current_Process         || '',
    current_time_min:     d.Current_Time_Min        || '',
    current_problem:      d.Current_Problem         || '',
    user_type:            d.User_Type               || '',
    expected_goals:       d.Expected_Goals          || '',
    flow_description:     d.Flow_Description        || '',
    input_types:          d.Input_Types             || '',
    prompt_role:          d.Prompt_Role             || '',
    prompt_task:          d.Prompt_Task             || '',
    prompt_goal:          d.Prompt_Goal             || '',
    prompt_context:       d.Prompt_Context          || '',
    prompt_input:         d.Prompt_Input            || '',
    prompt_steps:         d.Prompt_Steps            || '',
    prompt_output_format: d.Prompt_Output_Format    || '',
    prompt_evaluation:    d.Prompt_Evaluation       || '',
    demo_status:          d.Demo_Status             || '',
    demo_link:            d.Demo_Link               || '',
    before_time_min:      d.Before_Time_Min         || '',
    after_time_min:       d.After_Time_Min          || '',
    quality_improvement:  d.Quality_Improvement     || '',
    improvement_note:     d.Improvement_Note        || '',
    reuse_level:          d.Reuse_Level             || '',
    reuse_adjustment:     d.Reuse_Adjustment        || '',
    when_to_use:          d.When_To_Use             || '',
    usage_steps:          d.Usage_Steps             || '',
    usage_notes:          d.Usage_Notes             || '',
    review_comment:       d.Review_Comment          || '',
    reviewer_email:       d.Reviewer                || d.reviewer_email || '',
    quality_score:        (parseFloat(d.Quality_Score        || d.quality_score)        || 0),
    business_value_score: (parseFloat(d.Business_Value_Score || d.business_value_score) || 0),
    innovation_score:     (parseFloat(d.Innovation_Score     || d.innovation_score)     || 0),
    auto_score:           (parseFloat(d.Auto_Score           || d.auto_score)           || 0),
    manual_score:         (parseFloat(d.Manual_Score         || d.manual_score)         || 0),
    total_score:          (parseFloat(d.Total_Score          || d.total_score)          || 0),
    rank_category:        d.Rank_Category || d.rank_category || ''
  };
}

function _lbRenderBody(uc, isFullData) {
  var html = '';

  // ── Section 1: Thông tin nghiệp vụ ─────────────────────────────
  html += _lbSection('1', 'Thông tin nghiệp vụ', [
    _lbGrid([
      ['Người đăng ký', uc.owner_name],
      ['Team',          uc.team],
      ['Lĩnh vực',      uc.category],
      ['Giai đoạn',     uc.stage],
      ['Ngày nộp',      _lbFmtDate(uc.submit_date || uc.submitted_at)]
    ]),
    _lbField('Điểm đau nghiệp vụ', uc.pain_point,      true),
    _lbField('Quy trình hiện tại',  uc.current_process, true),
    _lbGrid([
      ['Thời gian xử lý hiện tại', uc.current_time_min ? uc.current_time_min + ' phút' : ''],
      ['Hệ quả / Rủi ro',          uc.current_problem]
    ]),
    _lbField('Đối tượng sử dụng', uc.user_type,      false),
    _lbField('Mục tiêu kỳ vọng',  uc.expected_goals, false)
  ]);

  // ── Section 2: Luồng AI & Prompt ────────────────────────────────
  var s2 = _lbField('Mô tả luồng xử lý AI', uc.flow_description, true) +
           _lbField('Loại dữ liệu đầu vào',  uc.input_types,      false) +
           _lbSubsec('Thiết kế Prompt', [
             _lbField('Vai trò AI (Role)',              uc.prompt_role,          true),
             _lbField('Nhiệm vụ cụ thể (Task)',         uc.prompt_task,          true),
             _lbField('Mục tiêu đầu ra (Goal)',         uc.prompt_goal,          true),
             _lbField('Ngữ cảnh bổ sung (Context)',     uc.prompt_context,       true),
             _lbField('Mô tả đầu vào (Input)',          uc.prompt_input,         true),
             _lbField('Các bước xử lý (Steps)',         uc.prompt_steps,         true),
             _lbField('Định dạng đầu ra (Output)',      uc.prompt_output_format, true),
             _lbField('Tiêu chí đánh giá (Evaluation)', uc.prompt_evaluation,   true)
           ]);
  if (s2.trim()) html += _lbSection('2', 'Luồng AI & Prompt', [s2]);

  // ── Section 3: Demo & Tái sử dụng ───────────────────────────────
  var timeSaved = '';
  if (uc.before_time_min && uc.after_time_min) {
    var before = parseFloat(uc.before_time_min), after = parseFloat(uc.after_time_min);
    if (before > 0) timeSaved = ' (' + Math.round(((before - after) / before) * 100) + '% tiết kiệm)';
  }
  var s3 = _lbGrid([
             ['Trạng thái demo',           uc.demo_status],
             ['Thời gian trước khi có AI', uc.before_time_min ? uc.before_time_min + ' phút' : ''],
             ['Thời gian sau khi có AI',   uc.after_time_min  ? uc.after_time_min + ' phút' + timeSaved : '']
           ]) +
           _lbDemoField('Link demo / tài liệu', uc.demo_link) +
           _lbField('Cải thiện chất lượng',                  uc.quality_improvement, true) +
           _lbField('Ghi chú thêm về hiệu quả',              uc.improvement_note,    true) +
           _lbField('Phạm vi tái sử dụng',                   uc.reuse_level,         false) +
           _lbField('Hướng dẫn điều chỉnh khi tái sử dụng', uc.reuse_adjustment,    true);
  if (s3.trim()) html += _lbSection('3', 'Demo & Tái sử dụng', [s3]);

  // ── Section 4: Hướng dẫn sử dụng ───────────────────────────────
  var s4 = _lbField('Khi nào nên dùng use case này?', uc.when_to_use, true) +
           _lbField('Hướng dẫn thực hiện từng bước',  uc.usage_steps, true) +
           _lbField('Lưu ý & hạn chế',                uc.usage_notes, true);
  if (s4.trim()) html += _lbSection('4', 'Hướng dẫn sử dụng', [s4]);

  // ── Section 5: Thông tin phê duyệt ──────────────────────────────
  var s5 = _lbGrid([['Người duyệt', uc.reviewer_email]]) +
           _lbField('Nhận xét duyệt', uc.review_comment, true);
  if (s5.trim()) html += _lbSection('✓', 'Thông tin phê duyệt', [s5], 'detail-section--review');

  // ── Section ★: Điểm US (hội đồng) ──────────────────────────────
  // H2 Giai đoạn 3: điểm US = bình quân hội đồng (3 tiêu chí 30/40/30). Bỏ breakdown Auto/Champion 70/30.
  (function() {
    var total  = uc.uc_score != null ? uc.uc_score : (uc.total_score || 0);
    var rkInfo = RANK_LABELS[uc.rank_category] || null;
    var hasScore = total > 0;

    var sScore = '';
    if (!hasScore) {
      sScore = '<div class="not-scored-notice"><span class="not-scored-icon">⏳</span><span>Chưa được hội đồng chấm điểm</span></div>';
    } else {
      var rankBadge = rkInfo
        ? '<span class="score-rank-badge" style="background:' + rkInfo.color + '20;color:' + rkInfo.color + ';border:1px solid ' + rkInfo.color + '40">' + esc(rkInfo.label) + '</span>'
        : '';
      sScore += '<div class="score-total-row">' +
        '<div class="score-total-num"><span class="score-total-val">' + total + '</span><span class="score-total-max">&nbsp;/100</span><span class="score-total-label">Điểm US (hội đồng)</span></div>' +
        rankBadge +
      '</div>';
      var councilInfo = (uc.scored_count != null)
        ? '<p class="score-subsection-note">Bình quân ' + uc.scored_count + '/' + (uc.council_size || 4) + ' thành viên hội đồng · 3 tiêu chí: Tiết kiệm 30% · Tự động hóa 40% · Sáng tạo 30%.</p>'
        : '<p class="score-subsection-note">Bình quân điểm hội đồng · 3 tiêu chí: Tiết kiệm 30% · Tự động hóa 40% · Sáng tạo 30%.</p>';
      sScore += '<div class="score-subsections"><div class="score-subsection">' + councilInfo + '</div></div>';
    }
    html += _lbSection('★', 'Điểm US (hội đồng)', [sScore], 'detail-section--score');
  })();

  if (!isFullData && uc.record_id) {
    html += '<div class="detail-loading-hint">Đang tải nội dung chi tiết từ server...</div>';
  }

  return html || '<p class="empty-state-text" style="padding:var(--space-6)">Không có dữ liệu</p>';
}

// ── Detail render helpers ────────────────────────────────────────────

function _lbSection(step, title, parts, extra) {
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

function _lbSubsec(title, parts) {
  var body = parts.join('');
  if (!body.trim()) return '';
  return '<div class="detail-subsection">' +
    '<div class="detail-subsection-title">' + esc(title) + '</div>' +
    '<div class="detail-section-body">' + body + '</div>' +
  '</div>';
}

function _lbGrid(pairs) {
  var cells = pairs.filter(function(p) { return p[1] && String(p[1]).trim(); });
  if (!cells.length) return '';
  return '<div class="detail-grid-2col">' +
    cells.map(function(p) {
      return '<div class="detail-field">' +
        '<div class="detail-label">' + esc(p[0]) + '</div>' +
        '<div class="detail-value">'  + esc(String(p[1])) + '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function _lbField(label, value, pre) {
  if (!value && value !== 0) return '';
  var val = String(value).trim();
  if (!val) return '';
  return '<div class="detail-field detail-field--full">' +
    '<div class="detail-label">' + esc(label) + '</div>' +
    '<div class="detail-value' + (pre ? ' detail-value--pre' : '') + '">' + esc(val) + '</div>' +
  '</div>';
}

// Link demo bấm được + Copy (v3.15.0) — mirror của dashboard.js
function _lbDemoLinkHtml(url) {
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
  var copyBtn = b64 ? ' <button type="button" class="demo-copy-btn" onclick="lbCopyB64(\'' + b64 + '\')">📋 Copy</button>' : '';
  return body + copyBtn;
}

function _lbDemoField(label, url) {
  var inner = _lbDemoLinkHtml(url);
  if (!inner) return '';
  return '<div class="detail-field detail-field--full">' +
    '<div class="detail-label">' + esc(label) + '</div>' +
    '<div class="detail-value detail-value--demo">' + inner + '</div>' +
  '</div>';
}

function lbCopyB64(b64) {
  var text;
  try { text = decodeURIComponent(escape(atob(b64))); } catch (_e) { return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function () { _lbFallbackCopy(text); });
  } else {
    _lbFallbackCopy(text);
  }
}

function _lbFallbackCopy(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (_e) { /* ignore */ }
}

function _lbFmtDate(isoStr) {
  if (!isoStr) return '--';
  try {
    var d = new Date(isoStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) { return String(isoStr).substring(0, 10); }
}

// ── Page utilities ───────────────────────────────────────────────────

function switchTab(tab, el) {
  _activeTab = tab;
  document.querySelectorAll('.lb-tab').forEach(function(t) { t.classList.remove('is-active'); });
  el.classList.add('is-active');
  document.getElementById('tabTop').style.display         = tab === 'top'         ? '' : 'none';
  document.getElementById('tabPersonal').style.display    = tab === 'personal'    ? '' : 'none';
  document.getElementById('tabKpiMember').style.display   = tab === 'kpiMember'   ? '' : 'none';
  document.getElementById('tabKpiTeamlead').style.display = tab === 'kpiTeamlead' ? '' : 'none';
  document.getElementById('tabHeatmap').style.display     = tab === 'heatmap'     ? '' : 'none';
}

function setLoading(on) {
  document.getElementById('btnRefresh').disabled = on;
}

function setError(msg) {
  ['topTable','personalTable'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-error)">' + msg + '</div>';
  });
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // expose cho onclick trong HTML/generated rows
  window.loadLeaderboard = loadLeaderboard;
  window.switchTab       = switchTab;
  window.lbOpenDetail    = lbOpenDetail;
  window.lbCloseDetail   = lbCloseDetail;
  if (window.Router) window.Router.register('leaderboard', { title: 'Leaderboard', init: _lbInit });
})();
