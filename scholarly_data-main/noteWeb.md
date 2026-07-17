### 1. Bản Desktop (Hiện tại bạn đang chạy)                                                                                          
                                                                                                                                       
  • Cách hoạt động: Khi bạn chạy file Python trên máy tính của bạn, lệnh cào dữ liệu sẽ đi trực tiếp từ mạng Internet nhà bạn (IP cá   
  nhân của bạn) đến Google Scholar.                                                                                                    
  • Tại sao không bị block? Vì bạn dùng ít, lâu lâu mới quét một người, và Google Scholar thấy đây là địa chỉ IP của một hộ gia đình   
  bình thường nên họ cho phép chạy mà không cần Proxy.                                                                                 
  • Khi có nhiều người dùng: Nếu có 10 người cùng tải app Desktop của bạn về máy họ chạy, thì dữ liệu sẽ đi từ 10 IP mạng nhà khác nhau.
  Google Scholar coi đó là 10 người dùng độc lập, nên mọi thứ vẫn chạy bình thường.                                                    
  ──────
  ### 2. Bản Web App (Khi bạn đưa lên Web)
  
  • Cách hoạt động: Khi bạn đưa lên Web, toàn bộ mã nguồn Python sẽ không chạy trên máy khách nữa, mà chạy trên Máy chủ Web (Server)   
  của bạn (ví dụ thuê của AWS, Google Cloud, DigitalOcean...). Người dùng chỉ mở trình duyệt lên xem giao diện thôi.
  • Tại sao sẽ bị block ngay lập tức?
      • Lý do 1 - Trùng IP: Khi có 10 hay 100 người dùng truy cập vào trang web của bạn để tìm kiếm tác giả, tất cả các yêu cầu cào dữ 
      liệu đó đều được gửi đi từ DUY NHẤT 1 IP của Server. Google Scholar sẽ thấy hàng trăm yêu cầu cào dồn dập đến từ 1 địa chỉ duy   
      nhất ➔ Nó sẽ khóa IP Server đó ngay lập tức.
      • Lý do 2 - IP Server bị ghét: Google Scholar cực kỳ nhạy cảm với các dải IP của các nhà cung cấp máy chủ (datacenter). Chỉ cần  
      thấy request từ IP server, họ sẽ chặn hoặc bắt xác thực robot (CAPTCHA) ngay từ những request đầu tiên. Do code chạy trên server 
      không có màn hình để bạn "nhấn nút chọn hình ảnh xác thực", toàn bộ tính năng cào trên web sẽ bị lỗi.
  
  ──────
  ### 🔔 Vậy có chạy cách hiện tại được không?
  
  Vẫn chạy được thuật toán cào cũ, nhưng bạn PHẢI BẬT Proxy lên.
  
  • Ở bản Web, bạn không thể để tùy chọn Proxy là  None  (không dùng proxy) như ở local được nữa.
  • Bạn bắt buộc phải mua dịch vụ Proxy (hoặc dùng các API cào như ScraperAPI) và cấu hình vào file Backend của Web. Khi đó, Server của
  bạn sẽ gửi yêu cầu qua Proxy ➔ Proxy đổi sang hàng nghìn IP khác nhau để gửi tới Google ➔ Google không biết đó là Server của bạn và  
  không block được.
  
  │ [!TIP]
  │ Tóm lại: Cách cào và code phân tích dữ liệu giữ nguyên, nhưng trên Web bạn bắt buộc phải cấu hình thêm Proxy/API cào chạy ở phía   
  sau
  │ (Backend) để làm lá chắn đổi IP, nếu không trang web của bạn sẽ chỉ chạy được vài phút là bị Google Scholar khóa vĩnh viễn IP của  
  │ Server.