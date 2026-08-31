# SCORING ENGINE DESIGN
## ScoringEngine.gs — 100-point AI Use Case Scoring Model

---

## Tổng quan

Mô hình điểm 100 điểm chia thành 2 phần:

```
TOTAL_SCORE (100pt) = AUTO_SCORE (70pt) + MANUAL_SCORE (30pt)
```

**AUTO_SCORE** (70pt) — hệ thống tự tính dựa trên dữ liệu thực tế:

| Component | Max | Công thức |
|---|---|---|
| Efficiency Score | 20pt | `(Before - After) / Before × 20` |
| Adoption Score | 20pt | Theo `Active_User_Count` (bậc) |
| Reuse Score | 20pt | Theo `Reuse_Level` (bậc) |
| Frequency Score | 15pt | Theo `Monthly_Usage_Count` (bậc) |
| Documentation Score | 5pt | Kiểm tra prompt/guide/demo/flow |

**MANUAL_SCORE** (30pt) — reviewer nhập:

| Component | Max | Nhập bởi |
|---|---|---|
| Quality Score | 10pt | Manager Review (Layer 2) |
| Business Value Score | 10pt | Manager Review (Layer 2) |
| Innovation Score | 10pt | Manager Review (Layer 2) |

---

## Chi tiết Auto Score

### 1. Efficiency Score (max 20pt)
```
ratio = (Before_Time_Min - After_Time_Min) / Before_Time_Min
score = clamp(ratio, 0, 1) × 20
```
- Yêu cầu: `Before_Time_Min > 0`
- Không có dữ liệu → 0pt
- Tiết kiệm 50% thời gian → 10pt
- Tiết kiệm 100% → 20pt (lý thuyết)

### 2. Adoption Score (max 20pt)
| Điều kiện | Điểm |
|---|---|
| `Active_User_Count >= 20` | 20pt |
| `Active_User_Count 6-19` | 15pt |
| `Active_User_Count 2-5` | 10pt |
| `Active_User_Count = 1` | 5pt |
| `Active_User_Count = 0` | 0pt |

### 3. Reuse Score (max 20pt)
| Phạm vi | Điểm |
|---|---|
| Toàn TT SPTD / Center | 20pt |
| Cross-team / Team khác | 15pt |
| Cùng team / Nội bộ team | 10pt |
| Cá nhân / Personal | 5pt |
| Không có hoặc không xác định | 0pt |

### 4. Frequency Score (max 15pt)
| Tần suất | `Monthly_Usage_Count` | Điểm |
|---|---|---|
| Hàng ngày | ≥ 20 lần/tháng | 15pt |
| Hàng tuần | 4-19 lần/tháng | 8pt |
| Hiếm | 1-3 lần/tháng | 2pt |
| Không có dữ liệu | 0 | Estimate từ `Active_User_Count` |

### 5. Documentation Score (max 5pt)
| Kiểm tra | Điểm |
|---|---|
| Có ít nhất 1 Prompt field | +2pt |
| Có Usage Guide | +1pt |
| Có Demo (không phải "Chưa có") | +1pt |
| `Flow_Description` đủ dài (>50 ký tự) | +1pt |

---

## Rank Category

| Điểm | Hạng |
|---|---|
| 85-100 | `TOP_PERFORMER` |
| 70-84 | `STRONG_CONTRIBUTOR` |
| 50-69 | `AVERAGE` |
| <50 | `BOTTOM_PERFORMER` |

---

## Khi nào scoring được trigger

1. **On Create** — `createUseCase_()` gọi `scoreUseCase_()` sau khi build object, trước khi ghi sheet
2. **On Update** — `updateUseCase_()` gọi `scoreUseCase_()` sau khi merge data mới
3. **On Weekly Update** — `submitWeeklyUpdate_()` re-score sau khi ghi usage data mới
4. **On Manager Review** — `submitManagerReview_()` re-score với manual scores mới
5. **Manual recalc** — Admin gọi `GET ?action=score-recalc&admin_email=...`

---

## Notes

- **Auto Score bảo thủ khi thiếu data:** Nếu chưa có `Monthly_Usage_Count`, hệ thống estimate từ `Active_User_Count` + `Demo_Status` — luôn ở mức thấp nhất có thể để tránh inflate điểm.
- **Manual Score mặc định 0:** Cho đến khi reviewer nhập, Manual Score = 0, Total Score = Auto Score.
- **Scoring không block write:** `scoreUseCase_()` được gọi trong try/catch — nếu lỗi, record vẫn được ghi (không có score), không crash request.
- **Backward compat:** Các record cũ (trước v3.0) sẽ có `Total_Score = 0` cho đến khi admin chạy `score-recalc`.
