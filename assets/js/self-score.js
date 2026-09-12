// ─────────────────────────────────────────────────────────────────
// self-score.js — CR (2026-09-12 #3)
//   • View "my-score"      : MEMBER tự chấm KPI tháng (M2 + M3) + khai Lan tỏa AI (M4) → nộp teamlead.
//   • View "score-review"  : TEAMLEAD/admin duyệt (approve/reject) tự chấm + lan tỏa của team.
// Điểm chỉ tính KPI SAU khi Approved (backend chốt sang PERSONAL_SCORE). Không đụng engine KPI.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _tok()  { return (typeof AuthService !== 'undefined' && AuthService.getToken) ? AuthService.getToken() : ''; }
  function _user() { return (typeof AuthService !== 'undefined') ? AuthService.getUser() : null; }
  function showToast(m, t) { if (typeof Toast !== 'undefined') Toast.show(m, t || 'info'); }
  function _num(id) { var el = document.getElementById(id); var n = parseFloat(el ? el.value : 0); return isFinite(n) ? n : 0; }
  function _val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function _clamp10(v) { v = parseFloat(v) || 0; return Math.max(0, Math.min(10, v)); }
  function _monthLabel() { var d = new Date(); return 'Tháng ' + ('0'+(d.getMonth()+1)).slice(-2) + '/' + d.getFullYear(); }

  var STATUS_BADGE = {
    Draft:     { t: 'Nháp',            bg:'#F5F5F7', fg:'#6D6D7A' },
    Submitted: { t: 'Chờ duyệt',       bg:'#FFF4D6', fg:'#946200' },
    Approved:  { t: 'Đã duyệt ✓',      bg:'#E6F4EA', fg:'#1E7B34' },
    Rejected:  { t: 'Bị từ chối',      bg:'#FDECEC', fg:'#B3261E' }
  };
  function _badge(status) {
    var b = STATUS_BADGE[status] || STATUS_BADGE.Draft;
    return '<span style="font-size:var(--text-xs);font-weight:700;padding:2px 10px;border-radius:999px;background:'+b.bg+';color:'+b.fg+'">'+b.t+'</span>';
  }

  // ══════════════ VIEW: my-score (member) ══════════════
  var _mine = null; // bản self-score tháng hiện tại

  function _proposedM2() { return Math.round((_clamp10(_num('ssDiv'))*0.30 + _clamp10(_num('ssAi'))*0.20 + _clamp10(_num('ssPq'))*0.30 + _clamp10(_num('ssQm'))*0.20)*10); }
  function _proposedM3() { var c=Math.max(0,Math.round(_num('ssCourses'))), p=Math.min(c,Math.max(0,Math.round(_num('ssCoursesPaid')))); return Math.min(100,(c+p)*25); }
  function _refreshPreview() {
    var e2=document.getElementById('ssPrevM2'); if(e2) e2.textContent=_proposedM2()+'/100';
    var e3=document.getElementById('ssPrevM3'); if(e3) e3.textContent=_proposedM3()+'/100';
  }

  function _myInit() {
    var mEl = document.getElementById('myScoreMonth'); if (mEl) mEl.textContent = _monthLabel();
    ['ssDiv','ssAi','ssPq','ssQm','ssCourses','ssCoursesPaid'].forEach(function(id){
      var el=document.getElementById(id); if(el && !el._b){ el.addEventListener('input',_refreshPreview); el._b=true; }
    });
    var sd=document.getElementById('ssSaveDraftBtn'); if(sd&&!sd._b){ sd.addEventListener('click',function(){_submitSelf('draft');}); sd._b=true; }
    var sb=document.getElementById('ssSubmitBtn');    if(sb&&!sb._b){ sb.addEventListener('click',function(){_submitSelf('submit');}); sb._b=true; }
    var cs=document.getElementById('scSubmitBtn');     if(cs&&!cs._b){ cs.addEventListener('click',_submitClaim); cs._b=true; }
    _loadMine(); _loadMyClaims();
  }

  function _loadMine() {
    Api.getSelfScoreMine({ token: _tok() }).then(function(res){
      var rows = Array.isArray(res)?res:(res&&(res.data||res.items))||[];
      var cur = rows.filter(function(r){ return r.month===_monthLabel(); })[0] || null;
      _mine = cur;
      _fillSelf(cur);
    }).catch(function(){ /* im lặng: form trống để nhập mới */ });
  }

  function _fillSelf(r) {
    var set=function(id,v){ var el=document.getElementById(id); if(el) el.value=(v==null?'':v); };
    set('ssDiv', r?r.diversity:''); set('ssAi', r?r.ai_proficiency:''); set('ssPq', r?r.product_quality:''); set('ssQm', r?r.quantity_met:'');
    set('ssCourses', r?r.courses_completed:''); set('ssCoursesPaid', r?r.courses_paid:'');
    set('ssEvM2', r?r.evidence_m2:''); set('ssEvM3', r?r.evidence_m3:'');
    var st=document.getElementById('ssStatus'); if(st) st.innerHTML = r ? _badge(r.status) : _badge('Draft');
    var rc=document.getElementById('ssReviewMsg');
    if(rc){ rc.innerHTML = (r && r.status==='Rejected' && r.review_comment) ? ('⚠ Teamlead từ chối: '+esc(r.review_comment)+' — hãy sửa và nộp lại.') : ''; }
    var locked = !!(r && r.status==='Approved');
    ['ssDiv','ssAi','ssPq','ssQm','ssCourses','ssCoursesPaid','ssEvM2','ssEvM3','ssSaveDraftBtn','ssSubmitBtn'].forEach(function(id){ var el=document.getElementById(id); if(el) el.disabled=locked; });
    var lk=document.getElementById('ssLockMsg'); if(lk) lk.style.display = locked?'':'none';
    _refreshPreview();
  }

  function _submitSelf(action) {
    var payload = {
      token: _tok(), action: action, Month: _monthLabel(),
      Diversity:_clamp10(_num('ssDiv')), AI_Proficiency:_clamp10(_num('ssAi')),
      Product_Quality:_clamp10(_num('ssPq')), Quantity_Met:_clamp10(_num('ssQm')),
      Courses_Completed:Math.max(0,Math.round(_num('ssCourses'))), Courses_Paid:Math.max(0,Math.round(_num('ssCoursesPaid'))),
      Evidence_M2:_val('ssEvM2'), Evidence_M3:_val('ssEvM3')
    };
    var btns=['ssSaveDraftBtn','ssSubmitBtn']; btns.forEach(function(id){var b=document.getElementById(id); if(b)b.disabled=true;});
    Api.submitSelfScore(payload).then(function(){
      showToast(action==='submit'?'Đã nộp cho teamlead duyệt!':'Đã lưu nháp.','success'); _loadMine();
    }).catch(function(e){ showToast('Lỗi: '+((e&&e.message)||e),'error'); btns.forEach(function(id){var b=document.getElementById(id); if(b)b.disabled=false;}); });
  }

  function _submitClaim() {
    var desc=_val('scDesc'), ev=_val('scEvidence');
    if(!desc){ showToast('Nhập mô tả hoạt động lan tỏa','error'); return; }
    if(!ev){ showToast('Nhập link bằng chứng lan tỏa','error'); return; }
    var btn=document.getElementById('scSubmitBtn'); if(btn)btn.disabled=true;
    Api.submitSharingClaim({ token:_tok(), Month:_monthLabel(), Claim_Type:_val('scType'), Description:desc, Evidence_Link:ev }).then(function(){
      showToast('Đã nộp khai lan tỏa cho teamlead!','success');
      ['scType','scDesc','scEvidence'].forEach(function(id){var el=document.getElementById(id); if(el)el.value='';});
      _loadMyClaims();
    }).catch(function(e){ showToast('Lỗi: '+((e&&e.message)||e),'error'); }).then(function(){ if(btn)btn.disabled=false; });
  }

  function _loadMyClaims() {
    Api.listSharingClaims({ token:_tok(), scope:'mine' }).then(function(res){
      var rows=Array.isArray(res)?res:(res&&(res.data||res.items))||[];
      var wrap=document.getElementById('scList'); if(!wrap) return;
      if(!rows.length){ wrap.innerHTML='<p style="color:var(--color-text-muted);font-size:var(--text-sm)">Chưa có khai lan tỏa nào.</p>'; return; }
      wrap.innerHTML = rows.map(function(c){
        return '<div class="dash-card" style="padding:var(--space-3);display:flex;flex-direction:column;gap:4px">'+
          '<div style="display:flex;justify-content:space-between;gap:8px"><span style="font-weight:600">'+esc(c.month)+(c.claim_type?(' · '+esc(c.claim_type)):'')+'</span>'+_badge(c.status)+'</div>'+
          '<div style="font-size:var(--text-sm)">'+esc(c.description)+'</div>'+
          (c.evidence_link?'<a href="'+esc(c.evidence_link)+'" target="_blank" rel="noopener" style="font-size:12px">Bằng chứng ↗</a>':'')+
          (c.status==='Rejected'&&c.review_comment?'<div style="font-size:12px;color:var(--color-error)">⚠ '+esc(c.review_comment)+'</div>':'')+
        '</div>';
      }).join('');
    }).catch(function(){});
  }

  // ══════════════ VIEW: score-review (teamlead) ══════════════
  function _revInit() { _loadPendingSelf(); _loadPendingClaims(); }

  function _loadPendingSelf() {
    var wrap=document.getElementById('srSelfList'); if(wrap) wrap.innerHTML='<p style="color:var(--color-text-muted)">Đang tải…</p>';
    Api.listSelfScorePending({ token:_tok(), status:'Submitted' }).then(function(res){
      var rows=Array.isArray(res)?res:(res&&(res.data||res.items))||[];
      if(!wrap) return;
      var cnt=document.getElementById('srSelfCount'); if(cnt) cnt.textContent=rows.length+' chờ duyệt';
      if(!rows.length){ wrap.innerHTML='<p style="color:var(--color-text-muted)">Không có bản tự chấm nào chờ duyệt.</p>'; return; }
      wrap.innerHTML = rows.map(function(r){
        var ev = [];
        if(r.evidence_m2) ev.push('<a href="'+esc(r.evidence_m2)+'" target="_blank" rel="noopener">BC KPI2 ↗</a>');
        if(r.evidence_m3) ev.push('<a href="'+esc(r.evidence_m3)+'" target="_blank" rel="noopener">BC KPI3 ↗</a>');
        return '<div class="dash-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px" data-id="'+esc(r.self_id)+'">'+
          '<div style="display:flex;justify-content:space-between;gap:8px"><span style="font-weight:600">'+esc(r.display_name||r.username)+' · '+esc(r.team)+'</span><span style="font-size:12px;color:var(--color-text-muted)">'+esc(r.month)+'</span></div>'+
          '<div style="font-size:var(--text-sm)">KPI2 (năng lực): tự chấm <b>'+r.proposed_m2+'/100</b> (DV '+r.diversity+' · AI '+r.ai_proficiency+' · CL '+r.product_quality+' · SL '+r.quantity_met+')</div>'+
          '<div style="font-size:var(--text-sm)">KPI3 (khóa học): '+r.courses_completed+' khóa (trả phí '+r.courses_paid+') → <b>'+r.proposed_m3+'/100</b></div>'+
          (ev.length?'<div style="font-size:12px;display:flex;gap:10px">'+ev.join('')+'</div>':'<div style="font-size:12px;color:var(--color-text-muted)">(không đính bằng chứng)</div>')+
          '<div style="display:flex;gap:6px;align-items:center;margin-top:2px">'+
            '<input type="text" class="form-input srComment" placeholder="Lý do (bắt buộc khi từ chối)" style="flex:1;font-size:12px;padding:6px 8px">'+
            '<button class="btn btn--sm" style="background:var(--color-success,#2e7d32);color:#fff" onclick="ScoreReview.approveSelf(\''+esc(r.self_id)+'\',this)">Duyệt</button>'+
            '<button class="btn btn--sm btn--ghost" style="color:var(--color-error)" onclick="ScoreReview.rejectSelf(\''+esc(r.self_id)+'\',this)">Từ chối</button>'+
          '</div></div>';
      }).join('');
    }).catch(function(e){ if(wrap) wrap.innerHTML='<p style="color:var(--color-error)">Lỗi tải: '+esc((e&&e.message)||e)+'</p>'; });
  }

  function _loadPendingClaims() {
    var wrap=document.getElementById('srClaimList'); if(wrap) wrap.innerHTML='<p style="color:var(--color-text-muted)">Đang tải…</p>';
    Api.listSharingClaims({ token:_tok(), scope:'review', status:'Submitted' }).then(function(res){
      var rows=Array.isArray(res)?res:(res&&(res.data||res.items))||[];
      if(!wrap) return;
      var cnt=document.getElementById('srClaimCount'); if(cnt) cnt.textContent=rows.length+' chờ duyệt';
      if(!rows.length){ wrap.innerHTML='<p style="color:var(--color-text-muted)">Không có khai lan tỏa nào chờ duyệt.</p>'; return; }
      wrap.innerHTML = rows.map(function(c){
        return '<div class="dash-card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:6px">'+
          '<div style="display:flex;justify-content:space-between;gap:8px"><span style="font-weight:600">'+esc(c.display_name||c.username)+' · '+esc(c.team)+'</span><span style="font-size:12px;color:var(--color-text-muted)">'+esc(c.month)+(c.claim_type?(' · '+esc(c.claim_type)):'')+'</span></div>'+
          '<div style="font-size:var(--text-sm)">'+esc(c.description)+'</div>'+
          (c.evidence_link?'<a href="'+esc(c.evidence_link)+'" target="_blank" rel="noopener" style="font-size:12px">Bằng chứng ↗</a>':'<span style="font-size:12px;color:var(--color-text-muted)">(không có link)</span>')+
          '<div style="display:flex;gap:6px;align-items:center;margin-top:2px">'+
            '<input type="text" class="form-input srComment" placeholder="Lý do (bắt buộc khi từ chối)" style="flex:1;font-size:12px;padding:6px 8px">'+
            '<button class="btn btn--sm" style="background:var(--color-success,#2e7d32);color:#fff" onclick="ScoreReview.approveClaim(\''+esc(c.claim_id)+'\',this)">Duyệt</button>'+
            '<button class="btn btn--sm btn--ghost" style="color:var(--color-error)" onclick="ScoreReview.rejectClaim(\''+esc(c.claim_id)+'\',this)">Từ chối</button>'+
          '</div></div>';
      }).join('');
    }).catch(function(e){ if(wrap) wrap.innerHTML='<p style="color:var(--color-error)">Lỗi tải: '+esc((e&&e.message)||e)+'</p>'; });
  }

  function _commentOf(btn){ var card=btn.closest('.dash-card'); var i=card?card.querySelector('.srComment'):null; return i?i.value.trim():''; }

  function _reviewSelf(id, action, btn) {
    var comment=_commentOf(btn);
    if(action==='reject' && !comment){ showToast('Từ chối phải kèm lý do','error'); return; }
    Api.reviewSelfScore({ token:_tok(), Self_ID:id, action:action, Review_Comment:comment }).then(function(){
      showToast(action==='approve'?'Đã duyệt (đã tính vào KPI).':'Đã từ chối.','success'); _loadPendingSelf();
    }).catch(function(e){ showToast('Lỗi: '+((e&&e.message)||e),'error'); });
  }
  function _reviewClaim(id, action, btn) {
    var comment=_commentOf(btn);
    if(action==='reject' && !comment){ showToast('Từ chối phải kèm lý do','error'); return; }
    Api.reviewSharingClaim({ token:_tok(), Claim_ID:id, action:action, Review_Comment:comment }).then(function(){
      showToast(action==='approve'?'Đã duyệt lan tỏa (tính M4).':'Đã từ chối.','success'); _loadPendingClaims();
    }).catch(function(e){ showToast('Lỗi: '+((e&&e.message)||e),'error'); });
  }

  window.ScoreReview = {
    approveSelf: function(id,b){ _reviewSelf(id,'approve',b); }, rejectSelf: function(id,b){ _reviewSelf(id,'reject',b); },
    approveClaim:function(id,b){ _reviewClaim(id,'approve',b); }, rejectClaim:function(id,b){ _reviewClaim(id,'reject',b); }
  };
  window.MyScore = { reload: _loadMine };

  if (window.Router) {
    window.Router.register('my-score',     { title: 'Tự chấm KPI của tôi', init: _myInit });
    window.Router.register('score-review', { title: 'Duyệt chấm điểm', roles: ['admin','champion','teamlead'], init: _revInit });
  }
})();
