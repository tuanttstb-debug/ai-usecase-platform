// ─────────────────────────────────────────────────────────────────
// Config.gs — Hằng số toàn cục cho toàn bộ GAS project
// ─────────────────────────────────────────────────────────────────

// ── Google Sheet ID ───────────────────────────────────────────────
var SPREADSHEET_ID = '1xLMQLTgj2sRf1l9C6s6AHCT5zWJLQOofL375t8Pv_NA';

// ── Sheet Names ───────────────────────────────────────────────────
var SHEETS = {
  MASTER:      'MASTER_DATA',    // Bảng chính chứa toàn bộ use case
  LOOKUP:      'LOOKUP',         // Dropdown options (Field / Value)
  ACTIVITY:    'ACTIVITY_LOG',   // Audit trail
  DASHBOARD:   'DASHBOARD_READY',// Pre-aggregated dashboard cache
  CONFIG:      'CONFIG',         // System config (NEXT_ID counter, v.v.)
  WEEKLY_LOG:  'WEEKLY_LOG',     // Lịch sử cập nhật tiến độ tuần (1 row/lần submit)
  WORKFLOW:    'WORKFLOW_CATALOG',// H2 Giai đoạn 2: danh mục Workflow → Use case (droplist đăng ký)
  TEAM_GROUP:  'TEAM_GROUP_MAP', // H2 Giai đoạn 2: map Team → Nhóm workflow được thấy
  UC_COUNCIL:  'UC_COUNCIL_SCORE',// H2 Giai đoạn 3: điểm US do hội đồng teamlead chấm (1 row/reviewer/UC)
  PERSONAL:    'PERSONAL_SCORE', // H2 Giai đoạn 3: điểm cá nhân do teamlead chấm (1 row/member, cuối kỳ)
  UC_REUSE:    'UC_REUSE'        // H2 (T05/M05): xác nhận tái dùng UC (1 row/người-tái-dùng/UC) → lan tỏa M-KPI-4
};

// ── WORKFLOW_CATALOG Column Headers (H2 Giai đoạn 2) ───────────────
// Mỗi row = 1 Use case thuộc 1 Workflow thuộc 1 Nhóm.
// Catalog_ID: khóa ổn định (WFC-NNNN) để sửa/xóa không lệ thuộc vị trí row.
// UseCase có thể để trống → biểu diễn 1 Workflow chưa có US (vẫn hiện ở droplist Workflow).
// Active=FALSE → ẩn khỏi droplist đăng ký nhưng vẫn giữ để đối chiếu.
var WORKFLOW_HEADERS = [
  'Catalog_ID', 'Nhom', 'Workflow', 'UseCase', 'Active', 'Updated_At'
];

// ── TEAM_GROUP_MAP Column Headers (H2 Giai đoạn 2) ─────────────────
// Map Team → Nhóm workflow. Mọi user luôn thấy '1. Workflow chung';
// cộng thêm Nhóm ứng với Team của mình. Admin sửa trực tiếp trong sheet.
var TEAM_GROUP_HEADERS = ['Team', 'Nhom'];

// Nhóm 'chung' — mọi user đều thấy (không phụ thuộc Team).
var WORKFLOW_COMMON_GROUP = '1. Workflow chung';

// Seed mặc định cho TEAM_GROUP_MAP. Admin sửa được trong sheet.
// 2026-08-18: Team Số tách riêng khỏi PO → nhóm '4. Workflow đặc thù Số hóa tín dụng'
// (xem WorkflowSeedTeamSo.gs). CV/BL vẫn ở nhóm PO.
var TEAM_GROUP_SEED = [
  ['Số',      '4. Workflow đặc thù Số hóa tín dụng'],
  ['CV',      '2. Workflow đặc thù PO'],
  ['BL',      '2. Workflow đặc thù PO'],
  ['PTKD MB', '3. Workflow PTKD & QLDM'],
  ['PTKD MN', '3. Workflow PTKD & QLDM'],
  ['QLDM',    '3. Workflow PTKD & QLDM']
];

// ── MASTER_DATA Column Headers ────────────────────────────────────
// QUAN TRỌNG: Thứ tự này phải khớp chính xác với hàng đầu tiên của sheet MASTER_DATA.
// Không được đổi thứ tự hoặc xóa cột nếu sheet đã có dữ liệu.
var HEADERS = [
  // Metadata hệ thống
  'Record_ID', 'UseCase_ID', 'Created_At', 'Updated_At', 'Submit_Date',
  // Workflow
  'Status', 'Current_Stage', 'Reviewer', 'Review_Date', 'Review_Comment',
  'Priority', 'AI_Day_Flag', 'AI_Day_Date',
  // Thông tin cơ bản (Step 1)
  'UseCase_Name', 'Owner_Name', 'Owner_Email', 'Team', 'Business_Category',
  'Co_Owner', 'Department', 'Pain_Point', 'Current_Process', 'Current_Time_Min',
  'Current_Problem', 'User_Type', 'Expected_Goals',
  // Luồng AI (Step 2)
  'Flow_Description', 'Input_Types',
  'Prompt_Role', 'Prompt_Task', 'Prompt_Goal', 'Prompt_Context', 'Prompt_Input',
  'Prompt_Steps', 'Prompt_Output_Format', 'Prompt_Evaluation',
  // Demo & ROI (Step 3)
  'Demo_Status', 'Demo_Link', 'Before_Time_Min', 'After_Time_Min',
  'Estimated_Time_Saving', 'Quality_Improvement', 'Improvement_Note',
  // Tái sử dụng (Step 3)
  'Reuse_Level', 'Reuse_Adjustment', 'Cross_Team_Flag', 'Reuse_Count',
  'Active_User_Count', 'Last_Used_Date', 'Adoption_Score', 'Standardized_Flag',
  // Hướng dẫn (Step 4)
  'When_To_Use', 'Usage_Steps', 'Usage_Notes',
  // Impact metrics (tính toán tự động hoặc reviewer nhập)
  'Estimated_Hours_Saved_Month', 'Estimated_Cost_Impact', 'Business_Value',
  'Scale_Potential', 'Risk_Level', 'Leadership_Support_Needed',
  // Dedup & versioning
  'Similarity_Score', 'Duplicate_Flag', 'Edit_Version', 'JSON_Backup',

  // ── GOVERNANCE v3.0 — Execution Tracking ─────────────────────────
  'UseCase_Category',        // PRODUCTIVITY / ANALYSIS / AUTOMATION / KNOWLEDGE / ADVANCED_AI
  'Execution_Plan',          // Mô tả kế hoạch triển khai
  'Planned_Start_Date',      // Ngày dự kiến bắt đầu
  'Planned_End_Date',        // Ngày dự kiến hoàn thành
  'Current_Progress',        // % hoàn thành (0-100)
  'Weekly_Update',           // Cập nhật tuần gần nhất
  'Next_Milestone',          // Milestone tiếp theo
  'Blocker',                 // Rào cản hiện tại
  'Manager_Support',         // Hỗ trợ cần từ quản lý
  'Last_Weekly_Report',      // Ngày cập nhật tuần gần nhất (ISO)

  // ── GOVERNANCE v3.0 — Scoring Engine ─────────────────────────────
  'Efficiency_Score',        // Auto: (before-after)/before * 20, max 20
  'Adoption_Score_Calc',     // Auto: dựa theo Active_User_Count, max 20
  'Reuse_Score',             // Auto: dựa theo Reuse_Level, max 20
  'Frequency_Score',         // Auto: dựa theo Monthly_Usage_Count, max 15
  'Documentation_Score',     // Auto: kiểm tra prompt+guide+demo+examples, max 5 (note: 70-total=5 leftover)
  'Auto_Score',              // Tổng auto score (70 điểm tối đa)
  'Business_Value_Score',    // Manual: 0-10
  'Quality_Score',           // Manual: 0-10
  'Innovation_Score',        // Manual: 0-10
  'Manual_Score',            // Tổng manual score (30 điểm tối đa)
  'Total_Score',             // Auto_Score + Manual_Score (100 điểm)
  'Rank_Category',           // TOP_PERFORMER / STRONG_CONTRIBUTOR / AVERAGE / BOTTOM_PERFORMER
  'Score_Updated_At',        // Thời điểm tính điểm gần nhất

  // ── GOVERNANCE v3.0 — Performance Tracking ───────────────────────
  'Monthly_Usage_Count',     // Số lần sử dụng trong tháng
  'Hours_Saved_Actual',      // Giờ tiết kiệm thực tế (do người dùng báo cáo)
  'Reuse_Count_Tracked',     // Số lần đã tái sử dụng thực tế
  'Department_Ranking',      // Xếp hạng trong phòng/team
  'Center_Ranking',          // Xếp hạng toàn trung tâm
  'Category_Ranking',        // Xếp hạng trong cùng UseCase_Category
  'Reward_Eligible',         // TRUE/FALSE — đủ điều kiện khen thưởng
  'Warning_Flag',            // TRUE/FALSE — cờ cảnh báo hiệu suất thấp

  // ── GOVERNANCE v3.0 — Multi-Layer Review ─────────────────────────
  'Review_Status',           // Pending_Review / Manager_Review / Committee_Review / Finalized
  'Self_Assessment_Score',   // Layer 1: tự đánh giá (20%)
  'Manager_Review_Score',    // Layer 2: quản lý đánh giá (20%)
  'Committee_Review_Score',  // Layer 4: hội đồng đánh giá (10%)
  'Review_Committee_Comment',// Nhận xét hội đồng

  // ── H2 Giai đoạn 2 — Nhập liệu theo Workflow ─────────────────────
  // Thêm CUỐI bảng để ensureSheetColumns_(SHEETS.MASTER, HEADERS) self-heal không lệch cột cũ.
  'Workflow',                // Workflow lớn user chọn khi đăng ký (từ WORKFLOW_CATALOG hoặc 'Khác')
  'Workflow_Group'           // Nhóm workflow tương ứng (1/2/3), suy ra từ catalog lúc đăng ký
];

// ── WEEKLY_LOG Column Headers ─────────────────────────────────────
// Mỗi lần user submit weekly-update tạo 1 row mới.
// MASTER_DATA chỉ giữ giá trị hiện tại (last value); WEEKLY_LOG giữ toàn bộ lịch sử.
var WEEKLY_LOG_HEADERS = [
  'Log_ID', 'Record_ID', 'UseCase_ID', 'Log_Date',
  'Previous_Stage', 'New_Stage', 'Stage_Changed',
  'Progress',
  'Weekly_Update', 'Next_Milestone', 'Blocker', 'Manager_Support',
  'Active_User_Count', 'Monthly_Usage_Count', 'Hours_Saved_Actual', 'Reuse_Count_Tracked',
  'Scale_Plan', 'Scale_Risks',
  'Reporter',
  // ── Milestone approval (v3.14.0) ──────────────────────────────────
  // Một dòng WEEKLY_LOG là "milestone" khi có chuyển Stage hoặc nâng điểm.
  // Milestone phải được Admin duyệt mới áp Stage/điểm lên MASTER + tính KPI.
  'Is_Milestone', 'Milestone_Type', 'Previous_Total_Score', 'Proposed_Total_Score',
  'Approval_Status', 'Approved_By', 'Approved_At', 'Milestone_Comment'
];

// ── ACTIVITY_LOG Column Headers ───────────────────────────────────
var ACTIVITY_HEADERS = [
  'Log_ID', 'UseCase_ID', 'Record_ID', 'Timestamp',
  'Action', 'Details', 'User_Email', 'Previous_Status', 'New_Status'
];

// ── DASHBOARD_READY Column Headers ───────────────────────────────
var DASHBOARD_HEADERS = [
  'Refreshed_At', 'Total', 'Draft', 'Submitted', 'Approved', 'Rejected',
  'Total_Time_Saved_Min', 'Total_Hours_Saved_Month', 'Use_Cases_With_Measurement',
  'Team_Breakdown_JSON', 'Category_Breakdown_JSON', 'Recent_Submissions_JSON'
];

// ── Validation ────────────────────────────────────────────────────
// Các trường bắt buộc khi tạo use case mới
var REQUIRED_FIELDS_CREATE = [
  'UseCase_Name', 'Owner_Name', 'Owner_Email',
  'Team', 'Business_Category',
  'Pain_Point', 'Current_Process',
  'Flow_Description'
];

// Các trường không được phép ghi đè khi update
var PROTECTED_FIELDS = ['Record_ID', 'UseCase_ID', 'Created_At'];

// ── Duplicate Detection ───────────────────────────────────────────
var DUPLICATE_THRESHOLD = 0.8;   // Score >= 0.8 → cảnh báo duplicate
var DUPLICATE_WEIGHT_NAME  = 0.6; // Trọng số tên use case
var DUPLICATE_WEIGHT_PAIN  = 0.4; // Trọng số pain point

// ── Status & Stage Values ─────────────────────────────────────────
var STATUS = {
  DRAFT:     'Draft',
  SUBMITTED: 'Submitted',
  REVIEWING: 'Under Review',
  APPROVED:  'Approved',
  REJECTED:  'Rejected'
};

// Các transition hợp lệ: { from: [allowed_to] }
var STATUS_TRANSITIONS = {
  'Draft':        ['Draft', 'Submitted'],
  'Submitted':    ['Submitted', 'Under Review', 'Approved', 'Rejected'],
  'Under Review': ['Under Review', 'Approved', 'Rejected'],
  'Approved':     ['Approved'],
  'Rejected':     ['Rejected', 'Draft']
};

// ── ID Generation ─────────────────────────────────────────────────
var ID_PREFIX  = 'AIUS-';
var ID_PADDING = 4;       // AIUS-0001 → 4 chữ số
var LOCK_TIMEOUT_MS = 10000; // Thời gian chờ lock tối đa (ms)

// ── Config Sheet Defaults ─────────────────────────────────────────
var CONFIG_DEFAULTS = {
  NEXT_ID: 1
};

// ── Admin Configuration ───────────────────────────────────────────
// Username được phép approve/reject use case (khớp với env.js frontend).
// Auth dùng username, không phải email — xem SESSION_HANDOVER Part 3.
// Ưu tiên đọc từ CONFIG sheet (key: ADMIN_EMAILS, value: user1,user2)
// Fallback về array này nếu CONFIG sheet chưa có entry.
var ADMIN_EMAILS = ['admin', 'tuantt4', 'manager'];

// ── Business Rules ────────────────────────────────────────────────
var WORKING_DAYS_PER_MONTH = 22; // Số ngày làm việc/tháng để ước tính giờ tiết kiệm

// ── Governance v3.0 — UseCase Category ───────────────────────────
var USECASE_CATEGORIES = {
  PRODUCTIVITY:  'PRODUCTIVITY',   // Email writing, summarization
  ANALYSIS:      'ANALYSIS',       // Legal review, BRD review
  AUTOMATION:    'AUTOMATION',     // Excel automation, workflow automation
  KNOWLEDGE:     'KNOWLEDGE',      // Internal chatbot, knowledge retrieval
  ADVANCED_AI:   'ADVANCED_AI'    // Agents, MCP, API orchestration
};

// ── Governance v3.0 — Review Workflow Status ──────────────────────
var REVIEW_STATUS = {
  PENDING:    'Pending_Review',
  MANAGER:    'Manager_Review',
  COMMITTEE:  'Committee_Review',
  FINALIZED:  'Finalized'
};

// ── Milestone Approval Status (v3.14.0) ───────────────────────────
// Trạng thái duyệt của một milestone cập nhật tuần (dòng WEEKLY_LOG).
// N/A     — dòng cập nhật thường (không milestone), không cần duyệt, không tính KPI.
// Pending — milestone chờ Admin duyệt; Stage/điểm đề xuất CHƯA áp lên MASTER.
// Approved— Admin đã duyệt; Stage/điểm đã áp; +1 KPI cho Owner ở tuần Log_Date.
// Rejected— Admin từ chối; không áp gì.
var MILESTONE_STATUS = {
  NA:       'N/A',
  PENDING:  'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
};

// ── Governance v3.0 — Rank Categories ────────────────────────────
var RANK = {
  TOP:      'TOP_PERFORMER',       // 85-100 điểm
  STRONG:   'STRONG_CONTRIBUTOR',  // 70-84 điểm
  AVERAGE:  'AVERAGE',             // 50-69 điểm
  BOTTOM:   'BOTTOM_PERFORMER'     // <50 điểm
};

// ── Governance v3.0 — Scoring Thresholds ─────────────────────────
var SCORE_THRESHOLDS = {
  TOP:    85,
  STRONG: 70,
  AVERAGE: 50
};

// ── Governance v3.0 — Scoring Weights ────────────────────────────
var SCORE_WEIGHTS = {
  EFFICIENCY_MAX:    20,
  ADOPTION_MAX:      20,
  REUSE_MAX:         20,
  FREQUENCY_MAX:     15,
  DOCUMENTATION_MAX:  5,  // 70 total auto
  QUALITY_MANUAL:    10,
  BUSINESS_MANUAL:   10,
  INNOVATION_MANUAL: 10   // 30 total manual
};

// ── Governance v3.0 — Weekly Report ──────────────────────────────
var OVERDUE_DAYS_THRESHOLD    = 7;   // Số ngày không cập nhật → overdue warning
var BOTTOM_PERFORMER_THRESHOLD = 10; // % dưới cùng → committee review bắt buộc

// ══════════════════════════════════════════════════════════════════
// H2 GIAI ĐOẠN 3 — MÔ HÌNH CHẤM ĐIỂM MỚI (thay thế HOÀN TOÀN auto 70/30 + SPTD 80-10-10)
// Nguồn: AI_CONTEXT/H2_PLAN.md §4 + hub binh-dan-hoa-ai-H2/config/kpi_roles.yaml.
// Mọi tiêu chí nhập thang 0–10 (H2_PLAN §6.5), quy đổi về thang 100 qua trọng số.
// ══════════════════════════════════════════════════════════════════

var H2_CRITERIA_MAX = 10;               // Thang nhập mỗi tiêu chí (0–10)

// ── Điểm US — Hội đồng teamlead chấm mỗi UC (3 tiêu chí 30/40/30) ──
// 1 row / (reviewer × UC). Điểm US cuối = bình quân Member_Score các thành viên đã chấm.
var UC_COUNCIL_HEADERS = [
  'Score_ID', 'Record_ID', 'UseCase_ID', 'Reviewer',
  'Time_Saving', 'Automation', 'Creativity',  // 3 tiêu chí, mỗi cái 0–10
  'Member_Score',                              // = Σ(tiêu chí/10 × trọng số) × 100, tối đa 100
  'Comment', 'Scored_At'
];
var H2_UC_WEIGHTS = {
  TIME_SAVING: 0.30,   // Tiết kiệm thời gian
  AUTOMATION:  0.40,   // Mức độ tự động hóa
  CREATIVITY:  0.30    // Tính sáng tạo
};

// ── Điểm cá nhân — Teamlead chấm mỗi thành viên (4 tiêu chí 30/20/30/20) ──
// 1 row / member. Chấm 1 lần cuối kỳ (hạn 31/12/2026). Final = Σ(tiêu chí/10 × trọng số) × 100.
// Final_Score = điểm NĂNG LỰC (M-KPI-2, thang 100). Các cột KPI khác teamlead nhập cùng lúc:
//   Courses_Completed/Courses_Paid → M-KPI-3 · Sharing_Achieved → M-KPI-4 · Milestones_Late → điểm trừ.
var PERSONAL_HEADERS = [
  'Score_ID', 'Username', 'Display_Name', 'Team',
  'Diversity', 'AI_Proficiency', 'Product_Quality', 'Quantity_Met', // 4 tiêu chí 0–10 (M-KPI-2)
  'Final_Score',                                                     // M-KPI-2 (0–100)
  'Courses_Completed', 'Courses_Paid',                              // M-KPI-3: số khóa học (+ trả phí x2)
  'Sharing_Achieved',                                               // M-KPI-4: lan tỏa đạt (TRUE/FALSE)
  'Milestones_Late',                                                // Điểm trừ: số milestone chậm (−2%/mốc)
  'Scored_By', 'Comment', 'Scored_At'
];
var H2_PERSONAL_WEIGHTS = {
  DIVERSITY:       0.30,  // Mức độ đa dạng
  AI_PROFICIENCY:  0.20,  // Thành thạo ứng dụng AI
  PRODUCT_QUALITY: 0.30,  // Chất lượng sản phẩm
  QUANTITY_MET:    0.20   // Số lượng đủ theo yêu cầu (định mức 1 UC duyệt/người/tuần)
};

// Hạn chấm điểm cá nhân cuối kỳ (thông tin — không hard-block server-side ở Đợt 1).
var H2_PERSONAL_DEADLINE = '2026-12-31';

// ── Xác nhận tái dùng UC (T05/M05) → điều kiện (ii) của lan tỏa M-KPI-4 ──
// 1 row / (UC × người tái dùng). Lan tỏa M-KPI-4 = 100 nếu teamlead đánh Sharing_Achieved
// HOẶC member sở hữu ≥1 UC có ≥H2_REUSE_THRESHOLD người khác xác nhận tái dùng.
var UC_REUSE_HEADERS = [
  'Reuse_ID', 'Record_ID', 'UseCase_ID', 'Owner_Username', 'Reused_By', 'Comment', 'Confirmed_At'
];
var H2_REUSE_THRESHOLD = 3;  // ≥3 người tái dùng (khác chủ) → đạt điều kiện lan tỏa (ii)

// ── KPI tổng hợp Member (Đợt 2) — M1..M4 + điểm trừ milestone ──────
// Member final = M1·0.40 + M2·0.30 + M3·0.15 + M4·0.15 − điểm trừ (clamp 0..100).
var H2_KPI_WEIGHTS = {
  UC:         0.40,  // M-KPI-1: điểm US cá nhân (bình quân UC hội đồng chấm)
  CAPABILITY: 0.30,  // M-KPI-2: năng lực ứng dụng (PERSONAL_SCORE.Final_Score)
  COURSES:    0.15,  // M-KPI-3: khóa học
  SHARING:    0.15   // M-KPI-4: lan tỏa
};
var H2_COURSE_TARGET   = 4;    // 4 khóa = 100%
var H2_COURSE_PCT_EACH = 25;   // mỗi khóa 25% (khóa trả phí tính x2)
var H2_MILESTONE_PENALTY_EACH = 2;   // −2% / milestone chậm
var H2_MILESTONE_PENALTY_MAX  = 10;  // tổng trừ tối đa −10%

// ── KPI Teamlead (Đợt 2) — 60/40 ──────────────────────────────────
var H2_TEAMLEAD_WEIGHTS = { SELF: 0.60, TEAM: 0.40 };
var H2_KPI_PASS = 70;  // ngưỡng "đạt KPI cá nhân" cho T-KPI-2 (% thành viên ≥70%)

// ── KPI PM (Đợt 2) — bản A đã chốt (D10 hub) 30/20/30/20 ──────────
// A1 (KPI cá nhân PM) + A2 (bình quân toàn TT) tính tự động; A3 (milestone Action Plan) +
// A4 (đóng góp hệ sinh thái, checklist) nhập tay (dữ liệu ở SHTD/hub).
var H2_PM_WEIGHTS = { A1: 0.30, A2: 0.20, A3: 0.30, A4: 0.20 };
