/* ─────────────────────────────────────────
   FIELDS — tên cột Google Sheets (KHÔNG đổi — ảnh hưởng API contract)
   ───────────────────────────────────────── */
var FIELDS = {
  // ── Form fields (existing — do NOT rename) ───────────────────
  WORKFLOW:            'Workflow',          // H2 Giai đoạn 2 — chọn trước UseCase_Name
  USE_CASE_NAME:       'UseCase_Name',
  OWNER_NAME:          'Owner_Name',
  OWNER_EMAIL:         'Owner_Email',
  TEAM:                'Team',
  BUSINESS_CATEGORY:   'Business_Category',
  CURRENT_STAGE:       'Current_Stage',
  PAIN_POINT:          'Pain_Point',
  CURRENT_PROCESS:     'Current_Process',
  CURRENT_TIME_MIN:    'Current_Time_Min',
  CURRENT_PROBLEM:     'Current_Problem',
  USER_TYPE:           'User_Type',
  EXPECTED_GOALS:      'Expected_Goals',
  FLOW_DESC:           'Flow_Description',
  INPUT_TYPES:         'Input_Types',
  PROMPT_ROLE:         'Prompt_Role',
  PROMPT_TASK:         'Prompt_Task',
  PROMPT_GOAL:         'Prompt_Goal',
  PROMPT_CONTEXT:      'Prompt_Context',
  PROMPT_INPUT:        'Prompt_Input',
  PROMPT_STEPS:        'Prompt_Steps',
  PROMPT_OUTPUT_FORMAT:'Prompt_Output_Format',
  PROMPT_EVALUATION:   'Prompt_Evaluation',
  DEMO_STATUS:         'Demo_Status',
  DEMO_LINK:           'Demo_Link',
  BEFORE_TIME_MIN:     'Before_Time_Min',
  AFTER_TIME_MIN:      'After_Time_Min',
  QUALITY_IMPROVEMENT: 'Quality_Improvement',
  IMPROVEMENT_NOTE:    'Improvement_Note',
  REUSE_LEVEL:         'Reuse_Level',
  REUSE_ADJUSTMENT:    'Reuse_Adjustment',
  WHEN_TO_USE:         'When_To_Use',
  USAGE_STEPS:         'Usage_Steps',
  USAGE_NOTES:         'Usage_Notes',

  // ── Governance v3.0 — Execution fields ──────────────────────
  USECASE_CATEGORY:    'UseCase_Category',
  EXECUTION_PLAN:      'Execution_Plan',
  PLANNED_START:       'Planned_Start_Date',
  PLANNED_END:         'Planned_End_Date',
  CURRENT_PROGRESS:    'Current_Progress',
  WEEKLY_UPDATE:       'Weekly_Update',
  NEXT_MILESTONE:      'Next_Milestone',
  BLOCKER:             'Blocker',
  MANAGER_SUPPORT:     'Manager_Support',
  LAST_WEEKLY_REPORT:  'Last_Weekly_Report',

  // ── Governance v3.0 — Scoring (read-only for UI) ────────────
  EFFICIENCY_SCORE:    'Efficiency_Score',
  ADOPTION_SCORE_CALC: 'Adoption_Score_Calc',
  REUSE_SCORE:         'Reuse_Score',
  FREQUENCY_SCORE:     'Frequency_Score',
  DOCUMENTATION_SCORE: 'Documentation_Score',
  AUTO_SCORE:          'Auto_Score',
  BUSINESS_VALUE_SCORE:'Business_Value_Score',
  QUALITY_SCORE:       'Quality_Score',
  INNOVATION_SCORE:    'Innovation_Score',
  MANUAL_SCORE:        'Manual_Score',
  TOTAL_SCORE:         'Total_Score',
  RANK_CATEGORY:       'Rank_Category',

  // ── Governance v3.0 — Performance ───────────────────────────
  ACTIVE_USER_COUNT:   'Active_User_Count',   // nguồn điểm Adoption
  MONTHLY_USAGE_COUNT: 'Monthly_Usage_Count', // nguồn điểm Frequency
  HOURS_SAVED_ACTUAL:  'Hours_Saved_Actual',
  REUSE_COUNT_TRACKED: 'Reuse_Count_Tracked',
  DEPT_RANKING:        'Department_Ranking',
  CENTER_RANKING:      'Center_Ranking',
  CATEGORY_RANKING:    'Category_Ranking',
  REWARD_ELIGIBLE:     'Reward_Eligible',
  WARNING_FLAG:        'Warning_Flag',

  // ── Governance v3.0 — Review workflow ────────────────────────
  REVIEW_STATUS:             'Review_Status',
  SELF_ASSESSMENT_SCORE:     'Self_Assessment_Score',
  MANAGER_REVIEW_SCORE:      'Manager_Review_Score',
  COMMITTEE_REVIEW_SCORE:    'Committee_Review_Score',
  REVIEW_COMMITTEE_COMMENT:  'Review_Committee_Comment'
};

// ── Stage constants (S1–S4 lifecycle) ────────────────────────────

var STAGE_ORDER = ['S1 - Idea', 'S2 - Pilot', 'S3 - Standardized', 'S4 - Scale'];

var STAGE_LABELS = {
  'S1 - Idea':          { short: 'S1 · Ý tưởng',  color: '#6D6D7A', bg: '#F5F5F7' },
  'S2 - Pilot':         { short: 'S2 · Pilot',     color: '#2196F3', bg: '#E3F2FD' },
  'S3 - Standardized':  { short: 'S3 · Chuẩn hóa', color: '#4CAF50', bg: '#E8F5E9' },
  'S4 - Scale':         { short: 'S4 · Scale',     color: '#7B2CBF', bg: '#F5F0FF' }
};

// Checklist cứng — tất cả items phải được tick trước khi cho phép nâng stage
// Key = stage ĐÍCH (stage muốn chuyển TỚI)
var STAGE_CRITERIA = {
  'S2 - Pilot': [
    { id: 's2c1', text: 'Đã thử nghiệm thực tế ít nhất 1 lần' },
    { id: 's2c2', text: '% hoàn thành ≥ 20% (khai báo trong slider bên trên)' },
    { id: 's2c3', text: 'Đã mô tả rào cản và milestone tiếp theo' },
    { id: 's2c4', text: 'Đã nhập số lần sử dụng thực tế trong tháng' }
  ],
  'S3 - Standardized': [
    { id: 's3c1', text: 'Đã pilot với ít nhất 3 người trong team' },
    { id: 's3c2', text: 'Monthly Usage ≥ 5 lần (khai báo trong form bên trên)' },
    { id: 's3c3', text: 'Đã có quy trình hoặc hướng dẫn bàn giao cho đồng nghiệp' },
    { id: 's3c4', text: '% hoàn thành ≥ 50% (khai báo trong slider bên trên)' }
  ],
  'S4 - Scale': [
    { id: 's4c1', text: 'Đang được dùng ở ít nhất 1 team ngoài team gốc' },
    { id: 's4c2', text: 'Monthly Usage ≥ 10 lần (khai báo trong form bên trên)' },
    { id: 's4c3', text: 'Đã điền Kế hoạch scale-up và Rủi ro khi scale bên dưới' },
    { id: 's4c4', text: '% hoàn thành ≥ 80% (khai báo trong slider bên trên)' }
  ]
};

// ── Governance constants (mirrored from GAS Config.gs) ──────────
var RANK_LABELS = {
  TOP_PERFORMER:      { label: 'Top Performer',      color: '#4CAF50', bg: '#E8F5E9' },
  STRONG_CONTRIBUTOR: { label: 'Strong Contributor',  color: '#2196F3', bg: '#E3F2FD' },
  AVERAGE:            { label: 'Trung bình',          color: '#F6B100', bg: '#FFF8E1' },
  BOTTOM_PERFORMER:   { label: 'Cần cải thiện',       color: '#F44336', bg: '#FFEBEE' }
};

var USECASE_CATEGORIES = [
  'PRODUCTIVITY', 'ANALYSIS', 'AUTOMATION', 'KNOWLEDGE', 'ADVANCED_AI'
];

var CATEGORY_LABELS = {
  PRODUCTIVITY: 'Năng suất cá nhân',
  ANALYSIS:     'Phân tích & Review',
  AUTOMATION:   'Tự động hóa',
  KNOWLEDGE:    'Quản lý tri thức',
  ADVANCED_AI:  'AI nâng cao'
};

/* ─────────────────────────────────────────
   STEPS — cấu trúc wizard 4 bước
   ───────────────────────────────────────── */
var STEPS = [
  {
    id: 1,
    title: 'Thông tin nghiệp vụ',
    shortTitle: 'Nghiệp vụ',
    subtitle: 'Mô tả bài toán cần giải quyết bằng AI',
    fields: [
      FIELDS.WORKFLOW,
      FIELDS.USE_CASE_NAME,
      FIELDS.OWNER_NAME,
      FIELDS.TEAM,
      // CR2a (2026-08-31): BUSINESS_CATEGORY (Lĩnh vực) đã bỏ khỏi form đăng ký.
      FIELDS.CURRENT_STAGE,       // ← Stage S1-S4
      FIELDS.PAIN_POINT,
      FIELDS.CURRENT_PROCESS,
      FIELDS.CURRENT_TIME_MIN,
      FIELDS.CURRENT_PROBLEM,
      FIELDS.USER_TYPE,
      FIELDS.EXPECTED_GOALS
    ]
  },
  {
    id: 2,
    title: 'Luồng AI & Prompt',
    shortTitle: 'AI & Prompt',
    subtitle: 'Mô tả cách AI xử lý bài toán',
    fields: [
      FIELDS.FLOW_DESC,
      FIELDS.INPUT_TYPES,
      FIELDS.PROMPT_ROLE,
      FIELDS.PROMPT_TASK,
      FIELDS.PROMPT_GOAL,
      FIELDS.PROMPT_CONTEXT,
      FIELDS.PROMPT_INPUT,
      FIELDS.PROMPT_STEPS,
      FIELDS.PROMPT_OUTPUT_FORMAT,
      FIELDS.PROMPT_EVALUATION
    ]
  },
  {
    id: 3,
    title: 'Demo & Tái sử dụng',
    shortTitle: 'Demo',
    subtitle: 'Đánh giá hiệu quả và khả năng nhân rộng',
    fields: [
      FIELDS.DEMO_STATUS,
      FIELDS.DEMO_LINK,
      FIELDS.BEFORE_TIME_MIN,
      FIELDS.AFTER_TIME_MIN,
      FIELDS.ACTIVE_USER_COUNT,
      FIELDS.MONTHLY_USAGE_COUNT,
      FIELDS.QUALITY_IMPROVEMENT,
      FIELDS.IMPROVEMENT_NOTE,
      FIELDS.REUSE_LEVEL,
      FIELDS.REUSE_ADJUSTMENT
    ]
  },
  {
    id: 4,
    title: 'Hướng dẫn sử dụng',
    shortTitle: 'Hướng dẫn',
    subtitle: 'Giúp đồng nghiệp tái sử dụng use case này',
    fields: [
      FIELDS.WHEN_TO_USE,
      FIELDS.USAGE_STEPS,
      FIELDS.USAGE_NOTES
    ]
  }
];

/* ─────────────────────────────────────────
   GROUP_CONFIG — nhóm field trong mỗi step
   ───────────────────────────────────────── */
var GROUP_CONFIG = {
  identity: { label: 'Thông tin cơ bản' },
  problem:  { label: 'Vấn đề nghiệp vụ' },
  audience: { label: 'Đối tượng & Mục tiêu' },
  flow:     { label: null },
  prompt:   {
    label: 'Thiết kế Prompt',
    collapsible: true,
    collapsed: true,
    hint: 'Mở rộng nếu đã có prompt — hoặc điền sau'
  },
  demo:     { label: 'Trạng thái Demo' },
  impact:   { label: 'Đánh giá tác động' },
  reuse:    { label: 'Tái sử dụng' },
  guide:    { label: null }
};

/* ─────────────────────────────────────────
   FIELD_CONFIG — metadata UI từng field
   lookupKey phải khớp với key trong window.__LOOKUP
   (sau khi GAS đã map CATEGORY→fieldName)
   ───────────────────────────────────────── */
var FIELD_CONFIG = {

  /* ── STEP 1: Thông tin nghiệp vụ ── */

  Workflow: {
    label: 'Workflow',
    type: 'select',
    required: true,
    wfRole: 'workflow',          // H2: cascade nạp options từ window.__WF_CATALOG
    helper: 'Chọn workflow phù hợp — danh sách lọc theo Team của bạn + Workflow chung',
    group: 'identity'
  },
  UseCase_Name: {
    label: 'Use Case',
    type: 'select',
    required: true,
    wfRole: 'usecase',           // H2: options phụ thuộc Workflow đã chọn; có "Khác — nhập tự do"
    placeholder: 'VD: Tóm tắt nội dung email khách hàng bằng AI',
    helper: 'Chọn từ danh mục theo Workflow, hoặc "Khác — nhập tự do" để đăng ký US mới',
    group: 'identity'
  },
  Owner_Name: {
    label: 'Người đăng ký',
    type: 'text',
    required: true,
    placeholder: 'Họ và tên đầy đủ',
    group: 'identity'
  },
  Team: {
    label: 'Team',
    type: 'select',
    required: true,
    lookupKey: 'Team',          // GAS map TEAM → Team
    group: 'identity'
  },
  Business_Category: {
    label: 'Lĩnh vực nghiệp vụ',
    type: 'select',
    required: true,
    lookupKey: 'Business_Category',
    group: 'identity'
  },
  Current_Stage: {              // ← THÊM MỚI
    label: 'Giai đoạn (Stage)',
    type: 'select',
    lookupKey: 'Current_Stage', // GAS map STAGE → Current_Stage
    helper: 'Tự đánh giá use case đang ở giai đoạn nào trong lộ trình AI',
    group: 'identity'
  },

  Pain_Point: {
    label: 'Điểm đau nghiệp vụ',
    type: 'textarea',
    required: true,
    rows: 3,
    placeholder: 'Mô tả vấn đề đang gặp phải: tốn thời gian, dễ sai sót, khó chuẩn hóa...',
    helper: 'Hãy mô tả cụ thể vấn đề khiến bạn tìm đến AI',
    group: 'problem'
  },
  Current_Process: {
    label: 'Quy trình hiện tại',
    type: 'textarea',
    required: true,
    rows: 4,
    placeholder: 'Bước 1: ...\nBước 2: ...\nBước 3: ...',
    helper: 'Mô tả các bước thực hiện thủ công hiện tại',
    group: 'problem'
  },
  Current_Time_Min: {
    label: 'Thời gian xử lý hiện tại',
    type: 'number',
    placeholder: '60',
    helper: 'Thời gian trung bình để hoàn thành một lần',
    suffix: 'phút',
    group: 'problem'
  },
  Current_Problem: {
    label: 'Hệ quả / Rủi ro',
    type: 'textarea',
    rows: 3,
    placeholder: 'Sai sót xảy ra như thế nào? Chi phí ẩn, rủi ro nghiệp vụ là gì?',
    group: 'problem'
  },

  User_Type: {
    label: 'Đối tượng sử dụng',
    type: 'checkbox',
    lookupKey: 'User_Type',
    group: 'audience'
  },
  Expected_Goals: {
    label: 'Mục tiêu kỳ vọng',
    type: 'checkbox',
    lookupKey: 'Expected_Goals', // GAS map GOAL → Expected_Goals
    group: 'audience'
  },

  /* ── STEP 2: Luồng AI & Prompt ── */

  Flow_Description: {
    label: 'Mô tả luồng xử lý AI',
    type: 'textarea',
    required: true,
    rows: 4,
    placeholder: 'Bước 1: Người dùng nhập [dữ liệu]\nBước 2: AI xử lý [như thế nào]\nBước 3: Kết quả trả về [dạng gì]',
    helper: 'Mô tả end-to-end từ đầu vào đến kết quả đầu ra của AI',
    group: 'flow'
  },
  Input_Types: {
    label: 'Loại dữ liệu đầu vào',
    type: 'checkbox',
    lookupKey: 'Input_Types',
    group: 'flow'
  },

  Prompt_Role: {
    label: 'Vai trò AI (Role)',
    type: 'textarea',
    rows: 2,
    placeholder: 'Bạn là một chuyên gia phân tích tài chính với 10 năm kinh nghiệm...',
    helper: 'Định nghĩa "nhân vật" AI sẽ đóng vai trong ngữ cảnh này',
    group: 'prompt'
  },
  Prompt_Task: {
    label: 'Nhiệm vụ cụ thể (Task)',
    type: 'textarea',
    rows: 3,
    placeholder: 'Hãy đọc và tóm tắt nội dung email sau đây...',
    helper: 'Lệnh chính mà AI cần thực hiện',
    group: 'prompt'
  },
  Prompt_Goal: {
    label: 'Mục tiêu đầu ra (Goal)',
    type: 'textarea',
    rows: 2,
    placeholder: 'Tóm tắt ngắn gọn (3–5 bullet), nêu rõ yêu cầu chính, tone phù hợp...',
    helper: 'Tiêu chuẩn của một kết quả tốt',
    group: 'prompt'
  },
  Prompt_Context: {
    label: 'Ngữ cảnh bổ sung (Context)',
    type: 'textarea',
    rows: 2,
    placeholder: 'Đây là email khách hàng VIP. Giọng điệu cần chuyên nghiệp...',
    helper: 'Thông tin bối cảnh giúp AI hiểu đúng tình huống',
    group: 'prompt'
  },
  Prompt_Input: {
    label: 'Mô tả đầu vào (Input)',
    type: 'textarea',
    rows: 2,
    placeholder: 'Đầu vào là một đoạn email tiếng Việt, độ dài 200–500 từ...',
    helper: 'Mô tả format và đặc điểm của dữ liệu đầu vào',
    group: 'prompt'
  },
  Prompt_Steps: {
    label: 'Các bước xử lý (Steps)',
    type: 'textarea',
    rows: 4,
    placeholder: 'Bước 1: Đọc toàn bộ nội dung\nBước 2: Xác định yêu cầu chính\nBước 3: Tóm tắt theo cấu trúc...',
    helper: 'Chain of thought — hướng dẫn AI suy nghĩ từng bước',
    group: 'prompt'
  },
  Prompt_Output_Format: {
    label: 'Định dạng đầu ra (Output)',
    type: 'textarea',
    rows: 3,
    placeholder: '**Tóm tắt:** [1–2 câu]\n**Yêu cầu chính:** [bullet list]\n**Mức độ khẩn:** [Cao/Trung/Thấp]',
    helper: 'Định nghĩa cấu trúc output mong muốn (markdown, JSON, bullet...)',
    group: 'prompt'
  },
  Prompt_Evaluation: {
    label: 'Tiêu chí đánh giá (Evaluation)',
    type: 'textarea',
    rows: 3,
    placeholder: 'Kết quả tốt khi: (1) Tóm tắt đủ ý chính, (2) Không bỏ sót yêu cầu, (3) Ngôn ngữ phù hợp...',
    helper: 'Khi nào bạn biết AI đã làm tốt?',
    group: 'prompt'
  },

  /* ── STEP 3: Demo & Tái sử dụng ── */

  Demo_Status: {
    label: 'Trạng thái demo',
    type: 'select',
    options: ['Chưa có', 'Đã có demo', 'Đã triển khai thử', 'Đã triển khai chính thức'],
    group: 'demo'
  },
  Demo_Link: {
    label: 'Link demo / tài liệu',
    type: 'text',
    placeholder: 'https://... hoặc http://localhost:...',
    helper: 'Link video demo, slide, bản thử nghiệm — chấp nhận cả link nội bộ/localhost',
    conditional: { field: 'Demo_Status', notValue: 'Chưa có' },
    group: 'demo'
  },
  Before_Time_Min: {
    label: 'Thời gian trước khi có AI',
    type: 'number',
    placeholder: '60',
    suffix: 'phút',
    group: 'impact'
  },
  After_Time_Min: {
    label: 'Thời gian sau khi có AI',
    type: 'number',
    placeholder: '10',
    suffix: 'phút',
    helper: 'Hệ thống sẽ tự tính % tiết kiệm thời gian',
    group: 'impact'
  },
  Active_User_Count: {
    label: 'Số người dùng thực tế',
    type: 'number',
    placeholder: '0',
    suffix: 'người',
    helper: 'Số người đang thực sự dùng use case này. Điền ước lượng khi đăng ký; cập nhật số thực qua "Cập nhật tuần". Dùng để chấm điểm Adoption (Người dùng).',
    group: 'impact'
  },
  Monthly_Usage_Count: {
    label: 'Tần suất sử dụng',
    type: 'number',
    placeholder: '0',
    suffix: 'lần/tháng',
    helper: 'Số lần use case được dùng mỗi tháng. Điền ước lượng khi đăng ký; cập nhật số thực qua "Cập nhật tuần". Dùng để chấm điểm Frequency (Tần suất).',
    group: 'impact'
  },
  Quality_Improvement: {
    label: 'Cải thiện chất lượng',
    type: 'textarea',
    rows: 2,
    placeholder: 'Giảm sai sót từ 15% xuống 2%, chuẩn hóa output...',
    group: 'impact'
  },
  Improvement_Note: {
    label: 'Ghi chú thêm về hiệu quả',
    type: 'textarea',
    rows: 3,
    placeholder: 'Nhận xét định tính từ người dùng, phản hồi từ khách hàng...',
    group: 'impact'
  },
  Reuse_Level: {
    label: 'Phạm vi tái sử dụng',
    type: 'checkbox',
    lookupKey: 'Reuse_Level',   // GAS map REUSE → Reuse_Level
    group: 'reuse'
  },
  Reuse_Adjustment: {
    label: 'Hướng dẫn điều chỉnh khi tái sử dụng',
    type: 'textarea',
    rows: 3,
    placeholder: 'Khi áp dụng cho team khác, cần thay đổi: [phần nào], vì [lý do]...',
    group: 'reuse'
  },

  /* ── STEP 4: Hướng dẫn sử dụng ── */

  When_To_Use: {
    label: 'Khi nào nên dùng use case này?',
    type: 'textarea',
    rows: 3,
    placeholder: 'Dùng khi: cần tóm tắt nhanh email, có ít nhất 1 email >200 chữ...',
    group: 'guide'
  },
  Usage_Steps: {
    label: 'Hướng dẫn thực hiện từng bước',
    type: 'textarea',
    rows: 5,
    placeholder: 'Bước 1: Copy nội dung email\nBước 2: Mở Claude / ChatGPT\nBước 3: Paste prompt + nội dung\nBước 4: Đọc kết quả, chỉnh sửa nếu cần',
    helper: 'Hướng dẫn cụ thể để đồng nghiệp có thể tự làm được ngay',
    group: 'guide'
  },
  Usage_Notes: {
    label: 'Lưu ý & hạn chế',
    type: 'textarea',
    rows: 3,
    placeholder: 'Không dùng cho email có thông tin bảo mật. Kết quả cần review trước khi gửi...',
    group: 'guide'
  }
};
