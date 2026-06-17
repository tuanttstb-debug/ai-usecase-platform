# REVIEW WORKFLOW
## Multi-Layer Review Model v3.0

---

## Tổng quan 4 lớp

```
Layer 1: Self Assessment (20% weight)
         ↓
Layer 2: Manager / Team Lead Review (20% weight)
         ↓ (90% use cases)            ↓ (10% exceptional cases)
Layer 3: System Auto Score (50%)    Layer 4: Committee Review (10%)
         ↓
      Finalized
```

## Review Status Flow

```
[Submit Use Case]
      │
      ▼
Review_Status = "Pending_Review"
      │
      │ User tự đánh giá (Self Assessment)
      ▼
Review_Status = "Manager_Review"
      │
      │ Manager nhập Quality / Business Value / Innovation score
      │ Manager phân loại UseCase_Category
      │
      ├─── Đặc biệt (escalate_to_committee = true)
      │         ↓
      │   Review_Status = "Committee_Review"
      │         │
      │         │ Hội đồng nhập Committee_Review_Score
      │         ↓
      │   Review_Status = "Finalized"
      │
      └─── Thông thường
                ↓
          Review_Status = "Finalized"
                │
                ▼
          Total_Score được cập nhật đầy đủ
          (Auto 70% + Manual 30%)
```

## Automation Rule (Phase 9)

```
80% use cases → không cần Committee Review → Manager Review xong → Finalized
10% use cases → escalate lên Committee     → Manager đánh dấu escalate
10% use cases → auto-flag khi:
  - Total_Score < 30 (nghi vấn data quality)
  - Self_Assessment_Score vs Auto_Score chênh lệch > 40pt
```

## Layer Weights (cho báo cáo, không dùng trong Total_Score)

| Layer | Weight | Dùng để |
|---|---|---|
| Self Assessment (Layer 1) | 20% | Accountability, commitment |
| Manager Review (Layer 2) | 20% | Ground-truth validation |
| System Auto (Layer 3) | 50% | Objective metrics |
| Committee (Layer 4) | 10% | Exception handling |

**Lưu ý:** `Total_Score = Auto_Score + Manual_Score`. Các weight ở trên là organizational policy, không phải công thức toán học. `Manual_Score` đại diện cho Layer 2+4; `Auto_Score` đại diện cho Layer 3.

## Endpoints

| Endpoint | Ai dùng |
|---|---|
| `GET ?action=self-assessment + payload` | Người đăng ký use case |
| `GET ?action=manager-review + payload` | Admin / Team Lead |
| `GET ?action=weekly-update + payload` | Người đăng ký, mỗi tuần |

## Pages

| Page | Người dùng |
|---|---|
| `weekly-update.html` | Tất cả users (cập nhật tiến độ + usage) |
| `manager-review.html` | Chỉ Admin (nhập manual scores, phân loại) |

## Operational Notes

- **Manager Review** yêu cầu `reviewer_email` là admin username (check `isAdminEmail_()`)
- **Self Assessment** không yêu cầu auth (user gửi username của họ)
- **Backward compat:** Use case cũ không có Review_Status → được xem như `Pending_Review`
- **Finalized ≠ Approved:** Review_Status chỉ track review flow, `Status` track approval workflow riêng
