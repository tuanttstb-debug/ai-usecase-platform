// routes.js — URL builder cho GAS API
// Tự động strip trailing slash để tránh /exec/?action= (404)
var _gasBase = (APP_CONFIG.API_BASE_URL || '').replace(/\/+$/, '');

var API = {
  lookup:         () => `${_gasBase}?action=lookup`,
  getUseCase:     (id) => `${_gasBase}?action=usecase&id=${encodeURIComponent(id)}`,
  create:         () => `${_gasBase}?action=create`,
  update:         () => `${_gasBase}?action=update`,
  duplicateCheck: () => `${_gasBase}?action=duplicate-check`,
  dashboard:      () => `${_gasBase}?action=dashboard`,
  health:         () => `${_gasBase}?action=health`,
  nextId:         () => `${_gasBase}?action=next-id`,

  // Dashboard: list use cases với optional filters
  list: (filters) => {
    var url = _gasBase + '?action=list';
    if (filters) {
      if (filters.filter)      url += '&filter='      + encodeURIComponent(filters.filter);
      if (filters.status)      url += '&status='      + encodeURIComponent(filters.status);
      if (filters.team)        url += '&team='        + encodeURIComponent(filters.team);
      if (filters.owner_login) url += '&owner_login=' + encodeURIComponent(filters.owner_login);
      if (filters.owner_name)  url += '&owner_name='  + encodeURIComponent(filters.owner_name);
      // gửi limit cả khi =0 (0 = "lấy tất cả", không cắt)
      if (filters.limit != null && filters.limit !== '')
        url += '&limit=' + encodeURIComponent(filters.limit);
    }
    return url;
  },

  // Approval endpoints (payload qua JSONP base64)
  approve: () => `${_gasBase}?action=approve`,
  reject:  () => `${_gasBase}?action=reject`,

  // Auth dùng chung với SHTD (H2) — username + password, trả token HMAC
  authLogin:          () => `${_gasBase}?action=auth-login`,
  authChangePassword: () => `${_gasBase}?action=auth-change-password`,

  // Workflow catalog endpoints (H2 Giai đoạn 2)
  workflowCatalog: (team) => {
    var url = `${_gasBase}?action=workflow-catalog`;
    if (team) url += '&team=' + encodeURIComponent(team);
    return url;
  },
  workflowList:    () => `${_gasBase}?action=workflow-list`,
  workflowUpsert:  () => `${_gasBase}?action=workflow-upsert`,
  workflowDelete:  () => `${_gasBase}?action=workflow-delete`,
  workflowRename:  () => `${_gasBase}?action=workflow-rename`,

  // User — CHỈ ĐỌC (nguồn duy nhất = User_Master trên SHTD; quản lý user làm ở SHTD-Dashboard)
  users:      ()         => `${_gasBase}?action=users`,

  // Governance v3.0 endpoints
  weeklyReport:   (weekStart) => {
    var url = `${_gasBase}?action=weekly-report`;
    if (weekStart) url += '&week_start=' + encodeURIComponent(weekStart);
    return url;
  },
  leaderboard: (filters) => {
    var url = `${_gasBase}?action=leaderboard`;
    if (filters) {
      if (filters.category) url += '&category=' + encodeURIComponent(filters.category);
      if (filters.team)     url += '&team='     + encodeURIComponent(filters.team);
      if (filters.limit)    url += '&limit='    + encodeURIComponent(filters.limit);
    }
    return url;
  },
  weeklyUpdate:   () => `${_gasBase}?action=weekly-update`,
  weeklyLog:      (recordId) => `${_gasBase}?action=weekly-log&record_id=${encodeURIComponent(recordId)}`,

  // Milestone approval endpoints (v3.14.0)
  milestoneList:   (filter) => `${_gasBase}?action=milestone-list&filter=${encodeURIComponent(filter || 'pending')}`,
  milestoneApprove:() => `${_gasBase}?action=milestone-approve`,
  milestoneReject: () => `${_gasBase}?action=milestone-reject`,
  selfAssessment: () => `${_gasBase}?action=self-assessment`,
  managerReview:  () => `${_gasBase}?action=manager-review`,
  scoreRecalc:    () => `${_gasBase}?action=score-recalc`,
  rankRecalc:     () => `${_gasBase}?action=rank-recalc`,
  championReview: () => `${_gasBase}?action=champion-review`,

  // ── H2 Giai đoạn 3: chấm điểm mới (hội đồng US + cá nhân) ──────────
  councilScoreSubmit: () => `${_gasBase}?action=council-score-submit`,
  councilScoreList:   (recordId) => `${_gasBase}?action=council-score-list&record_id=${encodeURIComponent(recordId)}`,
  councilProgress:    () => `${_gasBase}?action=council-progress`,
  personalScoreSubmit:() => `${_gasBase}?action=personal-score-submit`,
  personalScoreList:  (team) => {
    var url = `${_gasBase}?action=personal-score-list`;
    if (team) url += '&team=' + encodeURIComponent(team);
    return url;
  },
  h2Leaderboard:      (filters) => {
    var url = `${_gasBase}?action=h2-leaderboard`;
    if (filters) {
      if (filters.team)  url += '&team='  + encodeURIComponent(filters.team);
      if (filters.limit) url += '&limit=' + encodeURIComponent(filters.limit);
    }
    return url;
  },
  kpiLeaderboard:     (filters) => {
    var url = `${_gasBase}?action=kpi-leaderboard`;
    if (filters && filters.team) url += '&team=' + encodeURIComponent(filters.team);
    return url;
  }
};
