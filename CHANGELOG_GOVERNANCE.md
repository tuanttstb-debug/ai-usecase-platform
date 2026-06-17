# CHANGELOG — AI Governance Upgrade

## v3.0.0 — 2026-06-17 — AI Governance & Performance Management Platform

### 🎯 Mục tiêu
Chuyển đổi từ **AI Use Case Submission Portal** thành **AI Governance + AI Performance Management Platform** theo yêu cầu từ Leadership.

### Business Context
Leadership feedback:
- "We do not see proper reporting for AI Use Cases."
- "We need to know quality. We need to evaluate scalability."
- "We need Top and Bottom ranking."
- "We need measurable reward and punishment."
- "Every task must have execution plan."

---

### Backend Changes

#### Config.gs
- **+30 new HEADERS** added (appended after `JSON_Backup` — backward compat preserved)
- **+8 new constants blocks**: `USECASE_CATEGORIES`, `REVIEW_STATUS`, `RANK`, `SCORE_THRESHOLDS`, `SCORE_WEIGHTS`, `OVERDUE_DAYS_THRESHOLD`, `BOTTOM_PERFORMER_THRESHOLD`
- Version bumped to `3.0.0` in health endpoint

#### ScoringEngine.gs (NEW)
- `computeAutoScore_()` — 70pt auto-scoring
- `calcEfficiencyScore_()`, `calcAdoptionScore_()`, `calcReuseScore_()`, `calcFrequencyScore_()`, `calcDocumentationScore_()`
- `computeManualScore_()` — 30pt manual scoring
- `scoreUseCase_()` — combined scoring + rank category
- `getRankCategory_()` — threshold-based rank assignment
- `recalculateAllScores_()` — batch recalculate
- `recalculateRankings_()` — center/dept/category ranking + reward/warning flags

#### UseCaseService.gs
- `createUseCase_()` — now hooks `scoreUseCase_()` before sheet write
- `updateUseCase_()` — now hooks `scoreUseCase_()` in merge step

#### AdminService.gs
- `listUseCases_()` — extended return object with 14 new governance fields
- `getLeaderboard_()` — NEW: top/bottom/category ranking
- `submitWeeklyUpdate_()` — NEW: weekly progress update + re-score
- `submitSelfAssessment_()` — NEW: Layer 1 review
- `submitManagerReview_()` — NEW: Layer 2 review with manual scores

#### DashboardService.gs
- `computeDashboardSummary_()` — upgraded with:
  - `top_performers` (top 10)
  - `bottom_performers` (bottom 10)
  - `usecase_category_breakdown`
  - `rank_breakdown`
  - `avg_score_by_team`
  - `total_hours_saved_actual`
  - `standardized_count`
  - `high_impact_cases`
  - `reward_eligible_list`
  - `warning_list`

#### WeeklyReportService.gs (NEW)
- `getWeeklyReport_()` — weekly governance report with team stats, overdue, blocked, no-update use cases
- Helper: `buildScoreItem_()`, `buildProgressItem_()`, `getWeekStart_()`

#### Code.gs
- 8 new routes added: `weekly-report`, `leaderboard`, `weekly-update`, `self-assessment`, `manager-review`, `score-recalc`, `rank-recalc`

---

### Frontend Changes

#### config/routes.js
- `+7 new API route builders`: weeklyReport, leaderboard, weeklyUpdate, selfAssessment, managerReview, scoreRecalc, rankRecalc

#### assets/js/constants.js
- `FIELDS` extended with 25 new governance field names
- `RANK_LABELS` — display mapping for rank categories
- `USECASE_CATEGORIES` — list of valid categories
- `CATEGORY_LABELS` — Vietnamese display labels

#### assets/js/api.js
- 7 new governance API methods
- `jsonp()` — callback-style JSONP for simpler pages
- `currentUser()` — convenience method

#### dashboard.html
- Sidebar: added Governance section with Leaderboard, Weekly Update, Manager Review nav items

#### leaderboard.html (NEW)
- Top/Bottom performer tables
- Category-based ranking
- Filter by category + team
- Score bars + rank badges

#### weekly-update.html (NEW)
- Use case picker (filtered by current user)
- Progress slider + weekly update form
- Usage metrics input (monthly count, hours saved, reuse count)
- Blocker + manager support fields
- Overdue warning display
- Re-score triggered on submission

#### manager-review.html (NEW)
- Admin-only list of use cases pending review
- Inline review form: Quality/Business/Innovation sliders
- UseCase_Category classification
- Escalate to committee checkbox

---

### New Documentation Files
- `AI_GOVERNANCE_ARCHITECTURE.md`
- `SCORING_ENGINE_DESIGN.md`
- `LEADERBOARD_LOGIC.md`
- `REVIEW_WORKFLOW.md`
- `CHANGELOG_GOVERNANCE.md`

---

### Preserved (not broken)
- Form wizard 4-step flow
- localStorage autosave
- Duplicate detection
- Edit mode
- Activity log
- Existing API contracts (create, update, list, approve, reject, users, lookup)
- All existing 63 HEADERS columns (new columns appended)
