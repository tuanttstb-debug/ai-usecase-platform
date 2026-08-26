// ─────────────────────────────────────────────────────────────────
// WorkflowSeedDataPO.gs — Seed WORKFLOW_CATALOG cho TEAM PO (H2, 2026-08-26)
// Nguồn CHUẨN: H2/Workflow và Use case PO.xlsx (sheet "PO").
//   43 Use case / 8 Workflow. Nhóm quy đổi CHUẨN hệ thống để app lọc droplist theo team:
//     "Workflow PO"    → "2. Workflow đặc thù PO"  (team PO: BL/CV1/CV2 thấy qua TEAM_GROUP_MAP)
//     "Workflow chung" → "1. Workflow chung"       (WORKFLOW_COMMON_GROUP — mọi team thấy)
//   (Bỏ 2 cột PO BL/PO vay — chỉ là phân công người, không thuộc catalog.)
//
// CHẠY 1 LẦN trong GAS Editor: chọn hàm  seedWorkflowCatalogPO  → Run.
//   • Idempotent: bỏ qua US đã có (trùng Nhóm|Workflow|UseCase); nối WFC-ID kế tiếp.
//   • Đồng thời seed/fix TEAM_GROUP_MAP: BL/CV1/CV2 → "2. Workflow đặc thù PO".
//   • Xem trước (không ghi):  dryRunSeedWorkflowCatalogPO()
// ─────────────────────────────────────────────────────────────────

// [Nhom (đã chuẩn hóa), Workflow, UseCase]
var WORKFLOW_SEED_PO_ROWS = [
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Nghiên cứu đặc thù thị trường/ngành: Đặc trưng, chuỗi giá trị, xu hướng,  cơ hội/thách thức'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Phân tích danh mục thị trường: tiềm năng, quy mô thông qua các nguồn dữ liệu: CIC, 900k, đấu thầu, XNK,…'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Khảo sát nhu cầu KH & ĐVKD, vận hành; Thẩm định,..các bộ phận liên quan.'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Đánh giá thực trạng TPBank: tệp KH, hiệu quả khai thác, thị phần, Wallet Share'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Khảo sát và nghiên cứu đối thủ: so sánh chính sách, sản phẩm, ưu/nhược điểm'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Xậy dựng cấu trúc sản phẩm: bộ tiêu chí lựa chọn KH, chính sách tín dụng, tài sản đảm bảo'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Đánh giá PnL, mô hình rủi ro sản phẩm'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Báo cáo đề xuất ban hành sản phẩm mới/sửa đổi sản phẩm: thông qua LĐK, TTV SP'],
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Ban hành sản phẩm: Soạn thảo bộ văn bản chính + phụ lục (nếu có), trình Edoc và ban hành Eiso'],
  ['2. Workflow đặc thù PO', 'Quản trị sản phẩm', 'Cập nhật thông tin thị trường, biến động ngành định kỳ'],
  ['2. Workflow đặc thù PO', 'Quản trị sản phẩm', 'Quản trị danh mục tệp KH sản phẩm: phân tích dữ liệu, dashboard và báo cáo quản trị'],
  ['2. Workflow đặc thù PO', 'Quản trị sản phẩm', 'Rà soát, cập nhật sản phẩm theo quy định và chính sách mới'],
  ['2. Workflow đặc thù PO', 'Quản trị sản phẩm', 'Tổng hợp, phân tích và xử lý vướng mắc/ngoại lệ vận hành'],
  ['2. Workflow đặc thù PO', 'Quản trị sản phẩm', 'Xây dựng tài liệu: báo cáo, slide, cẩm nang và tài liệu quản trị'],
  ['2. Workflow đặc thù PO', 'Quản trị sản phẩm', 'Hậu kiểm, health check, cảnh báo sớm sản phẩm'],
  ['2. Workflow đặc thù PO', 'Thúc đẩy bán sản phẩm', 'Truyền thông giới thiệu, đào tạo sản phẩm tới ĐVKD'],
  ['2. Workflow đặc thù PO', 'Thúc đẩy bán sản phẩm', 'Xây dựng chương trình/chính sách thúc đẩy bán theo sản phẩm, địa bàn, phân khúc'],
  ['2. Workflow đặc thù PO', 'Thúc đẩy bán sản phẩm', 'Phân tích dữ liệu, xác định KH/ĐVKD tiềm năng và cơ hội bán'],
  ['2. Workflow đặc thù PO', 'Thúc đẩy bán sản phẩm', 'Theo dõi, tổng hợp và đánh giá kết quả bán hàng'],
  ['2. Workflow đặc thù PO', 'Thúc đẩy bán sản phẩm', 'Hỗ trợ ĐVKD giải đáp, tháo gỡ vướng mắc trong quá trình bán'],
  ['2. Workflow đặc thù PO', 'Thúc đẩy bán sản phẩm', 'Hỗ trợ và tư vấn case hồ sơ KH theo sản phẩm'],
  ['2. Workflow đặc thù PO', 'Thúc đẩy bán sản phẩm', 'Xây dựng tài liệu, kịch bản và nội dung đào tạo bán hàng'],
  ['1. Workflow chung', 'Quản trị & phân tích dữ liệu', 'Thu thập, tổng hợp và chuẩn hóa dữ liệu từ nhiều nguồn'],
  ['1. Workflow chung', 'Quản trị & phân tích dữ liệu', 'Làm sạch, kiểm tra và đối soát dữ liệu'],
  ['1. Workflow chung', 'Quản trị & phân tích dữ liệu', 'Phân tích dữ liệu, phát hiện xu hướng/bất thường và tìm insight'],
  ['1. Workflow chung', 'Quản trị & phân tích dữ liệu', 'Tổng hợp dữ liệu phục vụ báo cáo và ra quyết định'],
  ['1. Workflow chung', 'Soạn thảo & xử lý thông tin', 'Tổng hợp thông tin từ email, văn bản, tài liệu và các nguồn liên quan'],
  ['1. Workflow chung', 'Soạn thảo & xử lý thông tin', 'Soạn thảo email, báo cáo, tờ trình và tài liệu nghiệp vụ'],
  ['1. Workflow chung', 'Soạn thảo & xử lý thông tin', 'Rà soát, kiểm tra căn cứ, số liệu và tính nhất quán'],
  ['1. Workflow chung', 'Soạn thảo & xử lý thông tin', 'So sánh, cập nhật và chuẩn hóa phiên bản tài liệu'],
  ['1. Workflow chung', 'Soạn thảo & xử lý thông tin', 'Góp ý văn bản của các bên liên quan'],
  ['1. Workflow chung', 'Soạn thảo & xử lý thông tin', 'Review báo cáo đề xuất chính sách sản phẩm'],
  ['1. Workflow chung', 'Họp & quản trị công việc', 'Chuẩn bị tài liệu và nội dung trước cuộc họp'],
  ['1. Workflow chung', 'Họp & quản trị công việc', 'Tổng hợp kết luận, Action/Commitment sau cuộc họp'],
  ['1. Workflow chung', 'Họp & quản trị công việc', 'Lập kế hoạch, ưu tiên và theo dõi tiến độ công việc'],
  ['1. Workflow chung', 'Họp & quản trị công việc', 'Theo dõi deadline/SLA, phát hiện việc trễ hoặc có rủi ro'],
  ['1. Workflow chung', 'Tra cứu & khai thác tri thức', 'Tra cứu quy định, quy trình, hướng dẫn và tài liệu nghiệp vụ'],
  ['1. Workflow chung', 'Tra cứu & khai thác tri thức', 'Tổng hợp thông tin từ nhiều nguồn để giải quyết vấn đề'],
  ['1. Workflow chung', 'Tra cứu & khai thác tri thức', 'Tổng hợp FAQ, case thực tế và bài học kinh nghiệm'],
  ['1. Workflow chung', 'Tra cứu & khai thác tri thức', 'Chuyển hóa kiến thức thành hướng dẫn và tài liệu đào tạo'],
  ['1. Workflow chung', 'Báo cáo & trình bày', 'Tổng hợp, phân tích và lựa chọn nội dung trọng tâm'],
  ['1. Workflow chung', 'Báo cáo & trình bày', 'Xây dựng báo cáo, slide, dashboard và tài liệu trực quan'],
  ['1. Workflow chung', 'Báo cáo & trình bày', 'Rà soát tính chính xác, logic và khả năng truyền đạt'],
];

// Team PO (theo User_Master) → Nhóm đặc thù PO. (Seed gốc thiếu "CV"; teams thật là CV1/CV2/BL.)
var PO_TEAM_GROUP_ROWS = [
  ['BL',  '2. Workflow đặc thù PO'],
  ['CV1', '2. Workflow đặc thù PO'],
  ['CV2', '2. Workflow đặc thù PO']
];

function _poWfKey_(nhom, wf, uc) {
  return [String(nhom || '').trim().toLowerCase(),
          String(wf   || '').trim().toLowerCase(),
          String(uc   || '').trim().toLowerCase()].join('|');
}

// Bổ sung map team PO vào TEAM_GROUP_MAP nếu chưa có. Trả danh sách team đã thêm.
function _seedPoTeamGroupMap_() {
  var sheet = getOrCreateSheet_(SHEETS.TEAM_GROUP);
  var exist = {};
  readSheetAsObjects_(SHEETS.TEAM_GROUP).forEach(function (r) {
    exist[String(r.Team || '').trim().toLowerCase()] = true;
  });
  var added = [];
  PO_TEAM_GROUP_ROWS.forEach(function (p) {
    if (!exist[p[0].toLowerCase()]) { sheet.appendRow([p[0], p[1]]); added.push(p[0]); }
  });
  return added;
}

// Xem trước (KHÔNG ghi): số US sẽ thêm / trùng + team map sẽ bổ sung.
function dryRunSeedWorkflowCatalogPO() {
  ensureWorkflowSheets_();
  var seen = {};
  readSheetAsObjects_(SHEETS.WORKFLOW).forEach(function (r) {
    seen[_poWfKey_(r.Nhom, r.Workflow, r.UseCase)] = true;
  });
  var willAdd = 0, dup = 0;
  WORKFLOW_SEED_PO_ROWS.forEach(function (r) {
    if (seen[_poWfKey_(r[0], r[1], r[2])]) dup++; else willAdd++;
  });
  var teamExist = {};
  readSheetAsObjects_(SHEETS.TEAM_GROUP).forEach(function (r) { teamExist[String(r.Team || '').trim().toLowerCase()] = true; });
  var teamWillAdd = PO_TEAM_GROUP_ROWS.filter(function (p) { return !teamExist[p[0].toLowerCase()]; }).map(function (p) { return p[0]; });
  var msg = '[DRY-RUN PO] Se them ' + willAdd + ' US (trung bo qua ' + dup + '/' + WORKFLOW_SEED_PO_ROWS.length + '); TEAM_GROUP_MAP se +[' + teamWillAdd.join(', ') + '].';
  Logger.log(msg);
  return { will_add: willAdd, duplicate: dup, total: WORKFLOW_SEED_PO_ROWS.length, team_map_will_add: teamWillAdd, message: msg };
}

// Nạp catalog PO + fix team map. Idempotent.
function seedWorkflowCatalogPO() {
  ensureWorkflowSheets_();
  var teamAdded = _seedPoTeamGroupMap_();

  var sheet = getOrCreateSheet_(SHEETS.WORKFLOW);
  var existing = readSheetAsObjects_(SHEETS.WORKFLOW);
  var seen = {}, maxId = 0;
  existing.forEach(function (r) {
    seen[_poWfKey_(r.Nhom, r.Workflow, r.UseCase)] = true;
    var m = /^WFC-(\d+)$/.exec(String(r.Catalog_ID || '').trim());
    if (m) { var n = parseInt(m[1], 10); if (n > maxId) maxId = n; }
  });

  var now = new Date().toISOString();
  var out = [];
  WORKFLOW_SEED_PO_ROWS.forEach(function (r) {
    var key = _poWfKey_(r[0], r[1], r[2]);
    if (seen[key]) return;
    seen[key] = true;
    maxId++;
    out.push(['WFC-' + String(maxId).padStart(4, '0'), r[0], r[1], r[2], true, now]);
  });
  if (out.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, out.length, WORKFLOW_HEADERS.length).setValues(out);
  }

  var msg = '[PO seed] Da them ' + out.length + ' US (bo trung ' + (WORKFLOW_SEED_PO_ROWS.length - out.length) + '/' + WORKFLOW_SEED_PO_ROWS.length + '); '
          + 'TEAM_GROUP_MAP +' + teamAdded.length + ' [' + teamAdded.join(', ') + '].';
  Logger.log(msg);
  return { seeded: out.length, skipped: WORKFLOW_SEED_PO_ROWS.length - out.length, team_map_added: teamAdded, message: msg };
}
