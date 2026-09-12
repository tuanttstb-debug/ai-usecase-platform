// ─────────────────────────────────────────────────────────────────
// ExerciseService.gs — CR (2026-09-12): "Bài tập AI"
//
// Chia sẻ các thao tác AI nhỏ (chưa đủ thành Use Case): mô tả ngắn + prompt +
// link demo (ổ chung). Có trang tra cứu như thư viện. KHÔNG tính điểm/KPI.
// Sheet: AI_EXERCISE. Demo = link ổ chung (KHÔNG upload file → data-boundary an toàn).
//
// Routes (Code.gs): exercise-list · exercise-create · exercise-update · exercise-delete
// Auth: theo mô hình nhẹ như weekly-update (client gửi requester_email + is_admin);
//   sửa/xóa chỉ chủ bài (email khớp Owner_Email) HOẶC admin. Xóa = mềm (Active=FALSE).
// ─────────────────────────────────────────────────────────────────

// Sinh Exercise_ID dạng EX-000N (đọc max hiện có +1). Volume thấp → không cần lock.
function _nextExerciseId_() {
  var all;
  try { all = readSheetAsObjects_(SHEETS.AI_EXERCISE); } catch (e) { all = []; }
  var max = 0;
  (all || []).forEach(function (r) {
    var m = /^EX-(\d+)$/.exec(String(r.Exercise_ID || '').trim());
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  var next = max + 1;
  return 'EX-' + (next < 1000 ? ('000' + next).slice(-4) : String(next));
}

function createExercise_(data) {
  data = data || {};
  var title  = sanitizeStr_(data.Title  || '', 200);
  var prompt = sanitizeStr_(data.Prompt || '', 8000);
  if (!title)  throw new Error('Thiếu Tiêu đề bài tập');
  if (!prompt) throw new Error('Thiếu Prompt');

  ensureSheetColumns_(SHEETS.AI_EXERCISE, AI_EXERCISE_HEADERS);
  var now = new Date().toISOString();
  var id  = _nextExerciseId_();
  var row = {
    Exercise_ID: id,
    Title:       title,
    Description: sanitizeStr_(data.Description || '', 2000),
    Prompt:      prompt,
    Demo_Link:   sanitizeStr_(data.Demo_Link || '', 1000),
    Owner_Name:  sanitizeStr_(data.Owner_Name  || '', 200),
    Owner_Email: sanitizeStr_(data.Owner_Email || '', 200),
    Team:        sanitizeStr_(data.Team || '', 120),
    Created_At:  now,
    Updated_At:  now,
    Active:      'TRUE'
  };
  appendRowFromObject_(SHEETS.AI_EXERCISE, row);
  return { exercise_id: id };
}

function listExercises_() {
  var all;
  try { all = readSheetAsObjects_(SHEETS.AI_EXERCISE); } catch (e) { return []; }
  if (!all || !all.length) return [];
  var out = all.filter(function (r) { return String(r.Active) !== 'FALSE'; });
  out.sort(function (a, b) { return new Date(b.Created_At || 0) - new Date(a.Created_At || 0); });
  return out.map(function (r) {
    return {
      exercise_id: r.Exercise_ID || '',
      title:       r.Title       || '',
      description: r.Description  || '',
      prompt:      r.Prompt       || '',
      demo_link:   r.Demo_Link    || '',
      owner_name:  r.Owner_Name   || '',
      owner_email: r.Owner_Email  || '',
      team:        r.Team         || '',
      created_at:  r.Created_At   || ''
    };
  });
}

// Kiểm quyền: chủ bài (email khớp) hoặc admin.
function _canManageExercise_(existing, data) {
  var reqEmail = normalizeUser_(data.requester_email || data.Owner_Email || '');
  var isAdmin  = (String(data.is_admin) === 'true' || data.is_admin === true);
  var ownerEmail = normalizeUser_(existing.Owner_Email || '');
  return isAdmin || (!!reqEmail && reqEmail === ownerEmail);
}

function updateExercise_(data) {
  data = data || {};
  var id = sanitizeStr_(data.Exercise_ID || '');
  if (!id) throw new Error('Thiếu Exercise_ID');
  var existing = findObjectByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id);
  if (!existing) throw new Error('Không tìm thấy bài tập: ' + id);
  if (!_canManageExercise_(existing, data)) throw new Error('Bạn không có quyền sửa bài này');

  var title  = sanitizeStr_(data.Title  || '', 200);
  var prompt = sanitizeStr_(data.Prompt || '', 8000);
  if (!title)  throw new Error('Thiếu Tiêu đề bài tập');
  if (!prompt) throw new Error('Thiếu Prompt');

  var updates = {
    Title:       title,
    Description: sanitizeStr_(data.Description || '', 2000),
    Prompt:      prompt,
    Demo_Link:   sanitizeStr_(data.Demo_Link || '', 1000),
    Updated_At:  new Date().toISOString()
  };
  updateRowByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id, updates);
  return { exercise_id: id };
}

function deleteExercise_(data) {
  data = data || {};
  var id = sanitizeStr_(data.Exercise_ID || '');
  if (!id) throw new Error('Thiếu Exercise_ID');
  var existing = findObjectByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id);
  if (!existing) throw new Error('Không tìm thấy bài tập: ' + id);
  if (!_canManageExercise_(existing, data)) throw new Error('Bạn không có quyền xóa bài này');
  updateRowByField_(SHEETS.AI_EXERCISE, 'Exercise_ID', id, { Active: 'FALSE', Updated_At: new Date().toISOString() });
  return { exercise_id: id, deleted: true };
}
