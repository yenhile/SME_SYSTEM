# Ma trận Acceptance Criteria phân quyền — phạm vi 1 chi nhánh (TK-03)

**Trạng thái: PO đã quyết các điểm ở mục 4 (25/10/2026); riêng `/companies` đang coi là giữ nguyên, chờ PO xác nhận lại.** Căn cứ: DEC-01 (một chi nhánh, giữ phân quyền theo vai trò và theo hồ sơ được phân công). Nội dung dưới đây mô tả **hành vi trong code sau khi áp dụng phương án B cho Thẩm quyền** (đọc `backend/src/**/*.controller.ts`, `common/guards/*`, `jwt.strategy.ts`, `loan-applications.service.ts`, `workflow.service.ts`, `portal.service.ts`), chưa phải quyết định nghiệp vụ mới. Phần chưa kiểm chứng chạy thật ghi rõ ở mục 5.

## 1. Nguyên tắc áp dụng
1. Mọi API nội bộ yêu cầu JWT hợp lệ. Mỗi phiên chọn một vai trò qua header `X-Active-Role`; backend kiểm tra vai trò đó có thuộc tài khoản không (không tin giao diện) và chỉ dùng **một** vai trò đang chọn cho phiên đó.
2. Không có lọc theo chi nhánh trong code: toàn bộ dữ liệu thuộc một chi nhánh (DEC-01). Trường `branchName` của người dùng chỉ để hiển thị.
3. **CBTD** chỉ truy cập hồ sơ có `assignedTo = chính mình`. **QUAN_LY** xem toàn bộ hồ sơ trong chi nhánh. **THAM_QUYEN** xem hồ sơ từ công đoạn Thẩm định trở đi (THAM_DINH, CAP_TREN, HOAN_TAT), **không** xem hồ sơ còn ở TIEP_NHAN.
4. Hồ sơ đã kết thúc (`HOAN_TAT` hoặc có `completedAt`) không cho thao tác ghi.

## 2. Ma trận theo chức năng (hành vi hiện tại)

| Chức năng | CBTD | THAM_QUYEN | QUAN_LY | ADMIN |
|---|---|---|---|---|
| Danh sách hồ sơ (`GET /loan-applications`) | Chỉ hồ sơ của mình | Từ THAM_DINH trở đi (lọc `stage=TIEP_NHAN` trả rỗng) | Toàn bộ | Không |
| Chi tiết hồ sơ (`GET /loan-applications/:id`) | Chỉ hồ sơ của mình (403 nếu khác) | Từ THAM_DINH trở đi (403 nếu ở TIEP_NHAN) | Toàn bộ | Không |
| Tạo hồ sơ, xác nhận chứng từ, đặt hạn mức | Có (tiếp nhận) | Không | Không | Không |
| Chứng từ: xem, tải xuống | Hồ sơ của mình | Từ THAM_DINH trở đi | Toàn bộ | Không |
| Chứng từ: tải lên, xóa | Hồ sơ của mình, **chỉ ở công đoạn TIEP_NHAN** | **Chỉ ở công đoạn sau TIEP_NHAN** | Không (chỉ xem) | Không |
| Yêu cầu bổ sung: xem | Hồ sơ của mình | Từ THAM_DINH trở đi | Toàn bộ | Không |
| Yêu cầu bổ sung: tạo, duyệt từng tài liệu, giải quyết | Hồ sơ của mình, ở TIEP_NHAN | Ở công đoạn sau TIEP_NHAN | Không | Không |
| Chuyển bước (`POST /workflow/:id/transition`) | TIEP_NHAN → THAM_DINH, hồ sơ được phân công | Từ THAM_DINH/CAP_TREN, kể cả duyệt/từ chối | Không | Không |
| Lịch sử công đoạn (`GET /workflow/:id/history`) | Hồ sơ của mình | Từ THAM_DINH trở đi | Toàn bộ | Không |
| Dự báo ML (`POST /prediction/predict/:id`) | Không (chỉ xem kết quả có sẵn) | Có, từ THAM_DINH trở đi | Có | Không |
| Dashboard SLA | Không | Có; danh sách cảnh báo không gồm hồ sơ TIEP_NHAN (số tổng hợp giữ nguyên) | Có | Không |
| Phân công, điều chuyển, tải cán bộ (`/assignments/*`, `POST /portal-intakes/:id/assign`) | Không | Không | Có | Không |
| Hàng đợi tiếp nhận từ Portal (`GET /portal-intakes`) | Chỉ yêu cầu được gán cho mình (và hồ sơ đã tiếp nhận của mình) | Không (403) | Tất cả SUBMITTED/ASSIGNED/ACCEPTED | Không |
| Tiếp nhận yêu cầu Portal thành hồ sơ (`POST /portal-intakes/:id/accept`) | Có (chỉ yêu cầu được gán) | Không | Không | Không |
| Danh sách doanh nghiệp (`GET /companies`) | Chỉ doanh nghiệp có hồ sơ gán cho mình | Xem toàn chi nhánh | Xem toàn chi nhánh | Không |
| Tra MST khi tạo hồ sơ (`GET /companies/check/:mst`) | Doanh nghiệp của mình: đủ thông tin và hồ sơ của mình; doanh nghiệp của cán bộ khác: chỉ báo "đã tồn tại", không có chi tiết | Đủ thông tin | Đủ thông tin | Không |
| Tạo/cập nhật doanh nghiệp (`POST /companies`, và khi tạo hồ sơ vay) | Chỉ doanh nghiệp mới hoặc doanh nghiệp có hồ sơ của mình; doanh nghiệp của cán bộ khác bị 403 | Không | Không | Không |
| Danh sách người dùng (`GET /users`) | Không | Không | Có | Có |
| Tạo/sửa người dùng, gán vai trò, khóa | Không | Không | Không | Có |
| Cấu hình SLA (`/admin/workflow-stages`) | Không | Không | Không | Có |
| Đổi mật khẩu của chính mình | Có | Có | Có | Có |

## 3. Acceptance Criteria (kiểm thử được)

| Mã | Tiêu chí | Kết quả mong đợi |
|---|---|---|
| AC-01 | CBTD A gọi `GET /loan-applications/{id}` của hồ sơ gán cho CBTD B | HTTP 403 "Bạn chỉ được truy cập hồ sơ được phân công." |
| AC-02 | Như AC-01 với `/documents/{id}`, `/supplements/application/{id}`, `/workflow/{id}/history`, tải chứng từ | HTTP 403 |
| AC-03 | CBTD gọi `GET /loan-applications` | Chỉ trả hồ sơ có `assignedTo` là mình |
| AC-04 | QUAN_LY gọi các API trên với hồ sơ bất kỳ; THAM_QUYEN với hồ sơ từ THAM_DINH trở đi | HTTP 200 |
| AC-05 | Vai trò không đúng gọi API yêu cầu vai trò khác (ví dụ CBTD gọi dashboard hoặc `/admin/...`) | HTTP 403 "Quyền truy cập bị từ chối. Yêu cầu vai trò: ..." |
| AC-06 | Header `X-Active-Role` là vai trò chưa được cấp cho tài khoản | HTTP 403 "Vai trò này chưa được cấp cho tài khoản." |
| AC-07 | CBTD chuyển bước hồ sơ không gán cho mình | HTTP 403 "Hồ sơ chưa được phân công cho bạn." |
| AC-08 | Thao tác ghi (chứng từ, bổ sung, chuyển bước) trên hồ sơ đã `HOAN_TAT` | HTTP 403 "Hồ sơ đã kết thúc, không thể chỉnh sửa." |
| AC-09 | Vai trò sai công đoạn thao tác chứng từ/bổ sung (ví dụ THAM_QUYEN ở TIEP_NHAN, CBTD ở THAM_DINH) | HTTP 403 "Vai trò đang dùng không được xử lý công đoạn này." |
| AC-11 | THAM_QUYEN mở (chi tiết, chứng từ, bổ sung, lịch sử, dự báo) hồ sơ đang ở TIEP_NHAN | HTTP 403 "Thẩm quyền chỉ truy cập hồ sơ từ công đoạn Thẩm định trở đi." |
| AC-12 | THAM_QUYEN gọi `GET /loan-applications` hoặc `/dashboard/early-warnings` | Không có hồ sơ TIEP_NHAN, kể cả khi truyền `stage=TIEP_NHAN` |
| AC-13 | THAM_QUYEN gọi `GET /portal-intakes` | HTTP 403 (hàng đợi chỉ còn CBTD và QUAN_LY) |
| AC-14 | CBTD chưa có hồ sơ nào gọi `GET /companies` | Danh sách rỗng |
| AC-15 | CBTD tra MST của doanh nghiệp không thuộc hồ sơ của mình | `{found:true, restricted:true, company:null}`, không có thông tin hay hồ sơ nào |
| AC-16 | CBTD gọi `POST /companies` hoặc tạo hồ sơ vay với MST của doanh nghiệp thuộc cán bộ khác | HTTP 403 "Doanh nghiệp này thuộc hồ sơ do cán bộ khác phụ trách...", dữ liệu doanh nghiệp không đổi |
| AC-10 | Token doanh nghiệp (Portal) dùng cho API nội bộ | HTTP 401 "Phiên doanh nghiệp không có quyền nội bộ" |

## 4. Quyết định của PO (25/10/2026)
1. **Doanh nghiệp (`/companies`):** PO quyết 26/10/2026: **CBTD chỉ xem doanh nghiệp có hồ sơ gán cho mình**; tra MST của doanh nghiệp người khác chỉ báo đã tồn tại. Quản lý và Thẩm quyền giữ phạm vi toàn chi nhánh. Ghi dữ liệu doanh nghiệp: **ai làm người nấy**, CBTD không ghi đè hay tạo hồ sơ cho doanh nghiệp của cán bộ khác.
2. **Quản lý:** giữ nguyên (phân công, điều chuyển, theo dõi; chỉ xem chứng từ/bổ sung, không thao tác).
3. **Thẩm quyền: phương án B** — chỉ xem hồ sơ từ công đoạn Thẩm định trở đi, không xem hồ sơ còn ở Tiếp nhận. Đây là thay đổi hành vi so với bản đề xuất trước (xem toàn bộ).
4. **Dự báo ML:** CBTD chỉ xem kết quả; hệ thống tự tính khi hồ sơ vào Thẩm định/Cấp trên; nút tính lại thủ công chỉ dành cho Thẩm quyền và Quản lý. Với Thẩm quyền, dự báo chỉ giúp sắp xếp ưu tiên.
5. **TK-04** chỉ viết kiểm thử tự động, không sửa logic chặn truy cập chéo (đã có).
6. Các mục chưa chốt trong `docs/Phan_quyen_va_luong_nghiep_vu.md` (tách vai trò cấp trên khỏi THAM_QUYEN, người đóng hồ sơ quá hạn) vẫn **ngoài phạm vi** tài liệu này.

## 5. Phạm vi đã và chưa kiểm chứng
- **Test tự động (đã chạy, pass):** `backend/test/loan-access.test.cjs` (`npm --prefix backend run test:access`) phủ AC-01, AC-02, AC-03, AC-04, AC-08, AC-09, AC-11, AC-12, AC-13 bằng Prisma giả lập, gồm truy cập chéo giữa hai CBTD qua ID hồ sơ, chứng từ và yêu cầu bổ sung. Toàn bộ 92 test backend `.cjs` pass.
- **Đã chạy thật (đọc, không ghi) trên backend Docker sau khi build lại:** `test_tham_quyen` thấy CAP_TREN, THAM_DINH, HOAN_TAT, không thấy TIEP_NHAN; `stage=TIEP_NHAN` trả 0; `GET /portal-intakes` trả 403; cảnh báo sớm không có TIEP_NHAN; mở chi tiết hồ sơ TIEP_NHAN trả 403, hồ sơ THAM_DINH trả 200. `test_quan_ly` và `test_cbtd` vẫn thấy cả 4 công đoạn.
- **Chưa kiểm chứng chạy thật:** AC-01, AC-02, AC-07 giữa hai CBTD khác nhau (dữ liệu hiện chỉ có một CBTD sở hữu mọi hồ sơ; đã có test giả lập thay thế). AC-05, AC-06, AC-10 chỉ đối chiếu code. Giao diện (ẩn tab "Chờ tiếp nhận" với Thẩm quyền) chưa quan sát trên trình duyệt.
- **Doanh nghiệp (26/10/2026):** `backend/test/companies-access.test.cjs` (8 test) pass; chạy thật trên Docker với một CBTD thử thứ hai không có hồ sơ (đã xóa): danh sách 0, tra MST trả "restricted", CBTD chủ hồ sơ vẫn đủ 4 doanh nghiệp, Quản lý và Thẩm quyền vẫn 4; giao diện Chrome hiện thông báo ở form tạo hồ sơ.
- **Ghi dữ liệu doanh nghiệp (26/10/2026, PO: "của ai người nấy làm"):** đã chặn. Chạy thật: CBTD thử thứ hai gọi `POST /companies` và `POST /loan-applications` với MST của doanh nghiệp người khác đều 403, dữ liệu doanh nghiệp và số hồ sơ không đổi; nút tạo hồ sơ bị vô hiệu hóa ở giao diện. Hệ quả cần biết: khách quen đã có hồ sơ ở cán bộ A thì cán bộ B không tự tạo hồ sơ mới cho khách đó được; phải phối hợp qua Quản lý (điều chuyển hồ sơ hiện có).
