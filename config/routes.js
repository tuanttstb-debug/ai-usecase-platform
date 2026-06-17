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
      if (filters.filter) url += '&filter='  + encodeURIComponent(filters.filter);
      if (filters.status) url += '&status='  + encodeURIComponent(filters.status);
      if (filters.team)   url += '&team='    + encodeURIComponent(filters.team);
      if (filters.limit)  url += '&limit='   + encodeURIComponent(filters.limit);
    }
    return url;
  },

  // Approval endpoints (payload qua JSONP base64)
  approve: () => `${_gasBase}?action=approve`,
  reject:  () => `${_gasBase}?action=reject`,

  // User management endpoints
  userLogin:  (username) => `${_gasBase}?action=user-login&username=${encodeURIComponent(username)}`,
  users:      ()         => `${_gasBase}?action=users`,
  userUpsert: ()         => `${_gasBase}?action=user-upsert`,
  userSync:   ()         => `${_gasBase}?action=user-sync`,
  userInit:   ()         => `${_gasBase}?action=user-init`,

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
  selfAssessment: () => `${_gasBase}?action=self-assessment`,
  managerReview:  () => `${_gasBase}?action=manager-review`,
  scoreRecalc:    () => `${_gasBase}?action=score-recalc`,
  rankRecalc:     () => `${_gasBase}?action=rank-recalc`
};
