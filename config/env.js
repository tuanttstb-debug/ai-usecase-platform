var APP_CONFIG = {
  // URL GAS Web App — KHÔNG có trailing slash
  // Cập nhật mỗi khi deploy lại GAS (mỗi lần "New Deployment" sẽ ra URL mới)
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbypN8afAl2zQwpR7K6k1-699g3HAhFAIqAOtDn3qY1nJWzuN1bd8n99bzRUzaV8ZMyTCw/exec',
  VERSION: '1.0.0',
  AUTO_SAVE_KEY:    'ai_usecase_draft',
  DUPLICATE_THRESHOLD: 0.8,

  // Fallback admin (cứu hộ) — nguồn role DUY NHẤT là User_Master trên SHTD (Role=Admin).
  // List này chỉ là dự phòng offline phía GAS (Config.gs ADMIN_EMAILS, priority cuối); FE không resolve role từ đây.
  ADMIN_EMAILS: ['cuongvm1', 'tuantt4', 'dunglq1'],

  // Hội đồng chấm điểm US (H2) — 4 teamlead. Điểm US = bình quân điểm hội đồng.
  // GAS đối chiếu song song qua Script Property COUNCIL_USERS.
  COUNCIL_USERS: ['tuantt4', 'maittt7', 'tutv3', 'quynhnny'],

  // Danh sách username bị loại khỏi theo dõi KPI (VD: Giám đốc, quản lý cấp cao)
  KPI_EXCLUDED_USERS: ['cuongvm1'],

  // sessionStorage key — lưu email admin trong phiên làm việc (legacy, kept for backward compat)
  ADMIN_SESSION_KEY: 'ai_admin_email',

  // sessionStorage key — lưu full user object {email, displayName, role, loginAt}
  USER_SESSION_KEY: 'ai_user_session',

  // Ngày bắt đầu chương trình AI Use Case (cố định để tính điểm SPTD)
  PROGRAM_START_DATE: '2026-06-01',

  // Danh sách username bị loại khỏi bảng điểm SPTD (Giám đốc, quản lý cấp cao)
  SPTD_EXCLUDED_USERS: ['cuongvm1']
};
