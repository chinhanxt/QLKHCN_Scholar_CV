# Thiết kế Hệ thống Cào Tự động và Lập lịch động theo giờ Việt Nam

Tài liệu này đặc tả thiết kế kỹ thuật cho việc tự động hóa hệ thống cào song song (Clarivate, SCImago, BioxBio), tích hợp lập lịch hẹn giờ động theo giờ Việt Nam từ giao diện quản trị, và tự động tích hợp dữ liệu mới.

---

## 1. Tổng quan & Mục tiêu
* **Tự động hóa luồng chạy:** Hệ thống có khả năng tự động cào và cập nhật dữ liệu định kỳ theo khung giờ hẹn (Giờ Việt Nam) mà không cần sự can thiệp của người dùng.
* **Tối giản hóa giao diện (UI):** Ẩn bảng cấu hình mặc định. Lọc bảng xem trước Staging chỉ hiển thị các dữ liệu mới cào. Ẩn nút "Đồng bộ" khi không có dữ liệu mới.
* **Tự động đồng bộ (Auto-Sync):** Khi chạy hẹn giờ tự động, nếu có dữ liệu mới, backend tự tích hợp; nếu không có dữ liệu mới, backend tự dọn dẹp và giữ nguyên cơ sở dữ liệu chính thức.

---

## 2. Thiết kế Giao diện người dùng (UI)
Sửa đổi giao diện tại file [UnifiedCrawlerPage.tsx](file:///home/chinhan/Downloads/init-django-project-main/frontend/src/pages/UnifiedCrawlerPage.tsx):
* **Bảng cấu hình mặc định:** Đổi trạng thái mặc định của `showConfig` thành `false`.
* **Cài đặt Lập lịch:** Bổ sung form cấu hình thu gọn:
  * Checkbox/Switch: `"Kích hoạt cào tự động hàng ngày"` (`auto_crawl_enabled`).
  * Dropdown chọn giờ: `00` đến `23` (`auto_crawl_hour`).
  * Dropdown chọn phút: `00` đến `59` (`auto_crawl_minute`).
  * Nút "Lưu Cấu Hình" sẽ gửi các cấu hình này cùng với cấu hình proxy hiện tại lên API `/api/v1/scholar/crawlers/settings/`.
* **Lọc bảng xem trước và tự động ẩn nút:**
  * Tại **Tab 4 (Kết quả Mapping Draft)**: Chỉ hiển thị các tạp chí có `is_new === true`.
  * Nếu không có bản ghi mới nào:
    * Thay thế bảng bằng thông báo: `"Không tìm thấy dữ liệu mới nào trên các nguồn."`
    * Ẩn nút **"Đồng Bộ & Cập Nhật"**.

---

## 3. API & Cơ chế lập lịch động
* **Cấu hình JSON:** Cập nhật các helper `get_scholar_settings()` và `save_scholar_settings(data)` tại [tasks.py](file:///home/chinhan/Downloads/init-django-project-main/apps/scholar/tasks.py) để lưu trữ các trường:
  * `auto_crawl_enabled` (mặc định: `false`)
  * `auto_crawl_hour` (mặc định: `2`)
  * `auto_crawl_minute` (mặc định: `0`)
* **Lập lịch Celery Beat động:**
  * Viết hàm `sync_celery_beat_schedule()` tại backend. Hàm này sử dụng model `django_celery_beat.models.PeriodicTask` và `CrontabSchedule`.
  * Khi lưu cấu hình:
    * Nếu bật hẹn giờ: Tạo/cập nhật `CrontabSchedule` theo giờ VN, và bật `PeriodicTask` (gán `is_automated=True` trong `kwargs`).
    * Nếu tắt hẹn giờ: Cập nhật `PeriodicTask` thành `enabled=False`.

---

## 4. Logic Xử lý tự động (Auto-Sync)
Cập nhật task điều phối tổng hợp `crawl_and_integrate_all_task` tại [tasks.py](file:///home/chinhan/Downloads/init-django-project-main/apps/scholar/tasks.py):
* Thêm tham số `is_automated=False` vào signature của task.
* Sau khi task con `integrate_scores_task` hoàn thành:
  * Nếu `is_automated == True` (Chạy tự động theo giờ):
    * Kiểm tra xem có bất kỳ bản ghi nháp Staging nào là mới hay không.
    * **Nếu có:** Thực hiện lệnh Raw SQL để tự động xóa DB chính thức cũ và kích hoạt DB Staging thành chính thức.
    * **Nếu không có:** Xóa dữ liệu Staging và giữ nguyên DB chính thức.
  * Nếu `is_automated == False` (Chạy thủ công trên web):
    * Giữ nguyên Staging để hiển thị xem trước trên UI và chờ người dùng bấm nút **Đồng Bộ & Cập Nhật**.

---

## 5. Kế hoạch triển khai (Implementation Plan)
1. **Bước 1 (Backend):** Cập nhật schema cấu hình JSON trong `tasks.py` để lưu các biến lập lịch hẹn giờ.
2. **Bước 2 (Backend):** Triển khai hàm `sync_celery_beat_schedule` sử dụng `django-celery-beat` và tích hợp vào hàm `save_scholar_settings`.
3. **Bước 3 (Backend):** Sửa đổi task `crawl_and_integrate_all_task` để thực hiện đồng bộ tự động khi `is_automated=True`.
4. **Bước 4 (Frontend):** Thiết kế lại giao diện bảng cấu hình và bộ lọc bảng Staging trên `UnifiedCrawlerPage.tsx`.
5. **Bước 5 (Kiểm thử):** Chạy kiểm thử tự động cào và đồng bộ.
