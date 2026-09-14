# -*- coding: utf-8 -*-
"""
Dựng HƯỚNG DẪN SỬ DỤNG nền tảng Bình dân hóa AI H2/2026 — cho TEAMLEAD + NHÂN SỰ.
LUỒNG MỚI 2026-09: đăng ký tối giản · Cập nhật US · US H1 · Bài tập AI ·
                   Tự chấm KPI (member) → Teamlead duyệt.
Ảnh minh họa: screenshots/h2/*.png (chụp qua tests/zz-capture-h2-guide.spec.js).
Output: HDSD_H2_2026_Teamlead_NhanSu.docx
"""
import os, datetime
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BASE = os.path.dirname(__file__)
SHOTS = os.path.join(BASE, 'screenshots', 'h2')
OUT = os.path.join(BASE, 'HDSD_H2_2026_Teamlead_NhanSu.docx')

PURPLE = RGBColor(0x6B, 0x21, 0xA8)
ORANGE = RGBColor(0xE0, 0x6A, 0x00)
DARK   = RGBColor(0x1F, 0x25, 0x37)
GRAY   = RGBColor(0x6B, 0x72, 0x80)
GREEN  = RGBColor(0x05, 0x96, 0x69)


def set_cell_bg(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)


def add_heading(doc, text, level=1, color=PURPLE):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = color
    return p


def add_body(doc, text, bold=False, color=None, size=11):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(size); run.font.bold = bold
    if color: run.font.color.rgb = color
    return p


def add_bullets(doc, items):
    for it in items:
        p = doc.add_paragraph(style='List Bullet')
        r = p.add_run(it); r.font.size = Pt(10.5)


def add_image(doc, filename, caption, width=Cm(15.5)):
    path = os.path.join(SHOTS, filename)
    if not os.path.exists(path):
        add_body(doc, f'[Hình: {caption} — thiếu file {filename}]', color=GRAY, size=9)
        return
    doc.add_picture(path, width=width)
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap = doc.add_paragraph(caption); cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.runs[0] if cap.runs else cap.add_run(caption)
    r.font.size = Pt(9); r.font.italic = True; r.font.color.rgb = GRAY


def add_step_box(doc, num, title, desc):
    tbl = doc.add_table(rows=1, cols=2); tbl.style = 'Table Grid'; tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    c0 = tbl.rows[0].cells[0]; c0.width = Cm(1.3); set_cell_bg(c0, '6B21A8')
    p0 = c0.paragraphs[0]; p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r0 = p0.add_run(str(num)); r0.font.size = Pt(15); r0.font.bold = True; r0.font.color.rgb = RGBColor(0xFF,0xFF,0xFF)
    c1 = tbl.rows[0].cells[1]; p1 = c1.paragraphs[0]
    ra = p1.add_run(title + '\n'); ra.font.bold = True; ra.font.size = Pt(11)
    rb = p1.add_run(desc); rb.font.size = Pt(10); rb.font.color.rgb = GRAY
    doc.add_paragraph()


def add_note_box(doc, text, kind='info'):
    cmap = {'info': 'EDE9FE', 'warn': 'FEF3C7', 'tip': 'D1FAE5'}
    tbl = doc.add_table(rows=1, cols=1); tbl.style = 'Table Grid'
    cell = tbl.rows[0].cells[0]; set_cell_bg(cell, cmap.get(kind, 'EDE9FE'))
    r = cell.paragraphs[0].add_run(text); r.font.size = Pt(10); r.font.color.rgb = DARK
    doc.add_paragraph()


def add_table(doc, headers, rows, col_fill='6B21A8'):
    tbl = doc.add_table(rows=1 + len(rows), cols=len(headers)); tbl.style = 'Table Grid'
    for i, h in enumerate(headers):
        cell = tbl.rows[0].cells[i]; set_cell_bg(cell, col_fill)
        r = cell.paragraphs[0].add_run(h); r.font.bold = True; r.font.size = Pt(10); r.font.color.rgb = RGBColor(0xFF,0xFF,0xFF)
    for ri, rd in enumerate(rows, start=1):
        for ci, val in enumerate(rd):
            r = tbl.rows[ri].cells[ci].paragraphs[0].add_run(str(val)); r.font.size = Pt(9.5)
    doc.add_paragraph()


# ══════════════════════════════════════════════════════════════════
doc = Document()
style = doc.styles['Normal']; style.font.name = 'Segoe UI'; style.font.size = Pt(11)

# ── Trang bìa ──
t = doc.add_paragraph(); t.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = t.add_run('HƯỚNG DẪN SỬ DỤNG'); r.font.size = Pt(24); r.font.bold = True; r.font.color.rgb = PURPLE
s = doc.add_paragraph(); s.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = s.add_run('Nền tảng Bình dân hóa AI — Chương trình H2/2026'); r.font.size = Pt(14); r.font.color.rgb = DARK
s2 = doc.add_paragraph(); s2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = s2.add_run('Dành cho Teamlead & Nhân sự · TT SPTD'); r.font.size = Pt(12); r.font.color.rgb = GRAY
d = doc.add_paragraph(); d.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = d.add_run('Cập nhật: ' + datetime.date.today().strftime('%d/%m/%Y') + ' · luồng mới (đăng ký tối giản · Tự chấm KPI → Teamlead duyệt)')
r.font.size = Pt(10); r.font.italic = True; r.font.color.rgb = GRAY
doc.add_paragraph()

# ── 1. Giới thiệu ──
add_heading(doc, '1. Giới thiệu', 1)
add_body(doc, 'Nền tảng ghi nhận và quản trị việc ứng dụng AI trong công việc theo chương trình '
              '"Bình dân hóa AI" nửa cuối 2026 (H2). Mỗi cá nhân đăng ký Use Case AI (tối giản), cập nhật '
              'nội dung & kế hoạch, tự chấm KPI năng lực/khóa học và khai lan tỏa; teamlead duyệt và chấm điểm US; '
              'hệ thống tổng hợp KPI và xếp hạng.')
add_body(doc, 'Điểm mới của luồng 2026-09:', bold=True)
add_bullets(doc, [
    'Đăng ký Use Case TỐI GIẢN — chỉ 1 bước: chọn Workflow → Use Case + kế hoạch hành động T9–T12.',
    '"Cập nhật US" (thay "Cập nhật tuần") — nơi bổ sung Prompt/Luồng AI, demo, kế hoạch và số liệu cho US đã đăng ký.',
    'Thêm "US H1" (tra cứu use case kỳ H1, chỉ đọc) và "Bài tập AI" (chia sẻ thao tác AI nhỏ, không tính KPI).',
    'Nhân sự TỰ CHẤM KPI (năng lực + khóa học) và khai Lan tỏa → Teamlead DUYỆT (điểm chỉ tính sau khi duyệt).',
])
add_body(doc, 'Tài liệu này gồm 2 phần theo vai trò:', bold=True)
add_bullets(doc, [
    'NHÂN SỰ (thành viên): đăng ký US, cập nhật US, tra cứu US H1, chia sẻ Bài tập AI, tự chấm KPI & khai lan tỏa, dùng Thư viện AI, xem điểm.',
    'TEAMLEAD: duyệt tự chấm điểm & lan tỏa, chấm điểm US (hội đồng), đọc KPI tổng hợp & Heatmap (và chấm cá nhân trực tiếp khi cần).',
])

# ── 2. Đăng nhập ──
add_heading(doc, '2. Đăng nhập hệ thống', 1)
add_step_box(doc, 1, 'Mở nền tảng & đăng nhập', 'Dùng chung tài khoản với SHTD Dashboard (username + mật khẩu). '
             'Nếu quên/đổi mật khẩu, dùng mục "Đổi mật khẩu" trên thanh menu.')
add_image(doc, '01_login.png', 'Hình 1 — Màn hình đăng nhập')
add_note_box(doc, 'Vai trò (nhân sự / teamlead / admin) được xác định tự động theo tài khoản. Menu bên trái hiển thị '
                  'đúng chức năng theo vai trò của bạn.', 'info')

# ══════════ PHẦN NHÂN SỰ ══════════
add_heading(doc, '3. Dành cho NHÂN SỰ', 1)
add_image(doc, '02_home.png', 'Hình 2 — Trang chủ (vai trò nhân sự)')

add_heading(doc, '3.1  Đăng ký Use Case AI (tối giản)', 2)
add_step_box(doc, 1, 'Chọn Workflow → Use Case', 'Vào "Đăng ký Use Case". Chọn Workflow (lọc theo Team của bạn + Workflow chung), '
             'rồi chọn Use Case tương ứng trong danh mục chuẩn; hoặc chọn "Khác — nhập tự do" nếu chưa có.')
add_step_box(doc, 2, 'Điền Kế hoạch hành động T9–T12', 'Nhập việc dự kiến từng tháng (T9, T10, T11, T12) — bắt buộc ít nhất 1 tháng. Bấm Gửi để đăng ký.')
add_image(doc, '03_register.png', 'Hình 3 — Đăng ký Use Case: chọn Workflow/US + kế hoạch T9–T12')
add_note_box(doc, 'Đăng ký nay rất gọn: KHÔNG cần điền điểm đau/quy trình/prompt/demo ngay. Các nội dung đó bổ sung sau ở '
                  'màn "Cập nhật US" (mục 3.2). US mới mặc định ở Stage "S1 — Ý tưởng".', 'tip')

add_heading(doc, '3.2  Cập nhật US (nội dung, prompt & kế hoạch)', 2)
add_body(doc, 'Màn "Cập nhật US" (thay cho "Cập nhật tuần" trước đây) là nơi làm giàu use case đã đăng ký.')
add_step_box(doc, 1, 'Chọn US của bạn', 'Vào "Cập nhật US", chọn use case cần cập nhật từ danh sách/picker.')
add_step_box(doc, 2, 'Bổ sung nội dung', 'Điền/sửa Prompt & Luồng xử lý AI (mở sẵn — nội dung chính), link Demo, '
             'Kế hoạch hành động 4 tháng và số liệu tiến độ. Ghi chú không bắt buộc. Bấm lưu để cập nhật.')
add_image(doc, '04_update_us.png', 'Hình 4 — Cập nhật US: prompt/luồng AI + demo + kế hoạch + số liệu')
add_note_box(doc, 'Mỗi lần cập nhật được ghi vào "Lịch sử cập nhật" của use case để theo dõi tiến trình.', 'info')

add_heading(doc, '3.3  Tra cứu US H1 (chỉ đọc)', 2)
add_body(doc, 'Menu "US H1" là kho tra cứu các use case kỳ H1 (nửa đầu năm) để tham khảo — tách khỏi US H2 và KPI hiện hành.')
add_step_box(doc, 1, 'Tìm & lọc', 'Dùng ô tìm kiếm (mã/tên/owner/mô tả) và bộ lọc Team / Workflow / Stage để thu hẹp danh sách.')
add_step_box(doc, 2, 'Xem chi tiết', 'Bấm vào một dòng để mở cửa sổ chi tiết: điểm đau, luồng AI, prompt đầy đủ, kế hoạch và link demo.')
add_image(doc, '05_us_h1.png', 'Hình 5 — US H1: bảng tra cứu + tìm kiếm + bộ lọc')
add_image(doc, '06_us_h1_detail.png', 'Hình 6 — US H1: cửa sổ xem chi tiết (chỉ đọc)')

add_heading(doc, '3.4  Bài tập AI (chia sẻ thao tác nhỏ)', 2)
add_body(doc, '"Bài tập AI" để chia sẻ nhanh các thao tác AI nhỏ (chưa đủ thành một Use Case). KHÔNG tính vào điểm/KPI.')
add_step_box(doc, 1, 'Đăng bài', 'Điền Tiêu đề + Mô tả ngắn + Prompt (bắt buộc) + link demo ổ chung (tùy chọn). Bấm "Đăng bài".')
add_step_box(doc, 2, 'Tra cứu & tái dùng', 'Tìm kiếm bài của đồng nghiệp, mở "Xem Prompt" và bấm "Copy Prompt" để dùng lại; sửa/xóa bài của chính mình.')
add_image(doc, '07_ai_exercise.png', 'Hình 7 — Bài tập AI: đăng bài + tra cứu + copy prompt')
add_note_box(doc, 'Nhịp gợi ý 1 bài/tuần chỉ là khuyến khích (hệ thống nhắc nhẹ), không bắt buộc. Xóa bài sẽ hỏi xác nhận.', 'tip')

add_heading(doc, '3.5  Tự chấm KPI & khai Lan tỏa', 2)
add_body(doc, 'Nhân sự TỰ CHẤM hai cấu phần KPI theo THÁNG và khai hoạt động Lan tỏa; teamlead sẽ duyệt (mục 4.1). '
              'Điểm chỉ được tính vào KPI SAU khi teamlead duyệt.')
add_step_box(doc, 1, 'Chấm KPI2 — Năng lực ứng dụng AI', 'Tự cho điểm 0–10 cho 4 tiêu chí: Đa dạng ứng dụng · Thành thạo AI · '
             'Chất lượng kết quả · Số lượng/tần suất. Hệ thống hiển thị điểm KPI2 dự kiến.')
add_step_box(doc, 2, 'Khai KPI3 — Khóa học', 'Nhập số khóa đã hoàn thành và số khóa trả phí; đính link bằng chứng (chứng chỉ).')
add_step_box(doc, 3, 'Nộp cho teamlead', 'Có thể "Lưu nháp" để hoàn thiện sau, hoặc "Nộp cho teamlead" để đưa vào hàng chờ duyệt.')
add_image(doc, '08_self_score.png', 'Hình 8 — Tự chấm KPI của tôi (KPI2 năng lực + KPI3 khóa học + bằng chứng)')
add_note_box(doc, 'Mỗi kỳ (tháng dương lịch) nộp 1 lần; sửa được trước khi duyệt, KHÓA sau khi được Duyệt. Nếu bị Từ chối, '
                  'màn hình hiện lý do để bạn sửa và nộp lại. Lan tỏa (KPI4) khai kèm mô tả + link bằng chứng.', 'warn')

add_heading(doc, '3.6  Thư viện AI & xác nhận tái dùng', 2)
add_body(doc, 'Thư viện gom các use case kèm prompt/workflow để mọi người tham khảo và tái dùng.')
add_step_box(doc, 1, 'Tham khảo & sao chép prompt', 'Mở use case trong Thư viện, xem cách làm và bấm Copy Prompt để dùng lại.')
add_step_box(doc, 2, 'Xác nhận đã tái dùng', 'Nếu bạn áp dụng lại use case của người khác, bấm "Tôi đã tái dùng". '
             'Khi ≥ 3 người xác nhận, chủ use case được ghi nhận điểm "lan tỏa" (KPI4) tự động — song song với đường khai lan tỏa ở mục 3.5.')
add_image(doc, '09_library.png', 'Hình 9 — Thư viện AI và xác nhận tái dùng')
add_note_box(doc, 'Không thể tự xác nhận tái dùng use case của chính mình.', 'warn')

add_heading(doc, '3.7  Xem điểm & Leaderboard', 2)
add_body(doc, 'Vào "Leaderboard" để xem xếp hạng điểm US (hội đồng), điểm cá nhân và KPI tổng hợp. '
              'Điểm KPI2/KPI3 của bạn phản ánh sau khi teamlead duyệt bản tự chấm.')
add_image(doc, '13_leaderboard_kpi.png', 'Hình 10 — Leaderboard: tab KPI tổng hợp')

add_heading(doc, '3.8  Đổi mật khẩu', 2)
add_image(doc, '15_change_password.png', 'Hình 11 — Đổi mật khẩu tự phục vụ')

# ══════════ PHẦN TEAMLEAD ══════════
doc.add_page_break()
add_heading(doc, '4. Dành cho TEAMLEAD', 1)
add_body(doc, 'Ngoài các chức năng của nhân sự, teamlead có thêm: DUYỆT tự chấm điểm & lan tỏa của thành viên, '
              'chấm điểm US (hội đồng), đọc KPI tổng hợp / Heatmap của team, và có thể chấm điểm cá nhân trực tiếp khi cần.')

add_heading(doc, '4.1  Duyệt chấm điểm (tự chấm + lan tỏa)', 2)
add_body(doc, 'Đây là bước quyết định điểm KPI2/KPI3/KPI4 của thành viên: bản tự chấm chỉ được tính sau khi teamlead Duyệt.')
add_step_box(doc, 1, 'Mở "Duyệt chấm điểm"', 'Màn hiển thị 2 nhóm: "Tự chấm KPI chờ duyệt" và "Lan tỏa AI chờ duyệt" của thành viên team bạn.')
add_step_box(doc, 2, 'Đối chiếu & quyết định', 'Xem điểm tự chấm (KPI2 4 tiêu chí, KPI3 số khóa) và các link bằng chứng. '
             'Bấm "Duyệt" để chốt (tính vào KPI), hoặc "Từ chối" (BẮT BUỘC nhập lý do) để yêu cầu sửa lại.')
add_image(doc, '10_review_scores.png', 'Hình 12 — Duyệt chấm điểm: tự chấm KPI + lan tỏa chờ duyệt')
add_note_box(doc, 'Chỉ duyệt được thành viên thuộc team mình (hoặc team được phân công backup). Từ chối phải kèm lý do rõ ràng.', 'info')

add_heading(doc, '4.2  Chấm điểm US — Hội đồng', 2)
add_step_box(doc, 1, 'Mở Hàng đợi Review', 'Vào "Hàng đợi Review" — danh sách use case chờ hội đồng chấm, kèm tiến độ n/4 '
             '(số thành viên hội đồng đã chấm).')
add_image(doc, '11_council_list.png', 'Hình 13 — Hàng đợi Review')
add_step_box(doc, 2, 'Chấm 3 tiêu chí (0–10)', 'Mở 1 use case, kéo 3 thanh: Tiết kiệm thời gian (30%) · Tự động hóa (40%) · '
             'Sáng tạo (30%). Xem dòng "Bằng chứng (EVD)" để đối chiếu minh chứng, rồi bấm Gửi.')
add_image(doc, '12_council_panel.png', 'Hình 14 — Bảng chấm điểm US hội đồng (3 tiêu chí + dòng EVD)')
add_note_box(doc, 'Điểm US cuối cùng của use case = trung bình điểm của các thành viên hội đồng đã chấm.', 'info')

add_heading(doc, '4.3  Chấm điểm cá nhân trực tiếp (song song, khi cần)', 2)
add_body(doc, 'Màn "Chấm điểm cá nhân" (đường cũ) vẫn giữ song song: teamlead có thể tự chấm 4 tiêu chí năng lực theo tháng '
              'cho thành viên khi cần, thay vì chờ thành viên tự chấm. Kết quả cùng ghi vào KPI2 theo tháng. '
              'Khuyến nghị dùng đường "Tự chấm → Duyệt" (mục 3.5 + 4.1) làm chính để thành viên chủ động.')

add_heading(doc, '4.4  Đọc KPI tổng hợp & Heatmap', 2)
add_body(doc, 'Trên Leaderboard, tab "KPI tổng hợp" / "KPI Teamlead" thể hiện điểm cuối; tab "Heatmap" hiển thị '
              'lưới team × cá nhân theo màu (xanh ≥85 · xanh lá ≥70 · vàng 50–69 · đỏ <50).')
add_image(doc, '14_heatmap.png', 'Hình 15 — Heatmap KPI team & cá nhân (kèm thẻ KPI PM)')

# ── 5. Bộ điểm & công thức ──
doc.add_page_break()
add_heading(doc, '5. Bộ điểm & công thức KPI', 1)
add_body(doc, 'KPI thành viên (Member) tổng hợp từ 4 cấu phần, trừ điểm milestone chậm:', bold=True)
add_table(doc,
    ['Cấu phần', 'Trọng số', 'Nguồn chấm', 'Ghi chú'],
    [
        ['KPI-1 — Điểm US', '40%', 'Hội đồng (teamlead)', 'Bình quân điểm hội đồng các UC do cá nhân sở hữu'],
        ['KPI-2 — Năng lực', '30%', 'Member tự chấm → Teamlead duyệt', 'Trung bình các tháng đã duyệt (4 tiêu chí 0–10)'],
        ['KPI-3 — Khóa học', '15%', 'Member khai → Teamlead duyệt', 'Mỗi khóa 25%, khóa trả phí ×2 (tối đa 100%)'],
        ['KPI-4 — Lan tỏa', '15%', 'Member khai/duyệt HOẶC tự động', 'Đạt = được duyệt buổi chia sẻ HOẶC ≥3 người tái dùng UC'],
        ['Điểm trừ — Milestone chậm', '−2%/mốc', 'Hệ thống/Teamlead', 'Tối đa −10%'],
    ])
add_body(doc, 'Ngưỡng xếp hạng (thang 100):', bold=True)
add_table(doc,
    ['Xếp hạng', 'Điểm', 'Màu'],
    [
        ['Xuất sắc (Top)', '≥ 85', 'Tím'],
        ['Tốt (Strong)', '≥ 70', 'Xanh lá'],
        ['Trung bình (Average)', '≥ 50', 'Vàng'],
        ['Cần cải thiện', '< 50', 'Đỏ'],
    ])
add_note_box(doc, 'Teamlead KPI = 60% KPI cá nhân của teamlead + 40% tỷ lệ thành viên team đạt ≥ 70 điểm. '
                  'Điểm KPI-2/KPI-3 chỉ vào công thức SAU khi teamlead duyệt bản tự chấm.', 'info')

# ── 6. FAQ ──
add_heading(doc, '6. Câu hỏi thường gặp', 1)
faqs = [
    ('Đăng ký US sao không thấy ô nhập prompt/demo?',
     'Đăng ký nay tối giản (chỉ Workflow/US + kế hoạch T9–T12). Prompt, luồng AI và demo bổ sung sau ở màn "Cập nhật US".'),
    ('Tự chấm KPI xong sao điểm chưa lên?',
     'Điểm KPI-2/KPI-3 chỉ tính SAU khi teamlead bấm "Duyệt". Trước đó bản tự chấm ở trạng thái "Chờ duyệt".'),
    ('Bị teamlead từ chối bản tự chấm?',
     'Mở lại "Tự chấm KPI", đọc lý do từ chối, sửa số/bằng chứng rồi Nộp lại. Mỗi tháng nộp 1 lần, khóa sau khi được Duyệt.'),
    ('"Bài tập AI" có tính điểm không?',
     'Không. Đây là kênh chia sẻ thao tác nhỏ để lan tỏa; không tính vào KPI.'),
    ('US H1 khác US H2 thế nào?',
     '"US H1" chỉ để tra cứu (chỉ đọc) use case kỳ H1; không liên quan KPI/chấm điểm H2 hiện hành.'),
    ('Lan tỏa (KPI-4) đạt bằng cách nào?',
     'Hai đường song song: (a) khai buổi chia sẻ + bằng chứng → teamlead duyệt; hoặc (b) tự động khi ≥3 người xác nhận tái dùng UC của bạn ở Thư viện.'),
]
for q, a in faqs:
    p = doc.add_paragraph(); r = p.add_run('• ' + q); r.font.bold = True; r.font.size = Pt(10.5); r.font.color.rgb = PURPLE
    add_body(doc, '   ' + a, size=10, color=DARK)

doc.save(OUT)
print('WROTE', OUT)
