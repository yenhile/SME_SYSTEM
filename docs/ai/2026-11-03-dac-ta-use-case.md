# Đặc tả use case — Hệ thống SME Loan Workflow

Tài liệu có 3 phần: (A) hướng dẫn cho người viết tiếp, (B) danh sách use case cần đặc tả, (C) các use case đã viết mẫu.

---

## A. Hướng dẫn cho người viết tiếp

### A.1. Phạm vi
- Hệ thống có **5 actor**: Cán bộ tín dụng, Cán bộ thẩm quyền, Quản lý chi nhánh, Quản trị viên và **Doanh nghiệp** (dùng cổng doanh nghiệp riêng, tài khoản riêng).
- Doanh nghiệp chỉ tham gia: đăng ký, lập đề nghị vay, theo dõi, và phản hồi yêu cầu của ngân hàng. Hệ thống chỉ là kênh trao đổi, không ra quyết định tín dụng; dự báo ML không hiển thị cho doanh nghiệp.
- Không đặc tả cấp trên và "Quản lý vấn đề hồ sơ" (menu đang được gỡ).
- ML chỉ cảnh báo nguy cơ trễ SLA, không phải quyết định tín dụng.

### A.2. Mẫu bảng cho mỗi use case
Theo mẫu đồ án nhà hàng:
- Bảng thông tin: Tên use case, Mô tả, Tiền điều kiện, Hậu điều kiện, Actor chính.
- Bảng **Luồng sự kiện chính (Basic flow)**: 2 cột Actor | System.
- Bảng **Luồng sự kiện thay thế (Alternative flow)**: chỉ thêm nếu có.
- Bảng **Luồng sự kiện ngoại lệ (Exception flow)**: chỉ thêm nếu có.

### A.3. Quy tắc viết
1. **Chỉ viết đặc tả cho use case phụ (extend).** Use case chính có use case phụ thì không viết cho use case chính. Use case chính không có use case phụ thì viết cho chính nó. Mô tả của use case phụ ghi "Mở rộng từ: <use case chính>".
2. **Viết ngắn gọn.** Mô tả một câu. Số bước tùy chức năng, từ lúc bắt đầu đến lúc kết thúc, không cố định.
3. Cột **Actor** ghi thao tác của người dùng ("Nhấn chọn...", "Chọn...", "Nhập..."). Cột **System** chỉ ghi hệ thống **hiển thị gì hoặc làm gì** để đáp lại thao tác đó ("Hiển thị giao diện...", "Cập nhật thành công"). Không giải thích cơ chế bên trong (khóa, băm, phiên bản, tên API). Mỗi phản hồi của hệ thống là **một bước riêng**: nếu hệ thống vừa chuyển trạng thái vừa thông báo thì tách thành hai bước liên tiếp (ví dụ 6. Chuyển trạng thái "Đang thẩm định"; 7. Thông báo "Đã trình tờ trình"), dòng thứ hai để trống cột Actor, không dồn vào một ô.
4. Luồng chính là happy case. **Luồng thay thế và ngoại lệ không bắt buộc**, chỉ thêm khi chức năng thật sự có rẽ nhánh hoặc lỗi đáng nêu, không thêm cho đủ. Không cần dòng "Nhấn nút Hủy" trừ khi có ý nghĩa riêng. Nếu có thì đánh số theo bước gốc (5.1, 5.2...).
5. Tiền điều kiện viết như mẫu: "Đăng nhập thành công vào hệ thống. Được phân quyền ..." rồi thêm điều kiện riêng nếu có.
6. Dùng đúng chữ trên giao diện cho tên menu và nút. Tên menu thật (từ `frontend/src/navigation.ts`): Dashboard tổng quan; Danh sách hồ sơ; Thẩm định & phê duyệt; Điều chuyển & phân công; Cấu hình SLA; Liên hệ cá nhân (quản lý người dùng của Admin); Liên hệ doanh nghiệp. Tên nút lấy từ Master và code, nếu không chắc thì mở `frontend/src/components/` để đối chiếu, không tự đặt.
7. Không bịa chức năng. Chỗ không chắc ghi `[CẦN XÁC NHẬN: ...]`.

### A.4. Nguồn tra cứu
| Cần biết | Xem ở đâu |
|---|---|
| Luồng nghiệp vụ, ngoại lệ từng nhóm | `docs/SME_MASTER.md` (nhánh `main`), mục 3, Nhóm 1–7, phần (d) và (e) |
| Quyền theo vai trò | `docs/Phan_quyen_va_luong_nghiep_vu.md`, `docs/Ma_tran_AC_phan_quyen_1_chi_nhanh.md` (nhánh `main`) |
| Tên menu | `frontend/src/navigation.ts` |
| Màn hình và nút | `frontend/src/components/` (`PortalIntakeQueue.tsx`, `AppraisalPanel.tsx`, `AssignmentsView.tsx`, `AdminView.tsx`, `CloseOverdueForm.tsx`, `SupplementPanel.tsx`, `DashboardView.tsx`) |
| API và quyền vai trò | `backend/src/modules/*/*.controller.ts` |

---

## B. Danh sách use case cần đặc tả

Sơ đồ tổng quát có 12 use case chính, mỗi cái include "Đăng nhập". Cột "Đặc tả cần viết" là đơn vị phải viết.

### B.0. Dùng chung (cả 5 actor, đặt đầu tiên)
| STT | Use case chính | Đặc tả cần viết | Trạng thái |
|---|---|---|---|
| 0 | Đăng nhập | (viết cho chính nó) | **Đã viết (C.0)** |

### B.1. Cán bộ tín dụng
| STT | Use case chính | Đặc tả cần viết | Trạng thái |
|---|---|---|---|
| 1 | Tiếp nhận hồ sơ vay | 1.1 Kiểm tra checklist | Chưa làm |
| | | 1.2 Trả sửa đề nghị | **Đã viết (C.2)** |
| | | 1.3 Đối soát công ty | Chưa làm |
| | | 1.4 Tiếp nhận đề nghị | **Đã viết (C.1)** |
| 2 | Quản lý chứng từ | 2.1 Yêu cầu bổ sung | Chưa làm |
| | | 2.2 Giải quyết bổ sung | Chưa làm |
| | | 2.3 Xác nhận đủ hồ sơ | Chưa làm |
| 3 | Xác định hạn mức | (viết cho chính nó) | Chưa làm |
| 4 | Lập tờ trình | 4.1 Lưu nháp tờ trình | Chưa làm |
| | | 4.2 Trình tờ trình (gồm Bản 2 sau khi làm rõ) | Chưa làm |
| 5 | Tra cứu hồ sơ vay | (viết cho chính nó) | Chưa làm |

### B.2. Cán bộ thẩm quyền
| STT | Use case chính | Đặc tả cần viết | Trạng thái |
|---|---|---|---|
| 6 | Thẩm định hồ sơ vay | 6.1 Xem xét tờ trình | Chưa làm |
| | | 6.2 Yêu cầu làm rõ tờ trình | Chưa làm |
| 7 | Quyết định tín dụng | 7.1 Phê duyệt | **Đã viết (C.3)** |
| | | 7.2 Từ chối | **Đã viết (C.4)** |

### B.3. Quản lý chi nhánh
| STT | Use case chính | Đặc tả cần viết | Trạng thái |
|---|---|---|---|
| 8 | Phân công hồ sơ | 8.1 Phân công cán bộ tín dụng (lần đầu) | **Đã viết (C.11)** |
| | | 8.2 Điều chuyển hồ sơ | **Đã viết (C.12)** |
| | | 8.3 Duyệt đề nghị điều phối | Chưa làm |
| | | 8.4 Duyệt báo xung đột lợi ích (COI) | Chưa làm |
| | | 8.5 Duyệt đối soát công ty | Chưa làm |
| 9 | Theo dõi hồ sơ | 9.1 Xem cảnh báo xử lý chậm | **Đã viết (C.13)** |
| | | 9.2 Xem báo cáo thống kê | **Đã viết (C.14)** |
| 10 | Đóng hồ sơ quá hạn | (viết cho chính nó) | **Đã viết (C.15)** |

### B.4. Quản trị viên
| STT | Use case chính | Đặc tả cần viết | Trạng thái |
|---|---|---|---|
| 11 | Quản lý người dùng | 11.1 Thêm người dùng | **Đã viết (C.16)** |
| | | 11.2 Sửa người dùng (thông tin, vai trò) | **Đã viết (C.17)** |
| | | 11.3 Khóa và mở khóa tài khoản | **Đã viết (C.5)** |
| 12 | Cấu hình SLA | (viết cho chính nó) | **Đã viết (C.18)** |

Hệ thống **không có chức năng xóa người dùng** (backend chỉ có xem, thêm, sửa). Không viết "Xóa người dùng".

### B.5. Doanh nghiệp
| STT | Use case chính | Đặc tả cần viết | Trạng thái |
|---|---|---|---|
| 13 | Đăng ký tài khoản | (viết cho chính nó) | **Đã viết (C.6)** |
| 14 | Lập đề nghị vay | (viết cho chính nó) | **Đã viết (C.7)** |
| 15 | Theo dõi đề nghị | (viết cho chính nó) | **Đã viết (C.8)** |
| 16 | Phản hồi yêu cầu của ngân hàng | 16.1 Sửa đề nghị bị trả lại | **Đã viết (C.9)** |
| | | 16.2 Bổ sung chứng từ | **Đã viết (C.10)** |

Use case 14, 15, 16 include "Đăng nhập" (dùng chung, doanh nghiệp vào qua cổng doanh nghiệp). Use case 13 không include "Đăng nhập" vì chưa có tài khoản.

Tổng: **33 đặc tả** (Đăng nhập 1, CBTD 11, Thẩm quyền 4, QLCN 8, Admin 4, Doanh nghiệp 5). Đã viết 19, còn 14.

---

## C. Các use case đã viết mẫu

### C.0. Đăng nhập (include bởi mọi use case khác)

| | |
|---|---|
| **Tên use case** | Đăng nhập |
| **Mô tả** | Cho phép người dùng đăng nhập vào hệ thống (doanh nghiệp đăng nhập bằng "Email" và "Mật khẩu" ở cổng doanh nghiệp). |
| **Tiền điều kiện** | Đã có tài khoản hợp lệ và thông tin đăng nhập. Doanh nghiệp đã đăng ký và xác minh email. |
| **Hậu điều kiện** | Đăng nhập thành công. |
| **Actor chính** | Cán bộ tín dụng, Cán bộ thẩm quyền, Quản lý chi nhánh, Quản trị viên, Doanh nghiệp |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Truy cập hệ thống. | 2. Hiển thị form đăng nhập gồm "Tên đăng nhập" và "Mật khẩu". |
| 3. Điền tên đăng nhập và mật khẩu vào form. | |
| 4. Nhấn nút "Đăng nhập". | 5. Kiểm tra tính hợp lệ của thông tin đăng nhập. |
| | 6. Nếu hợp lệ, xác thực và cho truy cập trang đầu theo vai trò (Cán bộ tín dụng: "Danh sách hồ sơ"; Quản trị viên: "Liên hệ cá nhân"; Cán bộ thẩm quyền và Quản lý chi nhánh: "Dashboard tổng quan"; Doanh nghiệp: trang "Đề nghị vay của bạn" trên cổng doanh nghiệp). |

**Luồng sự kiện ngoại lệ (Exception flow)**

6.1. Hệ thống thông báo sai tên đăng nhập hoặc mật khẩu (hoặc tài khoản bị khóa). Quay lại bước 3. `[CẦN XÁC NHẬN: nội dung thông báo lỗi trong LoginPage.tsx]`

---

### C.1. Tiếp nhận đề nghị (mở rộng từ "Tiếp nhận hồ sơ vay")

| | |
|---|---|
| **Tên use case** | Tiếp nhận đề nghị |
| **Mô tả** | Cho phép cán bộ tín dụng tiếp nhận đề nghị vay đã đạt checklist để tạo khoản vay. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền cán bộ tín dụng và được giao phụ trách đề nghị. Checklist của đề nghị đã đạt toàn bộ. |
| **Hậu điều kiện** | Khoản vay được tạo, trạng thái "Đã tiếp nhận". |
| **Actor chính** | Cán bộ tín dụng |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Danh sách hồ sơ". | 2. Hiển thị giao diện "Danh sách hồ sơ". |
| 3. Chọn đề nghị cần tiếp nhận. | 4. Hiển thị chi tiết đề nghị và kết quả checklist. |
| 5. Nhấn nút "Tiếp nhận đề nghị". | 6. Tạo khoản vay, chuyển trạng thái "Đã tiếp nhận". |
| | 7. Thông báo "Tiếp nhận thành công". |

**Luồng sự kiện thay thế (Alternative flow)**

3.1. Mã số thuế đã có trong hệ thống nhưng thông tin khai báo khác trọng yếu: hệ thống yêu cầu đối soát công ty. Chuyển sang use case "Đối soát công ty".

---

### C.2. Trả sửa đề nghị (mở rộng từ "Tiếp nhận hồ sơ vay")

| | |
|---|---|
| **Tên use case** | Trả sửa đề nghị |
| **Mô tả** | Cho phép cán bộ tín dụng trả đề nghị về để doanh nghiệp chỉnh sửa khi checklist có mục chưa đạt. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền cán bộ tín dụng và được giao phụ trách đề nghị. |
| **Hậu điều kiện** | Đề nghị chuyển trạng thái "Đã trả sửa". |
| **Actor chính** | Cán bộ tín dụng |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Danh sách hồ sơ". | 2. Hiển thị giao diện "Danh sách hồ sơ". |
| 3. Chọn đề nghị cần xử lý. | 4. Hiển thị chi tiết đề nghị và checklist. |
| 5. Chọn "Cần chỉnh sửa" cho mục chưa đạt và nhập hướng dẫn. | 6. Ghi nhận mục cần chỉnh sửa. |
| 7. Nhấn nút "Trả đề nghị để chỉnh sửa". | 8. Chuyển trạng thái "Đã trả sửa". |
| | 9. Thông báo "Trả sửa thành công". |

---

### C.3. Phê duyệt (mở rộng từ "Quyết định tín dụng")

| | |
|---|---|
| **Tên use case** | Phê duyệt |
| **Mô tả** | Cho phép cán bộ thẩm quyền phê duyệt khoản vay kèm số tiền và lãi suất. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền cán bộ thẩm quyền và độc lập với hồ sơ (không phải người thụ lý, tiếp nhận hay lập tờ trình). Hồ sơ đã có tờ trình. |
| **Hậu điều kiện** | Hồ sơ chuyển trạng thái "Đã phê duyệt", kết thúc xử lý. |
| **Actor chính** | Cán bộ thẩm quyền |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Thẩm định & phê duyệt". | 2. Hiển thị giao diện "Thẩm định & phê duyệt". |
| 3. Chọn hồ sơ cần quyết định. | 4. Hiển thị chi tiết hồ sơ và tờ trình. |
| 5. Nhấn nút "Phê duyệt". | 6. Hiển thị form nhập số tiền và lãi suất phê duyệt. |
| 7. Nhập số tiền, lãi suất và nhấn nút "Xác nhận Phê duyệt". | 8. Chuyển trạng thái "Đã phê duyệt". |
| | 9. Thông báo "Phê duyệt thành công". |

---

### C.4. Từ chối (mở rộng từ "Quyết định tín dụng")

| | |
|---|---|
| **Tên use case** | Từ chối |
| **Mô tả** | Cho phép cán bộ thẩm quyền từ chối khoản vay kèm lý do chuẩn và giải trình. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền cán bộ thẩm quyền và độc lập với hồ sơ. Hồ sơ đã có tờ trình. |
| **Hậu điều kiện** | Hồ sơ chuyển trạng thái "Đã từ chối", kết thúc xử lý. |
| **Actor chính** | Cán bộ thẩm quyền |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Thẩm định & phê duyệt". | 2. Hiển thị giao diện "Thẩm định & phê duyệt". |
| 3. Chọn hồ sơ cần quyết định. | 4. Hiển thị chi tiết hồ sơ và tờ trình. |
| 5. Nhấn nút "Từ chối". | 6. Hiển thị form gồm danh sách lý do chuẩn (TC01–TC05) và ô giải trình. |
| 7. Chọn lý do, nhập giải trình và nhấn nút "Xác nhận Từ chối". | 8. Chuyển trạng thái "Đã từ chối". |
| | 9. Thông báo "Từ chối thành công". |

---

### C.5. Khóa và mở khóa tài khoản (mở rộng từ "Quản lý người dùng")

| | |
|---|---|
| **Tên use case** | Khóa và mở khóa tài khoản |
| **Mô tả** | Cho phép quản trị viên khóa hoặc mở khóa tài khoản cán bộ. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản trị viên. |
| **Hậu điều kiện** | Trạng thái hoạt động của tài khoản được cập nhật. |
| **Actor chính** | Quản trị viên |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Liên hệ cá nhân". | 2. Hiển thị giao diện danh sách người dùng. |
| 3. Chọn tài khoản và nhấn nút "Khóa" (hoặc "Mở khóa"). | 4. Hiển thị thông báo "Bạn có chắc muốn thay đổi trạng thái tài khoản?". |
| 5. Nhấn nút "Xác nhận". | 6. Cập nhật trạng thái tài khoản. |
| | 7. Thông báo "Cập nhật thành công". |

**Luồng sự kiện ngoại lệ (Exception flow)**

5.1. Tự khóa tài khoản của chính mình: hệ thống báo không thể thực hiện. Kết thúc use case.
5.2. Cán bộ còn hồ sơ chưa hoàn tất hoặc chưa bàn giao: hệ thống báo lỗi kèm số hồ sơ cần bàn giao. Kết thúc use case.

---

### C.6. Đăng ký tài khoản

| | |
|---|---|
| **Tên use case** | Đăng ký tài khoản |
| **Mô tả** | Cho phép doanh nghiệp tạo tài khoản và xác minh email để dùng cổng doanh nghiệp. |
| **Tiền điều kiện** | Có địa chỉ email hợp lệ và truy cập được email đó. |
| **Hậu điều kiện** | Tài khoản doanh nghiệp được tạo và đã xác minh email, có thể đăng nhập. |
| **Actor chính** | Doanh nghiệp |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Truy cập cổng doanh nghiệp. | 2. Hiển thị form đăng nhập. |
| 3. Nhấn "Tạo tài khoản doanh nghiệp". | 4. Hiển thị form đăng ký gồm "Email", "Người liên hệ", "Số điện thoại", "Mật khẩu". |
| 5. Nhập thông tin và nhấn nút "Đăng ký". | 6. Tạo tài khoản và gửi mã xác minh qua email. |
| | 7. Thông báo "Tài khoản đã được tạo. Vui lòng kiểm tra email để xác minh." và hiển thị form xác minh. |
| 8. Nhập mã xác minh nhận qua email và nhấn nút "Xác minh email". | 9. Xác minh email thành công. |
| | 10. Thông báo "Email đã được xác minh. Bạn có thể đăng nhập." và quay về form đăng nhập. |

**Luồng sự kiện ngoại lệ (Exception flow)**

6.1. Thông tin không hợp lệ: hệ thống báo lỗi "Mật khẩu cần 8 ký tự trở lên, có chữ và số, tối đa 72 byte." hoặc "Tên liên hệ hoặc điện thoại không hợp lệ.". Quay lại bước 5.
9.1. Mã xác minh sai, hết hạn (mã gồm 6 chữ số, có hiệu lực 10 phút) hoặc đã dùng: hệ thống báo lỗi "Mã xác minh sai, hết hạn hoặc đã dùng.". Doanh nghiệp nhấn "Gửi lại mã xác minh" (chỉ gửi lại được sau 60 giây), hệ thống thông báo "Đã yêu cầu gửi lại mã. Vui lòng kiểm tra email.". Quay lại bước 8.

---

### C.7. Lập đề nghị vay

| | |
|---|---|
| **Tên use case** | Lập đề nghị vay |
| **Mô tả** | Cho phép doanh nghiệp khai thông tin, tải tài liệu và gửi đề nghị vay cho ngân hàng. |
| **Tiền điều kiện** | Đăng nhập thành công vào cổng doanh nghiệp. |
| **Hậu điều kiện** | Đề nghị được gửi cho ngân hàng kiểm tra và khóa chỉnh sửa. |
| **Actor chính** | Doanh nghiệp |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn nút "Tạo đề nghị vay" tại trang "Đề nghị vay của bạn". | 2. Hiển thị giao diện đầu tiên "Thông tin doanh nghiệp". |
| 3. Nhập thông tin doanh nghiệp và nhấn "Tiếp tục". | 4. Hiển thị giao diện "Nhu cầu vay". |
| 5. Nhập nhu cầu vay và nhấn "Tiếp tục". | 6. Hiển thị giao diện "Phương án vốn". |
| 7. Nhập phương án sử dụng vốn và nhấn "Tiếp tục". | 8. Hiển thị giao diện "Hồ sơ tài liệu" theo từng nhóm tài liệu. |
| 9. Chọn tệp cho từng nhóm, tải lên và nhấn "Tiếp tục". | 10. Ghi nhận tài liệu đã tải lên. |
| | 11. Hiển thị giao diện "Rà soát đề nghị" tổng hợp thông tin đã nhập. |
| 12. Nhấn nút "Gửi đề nghị". | 13. Hiển thị xác nhận gửi đề nghị và tài liệu cho ngân hàng, bản gửi sẽ bị khóa chỉnh sửa. |
| 14. Xác nhận gửi. | 15. Gửi đề nghị cho ngân hàng. |
| | 16. Thông báo "Đã gửi đề nghị cho ngân hàng kiểm tra". |

**Luồng sự kiện thay thế (Alternative flow)**

3.1. Doanh nghiệp điền thông tin (ở bất kỳ giao diện nào) và nhấn "Lưu nháp". Hệ thống thông báo "Đã lưu bản nháp trên hệ thống". Doanh nghiệp thoát khỏi biểu mẫu. Kết thúc use case.

**Luồng sự kiện ngoại lệ (Exception flow)**

9.1. Tệp vượt 10 MB hoặc sai định dạng cho phép: hệ thống báo lỗi, không tải lên. Quay lại bước 9.
12.1. Bước "Rà soát đề nghị" còn mục chưa hợp lệ hoặc thiếu nhóm tài liệu: hệ thống liệt kê các mục cần sửa, nút gửi chưa dùng được; doanh nghiệp nhấn vào mục để quay lại bước tương ứng. `[CẦN XÁC NHẬN: thông báo thực tế]`

---

### C.8. Theo dõi đề nghị

| | |
|---|---|
| **Tên use case** | Theo dõi đề nghị |
| **Mô tả** | Cho phép doanh nghiệp xem danh sách đề nghị và tiến độ xử lý của từng đề nghị. |
| **Tiền điều kiện** | Đăng nhập thành công vào cổng doanh nghiệp. Đã có ít nhất một đề nghị. |
| **Hậu điều kiện** | Doanh nghiệp xem được tiến độ xử lý của đề nghị. |
| **Actor chính** | Doanh nghiệp |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Truy cập trang "Đề nghị vay của bạn". | 2. Hiển thị "Danh sách đề nghị" và số lượng theo nhóm: "Bản nháp đang chuẩn bị", "Đã gửi, chờ ngân hàng tiếp nhận", "Ngân hàng đã tiếp nhận". |
| 3. Chọn một đề nghị đã gửi. | 4. Hiển thị "Tiến độ xử lý hồ sơ" gồm các mốc xử lý, trạng thái hiện tại, ngày gửi và ngày tiếp nhận. |

**Luồng sự kiện thay thế (Alternative flow)**

3.1. Chọn đề nghị còn là bản nháp: hệ thống mở biểu mẫu để tiếp tục lập đề nghị (xem "Lập đề nghị vay").
4.1. Đề nghị bị từ chối: hệ thống hiển thị thêm "Lý do" từ chối. `[CẦN XÁC NHẬN: phạm vi thông tin doanh nghiệp được xem khi bị từ chối]`

---

### C.9. Sửa đề nghị bị trả lại (mở rộng từ "Phản hồi yêu cầu của ngân hàng")

| | |
|---|---|
| **Tên use case** | Sửa đề nghị bị trả lại |
| **Mô tả** | Mở rộng từ: Phản hồi yêu cầu của ngân hàng. Cho phép doanh nghiệp chỉnh sửa theo danh sách cán bộ trả về và gửi lại đề nghị. |
| **Tiền điều kiện** | Đăng nhập thành công vào cổng doanh nghiệp. Đề nghị đã bị ngân hàng trả sửa (chưa tiếp nhận). |
| **Hậu điều kiện** | Đề nghị được gửi lại cho ngân hàng kiểm tra. |
| **Actor chính** | Doanh nghiệp |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Chọn đề nghị bị trả lại trong "Danh sách đề nghị". | 2. Hiển thị tiến độ và "Danh sách cần chỉnh sửa" gồm từng mục kèm hướng dẫn của cán bộ. |
| 3. Chỉnh sửa thông tin và tải lại tài liệu theo các mục được yêu cầu. | 4. Ghi nhận thay đổi. |
| 5. Nhấn nút "Gửi lại đề nghị". | 6. Hiển thị xác nhận gửi. |
| 7. Xác nhận gửi. | 8. Gửi lại đề nghị cho ngân hàng. |
| | 9. Thông báo "Đã gửi đề nghị cho ngân hàng kiểm tra". |

**Luồng sự kiện thay thế (Alternative flow)**

1.1. Doanh nghiệp tự phát hiện thông tin cần sửa khi đề nghị đã gửi, chưa được tiếp nhận: nhập "Nội dung cần chỉnh sửa" và nhấn "Đề nghị ngân hàng cho chỉnh sửa". Ngân hàng xem xét trả sửa, thao tác này chưa tự mở khóa đề nghị. Kết thúc use case.

---

### C.10. Bổ sung chứng từ (mở rộng từ "Phản hồi yêu cầu của ngân hàng")

| | |
|---|---|
| **Tên use case** | Bổ sung chứng từ |
| **Mô tả** | Mở rộng từ: Phản hồi yêu cầu của ngân hàng. Cho phép doanh nghiệp tải và gửi chứng từ ngân hàng yêu cầu bổ sung sau khi tiếp nhận. |
| **Tiền điều kiện** | Đăng nhập thành công vào cổng doanh nghiệp. Đề nghị đã được tiếp nhận và có yêu cầu bổ sung đang mở. |
| **Hậu điều kiện** | Tài liệu bổ sung được gửi cho ngân hàng kiểm tra. |
| **Actor chính** | Doanh nghiệp |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Truy cập trang "Đề nghị vay của bạn". | 2. Hiển thị thông báo số yêu cầu bổ sung đang mở. |
| 3. Chọn đề nghị đã tiếp nhận. | 4. Hiển thị mục "Bổ sung hồ sơ sau tiếp nhận" gồm nội dung yêu cầu, hạn nộp và các mục "Chờ tài liệu". |
| 5. Chọn tệp cho từng mục và nhấn nút "Tải lên". | 6. Ghi nhận tệp. |
| | 7. Thông báo "Đã tải tài liệu. Hãy gửi bổ sung khi đã chuẩn bị đủ." |
| 8. Nhấn nút "Gửi tài liệu bổ sung". | 9. Gửi tài liệu cho ngân hàng, các mục chuyển "Đã gửi, chờ kiểm tra". |
| | 10. Thông báo "Đã gửi tài liệu bổ sung để ngân hàng kiểm tra." |

---

### C.11. Phân công cán bộ tín dụng (mở rộng từ "Phân công hồ sơ")

| | |
|---|---|
| **Tên use case** | Phân công cán bộ tín dụng |
| **Mô tả** | Mở rộng từ: Phân công hồ sơ. Cho phép quản lý chi nhánh giao đề nghị mới từ doanh nghiệp cho một cán bộ tín dụng. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản lý chi nhánh. Đề nghị của doanh nghiệp đã gửi và chưa được phân công. |
| **Hậu điều kiện** | Đề nghị được giao cho cán bộ tín dụng đã chọn. |
| **Actor chính** | Quản lý chi nhánh |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Danh sách hồ sơ". | 2. Hiển thị giao diện "Danh sách hồ sơ". |
| 3. Chọn đề nghị cần phân công trong mục "Đề nghị từ cổng doanh nghiệp". | 4. Hiển thị chi tiết đề nghị và form "Phân công cán bộ tín dụng", mỗi cán bộ kèm số hồ sơ đang xử lý và số đề nghị chờ tiếp nhận. |
| 5. Chọn cán bộ tín dụng, nhập ghi chú (nếu có) và nhấn nút "Phân công đề nghị". | 6. Hiển thị xác nhận "Xác nhận phân công đề nghị cho cán bộ đã chọn?". |
| 7. Xác nhận. | 8. Lưu phân công. |
| | 9. Thông báo "Đã lưu phân công.". |

**Luồng sự kiện ngoại lệ (Exception flow)**

5.1. Chưa chọn cán bộ: hệ thống báo "Vui lòng chọn cán bộ tín dụng.". Quay lại bước 5.

---

### C.12. Điều chuyển hồ sơ (mở rộng từ "Phân công hồ sơ")

| | |
|---|---|
| **Tên use case** | Điều chuyển hồ sơ |
| **Mô tả** | Mở rộng từ: Phân công hồ sơ. Cho phép quản lý chi nhánh chuyển hồ sơ đang xử lý sang cán bộ tín dụng khác để cân bằng khối lượng công việc. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản lý chi nhánh. Hồ sơ đang trong quá trình xử lý. |
| **Hậu điều kiện** | Hồ sơ được chuyển cho cán bộ tín dụng mới, lý do điều chuyển được lưu lại. |
| **Actor chính** | Quản lý chi nhánh |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Điều chuyển & phân công". | 2. Hiển thị giao diện "Điều chuyển & phân công" gồm bảng tải công việc của từng cán bộ và danh sách hồ sơ đang xử lý. |
| 3. Nhấn nút "Điều chuyển" ở hồ sơ cần chuyển. | 4. Hiển thị form điều chuyển gồm cán bộ đang phụ trách, "Chọn Cán bộ tiếp nhận mới" và "Lý do điều chuyển". |
| 5. Chọn cán bộ mới, nhập lý do và nhấn nút "Xác nhận Điều chuyển". | 6. Chuyển hồ sơ sang cán bộ mới. |
| | 7. Thông báo "Điều chuyển hồ sơ thành công!". |

**Luồng sự kiện ngoại lệ (Exception flow)**

5.1. Không điều chuyển được: hệ thống báo lỗi. Quay lại bước 5. `[CẦN XÁC NHẬN: các trường hợp lỗi cụ thể từ backend]`

---

### C.13. Xem cảnh báo xử lý chậm (mở rộng từ "Theo dõi hồ sơ")

| | |
|---|---|
| **Tên use case** | Xem cảnh báo xử lý chậm |
| **Mô tả** | Mở rộng từ: Theo dõi hồ sơ. Cho phép quản lý chi nhánh xem các hồ sơ có nguy cơ trễ hạn SLA. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản lý chi nhánh. |
| **Hậu điều kiện** | Quản lý chi nhánh xem được danh sách hồ sơ có nguy cơ trễ hạn. |
| **Actor chính** | Quản lý chi nhánh |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Dashboard tổng quan". | 2. Hiển thị giao diện "Dashboard tổng quan". |
| | 3. Hiển thị số hồ sơ "Cảnh báo Đỏ (AI High Risk)" và bảng hồ sơ nguy cơ trễ hạn gồm mức độ rủi ro, xác suất trễ. |

Ghi chú: "Cảnh báo" ở đây là dự báo nguy cơ trễ SLA, không phải quyết định tín dụng.

---

### C.14. Xem báo cáo thống kê (mở rộng từ "Theo dõi hồ sơ")

| | |
|---|---|
| **Tên use case** | Xem báo cáo thống kê |
| **Mô tả** | Mở rộng từ: Theo dõi hồ sơ. Cho phép quản lý chi nhánh xem số liệu tổng hợp về hồ sơ và tỷ lệ đúng hạn SLA. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản lý chi nhánh. |
| **Hậu điều kiện** | Quản lý chi nhánh xem được số liệu thống kê. |
| **Actor chính** | Quản lý chi nhánh |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Dashboard tổng quan". | 2. Hiển thị giao diện "Dashboard tổng quan". |
| | 3. Hiển thị các chỉ số "Hồ sơ đang xử lý", "Tỷ lệ đúng hạn SLA", "Hồ sơ đã phê duyệt" và biểu đồ "Số lượt trễ hạn", "Tỷ lệ trễ hạn (%)". `[CẦN XÁC NHẬN: biểu đồ thống kê theo tiêu chí nào]` |

---

### C.15. Đóng hồ sơ quá hạn

| | |
|---|---|
| **Tên use case** | Đóng hồ sơ quá hạn |
| **Mô tả** | Cho phép quản lý chi nhánh đóng hồ sơ khi doanh nghiệp quá hạn bổ sung chứng từ. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản lý chi nhánh. Hồ sơ đang chờ bổ sung và có yêu cầu bổ sung đã quá hạn. |
| **Hậu điều kiện** | Hồ sơ chuyển sang "Đã đóng (quá hạn bổ sung)" và bị khóa mọi thao tác. |
| **Actor chính** | Quản lý chi nhánh |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Danh sách hồ sơ". | 2. Hiển thị giao diện "Danh sách hồ sơ". |
| 3. Chọn hồ sơ quá hạn bổ sung. | 4. Hiển thị chi tiết hồ sơ. |
| 5. Nhấn nút "Đóng hồ sơ do quá hạn". | 6. Hiển thị form "Đóng hồ sơ do quá hạn" gồm ô "Lý do đóng hồ sơ (bắt buộc)". |
| 7. Nhập lý do và nhấn nút "Xác nhận đóng hồ sơ". | 8. Chuyển trạng thái "Đã đóng (quá hạn bổ sung)", khóa hồ sơ. |
| | 9. Cập nhật hồ sơ trong danh sách. `[CẦN XÁC NHẬN: có thông báo thành công không]` |

**Luồng sự kiện ngoại lệ (Exception flow)**

7.1. Không đóng được: hệ thống hiển thị "Lỗi: ..." kèm nguyên nhân. Quay lại bước 7.

---

### C.16. Thêm người dùng (mở rộng từ "Quản lý người dùng")

| | |
|---|---|
| **Tên use case** | Thêm người dùng |
| **Mô tả** | Mở rộng từ: Quản lý người dùng. Cho phép quản trị viên tạo tài khoản và cấp vai trò cho cán bộ. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản trị viên. |
| **Hậu điều kiện** | Tài khoản mới được tạo kèm vai trò đã chọn. |
| **Actor chính** | Quản trị viên |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Liên hệ cá nhân". | 2. Hiển thị giao diện danh sách tài khoản. |
| 3. Nhấn nút "Tạo mới liên hệ". | 4. Hiển thị form "Tạo tài khoản" gồm "Tên đăng nhập", "Mật khẩu ban đầu", "Email", "Họ tên", "Chi nhánh", "Điện thoại" và "Vai trò (chọn ít nhất một)". |
| 5. Nhập thông tin, chọn vai trò và nhấn nút "Lưu tài khoản". | 6. Tạo tài khoản. |
| | 7. Thông báo "Đã lưu tài khoản và vai trò." |

**Luồng sự kiện ngoại lệ (Exception flow)**

6.1. Thông tin không hợp lệ (ví dụ tên đăng nhập đã tồn tại, mật khẩu dưới 8 ký tự): hệ thống báo lỗi. Quay lại bước 5. `[CẦN XÁC NHẬN: nội dung thông báo lỗi từ backend]`

---

### C.17. Sửa người dùng (mở rộng từ "Quản lý người dùng")

| | |
|---|---|
| **Tên use case** | Sửa người dùng |
| **Mô tả** | Mở rộng từ: Quản lý người dùng. Cho phép quản trị viên sửa thông tin và vai trò của tài khoản. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản trị viên. |
| **Hậu điều kiện** | Thông tin và vai trò của tài khoản được cập nhật. |
| **Actor chính** | Quản trị viên |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Liên hệ cá nhân". | 2. Hiển thị giao diện danh sách tài khoản. |
| 3. Nhấn nút "Sửa / Cấp quyền" ở tài khoản cần sửa. | 4. Hiển thị form "Cập nhật tài khoản" gồm "Họ tên", "Chi nhánh", "Điện thoại", "Vai trò (chọn ít nhất một)". |
| 5. Sửa thông tin, đổi vai trò và nhấn nút "Lưu tài khoản". | 6. Cập nhật tài khoản. |
| | 7. Thông báo "Đã lưu tài khoản và vai trò." |

**Luồng sự kiện ngoại lệ (Exception flow)**

6.1. Không cập nhật được (ví dụ bỏ vai trò của chính mình hoặc tài khoản còn hồ sơ chưa bàn giao): hệ thống báo lỗi. Quay lại bước 5. `[CẦN XÁC NHẬN: các trường hợp bị chặn và nội dung lỗi]`

---

### C.18. Cấu hình SLA

| | |
|---|---|
| **Tên use case** | Cấu hình SLA |
| **Mô tả** | Cho phép quản trị viên đổi tên công đoạn và thời gian SLA chuẩn của từng công đoạn xử lý. |
| **Tiền điều kiện** | Đăng nhập thành công vào hệ thống. Được phân quyền quản trị viên. |
| **Hậu điều kiện** | Định mức SLA mới được lưu và áp dụng cho công đoạn mở sau khi lưu. |
| **Actor chính** | Quản trị viên |

**Luồng sự kiện chính (Basic flow)**

| Actor | System |
|---|---|
| 1. Nhấn chọn "Cấu hình SLA". | 2. Hiển thị giao diện "Cấu hình SLA" gồm từng công đoạn với "Tên công đoạn" và "SLA (giờ)". |
| 3. Sửa "SLA (giờ)" (hoặc tên công đoạn) của một công đoạn và nhấn nút "Lưu". | 4. Cập nhật công đoạn. |
| | 5. Thông báo "Đã cập nhật <tên công đoạn>." |

**Luồng sự kiện ngoại lệ (Exception flow)**

4.1. Giá trị không hợp lệ (ví dụ SLA nhỏ hơn 1 giờ): hệ thống báo lỗi. Quay lại bước 3. `[CẦN XÁC NHẬN: nội dung lỗi từ backend]`

---

## D. Cần đối chiếu với giao diện thật
- Tên nút và trạng thái ("Tiếp nhận đề nghị", "Đã trả sửa", "Khóa"...) lấy từ Master, chưa đối chiếu từng màn hình.
- Cần xem `AdminView.tsx` để xác nhận tên nút, hộp thoại của quản trị viên.
- Đặc tả doanh nghiệp (C.6 đến C.10) đã đối chiếu chữ với `frontend/src/portal/` và `SupplementPanel.tsx`; các chỗ `[CẦN XÁC NHẬN]` là nội dung thông báo chưa đọc hết hoặc chưa kiểm tra backend.
- 8.3, 8.4, 8.5 (duyệt đề nghị điều phối, báo xung đột lợi ích, đối soát công ty) chưa viết: tìm trong `frontend/src` nhánh hiện tại không thấy màn hình tương ứng. `[CẦN XÁC NHẬN: chức năng còn nằm trong phạm vi không]`
- Còn 14 đặc tả nội bộ chưa viết (xem mục B).
