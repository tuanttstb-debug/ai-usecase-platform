// ─────────────────────────────────────────────────────────────────
// ScoringServiceH2.gs — H2 Giai đoạn 3: Mô hình chấm điểm mới
//
// Thay thế HOÀN TOÀN auto-score 70đ + SPTD 80-10-10 bằng 2 trục:
//   (1) Điểm US   — Hội đồng teamlead chấm mỗi UC, 3 tiêu chí 30/40/30 (0–10),
//                   điểm US cuối = BÌNH QUÂN Member_Score các thành viên đã chấm.
//   (2) Điểm cá nhân — Teamlead chấm mỗi thành viên team mình, 4 tiêu chí 30/20/30/20 (0–10),
//                   chấm 1 lần cuối kỳ (hạn 31/12/2026).
//
// Nguồn quyết định: AI_CONTEXT/H2_PLAN.md §4 + hub binh-dan-hoa-ai-H2 (kpi_roles.yaml).
// Sheets: UC_COUNCIL_SCORE, PERSONAL_SCORE (headers ở Config.gs).
//
// Auth:
//   - Điểm US: chỉ THÀNH VIÊN HỘI ĐỒNG (getCouncilUsernames_) hoặc admin.
//   - Điểm cá nhân: chỉ TEAMLEAD của đúng team member (isChampionForTeam_) hoặc admin.
//   Danh tính reviewer ưu tiên lấy từ token (validateToken_) → fallback reviewer_email.
//
// SETUP 1 LẦN (GAS Editor AI US project): chạy ensureScoringH2Sheets_() — hoặc để
//   route tự gọi (idempotent). Không cần seed dữ liệu.
// ─────────────────────────────────────────────────────────────────

/**
 * Đảm bảo 2 sheet điểm H2 tồn tại + đủ header. Idempotent. (nội bộ — route tự gọi)
 */
function ensureScoringH2Sheets_() {
  ensureSheetColumns_(SHEETS.UC_COUNCIL, UC_COUNCIL_HEADERS);
  ensureSheetColumns_(SHEETS.PERSONAL,   PERSONAL_HEADERS);
  ensureSheetColumns_(SHEETS.UC_REUSE,   UC_REUSE_HEADERS);
}

/**
 * SETUP 1 LẦN — CHẠY TAY trong GAS Editor tại LIVE.
 * Tạo 2 sheet mới (UC_COUNCIL_SCORE + PERSONAL_SCORE) với đầy đủ header. An toàn gọi
 * nhiều lần (idempotent — chỉ thêm cột còn thiếu, không đụng dữ liệu cũ).
 *
 * Cách chạy: mở GAS Editor project AI US → chọn hàm `setupScoringH2Sheets` → Run.
 * (Cũng có thể gọi qua URL: GAS_URL?action=... KHÔNG cần — route chấm điểm tự tạo sheet;
 *  hàm này chỉ để tạo sẵn/kiểm tra trước khi có lượt chấm đầu tiên.)
 *
 * @returns {{ uc_council_added:string[], personal_added:string[], council:string[], message:string }}
 */
function setupScoringH2Sheets() {
  var ucAdded = ensureSheetColumns_(SHEETS.UC_COUNCIL, UC_COUNCIL_HEADERS);
  var psAdded = ensureSheetColumns_(SHEETS.PERSONAL,   PERSONAL_HEADERS);
  var rzAdded = ensureSheetColumns_(SHEETS.UC_REUSE,   UC_REUSE_HEADERS);
  var council = getCouncilUsernames_();
  var msg = 'H2 Giai đoạn 3 — đã đảm bảo các sheet điểm:\n'
    + '  • ' + SHEETS.UC_COUNCIL + ': ' + (ucAdded.length ? 'tạo mới / thêm cột [' + ucAdded.join(', ') + ']' : 'đã đủ cột') + '\n'
    + '  • ' + SHEETS.PERSONAL   + ': ' + (psAdded.length ? 'tạo mới / thêm cột [' + psAdded.join(', ') + ']' : 'đã đủ cột') + '\n'
    + '  • ' + SHEETS.UC_REUSE   + ': ' + (rzAdded.length ? 'tạo mới / thêm cột [' + rzAdded.join(', ') + ']' : 'đã đủ cột') + '\n'
    + '  • Hội đồng chấm US (COUNCIL_USERS): ' + (council.length ? council.join(', ') : '(trống!)');
  Logger.log(msg);
  return { uc_council_added: ucAdded, personal_added: psAdded, uc_reuse_added: rzAdded, council: council, message: msg };
}

/**
 * Sinh Score_ID kế tiếp dạng <PREFIX>-NNNN dựa trên ID lớn nhất hiện có.
 */
function _nextScoreId_(rows, prefix) {
  var max = 0;
  var re  = new RegExp('^' + prefix + '-(\\d+)$');
  (rows || []).forEach(function (r) {
    var m = re.exec(String(r.Score_ID || '').trim());
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return prefix + '-' + String(max + 1).padStart(4, '0');
}

/**
 * Clamp giá trị tiêu chí về [0, H2_CRITERIA_MAX].
 */
function _clampCriteria_(v) {
  var n = safeNum_(v);
  if (n > H2_CRITERIA_MAX) n = H2_CRITERIA_MAX;
  if (n < 0) n = 0;
  return n;
}

/**
 * Chuẩn hóa nhãn kỳ tháng về 'Tháng MM/YYYY'. Nhận 'Tháng 9/2026' | '9/2026' | '2026-09' | ''.
 * Rỗng/không parse → '' (bản ghi không kỳ — tương thích dữ liệu cũ).
 */
function _normMonthLabel_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var m = /(\d{1,2})\s*\/\s*(\d{4})/.exec(s);        // MM/YYYY hoặc 'Tháng MM/YYYY'
  if (!m) { var iso = /(\d{4})-(\d{1,2})/.exec(s); if (iso) m = [null, iso[2], iso[1]]; } // YYYY-MM
  if (!m) return '';
  var mm = parseInt(m[1], 10), yy = parseInt(m[2], 10);
  if (mm < 1 || mm > 12) return '';
  return 'Tháng ' + (mm < 10 ? '0' + mm : '' + mm) + '/' + yy;
}

/**
 * Khóa sắp xếp kỳ tháng: 'Tháng MM/YYYY' → YYYY*100+MM. Rỗng/không parse → 0 (coi là cũ nhất).
 */
function _monthKey_(label) {
  var m = /(\d{1,2})\s*\/\s*(\d{4})/.exec(String(label || ''));
  return m ? (parseInt(m[2], 10) * 100 + parseInt(m[1], 10)) : 0;
}

/**
 * Gộp các dòng PERSONAL_SCORE của 1 member (đã lọc theo username) thành:
 *   { m2_avg, months_scored, latest, finals:[...] }
 * - m2_avg  = TRUNG BÌNH Final_Score các tháng đã chấm (mọi dòng = 1 tháng đã chấm).
 * - latest  = dòng tháng MỚI NHẤT (để đọc khóa học/lan tỏa/milestone/evidence — "nhập 1 lần").
 */
function _aggPersonalRows_(rows) {
  var finals = [], latest = null, latestKey = -1;
  (rows || []).forEach(function (r) {
    finals.push(safeNum_(r.Final_Score));
    var k = _monthKey_(r.Month);
    if (k >= latestKey) { latestKey = k; latest = r; }
  });
  var m2 = finals.length
    ? Math.round((finals.reduce(function (s, v) { return s + v; }, 0) / finals.length) * 10) / 10
    : 0;
  return { m2_avg: m2, months_scored: finals.length, latest: latest, finals: finals };
}

/**
 * Điểm thành viên hội đồng (0–100) từ 3 tiêu chí 0–10.
 */
function _councilMemberScore_(timeSaving, automation, creativity) {
  var raw = _clampCriteria_(timeSaving) * H2_UC_WEIGHTS.TIME_SAVING
          + _clampCriteria_(automation) * H2_UC_WEIGHTS.AUTOMATION
          + _clampCriteria_(creativity) * H2_UC_WEIGHTS.CREATIVITY;
  return Math.round((raw / H2_CRITERIA_MAX) * 100 * 10) / 10; // 1 chữ số thập phân
}

/**
 * Điểm cá nhân (0–100) từ 4 tiêu chí 0–10.
 */
function _personalFinalScore_(diversity, aiProf, productQuality, quantityMet) {
  var raw = _clampCriteria_(diversity)       * H2_PERSONAL_WEIGHTS.DIVERSITY
          + _clampCriteria_(aiProf)          * H2_PERSONAL_WEIGHTS.AI_PROFICIENCY
          + _clampCriteria_(productQuality)  * H2_PERSONAL_WEIGHTS.PRODUCT_QUALITY
          + _clampCriteria_(quantityMet)     * H2_PERSONAL_WEIGHTS.QUANTITY_MET;
  return Math.round((raw / H2_CRITERIA_MAX) * 100 * 10) / 10;
}

/**
 * Rank theo thang 100 (dùng chung SCORE_THRESHOLDS + RANK).
 */
function _rankForScore_(score) {
  var s = safeNum_(score);
  if (s >= SCORE_THRESHOLDS.TOP)     return RANK.TOP;
  if (s >= SCORE_THRESHOLDS.STRONG)  return RANK.STRONG;
  if (s >= SCORE_THRESHOLDS.AVERAGE) return RANK.AVERAGE;
  return RANK.BOTTOM;
}

/**
 * Xác định danh tính reviewer: ưu tiên token hợp lệ → fallback reviewer_email/username.
 * @returns {{ username, displayName, role, team, viaToken }}
 */
function _resolveReviewer_(body) {
  var tok = validateToken_(body.token || '');
  if (tok && tok.u) {
    return {
      username:    normalizeUser_(tok.u),
      displayName: String(tok.dn || tok.u),
      role:        _normRole_(tok.r),
      team:        String(tok.t || ''),
      viaToken:    true
    };
  }
  var uname = normalizeUser_(body.reviewer_email || body.username || body.reviewer || '');
  return { username: uname, displayName: uname, role: '', team: '', viaToken: false };
}

/**
 * True nếu username là thành viên hội đồng chấm US.
 */
function isCouncilMember_(username) {
  var u = normalizeUser_(username);
  if (!u) return false;
  return getCouncilUsernames_().indexOf(u) !== -1;
}

/**
 * Parse boolean chặt: rỗng/false/0/no → false (khác _isActive_ của workflow coi rỗng=true).
 */
function _isTrue_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'x' || s === 'có';
}

// ══════════════════════════════════════════════════════════════════
// (1) ĐIỂM US — HỘI ĐỒNG CHẤM
// ══════════════════════════════════════════════════════════════════

/**
 * Ghi/cập nhật điểm 1 thành viên hội đồng cho 1 UC (upsert theo Record_ID × Reviewer).
 * body: { Record_ID, token? , reviewer_email?, Time_Saving, Automation, Creativity, Comment? }
 * Auth: reviewer phải là thành viên hội đồng HOẶC admin.
 * @returns {{ score_id, member_score, uc_final, scored_count, council_size }}
 */
function submitCouncilScore_(body) {
  ensureScoringH2Sheets_();
  var recordId = String(body.Record_ID || body.record_id || '').trim();
  if (!recordId) throw new Error('Thiếu Record_ID');

  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người chấm (token hoặc reviewer_email).');
  if (!isCouncilMember_(rv.username) && !isAdminEmail_(rv.username)) {
    throw new Error('Chỉ thành viên hội đồng mới được chấm điểm US: ' + rv.username);
  }

  var uc = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!uc) throw new Error('Không tìm thấy use case: ' + recordId);

  var ts = _clampCriteria_(body.Time_Saving);
  var au = _clampCriteria_(body.Automation);
  var cr = _clampCriteria_(body.Creativity);
  var member = _councilMemberScore_(ts, au, cr);
  var comment = sanitizeStr_(body.Comment || body.comment || '', 500);
  var now = new Date().toISOString();

  var scoreId = '';
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    // Upsert theo (Record_ID, Reviewer): tìm dòng cũ của reviewer này cho UC này.
    var all = readSheetAsObjects_(SHEETS.UC_COUNCIL);
    var existingId = '';
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].Record_ID).trim() === recordId
          && normalizeUser_(all[i].Reviewer) === rv.username) {
        existingId = String(all[i].Score_ID).trim();
        break;
      }
    }
    scoreId = existingId || _nextScoreId_(all, 'CS');

    var rowObj = {
      Score_ID:     scoreId,
      Record_ID:    recordId,
      UseCase_ID:   String(uc.UseCase_ID || ''),
      Reviewer:     rv.username,
      Time_Saving:  ts,
      Automation:   au,
      Creativity:   cr,
      Member_Score: member,
      Comment:      comment,
      Scored_At:    now
    };

    if (existingId) {
      updateRowByField_(SHEETS.UC_COUNCIL, 'Score_ID', existingId, rowObj);
    } else {
      appendRowFromObject_(SHEETS.UC_COUNCIL, rowObj);
    }
  } finally {
    lock.releaseLock();
  }

  // Tính lại điểm US cuối = bình quân → ghi lên MASTER.
  var fin = computeUcFinalScore_(recordId);

  logActivity_(uc.UseCase_ID, recordId, 'COUNCIL_SCORE',
    'Hội đồng ' + rv.username + ' chấm: TS=' + ts + ' AU=' + au + ' CR=' + cr +
    ' → member=' + member + '; UC final=' + fin.final + ' (' + fin.scored_count + '/' + fin.council_size + ')',
    rv.username, null, null);

  return {
    score_id:     scoreId,
    member_score: member,
    uc_final:     fin.final,
    scored_count: fin.scored_count,
    council_size: fin.council_size
  };
}

/**
 * Tính điểm US cuối = bình quân Member_Score các thành viên đã chấm, ghi lên MASTER.
 * Ghi Total_Score + Committee_Review_Score + Rank_Category + Score_Updated_At (giữ tương thích
 * leaderboard/KPI đang đọc Total_Score). Nếu chưa ai chấm → final = 0, không đổi rank.
 * @returns {{ record_id, final, scored_count, council_size, reviewers:string[] }}
 */
function computeUcFinalScore_(recordId) {
  ensureScoringH2Sheets_();
  var rows = readSheetAsObjects_(SHEETS.UC_COUNCIL).filter(function (r) {
    return String(r.Record_ID).trim() === String(recordId).trim();
  });

  var reviewers = [];
  var sum = 0, cnt = 0;
  rows.forEach(function (r) {
    reviewers.push(normalizeUser_(r.Reviewer));
    sum += safeNum_(r.Member_Score);
    cnt++;
  });
  var final = cnt > 0 ? Math.round((sum / cnt) * 10) / 10 : 0;

  if (cnt > 0) {
    var updates = {
      Record_ID:              recordId,
      Total_Score:            final,
      Committee_Review_Score: final,
      Rank_Category:          _rankForScore_(final),
      Review_Status:          REVIEW_STATUS.COMMITTEE,
      Score_Updated_At:       new Date().toISOString()
    };
    try {
      updateRowByRecordId_(SHEETS.MASTER, recordId, updates);
    } catch (e) {
      logError_('computeUcFinalScore_ write MASTER', e, { recordId: recordId });
    }
  }

  return {
    record_id:    recordId,
    final:        final,
    scored_count: cnt,
    council_size: getCouncilUsernames_().length,
    reviewers:    reviewers
  };
}

/**
 * Danh sách điểm hội đồng của 1 UC + ai đã/chưa chấm + điểm cuối.
 * @returns {{ record_id, final, scored_count, council_size, scores:Array, pending:string[] }}
 */
function listCouncilScores_(recordId) {
  ensureScoringH2Sheets_();
  var rid = String(recordId || '').trim();
  if (!rid) throw new Error('Thiếu record_id');

  var rows = readSheetAsObjects_(SHEETS.UC_COUNCIL)
    .filter(function (r) { return String(r.Record_ID).trim() === rid; })
    .map(function (r) {
      return {
        score_id:     String(r.Score_ID || ''),
        reviewer:     normalizeUser_(r.Reviewer),
        time_saving:  safeNum_(r.Time_Saving),
        automation:   safeNum_(r.Automation),
        creativity:   safeNum_(r.Creativity),
        member_score: safeNum_(r.Member_Score),
        comment:      String(r.Comment || ''),
        scored_at:    String(r.Scored_At || '')
      };
    });

  var scoredSet = {};
  var sum = 0;
  rows.forEach(function (r) { scoredSet[r.reviewer] = true; sum += r.member_score; });
  var final = rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0;

  var pending = getCouncilUsernames_().filter(function (u) { return !scoredSet[u]; });

  return {
    record_id:    rid,
    final:        final,
    rank_category:_rankForScore_(final),
    scored_count: rows.length,
    council_size: getCouncilUsernames_().length,
    scores:       rows,
    pending:      pending
  };
}

// ══════════════════════════════════════════════════════════════════
// (2) ĐIỂM CÁ NHÂN — TEAMLEAD CHẤM
// ══════════════════════════════════════════════════════════════════

/**
 * Ghi/cập nhật điểm cá nhân 1 thành viên (upsert theo Username).
 * body: { Username, token?/reviewer_email?, Team?, Diversity, AI_Proficiency,
 *         Product_Quality, Quantity_Met, Comment? }
 * Auth: reviewer là TEAMLEAD của đúng team member (isChampionForTeam_) hoặc admin.
 * @returns {{ score_id, username, final_score }}
 */
function submitPersonalScore_(body) {
  ensureScoringH2Sheets_();
  var memberUser = normalizeUser_(body.Username || body.username || '');
  if (!memberUser) throw new Error('Thiếu Username của thành viên được chấm');

  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người chấm (token hoặc reviewer_email).');

  // Team của member: ưu tiên body.Team → tra User_Master.
  var memberTeam = String(body.Team || body.team || '').trim();
  var memberDisplay = String(body.Display_Name || body.display_name || '').trim();
  if (!memberTeam || !memberDisplay) {
    var users = getAllUsersFromMaster_();
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === memberUser) {
        if (!memberTeam)    memberTeam    = users[i].team || '';
        if (!memberDisplay) memberDisplay = users[i].display_name || memberUser;
        break;
      }
    }
  }
  if (!memberDisplay) memberDisplay = memberUser;

  // Auth: admin OR teamlead của đúng team member.
  if (!isAdminEmail_(rv.username) && !isChampionForTeam_(rv.username, memberTeam)) {
    throw new Error('Chỉ teamlead của team "' + memberTeam + '" (hoặc admin) mới được chấm điểm cá nhân.');
  }

  var d  = _clampCriteria_(body.Diversity);
  var ai = _clampCriteria_(body.AI_Proficiency);
  var pq = _clampCriteria_(body.Product_Quality);
  var qm = _clampCriteria_(body.Quantity_Met);
  var final = _personalFinalScore_(d, ai, pq, qm);
  var comment = sanitizeStr_(body.Comment || body.comment || '', 500);
  var now = new Date().toISOString();

  // Kỳ tháng (CR#1): nhãn 'Tháng MM/YYYY' — điểm năng lực M2 chấm theo tháng.
  var month = _normMonthLabel_(body.Month || body.month || '');

  // M-KPI-3 (khóa học) + M-KPI-4 (lan tỏa) + điểm trừ (milestone chậm) — teamlead nhập cùng (KHÔNG theo tháng).
  var coursesCompleted = Math.max(0, Math.round(safeNum_(body.Courses_Completed)));
  var coursesPaid      = Math.max(0, Math.round(safeNum_(body.Courses_Paid)));
  if (coursesPaid > coursesCompleted) coursesPaid = coursesCompleted; // trả phí ⊆ đã hoàn thành
  var sharingAchieved  = _isTrue_(body.Sharing_Achieved);
  var milestonesLate   = Math.max(0, Math.round(safeNum_(body.Milestones_Late)));

  var scoreId = '';
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    var all = readSheetAsObjects_(SHEETS.PERSONAL);
    // Upsert theo (Username, Month): mỗi member 1 dòng / tháng.
    var existingId = '', existingEvd = '';
    for (var j = 0; j < all.length; j++) {
      if (normalizeUser_(all[j].Username) === memberUser
          && _normMonthLabel_(all[j].Month) === month) {
        existingId  = String(all[j].Score_ID).trim();
        existingEvd = String(all[j].Evidence_Link || '');
        break;
      }
    }
    scoreId = existingId || _nextScoreId_(all, 'PS');

    // Evidence_Link (CR#4): không nhập ở panel chấm → GIỮ giá trị cũ; chỉ đổi nếu body gửi tường minh.
    var evidenceLink = (body.Evidence_Link !== undefined && body.Evidence_Link !== null)
      ? sanitizeStr_(body.Evidence_Link, 500) : existingEvd;

    var rowObj = {
      Score_ID:          scoreId,
      Username:          memberUser,
      Display_Name:      memberDisplay,
      Team:              memberTeam,
      Month:             month,
      Diversity:         d,
      AI_Proficiency:    ai,
      Product_Quality:   pq,
      Quantity_Met:      qm,
      Final_Score:       final,
      Courses_Completed: coursesCompleted,
      Courses_Paid:      coursesPaid,
      Sharing_Achieved:  sharingAchieved,
      Milestones_Late:   milestonesLate,
      Evidence_Link:     evidenceLink,
      Scored_By:         rv.username,
      Comment:           comment,
      Scored_At:         now
    };

    if (existingId) {
      updateRowByField_(SHEETS.PERSONAL, 'Score_ID', existingId, rowObj);
    } else {
      appendRowFromObject_(SHEETS.PERSONAL, rowObj);
    }
  } finally {
    lock.releaseLock();
  }

  logActivity_('', '', 'PERSONAL_SCORE',
    'Teamlead ' + rv.username + ' chấm cá nhân ' + memberUser + ' (' + memberTeam + ') ' + (month || '(không kỳ)') + ': ' +
    'DV=' + d + ' AI=' + ai + ' PQ=' + pq + ' QT=' + qm + ' → M2 tháng=' + final +
    ' | khóa=' + coursesCompleted + '(trả phí ' + coursesPaid + ') lan tỏa=' + sharingAchieved +
    ' milestone chậm=' + milestonesLate,
    rv.username, null, null);

  return { score_id: scoreId, username: memberUser, month: month, final_score: final };
}

/**
 * Danh sách điểm cá nhân (lọc theo team nếu có). Trả kèm rank theo thang 100.
 * @param {string} team  Rỗng = tất cả.
 * @returns {{ team, count, scores:Array }}
 */
function listPersonalScores_(team) {
  ensureScoringH2Sheets_();
  var t = String(team || '').trim().toLowerCase();

  // Gom tất cả dòng theo username (mỗi member nhiều dòng = nhiều tháng).
  var byUser = {};   // username → { user, display, team, rows:[] }
  readSheetAsObjects_(SHEETS.PERSONAL).forEach(function (r) {
    var u = normalizeUser_(r.Username);
    if (!u) return;
    if (t && String(r.Team || '').trim().toLowerCase() !== t) return;
    if (!byUser[u]) byUser[u] = { user: u, display: String(r.Display_Name || ''), team: String(r.Team || ''), rows: [] };
    byUser[u].rows.push(r);
    if (!byUser[u].display && r.Display_Name) byUser[u].display = String(r.Display_Name);
  });

  var scores = Object.keys(byUser).map(function (u) {
    var g = byUser[u];
    var agg = _aggPersonalRows_(g.rows);
    var latest = agg.latest || {};
    // Chi tiết từng tháng (sort tăng dần theo kỳ) — cho panel prefill theo tháng.
    var months = g.rows.map(function (r) {
      return {
        month:           _normMonthLabel_(r.Month),
        diversity:       safeNum_(r.Diversity),
        ai_proficiency:  safeNum_(r.AI_Proficiency),
        product_quality: safeNum_(r.Product_Quality),
        quantity_met:    safeNum_(r.Quantity_Met),
        final_score:     safeNum_(r.Final_Score),
        comment:         String(r.Comment || ''),
        scored_by:       normalizeUser_(r.Scored_By),
        scored_at:       String(r.Scored_At || '')
      };
    }).sort(function (a, b) { return _monthKey_(a.month) - _monthKey_(b.month); });

    return {
      username:        u,
      display_name:    g.display || u,
      team:            g.team,
      final_score:     agg.m2_avg,          // M-KPI-2 cuối kỳ = TB các tháng đã chấm
      rank_category:   _rankForScore_(agg.m2_avg),
      months_scored:   agg.months_scored,
      months:          months,
      // "nhập 1 lần" (lấy tháng mới nhất):
      courses_completed: Math.round(safeNum_(latest.Courses_Completed)),
      courses_paid:      Math.round(safeNum_(latest.Courses_Paid)),
      sharing_achieved:  _isTrue_(latest.Sharing_Achieved),
      milestones_late:   Math.round(safeNum_(latest.Milestones_Late)),
      evidence_link:     String(latest.Evidence_Link || ''),
      scored_by:         normalizeUser_(latest.Scored_By),
      comment:           String(latest.Comment || ''),
      scored_at:         String(latest.Scored_At || '')
    };
  });

  scores.sort(function (a, b) { return b.final_score - a.final_score; });
  return { team: team || 'all', count: scores.length, scores: scores };
}

/**
 * Tiến độ chấm hội đồng của TẤT CẢ UC (1 lần đọc sheet) — phục vụ hàng đợi review.
 * @returns {{ map: Object<string,{count,final,reviewers:string[]}>, council_size:number }}
 */
function getCouncilProgress_() {
  ensureScoringH2Sheets_();
  var agg = {}; // record_id → { count, sum, reviewers[] }
  readSheetAsObjects_(SHEETS.UC_COUNCIL).forEach(function (r) {
    var rid = String(r.Record_ID || '').trim();
    if (!rid) return;
    if (!agg[rid]) agg[rid] = { count: 0, sum: 0, reviewers: [] };
    agg[rid].count++;
    agg[rid].sum += safeNum_(r.Member_Score);
    agg[rid].reviewers.push(normalizeUser_(r.Reviewer));
  });
  var map = {};
  Object.keys(agg).forEach(function (rid) {
    var a = agg[rid];
    map[rid] = {
      count:     a.count,
      final:     a.count ? Math.round((a.sum / a.count) * 10) / 10 : 0,
      reviewers: a.reviewers
    };
  });
  return { map: map, council_size: getCouncilUsernames_().length };
}

// ══════════════════════════════════════════════════════════════════
// XÁC NHẬN TÁI DÙNG UC (T05/M05) → điều kiện (ii) lan tỏa M-KPI-4
// ══════════════════════════════════════════════════════════════════

/**
 * Người dùng xác nhận đã tái dùng 1 UC (upsert theo Record_ID × Reused_By).
 * KHÔNG cho tự xác nhận UC của chính mình. body: { Record_ID, token?/reviewer_email?, Comment? }
 * @returns {{ record_id, reuse_count, reused }}
 */
function submitReuseConfirm_(body) {
  ensureScoringH2Sheets_();
  var recordId = String(body.Record_ID || body.record_id || '').trim();
  if (!recordId) throw new Error('Thiếu Record_ID');

  var rv = _resolveReviewer_(body);
  if (!rv.username) throw new Error('Thiếu thông tin người tái dùng (token hoặc reviewer_email).');

  var uc = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!uc) throw new Error('Không tìm thấy use case: ' + recordId);
  var ownerU = normalizeUser_(uc.Owner_Email);
  if (ownerU && ownerU === rv.username) throw new Error('Không thể tự xác nhận tái dùng UC của chính mình.');

  var comment = sanitizeStr_(body.Comment || body.comment || '', 300);
  var now = new Date().toISOString();

  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    var all = readSheetAsObjects_(SHEETS.UC_REUSE);
    var existingId = '';
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].Record_ID).trim() === recordId && normalizeUser_(all[i].Reused_By) === rv.username) {
        existingId = String(all[i].Reuse_ID).trim(); break;
      }
    }
    var rowObj = {
      Reuse_ID:       existingId || _nextScoreId_(all, 'RZ'),
      Record_ID:      recordId,
      UseCase_ID:     String(uc.UseCase_ID || ''),
      Owner_Username: ownerU,
      Reused_By:      rv.username,
      Comment:        comment,
      Confirmed_At:   now
    };
    if (existingId) updateRowByField_(SHEETS.UC_REUSE, 'Reuse_ID', existingId, rowObj);
    else            appendRowFromObject_(SHEETS.UC_REUSE, rowObj);
  } finally {
    lock.releaseLock();
  }

  var counts = getReuseCounts_();
  var c = (counts.map[recordId] && counts.map[recordId].count) || 0;
  logActivity_(uc.UseCase_ID, recordId, 'REUSE_CONFIRM',
    rv.username + ' xác nhận tái dùng → ' + c + ' người', rv.username, null, null);
  return { record_id: recordId, reuse_count: c, reused: true };
}

/**
 * Đếm số NGƯỜI KHÁC tái dùng mỗi UC (distinct Reused_By, không tính chủ).
 * @returns {{ map: Object<string,{count,reusers:string[]}>, threshold:number }}
 */
function getReuseCounts_() {
  ensureScoringH2Sheets_();
  var agg = {};
  readSheetAsObjects_(SHEETS.UC_REUSE).forEach(function (r) {
    var rid = String(r.Record_ID || '').trim();
    var by  = normalizeUser_(r.Reused_By);
    var owner = normalizeUser_(r.Owner_Username);
    if (!rid || !by || by === owner) return;
    if (!agg[rid]) agg[rid] = {};
    agg[rid][by] = true;
  });
  var map = {};
  Object.keys(agg).forEach(function (rid) {
    var reusers = Object.keys(agg[rid]);
    map[rid] = { count: reusers.length, reusers: reusers };
  });
  return { map: map, threshold: H2_REUSE_THRESHOLD };
}

/**
 * Map owner_username → số người tái dùng cao nhất trong các UC của họ (cho M-KPI-4).
 */
function _reuseByOwner_() {
  var byOwner = {};
  readSheetAsObjects_(SHEETS.UC_REUSE).forEach(function (r) {
    var owner = normalizeUser_(r.Owner_Username);
    var rid   = String(r.Record_ID || '').trim();
    var by    = normalizeUser_(r.Reused_By);
    if (!owner || !rid || !by || by === owner) return;
    byOwner[owner] = byOwner[owner] || {};
    byOwner[owner][rid] = byOwner[owner][rid] || {};
    byOwner[owner][rid][by] = true;
  });
  var maxByOwner = {};
  Object.keys(byOwner).forEach(function (owner) {
    var max = 0;
    Object.keys(byOwner[owner]).forEach(function (rid) {
      var n = Object.keys(byOwner[owner][rid]).length;
      if (n > max) max = n;
    });
    maxByOwner[owner] = max;
  });
  return maxByOwner;
}

// ══════════════════════════════════════════════════════════════════
// LEADERBOARD H2 — gộp Điểm US (bình quân hội đồng) + Điểm cá nhân
// Dùng cho FE leaderboard rebuild (Đợt 1). Đọc-only.
// ══════════════════════════════════════════════════════════════════

/**
 * Bảng xếp hạng H2: (a) UC theo điểm hội đồng (đọc từ MASTER Total_Score, chỉ UC đã có
 * ≥1 lượt chấm), (b) cá nhân theo điểm teamlead.
 * @param {string} team  Lọc theo team (rỗng = tất cả).
 * @param {number} limit
 */
function getH2Leaderboard_(team, limit) {
  ensureScoringH2Sheets_();
  limit = limit || 50;
  var teamL = String(team || '').trim().toLowerCase();

  // (a) UC ranking — chỉ lấy UC đã có ít nhất 1 lượt chấm hội đồng (Committee_Review_Score>0).
  var scoredMap = {}; // record_id → { count }
  readSheetAsObjects_(SHEETS.UC_COUNCIL).forEach(function (r) {
    var rid = String(r.Record_ID || '').trim();
    if (!rid) return;
    scoredMap[rid] = scoredMap[rid] || { count: 0 };
    scoredMap[rid].count++;
  });

  var ucRows = readSheetAsObjects_(SHEETS.MASTER)
    .filter(function (uc) {
      var rid = String(uc.Record_ID || '').trim();
      if (!scoredMap[rid]) return false;
      if (teamL && String(uc.Team || '').trim().toLowerCase() !== teamL) return false;
      return true;
    })
    .map(function (uc) {
      var rid = String(uc.Record_ID || '').trim();
      var score = safeNum_(uc.Committee_Review_Score) || safeNum_(uc.Total_Score);
      return {
        record_id:     rid,
        usecase_id:    String(uc.UseCase_ID || ''),
        name:          String(uc.UseCase_Name || ''),
        team:          String(uc.Team || ''),
        owner_name:    String(uc.Owner_Name || ''),
        workflow:      String(uc.Workflow || ''),
        uc_score:      Math.round(score * 10) / 10,
        rank_category: _rankForScore_(score),
        scored_count:  scoredMap[rid].count,
        council_size:  getCouncilUsernames_().length
      };
    });
  ucRows.sort(function (a, b) { return b.uc_score - a.uc_score; });
  ucRows = ucRows.slice(0, limit).map(function (r, i) { r.rank = i + 1; return r; });

  // (b) Personal ranking.
  var personal = listPersonalScores_(team).scores.slice(0, limit)
    .map(function (r, i) { r.rank = i + 1; return r; });

  return {
    uc_ranking:       ucRows,
    personal_ranking: personal,
    council_size:     getCouncilUsernames_().length,
    filter_team:      team || 'all'
  };
}

// ══════════════════════════════════════════════════════════════════
// KPI TỔNG HỢP — khung D70 (2026-10-09). Công thức THUẦN ở KpiEngineH2.gs; phần này chỉ ĐỌC sheet.
//   Member  : M1 việc lớn · M2 bài tập Đạt theo tuần · M3 khóa hoàn thành + chứng chỉ · M4 lan tỏa − trừ
//   Teamlead: T1·40 + T2·30 (mẫu số toàn team) + T3·20 (việc lớn OKR) + T4·10 (R&D)
// Bảng KPI cá nhân nhận MỌI role active (admin + lãnh đạo, D54).
// ══════════════════════════════════════════════════════════════════

// M-KPI-3 (cũ — chỉ còn dùng để hiển thị bản tự chấm lịch sử ở SelfScoreService): 25%/khóa, trả phí ×2, trần 100.
function _courseScore_(completed, paid) {
  var c = Math.max(0, Math.round(safeNum_(completed)));
  var p = Math.max(0, Math.round(safeNum_(paid)));
  if (p > c) p = c;
  return Math.min(100, (c + p) * H2_COURSE_PCT_EACH);
}

// Đọc 1 tab; tab chưa tạo → [] (không đẻ sheet khi chỉ đọc).
function _kpiRead_(sheetName) {
  try { return readSheetAsObjects_(sheetName) || []; } catch (e) { return []; }
}

/**
 * Đọc 1 lần mọi nguồn cần cho engine. Ngày (Due/Accepted/Submitted) chuẩn hóa về 'yyyy-MM-dd' theo múi giờ
 * bảng tính (_learnYmd_ — ô Date do Sheets tự đổi), để engine thuần so chuỗi.
 */
function _kpiLoadInput_() {
  var ymd = function (v) { return (typeof _learnYmd_ === 'function') ? _learnYmd_(v) : String(v || ''); };
  var assigns = _kpiRead_(SHEETS.BIG_TASK_ASSIGN).map(function (a) {
    var o = {}; for (var k in a) if (a.hasOwnProperty(k)) o[k] = a[k];
    o.Due_Date = ymd(a.Due_Date); o.Accepted_Date = ymd(a.Accepted_Date);
    return o;
  });
  var rdRows = _kpiRead_(SHEETS.RD_REPORT).map(function (r) {
    return { Period: r.Period, Username: r.Username, Due_Date: ymd(r.Due_Date), Submitted_Date: ymd(r.Submitted_Date) };
  });
  return {
    users:        getAllUsersFromMaster_(),
    exercises:    _kpiRead_(SHEETS.AI_EXERCISE),
    courses:      _kpiRead_(SHEETS.LEARN_COURSE),
    claims:       _kpiRead_(SHEETS.SHARING_CLAIM),
    reuseByOwner: (function () { try { return _reuseByOwner_(); } catch (e) { return {}; } })(),
    personalRows: _kpiRead_(SHEETS.PERSONAL),
    bigTasks:     _kpiRead_(SHEETS.BIG_TASK),
    krs:          _kpiRead_(SHEETS.BIG_TASK_KR),
    assigns:      assigns,
    rdRows:       rdRows
  };
}

/**
 * KPI leaderboard: member_ranking (mọi role active) + teamlead_ranking (40/30/20/10) + center_avg (TB member).
 * @param {string} team  Lọc theo team (rỗng = tất cả). center_avg luôn tính toàn Trung tâm.
 */
function getKpiLeaderboard_(team) {
  var teamL = String(team || '').trim().toLowerCase();
  var res = _kpiComputeAll_(_kpiLoadInput_());

  var memberRanking = res.members
    .filter(function (m) { return !teamL || m.team.toLowerCase() === teamL; })
    .sort(function (a, b) { return b.final - a.final || String(a.display_name).localeCompare(String(b.display_name)); })
    .map(function (m, i) {
      m.rank = i + 1; m.rank_category = _rankForScore_(m.final); m.has_data = true;
      return m;
    });

  var teamleadRanking = res.teamleads
    .filter(function (t) { return !teamL || t.team.toLowerCase() === teamL; })
    .sort(function (a, b) { return b.final - a.final; })
    .map(function (t, i) { t.rank = i + 1; t.rank_category = _rankForScore_(t.final); return t; });

  return {
    member_ranking:   memberRanking,
    teamlead_ranking: teamleadRanking,
    center_avg:       res.center_avg,
    kpi_pass:         H2_KPI_PASS,
    kpi_cap:          H2_KPI_CAP,
    framework:        'D70',
    weights: {
      member:   H2_KPI_WEIGHTS,
      teamlead: H2_TEAMLEAD_WEIGHTS
    },
    council_size:     getCouncilUsernames_().length,
    filter_team:      team || 'all'
  };
}

/**
 * Xem trước KPI 1 người (màn "Tự chấm KPI của tôi" + panel Chấm điểm cá nhân) — kèm detail từng chỉ tiêu.
 * @param {string} username
 */
function getMemberKpiPreview_(username) {
  var uname = normalizeUser_(username || '');
  if (!uname) throw new Error('Thiếu username');
  var input = _kpiLoadInput_();
  var found = input.users.filter(function (u) { return normalizeUser_(u.username) === uname; })[0];
  if (!found) input.users.push({ username: uname, display_name: uname, team: '', role: 'user', active: true });
  else if (found.active === false) found.active = true;          // xem trước vẫn tính dù user tạm khóa
  var res = _kpiComputeAll_(input);
  var me = res.members.filter(function (m) { return m.username === uname; })[0];
  me.rank_category = _rankForScore_(me.final);
  me.has_data = true;
  me.kpi_cap = H2_KPI_CAP;
  me.kpi_pass = H2_KPI_PASS;
  var tl = res.teamleads.filter(function (t) { return t.username === uname; })[0];
  if (tl) me.teamlead = tl;
  return me;
}

/**
 * SETUP 1 LẦN (tùy chọn) — chạy tay trong GAS Editor sau khi redeploy: tạo 3 tab mới + thêm cột mới cho
 * AI_EXERCISE. Idempotent, chỉ THÊM cột/tab thiếu, không đụng dữ liệu cũ. (Route ghi cũng tự gọi khi cần.)
 */
function setupKpiD70Sheets() {
  var out = {
    ai_exercise:  ensureSheetColumns_(SHEETS.AI_EXERCISE, AI_EXERCISE_HEADERS),
    viec_lon_so:  ensureSheetColumns_(SHEETS.BIG_TASK_KR, BIG_TASK_KR_HEADERS),
    phan_cong:    ensureSheetColumns_(SHEETS.BIG_TASK_ASSIGN, BIG_TASK_ASSIGN_HEADERS),
    rd_bao_cao:   ensureSheetColumns_(SHEETS.RD_REPORT, RD_REPORT_HEADERS)
  };
  Logger.log('setupKpiD70Sheets — cột/tab vừa thêm: ' + JSON.stringify(out));
  return out;
}
