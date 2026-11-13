# Sổ lỗi test người dùng theo màn hình

Ghi nhận lỗi phát hiện khi test hệ thống dưới góc nhìn người dùng, theo từng màn hình. Mỗi lỗi có kết quả mong đợi và kết quả thực tế để thống nhất trước khi sửa. Sửa xong thì cập nhật cột Trạng thái và ghi bằng chứng kiểm tra lại.

> **Ngoại lệ đã duyệt:** quy định dự án chỉ giữ `SME_MASTER.md` và `SME_KY_THUAT.md` trong `docs`. PO duyệt riêng ngày 09/11/2026 cho phép sổ lỗi này nằm trong `docs`.

## Quy ước

| Trường | Ý nghĩa |
|---|---|
| Mã | `UT-<màn hình>-<số>`, ví dụ `UT-DK-01` |
| Loại | **Lỗi**: hệ thống làm khác quy tắc đã chốt. **Lỗi hiển thị**: sai chữ, sai ngôn ngữ, không ảnh hưởng dữ liệu. **Cải tiến**: chạy đúng nhưng gây khó cho người dùng. **Không phải lỗi**: hành vi đúng thiết kế, ghi lại để tránh báo lặp. |
| Mức | **Chặn**: không hoàn thành được luồng chính, sai dữ liệu, lộ dữ liệu. **Cao**: luồng chính sai. **Vừa**: luồng phụ sai. **Thấp**: hiển thị, chữ. **Rất thấp**: chính tả, canh lề. |
| Trạng thái | Mới · Đã xác nhận · Đang sửa · Đã sửa, chờ kiểm tra lại · Đóng · Không sửa |

## Phiên test

| Ngày | Người test | Môi trường | Phạm vi | Tài khoản dùng |
|---|---|---|---|---|
| 09/11/2026 | Claude (theo yêu cầu PO) | Localhost: cổng `http://localhost:5173/portal`, hộp thư `http://localhost:8025`, commit `dd95420` | Cổng doanh nghiệp: đăng ký → xác minh → đăng nhập → khai 5 bước → gửi đề nghị | Tài khoản QC ghi tại `test-data/portal-doanh-nghiep/README.md` |
| 09/11/2026 (phiên 2) | Claude (theo yêu cầu PO) | Localhost, commit `dd95420`, DB local có dữ liệu demo | Từ phân công `DN-18` đến khi phê duyệt: Quản lý → CBTD → Doanh nghiệp bổ sung → CBTD → Thẩm quyền. Kiểm tra phân quyền bằng cả giao diện và gọi thẳng API. | `nhung.nguyen`, `nam.hoang`, `mai.bui`, `ha.le`, `huy.vu`, `dat.nguyen` (mật khẩu demo), tài khoản QC doanh nghiệp |

**Kết quả chung phiên 2:** luồng chính chạy hết. `DN-18` thành hồ sơ vay `SME-6`, qua bổ sung, xác nhận đủ, tờ trình bản 1, làm rõ, tờ trình bản 2, phê duyệt 7.500.000.000 VNĐ lãi suất 9,5%. Phát hiện 1 lỗi mức Chặn (lộ thông tin cán bộ qua API Portal), 1 lỗi Vừa, 3 lỗi Thấp, 1 điểm cần PO xác nhận.

**Kết quả chung phiên 09/11/2026:** luồng chính chạy hết. Đăng ký, xác minh email, đăng nhập, lưu nháp 5 bước, tải 6 tệp và gửi đề nghị đều thành công. Đề nghị `DN-18` ở trạng thái Chờ phân công (`SUBMITTED` trong DB). Không có lỗi mức Chặn.

---

## Màn hình: Đăng ký tài khoản doanh nghiệp

### UT-DK-01 · Báo lỗi mật khẩu ngắn bằng tiếng Anh

| | |
|---|---|
| Loại · Mức | Lỗi hiển thị · Thấp |
| Trạng thái | Mới |
| Các bước | 1. Mở `/portal` → "Tạo tài khoản doanh nghiệp". 2. Nhập email, người liên hệ, số điện thoại hợp lệ. 3. Nhập mật khẩu `abc`. 4. Bấm "Đăng ký". |
| Kết quả mong đợi | Báo bằng tiếng Việt, cùng cách hiển thị với các lỗi khác của form, ví dụ: "Mật khẩu cần 8 ký tự trở lên, có chữ và số, tối đa 72 byte." |
| Kết quả thực tế | Trình duyệt hiện bong bóng mặc định bằng tiếng Anh: "Please lengthen this text to 8 characters or more (you are currently using 3 characters)." Nhập `abcdefgh` (đủ 8 ký tự, không có số) thì báo đúng tiếng Việt. |
| Nguyên nhân dự kiến | Ô mật khẩu dùng ràng buộc độ dài sẵn có của trình duyệt (`minLength`), nên trình duyệt chặn trước khi form tự kiểm tra. |
| Bằng chứng | Ảnh chụp màn hình trong phiên test 09/11/2026 |

### UT-DK-02 · Không báo người dùng biết thư xác minh nằm ở hộp thư thử nghiệm

| | |
|---|---|
| Loại · Mức | Cải tiến · Thấp |
| Trạng thái | Mới |
| Các bước | 1. Đăng ký bằng một email thật, ví dụ Gmail. 2. Mở hộp thư Gmail. |
| Kết quả mong đợi | Ở môi trường local, màn hình nói rõ thư được gửi vào hộp thư thử nghiệm `http://localhost:8025`, không gửi ra internet. |
| Kết quả thực tế | Màn hình chỉ ghi: "Yêu cầu đã được xử lý. Nếu email chưa xác minh, hãy kiểm tra thư hoặc yêu cầu gửi lại mã…". Người dùng tìm trong Gmail và không thấy thư. PO gặp đúng trường hợp này với địa chỉ Gmail đăng ký lúc 10:30 ngày 09/11/2026. Thư thực tế đã nằm trong hộp thư local. |
| Ghi chú | Việc không gửi thư ra internet là **đúng thiết kế** (DEC-03; backend chưa cấu hình `SMTP_HOST` nên mọi thư vào hộp thư local). Muốn gửi thư thật thì cần PO duyệt cấu hình máy chủ gửi thư. Câu thông báo chung chung là có chủ đích, để không lộ email nào đã tồn tại; chỉ cần bổ sung dòng chỉ dẫn hộp thư khi chạy local. |

---

## Màn hình: Xác minh email (thư gửi đến doanh nghiệp)

### UT-XM-01 · Thư xác minh viết bằng tiếng Anh

| | |
|---|---|
| Loại · Mức | Lỗi hiển thị · Thấp |
| Trạng thái | Mới |
| Các bước | 1. Đăng ký tài khoản mới. 2. Mở hộp thư `http://localhost:8025`. |
| Kết quả mong đợi | Tiêu đề và nội dung thư bằng tiếng Việt, giống thư đặt lại mật khẩu và thư nhắc bổ sung chứng từ. |
| Kết quả thực tế | Tiêu đề "SME Loan email verification", nội dung "Your SME Loan verification code is: …  This code expires in 10 minutes. If you did not register, ignore this email." |
| Vị trí | `backend/src/modules/portal/portal.mailer.ts:23` |

---

## Màn hình: Khai đề nghị vay · Bước 1 Thông tin doanh nghiệp

### UT-B1-01 · Yêu cầu chọn tài liệu nguồn doanh thu trước khi có chỗ tải tài liệu

| | |
|---|---|
| Loại · Mức | Cải tiến · Thấp |
| Trạng thái | Mới |
| Các bước | 1. Tạo đề nghị vay mới. 2. Ở bước 1, kéo xuống mục "Nguồn doanh thu năm". |
| Kết quả mong đợi | Chỉ hỏi tài liệu nguồn doanh thu khi người dùng đã có thể tải tài liệu, hoặc ghi rõ "sẽ chọn sau khi tải báo cáo tài chính ở bước 4". |
| Kết quả thực tế | Bước 1 hiện ô "Tài liệu BCTC nguồn" với danh sách rỗng, vì tài liệu chỉ tải được ở bước 4. Người dùng không thể hoàn thành ô này ở bước 1. Đến bước 4 thì hệ thống mới báo "Cần cung cấp: Tài liệu nguồn doanh thu" và "Cần cung cấp: Xác nhận năm báo cáo hoàn thành". |
| Chưa xác minh | Ô "Tôi xác nhận nguồn doanh thu…" đã tích ở bước 1 nhưng tới bước 4 hiện chưa tích. Phiên test điền form bằng công cụ tự động, nên chưa chắc đây là lỗi lưu dữ liệu. Cần test lại bằng thao tác tay. |

---

## Màn hình: Khai đề nghị vay · Bước 5 Rà soát và gửi

### UT-B5-01 · Tích cam kết xong vẫn không gửi được cho tới khi bấm Lưu nháp

| | |
|---|---|
| Loại · Mức | Cải tiến · Vừa |
| Trạng thái | Mới |
| Các bước | 1. Hoàn thành bước 1–4, đủ 13 mục tài liệu bắt buộc. 2. Sang bước 5. 3. Tích "Tôi được doanh nghiệp cho phép cung cấp hồ sơ này và chịu trách nhiệm về thông tin đã khai." 4. Quan sát nút "Gửi đề nghị". |
| Kết quả mong đợi | Khi mọi mục đã đủ, tích cam kết xong thì nút "Gửi đề nghị" bật ngay. Hoặc hệ thống tự lưu khi tích cam kết. |
| Kết quả thực tế | Nút "Gửi đề nghị" vẫn bị khóa, màn hình vẫn ghi "Bước 5 · 1 mục". Phải bấm "Lưu nháp" thêm một lần thì mới chuyển sang "Sẵn sàng gửi đề nghị" và nút mới bật. Có dòng nhắc nhỏ "Bấm Lưu nháp để kiểm tra nội dung mới nhất, kể cả sau khi xác nhận cam kết", nhưng dễ bị bỏ qua. |
| Tác động | Người dùng tưởng không gửi được hồ sơ, dễ bỏ dở ở bước cuối. |

### UT-B5-02 · Hộp xác nhận gửi dùng hộp mặc định của trình duyệt

| | |
|---|---|
| Loại · Mức | Cải tiến · Rất thấp |
| Trạng thái | Mới |
| Các bước | 1. Ở bước 5, khi đã "Sẵn sàng gửi đề nghị", bấm "Gửi đề nghị". |
| Kết quả mong đợi | Hộp xác nhận cùng giao diện cổng doanh nghiệp, nút ghi "Gửi" và "Hủy". |
| Kết quả thực tế | Hộp xác nhận mặc định của trình duyệt (`window.confirm`) với nội dung "Xác nhận gửi đề nghị và tài liệu hiện tại cho ngân hàng kiểm tra? Bản gửi này được lưu và khóa chỉnh sửa." Nhãn nút theo ngôn ngữ trình duyệt (OK/Cancel), khác giao diện cổng. Một số trình duyệt có thể chặn hộp này. |
| Vị trí | `frontend/src/portal/PortalWizard.tsx:164` |

---

## Màn hình: Cổng doanh nghiệp · Chi tiết đề nghị (dữ liệu API)

### UT-PT-01 · API cổng doanh nghiệp trả về danh tính cán bộ ngân hàng

| | |
|---|---|
| Loại · Mức | Lỗi · **Chặn** (lộ dữ liệu nội bộ cho khách hàng) |
| Trạng thái | Mới · tái hiện 2 lần |
| Quy tắc bị vi phạm | Doanh nghiệp không được xem danh tính cán bộ nội bộ, ghi chú nội bộ, dự báo ML hay thông tin điều phối (SME_MASTER mục 2, Doanh nghiệp, "Giới hạn quyền quan trọng"). |
| Các bước | 1. Quản lý phân công `DN-18` cho `nam.hoang`. 2. Đăng nhập cổng doanh nghiệp bằng tài khoản QC. 3. Mở danh sách đề nghị hoặc chi tiết `DN-18` (trình duyệt gọi `GET /api/portal/requests` và `GET /api/portal/requests/:id`). 4. Xem dữ liệu trả về (công cụ nhà phát triển của trình duyệt, tab Network). |
| Kết quả mong đợi | Dữ liệu trả về cho doanh nghiệp không có thông tin cán bộ: không có họ tên, tên đăng nhập, mã người dùng của người phân công, người tiếp nhận, người phụ trách. |
| Kết quả thực tế | Cả hai API trả về `assignedOfficer: { id, fullName: "Hoàng Văn Nam", username: "nam.hoang" }`, cùng các mã người dùng `assignedTo`, `assignedBy`, `acceptedBy`, `assignedAt`, `assignmentVersion`. Giao diện cổng **không hiển thị** các trường này, nhưng ai mở công cụ nhà phát triển của trình duyệt đều thấy. API `GET /api/portal/requests/:id/status` thì không lộ. |
| Vị trí | `backend/src/modules/portal/portal.service.ts:29` (biến `include` có `assignedOfficer`), `:94` (`list`), `:100` (`one`) trả nguyên bản ghi cho tài khoản doanh nghiệp. |
| Hướng xử lý gợi ý | Khi người gọi là tài khoản doanh nghiệp, chỉ trả các trường công khai; bỏ `assignedOfficer`, `assignedTo`, `assignedBy`, `acceptedBy` và các trường điều phối. Có test chứng minh phản hồi Portal không còn các trường này. |

---

## Màn hình: Dashboard tổng quan (Quản lý) · Bảng cảnh báo sớm

### UT-DB-01 · Hồ sơ hiện cảnh báo của mô hình cũ như cảnh báo hiện tại

| | |
|---|---|
| Loại · Mức | Lỗi · Cao |
| Trạng thái | Đã xác nhận · đã bàn giao cho người phụ trách mô hình (Lỗi mô hình 1) |
| Các bước | Đăng nhập `nhung.nguyen` → Dashboard tổng quan → Bảng Cảnh báo Sớm AI. |
| Kết quả mong đợi | Chỉ hiện cảnh báo của mô hình v4 đúng công đoạn hiện tại; không có thì ghi "Chưa có dự báo". |
| Kết quả thực tế | `SME-2` (đang Thẩm định) hiện "⚠️ Khẩn · 84%", lý do kiểu mô hình cũ ("Cán bộ thẩm quyền đang phụ trách 12 hồ sơ cùng lúc (+26% quá tải)"). Đây là dự báo `v1.0-rf` ngày 02/11, được tính vào ô "Cảnh báo Khẩn". |

### UT-DB-02 · Lý do cảnh báo ghi số giờ còn lại cũ, khác cột SLA

| | |
|---|---|
| Loại · Mức | Lỗi hiển thị · Thấp |
| Trạng thái | Mới |
| Các bước | Dashboard Quản lý hoặc khối "Hồ sơ của tôi cần ưu tiên" của CBTD, xem `SME-20261020-8001`. |
| Kết quả mong đợi | Số giờ còn lại thống nhất giữa cột SLA và phần lý do, hoặc phần lý do ghi rõ thời điểm chấm điểm. |
| Kết quả thực tế | Cột SLA ghi "còn 3,2 giờ làm việc", phần lý do ghi "Đã dùng 107.5/112 giờ làm việc, còn 4.5 giờ". Lý do lấy theo lúc chấm điểm, cột SLA tính theo thời điểm xem. |

---

## Màn hình: Hồ sơ vay (CBTD) · Thời hạn SLA

### UT-SLA-01 · Hiển thị thời gian còn lại sai khi phần giờ làm tròn lên 8

| | |
|---|---|
| Loại · Mức | Lỗi hiển thị · Thấp |
| Trạng thái | Mới · tái hiện trên giao diện và bằng chạy thử hàm |
| Các bước | 1. CBTD tiếp nhận hồ sơ mới (Tiếp nhận 14 ngày). 2. Vài phút sau xem "Hạn SLA". Hoặc: Thẩm quyền mở hồ sơ vừa sang Thẩm định (5 ngày). |
| Kết quả mong đợi | Còn 111,97 giờ → "14 ngày" (hoặc "13 ngày 7,9 giờ"); còn 39,9 giờ → "5 ngày" (hoặc "4 ngày 7,9 giờ"). |
| Kết quả thực tế | Hiện "còn 13 ngày 8 giờ" và "còn 4 ngày 8 giờ". Chạy thử: 111,97 → "13 ngày 8 giờ"; 15,96 → "1 ngày 8 giờ"; 7,96 → "8 giờ". |
| Vị trí | `frontend/src/slaDisplay.ts:37-44` (`workingDurationText` lấy phần nguyên số ngày trước rồi mới làm tròn phần giờ). |

---

## Màn hình: Hồ sơ vay (CBTD) · Bổ sung hồ sơ sau tiếp nhận

### UT-BS-01 · Báo "SLA tạm dừng" trong khi SLA đã chạy lại

| | |
|---|---|
| Loại · Mức | Lỗi hiển thị · Vừa |
| Trạng thái | Mới |
| Quy tắc | SLA dừng từ lúc phát hành yêu cầu bổ sung đến lúc ngân hàng ghi nhận đã nhận đủ; với Portal, hệ thống tự ghi khi doanh nghiệp bấm gửi đủ (SME_MASTER, Cấu hình SLA theo ngày làm việc). |
| Các bước | 1. CBTD gửi yêu cầu bổ sung cho `SME-6`. 2. Doanh nghiệp tải tài liệu và bấm "Gửi tài liệu bổ sung". 3. CBTD mở lại `SME-6`, tab "Bổ sung". |
| Kết quả mong đợi | Màn hình nói thống nhất: SLA **đang chạy** kể từ lúc doanh nghiệp gửi, chờ CBTD kiểm tra tài liệu. |
| Kết quả thực tế | Đầu trang: "Hạn SLA 11:34 30/11/2026, còn 13 ngày 7,9 giờ" (đang chạy, đúng với DB: khoảng dừng kết thúc 11:37:45). Cuối trang vẫn ghi "Đang chờ doanh nghiệp bổ sung · SLA tạm dừng…", nút ghi "Hoàn tất yêu cầu & Chạy lại SLA". CBTD dễ hiểu nhầm là chưa bị tính giờ nên chậm kiểm tra. |

### UT-BS-02 · Nút duyệt mục bổ sung bị khóa mà không nói lý do

| | |
|---|---|
| Loại · Mức | Cải tiến · Thấp |
| Trạng thái | Mới |
| Các bước | Ở bước 3 của UT-BS-01, xem mục "F · Lịch trả nợ". |
| Kết quả mong đợi | Biết cần làm gì để duyệt, ví dụ nhãn "Nhập thông điệp gửi doanh nghiệp để chấp nhận hoặc yêu cầu thay thế". |
| Kết quả thực tế | "Chấp nhận mục" và "Yêu cầu thay thế" bị khóa, không có chỉ dẫn. Chỉ bật khi nhập "Thông điệp gửi doanh nghiệp". |

### UT-BS-03 · Nhãn "Đã bổ sung 1 lần" hiện ngay khi vừa yêu cầu

| | |
|---|---|
| Loại · Mức | Lỗi hiển thị · Thấp |
| Trạng thái | Mới |
| Các bước | CBTD gửi yêu cầu bổ sung đầu tiên cho `SME-6`, xem đầu trang. |
| Kết quả mong đợi | "Đã yêu cầu bổ sung 1 lần" (đếm số lần ngân hàng yêu cầu), hoặc chỉ ghi "Đã bổ sung" khi doanh nghiệp đã gửi. |
| Kết quả thực tế | Ngay khi gửi yêu cầu, lúc doanh nghiệp chưa gửi gì, đầu trang đã ghi "Đã bổ sung 1 lần". |

---

## Màn hình: Hồ sơ vay (CBTD) · Xác nhận đủ hồ sơ và Tờ trình tín dụng

Phiên test 09/11/2026 (phiên 3), vai CBTD `nam.hoang`, `oanh.trinh`; xem kết quả bằng Thẩm quyền `ha.le`. Hồ sơ dùng: `SME-20261020-8001`, `SME-20261106-8001` (dữ liệu demo).

### UT-TT-01 · Xác nhận "đủ hồ sơ" được khi hồ sơ không có chứng từ nào

| | |
|---|---|
| Loại · Mức | Lỗi · Cao |
| Trạng thái | Mới · tái hiện 2 lần (`SME-20261020-8001`, `SME-20261106-8001`) |
| Quy tắc | Hồ sơ chỉ đạt "Đã đủ hồ sơ" khi CBTD đã đối soát đủ chứng từ; đây là điều kiện bắt buộc để lập tờ trình (SME_MASTER mục 1, nguyên tắc 1 và 2). |
| Các bước | 1. CBTD mở hồ sơ đang "Mới tiếp nhận", tab Chứng từ trống (0 tệp). 2. Bấm "Xác nhận đủ hồ sơ". 3. Điền tờ trình, bấm "Trình tờ trình". 4. Thẩm quyền mở hồ sơ. |
| Kết quả mong đợi | Không cho xác nhận đủ khi chưa có chứng từ bắt buộc (tối thiểu theo nhóm A, B, C, D và F nếu có dư nợ). Báo rõ còn thiếu nhóm nào. |
| Kết quả thực tế | Xác nhận thành công ("Xác nhận hồ sơ đã đầy đủ chứng từ"), trình tờ trình thành công. Thẩm quyền thấy "Chứng từ (0) · Hồ sơ chưa có chứng từ đính kèm" nhưng vẫn có nút Phê duyệt. Không có hộp xác nhận trước khi bấm. |
| Vị trí | `backend/src/modules/loan-applications/loan-applications.service.ts:438` (`checkDocuments` chỉ kiểm tra công đoạn và trạng thái, không kiểm tra chứng từ). |
| Ghi chú | Hồ sơ từ Portal đã qua checklist 13 mục lúc tiếp nhận nên ít rủi ro hơn; hồ sơ tạo tại quầy thì không có lớp kiểm tra nào. Cần PO chốt danh mục chứng từ bắt buộc cho hồ sơ tại quầy. |

### UT-TT-02 · Tờ trình chỉ cần mỗi ô có ký tự là trình được

| | |
|---|---|
| Loại · Mức | Cần PO xác nhận · Vừa |
| Trạng thái | Mới |
| Các bước | Điền 6 ô phân tích bằng một dấu ".", ô Đề xuất ghi một câu bất kỳ, bấm "Trình tờ trình". |
| Kết quả mong đợi (đề xuất) | Mỗi ô phân tích có độ dài tối thiểu (ví dụ 30 ký tự) hoặc theo mẫu gợi ý; ô "Tài sản bảo đảm" chấp nhận "Không áp dụng" kèm lý do. |
| Kết quả thực tế | Tờ trình `SME-20261020-8001` với nội dung "." ở mọi ô được trình thành công, hồ sơ chuyển Thẩm định. Hệ thống chỉ chặn ô trống hoặc chỉ có khoảng trắng. |

### UT-TT-03 · Đề xuất của CBTD là văn bản tự do, mâu thuẫn với hạn mức không bị phát hiện

| | |
|---|---|
| Loại · Mức | Cải tiến · Vừa |
| Trạng thái | Mới |
| Các bước | Hạn mức chính thức 1.530.000.000 VNĐ; ô "Đề xuất của CBTD" ghi "Đề xuất cho vay 50 tỷ, vượt hạn mức"; trình tờ trình. |
| Kết quả mong đợi (đề xuất) | Đề xuất có phần cấu trúc: cho vay hay không, số tiền đề xuất (≤ hạn mức), thời hạn, lãi suất đề xuất; phần văn bản chỉ để giải thích. Thẩm quyền thấy ngay đề xuất dạng số. |
| Kết quả thực tế | Trình thành công; Thẩm quyền thấy "Đề xuất cho vay 50 tỷ" cạnh "Hạn mức chính thức 1.530.000.000 VNĐ", hệ thống không cảnh báo. |

### UT-TT-04 · Form tờ trình không có hướng dẫn và không hỏi lại trước khi trình

| | |
|---|---|
| Loại · Mức | Cải tiến · Thấp |
| Trạng thái | Mới |
| Kết quả mong đợi | Mỗi ô có gợi ý cần viết gì; bấm "Xác nhận đủ hồ sơ" và "Trình tờ trình" có hộp hỏi lại vì sau khi trình tờ trình bị khóa. |
| Kết quả thực tế | 8 ô trống, không có gợi ý; hai nút thực hiện ngay, không hỏi lại. |

**Quyết định PO (09/11/2026) cho UT-TT-01 → UT-TT-04, phương án giữ hiện trạng và siết điều kiện, không phát sinh tính năng:**

| # | Quyết định |
|---|---|
| Q1 | "Xác nhận đủ hồ sơ" bắt buộc mỗi nhóm A, B, C, D có ít nhất 1 chứng từ còn hiệu lực; thêm F khi khai có dư nợ, thêm E khi có tài sản bảo đảm. Chặn ở backend, báo nhóm còn thiếu. |
| Q2 | Áp dụng cho cả hồ sơ Portal và hồ sơ tại quầy. |
| Q3 | Khi trình (kể cả trình lại sau làm rõ): 6 ô phân tích và ô Đề xuất tối thiểu 30 ký tự; ô Tài sản bảo đảm chấp nhận "Không áp dụng: <lý do>"; ô Điều kiện đề xuất không bắt buộc; lưu nháp tự do. |
| Q4 | Không áp ngược cho tờ trình đã trình; hồ sơ demo xử lý bằng yêu cầu làm rõ hoặc dựng lại dữ liệu demo. |
| D1 | `seed-demo` bổ sung chứng từ giả lập cho hồ sơ đã xác nhận đủ hoặc đang Thẩm định. |
| D2 | Viết test đỏ trước (thiếu nhóm B; có dư nợ thiếu F; ô dưới 30 ký tự; "Không áp dụng: …" được chấp nhận), rồi hồi quy `appraisal`, `workflow-decision`, `maker-checker`, `check:sla-pa1`, `test:loan-detail` và luồng giao diện. |
| E1–E3 | Chữ gợi ý cho 8 ô; hộp hỏi lại trước khi xác nhận đủ và trước khi trình; dòng nhắc hạn mức chính thức phía trên ô Đề xuất. |
| E4 | "Điền sẵn từ hồ sơ" và tách đề xuất thành ô số liệu: backlog sau bảo vệ. |
| Không đổi | Quy trình, Maker-Checker, quyền, ngưỡng 10 tỷ, SLA, mô hình dự báo, cấu trúc DB, hợp đồng API. |

Trạng thái: đã duyệt, chưa triển khai.

**Đã kiểm tra, không có lỗi (phiên 3):** lưu nháp toàn khoảng trắng được nhưng trình bị chặn ("Cần hoàn tất các phần phân tích và kết luận trước khi trình."); trường lạ và ô dài hơn 10.000 ký tự bị chặn (400); hai tab cùng lưu thì tab sau bị chặn (409 "Tờ trình đã thay đổi"); dùng lại mã thao tác với nội dung khác bị chặn (409); trình khi chưa xác nhận đủ bị chặn; sửa sau khi trình bị chặn (409 "Bản đã trình được khóa"); nội dung có thẻ HTML hiển thị nguyên văn, không chạy mã.

**Ảnh hưởng dữ liệu:** `SME-20261020-8001` (demo) đã chuyển sang Thẩm định với tờ trình nội dung "."; Thẩm quyền có thể yêu cầu làm rõ hoặc từ chối, hoặc dựng lại bằng `seed:demo -- --reset`. `SME-20261106-8001` đã được hoàn tác về "Mới tiếp nhận".

---

## Cần PO xác nhận (chưa kết luận là lỗi)

### PO-01 · Chưa có dự báo trễ SLA ngay sau khi tiếp nhận hồ sơ

| | |
|---|---|
| Hiện tượng | Tiếp nhận `DN-18` thành `SME-6` lúc 11:32 thì hồ sơ ghi "Nguy cơ trễ SLA: Chưa dự báo". Dự báo đầu tiên chỉ có khi hoàn tất yêu cầu bổ sung (11:38). Nếu hồ sơ không có bổ sung, phải chờ lượt chấm 08:00 ngày làm việc kế tiếp (hoặc lượt chấm bù khi khởi động lại backend). |
| Câu hỏi cho PO | Có cần chấm dự báo ngay khi tiếp nhận không? Tài liệu hiện chỉ nêu dự báo khi chuyển công đoạn, trình tờ trình, hoàn tất bổ sung và chấm định kỳ. |
| Quyết định PO (09/11/2026) | **Có.** Hồ sơ phải được chấm dự báo ngay khi tiếp nhận. Chuyển thành yêu cầu triển khai `MM-02`. Chưa sửa code theo chỉ đạo PO. |

---

## Đã kiểm tra, không có lỗi (phiên 2, 09/11/2026)

| Mã | Tình huống | Kết quả |
|---|---|---|
| E18 | Quản lý phân công đề nghị | Danh sách chỉ có CBTD, không tự phân công cho mình được; phân công thành công, có hộp xác nhận |
| E20 | Thông báo | CBTD nhận "Đề nghị được phân công", "Tờ trình cần làm rõ", "Hồ sơ đã được phê duyệt"; 5 Thẩm quyền nhận "Tờ trình chờ xem xét"; bấm thông báo mở đúng đề nghị |
| — | CBTD kiểm tra 13 mục checklist | Mỗi mục "Đã kiểm tra đạt", nút tiếp nhận bật khi đủ, báo "Chưa có doanh nghiệp trùng mã số thuế" |
| E5 | Bấm "Tiếp nhận thành hồ sơ vay" 2 lần liên tiếp | Chỉ tạo đúng 1 hồ sơ `SME-6`, đề nghị chuyển `ACCEPTED` |
| E11 | Hạn SLA Tiếp nhận | 11:32 30/11/2026, khớp tính tay 14 ngày làm việc (bỏ cuối tuần và ngày nghỉ 24/11) |
| E2 | `mai.bui` (CBTD khác) xem, đặt hạn mức, lưu nháp tờ trình, tạo yêu cầu bổ sung, xác nhận đủ hồ sơ của `SME-6` qua API | Đều 403 "Bạn chỉ được truy cập hồ sơ được phân công." |
| E3 | Thẩm quyền xem hồ sơ đang Tiếp nhận; dùng vai trò chưa được cấp | 403 "Thẩm quyền chỉ truy cập hồ sơ từ công đoạn Thẩm định trở đi."; 403 `ACTIVE_ROLE_INVALID` |
| E6 | Doanh nghiệp sửa hoặc nộp lại đề nghị đã tiếp nhận | 409 và 400, không sửa được |
| E7 | Hạn mức chính thức 10.000.000.001 / 0 / lớn hơn số tiền đề xuất / 8 tỷ | 400 "tối đa 10 tỷ"; 400 "phải là số dương"; 400 "không được vượt số tiền đề xuất"; 200 |
| E10 | Trình tờ trình khi chưa xác nhận đủ hồ sơ; chuyển thẳng sang Thẩm định | Nút khóa trên giao diện; API 400 "Cần xác nhận đủ chứng từ trước khi trình."; 400 "Cần lập và trình tờ trình trước khi chuyển Thẩm định." |
| E12 | Yêu cầu bổ sung → doanh nghiệp gửi → CBTD hoàn tất | SLA dừng 11:35:40, chạy lại 11:37:45 khi doanh nghiệp gửi; hạn lùi đúng 2 phút; yêu cầu thứ hai khi đang mở bị chặn (400) |
| E14 | Dự báo theo công đoạn | Hoàn tất bổ sung có `v4.0-TIEP_NHAN`; trình tờ trình có `v4.0-THAM_DINH` (16%); không dùng dự báo công đoạn cũ |
| E13 | Thẩm quyền yêu cầu làm rõ → CBTD trình bản 2 | Hạn SLA Thẩm định giữ nguyên (không dừng); có bản 1 và bản 2; quyết định trên bản 1 cũ bị chặn (409) |
| E1 | `dat.nguyen` tự quyết định hồ sơ mình phụ trách | API 403 cho cả phê duyệt và yêu cầu làm rõ; giao diện ẩn nút và ghi "Bạn đang phụ trách hồ sơ này nên không được tự quyết định hoặc yêu cầu làm rõ (Maker-Checker)." |
| E8 | Phê duyệt 9 tỷ (vượt hạn mức 8 tỷ), 0 đồng, lãi suất -1% và 101% | 400 với thông báo đúng |
| E9 | Từ chối thiếu mã, mã TC99, thiếu ghi chú | 400 với thông báo đúng |
| E17 | `ha.le` và `huy.vu` phê duyệt cùng lúc | Chỉ một quyết định được ghi (7,5 tỷ, 9,5%); người kia nhận 400 "Hồ sơ đã kết thúc" |
| E19 | Doanh nghiệp xem kết quả | "Đã được phê duyệt", 4 bước hoàn tất; API trạng thái không có ghi chú nội bộ hay tên cán bộ |
| E4 (giao diện) | Cổng doanh nghiệp sau tiếp nhận | Giao diện không hiện tên cán bộ (nhưng API có, xem UT-PT-01) |

## Chưa test (phiên 2)

- E15: tắt dịch vụ ML khi chuyển bước (cần dừng tiến trình ML).
- E16: Quản lý điều chuyển hồ sơ đúng lúc CBTD đang soạn tờ trình.
- Chuyển vai trò bằng menu tài khoản: trong phiên test tự động chưa bấm chuyển được, đã chuyển bằng cách đặt vai trò trong trình duyệt; cần kiểm tra lại bằng thao tác tay trước khi kết luận.
- Đóng hồ sơ quá hạn bổ sung (D4-04), đối soát doanh nghiệp trùng mã số thuế, trả đề nghị để chỉnh sửa trước tiếp nhận.

---

## Mong muốn triển khai

Yêu cầu của PO cho các phiên bản sau, chưa phải lỗi của bản hiện tại. Mỗi mục có tiêu chí nghiệm thu để kiểm tra khi triển khai xong.

### MM-01 · Doanh nghiệp đăng ký và nhận mã xác minh qua email thật khi hệ thống chạy trên internet

| | |
|---|---|
| Người yêu cầu · Ngày | PO · 09/11/2026 |
| Trạng thái | Mới, chờ triển khai khi đưa hệ thống lên internet |
| Mong muốn | Sau khi hệ thống được đưa lên internet, doanh nghiệp tự đăng ký tài khoản bằng email của chính mình (Gmail, Outlook, email công ty…) và **nhận được thư chứa mã xác minh trong hộp thư thật**, nhập mã thành công rồi đăng nhập được. |
| Hiện trạng | Cơ chế mã xác minh đã có đủ: mã 6 số ngẫu nhiên, hết hạn sau 10 phút, chờ 60 giây giữa hai lần gửi, tối đa 5 lần nhập sai, chỉ lưu bản băm của mã. Bản local gửi thư vào hộp thư thử nghiệm `http://localhost:8025` theo DEC-03, không gửi ra internet. Khi chạy chế độ production mà chưa cấu hình máy chủ gửi thư, hệ thống báo lỗi và doanh nghiệp không nhận được mã. |
| Phần còn thiếu | Cấu hình máy chủ gửi thư thật (SMTP) trên môi trường internet; nội dung thư xác minh bằng tiếng Việt (`UT-XM-01`); thư không bị đưa vào mục thư rác. |

**Việc cần làm khi triển khai:**

1. PO chọn dịch vụ gửi thư: Gmail SMTP với mật khẩu ứng dụng (đủ cho demo, khoảng 500 thư/ngày), dịch vụ gửi thư chuyên dụng (SendGrid, Brevo, Mailgun, Amazon SES) hoặc máy chủ thư của ngân hàng.
2. Khai báo trên máy chủ, trong file `.env` của backend, không đưa vào git: `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `FRONTEND_URL`, `NODE_ENV=production`. Mật khẩu SMTP không ghi vào mã nguồn, tài liệu hay tin nhắn.
3. Nếu gửi từ tên miền riêng: khai báo SPF, DKIM, DMARC cho tên miền gửi theo hướng dẫn của dịch vụ gửi thư.
4. Sửa nội dung thư xác minh sang tiếng Việt (`UT-XM-01`).
5. Bỏ dòng chỉ dẫn hộp thư thử nghiệm (`UT-DK-02`) khỏi môi trường internet; dòng này chỉ hiện khi chạy local.
6. Bản local giữ nguyên hộp thư thử nghiệm theo DEC-03.

**Tiêu chí nghiệm thu (kiểm tra trên môi trường internet):**

| # | Tình huống | Kết quả mong đợi |
|---|---|---|
| 1 | Doanh nghiệp đăng ký bằng một địa chỉ Gmail thật | Thư xác minh đến **hộp thư đến** của Gmail trong vòng 1 phút, không nằm trong thư rác |
| 2 | Đăng ký bằng một địa chỉ Outlook hoặc email công ty | Thư đến hộp thư đến trong vòng 1 phút |
| 3 | Mở thư | Tiêu đề và nội dung bằng tiếng Việt, có mã 6 số, ghi rõ hạn dùng 10 phút, người gửi là địa chỉ `SMTP_FROM` đã cấu hình |
| 4 | Nhập đúng mã trong 10 phút | "Email đã được xác minh", đăng nhập thành công |
| 5 | Nhập mã sau 10 phút | Không xác minh được; bấm "Gửi lại mã xác minh" thì nhận thư mới |
| 6 | Bấm gửi lại mã trong vòng 60 giây | Báo "Vui lòng chờ 60 giây trước khi gửi lại.", không gửi thư |
| 7 | Nhập sai mã 5 lần | Mã bị vô hiệu, phải gửi lại mã mới |
| 8 | Chưa xác minh mà đăng nhập | Không đăng nhập được |
| 9 | Máy chủ gửi thư lỗi hoặc sai cấu hình | Màn hình báo "Không gửi được email xác minh. Vui lòng thử gửi lại." và có log lỗi ở backend; không lộ mật khẩu SMTP |
| 10 | Quên mật khẩu bằng email thật | Thư đặt lại mật khẩu đến hộp thư thật, liên kết mở đúng địa chỉ `FRONTEND_URL` |

**Phụ thuộc:** có môi trường internet (máy chủ, tên miền) và PO duyệt dịch vụ gửi thư. Việc gửi thư thật ở bản local cần PO duyệt riêng vì trái DEC-03.

### MM-02 · Chấm dự báo trễ SLA ngay khi tiếp nhận hồ sơ

| | |
|---|---|
| Người yêu cầu · Ngày | PO · 09/11/2026 (quyết định cho `PO-01`) |
| Trạng thái | Mới, chưa triển khai |
| Mong muốn | Ngay khi CBTD tiếp nhận đề nghị Portal thành hồ sơ vay, hoặc tạo hồ sơ vay tại quầy, hệ thống chấm dự báo trễ SLA cho công đoạn Tiếp nhận. Quản lý và CBTD thấy mức cảnh báo ngay, không phải chờ lượt chấm 08:00 hôm sau. |
| Hiện trạng | Tiếp nhận `DN-18` thành `SME-6` lúc 11:32 ngày 09/11/2026, hồ sơ ghi "Chưa dự báo". Dự báo đầu tiên chỉ có lúc hoàn tất yêu cầu bổ sung (11:38). Hồ sơ không có bổ sung phải chờ lượt chấm định kỳ 08:00 ngày làm việc kế tiếp. |
| Ràng buộc | Dự báo chỉ cảnh báo nguy cơ trễ SLA, không phải quyết định tín dụng. Lỗi hoặc tắt dịch vụ ML không được làm hỏng hay hoàn tác thao tác tiếp nhận. Chỉ chấm khi công đoạn tính theo PA1 và nằm trong lịch làm việc đã nạp. |

**Tiêu chí nghiệm thu:**

| # | Tình huống | Kết quả mong đợi |
|---|---|---|
| 1 | CBTD tiếp nhận đề nghị Portal thành hồ sơ vay | Ngay sau tiếp nhận có một dự báo `v4.0-TIEP_NHAN`; màn hình hồ sơ, danh sách và bảng cảnh báo sớm hiện mức cảnh báo thay cho "Chưa dự báo" |
| 2 | CBTD tạo hồ sơ vay tại quầy | Như tình huống 1 |
| 3 | Dịch vụ ML tắt khi tiếp nhận | Tiếp nhận vẫn thành công, hồ sơ ghi "Chưa dự báo", backend có log cảnh báo; lượt chấm định kỳ sau đó tự bổ sung dự báo |
| 4 | Bấm tiếp nhận hai lần liên tiếp | Vẫn chỉ 1 hồ sơ vay và không sinh dự báo trùng |
| 5 | Ngoài lịch làm việc đã nạp hoặc công đoạn không theo PA1 | Không chấm, hiện "Chưa dự báo" kèm lý do đúng |
| 6 | Doanh nghiệp xem cổng | Không thấy dự báo |

### MM-03 · Siết điều kiện xác nhận đủ hồ sơ và tờ trình CBTD (giữ hiện trạng, không phát sinh tính năng)

| | |
|---|---|
| Người yêu cầu · Ngày | PO · 09/11/2026 |
| Trạng thái | Đã duyệt, để sau, chưa triển khai |
| Nguồn | UT-TT-01 → UT-TT-04; chi tiết quyết định Q1–Q4, D1–D2, E1–E4 ở mục "Hồ sơ vay (CBTD) · Xác nhận đủ hồ sơ và Tờ trình tín dụng" |
| Mong muốn | Không xác nhận được "đủ hồ sơ" khi thiếu chứng từ bắt buộc; tờ trình gửi đi có nội dung thật; CBTD biết cần viết gì và được nhắc hạn mức; không đổi quy trình, quyền, SLA, mô hình, cấu trúc DB, hợp đồng API. |

**Tiêu chí nghiệm thu:**

| # | Tình huống | Kết quả mong đợi |
|---|---|---|
| 1 | Hồ sơ thiếu nhóm B, bấm "Xác nhận đủ hồ sơ" | Bị chặn, báo "Còn thiếu chứng từ nhóm: B" (cả giao diện và API) |
| 2 | Hồ sơ khai có dư nợ, thiếu nhóm F | Bị chặn |
| 3 | Hồ sơ có tài sản bảo đảm, thiếu nhóm E | Bị chặn |
| 4 | Đủ nhóm bắt buộc | Xác nhận được, có hộp hỏi lại trước |
| 5 | Trình tờ trình có ô phân tích dưới 30 ký tự | Bị chặn, báo đúng ô |
| 6 | Ô Tài sản bảo đảm ghi "Không áp dụng: <lý do>" | Trình được |
| 7 | Lưu nháp với nội dung ngắn | Lưu được |
| 8 | Bấm "Trình tờ trình" | Có hộp hỏi lại; 8 ô có chữ gợi ý; phía trên ô Đề xuất hiện hạn mức chính thức |
| 9 | Tờ trình đã trình trước khi áp dụng | Không bị ảnh hưởng |
| 10 | Dữ liệu demo sau `seed:demo -- --reset` | Hồ sơ đã xác nhận đủ hoặc đang Thẩm định có đủ chứng từ giả lập |
| 11 | Hồi quy | `appraisal`, `workflow-decision`, `maker-checker`, `check:sla-pa1`, `test:loan-detail` và luồng giao diện tiếp nhận → phê duyệt đều đạt |

Backlog sau bảo vệ: "Điền sẵn từ hồ sơ" và tách đề xuất thành ô số liệu.

---

## Đã kiểm tra, không có lỗi (phiên 09/11/2026)

| Màn hình | Kiểm tra | Kết quả |
|---|---|---|
| Đăng ký | Mật khẩu 8 ký tự không có số | Báo đúng tiếng Việt |
| Đăng ký | Đăng ký hợp lệ | Chuyển sang màn xác minh, thư đến hộp thư local |
| Xác minh email | Nhập đúng mã 6 số | "Email đã được xác minh. Bạn có thể đăng nhập." |
| Đăng nhập | Email đã xác minh và mật khẩu đúng | Vào "Đề nghị vay của bạn", danh sách rỗng hiển thị đúng |
| Bước 1–3 | Lưu nháp từng bước | "Đã lưu bản nháp trên hệ thống", mã nháp `DN-18` |
| Bước 2 | Chọn "Có tài sản bảo đảm" | Hiện thêm ô "Thông tin tài sản dự kiến"; để trống thì bước 5 báo thiếu đúng |
| Bước 3 | Cân đối chi phí và nguồn vốn | Lệch thì cảnh báo, cân đối thì hết cảnh báo |
| Bước 4 | Tải tệp nhóm A–F, gán loại và kỳ | 6 tệp lưu thành công, checklist chuyển "Đã cung cấp, chờ kiểm tra · 13 mục" |
| Bước 5 | Gửi đề nghị | "Đã gửi đề nghị cho ngân hàng kiểm tra", hồ sơ khóa chỉnh sửa |
| Danh sách đề nghị | Sau khi gửi | `DN-18` hiện trạng thái "Chờ phân công" |

## Chưa test

- Phía ngân hàng: Quản lý phân công, CBTD tiếp nhận `DN-18`.
- Tải tệp sai định dạng hoặc lớn hơn 10 MB.
- Giao diện trên điện thoại.
- Quên mật khẩu, gửi lại mã xác minh, nhập sai mã nhiều lần.
