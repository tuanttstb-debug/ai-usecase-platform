// ─────────────────────────────────────────────────────────────────
// Config.gs — Hằng số toàn cục cho toàn bộ GAS project
// ─────────────────────────────────────────────────────────────────

// ── Google Sheet ID ───────────────────────────────────────────────
var SPREADSHEET_ID = '1xLMQLTgj2sRf1l9C6s6AHCT5zWJLQOofL375t8Pv_NA';

// ── Sheet Names ───────────────────────────────────────────────────
var SHEETS = {
  MASTER:    'MASTER_DATA',    // Bảng chính chứa toàn bộ use case
  LOOKUP:    'LOOKUP',         // Dropdown options (Field / Value)
  ACTIVITY:  'ACTIVITY_LOG',   // Audit trail
  DASHBOARD: 'DASHBOARD_READY',// Pre-aggregated dashboard cache
  CONFIG:    'CONFIG'          // System config (NEXT_ID counter, v.v.)
};

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
  'Similarity_Score', 'Duplicate_Flag', 'Edit_Version', 'JSON_Backup'
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
