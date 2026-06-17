# AI GOVERNANCE ARCHITECTURE
## AI Governance + Performance Management Platform — v3.0

---

## Tổng quan chuyển đổi

| | v1.0 / v2.x | v3.0 (Current) |
|---|---|---|
| Tên hệ thống | AI Use Case Submission Portal | AI Governance & Performance Management Platform |
| Mục tiêu | Thu thập use case | Đo lường đóng góp AI thực tế |
| Đầu ra chính | Form đăng ký | Ranking + Score + Weekly Report |
| Tự động hóa | ~10% | ~80% |
| Review model | Manual (admin trong Sheets) | Multi-layer (tự đánh giá → manager → system → hội đồng) |

---

## Kiến trúc tổng thể v3.0

```
┌──────────────────────────────────────────────────────────────────────┐
│                    BROWSER LAYER (Static SPA)                        │
│                                                                       │
│  Pages:                                                               │
│  ┌─────────────┐ ┌─────────────────┐ ┌──────────────────────┐        │
│  │ register.html│ │ weekly-update.  │ │   leaderboard.html   │        │
│  │ (existing)  │ │ html (NEW)      │ │   (NEW)              │        │
│  └─────────────┘ └─────────────────┘ └──────────────────────┘        │
│  ┌──────────────────────┐ ┌──────────────────────────────────┐        │
│  │ dashboard.html       │ │ manager-review.html (NEW)        │        │
│  │ (UPGRADED)          │ └──────────────────────────────────┘        │
│  └──────────────────────┘                                             │
│                                                                       │
│  JS Modules:                                                          │
│  constants.js (+ FIELDS, RANK_LABELS, CATEGORY_LABELS)               │
│  api.js       (+ jsonp(), governance methods)                         │
│  routes.js    (+ weekly-report, leaderboard, weekly-update, etc.)     │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ JSONP (GET + base64url payload)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 GOOGLE APPS SCRIPT LAYER (v3.0)                       │
│                                                                       │
│  Code.gs             ← Router (+ 8 new governance routes)             │
│  Config.gs           ← Constants (+ 30 new headers, scoring weights)  │
│  UseCaseService.gs   ← CRUD + AUTO-SCORE on create/update             │
│  AdminService.gs     ← Approval + Leaderboard + Review workflow       │
│  ScoringEngine.gs    ← NEW: 70pt auto-score + rank categorization     │
│  DashboardService.gs ← UPGRADED: top/bottom/category/reward/warning   │
│  WeeklyReportService.gs ← NEW: weekly governance report               │
│  LoggerService.gs    ← Audit trail (existing)                         │
│  LookupService.gs    ← Dropdown lookup (existing)                     │
│  Utils.gs            ← Sheet helpers (existing)                       │
│  UserService.gs      ← User management (existing)                     │
│  ValidationService.gs← Server-side validation (existing)              │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ SpreadsheetApp API
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS (Database)                           │
│                                                                       │
│  MASTER_DATA    ← 93+ columns (63 existing + 30 governance new)      │
│  LOOKUP         ← Dropdown options (existing)                         │
│  ACTIVITY_LOG   ← Audit trail (existing)                              │
│  DASHBOARD_READY← Pre-aggregated dashboard cache (upgraded)           │
│  CONFIG         ← System config (existing)                            │
│  USERS          ← User & role management (existing)                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## New GAS Files Summary

| File | Purpose | Key Functions |
|---|---|---|
| `ScoringEngine.gs` | 100-point auto-scoring engine | `scoreUseCase_()`, `recalculateAllScores_()`, `recalculateRankings_()` |
| `WeeklyReportService.gs` | Weekly governance report | `getWeeklyReport_()` |

## New GAS Endpoints (v3.0)

| Action | Method | Description |
|---|---|---|
| `weekly-report` | GET | Báo cáo tuần: team stats, overdue, blocked, top/bottom |
| `leaderboard` | GET | Xếp hạng: top/bottom/by-category, filters |
| `weekly-update` | GET+payload | Người dùng cập nhật tiến độ + số liệu |
| `self-assessment` | GET+payload | Tự đánh giá (Layer 1) |
| `manager-review` | GET+payload | Quản lý review + nhập manual scores |
| `score-recalc` | GET | Admin: recalculate tất cả scores |
| `rank-recalc` | GET | Admin: recalculate rankings + reward/warning flags |

---

## Data Model Changes (MASTER_DATA — New Columns)

### Group: UseCase Category
- `UseCase_Category` — PRODUCTIVITY / ANALYSIS / AUTOMATION / KNOWLEDGE / ADVANCED_AI

### Group: Execution Governance
- `Execution_Plan`, `Planned_Start_Date`, `Planned_End_Date`
- `Current_Progress` (0-100%), `Weekly_Update`, `Next_Milestone`
- `Blocker`, `Manager_Support`, `Last_Weekly_Report`

### Group: Scoring Engine (auto-computed)
- `Efficiency_Score` (max 20), `Adoption_Score_Calc` (max 20)
- `Reuse_Score` (max 20), `Frequency_Score` (max 15), `Documentation_Score` (max 5)
- `Auto_Score` (sum, max 70)
- `Business_Value_Score` (max 10), `Quality_Score` (max 10), `Innovation_Score` (max 10)
- `Manual_Score` (sum, max 30), `Total_Score` (max 100)
- `Rank_Category`, `Score_Updated_At`

### Group: Performance Tracking
- `Monthly_Usage_Count`, `Hours_Saved_Actual`, `Reuse_Count_Tracked`
- `Department_Ranking`, `Center_Ranking`, `Category_Ranking`
- `Reward_Eligible`, `Warning_Flag`

### Group: Multi-Layer Review
- `Review_Status` — Pending_Review / Manager_Review / Committee_Review / Finalized
- `Self_Assessment_Score`, `Manager_Review_Score`, `Committee_Review_Score`
- `Review_Committee_Comment`

---

## Automation Level

| Process | Manual Before | Automated v3.0 |
|---|---|---|
| Scoring | 100% manual | 70% auto (ScoringEngine.gs) |
| Ranking | Manual sort in Sheets | Auto: Center/Dept/Category ranking |
| Reward flag | Manual check | Auto: top 20% → Reward_Eligible |
| Warning flag | None | Auto: bottom 10% → Warning_Flag |
| Weekly report | None | API: GET ?action=weekly-report |
| Overdue detection | None | Auto: Last_Weekly_Report check |
| Blocked detection | None | Auto: Blocker field non-empty |
| Dashboard refresh | Manual | 30-min TTL cache + time trigger |
