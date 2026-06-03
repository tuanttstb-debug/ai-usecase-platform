var APP_CONFIG = {
  // URL GAS Web App — KHÔNG có trailing slash
  // Cập nhật mỗi khi deploy lại GAS (mỗi lần "New Deployment" sẽ ra URL mới)
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbyHFiodUS7xr4cuaEmrKYyZAjGUZ3FUvMB7AEH04ms_G_oR4xah1TzOMeB0qjuRzKQULg/exec',
  VERSION: '1.0.0',
  AUTO_SAVE_KEY:    'ai_usecase_draft',
  DUPLICATE_THRESHOLD: 0.8,

  // Danh sách username (không phải email) được cấp quyền admin
  // Thêm/xóa username ở đây để cấp/thu hồi quyền (không cần sửa logic)
  // Lưu ý: kiểm tra phía frontend (UI-level). Backend GAS có validation riêng.
  ADMIN_EMAILS: ['cuongvm1', 'tuantt4', 'dunglq1'],

  // sessionStorage key — lưu email admin trong phiên làm việc (legacy, kept for backward compat)
  ADMIN_SESSION_KEY: 'ai_admin_email',

  // sessionStorage key — lưu full user object {email, displayName, role, loginAt}
  USER_SESSION_KEY: 'ai_user_session'
};
