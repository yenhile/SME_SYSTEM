# Kế hoạch sửa SLA theo ngày làm việc và tạo tài khoản mô phỏng

Tài liệu đề xuất, **chưa thực hiện**. Các việc đổi chức năng SLA, kích hoạt PA1, ghi dữ liệu vào cơ sở dữ liệu local cần PO duyệt trước (SME-AI-011). Mục đích: dựng hệ thống chạy giống thật để phục vụ báo cáo khóa luận, trong phạm vi nội bộ ngân hàng (4 vai trò, không có doanh nghiệp là actor).

Cập nhật lần cuối: 04/11/2026.

**Ngoài phạm vi kế hoạch này:** rule base cảnh báo theo thời gian, mô hình dự báo và bộ dữ liệu hồ sơ giả lập phục vụ mô hình do người phụ trách mô hình thực hiện riêng.

---

## 1. Hiện trạng đã kiểm chứng (04/11/2026)

| Mục | Hiện trạng | Cách kiểm tra |
|---|---|---|
| Định mức công đoạn | Tiếp nhận 4 giờ; Thẩm định 24 giờ; Cấp trên 48 giờ; Hoàn tất 8 giờ | Đọc bảng `workflow_stages` trong cơ sở dữ liệu đang chạy |
| Chính sách PA1 | **Chưa bật**: bảng kích hoạt `sla_policy_activations` trống, hệ thống đang tính theo cách cũ (giờ liên tục 24/7) | Truy vấn cơ sở dữ liệu |
| Lịch làm việc | Một phiên bản trong mã: `SIM-20261026-20261108-v1`, phủ 26/10 đến 08/11/2026, chỉ có 30/10 là ngày nghỉ giả lập | `backend/src/modules/workflow/sla/working-time.ts` |
| Khi ngoài kỳ lịch | Nếu PA1 đã bật, hệ thống từ chối mở công đoạn mới và báo lỗi, không tự quay về 24/7 | `sla-policy.ts`, `resolveStageSla` |
| Tài khoản | 4 tài khoản test: `test_admin`, `test_cbtd`, `test_quan_ly`, `test_tham_quyen` | Truy vấn cơ sở dữ liệu |
| Công đoạn Cấp trên | Còn trong cấu hình, trong khi phạm vi đã bỏ cấp trên | Bảng `workflow_stages`, `seed.js` |

## 2. Cách tính SLA đề xuất

### 2.1. Nguyên tắc
- Dùng **PA1** (giờ làm việc) đã được PO duyệt, không quay lại 24/7. Khai báo và hiển thị theo **ngày làm việc**; bên trong vẫn tính giờ (1 ngày làm việc = 8 giờ làm việc).
- Ngày làm việc: **thứ Hai đến thứ Sáu**, không nằm trong danh sách ngày nghỉ của lịch. Giờ làm việc: 08:00–12:00 và 13:00–17:00 giờ Việt Nam. Ngày làm bù thứ Bảy chưa được hỗ trợ.
- Hồ sơ **trễ** khi giờ làm việc đã dùng (trừ thời gian tạm dừng) vượt định mức công đoạn.

### 2.2. Định mức

| Công đoạn | Định mức | Giá trị cấu hình | Đồng hồ bắt đầu | Đồng hồ kết thúc |
|---|---|---|---|---|
| Tiếp nhận | 10 ngày làm việc (2 tuần) | 80 giờ | CBTD bấm tiếp nhận, tạo khoản vay | CBTD trình tờ trình |
| Thẩm định | 5 ngày làm việc (1 tuần) | 40 giờ | Tờ trình được trình | Thẩm quyền phê duyệt hoặc từ chối |
| Hoàn tất | Không tính SLA | giữ giá trị hiện có | Kết thúc ngay khi có quyết định | |
| Cấp trên | Gỡ bỏ | | | |

### 2.3. Tạm dừng
- **Dừng** khi yêu cầu doanh nghiệp bổ sung chứng từ; **chạy lại** khi doanh nghiệp gửi phản hồi.
- **Không dừng:** làm rõ tờ trình nội bộ, điều chuyển hồ sơ (giờ đã dùng được giữ nguyên), cán bộ nghỉ phép hoặc nghỉ đột xuất (xử lý bằng điều chuyển).
- Quy tắc nhắc bổ sung (ngày 5, quá hạn ngày 10 theo ngày lịch) giữ nguyên, tách biệt với SLA công đoạn.
- Định mức mới chỉ áp dụng cho công đoạn mở sau khi kích hoạt. Công đoạn đang mở giữ cách tính đã chốt.

### 2.4. Ví dụ
Hồ sơ vào Thẩm định **thứ Tư 10:00**, định mức 40 giờ: thứ Tư 6 giờ, thứ Năm 8, thứ Sáu 8, cuối tuần 0, thứ Hai 8, thứ Ba 8 (cộng dồn 38), thứ Tư tuần sau cần thêm 2 giờ nữa tức 08:00–10:00. **Hạn chót: thứ Tư tuần sau lúc 10:00.** Nếu thứ Hai là ngày lễ trong lịch thì hạn lùi sang thứ Năm 10:00. Tạm dừng 2 ngày làm việc chờ doanh nghiệp thì hạn lùi thêm 2 ngày làm việc.

## 3. Quy trình thực hiện (đề xuất)

| Bước | Việc | Loại | Ghi chú |
|---|---|---|---|
| 0 | Sao lưu cơ sở dữ liệu local; chốt danh sách ngày nghỉ 2026 và nguồn | Chuẩn bị | PO cung cấp ngày nghỉ, không tự ghi ngày |
| 1 | Thêm phiên bản lịch phủ **01/01/2026 đến 31/12/2026** với ngày nghỉ chính thức | Sửa mã | Không để hồ sơ mô phỏng kéo dài qua 31/12/2026 |
| 2 | Thêm bản ghi kích hoạt PA1 với thời điểm hiệu lực rõ ràng và phiên bản lịch của bước 1 | Dữ liệu cấu hình | |
| 3 | Đặt Tiếp nhận **80** giờ, Thẩm định **40** giờ ở màn Cấu hình SLA | Cấu hình | Không cần sửa mã |
| 4 | Gỡ công đoạn Cấp trên khỏi cấu hình, dashboard, seed | Sửa mã | Cùng đợt bỏ cấp trên |
| 5 | Hiển thị định mức theo "ngày" (giờ chia 8) ở màn Cấu hình SLA và dashboard | Sửa giao diện | |
| 6 | Tạo tài khoản mô phỏng (mục 4) | Dữ liệu | Qua màn hoặc API quản trị người dùng |
| 7 | Kiểm thử SLA (mục 5) | Kiểm thử | |
| 8 | Cập nhật `SME_MASTER.md` và tài liệu liên quan | Tài liệu | |

**Quay lui:** xóa bản ghi kích hoạt PA1 và khôi phục định mức cũ (4, 24, 48, 8); khôi phục từ bản sao lưu nếu cần.

## 4. Tài khoản mô phỏng

### 4.1. Nguyên tắc
- Mô phỏng một chi nhánh gồm nhiều cán bộ mỗi vai trò để thấy phân công, tải công việc, điều chuyển và kiểm soát độc lập.
- Tên dùng là **tên hư cấu**, không dùng tên người thật của dự án. Tên đăng nhập không dấu, dạng `ten.ho`.
- **Giữ nguyên 4 tài khoản test hiện có.** Không xóa, không đổi.
- Tạo qua chức năng quản lý người dùng của Quản trị viên (đúng ràng buộc hiện có: mật khẩu từ 8 ký tự, email hợp lệ, ít nhất một vai trò).
- **Không ghi mật khẩu trong tài liệu.** Mật khẩu do PO chọn, truyền khi chạy (biến môi trường), không đưa vào mã hay tệp. Lưu ý mật khẩu của bộ test cũ (6 ký tự) không đáp ứng quy tắc tạo tài khoản mới.
- Email dùng tên miền demo không gửi thật (ví dụ `@sme-demo.example`); cần kiểm tra bộ kiểm tra email chấp nhận khi tạo.
- Chi nhánh (`branchName`): dùng một tên chung, ví dụ "Chi nhánh mô phỏng".

### 4.2. Danh sách đề xuất

| STT | Họ tên | Tên đăng nhập | Vai trò |
|---|---|---|---|
| 1 | Trần Minh Khoa | `khoa.tran` | Quản trị viên |
| 2 | Nguyễn Thị Hồng Nhung | `nhung.nguyen` | Quản lý chi nhánh |
| 3 | Phạm Văn Đức | `duc.pham` | Quản lý chi nhánh (người thay thế khi Quản lý chính vắng) |
| 4 | Lê Thị Thu Hà | `ha.le` | Cán bộ thẩm quyền |
| 5 | Vũ Quang Huy | `huy.vu` | Cán bộ thẩm quyền |
| 6 | Đặng Ngọc Lan | `lan.dang` | Cán bộ thẩm quyền |
| 7 | Hoàng Văn Nam | `nam.hoang` | Cán bộ tín dụng |
| 8 | Bùi Thị Mai | `mai.bui` | Cán bộ tín dụng |
| 9 | Ngô Đức Thành | `thanh.ngo` | Cán bộ tín dụng |
| 10 | Đỗ Thị Hạnh | `hanh.do` | Cán bộ tín dụng |
| 11 | Phan Quốc Bảo | `bao.phan` | Cán bộ tín dụng |
| 12 | Trịnh Thị Oanh | `oanh.trinh` | Cán bộ tín dụng |
| 13 | Nguyễn Hữu Đạt | `dat.nguyen` | Cán bộ tín dụng **và** Cán bộ thẩm quyền (để minh họa kiểm soát độc lập D5-04: không được quyết định hồ sơ mình đã tiếp nhận hoặc lập tờ trình) |

Tổng 13 tài khoản mới: 1 Quản trị viên, 2 Quản lý, 3 Thẩm quyền, 6 CBTD, 1 tài khoản hai vai trò. Cùng 4 tài khoản test cũ là 17 tài khoản.

### 4.3. Mục đích của từng nhóm tài khoản
- Nhiều CBTD để thấy chênh lệch tải công việc khi phân công.
- Điều chuyển hồ sơ giữa các CBTD (kịch bản nghỉ phép, nghỉ đột xuất).
- Tài khoản hai vai trò dùng để minh họa việc bị chặn khi quyết định hồ sơ mình đã xử lý.
- Hai Quản lý để có người thay thế khi một Quản lý vắng.

## 5. Kiểm thử SLA

Kiểm thử chạy trên schema riêng của script kiểm thử, không ghi dữ liệu mô phỏng vào cơ sở dữ liệu local. Dùng các phương thức kiểm thử đã có: kiểm thử đơn vị bộ tính giờ, kiểm thử tích hợp trong schema riêng với đồng hồ cố định (`check-sla-pa1.cjs`), phiên dựng sẵn để xem giao diện (`sla-pa1-session.cjs`, cần dừng container giao diện để dùng cổng 5173 rồi bật lại sau phiên).

Kịch bản cần có:
1. Vào Thẩm định thứ Sáu 16:00: chỉ tính 1 giờ, thứ Hai tính tiếp.
2. Qua cuối tuần và một ngày lễ trong lịch: không tính.
3. Tạm dừng chờ doanh nghiệp 3 ngày làm việc: giờ được trừ.
4. Đúng mốc 80% và 100% định mức.
5. Điều chuyển giữa chừng: giờ đã dùng không mất.
6. Công đoạn chạm ngoài kỳ lịch: báo lỗi rõ ràng.
7. Quyết định bị chặn với tài khoản hai vai trò (D5-04).
8. Chạy lại toàn bộ bộ kiểm tra PA1 sẵn có để đảm bảo không hồi quy.

## 6. Điều cần PO quyết

1. Danh sách ngày nghỉ 2026 và nguồn.
2. Xác nhận định mức 80 giờ (10 ngày) và 40 giờ (5 ngày).
3. Duyệt kích hoạt PA1 trên cơ sở dữ liệu local.
4. Duyệt gỡ công đoạn Cấp trên.
5. Duyệt danh sách tài khoản mô phỏng (mục 4.2) và mật khẩu cấp riêng.

## 7. Rủi ro đã biết
- Lịch hết hạn làm hệ thống từ chối mở công đoạn: chỉ nạp lịch 2026 thì mọi thao tác sau 31/12/2026 sẽ lỗi. Với khóa luận, giữ buổi demo trong 2026 hoặc nạp lịch năm sau.
- Nếu Quản lý chi nhánh vắng mà không có Quản lý thay thế, hồ sơ có thể bị kẹt (hệ thống chỉ cho Quản lý điều chuyển).

## 8. Nhật ký

| Ngày | Việc | Trạng thái |
|---|---|---|
| 04/11/2026 | Rà soát hiện trạng SLA, lịch, kích hoạt PA1, tài khoản; soạn kế hoạch | Đã có |
| | Các bước 0 đến 8 ở mục 3 | Chưa thực hiện, chờ PO duyệt |

---

## Tình trạng thực hiện trên cơ sở dữ liệu local (06/11/2026)
Người phụ trách yêu cầu làm theo kế hoạch; các thay đổi dưới đây chỉ nằm trong DB local, không nằm trong git.

| Bước | Kết quả |
|---|---|
| 0 Sao lưu | Hai bản `pg_dump` trước khi kích hoạt PA1 và trước khi áp schema (thư mục tạm của phiên làm việc) |
| 1 Lịch 2026 | Đã có sẵn trong mã: `VN-20260101-20261231-v1` |
| 2 Kích hoạt PA1 | Đã thêm một dòng ở `sla_policy_activations`, hiệu lực 06/11/2026 17:48 |
| 3 Định mức | **Cập nhật cuối ngày:** theo `backend/prisma/seed.js` của nhóm là Tiếp nhận **112** giờ, Thẩm định 40 giờ (ban đầu tôi đặt 80/40 trên DB local, đã đưa về 112/40). Cách đặt: SQL, không qua màn Cấu hình SLA nên không có dòng lịch sử thay đổi) |
| 4 Gỡ Cấp trên | Áp `prisma/remove-cap-tren.sql` (xóa một hồ sơ mẫu SME-20260920-0003 và công đoạn Cấp trên); áp phần schema còn thiếu (cột, bảng, khóa ngoại, không xóa dữ liệu); schema khớp repo (`migrate diff` rỗng) |
| 5 Hiển thị theo ngày | Chưa làm |
| 6 Tài khoản | Đã tạo 13 tài khoản qua `UsersService`, email `@sme-demo.example`, chi nhánh "Chi nhánh mô phỏng"; mật khẩu chung do hệ thống sinh, chuyển cho PO trong cuộc trò chuyện, không ghi vào tài liệu; đăng nhập thử thành công |
| 7 Kiểm thử | `check-sla-pa1.cjs` 118/118 đạt trên schema riêng (có gọi ml-service thật); 392 test backend đạt |
| Quay lui | Xóa dòng kích hoạt, đặt lại định mức 4/24/48/8, khôi phục từ bản sao lưu |

### Hồ sơ demo trong quá khứ (06/11/2026)
- Script: `ml-service/experiments/v3/tools/seed_demo_cases.cjs`. Đã tạo **194 hồ sơ demo** (180 đã hoàn tất: 142 duyệt, 38 từ chối; 14 đang mở) từ 12/01/2026 đến 06/11/2026, mỗi hồ sơ có lịch sử công đoạn Tiếp nhận, Thẩm định, Hoàn tất, các khoảng chờ doanh nghiệp bổ sung (tạm dừng SLA) và yêu cầu bổ sung.
- Thời điểm vào/ra từng công đoạn tính bằng đúng hàm giờ làm việc của backend (lịch VN-2026), giờ xử lý lấy từ hồ sơ giả lập thuộc tập test. Kết quả hệ thống tự tính: Tiếp nhận trễ 5,9% (trung bình 35,3 giờ), Thẩm định trễ 17,8% (27,6 giờ).
- 14 hồ sơ đang mở ở nhiều mức giờ đã dùng (3 đến 77 giờ ở Tiếp nhận, 3 đến 44 giờ ở Thẩm định, hai hồ sơ đang chờ doanh nghiệp) đã được chấm dự báo bằng mô hình v4 thật.
- **Đây là dữ liệu mô phỏng cho demo**, không dùng để huấn luyện lại mô hình (huấn luyện trên dữ liệu do chính mô phỏng sinh ra là vòng tròn). Lịch sử dùng PA1 cho cả giai đoạn trước ngày kích hoạt.
- Gỡ: `DELETE FROM loan_applications WHERE company_id IN (SELECT id FROM companies WHERE tax_code LIKE 'DEMO%'); DELETE FROM companies WHERE tax_code LIKE 'DEMO%';`
- Hai hồ sơ mẫu cũ `SME-20260915-0002`, `SME-20260925-0004` đã được xóa theo yêu cầu của người phụ trách (06/11/2026), cùng dự báo v1 và một thông báo nội bộ của chúng.

### Cập nhật cuối ngày 06/11/2026
- Định mức theo seed của nhóm: Tiếp nhận 112 giờ, Thẩm định 40 giờ. Mô hình đã huấn luyện lại với SLA 112 trong dải học (lưới Tiếp nhận 24 đến 128 giờ).
- Dữ liệu demo nay được đóng gói trong repo: `backend/scripts/seed-demo.cjs` và `backend/prisma/demo-cases.json` (`npm run seed:demo`), đọc định mức từ DB. Hồ sơ demo trên DB local đã dựng lại theo 112/40. Mật khẩu mô phỏng đổi thành `Demo@2026` (mặc định của script).
- `backend/prisma/seed.js` không còn tạo hai hồ sơ mẫu thiếu lịch sử (SME-20260915-0002, SME-20260925-0004) cùng dự báo v1; hồ sơ mẫu SME-20260901-0001 giữ nguyên.
