// ─────────────────────────────────────────────────────────────────
// UseCaseService.gs — CRUD operations cho AI Use Case
// ─────────────────────────────────────────────────────────────────

// ── ID Generation ─────────────────────────────────────────────────

/**
 * Lấy tất cả UseCase_ID hiện có từ MASTER_DATA.
 * @returns {string[]} VD: ['AIUS-0001', 'AIUS-0003']
 */
function _getAllUseCaseIds_() {
  var master = getOrCreateSheet_(SHEETS.MASTER);
  var data   = master.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(String);
  var idCol   = headers.indexOf('UseCase_ID');
  if (idCol === -1) return [];
  var ids = [];
  for (var i = 1; i < data.length; i++) {
    var val = String(data[i][idCol]).trim();
    if (val && val.indexOf(ID_PREFIX) === 0) ids.push(val);
  }
  return ids;
}

/**
 * Tìm số thứ tự lớn nhất trong các UseCase_ID hiện có ở MASTER_DATA.
 * @returns {number} Số lớn nhất, 0 nếu chưa có record nào
 */
function _getMaxExistingIdNum_() {
  var ids = _getAllUseCaseIds_();
  var max = 0;
  ids.forEach(function(id) {
    var num = parseInt(id.slice(ID_PREFIX.length), 10);
    if (!isNaN(num) && num > max) max = num;
  });
  return max;
}

/**
 * Xem trước UseCase_ID tiếp theo sẽ được cấp (không tiêu thụ counter).
 * Kết quả là best-guess — có thể thay đổi nếu có request đồng thời.
 * @returns {{ next_id: string }}
 */
function peekNextUseCaseId_() {
  var sheet          = getOrCreateSheet_(SHEETS.CONFIG);
  var data           = sheet.getDataRange().getValues();
  var nextFromConfig = CONFIG_DEFAULTS.NEXT_ID;

  if (data.length >= 2) {
    var keyCol = data[0].map(String).indexOf('Key');
    var valCol = data[0].map(String).indexOf('Value');
    if (keyCol !== -1 && valCol !== -1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][keyCol]).trim() === 'NEXT_ID') {
          nextFromConfig = parseInt(data[i][valCol], 10) || CONFIG_DEFAULTS.NEXT_ID;
          break;
        }
      }
    }
  }

  var maxExisting = _getMaxExistingIdNum_();
  var candidate   = Math.max(nextFromConfig, maxExisting + 1);
  var existingIds = _getAllUseCaseIds_();
  var idStr;
  do {
    idStr     = ID_PREFIX + ('0000' + candidate).slice(-ID_PADDING);
    candidate = candidate + 1;
  } while (existingIds.indexOf(idStr) !== -1);

  return { next_id: idStr };
}

/**
 * Sinh UseCase_ID dạng AIUS-NNNN với atomic increment.
 * FIX v2: Đồng bộ với MASTER_DATA trước khi gán → tránh trùng dù counter lệch.
 * - Lấy max(CONFIG.NEXT_ID, maxExisting + 1) làm điểm bắt đầu
 * - Loop skip qua bất kỳ ID nào đã tồn tại trong sheet
 * - Ghi counter = nextCandidate sau khi gán
 * @returns {string} VD: 'AIUS-0001'
 */
function generateUseCaseId_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    var sheet          = getOrCreateSheet_(SHEETS.CONFIG);
    var data           = sheet.getDataRange().getValues();
    var nextFromConfig = CONFIG_DEFAULTS.NEXT_ID;
    var configRowIndex = -1; // 1-based row index trong sheet

    if (data.length >= 2) {
      var keyCol = data[0].map(String).indexOf('Key');
      var valCol = data[0].map(String).indexOf('Value');
      if (keyCol !== -1 && valCol !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][keyCol]).trim() === 'NEXT_ID') {
            nextFromConfig = parseInt(data[i][valCol], 10) || CONFIG_DEFAULTS.NEXT_ID;
            configRowIndex = i + 1; // 0-based array → 1-based sheet row
            break;
          }
        }
      }
    }

    // Đồng bộ với dữ liệu thực tế: dùng max(CONFIG, maxExisting + 1)
    var maxExisting = _getMaxExistingIdNum_();
    var candidate   = Math.max(nextFromConfig, maxExisting + 1);

    // Tìm ID chưa tồn tại (xử lý collision hiếm gặp do import/migration)
    var existingIds = _getAllUseCaseIds_();
    var idStr;
    do {
      idStr     = ID_PREFIX + ('0000' + candidate).slice(-ID_PADDING);
      candidate = candidate + 1;
    } while (existingIds.indexOf(idStr) !== -1);

    // Lưu counter tiếp theo vào CONFIG sheet
    if (configRowIndex > 0) {
      sheet.getRange(configRowIndex, 2).setValue(candidate);
    } else {
      sheet.appendRow(['NEXT_ID', candidate, 'Auto-increment ID counter']);
    }

    return idStr;
  } finally {
    lock.releaseLock();
  }
}

// ── ID Assignment ─────────────────────────────────────────────────

/**
 * Chọn UseCase_ID cho record mới.
 * Nếu FE gửi kèm hint (vừa fetch từ peekNextUseCaseId_) và hint còn free
 * → dùng hint trong scope của lock + cập nhật counter.
 * Ngược lại → gọi generateUseCaseId_() (cũng có lock bên trong).
 *
 * Cơ chế này giảm window race condition xuống gần 0: FE fetch ID ngay trước
 * khi submit, GAS validate trong lock — nếu 2 request cùng lúc gửi cùng hint,
 * chỉ 1 cái thắng lock và được dùng hint đó, cái kia fallback generate mới.
 *
 * @param {string} hint - UseCase_ID từ FE (vd: 'AIUS-0005'), có thể rỗng/undefined
 * @returns {string} UseCase_ID được cấp
 */
function _assignUseCaseId_(hint) {
  var hintStr = hint ? String(hint).trim() : '';
  var idPattern = new RegExp('^' + ID_PREFIX + '\\d{' + ID_PADDING + ',}$');
  if (hintStr && idPattern.test(hintStr)) {
    var lock = LockService.getScriptLock();
    lock.waitLock(LOCK_TIMEOUT_MS);
    try {
      if (_getAllUseCaseIds_().indexOf(hintStr) === -1) {
        _ensureCounterAhead_(hintStr);
        return hintStr;
      }
    } finally {
      lock.releaseLock();
    }
  }
  return generateUseCaseId_();
}

/**
 * Đảm bảo CONFIG.NEXT_ID > số trong useCaseId vừa được cấp.
 * Phải gọi trong scope lock đang active.
 * @param {string} useCaseId - VD: 'AIUS-0005'
 */
function _ensureCounterAhead_(useCaseId) {
  var minNext = parseInt(useCaseId.slice(ID_PREFIX.length), 10) + 1;
  var sheet   = getOrCreateSheet_(SHEETS.CONFIG);
  var data    = sheet.getDataRange().getValues();
  if (data.length < 2) { sheet.appendRow(['NEXT_ID', minNext, 'Auto-increment ID counter']); return; }
  var keyCol  = data[0].map(String).indexOf('Key');
  var valCol  = data[0].map(String).indexOf('Value');
  if (keyCol === -1 || valCol === -1) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyCol]).trim() === 'NEXT_ID') {
      if (minNext > (parseInt(data[i][valCol], 10) || 1)) {
        sheet.getRange(i + 1, valCol + 1).setValue(minNext);
      }
      return;
    }
  }
  sheet.appendRow(['NEXT_ID', minNext, 'Auto-increment ID counter']);
}

// ── Create ────────────────────────────────────────────────────────

/**
 * Tạo use case mới.
 * - Validate required fields
 * - Sinh Record_ID (UUID) và UseCase_ID (AIUS-NNNN)
 * - Tự động tính Estimated_Time_Saving và Estimated_Hours_Saved_Month
 * - Lưu JSON_Backup
 * @param {Object} data - Request body
 * @returns {{ record_id: string, usecase_id: string }}
 */
function createUseCase_(data) {
  // ── 1. Validation ─────────────────────────────────────────────
  var errors = validateCreate_(data);
  if (errors.length) throw new Error(errors.join(' | '));

  // ── 2. Sinh IDs ───────────────────────────────────────────────
  var now       = new Date().toISOString();
  var recordId  = Utilities.getUuid();
  // Dùng ID hint từ FE nếu còn free (kiểm tra trong lock), ngược lại generate mới.
  // Fix: tránh duplicate khi nhiều user submit đồng thời.
  var useCaseId = _assignUseCaseId_(sanitizeStr_(data.UseCase_ID));

  // ── 3. Build record object ─────────────────────────────────────
  var obj = {};
  HEADERS.forEach(function(h) { obj[h] = ''; });

  // Copy dữ liệu từ request (chỉ các field trong HEADERS)
  Object.keys(data).forEach(function(k) {
    if (HEADERS.indexOf(k) !== -1) {
      obj[k] = sanitizeStr_(data[k], 5000);
    }
  });

  // ── 4. Set system fields ──────────────────────────────────────
  obj.Record_ID    = recordId;
  obj.UseCase_ID   = useCaseId;
  obj.Created_At   = now;
  obj.Updated_At   = now;
  obj.Edit_Version = 1;

  // Status: accept 'Submitted' từ frontend; default là 'Draft'
  // (Không ép thành Draft như code cũ — cho phép submit trực tiếp)
  var requestedStatus = sanitizeStr_(data.Status);
  obj.Status = (requestedStatus && STATUS[requestedStatus.toUpperCase()] === requestedStatus)
               ? requestedStatus
               : STATUS.DRAFT;
  // Current_Stage giữ nguyên giá trị S1-S4 từ form (không overwrite bằng Status)

  // Submit_Date chỉ set khi status = Submitted
  if (obj.Status === STATUS.SUBMITTED) {
    obj.Submit_Date = now;
  }

  // ── 5. Auto-compute time saving ───────────────────────────────
  if (data.Before_Time_Min && data.After_Time_Min) {
    obj.Estimated_Time_Saving      = computeTimeSaving_(data.Before_Time_Min, data.After_Time_Min);
    obj.Estimated_Hours_Saved_Month = computeHoursSavedMonth_(data.Before_Time_Min, data.After_Time_Min);
  }

  // ── 6. JSON_Backup (snapshot không bao gồm chính nó) ─────────
  // Google Sheets giới hạn 50,000 chars/cell. JSON_Backup có thể vượt nếu
  // nhiều textarea field được fill đầy. Truncate an toàn thay vì để setValues fail.
  var backupData = {};
  HEADERS.forEach(function(h) { if (h !== 'JSON_Backup') backupData[h] = obj[h]; });
  var backupStr = JSON.stringify(backupData);
  obj.JSON_Backup = backupStr.length <= 45000 ? backupStr : '';

  // ── 7. Ghi vào sheet ──────────────────────────────────────────
  appendRowFromObject_(SHEETS.MASTER, obj);
  logActivity_(useCaseId, recordId, 'CREATED', 'Use case tạo mới qua API', data.Owner_Email,
               '', obj.Status);

  return { record_id: recordId, usecase_id: useCaseId };
}

// ── Update ────────────────────────────────────────────────────────

/**
 * Cập nhật use case theo Record_ID.
 * FIX: Gọi validateUpdate_ (trước đây không được gọi).
 * - Không cho phép ghi đè PROTECTED_FIELDS
 * - Tự động tính lại time saving nếu thay đổi Before/After
 * - Cập nhật Submit_Date khi chuyển sang Submitted lần đầu
 * - Cập nhật JSON_Backup
 * @param {string} recordId
 * @param {Object} data
 * @returns {Object} Record sau khi merge
 */
function updateUseCase_(recordId, data) {
  if (!recordId) throw new Error('Record_ID là bắt buộc');

  // ── 1. Validation ─────────────────────────────────────────────
  data.Record_ID = recordId; // Đảm bảo Record_ID có trong data để validate
  var errors = validateUpdate_(data); // FIX: thực sự gọi validateUpdate_
  if (errors.length) throw new Error(errors.join(' | '));

  // ── 2. Lấy record hiện tại (single read — trả về sheet ref để write sau) ─
  // findRowByField_ đọc MASTER_DATA một lần duy nhất và giữ sheet reference.
  // Ghi đè sau đó dùng found.sheet + found.rowIndex → không cần đọc lại lần 2.
  // (So với findObjectByField_ + updateRowByRecordId_ cũ: 2 full reads → 1 read)
  var found = findRowByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!found) throw new Error('Không tìm thấy use case với Record_ID: ' + recordId);
  var existing = found.obj;

  var now    = new Date().toISOString();
  var merged = {};
  Object.keys(existing).forEach(function(k) { merged[k] = existing[k]; });

  // ── 3. Merge new data (bảo vệ protected fields) ───────────────
  Object.keys(data).forEach(function(k) {
    if (HEADERS.indexOf(k) === -1)          return; // Bỏ field không trong schema
    if (PROTECTED_FIELDS.indexOf(k) !== -1) return; // Không ghi đè protected fields
    merged[k] = sanitizeStr_(data[k], 5000);
  });

  // ── 4. Update metadata ────────────────────────────────────────
  merged.Updated_At   = now;
  merged.Edit_Version = (parseInt(merged.Edit_Version, 10) || 0) + 1;

  // ── 5. Status transition ──────────────────────────────────────
  var prevStatus = String(existing.Status || STATUS.DRAFT);
  var newStatus  = String(merged.Status   || STATUS.DRAFT);

  // Kiểm tra transition hợp lệ
  var allowedTransitions = STATUS_TRANSITIONS[prevStatus] || [];
  if (allowedTransitions.indexOf(newStatus) === -1) {
    throw new Error(
      'Không thể chuyển status từ "' + prevStatus + '" sang "' + newStatus + '". ' +
      'Được phép: ' + allowedTransitions.join(', ')
    );
  }

  // Set Submit_Date khi lần đầu chuyển sang Submitted
  if (newStatus === STATUS.SUBMITTED && prevStatus !== STATUS.SUBMITTED) {
    merged.Submit_Date = now;
  }
  // Current_Stage giữ nguyên giá trị S1-S4 từ form (không sync với Status)

  // ── 6. Tính lại time saving nếu Before/After thay đổi ─────────
  var before = merged.Before_Time_Min || existing.Before_Time_Min;
  var after  = merged.After_Time_Min  || existing.After_Time_Min;
  if (before && after) {
    merged.Estimated_Time_Saving       = computeTimeSaving_(before, after);
    merged.Estimated_Hours_Saved_Month = computeHoursSavedMonth_(before, after);
  }

  // ── 7. Cập nhật JSON_Backup ───────────────────────────────────
  // Cap tại 45,000 chars để tránh vượt giới hạn 50,000 chars/cell của Google Sheets
  var backupData = {};
  HEADERS.forEach(function(h) { if (h !== 'JSON_Backup') backupData[h] = merged[h]; });
  var backupStr = JSON.stringify(backupData);
  merged.JSON_Backup = backupStr.length <= 45000 ? backupStr : '';

  // ── 8. Ghi vào sheet (dùng cached sheet ref — không đọc lại lần 2) ──────
  var row = found.headers.map(function(h) {
    var val = (merged[h] !== undefined && merged[h] !== null) ? merged[h] : '';
    return toSheetValue_(val);
  });
  found.sheet.getRange(found.rowIndex, 1, 1, found.headers.length).setValues([row]);
  logActivity_(merged.UseCase_ID, recordId, 'UPDATED', 'Cập nhật qua API',
               merged.Owner_Email, prevStatus, newStatus);

  // Trả về minimal response — FE không dùng merged object sau update.
  // Trả full merged (7,000+ chars khi Prompt_Context đầy) làm JSONP body quá lớn →
  // Google redirect URL vượt giới hạn → HTTP 400 dù data đã ghi thành công trong sheet.
  return { record_id: recordId, usecase_id: merged.UseCase_ID, updated_at: now };
}

// ── Read ──────────────────────────────────────────────────────────

/**
 * Lấy chi tiết một use case theo Record_ID.
 * @param {string} recordId
 * @returns {Object} Use case object (không bao gồm JSON_Backup)
 */
function getUseCaseById_(recordId) {
  if (!recordId || String(recordId).trim() === '') {
    throw new Error('Record_ID không được để trống');
  }
  var obj = findObjectByField_(SHEETS.MASTER, 'Record_ID', recordId);
  if (!obj) throw new Error('Không tìm thấy use case với Record_ID: ' + recordId);

  // Ẩn JSON_Backup trong response (quá lớn, không cần thiết cho edit mode)
  var result = {};
  Object.keys(obj).forEach(function(k) {
    if (k !== 'JSON_Backup') result[k] = obj[k];
  });
  return result;
}

// ── Duplicate Check ───────────────────────────────────────────────

/**
 * Kiểm tra trùng lặp tên use case bằng Dice Coefficient.
 * FIX: Bỏ qua record hiện tại khi check (dùng trong edit mode).
 * FIX: Sử dụng multiset bigrams (accurate hơn Set-based cũ).
 * @param {string} name           - Tên use case cần kiểm tra
 * @param {string} [painPoint]    - Pain point (tăng độ chính xác)
 * @param {string} [excludeId]    - Record_ID cần loại trừ (edit mode)
 * @returns {Object} { similarity_score, duplicate_flag, match_usecase_id, match_usecase_name }
 */
function checkDuplicate_(name, painPoint, excludeId) {
  var errors = validateDuplicateCheck_({ UseCase_Name: name });
  if (errors.length) throw new Error(errors.join(' | '));

  var all = readSheetAsObjects_(SHEETS.MASTER);

  var bestScore = 0;
  var bestMatch = null;

  all.forEach(function(uc) {
    // Bỏ qua record hiện tại (edit mode)
    if (excludeId && String(uc.Record_ID) === String(excludeId)) return;
    // Chỉ check các record đang active (không Rejected)
    if (uc.Status === STATUS.REJECTED) return;
    // Bỏ qua record rỗng
    if (!uc.UseCase_Name) return;

    var scoreName  = diceSimilarity_(name, uc.UseCase_Name);
    var scorePain  = painPoint ? diceSimilarity_(painPoint, uc.Pain_Point) : 0;
    var combined   = scoreName * DUPLICATE_WEIGHT_NAME + scorePain * DUPLICATE_WEIGHT_PAIN;

    if (combined > bestScore) {
      bestScore = combined;
      bestMatch = uc;
    }
  });

  var isDuplicate = bestScore >= DUPLICATE_THRESHOLD;
  return {
    similarity_score:    Math.round(bestScore * 1000) / 1000, // 3 decimal places
    duplicate_flag:      isDuplicate,
    match_usecase_id:    isDuplicate ? (bestMatch.UseCase_ID  || '') : null,
    match_usecase_name:  isDuplicate ? (bestMatch.UseCase_Name || '') : null,
    match_record_id:     isDuplicate ? (bestMatch.Record_ID   || '') : null
  };
}
