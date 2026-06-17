# LEADERBOARD LOGIC

## Ranking Methodology

### Center Ranking (toàn trung tâm)
- Sắp xếp tất cả use case theo `Total_Score` giảm dần
- `Center_Ranking = 1` = use case có điểm cao nhất toàn TT
- Tính lại mỗi khi `rank-recalc` được gọi hoặc sau mỗi manager review

### Department Ranking (trong team)
- Group theo `Team`
- Sort theo `Total_Score` trong mỗi team
- `Department_Ranking = 1` = điểm cao nhất trong team đó

### Category Ranking (cùng loại use case)
- Group theo `UseCase_Category`
- So sánh use case cùng loại (PRODUCTIVITY vs PRODUCTIVITY, không lẫn với ANALYSIS)
- Đảm bảo fairness: ADVANCED_AI thường complex hơn PRODUCTIVITY nên không so sánh chung

## Reward / Warning Flags

```
total_count = tổng số use case có Total_Score > 0
reward_cutoff = ceil(total_count × 0.2)   // Top 20%
warn_cutoff   = floor(total_count × 0.9)  // Bottom 10%

Reward_Eligible = TRUE  nếu Center_Ranking <= reward_cutoff
Warning_Flag    = TRUE  nếu Center_Ranking >  warn_cutoff
```

**Ví dụ với 50 use cases:**
- Top 20% = 10 use case → `Reward_Eligible = TRUE` cho rank 1-10
- Bottom 10% = 5 use case → `Warning_Flag = TRUE` cho rank 46-50

## Endpoint: GET ?action=leaderboard

```
Parameters:
  category = UseCase_Category filter (optional, default: all)
  team     = Team filter (optional, default: all)
  limit    = số items per bucket (default: 20)

Response:
  top_performers:     [top N use cases overall]
  bottom_performers:  [bottom N use cases overall]
  category_rankings:  { PRODUCTIVITY: [...], ANALYSIS: [...], ... }
  total_ranked:       int
  filter_category:    string
  filter_team:        string
```

## UI: leaderboard.html

- **Tab "Top Performers"** — bảng xếp hạng cao nhất (top 20)
- **Tab "Cần cải thiện"** — bottom performers có Warning_Flag
- **Tab "Theo Category"** — top 5 mỗi category + mini-table

Filter controls:
- Category dropdown (PRODUCTIVITY / ANALYSIS / AUTOMATION / KNOWLEDGE / ADVANCED_AI)
- Team dropdown (dynamic từ data)

## Automation

`recalculateRankings_()` — GAS function, nên setup time-trigger chạy hàng ngày:
1. Mở GAS project → Triggers → Add Trigger
2. Function: `recalculateRankings_` (wrapper cần thêm trong Code.gs hoặc ScoringEngine.gs)
3. Time-driven: Day timer → Every day (midnight)
