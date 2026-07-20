# Thiết kế giao diện Google Scholar Profile hiện đại (Hiệu chỉnh)

**Ngày thực hiện**: 2026-07-20  
**Trạng thái**: Đã phê duyệt bổ sung bởi người dùng  

---

## 1. Mục tiêu
Thiết kế lại giao diện Google Scholar profile hiện tại (trang Scraper) theo phong cách **SaaS Dashboard** hiện đại, tối giản (Minimal), chuyên nghiệp và trực quan. Giao diện mới bám sát cấu trúc nguyên bản của Google Scholar để tối ưu hóa trải nghiệm đọc và tương tác dữ liệu.

---

## 2. Đặc tả Thiết kế & Thành phần UI

### A. Tông màu và Theme
- **Primary**: Xanh dương `#2563EB` (Dùng cho liên kết, tiêu đề bài viết, tiêu đề cột bảng và các nút bấm chính)
- **Secondary**: Xanh nhạt `#DBEAFE` (Dùng làm nền badge)
- **Background**: `#F8FAFC` (Nền chính của toàn trang)
- **Border**: `#E5E7EB` (Đường phân cách phẳng, tối giản)
- **Card**: Bo góc 16px (`rounded-2xl`).

### B. Header Tác giả
- **Avatar**: Hình tròn xám nhạt với icon **Mũ tốt nghiệp (Graduation Cap)** màu xám đậm. Tĩnh hoàn toàn, không có hover thay đổi ảnh hay icon camera để tối giản hóa theo yêu cầu.
- **Chi tiết tác giả**:
  - Tên tác giả: `Chí Nhân` in đậm 28px, nút bấm chỉnh sửa bên cạnh.
  - Đơn vị công tác: `Unknown affiliation`.
  - Trạng thái email: `No verified email`.

### C. Cột Trái (70% - Bảng Công bố Khoa học)
- **Thanh công cụ**: Ô tìm kiếm nhanh lọc bài viết trong danh sách, bộ chọn Năm (Filter Year), bộ Sắp xếp (Sort), và nút Xuất Excel.
- **Bảng bài báo (Publications Table)**:
  - **Header**: 
    - Checkbox chọn tất cả.
    - Cột **TITLE**: Chữ màu xanh hệ thống `#2563EB`, click để sort. Tích hợp nút `+` (thêm bài báo) và `︙` (tùy chọn) bên cạnh.
    - Cột **CITED BY**: Chữ màu xanh hệ thống `#2563EB`, click để sort, căn phải.
    - Cột **YEAR**: Chữ màu xanh hệ thống `#2563EB`, click để sort, căn phải.
    - Cột **HÀNH ĐỘNG**: Cột trống/chức năng ở góc phải.
  - **Từng dòng bài báo (Table Row)**:
    - Checkbox chọn riêng.
    - Tiêu đề: Màu xanh dương `#2563EB`, bold, nhấp chuột để mở chi tiết.
    - Tên tác giả, Tên tạp chí in nghiêng, mã DOI và các nhãn (Q1/Q2/Open Access/WoS/IF) hiển thị inline.
    - Cột Cited by: Số lượt trích dẫn dạng liên kết có thể bấm.
    - Cột Year: Năm xuất bản bài báo.
    - **Cột Hành động**: Hiển thị cố định (không hover) 2 nút Chỉnh sửa (Edit) và Xóa (Delete) để người dùng dễ thao tác.
- **Phân trang (Pagination)**: Dưới chân bảng.

### D. Cột Phải (30% - Chỉ số Trích dẫn)
- **Cited by Card**:
  - Bảng số liệu: Citations, h-index, i10-index so sánh "Tất cả" (All) và "Từ 2021" (Since 2021).
  - Biểu đồ trích dẫn theo năm: Cột dọc màu xám, hiển thị trục năm bên dưới và trục số đo trích dẫn ở mép phải biểu đồ.
  - **Khoảng cách năm**: Tăng `viewBox` chiều rộng của biểu đồ SVG lên `460` để kéo giãn khoảng cách, ngăn chặn tình trạng chữ năm chồng chéo lên nhau.
- **Co-authors Card**: Loại bỏ hoàn toàn khỏi giao diện theo yêu cầu.

### E. Giao diện chi tiết bài viết (Khi click xem)
- Hiển thị các trường thông tin chuẩn học thuật của Google Scholar (Tác giả, Ngày xuất bản, Tạp chí, Tập, Số, Trang, Nhà xuất bản, Mô tả) và biểu đồ trích dẫn theo năm của riêng bài viết đó, đồng thời giữ nguyên các badge phân hạng.
