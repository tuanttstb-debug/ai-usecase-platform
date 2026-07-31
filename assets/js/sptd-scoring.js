/* ─────────────────────────────────────────
   sptd-scoring.js — SPTD User Performance Score
   Công thức 80-10-10:
     80% chất lượng  = avg(total_score của UC Approved) / 100 × 80
     10% số lượng    = min(n_approved / n_weeks, 1) × 10
     10% tuần đạt    = n_weeks_hit / n_weeks × 10
   T0  = APP_CONFIG.PROGRAM_START_DATE (mặc định: 2026-05-01)
   Tuần = Monday-anchored ISO weeks từ T0's Monday.
   ───────────────────────────────────────── */
var SPTDScoring = (function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────

  function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  function _r1(v) { return Math.round(v * 10) / 10; }

  function _getT0() {
    var cfg = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.PROGRAM_START_DATE)
      ? APP_CONFIG.PROGRAM_START_DATE : '2026-05-01';
    return new Date(cfg + 'T00:00:00');
  }

  // Monday 00:00:00 of the week containing d
  function _getMonday(d) {
    var dt  = new Date(d);
    var day = dt.getDay(); // 0=Sun
    dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  // 0-based week index from t0monday. Returns -1 if before program.
  function _weekIdx(date, t0mon) {
    var mon  = _getMonday(date);
    var diff = mon.getTime() - t0mon.getTime();
    if (diff < 0) return -1;
    return Math.floor(diff / (7 * 24 * 3600 * 1000));
  }

  // Total weeks elapsed from T0 (current week counts as +1)
  function _totalWeeks(t0mon) {
    return _weekIdx(new Date(), t0mon) + 1;
  }

  function _fmtDate(d) {
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  }

  // ── Rank ───────────────────────────────────────────────────────────

  function getRank(score) {
    if (score >= 80) return { label: 'Xuất sắc',      color: '#7B2CBF' };
    if (score >= 65) return { label: 'Tốt',            color: '#4CAF50' };
    if (score >= 45) return { label: 'Trung bình',     color: '#F6B100' };
    return              { label: 'Cần cải thiện',   color: '#F44336' };
  }

  // ── Score computation ──────────────────────────────────────────────

  function _computeScore(bucket, nWeeks) {
    var zero = { n_approved: 0, avg_quality: 0, n_weeks_hit: 0,
                 s_quality: 0, s_quantity: 0, s_weeks: 0, total: 0 };
    if (!bucket) return zero;
    var ucs = bucket.ucs || [];
    // qty = số lượng (UC Approved + milestone đã duyệt). Quality avg CHỈ tính từ UC.
    var qty = (bucket.qty != null) ? bucket.qty : ucs.length;
    if (!qty) return zero;
    var sum = 0;
    ucs.forEach(function (uc) { sum += (uc.total_score || 0); });
    var avg_q      = ucs.length ? (sum / ucs.length) : 0;
    var n_wh       = Object.keys(bucket.wkHit).length;
    var s_quality  = (avg_q / 100) * 80;
    var s_quantity = Math.min(qty / nWeeks, 1) * 10;
    var s_weeks    = (n_wh / nWeeks) * 10;
    var total      = s_quality + s_quantity + s_weeks;
    return {
      n_approved:  qty,
      avg_quality: _r1(avg_q),
      n_weeks_hit: n_wh,
      s_quality:   _r1(s_quality),
      s_quantity:  _r1(s_quantity),
      s_weeks:     _r1(s_weeks),
      total:       _r1(total)
    };
  }

  function _mergeBuckets(a, b) {
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    return {
      ucs:     a.ucs.concat(b.ucs),
      qty:     ((a.qty != null) ? a.qty : a.ucs.length) + ((b.qty != null) ? b.qty : b.ucs.length),
      wkHit:   Object.assign({}, a.wkHit, b.wkHit),
      rawName: a.rawName || b.rawName,
      team:    a.team !== '--' ? a.team : b.team
    };
  }

  // Build per-user buckets indexed by norm(owner_email) and norm(owner_name).
  // milestones (đã duyệt) cộng vào qty + weeks-hit, KHÔNG cộng vào ucs (quality avg). v3.14.0
  function _buildBuckets(allList, t0mon, milestones) {
    var byEmail = {}, byName = {};
    function ensure(map, key, rawName, team) {
      if (!map[key]) map[key] = { ucs: [], qty: 0, wkHit: {}, rawName: rawName, team: team };
      return map[key];
    }
    allList.forEach(function (uc) {
      if (uc.status !== 'Approved') return;
      var ds = uc.submit_date || uc.submitted_at;
      if (!ds) return;
      var wi = _weekIdx(new Date(ds), t0mon);
      if (wi < 0) return; // before program start
      var eKey = _norm(uc.owner_email);
      var nKey = _norm(uc.owner_name);
      var rawName = String(uc.owner_name || '').trim();
      var team = uc.team || '--';
      function addTo(map, key) {
        if (!key) return;
        var b = ensure(map, key, rawName, team);
        b.ucs.push(uc);
        b.qty++;
        b.wkHit[wi] = true;
      }
      if (eKey) addTo(byEmail, eKey);
      if (nKey && nKey !== eKey) addTo(byName, nKey);
    });

    (milestones || []).forEach(function (m) {
      if (String(m.approval_status || 'Approved') !== 'Approved') return;
      var ds = m.log_date;
      if (!ds) return;
      var wi = _weekIdx(new Date(ds), t0mon);
      if (wi < 0) return;
      var eKey = _norm(m.owner_email);
      var nKey = _norm(m.owner_name);
      var rawName = String(m.owner_name || '').trim();
      var team = m.team || '--';
      function addMs(map, key) {
        if (!key) return;
        var b = ensure(map, key, rawName, team);
        b.qty++;
        b.wkHit[wi] = true;
      }
      if (eKey) addMs(byEmail, eKey);
      if (nKey && nKey !== eKey) addMs(byName, nKey);
    });

    return { byEmail: byEmail, byName: byName };
  }

  function _makeEntry(key, displayName, team, bucket, nW) {
    var s  = _computeScore(bucket, nW);
    var rk = getRank(s.total);
    return {
      username:    key,
      name:        displayName || key,
      team:        (bucket && bucket.team && bucket.team !== '--') ? bucket.team : (team || '--'),
      nWeeks:      nW,
      ucs:         bucket ? bucket.ucs : [],
      n_approved:  s.n_approved,
      avg_quality: s.avg_quality,
      n_weeks_hit: s.n_weeks_hit,
      s_quality:   s.s_quality,
      s_quantity:  s.s_quantity,
      s_weeks:     s.s_weeks,
      total:       s.total,
      rank_label:  rk.label,
      rank_color:  rk.color
    };
  }

  // ── Public: computeAllScores ───────────────────────────────────────

  /**
   * Build SPTD performance scores for all active users.
   * @param {Array} allList   — UC list from listUseCases API
   * @param {Array} usersList — User list from USERS sheet (may be empty)
   * @param {Array} [milestones] — Milestone đã duyệt (feed quantity + weeks-hit)
   * @returns {Array} sorted descending by total score
   */
  function computeAllScores(allList, usersList, milestones) {
    var t0mon = _getMonday(_getT0());
    var nW    = Math.max(_totalWeeks(t0mon), 1);
    var excl  = ((typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.SPTD_EXCLUDED_USERS : null) || []).map(_norm);
    var idx   = _buildBuckets(allList, t0mon, milestones);
    var bE    = idx.byEmail, bN = idx.byName;
    var res   = {}, claimed = {}, inactiveKeys = {};

    if (usersList && usersList.length) {
      // Primary: USERS sheet (includes users with 0 UCs)
      usersList.forEach(function (u) {
        if (u.active === false) {
          var ik  = _norm(u.username);     if (ik)  inactiveKeys[ik]  = true;
          var idk = _norm(u.display_name); if (idk) inactiveKeys[idk] = true;
          return;
        }
        var uKey  = _norm(u.username);
        var dnKey = _norm(u.display_name);
        if (!uKey || excl.indexOf(uKey) !== -1) return;
        claimed[uKey] = true;
        if (dnKey) claimed[dnKey] = true;

        var bA = bE[uKey] || null;
        var bB = (dnKey && dnKey !== uKey) ? (bE[dnKey] || null) : null;
        var b  = _mergeBuckets(bA, bB) || bN[uKey] || (dnKey ? bN[dnKey] : null) || null;
        res[uKey] = _makeEntry(uKey, u.display_name || u.username, u.team || '--', b, nW);
      });

      // Fallback: UC owners not in USERS sheet
      Object.keys(bE).forEach(function (eKey) {
        if (claimed[eKey] || excl.indexOf(eKey) !== -1 || inactiveKeys[eKey]) return;
        var b = bE[eKey];
        res[eKey] = _makeEntry(eKey, b.rawName || eKey, b.team, b, nW);
      });
    } else {
      // No USERS sheet: derive from allList only
      Object.keys(bE).forEach(function (key) {
        if (excl.indexOf(key) !== -1) return;
        var b = bE[key];
        res[key] = _makeEntry(key, b.rawName || key, b.team, b, nW);
      });
    }

    return Object.keys(res).map(function (k) { return res[k]; })
      .sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
  }

  // ── Public: computeUserDetails ─────────────────────────────────────

  /**
   * Get UC breakdown + weekly timeline for one user.
   * @param {string} username — normalized username (= session email)
   * @param {Array}  allList
   * @returns {{ ucs, weekTimeline, nWeeks }}
   */
  function computeUserDetails(username, allList, milestones) {
    var t0mon = _getMonday(_getT0());
    var nW    = Math.max(_totalWeeks(t0mon), 1);
    var uKey  = _norm(username);

    var myUCs = allList.filter(function (uc) {
      if (uc.status !== 'Approved') return false;
      return _norm(uc.owner_email) === uKey || _norm(uc.owner_name) === uKey;
    });

    var wkHit = {};
    myUCs.forEach(function (uc) {
      var ds = uc.submit_date || uc.submitted_at;
      if (!ds) return;
      var wi = _weekIdx(new Date(ds), t0mon);
      if (wi >= 0) wkHit[wi] = (wkHit[wi] || 0) + 1;
    });

    // Milestone đã duyệt của user → cũng đánh dấu tuần đạt trên timeline (v3.14.0)
    (milestones || []).forEach(function (m) {
      if (String(m.approval_status || 'Approved') !== 'Approved') return;
      if (_norm(m.owner_email) !== uKey && _norm(m.owner_name) !== uKey) return;
      var ds = m.log_date;
      if (!ds) return;
      var wi = _weekIdx(new Date(ds), t0mon);
      if (wi >= 0) wkHit[wi] = (wkHit[wi] || 0) + 1;
    });

    var timeline = [];
    for (var i = 0; i < nW; i++) {
      var wkStart = new Date(t0mon.getTime() + i * 7 * 24 * 3600 * 1000);
      var wkEnd   = new Date(wkStart.getTime() + 6 * 24 * 3600 * 1000);
      timeline.push({
        idx:       i,
        label:     'T' + (i + 1),
        dateRange: _fmtDate(wkStart) + '–' + _fmtDate(wkEnd),
        hit:       !!(wkHit[i]),
        ucCount:   wkHit[i] || 0
      });
    }

    return { ucs: myUCs, weekTimeline: timeline, nWeeks: nW };
  }

  // ── Export ─────────────────────────────────────────────────────────

  var _public = {
    computeAllScores:   computeAllScores,
    computeUserDetails: computeUserDetails,
    getRank:            getRank
  };
  if (typeof module !== 'undefined') module.exports = _public; // Node.js test compat
  return _public;
})();
