# Phân tích ảnh hưởng ngang → sâu trước khi làm tính năng

Bắt buộc theo **SME-AI-011** và **SME-AI-012** trong [policy](../AGENTS.md), cho mọi nhiệm vụ phân tích, xây dựng, chỉnh sửa hoặc xóa tính năng/chức năng. Phân tích không cấp quyền sửa. Plan-only chỉ bàn giao phân tích/kế hoạch; đã có quyền triển khai thì thực hiện trong đúng phạm vi.

## 1. Chốt ranh giới và xử lý yêu cầu có vấn đề

Ghi yêu cầu PO, kết quả cần đạt, phạm vi được phép, giới hạn và quyết định đã duyệt trong hội thoại/plan. Nếu thấy yêu cầu không hợp lý, không tối ưu hoặc có nguy cơ gây lỗi, dừng phần thực thi phụ thuộc vấn đề đó và trình:

- Yêu cầu đang được xem xét; nguồn/file/luồng chứng minh vấn đề.
- Vì sao có thể lỗi hoặc không tối ưu; tác động, mức độ và điều kiện xảy ra. Phân biệt bằng chứng với giả thuyết.
- Phương án đề xuất tốt hơn, lợi ích/đánh đổi và phần phạm vi cần thay đổi.
- Quyết định cụ thể cần PO duyệt trước khi thực hiện phương án khác.

Không tự thay yêu cầu bằng phương án AI cho là tốt hơn. Chờ PO chấp thuận rõ; im lặng không phải duyệt. Tiếp tục được phần độc lập đã được cho phép nếu không tạo kết quả dở dang/sai. Không hỏi lại quyền đã có; lựa chọn kỹ thuật thông thường chỉ được tự quyết khi PO không ấn định và vẫn đáp ứng đúng yêu cầu/phương án đã duyệt.

## 2. Chiều ngang — xác định độ phủ tính năng

Từ tính năng gốc, lập danh sách tính năng, màn hình, actor, luồng và contract dùng chung/có liên hệ; xác định producer/consumer và chiều tác động. Đối chiếu frontend, API/DTO, guard/quyền, service, schema/dữ liệu, SLA/lịch sử, ML và tài liệu khi có liên quan; không mặc định mọi dự án con đều phải sửa.

Với từng phần: ghi quan hệ, hành vi có thể đổi/hỏng, bằng chứng, mức ảnh hưởng (cao/vừa/thấp kèm lý do), cần sửa hay chỉ hồi quy và quyền hiện có. Không biết thì ghi chưa xác minh và tìm thêm, không tự coi là không ảnh hưởng.

## 3. Chiều sâu — truy vết đệ quy từ độ phủ đã biết

Sau bản đồ chiều ngang, lần theo file/symbol gốc (cha) → thành phần trực tiếp liên quan (con) → thành phần của chúng (cháu) → tiếp tục các tầng liên quan. Kiểm tra cả **nơi gọi/nơi tiêu thụ** và **phần được gọi/phụ thuộc**, cùng đường đi dữ liệu, validation, quyền, side effect và xử lý lỗi; không chỉ đọc import một chiều.

Với việc phụ thuộc mã nguồn, dùng [CodeGraph](../../docs/ai/2026-10-18-codegraph.md): graph phải mới, lấy context/deps/fn-impact cho các điểm đã xác định. Kết hợp đọc source, tìm call site bằng rg, contract và test để nối qua HTTP, DI/decorator, ORM, event/job, lời gọi động hoặc khác ngôn ngữ mà graph không chứng minh được. File ngoài tập source của graph vẫn phải được xét khi liên quan.

Duyệt theo danh sách chờ và tập đã thăm để xử lý vòng lặp; ghi lại đường dẫn quan hệ/bằng chứng. Chỉ dừng một nhánh khi đã kiểm tra và giải thích ranh giới: không còn cạnh liên quan đến thay đổi, hành vi/contract tại biên được giữ nguyên có kiểm chứng, hoặc thành phần ngoài kiểm soát được ghi rõ giới hạn. Nếu tìm thêm tính năng liên quan, cập nhật bản đồ ngang rồi tiếp tục sâu.

Không dùng độ sâu mặc định, giới hạn số kết quả, trang đầu hoặc số caller bằng 0 làm bằng chứng đã duyệt hết. Tăng độ sâu/truy vấn tiếp từng nút, kiểm tra kết quả bị cắt và bù bằng source khi cần. Nhánh chưa giải quyết phải ghi chưa xác minh/blocker cùng bước tiếp theo; không tuyên bố đã phủ hết.

## 4. Quyết định sửa, thực thi và hồi quy

Lập ma trận ngắn trước sửa; task nhỏ có thể ghi ngay trong phản hồi/plan, task nhiều bước lưu cùng plan. Mỗi dòng là một phần bị ảnh hưởng:

| Tính năng/luồng | File/symbol và đường cha → con → cháu | Ảnh hưởng + bằng chứng | Sửa/hồi quy | Quyền PO | Kiểm chứng/kết quả |
|---|---|---|---|---|---|

Mọi thay đổi cần thiết trong phạm vi đã duyệt phải được thực hiện và kiểm chứng xuyên suốt luồng, từ điểm vào tới kết quả/side effect có liên quan; không chỉ sửa file cha rồi kết luận xong. Không sửa mọi file được graph liệt kê: phần không cần thay đổi được giữ nguyên và kiểm tra hồi quy khi có ảnh hưởng.

Nếu cần sửa tính năng/file/hành vi ngoài phạm vi cho phép, báo quan hệ phụ thuộc, lý do bắt buộc, tác động nếu không sửa và phương án mở rộng để PO duyệt **trước khi sửa**. Không lấy yêu cầu hoàn thiện từ trên xuống dưới làm quyền tự mở rộng. Khi phần ngoài phạm vi chặn kết quả, giữ trạng thái chưa hoàn tất; không bàn giao phần cha như đã xong.

Đối chiếu tiêu chí nghiệm thu và ma trận ảnh hưởng: kiểm tra hành vi chính, trường hợp lỗi/biên và hồi quy các tính năng liên quan theo rủi ro. Với xóa, kiểm tra callers, route, exports, consumer, dữ liệu/migration và tài liệu khi liên quan; không tự xóa dữ liệu/đổi schema nếu chưa có quyền. Chạy kiểm tra thực sự phù hợp và đọc kết quả; build đơn thuần không chứng minh toàn bộ luồng hay UI.

Làm mới và kiểm tra CodeGraph sau thay đổi source/config. Bàn giao gồm phạm vi ngang, đường phụ thuộc sâu quan trọng, phần sửa và hồi quy, bằng chứng đã chạy, nhánh chưa xác minh và phần chờ PO. Không cam kết không bao giờ có hồi quy chỉ từ sơ đồ hoặc kiểm tra tĩnh.
