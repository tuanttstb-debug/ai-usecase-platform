# TECH DEBT

Mức độ ưu tiên: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## ✅ RESOLVED in v2.1.0 (2026-05-28 Part 2)

BUG-A, BUG-B, BUG-C, BUG-04, SMELL-03, SMELL-04 — xem `AI_CONTEXT/SESSION_HANDOVER.md` (Part 2) để biết chi tiết.

---

## ✅ RESOLVED in v2.0.0-ui (2026-05-28)

BUG-01, BUG-02, BUG-05, BUG-06, SMELL-05, MAINT-03, MAINT-04, MAINT-05, MAINT-06 — xem `CHANGELOG_UI.md` để biết chi tiết fix.

---

## 🔴 BUGS THỰC SỰ (sẽ gây hành vi sai)

### ~~[BUG-01] Progress bar không hoạt động~~
**File:** `assets/css/wizard.css` + `assets/js/wizard.js:64`  
**Vấn đề:**
- CSS animate `width` trên `.progress-bar::after` (pseudo-element)
- JS set `document.getElementById('progressBar').style.width` trên element cha (`.progress-bar`)
- Kết quả: thanh tiến trình không bao giờ di chuyển

> ✅ **Resolved v2.0.0-ui — FIX-01:** Thêm `<div class="progress-fill" id="progressBar">` bên trong `.progress-track`. JS set width trên fill element.

---

### ~~[BUG-02] `populateData()` gọi trước khi form render~~
**File:** `assets/js/app.js:17`  
**Vấn đề:** Trong edit mode:
```javascript
FormMapper.populateData(data);  // ← form elements CHƯA tồn tại
// ...
Wizard.init();                  // ← form mới được render ở đây
```
`populateData()` tìm `form.querySelector('[name="..."]')` → không thấy → bỏ qua tất cả data → form edit luôn trống.

> ✅ **Resolved v2.0.0-ui — FIX-02:** Đổi thứ tự trong `app.js::init()`: `Wizard.init()` → `Api.getUseCase()` → `FormMapper.populateData()`.

---

### [BUG-03] Status luôn là "Draft" sau khi tạo mới
**File:** `assets/js/app.js:63` vs `assets/gas-backend/UseCaseService.gs:55`  
**Vấn đề:**
- Frontend: `data.Status = 'Submitted'` rồi POST
- Backend: `obj.Status = 'Draft'` luôn override (bất kể frontend gửi gì)
- Kết quả: use case mới tạo luôn ở "Draft", không bao giờ "Submitted"

**Cần làm rõ:** Đây là design intent (Draft → Submitted là bước riêng) hay là bug? Nếu là bug, xóa dòng override trong UseCaseService.gs.

> ⏳ **Pending clarification:** Cần xác nhận với PO — xem `AI_CONTEXT/TODO_NEXT.md` P2.

---

### ~~[BUG-04] Update không có server-side validation~~
**File:** `assets/gas-backend/ValidationService.gs:15` + `UseCaseService.gs:64`  
**Vấn đề:** `validateUpdate_()` được định nghĩa nhưng `updateUseCase_()` không gọi. Mọi update đều bypass validation.

> ✅ **Resolved v2.1.0:** Đã được fix trong codebase hiện tại — `UseCaseService.gs:145` gọi `validateUpdate_(data)` với comment `// FIX: thực sự gọi validateUpdate_`.

---

### ~~[BUG-05] Toast hiển thị HTML thô trong error message~~
**File:** `assets/js/app.js:50` + `assets/js/toast.js:6`  
**Vấn đề:**
```javascript
Toast.show(errors.join('<br>'), 'error');  // app.js - join với <br>
// nhưng toast.js dùng:
toast.textContent = message;  // textContent sẽ render "<br>" như text literal
```
Kết quả: user thấy "Tên Use Case không được để trống`<br>`Email không hợp lệ" thay vì xuống dòng.

> ✅ **Resolved v2.0.0-ui — FIX-03:** Đổi `join('\n')` + `white-space: pre-line` trong `toast.js`.

---

### ~~[BUG-06] EXPECTED_GOALS xử lý trùng lặp trong FieldBuilder~~
**File:** `assets/js/wizard.js:126-142`  
**Vấn đề:**
```javascript
if (name === FIELDS.USER_TYPE || name === FIELDS.INPUT_TYPES 
    || name === FIELDS.EXPECTED_GOALS || name === FIELDS.REUSE_LEVEL) {
  // ← EXPECTED_GOALS được handle ở đây (checkbox group)
} else if (name === FIELDS.EXPECTED_GOALS) {
  // ← Dead code: không bao giờ reach được
}
```
`EXPECTED_GOALS` trong `else if` là dead code.

> ✅ **Resolved v2.0.0-ui — FIX-07:** FieldBuilder được rebuild từ FIELD_CONFIG, dead code bị loại bỏ.

---

## 🔴 BUGS MỚI TÌM & FIX (v2.1.0)

### ~~[BUG-A] Checkbox groups không rebuild được sau khi lookup load~~
**File:** `assets/js/app.js::rebuildLookupFields()` + `assets/js/wizard.js::_createCheckboxGroup()`  
**Root cause:** `rebuildLookupFields()` lấy `fieldName` từ `group.querySelector('input[type="checkbox"]')?.name`. Group được render rỗng (vì `window.__LOOKUP` chưa load) → không có input → `fieldName = null` → early return → checkbox group không bao giờ được populate.

> ✅ **Resolved v2.1.0:** Thêm `group.dataset.fieldName = name` khi tạo group. `rebuildLookupFields()` dùng `group.dataset.fieldName` với fallback về querySelector.

---

### ~~[BUG-B] Race condition: edit mode data bị mất sau khi lookup rebuild~~
**File:** `assets/js/app.js`  
**Root cause:** `loadLookupData()` và `Api.getUseCase()` chạy concurrent. Nếu `getUseCase` resolve trước, `FormMapper.populateData()` set `Team = "CNTT"` trên select chưa có options. Sau đó lookup resolve, `rebuildLookupFields()` xoá và rebuild options — có thể restore không thành công.

> ✅ **Resolved v2.1.0:** Thêm `_pendingEditData` — lưu edit data và re-apply `FormMapper.populateData()` ở cuối `rebuildLookupFields()`. Idempotent, không có side effect.

---

### ~~[BUG-C] `Current_Stage` bị overwrite bởi `Status` trong GAS~~
**File:** `assets/gas-backend/UseCaseService.gs`  
**Root cause:** `obj.Current_Stage = obj.Status` (createUseCase_) và `merged.Current_Stage = newStatus` (updateUseCase_) — user chọn S1-S4 nhưng bị ghi đè bởi workflow status.

> ✅ **Resolved v2.1.0:** Xóa 2 dòng đó. `Current_Stage` giữ nguyên giá trị S1-S4 từ form.

---

## 🟠 SECURITY ISSUES

### [SEC-01] Không có Authentication
**Vấn đề:** Bất kỳ ai có Web App URL đều có thể:
- Đọc tất cả use cases (GET /usecase/UUID nếu biết UUID)
- Tạo use case với tên/email bất kỳ
- Cập nhật bất kỳ record nào nếu biết Record_ID

**Giải pháp đề xuất:** Google Workspace SSO qua `Session.getActiveUser()` trong GAS, hoặc token-based auth.

---

### [SEC-02] CORS Wildcard
**File:** `assets/gas-backend/Utils.gs:15-17`  
`Access-Control-Allow-Origin: *` — bất kỳ domain nào cũng có thể gọi API này.  
Nên giới hạn về domain nội bộ nếu có.

---

### [SEC-03] SPREADSHEET_ID hardcode trong source code
**File:** `assets/gas-backend/Config.gs:2`  
ID sheet public trong repository. Nếu repo là public → ai cũng có thể tìm thấy sheet.

---

## 🟠 PERFORMANCE RISKS

### [PERF-01] Full table scan cho duplicate check
**File:** `assets/gas-backend/UseCaseService.gs:93`  
`readSheetAsObjects_(SHEETS.MASTER)` đọc toàn bộ sheet mỗi lần. Khi có 500+ records và mỗi duplicate check là 500 so sánh chuỗi — GAS sẽ chậm (~5-15 giây).

---

### [PERF-02] Full table scan cho dashboard
**File:** `assets/gas-backend/DashboardService.gs:3`  
Tương tự trên. `SHEETS.DASHBOARD_READY` được tạo ra với ý định lưu pre-aggregated data nhưng chưa được dùng.

---

### [PERF-03] Không có caching ở frontend
Lookup data gọi mỗi lần page load. Với GAS cold start (~2-4 giây), UX sẽ tệ ở lần đầu.

---

## 🟡 MAINTAINABILITY ISSUES

### [MAINT-01] Global variable pollution
**Vấn đề:** Toàn bộ JS objects (`Api`, `Wizard`, `FormMapper`, `Validator`, `Toast`, `Storage`, `DuplicateChecker`, `FieldBuilder`, `FIELDS`, `STEPS`, `APP_CONFIG`, `API`, `window.__LOOKUP`) đều là global. Xung đột tên dễ xảy ra khi mở rộng.

**Fix:** Module pattern (ES Modules) hoặc IIFE cho tất cả files.

---

### [MAINT-02] Script load order dependency ẩn
**File:** `index.html:40-51`  
Không có gì enforce thứ tự đúng. Ai đó thêm `<script>` sai vị trí → runtime error khó debug.

---

### ~~[MAINT-03] labelMap incomplete~~
**File:** `assets/js/wizard.js:112-120`  
Chỉ có 5/33 fields có label. 28 fields còn lại dùng `name.replace(/_/g, ' ')` → hiển thị kiểu "Pain Point" thay vì "Mô tả điểm đau nghiệp vụ".

> ✅ **Resolved v2.0.0-ui — NEW-01:** `FIELD_CONFIG` trong `constants.js` có đầy đủ label tiếng Việt cho 32/32 fields.

---

### ~~[MAINT-04] Textarea vs Input mismatch~~
**File:** `assets/js/wizard.js:143-164`  
Các field dài như `Pain_Point`, `Current_Process`, `Flow_Description`, `Usage_Steps` nên là `<textarea>` nhưng được render là `<input type="text">`. UX kém, không phù hợp cho nội dung dài.

> ✅ **Resolved v2.0.0-ui:** 18 fields đã được đổi sang `textarea` đúng số rows qua `FIELD_CONFIG`.

---

### ~~[MAINT-05] Team và Business_Category không có dropdown~~
**File:** `assets/js/wizard.js`  
Hai fields này là required và có lookup data, nhưng `createField()` render chúng thành `<input type="text">` thay vì `<select>`. Người dùng có thể nhập giá trị không khớp với lookup → inconsistent data.

> ✅ **Resolved v2.0.0-ui:** `FIELD_CONFIG` đánh dấu `type: 'select'` + `lookupKey`, FieldBuilder render `<select>` tự động populate từ `window.__LOOKUP`.

---

### ~~[MAINT-06] Không có textarea support trong FormMapper~~
**File:** `assets/js/form-mapper.js`  
`populateData()` chỉ handle `input[type=checkbox]` và các input còn lại. Nếu sau này thêm `textarea`, cần cập nhật cả FormMapper.

> ✅ **Resolved v2.0.0-ui:** `FormMapper` đã được cập nhật để handle `textarea` và `select`.

---

### [MAINT-07] Docs folder hầu hết trống
**Files:** `assets/docs/api-documentation.md`, `assets/docs/user-guide.md`, `assets/docs/deployment-guide.md`  
Tất cả đều rỗng hoặc chỉ có 1 ký tự. `assets/docs/architecture.md` chỉ có text "architecture.md".

---

## 🟠 SECURITY ISSUES — v2.2.0 additions

### [SEC-04] Login không verify email thật
**File:** `assets/js/auth.js:login()`
**Vấn đề:** Bất kỳ ai nhập email đúng format đều login được với role 'user'. Admin role chỉ cần biết email trong ADMIN_EMAILS list (hardcode trong `config/env.js` — public file).
**Fix:** Domain restriction (`@sptd.vn`) hoặc Google OAuth. Xem TODO_NEXT.md P2.

---

## 🟡 MAINTAINABILITY — v2.2.0 additions

### [MAINT-08] Portal service catalog hardcoded trong index.html script
**File:** `index.html` (inline script)
**Vấn đề:** `PORTAL_SERVICES` array nằm trong inline script. Khi thêm service mới phải sửa index.html.
**Fix:** Di chuyển ra `config/portal-services.js` — low priority cho small catalog.

### [MAINT-09] Login không có real async path
**File:** `login.html` inline script
**Vấn đề:** `setTimeout(380ms)` simulate loading, không phải real async. Khi swap sang OAuth, cần refactor callback pattern.
**Fix:** `AuthService.login()` trả về Promise thay vì sync object — nhưng chỉ cần khi có real backend call.

---

## 🟢 CODE SMELL

### [SMELL-01] `doPut` never triggered
GAS Web App không route PUT method. Frontend dùng POST cho cả create và update.

### [SMELL-02] `doOptions` không hoạt động theo cách dự kiến
CORS preflight từ browser không trigger `doOptions` trong GAS. GAS xử lý CORS theo cách riêng.

### ~~[SMELL-03] `generateUseCaseId_` đọc data trước khi lock~~
Race window nhỏ nhưng tồn tại. Nên lock trước, đọc sau.

> ✅ **Resolved v2.1.0:** `UseCaseService.gs` hiện tại đã lock trước (`lock.waitLock(LOCK_TIMEOUT_MS)`) rồi mới đọc sheet.

### ~~[SMELL-04] `diceSimilarity_` dùng Set mất duplicate bigrams~~
Dice coefficient chuẩn dùng multiset, không phải set. Với text ngắn kết quả có thể lệch đáng kể.

> ✅ **Resolved v2.1.0:** `Utils.gs` hiện tại dùng `map[bg] = (map[bg] || 0) + 1` (multiset) thay vì Set.

### ~~[SMELL-05] Draft không xóa sau edit mode~~
`Storage.clear()` chỉ gọi trong create flow. Edit mode không clear draft sau submit thành công.

> ✅ **Resolved v2.0.0-ui — FIX-06:** `Storage.clear()` đã được thêm vào edit success path trong `app.js`.
