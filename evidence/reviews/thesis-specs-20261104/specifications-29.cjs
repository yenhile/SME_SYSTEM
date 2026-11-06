const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = JSON.parse(fs.readFileSync(path.join(__dirname,'specifications.json'),'utf8').replace(/^\uFEFF/,''));
const specs=[];
const branch=(at,actor,system)=>({at,actor,system});
function add(description,pre,post,actor,flow,alternatives,exceptions){
 const index=specs.length;
 const old=index<28?base.specs[index]:base.specs[32];
 specs.push({id:`UC${String(index+1).padStart(2,'0')}`,title:index<28?old.title:'Lập và gửi đề nghị vay',
 section:index<28?old.section:'3.8.14',description,pre,post,actor,
 flow:flow.split('~').map(row=>row.split('=>')),alternatives,exceptions,
 refs:index<28?old.refs:['PORTAL','INTAKE','FOUNDATION','FILES','UI_WIZARD']});
}
add('Cho phép cán bộ ngân hàng đăng nhập và truy cập các chức năng theo vai trò được cấp.',
'Người dùng có tài khoản nội bộ và đã được cấp ít nhất một vai trò.',
'Người dùng được xác thực và truy cập không gian làm việc của vai trò hợp lệ.',
'Cán bộ tín dụng, Cán bộ thẩm quyền, Quản lý chi nhánh, Quản trị viên.',
'Truy cập hệ thống nội bộ.=>Hiển thị biểu mẫu Tên đăng nhập và Mật khẩu.~Nhập thông tin và nhấn Đăng nhập.=>Kiểm tra thông tin, trạng thái tài khoản và giới hạn đăng nhập sai; xác thực khi hợp lệ.~Sử dụng vai trò làm việc được hệ thống chọn từ các vai trò đã cấp.=>Hiển thị màn hình và các chức năng tương ứng.',
[branch(5,'Tài khoản có nhiều vai trò: chọn vai trò khác được cấp và xác nhận chuyển.','Chuyển không gian làm việc; đóng biểu mẫu của vai trò cũ. Các ràng buộc người lập/người duyệt vẫn áp dụng theo cùng tài khoản.')],
[branch(4,'','Sai tên đăng nhập hoặc mật khẩu: thông báo lỗi, quay lại bước 3.'),branch(4,'','Tài khoản bị khóa hoặc chưa có vai trò: không cho truy cập chức năng, hướng dẫn liên hệ Quản trị viên.'),branch(4,'','Đăng nhập sai quá số lần cho phép: yêu cầu chờ trước khi thử lại.'),branch(4,'','Không kết nối được hệ thống: thông báo lỗi kết nối, cho phép thử lại; không kết luận tài khoản bị khóa.')]);
add('Cho phép cán bộ tín dụng kiểm tra các mục dữ liệu, chứng từ của lần gửi đề nghị vay chính thức trước khi tiếp nhận.',
'Đã đăng nhập với vai trò Cán bộ tín dụng và được phân công đề nghị. Đề nghị đang chờ ngân hàng tiếp nhận, có lần gửi chính thức và không bị chặn do xung đột lợi ích.',
'Kết quả từng mục được lưu là Đã kiểm tra đạt hoặc Cần chỉnh sửa trên đúng lần gửi. Chưa tạo hồ sơ vay nội bộ.',
'Cán bộ tín dụng.',
'Mở Danh sách hồ sơ, chọn Chờ tiếp nhận.=>Hiển thị các đề nghị được phân công.~Nhấn Xem đề nghị và mở checklist.=>Hiển thị dữ liệu, tài liệu và các mục cần kiểm tra của lần gửi gần nhất.~Đối chiếu nội dung tài liệu, nhấn Kiểm tra đạt tại mục đáp ứng yêu cầu.=>Lưu kết quả Đã kiểm tra đạt, người kiểm tra và thời điểm kiểm tra.',
[branch(5,'Mục chưa đạt: nhập lý do và nhấn Yêu cầu sửa mục này.','Lưu kết quả Cần chỉnh sửa. Cán bộ tiếp tục kiểm tra các mục còn lại rồi thực hiện use case Trả sửa đề nghị.')],
[branch(6,'','Lần gửi hoặc dữ liệu kiểm tra đã thay đổi: không lưu trên bản cũ, yêu cầu tải lại.'),branch(6,'','Đề nghị không còn trong phạm vi phụ trách hoặc không còn ở trạng thái được kiểm tra: chặn thao tác.'),branch(6,'','Thiếu tài liệu hoặc thiếu lý do cần sửa: thông báo nội dung cần hoàn thiện.')]);
add('Cho phép cán bộ tín dụng trả đề nghị chưa tiếp nhận để doanh nghiệp sửa dữ liệu hoặc chứng từ; xử lý yêu cầu xin sửa do doanh nghiệp gửi.',
'Đã đăng nhập với vai trò Cán bộ tín dụng, đang phụ trách đề nghị chờ tiếp nhận. Có mục chưa đạt, dữ liệu cần sửa hoặc yêu cầu xin chỉnh sửa của doanh nghiệp.',
'Khi trả sửa: đề nghị chuyển Cần chỉnh sửa đề nghị, doanh nghiệp được sửa và gửi lại trên cùng mã; lịch sử lần gửi trước được giữ nguyên. Khi không đồng ý xin sửa: đề nghị tiếp tục chờ tiếp nhận và lưu lý do.',
'Cán bộ tín dụng.',
'Mở đề nghị cần xử lý trong Chờ tiếp nhận.=>Hiển thị thông tin, checklist và các nội dung cần chỉnh sửa.~Nhập hướng dẫn sửa dữ liệu nếu có, nhấn Trả đề nghị để chỉnh sửa.=>Hiển thị yêu cầu xác nhận gửi danh sách chỉnh sửa tổng hợp.~Xác nhận trả sửa.=>Lưu danh sách cần chỉnh sửa, chuyển đề nghị sang Cần chỉnh sửa đề nghị và cho doanh nghiệp xem nội dung.',
[branch(1,'Có yêu cầu xin sửa của doanh nghiệp: nhập lý do xử lý, chọn Đồng ý và trả sửa hoặc Không đồng ý trả sửa.','Nếu đồng ý, mở sửa đề nghị; nếu không đồng ý, giữ trạng thái chờ tiếp nhận. Lưu kết quả và lý do để doanh nghiệp xem.'),branch(5,'Không xác nhận trả sửa.','Giữ trạng thái đề nghị; kết thúc thao tác trả sửa.'),branch(6,'Doanh nghiệp mở đề nghị đã được trả sửa, cập nhật thông tin/tài liệu và gửi lại theo use case Lập và gửi đề nghị vay.','Lưu lần gửi mới trên cùng mã; cán bộ kiểm tra lại phần thay đổi, chỉ kế thừa kết quả đạt khi căn cứ không đổi và lượt trả sửa cho phép kế thừa.')],
[branch(4,'','Chưa ghi rõ nội dung cần sửa: không cho trả đề nghị.'),branch(4,'','Đang có yêu cầu xin sửa chưa xử lý: yêu cầu cán bộ quyết định yêu cầu xin sửa trước.'),branch(6,'','Lần gửi, phân công hoặc trạng thái đã thay đổi: không thực hiện trên bản cũ, yêu cầu tải lại.')]);
add('Cho phép cán bộ tín dụng gửi yêu cầu đối soát khi thông tin doanh nghiệp khai báo khác dữ liệu doanh nghiệp hiện hữu trong hệ thống.',
'Đã đăng nhập với vai trò Cán bộ tín dụng, đang phụ trách đề nghị chờ tiếp nhận. Mã số thuế đã tồn tại, có khác biệt cần đối soát và chưa có yêu cầu đối soát đang mở.',
'Yêu cầu đối soát được lưu và gửi đến Quản lý chi nhánh. Dữ liệu doanh nghiệp hiện hữu chưa bị thay đổi; đề nghị chưa được tiếp nhận.',
'Cán bộ tín dụng.',
'Mở đề nghị và nhấn Đối chiếu dữ liệu Company.=>Hiển thị thông tin hiện hữu và khác biệt với bản doanh nghiệp đã gửi.~Nhập căn cứ, nhấn Gửi đối soát Company.=>Lưu yêu cầu gắn với lần gửi và dữ liệu hiện hữu được đối chiếu; thông báo Quản lý chi nhánh.',
[branch(2,'Thông tin đã khớp: tiếp tục kiểm tra điều kiện tiếp nhận.','Thông báo không cần cập nhật dữ liệu doanh nghiệp; kết thúc use case.')],
[branch(4,'','Thiếu căn cứ hoặc đã có yêu cầu đối soát đang chờ: không tạo yêu cầu mới.'),branch(4,'','Dữ liệu doanh nghiệp hoặc lần gửi đã thay đổi: yêu cầu tải lại và đối chiếu lại.'),branch(4,'','Không còn phụ trách hoặc có xung đột lợi ích chặn thao tác: từ chối gửi yêu cầu.')]);
add('Cho phép cán bộ tín dụng tiếp nhận đề nghị đã kiểm tra đạt để tạo hồ sơ vay nội bộ.',
'Đã đăng nhập với vai trò Cán bộ tín dụng, đang được phân công đề nghị chờ tiếp nhận. Toàn bộ mục bắt buộc đã đạt trên đúng lần gửi; không còn xin sửa, đối soát/vướng mắc hoặc xung đột lợi ích chưa xử lý. Số tiền thuộc phạm vi chi nhánh.',
'Tạo duy nhất một hồ sơ vay ở công đoạn Tiếp nhận, trạng thái Mới tiếp nhận; đề nghị chuyển Đã tiếp nhận và liên kết hồ sơ vừa tạo. Lưu thông tin doanh nghiệp tại thời điểm tiếp nhận, chứng từ, người tiếp nhận và bắt đầu đo SLA hồ sơ vay.',
'Cán bộ tín dụng.',
'Mở đề nghị đã kiểm tra đạt, nhấn Kiểm tra doanh nghiệp để tiếp nhận.=>Kiểm tra mã số thuế và các điều kiện tiếp nhận.~Rà soát kết quả; nếu doanh nghiệp đã tồn tại, xác nhận liên kết và đã đối chiếu kỳ/nguồn tài chính hiện hữu.=>Cho phép tiếp tục khi dữ liệu phù hợp; giữ dữ liệu doanh nghiệp dùng chung.~Nhấn Tiếp nhận thành hồ sơ vay.=>Hiển thị yêu cầu xác nhận.~Xác nhận tiếp nhận.=>Tạo hồ sơ vay, chứng từ, lịch sử công đoạn đầu tiên; chuyển đề nghị sang Đã tiếp nhận và mở hồ sơ mới.',
[branch(2,'Mã số thuế chưa tồn tại: tiếp tục tiếp nhận.','Tạo doanh nghiệp từ thông tin đã kiểm tra khi ghi nhận hồ sơ vay.'),branch(2,'Thông tin không khớp doanh nghiệp hiện hữu.','Chưa cho tiếp nhận; chuyển sang Đối soát công ty và Duyệt đối soát công ty.'),branch(7,'Không xác nhận tiếp nhận.','Không tạo hồ sơ vay, giữ trạng thái đề nghị.')],
[branch(2,'','Checklist chưa đạt, còn xin sửa/đối soát đang mở hoặc tài chính chưa phù hợp: thông báo lý do chưa đủ điều kiện.'),branch(8,'','Lần gửi, tệp hoặc phân công thay đổi: không tiếp nhận theo bản cũ; yêu cầu tải lại.'),branch(8,'','Đề nghị đã tiếp nhận hợp lệ: trả về hồ sơ đã liên kết trong phạm vi quyền, không tạo hồ sơ vay thứ hai.')]);
add('Cho phép cán bộ xử lý công đoạn yêu cầu doanh nghiệp bổ sung chứng từ cho hồ sơ vay đã tiếp nhận.',
'Đã đăng nhập đúng vai trò xử lý: Cán bộ tín dụng phụ trách tại Tiếp nhận hoặc Cán bộ thẩm quyền tại Thẩm định. Hồ sơ chưa kết thúc, không có đợt bổ sung đang chờ và không bị chặn do xung đột lợi ích. Bổ sung qua Portal yêu cầu hồ sơ liên kết đề nghị đã tiếp nhận.',
'Tạo đợt bổ sung đang chờ, hồ sơ chuyển Chờ bổ sung; bỏ xác nhận đủ chứng từ, tăng số đợt bổ sung và tạm dừng SLA chờ doanh nghiệp theo chính sách của công đoạn.',
'Cán bộ tín dụng, Cán bộ thẩm quyền.',
'Mở chi tiết hồ sơ, chọn thẻ Yêu cầu bổ sung.=>Hiển thị lịch sử và các yêu cầu hiện có.~Nhấn Tạo yêu cầu bổ sung theo danh mục.=>Hiển thị biểu mẫu nội dung và danh sách mục cần bổ sung.~Nhập nội dung gửi doanh nghiệp, loại tài liệu, kỳ nếu có và lý do từng mục; nhấn Gửi yêu cầu & Tạm dừng SLA.=>Kiểm tra dữ liệu, tạo đợt bổ sung, cập nhật hồ sơ và ghi nhận thời gian chờ doanh nghiệp.',
[branch(5,'Cần nhiều tài liệu: nhấn Thêm mục và khai từng mục.','Bổ sung dòng nhập; tiếp tục bước 5.'),branch(6,'Doanh nghiệp mở Bổ sung hồ sơ sau tiếp nhận, tải tài liệu cho các mục yêu cầu và nhấn Gửi tài liệu bổ sung khi đã đủ.','Kiểm tra bộ tệp, ghi Đã gửi, chờ kiểm tra. Với SLA giờ làm việc PA1, kết thúc khoảng chờ doanh nghiệp ngay khi gửi đủ; chuyển sang Giải quyết bổ sung.')],
[branch(6,'','Thiếu nội dung/lý do, mục trùng hoặc sai danh mục: thông báo lỗi, quay lại bước 5.'),branch(6,'','Đã có đợt bổ sung đang chờ, sai vai trò/công đoạn hoặc hồ sơ đã kết thúc: không tạo đợt mới.'),branch(6,'','Gửi lại cùng thao tác đã được ghi nhận hợp lệ: trả kết quả hiện có, không tăng thêm số đợt bổ sung.')]);
add('Cho phép cán bộ xử lý công đoạn kiểm tra tài liệu doanh nghiệp đã nộp và hoàn tất đợt bổ sung.',
'Đã đăng nhập đúng vai trò xử lý công đoạn; Cán bộ tín dụng phải đang phụ trách hồ sơ. Hồ sơ chưa kết thúc, có đợt bổ sung đang chờ và tài liệu doanh nghiệp đã gửi chính thức.',
'Khi mọi mục đạt, đợt chuyển Đã hoàn tất. Hồ sơ về Mới tiếp nhận nếu ở Tiếp nhận hoặc Đang thẩm định nếu ở Thẩm định; chưa tự xác nhận lại đủ chứng từ. SLA tiếp tục theo chính sách đã lưu.',
'Cán bộ tín dụng, Cán bộ thẩm quyền.',
'Mở chi tiết hồ sơ, chọn Yêu cầu bổ sung.=>Hiển thị các mục đã gửi và tài liệu hiện hành.~Kiểm tra tài liệu, nhập thông điệp nếu cần và nhấn Chấp nhận mục tại từng mục đạt.=>Ghi Đã chấp nhận cho mục tương ứng.~Nhấn Hoàn tất yêu cầu & Chạy lại SLA khi tất cả mục đạt.=>Đóng đợt bổ sung, khôi phục trạng thái hồ sơ theo công đoạn và thông báo hoàn tất.',
[branch(3,'Tài liệu chưa đạt: ghi thông điệp, chọn Yêu cầu thay thế; kiểm tra xong các mục đã gửi rồi nhấn Gửi danh sách sửa cho doanh nghiệp.','Ghi các mục Cần thay thế; với PA1, mở lại khoảng chờ doanh nghiệp từ lúc gửi danh sách sửa.'),branch(3,'Doanh nghiệp nhận yêu cầu thay thế, tải bản mới và gửi đủ lại.','Giữ lịch sử tệp, chỉ dùng bản hiện hành; cán bộ kiểm tra tiếp. PA1 kết thúc khoảng chờ khi doanh nghiệp gửi đủ.'),branch(6,'Hồ sơ áp dụng cách tính SLA cũ.','Kết thúc thời gian tạm dừng khi hoàn tất bổ sung. Với PA1, không tính lại lần hai khoảng chờ đã đóng lúc doanh nghiệp gửi đủ.')],
[branch(6,'','Còn mục chưa được chấp nhận: không cho hoàn tất, quay lại bước 3.'),branch(4,'','Còn mục đã gửi chưa kiểm tra: không gửi danh sách sửa tổng hợp cho đến khi rà soát xong.'),branch(6,'','Đợt/phiên bản, phân công hoặc công đoạn đã đổi; hồ sơ kết thúc: yêu cầu tải lại, không ghi theo dữ liệu cũ.')]);
add('Cho phép cán bộ tín dụng xác nhận hồ sơ vay đã đủ chứng từ để chuẩn bị trình thẩm định.',
'Đã đăng nhập với vai trò Cán bộ tín dụng và đang phụ trách hồ sơ. Hồ sơ ở Tiếp nhận, chưa kết thúc, không chờ bổ sung và không bị chặn do xung đột lợi ích.',
'Hồ sơ được xác nhận đủ chứng từ, chuyển Đã đủ hồ sơ và vẫn ở công đoạn Tiếp nhận. Chưa tự chuyển Thẩm định.',
'Cán bộ tín dụng.',
'Mở chi tiết hồ sơ, chọn Danh mục chứng từ.=>Hiển thị chứng từ nộp ban đầu và các tài liệu bổ sung hiện hành đã được chấp nhận.~Rà soát nội dung và nhấn Xác nhận hồ sơ đầy đủ.=>Lưu xác nhận đủ chứng từ, cập nhật trạng thái Đã đủ hồ sơ và hiển thị kết quả.',
[branch(3,'Phát hiện cần thêm chứng từ: thực hiện Yêu cầu bổ sung.','Hồ sơ chuyển Chờ bổ sung; nếu đã xác nhận đủ trước đó thì bỏ xác nhận đủ chứng từ.')],
[branch(4,'','Hồ sơ đang chờ bổ sung, không ở Tiếp nhận hoặc đã kết thúc: chặn xác nhận.'),branch(4,'','Không còn là người phụ trách hoặc bị chặn do xung đột lợi ích: từ chối thao tác.')]);
add('Cho phép cán bộ tín dụng xác định số tiền hạn mức chính thức làm căn cứ trình thẩm định; đây chưa phải số tiền được Thẩm quyền phê duyệt.',
'Đã đăng nhập với vai trò Cán bộ tín dụng, đang phụ trách hồ sơ tại Tiếp nhận. Hồ sơ chưa kết thúc, không chờ bổ sung và không bị chặn do xung đột lợi ích.',
'Hạn mức chính thức được lưu; công đoạn giữ nguyên và chưa phát sinh quyết định phê duyệt.',
'Cán bộ tín dụng.',
'Mở chi tiết hồ sơ, nhấn Sửa tại Hạn mức chính thức.=>Hiển thị ô nhập hạn mức theo VNĐ.~Nhập hạn mức và nhấn Lưu hạn mức.=>Kiểm tra số tiền; lưu hạn mức chính thức và hiển thị kết quả.',
[branch(3,'Cần điều chỉnh hạn mức khi hồ sơ vẫn đủ điều kiện chỉnh sửa.','Cho phép nhập lại và lưu theo bước 3.')],
[branch(4,'','Số tiền không hợp lệ, nhỏ hơn hoặc bằng 0, hoặc vượt 10 tỷ đối với hồ sơ theo chính sách chi nhánh mới: báo lỗi, không lưu.'),branch(4,'','Hồ sơ đang chờ bổ sung, đã rời Tiếp nhận, kết thúc hoặc không còn thuộc quyền xử lý: chặn cập nhật.')]);
add('Cho phép cán bộ tín dụng soạn và lưu bản nháp tờ trình; khi được yêu cầu làm rõ, cán bộ chỉnh bản nháp để trình phiên bản mới.',
'Đã đăng nhập với vai trò Cán bộ tín dụng và đang phụ trách hồ sơ theo quy trình tờ trình mới. Hồ sơ chưa kết thúc, không bị chặn do xung đột lợi ích. Tờ trình đang lập tại Tiếp nhận hoặc đang yêu cầu CBTD làm rõ tại Thẩm định.',
'Bản nháp được lưu. Các bản đã trình giữ nguyên; chưa chuyển công đoạn hoặc tạo phiên bản trình mới chỉ vì lưu nháp.',
'Cán bộ tín dụng.',
'Mở chi tiết hồ sơ và khung Tờ trình tín dụng.=>Hiển thị bản nháp hiện có hoặc biểu mẫu trống gồm các phần đánh giá.~Nhập nội dung và nhấn Lưu nháp tờ trình.=>Kiểm tra quyền, dữ liệu và phiên bản; lưu nháp, thông báo Đã lưu bản nháp.',
[branch(3,'Tờ trình đang được yêu cầu làm rõ: xem nội dung yêu cầu và chỉnh phần liên quan.','Lưu bản nháp làm rõ; bảo toàn các bản đã trình trước. Sau khi hoàn thiện, chuyển sang Trình tờ trình.')],
[branch(4,'','Tờ trình đã trình hoặc đã có quyết định, chưa được mở làm rõ: không cho sửa.'),branch(4,'','Tờ trình vừa đổi ở nơi khác: yêu cầu tải lại trước khi lưu.'),branch(4,'','Nội dung không hợp lệ hoặc vượt giới hạn trường: báo lỗi. Lưu nháp chưa đầy đủ không đồng nghĩa đủ điều kiện trình.')]);
add('Cho phép cán bộ tín dụng trình bản nháp đã hoàn thiện để bàn giao Thẩm quyền; hỗ trợ trình lại sau yêu cầu làm rõ.',
'Đã đăng nhập với vai trò Cán bộ tín dụng, đang phụ trách hồ sơ. Nội dung hiển thị khớp nháp đã lưu; đủ các phần phân tích/kết luận bắt buộc, có hạn mức chính thức hợp lệ và không còn đợt bổ sung mở. Lần đầu phải đã xác nhận đủ hồ sơ; trình lại phải có yêu cầu làm rõ.',
'Tạo bản trình bất biến mới, tờ trình chuyển Đã trình, chờ quyết định. Lần đầu chuyển hồ sơ sang Thẩm định/Đang thẩm định; trình lại giữ công đoạn, thời gian đã sử dụng và các bản cũ.',
'Cán bộ tín dụng.',
'Mở tờ trình đã lưu nháp và rà soát nội dung.=>Hiển thị nháp, tình trạng tờ trình và các điều kiện trình.~Nhấn Trình tờ trình.=>Kiểm tra điều kiện, chốt nội dung và tài liệu căn cứ, tạo phiên bản trình mới; lần đầu chuyển hồ sơ sang Thẩm định.~Xem kết quả trình.=>Hiển thị Bản đã trình số tương ứng và gửi thông báo cho Thẩm quyền.',
[branch(1,'Tờ trình đang cần làm rõ: sửa nội dung, lưu nháp rồi nhấn Trình tờ trình.','Tạo bản tiếp theo, giữ nguyên bản trước; không mở lại công đoạn Thẩm định hoặc đặt lại SLA.')],
[branch(4,'','Nội dung sửa chưa lưu: không cho trình, yêu cầu lưu nháp trước.'),branch(4,'','Thiếu chứng từ đã xác nhận, hạn mức, nội dung bắt buộc hoặc còn bổ sung: báo rõ điều kiện thiếu, không trình.'),branch(4,'','Tài liệu căn cứ không đọc được/đã đổi hoặc phiên bản tờ trình thay đổi: yêu cầu kiểm tra lại.'),branch(6,'','Dự báo ML lỗi hoặc không tương thích PA1: nêu tình trạng dự báo; không hủy kết quả trình đã hoàn thành và không sinh xác suất giả.')]);
add('Cho phép cán bộ tín dụng tìm kiếm và xem hồ sơ vay thuộc phạm vi phụ trách.',
'Đã đăng nhập với vai trò Cán bộ tín dụng.',
'Hiển thị danh sách và chi tiết hồ sơ được phép truy cập; dữ liệu nghiệp vụ không thay đổi.',
'Cán bộ tín dụng.',
'Mở Danh sách hồ sơ.=>Hiển thị các hồ sơ trong phạm vi quyền.~Nhập mã hồ sơ, tên doanh nghiệp hoặc mã số thuế, nhấn Tìm.=>Hiển thị các hồ sơ phù hợp.~Nhấn Chi tiết tại hồ sơ cần xem.=>Hiển thị thông tin, chứng từ, lịch sử xử lý và tình trạng SLA theo quyền.',
[branch(3,'Chọn bộ lọc công đoạn, trạng thái hoặc chuyển giữa Kanban và bảng.','Hiển thị kết quả theo lựa chọn; vẫn giới hạn trong phạm vi được phép.'),branch(5,'Mở hồ sơ đã hoàn tất.','Hiển thị ở chế độ chỉ xem, không cho thực hiện thao tác ghi.')],
[branch(4,'','Không có kết quả: hiển thị danh sách trống, cho thay điều kiện tìm.'),branch(6,'','Không có quyền với hồ sơ/tệp hoặc hồ sơ đã điều chuyển: từ chối truy cập.'),branch(6,'','Không tải được dữ liệu: báo lỗi, cho phép thử lại.')]);
add('Cho phép Thẩm quyền xem hồ sơ, chứng từ và các phiên bản tờ trình để chuẩn bị làm rõ hoặc quyết định tín dụng.',
'Đã đăng nhập với vai trò Cán bộ thẩm quyền. Hồ sơ nằm trong phạm vi được xem từ công đoạn Thẩm định trở đi.',
'Hiển thị nội dung được phép xem; chưa phát sinh quyết định hoặc thay đổi nội dung tờ trình.',
'Cán bộ thẩm quyền.',
'Mở Thẩm định & phê duyệt, chọn Chi tiết tại hồ sơ.=>Hiển thị hồ sơ, tờ trình ở chế độ chỉ đọc và tình trạng độc lập của người xem.~Xem bản đã trình mới nhất và các thẻ tiến trình SLA, chứng từ, bổ sung.=>Hiển thị dữ liệu tương ứng, tình trạng dự báo và điều kiện được thao tác.',
[branch(3,'Chọn bản đã trình trước để đối chiếu.','Hiển thị bản lịch sử; quyết định vẫn phải dựa trên bản mới nhất hợp lệ.'),branch(3,'Nhấn Chạy lại AI khi được phép.','Nếu dữ liệu tương thích và dịch vụ hoạt động, cập nhật dự báo nguy cơ trễ SLA; chưa thay đổi quyết định tín dụng.')],
[branch(2,'','Chưa có tờ trình: hiển thị chưa có dữ liệu, không tự tạo bản nháp.'),branch(2,'','Người xem đã phụ trách, tiếp nhận hoặc tham gia lập/trình tờ trình: vẫn được xem theo quyền nhưng chặn quyết định và yêu cầu làm rõ.'),branch(4,'','Chưa có dự báo hoặc không tương thích PA1: hiển thị đúng tình trạng. ML lỗi: báo lỗi, không tạo mức nguy cơ/xác suất giả.')]);
add('Cho phép Thẩm quyền yêu cầu cán bộ tín dụng giải trình thêm về tờ trình đã nộp.',
'Đã đăng nhập với vai trò Cán bộ thẩm quyền. Hồ sơ đang Thẩm định, chưa kết thúc; tờ trình Đã trình, chờ quyết định. Người thực hiện không phải người đang phụ trách, người tiếp nhận ban đầu hoặc người từng lập/sửa/trình tờ trình; không có xung đột lợi ích chặn thao tác.',
'Tờ trình chuyển CBTD cần làm rõ, lưu nội dung yêu cầu và thông báo cho CBTD. Hồ sơ giữ công đoạn Thẩm định; làm rõ nội bộ không tạm dừng SLA.',
'Cán bộ thẩm quyền.',
'Mở chi tiết hồ sơ và xem bản tờ trình đã trình.=>Hiển thị nội dung chỉ đọc và ô Nội dung cần CBTD làm rõ.~Nhập yêu cầu cụ thể, nhấn Yêu cầu làm rõ tờ trình.=>Kiểm tra điều kiện độc lập và phiên bản, lưu yêu cầu, chuyển tình trạng tờ trình và thông báo CBTD.',
[branch(4,'CBTD phụ trách mở hồ sơ, giải trình trong nháp và trình lại theo các use case Lưu nháp tờ trình, Trình tờ trình.','Tạo bản trình tiếp theo; Thẩm quyền xem lại trước khi quyết định.')],
[branch(4,'','Nội dung trống hoặc vượt giới hạn: báo lỗi, quay lại bước 3.'),branch(4,'','Không độc lập, sai công đoạn, tờ trình không còn chờ quyết định hoặc hồ sơ kết thúc: chặn gửi yêu cầu.'),branch(4,'','Phiên bản thay đổi: yêu cầu tải lại, không gửi yêu cầu trên bản cũ.')]);
add('Cho phép Thẩm quyền độc lập phê duyệt hồ sơ vay, ghi nhận số tiền và lãi suất được chấp thuận.',
'Đã đăng nhập với vai trò Cán bộ thẩm quyền. Hồ sơ theo chính sách mới đang ở công đoạn Thẩm định, trạng thái Đang thẩm định; có bản tờ trình mới nhất Đã trình, chờ quyết định, căn cứ còn nguyên vẹn, không còn bổ sung/làm rõ hoặc COI chặn. Người duyệt độc lập với người phụ trách, người tiếp nhận ban đầu và người đã lập/sửa/trình tờ trình.',
'Hồ sơ chuyển Hoàn tất/Đã phê duyệt; lưu số tiền, lãi suất và lịch sử quyết định; tờ trình chuyển Đã có quyết định. Đóng SLA công đoạn, kết thúc đề nghị điều phối chờ liên quan và khóa thao tác ghi nghiệp vụ.',
'Cán bộ thẩm quyền.',
'Mở hồ sơ, đọc bản tờ trình mới nhất và nhấn Phê duyệt Khoản vay.=>Hiển thị biểu mẫu Xác nhận Phê duyệt Cấp tín dụng.~Nhập số tiền và lãi suất, nhấn Xác nhận Phê duyệt.=>Kiểm tra quyền, điều kiện hồ sơ và căn cứ; ghi quyết định, kết thúc hồ sơ và hiển thị kết quả.',
[branch(1,'Cần thêm giải trình: thực hiện Yêu cầu làm rõ tờ trình.','Chưa ghi quyết định; chờ bản trình mới để xem xét lại.')],
[branch(4,'','Số tiền không dương/vượt hạn mức chính thức hoặc lãi suất ngoài 0–100%: báo lỗi, không phê duyệt.'),branch(4,'','Tờ trình/căn cứ đã đổi, còn bổ sung/làm rõ, vi phạm độc lập hoặc COI: chặn và nêu nguyên nhân.'),branch(4,'','Hồ sơ đã kết thúc do thao tác khác: không ghi quyết định thứ hai.')]);
add('Cho phép Thẩm quyền độc lập từ chối hồ sơ vay, ghi mã lý do chuẩn và giải trình nội bộ.',
'Đã đăng nhập với vai trò Cán bộ thẩm quyền. Hồ sơ theo chính sách mới đang ở công đoạn Thẩm định, trạng thái Đang thẩm định; có bản trình mới nhất hợp lệ, không còn bổ sung/làm rõ hoặc COI chặn. Người quyết định độc lập với người phụ trách, người tiếp nhận ban đầu và người từng lập/sửa/trình tờ trình.',
'Hồ sơ chuyển Hoàn tất/Bị từ chối; lưu mã, giải trình và lịch sử quyết định; tờ trình chuyển Đã có quyết định, kết thúc SLA và khóa thao tác ghi. Doanh nghiệp chỉ được xem mã/nhãn lý do công khai.',
'Cán bộ thẩm quyền.',
'Mở hồ sơ, đọc bản tờ trình mới nhất và nhấn Từ chối.=>Hiển thị danh mục TC01–TC05 và ô Ghi chú giải trình chi tiết.~Chọn mã lý do, nhập giải trình và nhấn Xác nhận Từ chối hồ sơ.=>Kiểm tra điều kiện, ghi quyết định từ chối và kết thúc hồ sơ.',
[branch(1,'Cần thêm giải trình: thực hiện Yêu cầu làm rõ tờ trình.','Giữ hồ sơ chưa quyết định, chờ CBTD trình lại.'),branch(1,'Hồ sơ chờ doanh nghiệp bổ sung đã quá hạn.','Quản lý chi nhánh xử lý bằng use case Đóng hồ sơ quá hạn khi đủ điều kiện; không thay thế quyền này bằng quyết định tín dụng.')],
[branch(4,'','Mã ngoài TC01–TC05 hoặc chưa nhập giải trình: báo lỗi, quay lại bước 3.'),branch(4,'','Bản trình/căn cứ không còn hợp lệ, còn bổ sung/làm rõ hoặc người thực hiện không độc lập: không từ chối hồ sơ.'),branch(4,'','Hồ sơ đã kết thúc: không ghi quyết định tiếp theo.')]);
add('Cho phép Quản lý chi nhánh giao đề nghị doanh nghiệp đã gửi cho cán bộ tín dụng xử lý tiếp nhận.',
'Đã đăng nhập với vai trò Quản lý chi nhánh. Đề nghị đã gửi, chưa có người phụ trách và chưa được tiếp nhận. Cán bộ nhận đang hoạt động, có vai trò Cán bộ tín dụng và khác người thực hiện phân công.',
'Đề nghị chuyển Đã phân công, chờ tiếp nhận; lưu người phụ trách, lịch sử và thông báo. Chưa tạo hồ sơ vay nội bộ hoặc bắt đầu SLA khoản vay.',
'Quản lý chi nhánh.',
'Mở Danh sách hồ sơ, chọn Chờ tiếp nhận, mở đề nghị cần phân công.=>Hiển thị đề nghị và danh sách cán bộ tín dụng cùng tải công việc.~Chọn cán bộ, nhập ghi chú nếu cần, nhấn Phân công đề nghị.=>Hiển thị yêu cầu xác nhận.~Xác nhận phân công.=>Kiểm tra người nhận/phiên bản, lưu phân công và thông báo cán bộ được giao.',
[branch(1,'Đề nghị đã có người phụ trách: thực hiện nhánh điều chuyển đề nghị.','Yêu cầu lý do điều chuyển, xử lý theo use case Điều chuyển hồ sơ.'),branch(5,'Không xác nhận.','Không thay đổi phân công; kết thúc use case.')],
[branch(6,'','Tự phân công, cán bộ nhận bị khóa hoặc không có vai trò phù hợp: không phân công.'),branch(6,'','Đề nghị đã được phân công/tiếp nhận hoặc dữ liệu vừa đổi: yêu cầu tải lại trước khi xử lý.')]);
add('Cho phép Quản lý chi nhánh bàn giao hồ sơ hoặc đề nghị chưa tiếp nhận sang cán bộ tín dụng khác; giữ nguyên lịch sử xử lý.',
'Đã đăng nhập với vai trò Quản lý chi nhánh. Hồ sơ chưa kết thúc hoặc đề nghị chưa tiếp nhận đã có người phụ trách. Cán bộ nhận đang hoạt động, có vai trò Cán bộ tín dụng, khác người cũ và khác người thực hiện.',
'Lưu cán bộ phụ trách mới, lịch sử và thông báo hai bên; giữ mã, chứng từ, người tiếp nhận ban đầu và SLA đã sử dụng. Cán bộ cũ mất quyền theo phân công; không xóa lịch sử lập tờ trình.',
'Quản lý chi nhánh.',
'Mở Điều chuyển & phân công, nhấn Điều chuyển tại hồ sơ cần bàn giao.=>Hiển thị cán bộ hiện tại, cán bộ nhận và lý do.~Chọn cán bộ nhận, nhập lý do, nhấn Xác nhận Điều chuyển.=>Kiểm tra điều kiện/phiên bản, cập nhật người phụ trách, ghi lịch sử và thông báo.',
[branch(1,'Đề nghị chưa tiếp nhận: mở chi tiết trong Chờ tiếp nhận, chọn cán bộ khác, nhập lý do và nhấn Điều chuyển đề nghị.','Bàn giao đề nghị; nếu đang Cần chỉnh sửa đề nghị thì giữ trạng thái đó để doanh nghiệp tiếp tục hoàn thiện.')],
[branch(4,'','Thiếu lý do hoặc lý do vượt 2.000 ký tự: báo lỗi, quay lại bước 3.'),branch(4,'','Người nhận không hợp lệ, trùng người cũ hoặc trùng người thực hiện: không bàn giao.'),branch(4,'','Hồ sơ kết thúc hoặc phân công/phiên bản đã đổi: chặn chuyển theo dữ liệu cũ, yêu cầu tải lại.')]);
add('Cho phép Quản lý chi nhánh chấp thuận hoặc không chấp thuận đề nghị điều phối do CBTD đang phụ trách gửi khi quá tải, không thể tiếp tục hoặc phân công chưa phù hợp.',
'Đã đăng nhập với vai trò Quản lý chi nhánh; có đề nghị điều phối đang chờ của CBTD, gắn với đề nghị trước tiếp nhận hoặc hồ sơ chưa hoàn tất. Người quyết định khác người gửi; phân công tại thời điểm yêu cầu vẫn còn hợp lệ.',
'Chấp thuận: đề nghị Đã chấp thuận điều phối và bàn giao cho CBTD mới. Không chấp thuận: giữ người phụ trách sau khi xác nhận người đó còn có thể xử lý. Lưu căn cứ và thông báo kết quả.',
'Quản lý chi nhánh.',
'Mở Điều chuyển & phân công, chọn đề nghị trong danh sách chờ quản lý.=>Hiển thị đối tượng, CBTD gửi, lý do và phân công hiện tại.~Chọn cán bộ nhận, nhập Căn cứ quyết định và nhấn Chấp thuận và bàn giao.=>Kiểm tra độc lập/phiên bản/người nhận, bàn giao đúng một lần, lưu kết quả và thông báo.',
[branch(3,'Không đồng ý: nhập căn cứ, xác nhận CBTD hiện tại còn đủ điều kiện và thực tế có thể tiếp tục xử lý, nhấn Không chấp thuận điều phối.','Kiểm tra điều kiện CBTD, lưu Không chấp thuận và giữ phân công.'),branch(1,'CBTD đã gửi đề nghị thông thường nhưng muốn rút khi còn chờ xử lý.','Cho chính người gửi rút đề nghị; lưu trạng thái Đã rút. Không áp dụng tự rút cho COI.')],
[branch(4,'','Người quản lý cũng là người gửi đề nghị, kể cả đổi vai trò: chặn tự quyết.'),branch(4,'','Thiếu căn cứ/xác nhận hoặc người nhận không hợp lệ: không quyết định.'),branch(4,'','Đề nghị đã xử lý, phân công thay đổi hoặc đối tượng kết thúc: từ chối xử lý trên bản cũ hoặc ghi hết hiệu lực theo tình trạng; không bàn giao theo yêu cầu cũ.')]);
add('Cho phép Quản lý chi nhánh xử lý báo cáo xung đột lợi ích do CBTD phụ trách gửi; quyết định bàn giao hoặc kết luận có căn cứ rằng không có xung đột.',
'Đã đăng nhập với vai trò Quản lý chi nhánh; có đề nghị Xung đột lợi ích đang chờ. Người quyết định khác người báo; đối tượng và phân công còn hợp lệ. Người báo bị chặn các thao tác liên quan trong thời gian chờ.',
'Chấp thuận: bàn giao CBTD mới và lưu kết quả. Kết luận không có xung đột: giữ CBTD cũ và gỡ chặn tương ứng. Không xóa các ràng buộc độc lập khác hoặc tự cấp lại quyền cho người đã bàn giao.',
'Quản lý chi nhánh.',
'Mở đề nghị xung đột lợi ích được ưu tiên trong hàng đợi điều phối.=>Hiển thị lý do của CBTD và tình trạng đang chặn thao tác.~Chọn cán bộ nhận, nhập căn cứ và nhấn Chấp thuận và bàn giao.=>Kiểm tra điều kiện, bàn giao, ghi kết quả và thông báo.',
[branch(3,'Kết luận không có COI: nhập căn cứ, xác nhận cán bộ có thể tiếp tục và xác nhận không có xung đột, nhấn Không chấp thuận điều phối.','Lưu kết luận không có xung đột, giữ người phụ trách và gỡ chặn COI tương ứng.')],
[branch(4,'','Người báo tự xử lý bằng vai trò quản lý, thiếu căn cứ/xác nhận hoặc người nhận không hợp lệ: chặn quyết định.'),branch(4,'','Phân công hoặc đối tượng đã đổi: đề nghị hết hiệu lực, không bàn giao theo bản cũ.'),branch(1,'CBTD yêu cầu tự rút báo cáo COI.','Không cho tự rút hoặc dùng việc đổi vai trò để gỡ chặn. Việc chặn COI không tự tạm dừng SLA.')]);
add('Cho phép Quản lý chi nhánh xem xét yêu cầu đối soát của CBTD và quyết định cập nhật có kiểm soát dữ liệu doanh nghiệp hiện hữu.',
'Đã đăng nhập với vai trò Quản lý chi nhánh; có đối soát đang mở và người quyết định khác người lập. Khi chấp thuận: đề nghị đang chờ tiếp nhận, checklist đạt, không có xin sửa chờ xử lý; dữ liệu và lần gửi khớp căn cứ đối soát.',
'Chấp thuận: bảo toàn thông tin đã chốt của hồ sơ vay cũ, cập nhật dữ liệu doanh nghiệp và đóng đối soát. Không chấp thuận: giữ dữ liệu hiện hữu, lưu kết quả. Không tự tiếp nhận đề nghị.',
'Quản lý chi nhánh.',
'Mở đề nghị có đối soát và xem thông tin trước/sau đề xuất.=>Hiển thị khác biệt và căn cứ CBTD đã gửi.~Nhập Căn cứ quyết định đối soát, nhấn Xác nhận đối soát và cập nhật Company.=>Hiển thị xác nhận cập nhật.~Xác nhận.=>Kiểm tra độc lập, bản gửi/dữ liệu; bảo toàn thông tin hồ sơ cũ, cập nhật doanh nghiệp, đóng đối soát và báo CBTD.',
[branch(3,'Không đồng ý: nhập căn cứ, nhấn Không chấp thuận đối soát.','Giữ dữ liệu doanh nghiệp, đóng yêu cầu và báo CBTD. Nếu chênh lệch còn cản trở, đề nghị chưa đủ điều kiện tiếp nhận.'),branch(5,'Không xác nhận cập nhật.','Chưa cập nhật dữ liệu và chưa ghi quyết định chấp thuận.')],
[branch(6,'','Tự duyệt đối soát của mình, checklist chưa đạt hoặc còn xin sửa: không chấp thuận.'),branch(6,'','Dữ liệu doanh nghiệp hoặc bản gửi đã thay đổi: yêu cầu xử lý đối soát cũ và lập lại theo dữ liệu mới.'),branch(6,'','Yêu cầu đã được xử lý hoặc đề nghị đã tiếp nhận: không cập nhật từ yêu cầu cũ.')]);
add('Cho phép người có quyền xem cảnh báo nguy cơ trễ SLA để ưu tiên công việc; cảnh báo không phải đánh giá khả năng trả nợ hoặc quyết định tín dụng.',
'Đã đăng nhập với vai trò Quản lý chi nhánh hoặc Cán bộ thẩm quyền. Thẩm quyền chỉ xem danh sách cảnh báo hồ sơ từ Thẩm định trở đi.',
'Hiển thị các hồ sơ và tình trạng dự báo được phép xem; chưa thay đổi phân công hoặc quyết định tín dụng.',
'Quản lý chi nhánh, Cán bộ thẩm quyền.',
'Mở Dashboard tổng quan và xem Bảng Cảnh báo Sớm AI.=>Hiển thị hồ sơ, công đoạn, mức nguy cơ, xác suất, nguyên nhân và thời điểm dự báo khi có kết quả hợp lệ.~Nhấn Xử lý tại hồ sơ cần xem.=>Mở chi tiết hồ sơ theo quyền để người dùng lựa chọn xử lý nghiệp vụ.',
[branch(3,'Quản lý chi nhánh chọn Điều phối cán bộ.','Mở Điều chuyển & phân công; chưa tự bàn giao hồ sơ.'),branch(3,'Người có quyền chọn Chạy lại AI tại chi tiết hồ sơ.','Nếu tương thích và dịch vụ hoạt động, cập nhật dự báo; không thay đổi kết quả tín dụng.')],
[branch(2,'','Danh sách không có hồ sơ: hiển thị danh sách trống.'),branch(2,'','Chưa có dự báo: ghi rõ chưa có dữ liệu, không suy thành không có nguy cơ.'),branch(2,'','Công đoạn Tiếp nhận dùng PA1: hiển thị Chưa có dự báo tương thích PA1; không trình bày xác suất cũ như dự báo còn hiệu lực.'),branch(4,'','Không tải được dữ liệu hoặc ML lỗi: thông báo lỗi, không thay bằng xác suất giả.')]);
add('Cho phép xem các chỉ số xử lý hồ sơ và điểm nghẽn SLA trong phạm vi một chi nhánh.',
'Đã đăng nhập với vai trò có quyền Dashboard: Quản lý chi nhánh hoặc Cán bộ thẩm quyền.',
'Hiển thị thống kê nghiệp vụ; tách số liệu cách tính giờ thực cũ và giờ làm việc PA1.',
'Quản lý chi nhánh, Cán bộ thẩm quyền.',
'Mở Dashboard tổng quan.=>Hiển thị số hồ sơ đang xử lý, đã phê duyệt, cảnh báo đỏ và tỷ lệ đúng hạn SLA.~Xem Phân tích Điểm nghẽn Quy trình SLA.=>Hiển thị định mức, thời gian xử lý thuần trung bình, số lượt công đoạn trễ và đánh giá điểm nghẽn; tách các chính sách tính SLA.',
[branch(2,'Xem số lượt dùng để tính tỷ lệ.','Tỷ lệ SLA được tính trên lượt công đoạn đã kết thúc của cùng chính sách, không phải tỷ lệ số hồ sơ vay.'),branch(2,'Đối chiếu bộ đếm cảnh báo đỏ với bảng cảnh báo chi tiết.','Bộ đếm hiện hành tính hồ sơ đang xử lý từng có dự báo cao; bảng chi tiết dùng kết quả mới nhất. Hai số có thể khác nhau.')],
[branch(2,'','Không có công đoạn PA1 kết thúc: thể hiện chưa có tỷ lệ PA1. Cách tính cũ có thể hiển thị 100% khi mẫu số bằng 0; cần đọc cùng số lượt, không coi là bằng chứng hiệu quả.'),branch(4,'','Không tải được số liệu: báo lỗi, không thay bằng dữ liệu mô phỏng.')]);
add('Cho phép Quản lý chi nhánh đóng thủ công hồ sơ vẫn chờ doanh nghiệp bổ sung sau thời hạn; phân biệt với quyết định từ chối tín dụng của Thẩm quyền.',
'Đã đăng nhập với vai trò Quản lý chi nhánh, không phải người đang phụ trách hoặc người tiếp nhận ban đầu. Hồ sơ chưa kết thúc, đang Chờ bổ sung, có đợt đang chờ doanh nghiệp đã đến hạn và không có COI chặn. Mặc định quá hạn ngày 10 theo lịch Việt Nam, mốc cuối tuần chuyển thứ Hai; hạn riêng đã lưu nếu có được ưu tiên.',
'Hồ sơ chuyển Hoàn tất/Đã đóng do quá hạn bổ sung; lưu mã TC05, lý do, người và thời điểm. Các đợt bổ sung mở hết hạn; đóng lịch sử/SLA, kết thúc khoảng dừng và khóa ghi nghiệp vụ.',
'Quản lý chi nhánh.',
'Mở Dashboard, chọn hồ sơ trong danh sách quá hạn bổ sung.=>Hiển thị tình trạng và điều kiện được đóng.~Nhấn Đóng hồ sơ do quá hạn.=>Hiển thị biểu mẫu lý do.~Nhập Lý do đóng hồ sơ, nhấn Xác nhận đóng hồ sơ.=>Kiểm tra lại hạn, bên đang chờ và tính độc lập; đóng hồ sơ, lưu lịch sử và thông báo kết quả.',
[branch(1,'Doanh nghiệp đã gửi đủ và ngân hàng đang kiểm tra.','Chưa cho đóng quá hạn; cán bộ tiếp tục Giải quyết bổ sung.')],
[branch(6,'','Thiếu lý do: yêu cầu nhập trước khi xác nhận.'),branch(6,'','Chưa đến hạn, không còn chờ doanh nghiệp, người đóng không độc lập hoặc hồ sơ đã kết thúc: từ chối đóng.'),branch(6,'','Doanh nghiệp vừa nộp tài liệu/đợt bổ sung thay đổi: kiểm tra dữ liệu mới; không đóng theo danh sách cũ.')]);
add('Cho phép Quản trị viên tạo tài khoản cán bộ nội bộ và cấp các vai trò làm việc.',
'Đã đăng nhập với vai trò Quản trị viên.',
'Tài khoản nội bộ mới được tạo với các vai trò hợp lệ, hiển thị trong danh sách. Không tạo tài khoản doanh nghiệp Portal.',
'Quản trị viên.',
'Mở Liên hệ cá nhân, nhấn Tạo mới liên hệ.=>Hiển thị Tạo tài khoản với tên đăng nhập, mật khẩu ban đầu, email, họ tên, chi nhánh, điện thoại và vai trò.~Nhập thông tin, chọn ít nhất một vai trò, nhấn Lưu tài khoản.=>Kiểm tra dữ liệu và trùng lặp; tạo tài khoản cùng vai trò, thông báo và tải lại danh sách.',
[branch(3,'Cấp nhiều vai trò cho cùng cán bộ.','Lưu các vai trò đã chọn; cán bộ chỉ làm việc theo vai trò đang chọn và vẫn chịu ràng buộc độc lập.')],
[branch(4,'','Tên đăng nhập/email đã tồn tại: báo lỗi, không tạo tài khoản trùng.'),branch(4,'','Thiếu tên đăng nhập/họ tên, email sai, mật khẩu dưới 8 ký tự hoặc không có vai trò hợp lệ: không lưu, yêu cầu chỉnh thông tin.')]);
add('Cho phép Quản trị viên cập nhật thông tin được phép chỉnh sửa và vai trò của tài khoản cán bộ.',
'Đã đăng nhập với vai trò Quản trị viên; tài khoản cần cập nhật tồn tại.',
'Thông tin/vai trò hợp lệ được lưu; phiên làm việc phải tuân quyền mới. Không tự điều chuyển công việc khi sửa tài khoản.',
'Quản trị viên.',
'Mở Liên hệ cá nhân, nhấn Sửa / Cấp quyền tại tài khoản.=>Hiển thị họ tên, chi nhánh, điện thoại, vai trò và trạng thái hoạt động.~Chỉnh thông tin hoặc vai trò, nhấn Lưu tài khoản.=>Kiểm tra ràng buộc, lưu cập nhật và tải lại danh sách.',
[branch(3,'Cần thay đổi trạng thái hoạt động.','Thực hiện theo use case Khóa và mở khóa tài khoản.'),branch(4,'Vai trò của cán bộ đang đăng nhập vừa bị thu hồi.','Khi xác thực lại, nạp quyền mới; chọn vai trò còn hợp lệ hoặc kết thúc phiên nếu không còn quyền. Không tự thực hiện lại thao tác ghi bị từ chối.')],
[branch(4,'','Tự bỏ quyền Quản trị của mình: không cho lưu.'),branch(4,'','Bỏ CBTD khi người đó còn hồ sơ chưa hoàn tất hoặc đề nghị chưa tiếp nhận đang phụ trách: báo số công việc cần bàn giao trước.'),branch(4,'','Không chọn vai trò, vai trò sai hoặc thông tin bắt buộc không hợp lệ: báo lỗi. Biểu mẫu hiện không sửa tên đăng nhập, email hoặc mật khẩu đã tạo.')]);
add('Cho phép Quản trị viên thay đổi trạng thái hoạt động của tài khoản cán bộ sau khi bảo đảm công việc được bàn giao.',
'Đã đăng nhập với vai trò Quản trị viên; tài khoản đích tồn tại. Khi khóa, người dùng phải không còn công việc chưa bàn giao và không phải chính Quản trị viên đang thực hiện.',
'Tài khoản chuyển Đã khóa hoặc Hoạt động. Tài khoản khóa bị chặn ở lần xác thực tiếp theo; mở khóa không tự cấp lại vai trò hoặc nhận lại phân công.',
'Quản trị viên.',
'Mở Liên hệ cá nhân, chọn Sửa / Cấp quyền của tài khoản.=>Hiển thị ô Tài khoản hoạt động.~Bỏ chọn Tài khoản hoạt động và nhấn Lưu tài khoản.=>Kiểm tra điều kiện bàn giao, lưu trạng thái Đã khóa và thông báo.',
[branch(3,'Mở khóa: chọn lại Tài khoản hoạt động, nhấn Lưu tài khoản.','Chuyển tài khoản sang Hoạt động; người dùng đăng nhập và làm việc theo vai trò còn được cấp.')],
[branch(4,'','Tự khóa chính mình: từ chối.'),branch(4,'','Cán bộ còn hồ sơ chưa hoàn tất hoặc đề nghị chưa tiếp nhận đang phụ trách: không khóa, yêu cầu Quản lý chi nhánh điều chuyển trước.'),branch(4,'','Tài khoản không tồn tại hoặc không có quyền Quản trị: không cập nhật.')]);
add('Cho phép Quản trị viên cập nhật tên và định mức giờ xử lý chuẩn của công đoạn; không hồi tố lịch sử.',
'Đã đăng nhập với vai trò Quản trị viên; công đoạn cần cấu hình đã tồn tại.',
'Lưu cấu hình hợp lệ; định mức mới áp dụng cho lượt mở công đoạn sau đó. Công đoạn đã mở và lịch sử giữ định mức/chính sách đã chốt.',
'Quản trị viên.',
'Mở Cấu hình SLA.=>Hiển thị các công đoạn, tên và SLA theo giờ.~Chỉnh tên nếu cần, nhập số giờ và nhấn Lưu tại dòng công đoạn.=>Kiểm tra dữ liệu, cập nhật cấu hình và thông báo kết quả.',
[branch(3,'Chỉ thay đổi một công đoạn.','Giữ cấu hình các công đoạn khác. Thao tác này không kích hoạt PA1 hoặc thay lịch làm việc/ngày nghỉ.')],
[branch(4,'','Số giờ không nguyên hoặc nhỏ hơn 1, tên trống: báo lỗi, không lưu.'),branch(4,'','Công đoạn không tồn tại hoặc không có quyền: từ chối cập nhật.')]);
add('Cho phép doanh nghiệp lập và gửi đề nghị vay qua Portal; bao gồm khai thông tin, lưu nháp, tải chứng từ và rà soát trước gửi.',
'Doanh nghiệp đã đăng nhập Portal bằng tài khoản được xác minh; lập mới hoặc mở đề nghị thuộc tài khoản của mình. Chức năng lập/gửi đề nghị V2 đang được bật. Phạm vi đề nghị mới là vốn lưu động trong chi nhánh, tối đa 10 tỷ đồng.',
'Khi lưu nháp: giữ Bản nháp để hoàn thiện. Khi gửi thành công: lưu bản gửi chính thức, khóa chỉnh sửa, chuyển Chờ phân công hoặc Chờ ngân hàng tiếp nhận nếu đã có CBTD. Chưa tạo hồ sơ vay nội bộ và chưa bắt đầu SLA khoản vay.',
'Doanh nghiệp.',
'Mở Cổng doanh nghiệp, nhấn Tạo đề nghị vay.=>Hiển thị các bước Thông tin doanh nghiệp, Nhu cầu vay, Phương án vốn, Hồ sơ tài liệu và Rà soát đề nghị.~Khai thông tin doanh nghiệp, nhu cầu vốn và phương án; nhấn Lưu nháp.=>Kiểm tra dữ liệu đã nhập, lưu nháp và mã đề nghị để tiếp tục hoàn thiện.~Tải chứng từ theo loại/kỳ, khai thành phần tài liệu và chọn tài liệu nguồn doanh thu năm.=>Kiểm tra định dạng/dung lượng, lưu tài liệu và hiển thị các mục đã có/còn thiếu.~Rà soát dữ liệu, tài liệu và xác nhận cam kết; nhấn Gửi đề nghị.=>Kiểm tra điều kiện gửi và hiển thị yêu cầu xác nhận.~Xác nhận gửi.=>Lưu bản gửi chính thức gồm thông tin, checklist và tài liệu; khóa sửa, chuyển hàng chờ tiếp nhận, thông báo ngân hàng và doanh nghiệp.',
[branch(3,'Chưa đủ dữ liệu hoặc tài liệu: lưu nháp và hoàn thiện sau.','Giữ Bản nháp; chưa gửi ngân hàng. Không tự quy đổi doanh thu tháng/quý thành năm hoặc điền 0 thay dữ liệu thiếu.'),branch(5,'Trong nháp: thay thế/rút tài liệu cần chỉnh.','Cập nhật tài liệu hiện hành, giữ lịch sử phiên bản và đánh giá lại điều kiện gửi.'),branch(1,'Đề nghị được ngân hàng trả sửa: mở trên cùng mã, đọc nội dung yêu cầu, chỉnh dữ liệu/tệp, lưu nháp rồi chọn Gửi lại đề nghị.','Kiểm tra điều kiện, tạo lần gửi tiếp theo, giữ lịch sử và chuyển về hàng đợi của CBTD nếu đã phân công; không tự tạo hồ sơ vay.'),branch(9,'Không xác nhận gửi.','Giữ nháp, cho phép tiếp tục rà soát.')],
[branch(6,'','Tệp hỏng, sai định dạng hoặc vượt 10 MB: không nhận tệp, yêu cầu tải lại đúng loại. Nhóm B/F nhận PDF hoặc XLSX; E nhận PDF/JPG/PNG; A/C/D nhận PDF.'),branch(8,'','Thiếu dữ liệu/tài liệu theo chính sách ngành, kỳ năm/nguồn doanh thu chưa phù hợp, thiếu cam kết hoặc số tiền không hợp lệ/vượt 10 tỷ: không gửi, chỉ rõ phần cần hoàn thiện; vẫn cho lưu nháp theo điều kiện.'),branch(10,'','Đề nghị đã khóa/chưa được trả sửa, thay đổi MST sau lần gửi đầu, dữ liệu xung đột, tệp còn tải dở hoặc chức năng gửi đang tắt: chặn gửi và hướng dẫn xử lý.'),branch(10,'','Gửi lại đúng phiên bản và cùng bộ tài liệu đã được ghi nhận: trả kết quả hiện có, không nhân đôi lần gửi.')]);

if(specs.length!==29)throw Error('Expected 29 specifications');
for(const spec of specs){
 if(spec.flow.some(row=>row.length!==2||row.some(text=>!text.trim())))throw Error('Invalid main flow '+spec.id);
 for(const list of [spec.alternatives,spec.exceptions])for(const b of list){
  if(!Number.isInteger(b.at)||b.at<1||b.at>spec.flow.length*2||!b.system)throw Error('Invalid branch '+spec.id);
 }
 if(specs.filter(x=>x.title===spec.title).length!==1)throw Error('Duplicate title '+spec.title);
 const rows=[];
 for(const [label,key] of [['Tên use case','title'],['Mô tả','description'],['Tiền điều kiện','pre'],['Hậu điều kiện','post'],['Actor chính','actor']])rows.push({kind:'meta',cells:[label,spec[key]]});
 rows.push({kind:'section',title:'Luồng sự kiện chính (Basic flow)'});
 rows.push({kind:'columns',cells:['Actor','System']});
 spec.flow.forEach((pair,i)=>rows.push({kind:'flow',cells:[`${i*2+1}. ${pair[0]}`,`${i*2+2}. ${pair[1]}`]}));
 const counters=new Map();
 for(const [key,label] of [['alternatives','Luồng sự kiện thay thế (Alternative flow)'],['exceptions','Luồng sự kiện ngoại lệ (Exception flow)']]){
  if(!spec[key].length)continue;
  rows.push({kind:'section',title:label});
  for(const branch of spec[key]){
   let count=counters.get(branch.at)||0;
   const cells=['',''];
   if(branch.actor)cells[0]=`${branch.at}.${++count}. ${branch.actor}`;
   cells[1]=`${branch.at}.${++count}. ${branch.system}`;
   counters.set(branch.at,count);
   rows.push({kind:key,cells});
  }
 }
 spec.rows=rows;
}
const oldValidation=JSON.parse(fs.readFileSync(path.join(__dirname,'validation.json'),'utf8').replace(/^\uFEFF/,''));
const sourceHashes={};
for(const [key,source] of Object.entries(base.sources)){
 sourceHashes[key]=crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex').toUpperCase();
 if(sourceHashes[key]!==oldValidation.sourceHashes[key])throw Error('Source drift: '+source.file);
}
const output={scope:'28 đặc tả nội bộ hiện có và 1 đặc tả Lập và gửi đề nghị vay của Doanh nghiệp; theo phạm vi PO đã chốt trong hội thoại.',
 formatting:'Năm dòng thông tin chung; tiêu đề luồng gộp hai ô; hai cột Actor/System, bước chính đánh số liên tục; nhánh theo số bước.',
 validationPlan:['Đếm đúng 29 bảng/mã/tên riêng biệt','Kiểm tra bước chính và tham chiếu nhánh','Kiểm tra gộp ô, màu xám, đường viền và độ rộng','Giữ nguyên file gốc và phần ngoài đặc tả của báo cáo','Không chạy ghi DB hoặc thay source ứng dụng'],
 original:28,rewritten:28,added:1,total:29,specs,sources:base.sources,sourceHashes};
fs.writeFileSync(path.join(__dirname,'specifications-29.json'),JSON.stringify(output,null,2),'utf8');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const tableHTML=s=>`<section id="${s.id}"><p class="caption">Bảng 3.${Number(s.id.slice(2))+2}: Đặc tả use case ${esc(s.title)} (${s.id})</p><table>${s.rows.map(r=>r.kind==='section'?`<tr class="section"><th colspan="2">${esc(r.title)}</th></tr>`:`<tr class="${r.kind}"><${r.kind==='meta'||r.kind==='columns'?'th':'td'}>${esc(r.cells[0])}</${r.kind==='meta'||r.kind==='columns'?'th':'td'}><${r.kind==='columns'?'th':'td'}>${esc(r.cells[1])}</${r.kind==='columns'?'th':'td'}></tr>`).join('')}</table></section>`;
const style=`body{background:#eee;margin:24px;color:#000;font:13pt 'Times New Roman',serif}main{box-sizing:border-box;width:180mm;margin:auto;padding:8mm;background:#fff}.caption{text-align:center;margin:0 0 8pt}section{margin:0 0 25pt}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #000;padding:5pt 6pt;vertical-align:top;line-height:1.15;text-align:left;font-weight:normal;overflow-wrap:break-word}th{font-weight:bold}.section th{background:#d9d9d9;text-align:center;padding:7pt}.columns th{text-align:center}td,th{width:50%}@media print{body{background:white;margin:0}main{width:100%;padding:0}section{break-before:page}tr{break-inside:avoid}}`;
fs.writeFileSync(path.join(__dirname,'preview-29.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><title>29 đặc tả SME</title><style>${style}</style><main>${specs.map(tableHTML).join('')}</main></html>`,'utf8');
fs.writeFileSync(path.join(__dirname,'preview-portal-29.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><title>Đặc tả cổng DN</title><style>${style}</style><main>${tableHTML(specs[28])}</main></html>`,'utf8');
console.log(JSON.stringify({rewritten:28,added:1,total:29,mainFlowRows:specs.reduce((sum,s)=>sum+s.flow.length,0),sourceHashesVerified:Object.keys(sourceHashes).length}));
