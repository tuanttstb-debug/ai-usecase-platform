// ─────────────────────────────────────────────────────────────────
// WorkflowSeedTeamSo.gs — Tách Team Số ra Nhóm riêng + seed WF/US đặc thù
//
// Chạy 1 LẦN trong GAS Editor (AI US project): chọn seedTeamSoWorkflows → Run.
// Idempotent — chạy lại an toàn (bỏ qua US đã có, không nhân đôi).
//
// Việc script làm:
//   1. TEAM_GROUP_MAP: Team 'Số' → '4. Workflow đặc thù Số hóa tín dụng' (tách khỏi PO).
//   2. Chuyển WF 'Phát triển dự án số: BRD–US–Mockup–UAT' (3 US) từ nhóm PO → nhóm Số.
//   3. Thêm 6 workflow mới (18 US) đặc thù Số hóa tín dụng vào WORKFLOW_CATALOG.
//
// Nội dung WF/US bên dưới = bản đề xuất (đã duyệt). Sửa TEAM_SO_NEW_WF nếu cần rồi chạy lại.
// ─────────────────────────────────────────────────────────────────

var TEAM_SO_TEAM_NAME = 'Số';
var TEAM_SO_GROUP     = '4. Workflow đặc thù Số hóa tín dụng';

// WF đang ở nhóm PO cần chuyển sang nhóm Số (giữ nguyên US của nó).
var TEAM_SO_MOVE_FROM_PO = [
  { fromNhom: '2. Workflow đặc thù PO', workflow: 'Phát triển dự án số: BRD–US–Mockup–UAT' }
];

// 6 workflow mới (mỗi WF 3 US) — [Workflow, [UseCase, ...]]
var TEAM_SO_NEW_WF = [
  ['Thiết kế UX/UI & mockup hành trình tín dụng số', [
    'AI sinh wireframe/mockup từ User Story và luồng nghiệp vụ',
    'AI rà soát tính khả dụng (usability) và điểm nghẽn hành trình màn hình',
    'AI đối chiếu mockup với design system và checklist accessibility'
  ]],
  ['Kiểm thử & đảm bảo chất lượng sản phẩm số', [
    'AI sinh test data giả lập theo kịch bản hồ sơ tín dụng đa dạng',
    'AI dựng khung script kiểm thử tự động từ test case',
    'AI tổng hợp báo cáo UAT và tiêu chí sign-off từ log kiểm thử'
  ]],
  ['Quản lý dự án số & tích hợp hệ thống (CORE/LOS/BPM)', [
    'AI theo dõi dependency và cảnh báo rủi ro trễ tiến độ dây chuyền',
    'AI đối chiếu spec tích hợp (API/field mapping) giữa các hệ thống',
    'AI tổng hợp trạng thái dự án và dựng status report cho lãnh đạo'
  ]],
  ['Nghiên cứu đối thủ & cải tiến quy trình (R&D)', [
    'AI radar thay đổi sản phẩm/hành trình số của đối thủ theo sự kiện',
    'AI process mining từ log để dựng AS-IS và phát hiện điểm cải tiến',
    'AI đề xuất TO-BE kèm ước lượng tác động (thời gian, chi phí, rủi ro)'
  ]],
  ['Báo cáo tiền khả thi & đề xuất triển khai', [
    'AI dựng báo cáo tiền khả thi có phân tích chi phí–lợi ích và kịch bản',
    'AI lắp ghép tờ trình/đề xuất triển khai từ nguồn tài liệu đã duyệt',
    'AI kiểm tra tính đầy đủ và nhất quán số liệu trong báo cáo trước khi trình'
  ]],
  ['Vận hành LIVE & cải tiến sản phẩm hiện hữu liên tục', [
    'AI phân tích phản ánh/sự cố vận hành để đề xuất backlog cải tiến',
    'AI giám sát chỉ số sử dụng và cảnh báo bất thường sản phẩm đang LIVE',
    'AI đối soát cấu hình sản phẩm (phí/lãi/điều kiện) end-to-end'
  ]]
];

function _teamSoKey_(nhom, wf, uc) {
  return String(nhom).trim() + '||' + String(wf).trim() + '||' + String(uc).trim();
}

/** Upsert 1 dòng Team→Nhom (case-insensitive theo Team). */
function _setTeamGroup_(team, nhom) {
  var sheet = getOrCreateSheet_(SHEETS.TEAM_GROUP);
  var data  = sheet.getDataRange().getValues();
  var headers = data.length ? data[0].map(String) : TEAM_GROUP_HEADERS.slice();
  var cTeam = headers.indexOf('Team');
  var cNhom = headers.indexOf('Nhom');
  if (cTeam === -1 || cNhom === -1) throw new Error('TEAM_GROUP_MAP thiếu cột Team/Nhom');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cTeam]).trim().toLowerCase() === String(team).trim().toLowerCase()) {
      sheet.getRange(i + 1, cNhom + 1).setValue(nhom);
      return 'updated';
    }
  }
  sheet.appendRow([team, nhom]);
  return 'created';
}

/** Chuyển toàn bộ US của (fromNhom, workflow) sang newNhom. Trả về số US đã chuyển. */
function _moveWorkflowToGroup_(fromNhom, workflow, newNhom) {
  var sheet = getOrCreateSheet_(SHEETS.WORKFLOW);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;
  var headers = data[0].map(String);
  var cNhom = headers.indexOf('Nhom');
  var cWf   = headers.indexOf('Workflow');
  var cUpd  = headers.indexOf('Updated_At');
  var now   = new Date().toISOString();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cNhom]).trim() === fromNhom && String(data[i][cWf]).trim() === workflow) {
      data[i][cNhom] = newNhom;
      if (cUpd !== -1) data[i][cUpd] = now;
      count++;
    }
  }
  if (count > 0) sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  return count;
}

/**
 * Script chính — tách Team Số + seed WF/US. Idempotent.
 * @returns {Object} tóm tắt kết quả
 */
function seedTeamSoWorkflows() {
  ensureWorkflowSheets_();

  var result = { group: TEAM_SO_GROUP, team_map: '', wf_moved: 0, added: 0, skipped: 0 };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // 1. Team Số → nhóm Số (tách khỏi PO)
    result.team_map = _setTeamGroup_(TEAM_SO_TEAM_NAME, TEAM_SO_GROUP);

    // 2. Chuyển WF từ PO sang nhóm Số
    TEAM_SO_MOVE_FROM_PO.forEach(function (m) {
      result.wf_moved += _moveWorkflowToGroup_(m.fromNhom, m.workflow, TEAM_SO_GROUP);
    });

    // 3. Thêm 6 WF mới (idempotent theo Nhom+Workflow+UseCase)
    var sheet = getOrCreateSheet_(SHEETS.WORKFLOW);
    var existing = readSheetAsObjects_(SHEETS.WORKFLOW);
    var have = {};
    existing.forEach(function (r) { have[_teamSoKey_(r.Nhom, r.Workflow, r.UseCase)] = true; });

    var maxN = 0;
    existing.forEach(function (r) {
      var mm = /^WFC-(\d+)$/.exec(String(r.Catalog_ID || '').trim());
      if (mm) { var n = parseInt(mm[1], 10); if (n > maxN) maxN = n; }
    });

    var now = new Date().toISOString();
    var toAppend = [];
    TEAM_SO_NEW_WF.forEach(function (pair) {
      var wf = pair[0];
      pair[1].forEach(function (uc) {
        if (have[_teamSoKey_(TEAM_SO_GROUP, wf, uc)]) { result.skipped++; return; }
        maxN++;
        toAppend.push(['WFC-' + String(maxN).padStart(4, '0'), TEAM_SO_GROUP, wf, uc, true, now]);
        result.added++;
      });
    });
    if (toAppend.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, WORKFLOW_HEADERS.length).setValues(toAppend);
    }
  } finally {
    lock.releaseLock();
  }

  result.message = 'Team Số → ' + TEAM_SO_GROUP + ' (' + result.team_map + '); '
    + 'chuyển ' + result.wf_moved + ' US từ PO; thêm ' + result.added + ' US mới, bỏ qua ' + result.skipped + '.';
  Logger.log(result.message);
  return result;
}
