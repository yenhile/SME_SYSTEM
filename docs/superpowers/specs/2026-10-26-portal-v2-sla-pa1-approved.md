# Portal V2 và SLA PA1 — baseline nghiệp vụ được PO duyệt

Ngày ghi nhận: 26/10/2026. Nguồn phê duyệt: hội thoại PO trong phiên này, gồm xác nhận cuối cùng chọn PA1 và đồng ý các điều chỉnh tiếp theo. Tài liệu ghi nhận yêu cầu; không phải bằng chứng chức năng đã được triển khai hoặc nghiệm thu.

## 1. Phạm vi và các quyết định

| Mã | Quyết định được ghi nhận |
|---|---|
| V0-A | Portal V2 mở cho kịch bản mô phỏng doanh nghiệp sản xuất vay vốn lưu động. |
| V1-A | Một năm tài chính hoàn thành gần nhất, niên độ trùng năm lịch; bộ mô phỏng gồm bảng cân đối kế toán, kết quả kinh doanh, lưu chuyển tiền tệ, thuyết minh. Không tuyên bố đây là nghĩa vụ của mọi doanh nghiệp. |
| V2-A | Chứng từ đại diện/ủy quyền, cam kết khi gửi và CBTD đối chiếu; chưa tích hợp ký số. |
| V3-A | Checklist cố định A–F và ngoại lệ được liệt kê bên dưới; không miễn/hoãn tùy ý. |
| V4-A | Không tự ghi đè Company; chặn tiếp nhận khi thông tin đối chiếu không phù hợp, ghi rõ vướng mắc và đầu mối xử lý. |
| S1/S3 | PA1: giờ Việt Nam, thứ Hai–thứ Sáu, 08:00–12:00 và 13:00–17:00; ngày nghỉ theo lịch được xác nhận. PA1 thay lựa chọn PA2 ban đầu. |
| S2 điều chỉnh | Pause khi chờ doanh nghiệp; tiếp tục SLA khi doanh nghiệp chính thức gửi đủ phản hồi theo yêu cầu để ngân hàng kiểm tra. Không chạy tiếp chỉ vì tải tệp lẻ. |
| S4-A | Chính sách mới áp dụng cho công đoạn mở mới sau thời điểm hiệu lực; công đoạn/lịch sử cũ giữ cách tính cũ. |
| Kiểm soát PA1 | Chung phép tính, lưu từng khoảng pause, chỉ trừ phần giao giờ làm việc, chụp phiên bản chính sách/lịch; giữ định mức hiện có. |
| ML | Nghiệm thu SLA PA1 riêng với khả năng dự báo; chỉ công nhận dự báo PA1 sau đánh giá tương thích. Không tự huấn luyện/ghi đè model. |

## 2. Checklist và điều kiện tiếp nhận

| Nhóm | Bắt buộc trước gửi | Được yêu cầu sau tiếp nhận |
|---|---|---|
| A | Đăng ký doanh nghiệp, điều lệ, định danh và căn cứ đại diện; ủy quyền nếu áp dụng. | Tài liệu làm rõ theo kiểm tra. |
| B | Bộ BCTC theo V1, kỳ và nguồn doanh thu cùng năm. | Công nợ, tồn kho, báo cáo kỳ gần nhất. |
| C | Kế hoạch sản xuất kinh doanh và ít nhất một bằng chứng đầu ra: hợp đồng kinh doanh, đơn đặt hàng hoặc hóa đơn phù hợp phương án. | Báo giá, hợp đồng nguyên vật liệu, tài liệu làm rõ. |
| D | Đề nghị vay vốn, phương án sử dụng vốn. | Chi tiết dòng tiền trả nợ theo thẩm định. |
| E | Khai rõ có/không đề xuất bảo đảm; mô tả nếu có. Chưa xác định thì giữ nháp. | Hồ sơ quyền tài sản, định giá. |
| F | Khai rõ có/không dư nợ; có dư nợ thì có thông tin dư nợ. | Lịch trả nợ, sao kê chi tiết. |

- Doanh nghiệp biết mục cần nộp, điều kiện áp dụng, kỳ, loại thay thế, thông tin còn thiếu và vị trí cần sửa.
- Phân biệt ba mức: đủ để gửi; CBTD kiểm tra đạt điều kiện tiếp nhận; đủ chứng từ để chuyển thẩm định. Không đưa thẩm định tín dụng vào kiểm tra tiếp nhận.
- Hệ thống xác nhận đủ theo dữ liệu và danh mục; CBTD đối chiếu chủ thể, đại diện, kỳ, thành phần, nội dung đọc được, liên quan phương án và dữ liệu trọng yếu.
- Mỗi kết quả kiểm tra gắn mục checklist, phiên bản đề nghị/tài liệu, người kiểm tra, thời điểm và lý do. Không coi upload thành công là tài liệu hợp lệ.
- Giữ 13 trường dữ liệu thực hiện có; không annualize, không fake0. Giá trị 0 thực không phải thiếu. Thiếu dữ liệu năm hoàn thành chỉ giữ nháp, không từ chối tín dụng.
- Kỳ yêu cầu được xác định lúc gửi; tiếp nhận đầu năm sau không tự áp lại kỳ theo ngày hiện tại.
- Tiếp nhận tạo Loan ở TIEP_NHAN/RECEIVED, chưa tự đặt CHECKED hoặc isDocumentComplete=true.

## 3. Chỉnh sửa đề nghị và kiểm soát phiên bản

- Trước gửi: sửa bản nháp.
- Đã gửi, chưa Loan: CBTD được phân công trả danh sách chỉnh sửa tổng hợp; doanh nghiệp sửa phiên bản mới của cùng đề nghị và gửi lại; giữ nguyên các lần gửi trước.
- Doanh nghiệp tự phát hiện sai: gửi đề nghị chỉnh sửa, không tự mở khóa. Chưa được phân công thì Quản lý giao CBTD xử lý.
- Chỉ kiểm tra lại các mục bị thay đổi/ảnh hưởng; không buộc tải lại tài liệu không đổi. Nếu thay căn cứ áp dụng, tính lại các mục checklist phụ thuộc.
- Thay mã số thuế sang chủ thể khác không phải sửa lỗi thông thường; hướng dẫn đề nghị mới và giữ liên hệ lịch sử, không tự đóng/xóa đề nghị cũ.
- Đã Loan: dùng bổ sung của Loan; giữ snapshot nộp gốc, không sửa Company hoặc nội dung vay ngoài quyền nghiệp vụ.
- Hồ sơ kết thúc giữ lịch sử; chưa bổ sung chức năng mở lại.

## 4. Phân công và vướng mắc

- Quản lý phân công/điều chuyển; CBTD đúng phân công kiểm tra, trả sửa và tiếp nhận. Sau tiếp nhận, điều chuyển tại Loan.
- Mỗi vướng mắc có vấn đề, chứng cứ tham chiếu, bước đã kiểm tra, phương án, đầu mối và kết quả. Không lộ ghi chú nội bộ trên Portal.
- Quản lý điều phối đối soát, bố trí cán bộ, hoặc trình quyết định vượt quyền; không bỏ checklist, cấp quyền ngầm, thay quyết định tín dụng hay sửa Company để vượt chặn.
- ADMIN cấu hình lịch theo phương án nghiệp vụ đã được xác nhận; không thực hiện kết luận chứng từ.
- Điều chuyển không xóa thời gian đã dùng và không tự pause SLA.

## 5. SLA và bổ sung sau Loan

- SLA Loan bắt đầu khi tiếp nhận; thời gian từ gửi đề nghị tới tiếp nhận được theo dõi riêng, chưa áp định mức mới.
- Theo dõi thêm thời gian thực 24/7 từ gửi để thấy tổng thời gian doanh nghiệp đã chờ; phân biệt vòng đời đề nghị và thời gian từ lần gửi gần nhất, không lấy một timestamp thay cho mọi nghĩa.
- Gửi yêu cầu bổ sung: chờ CUSTOMER và mở pause.
- Gửi chính thức đủ các mục đang chờ: chờ BANK, đóng pause; Loan vẫn SUPPLEMENT_REQUIRED và bị chặn chuyển bước.
- Cán bộ kiểm tra từng mục. Khi hoàn tất lượt kiểm tra và gửi danh sách sửa: chờ CUSTOMER, mở pause mới. Không pause theo từng lần đánh dấu mục khi ngân hàng còn đang kiểm tra.
- Tất cả mục được chấp nhận: cán bộ hoàn tất yêu cầu; giữ luồng trạng thái hiện có, không đóng pause hai lần.
- Giữ nghĩa supplementCount: tăng khi tạo yêu cầu, không tăng theo từng tệp, phản hồi hoặc lượt trả sửa. Không phát sinh lời gọi ML mới chỉ vì response.
- Giữ mốc 5/10 ngày, cách đếm ngày và deadlineAt đã duyệt. Không tự gia hạn/reset hạn sau mỗi lượt sửa.
- Bộ nhắc và đóng quá hạn phải biết đang chờ ai; không coi doanh nghiệp chưa phản hồi chỉ vì cán bộ chưa kiểm tra. Nộp muộn giữ dấu vết. Quản lý không đóng chỉ do tồn đọng kiểm tra của ngân hàng.
- Chưa tự đặt thêm hạn kiểm tra nội bộ hoặc quyền gia hạn.

## 6. Phân kỳ, dữ liệu và phát hành

- Ghi schema/script chuyển đổi bổ sung, không xóa/reset dữ liệu và không viết lại lịch sử cũ.
- Lịch làm việc và ngày nghỉ có phiên bản được xác nhận; không mặc định lịch nghỉ chính thức khi chưa có nguồn. Lịch demo phải ghi nhãn mô phỏng. Chỉ kích hoạt PA1 sau khi đủ lịch cho kỳ áp dụng.
- Công đoạn cũ giữ legacy kể cả khi có bổ sung đang mở; không suy dựng pause interval lịch sử từ tổng giờ. Công đoạn mới chụp policy PA1 sau thời điểm hiệu lực.
- Không dùng xác suất/risk giả khi chưa có dự báo tương thích. Dự báo lịch sử giữ nguyên và hiển thị đúng phạm vi.
- Phê duyệt nghiệp vụ không đồng nghĩa đã thực hiện migration trên DB đang dùng, bật demo hoặc huấn luyện ML. Target và tác động các bước này phải được nêu cụ thể ở checkpoint vận hành, dùng lại quyền đã cấp nếu đã bao phủ.

Kế hoạch: [Implementation plan](../plans/2026-10-26-portal-v2-sla-pa1-implementation.md).

## 7. Trách nhiệm kiểm tra chức năng

Theo chỉ đạo PO 26/10/2026, chỉ tổ chức hai vai trò làm việc: Lead BA và Lead FullStack. Lead BA đảm nhận thiết kế tình huống, kiểm tra và chốt đạt/chưa đạt nghiệp vụ theo baseline; Lead FullStack cung cấp kiểm chứng kỹ thuật. PO quyết định thay đổi nghiệp vụ và nghiệm thu cuối. Không thay RoleCode của cán bộ trong ứng dụng.

Tham chiếu: [ảnh hưởng và công việc còn lại](../../handover/2026-10-26-impact-and-next-steps.md), [bộ kiểm tra BA](../../testing/portal-v2-policy/TEST_CASES.md).
