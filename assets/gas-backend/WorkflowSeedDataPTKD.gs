// ───────────────────────────────────────────────────
// WorkflowSeedDataPTKD.gs — Seed WORKFLOW_CATALOG cho PTKD & QLDM (H2, 2026-09-11)
// Nguồn CHUẨN: binh-dan-hoa-ai-H2/data/Workflow và Use case PTKD + QLDM.xlsx, sheet "PO - PTKD".
//   Ánh xạ Nhóm thô → Nhóm canonical hệ thống (khớp TEAM_GROUP_SEED trong Config.gs):
//     "Workflow PO"    → "2. Workflow đặc thù PO"      (đã seed ở WorkflowSeedDataPO.gs → dedup bỏ qua)
//     "Workflow chung" → "1. Workflow chung"           (WORKFLOW_COMMON_GROUP — mọi team thấy)
//     "Workflow PTKD"  → "3. Workflow PTKD & QLDM"      (NỘI DUNG MỚI — PTKD MB/MN + QLDM chia sẻ)
//
// CHẠY 1 LẦN trong GAS Editor: chọn hàm  seedWorkflowCatalogPTKD  → Run.
//   • Idempotent: bỏ qua US đã có (trùng Nhom|Workflow|UseCase, so không phân biệt hoa/thường);
//     nối Catalog_ID WFC-XXXX kế tiếp. Không đụng dòng cũ.
//   • Đồng thời seed/fix TEAM_GROUP_MAP: PTKD MB / PTKD MN / QLDM → "3. Workflow PTKD & QLDM".
//   • Xem trước (KHÔNG ghi):  dryRunSeedWorkflowCatalogPTKD()
// ───────────────────────────────────────────────────

// [Nhom (đã chuẩn hóa), Workflow, UseCase]
var WORKFLOW_SEED_PTKD_ROWS = [
  ['2. Workflow đặc thù PO', 'Nghiên cứu & phát triển/sửa đổi sản phẩm', 'Nghiên cứu đặc thù thị trường/ngành: Đặc trưng, chuỗi giá trị, xu hướng, cơ hội/thách thức'],
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
  ['1. Workflow chung', 'Tra cứu & khai thác tri thức', 'Chatbot/trợ lý trả lời QA của ĐVKD (thẩm quyền PD, luồng trình hồ sơ, vướng mắc SP...) và tự động điều hướng câu hỏi tới đúng đầu mối (SPTDDN.CB, VBTD)'],
  ['1. Workflow chung', 'Báo cáo & trình bày', 'Tổng hợp, phân tích và lựa chọn nội dung trọng tâm'],
  ['1. Workflow chung', 'Báo cáo & trình bày', 'Xây dựng báo cáo, slide, dashboard và tài liệu trực quan'],
  ['1. Workflow chung', 'Báo cáo & trình bày', 'Rà soát tính chính xác, logic và khả năng truyền đạt'],
  ['1. Workflow chung', 'Báo cáo & trình bày', 'Tự động tổng hợp & soạn báo cáo tuần/báo cáo liên Khối/báo cáo case lớn theo template chuẩn từ dữ liệu KPI, case, hồ sơ'],
  ['3. Workflow PTKD & QLDM', 'KYC, hồ sơ pháp lý & chân dung KHDN', 'Tổng hợp KYC từ hồ sơ và nguồn công khai, tạo Customer Meeting Pack 360° trước khi gặp'],
  ['3. Workflow PTKD & QLDM', 'KYC, hồ sơ pháp lý & chân dung KHDN', 'Tổng hợp & phân tích nhanh thông tin pháp lý/ TSĐB/CIC'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù Xây lắp'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù dự án BĐS dân dụng'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù dự án BĐS KCN'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù ngành Sắt thép'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù ngành Gạo'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù ngành Điều'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù ngành Cao su'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù ngành Café'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý phân tích BCTC theo đặc thù ngành TACN'],
  ['3. Workflow PTKD & QLDM', 'Thẩm định tín dụng, dự án & phương án', 'Trợ lý checklist thu thập thông tin & thẩm định dự án tài trợ BĐS + soạn Biên bản họp (BBH) trình chủ trương tài trợ'],
  ['3. Workflow PTKD & QLDM', 'Quản lý danh mục & cảnh báo sớm', 'Hợp nhất theo dõi danh mục, dư nợ/quá hạn/nợ xấu, dòng tiền, tuân thủ và tín hiệu thị trường để ưu tiên hành động.'],
  ['3. Workflow PTKD & QLDM', 'Quản lý danh mục & cảnh báo sớm', 'Chuẩn hóa quy trình thực hiện rà soát hồ sơ KH có vấn đề'],
  ['3. Workflow PTKD & QLDM', 'Quản trị chiến dịch bán & pipeline', 'AI lead scoring và phân bổ data theo xác suất chuyển đổi'],
  ['3. Workflow PTKD & QLDM', 'Quản trị chiến dịch bán & pipeline', 'Hỗ trợ quá trình triển khai bán: xây dựng kịch bản telesale, kịch bản chốt deal, đàm phán, gửi bản chào'],
  ['3. Workflow PTKD & QLDM', 'Phát hiện cơ hội, upsell & hệ sinh thái', 'Phân tích KH hiện hữu/thị trường/hệ sinh thái để xác định KH mục tiêu, cơ hội SPDV và next-best-action.'],
  ['3. Workflow PTKD & QLDM', 'Phát hiện cơ hội, upsell & hệ sinh thái', 'Nhận diện KH mới tiềm năng theo xu hướng thị trường'],
  ['3. Workflow PTKD & QLDM', 'Phát hiện cơ hội, upsell & hệ sinh thái', 'Nhận diện KHHH có dấu hiệu rời bỏ, WS thấp'],
  ['3. Workflow PTKD & QLDM', 'Phân tích KQKD, KPI & điều hành ĐVKD', 'Chuẩn hóa KPI, TOP/BOTTOM, xu hướng, nguyên nhân, cảnh báo và action list theo ĐVKD/team'],
  ['3. Workflow PTKD & QLDM', 'Phân tích KQKD, KPI & điều hành ĐVKD', 'Xây dựng ma trận & kiểm thử phân giao KPI ĐVKD'],
  ['3. Workflow PTKD & QLDM', 'Phân tích KQKD, KPI & điều hành ĐVKD', 'Theo dõi tiến độ hồ sơ luồng N theo từng bước xử lý TTĐ/cấp PD, tự động cảnh báo case cần báo cáo BLĐ trước khi họp HĐTD'],
  ['3. Workflow PTKD & QLDM', 'Phân tích KQKD, KPI & điều hành ĐVKD', 'Tự động soạn & gửi bản tin KPI dư nợ/phí định kỳ (tuần), nêu rõ GAP chỉ tiêu và yêu cầu hành động cho từng ĐVKD'],
  ['3. Workflow PTKD & QLDM', 'Phân tích KQKD, KPI & điều hành ĐVKD', 'Trợ lý chuẩn bị nội dung họp tracking KPI/bán mới/hồ sơ lớn/pending trước khi làm việc trực tiếp tại ĐVKD'],
  ['3. Workflow PTKD & QLDM', 'Phân tích KQKD, KPI & điều hành ĐVKD', 'Công cụ cân đối room giải ngân theo ĐVKD: rà soát lãi suất, TOI, TOI/DNBQ, đề xuất phương án điều chỉnh'],
  ['3. Workflow PTKD & QLDM', 'Tư vấn case & đề xuất giá/phí/tín dụng', 'Chuẩn hóa xử lý case trình giảm phí'],
  ['3. Workflow PTKD & QLDM', 'Tư vấn case & đề xuất giá/phí/tín dụng', 'Chuẩn hóa xử lý case trình giảm lãi suất'],
  ['3. Workflow PTKD & QLDM', 'Tư vấn case & đề xuất giá/phí/tín dụng', 'Chuẩn hóa quy trình xử lý case luồng F: tóm tắt đề xuất, đánh giá BCTC, ra quyết định phê duyệt'],
  ['3. Workflow PTKD & QLDM', 'Tư vấn case & đề xuất giá/phí/tín dụng', 'Công cụ kiểm tra thẩm quyền và giải pháp tín dụng bằng rule/checklist có phê duyệt người dùng.'],
  ['3. Workflow PTKD & QLDM', 'Tư vấn case & đề xuất giá/phí/tín dụng', 'Trợ lý soạn thảo Phê duyệt kèm Điều kiện tín dụng (ĐKTD) tự động cho hồ sơ luồng F cấp A2'],
  ['3. Workflow PTKD & QLDM', 'Tư vấn case & đề xuất giá/phí/tín dụng', 'Trợ lý hướng dẫn cấu trúc HMTD/ĐKTD/điểm cần làm rõ khi ĐVKD soạn tờ trình case lớn/đặc thù'],
  ['3. Workflow PTKD & QLDM', 'Tư vấn case & đề xuất giá/phí/tín dụng', 'Chuẩn hóa quy trình trình bảo lưu hồ sơ CGPD cấp C/B bị từ chối hoặc ràng thêm ĐKTD'],
];

// Team PTKD/QLDM (theo User_Master) → Nhóm đặc thù chung. Khớp Config.gs TEAM_GROUP_SEED.
var PTKD_TEAM_GROUP_ROWS = [
  ['PTKD MB', '3. Workflow PTKD & QLDM'],
  ['PTKD MN', '3. Workflow PTKD & QLDM'],
  ['QLDM',    '3. Workflow PTKD & QLDM']
];

function _ptkdWfKey_(nhom, wf, uc) {
  // Bất biến với khoảng trắng thừa (double-space giữa câu) → tránh gần-trùng.
  function nk_(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  return [nk_(nhom), nk_(wf), nk_(uc)].join('|');
}

// Bổ sung map team PTKD/QLDM vào TEAM_GROUP_MAP nếu chưa có. Trả danh sách team đã thêm.
function _seedPtkdTeamGroupMap_() {
  var sheet = getOrCreateSheet_(SHEETS.TEAM_GROUP);
  var exist = {};
  readSheetAsObjects_(SHEETS.TEAM_GROUP).forEach(function (r) {
    exist[String(r.Team || '').trim().toLowerCase()] = true;
  });
  var added = [];
  PTKD_TEAM_GROUP_ROWS.forEach(function (p) {
    if (!exist[p[0].toLowerCase()]) { sheet.appendRow([p[0], p[1]]); added.push(p[0]); }
  });
  return added;
}

// Xem trước (KHÔNG ghi): số US sẽ thêm / trùng theo từng nhóm + team map sẽ bổ sung.
function dryRunSeedWorkflowCatalogPTKD() {
  ensureWorkflowSheets_();
  var seen = {};
  readSheetAsObjects_(SHEETS.WORKFLOW).forEach(function (r) {
    seen[_ptkdWfKey_(r.Nhom, r.Workflow, r.UseCase)] = true;
  });
  var willAdd = 0, dup = 0, byNhomAdd = {};
  WORKFLOW_SEED_PTKD_ROWS.forEach(function (r) {
    if (seen[_ptkdWfKey_(r[0], r[1], r[2])]) { dup++; }
    else { willAdd++; byNhomAdd[r[0]] = (byNhomAdd[r[0]] || 0) + 1; }
  });
  var teamExist = {};
  readSheetAsObjects_(SHEETS.TEAM_GROUP).forEach(function (r) { teamExist[String(r.Team || '').trim().toLowerCase()] = true; });
  var teamWillAdd = PTKD_TEAM_GROUP_ROWS.filter(function (p) { return !teamExist[p[0].toLowerCase()]; }).map(function (p) { return p[0]; });
  var msg = '[DRY-RUN PTKD] Se them ' + willAdd + ' US (trung bo qua ' + dup + '/' + WORKFLOW_SEED_PTKD_ROWS.length + '); '
          + 'theo nhom=' + JSON.stringify(byNhomAdd) + '; TEAM_GROUP_MAP se +[' + teamWillAdd.join(', ') + '].';
  Logger.log(msg);
  return { will_add: willAdd, duplicate: dup, total: WORKFLOW_SEED_PTKD_ROWS.length, by_nhom_add: byNhomAdd, team_map_will_add: teamWillAdd, message: msg };
}

// Nạp catalog PTKD/QLDM + fix team map. Idempotent.
function seedWorkflowCatalogPTKD() {
  ensureWorkflowSheets_();
  var teamAdded = _seedPtkdTeamGroupMap_();

  var sheet = getOrCreateSheet_(SHEETS.WORKFLOW);
  var existing = readSheetAsObjects_(SHEETS.WORKFLOW);
  var seen = {}, maxId = 0;
  existing.forEach(function (r) {
    seen[_ptkdWfKey_(r.Nhom, r.Workflow, r.UseCase)] = true;
    var m = /^WFC-(\d+)$/.exec(String(r.Catalog_ID || '').trim());
    if (m) { var n = parseInt(m[1], 10); if (n > maxId) maxId = n; }
  });

  var now = new Date().toISOString();
  var out = [];
  WORKFLOW_SEED_PTKD_ROWS.forEach(function (r) {
    var key = _ptkdWfKey_(r[0], r[1], r[2]);
    if (seen[key]) return;
    seen[key] = true;
    maxId++;
    out.push(['WFC-' + String(maxId).padStart(4, '0'), r[0], r[1], r[2], true, now]);
  });
  if (out.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, out.length, WORKFLOW_HEADERS.length).setValues(out);
  }

  var msg = '[PTKD seed] Da them ' + out.length + ' US (bo trung ' + (WORKFLOW_SEED_PTKD_ROWS.length - out.length) + '/' + WORKFLOW_SEED_PTKD_ROWS.length + '); '
          + 'TEAM_GROUP_MAP +' + teamAdded.length + ' [' + teamAdded.join(', ') + '].';
  Logger.log(msg);
  return { seeded: out.length, skipped: WORKFLOW_SEED_PTKD_ROWS.length - out.length, team_map_added: teamAdded, message: msg };
}
