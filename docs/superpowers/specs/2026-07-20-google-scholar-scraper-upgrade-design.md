# Thiết kế Đặc tả Nâng cấp Trình cào dữ liệu Google Scholar & Metadata Bài viết

Tài liệu này mô tả chi tiết thiết kế kỹ thuật nâng cấp cơ chế cào dữ liệu Google Scholar (gồm 2 giai đoạn Quét lần 1 và Quét lần 2), mở rộng cơ sở dữ liệu để lưu trữ tất cả các trường thông tin hiển thị trên Google Scholar, đồng thời tối ưu hóa hiển thị ở Frontend và bổ sung cột báo cáo khi xuất file Excel.

---

## 1. Kiến trúc & Cơ sở dữ liệu (Database Schema)

Chúng ta bổ sung thêm 8 trường thông tin chi tiết của bài viết khoa học vào bảng cơ sở dữ liệu `scholar_publications` đại diện bởi Model `Publication` ở file `apps/scholar/models.py`.

### 1.1 Thay đổi cấu trúc bảng `Publication`
```python
# apps/scholar/models.py

class Publication(BaseModel):
    # --- CÁC TRƯỜNG DỮ LIỆU HIỆN TẠI ---
    author = models.ForeignKey(AuthorProfile, on_delete=models.CASCADE, related_name="publications")
    title = models.TextField(_("Title"))
    authors_list = models.TextField(_("Authors List"), blank=True, null=True)
    venue = models.TextField(_("Venue/Journal"), blank=True, null=True)
    year = models.CharField(_("Year"), max_length=50, blank=True, null=True)
    citations = models.IntegerField(_("Citations Count"), default=0)
    display_order = models.IntegerField(_("Display Order"), default=0)
    cites_per_year = models.JSONField(_("Citations Per Year History"), default=dict, blank=True)
    
    # Đối khớp tự động tạp chí
    journal = models.ForeignKey(Journal, on_delete=models.SET_NULL, null=True, blank=True, related_name="publications")
    sjr_q = models.CharField(_("Matched SJR Quartile"), max_length=10, default="N/A")
    if_val = models.CharField(_("Matched Impact Factor"), max_length=20, default="N/A")
    wos = models.CharField(_("Matched Web of Science"), max_length=150, default="N/A")

    # --- CÁC TRƯỜNG DỮ LIỆU NÂNG CẤP MỚI ---
    pub_date = models.CharField(_("Publication Date"), max_length=150, blank=True, null=True) # Ngày xuất bản chi tiết (YYYY/MM/DD)
    volume = models.CharField(_("Volume"), max_length=150, blank=True, null=True)             # Tập
    issue = models.CharField(_("Issue"), max_length=150, blank=True, null=True)               # Số (Number)
    pages = models.CharField(_("Pages"), max_length=150, blank=True, null=True)               # Trang / Article Number
    publisher = models.CharField(_("Publisher"), max_length=500, blank=True, null=True)       # Nhà xuất bản
    description = models.TextField(_("Description"), blank=True, null=True)                   # Tóm tắt bài viết (Abstract)
    pub_url = models.URLField(_("Publication URL"), max_length=2000, blank=True, null=True)   # Link bài viết gốc của NXB
    eprint_url = models.URLField(_("Eprint PDF URL"), max_length=2000, blank=True, null=True) # Link PDF bản in thử tự do
```

### 1.2 Cấu hình Serializer (`apps/scholar/api/serializers.py`)
Mở rộng Serializer để chuyển các trường dữ liệu mới từ Database qua REST API:
```python
# apps/scholar/api/serializers.py

class PublicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Publication
        fields = [
            'id', 'title', 'authors_list', 'venue', 'year', 'citations', 
            'display_order', 'cites_per_year', 'sjr_q', 'if_val', 'wos',
            # Các trường nâng cấp
            'pub_date', 'volume', 'issue', 'pages', 'publisher', 
            'description', 'pub_url', 'eprint_url'
        ]
```

---

## 2. Logic xử lý cào dữ liệu song hành (Tasks)

Tiến trình cào Celery (`scrape_author_profile_task` trong `apps/scholar/tasks.py`) sẽ được nâng cấp logic để phân tích thông tin tạp chí (Venue, Volume, Pages) một cách hợp lý và hiệu quả:

### 2.1 Quét lần 1 (Danh sách thô - Tốc độ cao)
*   **Mục tiêu**: Lấy thông tin cơ bản của tất cả các bài viết trong profile để hiển thị nhanh danh sách.
*   **Xử lý chuỗi thông tin (Venue)**: 
    *   Tránh loại bỏ số Tập và Trang trong cột `venue`. Sử dụng một hàm tách chuỗi phụ `clean_citation_venue(citation_str)` để loại bỏ phần năm ở cuối chuỗi trích dẫn thô, phần còn lại lưu nguyên trạng vào `venue`.
        *   *Ví dụ*: Chuỗi trích dẫn thô `Sensors and Actuators B: Chemical 354, 131195, 2022` sẽ được làm sạch thành `Sensors and Actuators B: Chemical 354, 131195` và lưu trực tiếp vào trường `Publication.venue`.
    *   Đối khớp danh mục tạp chí: Vẫn dùng hàm `extract_venue(citation_str)` hiện tại để trích xuất ra tên tạp chí gốc (`Sensors and Actuators B: Chemical`) dùng để truy vấn bảng xếp hạng (Q1/Q2/Q3/Q4, IF) trong cơ sở dữ liệu `scholar_journals`.

### 2.2 Quét lần 2 (Quét chi tiết - Quét sâu)
*   **Mục tiêu**: Đi sâu vào trang chi tiết của từng bài báo để cào toàn bộ metadata và lịch sử trích dẫn theo năm.
*   **Cách thức lấy tin**:
    Trích xuất các trường thông tin từ đối tượng kết quả trả về của hàm `scholarly.fill(pub)` và lưu vào các cột tương ứng:
    *   `publication['bib'].get('journal')` hoặc `conference` ➔ Lưu vào `venue` (Tên tạp chí sạch)
    *   `publication['bib'].get('volume')` ➔ Lưu vào `volume`
    *   `publication['bib'].get('number')` ➔ Lưu vào `issue`
    *   `publication['bib'].get('pages')` ➔ Lưu vào `pages`
    *   `publication['bib'].get('publisher')` ➔ Lưu vào `publisher`
    *   `publication['bib'].get('abstract')` ➔ Lưu vào `description`
    *   `publication.get('pub_url')` ➔ Lưu vào `pub_url`
    *   `publication.get('eprint_url')` ➔ Lưu vào `eprint_url`
    *   `publication['bib'].get('pub_year')` kết hợp phân tích ngày xuất bản ➔ Lưu vào `pub_date`

---

## 3. Cải tiến hiển thị & Chức năng xuất Excel ở Frontend

### 3.1 Cải tiến hiển thị danh sách bài báo
Chuỗi thông tin Tạp chí hiển thị dưới tên tác giả trong bảng sẽ được tính toán động dựa trên trạng thái dữ liệu hiện có:
*   Nếu bài báo **đã có số Tập/Trang** (đã được Quét lần 2): Hiển thị ghép chuỗi:
    `{venue} {volume ? volume : ''}{issue ? '(' + issue + ')' : ''}{pages ? ', ' + pages : ''}`
*   Nếu bài báo **chưa được quét lần 2** (chỉ có dữ liệu Quét lần 1): Hiển thị trực tiếp trường `venue` (vốn đã được lưu kèm thông tin Tập/Trang từ chuỗi trích dẫn thô).

### 3.2 Giao diện Chi tiết bài viết (Detailed View Panel)
Cập nhật hiển thị toàn bộ các trường thông tin trong panel chi tiết bên trái:
*   **Ngày xuất bản**: Hiển thị trường `pub_date` nếu có, nếu không thì hiển thị `year`.
*   **Tập / Số / Trang**: Hiển thị rõ các nhãn `Tập`, `Số`, `Trang` tương ứng thay vì gộp chung.
*   **Nhà xuất bản**: Hiển thị thông tin nhà xuất bản.
*   **Mô tả**: Hiển thị nội dung tóm tắt (Abstract) bài viết dạng văn bản hoàn chỉnh.
*   **Các đường dẫn liên kết**:
    *   Nút **Xem bài viết gốc 🔗** trỏ đến link nhà xuất bản `pub_url`.
    *   Nút **Tải PDF / Bản xem trước 📄** trỏ đến `eprint_url` (nếu có).

### 3.3 Báo cáo xuất Excel (`handleExport`)
Cập nhật hàm tạo Excel ở client side để đưa các cột thông tin mới vào tab danh sách:
*   Cột **Ngày xuất bản** (thay thế cho năm).
*   Thêm cột **Tập (Volume)**.
*   Thêm cột **Số (Issue)**.
*   Thêm cột **Số trang (Pages)**.
*   Thêm cột **Nhà xuất bản**.
*   Thêm cột **Link bài viết**.
*   Thêm cột **Link PDF**.
*   Thêm cột **Tóm tắt (Abstract)** ở cột cuối cùng.

---

## 4. Kế hoạch triển khai & Di cư cơ sở dữ liệu

1.  **Backend Migrations**:
    *   Chạy `python manage.py makemigrations scholar` để tạo file migration bổ sung các cột mới.
    *   Chạy `python manage.py migrate` để áp dụng các thay đổi cấu trúc bảng vào cơ sở dữ liệu PostgreSQL.
2.  **Cập nhật mã nguồn**:
    *   Cập nhật `apps/scholar/models.py` với cấu trúc trường mới.
    *   Cập nhật `apps/scholar/api/serializers.py` để xuất dữ liệu qua API.
    *   Cập nhật `apps/scholar/tasks.py` để bổ sung xử lý cào dữ liệu chi tiết.
    *   Cập nhật `frontend/src/pages/ScholarScraperPage.tsx` phục vụ giao diện và hàm tạo Excel.
3.  **Kiểm thử tích hợp**:
    *   Quét thử hồ sơ tác giả bằng Quét lần 1 và kiểm tra chuỗi tạp chí hiển thị có chứa đầy đủ tập/trang.
    *   Chạy Quét chi tiết lần 2 và kiểm tra xem các thông tin Tập, Số, Trang, Tóm tắt, các liên kết PDF/URL đã được lưu vào database và cập nhật hiển thị chính xác hay chưa.
    *   Xuất file Excel và đối soát cấu trúc cột.
