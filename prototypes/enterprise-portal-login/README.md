# Prototype đăng nhập cổng doanh nghiệp — giai đoạn 1

Phạm vi PO giao: giao diện đăng nhập desktop/mobile, trạng thái mặc định/lỗi/đang xử lý; dữ liệu và tương tác giả lập. Dừng sau giai đoạn 1 để duyệt phong cách. Không phải tích hợp hoặc nghiệm thu hệ thống SME.

## Mở bản mẫu

Mở `dist/index.html` trực tiếp bằng Chrome/Edge, không cần cài thư viện hoặc chạy backend. Ví dụ tại root bằng PowerShell:

```powershell
Start-Process '.\prototypes\enterprise-portal-login\dist\index.html'
```

Nút điều khiển “Mặc định / Lỗi đăng nhập / Đang xử lý” phía cuối trang dùng để xem các trạng thái. Có thể nhập email giả lập và mật khẩu bất kỳ để xem xử lý mô phỏng. Không nhập thông tin đăng nhập thật. Ba nút Quên mật khẩu / Tạo tài khoản / Xác minh email chỉ hiện ghi chú về giai đoạn sau.

## Phương án và kế hoạch được triển khai

1. Đối chiếu `frontend/src/portal/PortalAuth.tsx` và CodeGraph; giữ các trường và lối vào hiện có.
2. Tạo HTML/CSS/JS độc lập, desktop hai cột với minh họa hồ sơ bằng SVG/CSS, mobile một cột ưu tiên biểu mẫu. Font hệ thống hỗ trợ tiếng Việt; ưu tiên Inter nếu đã có trên máy, không tải font từ mạng.
3. Mô phỏng lỗi/đang xử lý, validation tại máy, xem/ẩn mật khẩu, thông báo cho luồng chưa thiết kế.
4. Kiểm chứng trên Chrome tại 1440/390 px và kích thước phụ 1280/375/320 px; kiểm tra không gọi API, không ghi storage, điều hướng bàn phím, trạng thái nhập liệu và ảnh chụp.
5. Bàn giao để PO duyệt phong cách trước khi làm các view tiếp theo.

## Ranh giới ảnh hưởng ngang và sâu

| Phần | Truy vết và ranh giới | Thao tác / kiểm chứng |
|---|---|---|
| Login hiện tại | `main.tsx → App → PortalApp → PortalAuth → client / model`. `PortalAuth` dùng `portalApi.post`, `setPortalToken`. | Chỉ tham khảo các trường và nhánh hiển thị. Không import, sửa hoặc gọi transport/session. |
| Prototype | `dist/index.html → styles.css + app.js → DOM + timer` | Tạo riêng; validation, thông báo và loading chỉ trong bộ nhớ tab. `connect-src 'none'` và `form-action 'none'` chặn kết nối/gửi form từ bản mẫu. |
| Luồng phụ | Quên mật khẩu, tạo tài khoản, xác minh email | Giữ lối vào bằng nút, chỉ hiện thông báo mô phỏng. Không tạo các view giai đoạn 2. |
| UI thích ứng | Desktop hai cột → tablet/mobile một cột | Kiểm tra overflow, nhãn, focus, trạng thái và ảnh. |
| Backend/DB/ML | Không có cạnh gọi từ prototype | Không cần chạy test nghiệp vụ có ghi dữ liệu. Không thay auth, quyền, quy trình, SLA hoặc ML. |

CodeGraph chỉ index các thư mục trong `.codegraphrc.json`; `prototypes/` ở ngoài allowlist. Dùng graph để kiểm tra biên với ứng dụng hiện tại, không thay cấu hình graph để đưa prototype vào source chính. Kiểm tra graph lại sau khi hoàn tất.

## Kiểm chứng có thể chạy lại

```powershell
node prototypes/enterprise-portal-login/verify.mjs
```

Script dùng Chrome đã cài và CDP, không cài dependency; chỉ mở server loopback cổng ngẫu nhiên trỏ vào `dist/` và browser profile riêng trong `evidence/`. Tự đóng Chrome/server sau kiểm tra. Ảnh và kết quả JSON nằm trong `evidence/`; browser profile sinh ra được Git ignore. Không thực thi script kiểm thử ứng dụng SME.

## Tiêu chí bàn giao

- Có thể mở bản mẫu độc lập, không cần hệ thống SME chạy.
- Hiển thị nội dung tiếng Việt, teal #0F766E, thích ứng 1440/390 px.
- Có mặc định, lỗi tổng quát, lỗi từng trường và đang xử lý.
- Các thao tác không tạo tài khoản/phiên, không ghi storage, không gọi API.
- Có bằng chứng trình duyệt; mức duyệt thẩm mỹ do PO quyết định.
