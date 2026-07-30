// ─────────────────────────────────────────────────────────────────
// Config.gs — Hằng số toàn cục cho toàn bộ GAS project
// ─────────────────────────────────────────────────────────────────

// ── Google Sheet ID ───────────────────────────────────────────────
var SPREADSHEET_ID = '1xLMQLTgj2sRf1l9C6s6AHCT5zWJLQOofL375t8Pv_NA';

// ── Sheet Names ───────────────────────────────────────────────────
var SHEETS = {
  MASTER:     'MASTER_DATA',    // Bảng chính chứa toàn bộ use case
  LOOKUP:     'LOOKUP',         // Dropdown options (Field / Value)
  ACTIVITY:   'ACTIVITY_LOG',   // Audit trail
  DASHBOARD:  'DASHBOARD_READY',// Pre-aggregated dashboard cache
  CONFIG:     'CONFIG',         // System config (NEXT_ID counter, v.v.)
  USERS:      'USERS',          // Danh sách user và phân quyền
  WEEKLY_LOG: 'WEEKLY_LOG'      // Lịch sử cập nhật tiến độ tuần (1 row/lần submit)
};

// ── USERS Sheet Column Headers ────────────────────────────────────
// Username: normalized lowercase — primary key, case-insensitive lookup
// Role:     'admin' hoặc 'user'
// Active:   TRUE/FALSE — deactivate không cần xóa row
var USERS_HEADERS = [
  'Username', 'Display_Name', 'Role', 'Team', 'Email', 'Active', 'Created_At', 'Last_Login'
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
  'Review_Committee_Comment' // Nhận xét hội đồng
];

// ── WEEKLY_LOG Column Headers ─────────────────────────────────────
// Mỗi lần user submit weekly-update tạo 1 row mới.
// MASTER_DATA chỉ giữ giá trị hiện tại (last value); WEEKLY_LOG giữ toàn bộ lịch sử.
var WEEKLY_LOG_HEADERS = [
  'Record_ID', 'UseCase_ID', 'Log_Date',
  'Previous_Stage', 'New_Stage', 'Stage_Changed',
  'Progress',
  'Weekly_Update', 'Next_Milestone', 'Blocker', 'Manager_Support',
  'Active_User_Count', 'Monthly_Usage_Count', 'Hours_Saved_Actual', 'Reuse_Count_Tracked',
  'Scale_Plan', 'Scale_Risks',
  'Reporter'
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
