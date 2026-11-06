const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=name=>path.join(__dirname,name);
if(!fs.existsSync(file('specifications-29-detailed.json')))fs.copyFileSync(file('specifications-29.json'),file('specifications-29-detailed.json'));
const detailed=JSON.parse(fs.readFileSync(file('specifications-29-detailed.json'),'utf8').replace(/^\uFEFF/,''));
const short=[];
const b=(actor,system)=>({actor,system});
function add(description,pre,post,flow,alternatives=[],exceptions=[]){
 const original=detailed.specs[short.length];
 short.push({...original,description,pre,post,flow:flow.split('~').map(x=>x.split('=>')),alternatives,exceptions});
}
add('Cho phép cán bộ đăng nhập hệ thống.',
'Có tài khoản nội bộ đang hoạt động và được cấp vai trò.',
'Đăng nhập thành công, mở màn hình theo vai trò.',
'Truy cập hệ thống.=>Hiển thị form đăng nhập.~Nhập tên đăng nhập và mật khẩu.=>~Nhấn Đăng nhập.=>Hiển thị màn hình theo vai trò.',
[b('Chọn vai trò khác đã được cấp.','Chuyển sang không gian làm việc tương ứng.')],
[b('','Sai thông tin: báo lỗi, yêu cầu nhập lại.'),b('','Tài khoản bị khóa, chưa có vai trò hoặc thử sai quá nhiều: không cho truy cập.')]);
add('Cho phép CBTD kiểm tra các mục của đề nghị vay.',
'Đăng nhập CBTD, được giao đề nghị đang chờ tiếp nhận.',
'Lưu kết quả kiểm tra của từng mục trên đúng lần gửi.',
'Mở Chờ tiếp nhận.=>Hiển thị đề nghị được giao.~Nhấn Xem đề nghị.=>Hiển thị thông tin và checklist.~Nhấn Kiểm tra đạt tại mục đã đối chiếu.=>Hiển thị Đã kiểm tra đạt.',
[b('Nhập lý do và chọn Yêu cầu sửa mục này.','Hiển thị Cần chỉnh sửa; chưa trả sửa toàn bộ đề nghị.')],
[b('','Thiếu lý do sửa: yêu cầu nhập bổ sung.'),b('','Lần gửi hoặc phân công đã đổi: yêu cầu tải lại.')]);
add('Cho phép CBTD trả đề nghị để doanh nghiệp chỉnh sửa.',
'Đăng nhập CBTD, phụ trách đề nghị; có nội dung cần sửa hoặc DN xin sửa.',
'Đề nghị chuyển Cần chỉnh sửa, giữ mã và lịch sử lần gửi.',
'Mở đề nghị cần trả sửa.=>Hiển thị checklist và thông tin đề nghị.~Nhập nội dung cần chỉnh sửa.=>~Nhấn Trả đề nghị để chỉnh sửa.=>Hiển thị yêu cầu xác nhận.~Nhấn OK.=>Hiển thị Cần chỉnh sửa và danh sách cần sửa.',
[b('DN đã xin sửa: chọn Đồng ý và trả sửa hoặc Không đồng ý trả sửa.','Lưu quyết định và lý do; không đồng ý thì giữ chờ tiếp nhận.'),b('DN sửa đề nghị và gửi lại trên cùng mã.','Lưu lần gửi mới để CBTD kiểm tra lại.')],
[b('','Chưa có nội dung cần sửa: không cho trả sửa.'),b('','Còn yêu cầu xin sửa đang chờ: yêu cầu xử lý trước.')]);
add('Cho phép CBTD gửi yêu cầu đối soát dữ liệu doanh nghiệp.',
'Đăng nhập CBTD, được giao đề nghị; MST đã tồn tại và có thông tin khác biệt.',
'Lưu yêu cầu chờ Quản lý; chưa thay đổi dữ liệu doanh nghiệp.',
'Mở đề nghị.=>Hiển thị chi tiết đề nghị.~Nhấn Đối chiếu dữ liệu Company.=>Hiển thị các thông tin khác nhau.~Nhập căn cứ đối soát.=>~Nhấn Gửi đối soát Company.=>Thông báo đã gửi yêu cầu.',
[b('Thông tin đã khớp.','Thông báo không cần đối soát.')],
[b('','Thiếu căn cứ hoặc đã có yêu cầu chờ: không gửi.'),b('','Dữ liệu đối chiếu thay đổi: yêu cầu tải lại.')]);
add('Cho phép CBTD tiếp nhận đề nghị thành hồ sơ vay.',
'Đăng nhập CBTD, được giao đề nghị; checklist đạt, không còn xin sửa/đối soát hoặc COI chặn.',
'Tạo một hồ sơ Mới tiếp nhận, liên kết đề nghị; bắt đầu SLA hồ sơ vay.',
'Mở đề nghị đủ điều kiện.=>Hiển thị kết quả kiểm tra.~Nhấn Kiểm tra doanh nghiệp để tiếp nhận.=>Hiển thị kết quả đối chiếu doanh nghiệp.~Nhấn Tiếp nhận thành hồ sơ vay.=>Hiển thị yêu cầu xác nhận.~Nhấn OK.=>Mở hồ sơ mới; đề nghị chuyển Đã tiếp nhận.',
[b('DN đã tồn tại: xác nhận dùng dữ liệu hiện hữu và đã đối chiếu tài chính.','Giữ dữ liệu doanh nghiệp; khác biệt cần xử lý đối soát trước.')],
[b('','Chưa đủ điều kiện: hiển thị lý do, không tiếp nhận.'),b('','Đề nghị thay đổi: yêu cầu tải lại. Đã tiếp nhận: mở hồ sơ có sẵn, không tạo trùng.')]);
add('Cho phép cán bộ yêu cầu doanh nghiệp bổ sung chứng từ.',
'Đúng quyền công đoạn; hồ sơ chưa kết thúc, chưa có đợt bổ sung chờ và không bị COI chặn.',
'Tạo yêu cầu, chuyển Chờ bổ sung và tạm dừng SLA chờ DN; bỏ cờ đủ hồ sơ.',
'Mở thẻ Yêu cầu bổ sung.=>Hiển thị các yêu cầu hiện có.~Nhấn Tạo yêu cầu bổ sung theo danh mục.=>Hiển thị form yêu cầu.~Nhập nội dung, loại tài liệu và lý do.=>~Nhấn Gửi yêu cầu & Tạm dừng SLA.=>Thông báo đã gửi; hiển thị Chờ bổ sung.',
[b('Nhấn Thêm mục.','Thêm dòng tài liệu cần bổ sung.'),b('DN tải tài liệu và nhấn Gửi tài liệu bổ sung khi đã đủ.','Hiển thị Đã gửi, chờ kiểm tra; PA1 chạy lại từ lúc gửi đủ.')],
[b('','Thiếu nội dung, trùng mục hoặc đã có đợt chờ: không tạo yêu cầu.')]);
add('Cho phép cán bộ kiểm tra và hoàn tất đợt bổ sung.',
'Đúng quyền công đoạn; có đợt bổ sung chờ và tài liệu DN đã gửi.',
'Đợt bổ sung hoàn tất; hồ sơ trở lại trạng thái xử lý theo công đoạn.',
'Mở đợt bổ sung.=>Hiển thị các mục và tài liệu đã gửi.~Nhấn Chấp nhận mục tại tài liệu đạt.=>Hiển thị Đã chấp nhận.~Nhấn Hoàn tất yêu cầu & Chạy lại SLA.=>Thông báo hoàn tất; cập nhật trạng thái hồ sơ.',
[b('Chọn Yêu cầu thay thế và gửi danh sách sửa sau khi kiểm tra xong.','Hiển thị Cần thay thế; PA1 mở lại khoảng chờ DN.'),b('DN gửi đủ bản thay thế.','Hiển thị tài liệu mới chờ kiểm tra; giữ lịch sử tệp.')],
[b('','Còn mục chưa đạt: không hoàn tất.'),b('','Dữ liệu thay đổi hoặc hồ sơ kết thúc: chặn thao tác.')]);
add('Cho phép CBTD xác nhận hồ sơ đủ chứng từ.',
'Đăng nhập CBTD, phụ trách hồ sơ ở Tiếp nhận và không chờ bổ sung.',
'Hồ sơ chuyển Đã đủ hồ sơ; chưa chuyển Thẩm định.',
'Mở Danh mục chứng từ.=>Hiển thị chứng từ ban đầu và bổ sung đã đạt.~Nhấn Xác nhận hồ sơ đầy đủ.=>Hiển thị Đã đủ hồ sơ.',
[b('Phát hiện thiếu chứng từ: tạo yêu cầu bổ sung.','Chuyển Chờ bổ sung và bỏ xác nhận đủ hồ sơ.')],
[b('','Sai người/công đoạn, đang chờ bổ sung hoặc hồ sơ kết thúc: không cho xác nhận.')]);
add('Cho phép CBTD nhập hạn mức chính thức để trình thẩm định.',
'Đăng nhập CBTD, phụ trách hồ sơ ở Tiếp nhận và không chờ bổ sung.',
'Lưu hạn mức chính thức; chưa phải quyết định phê duyệt.',
'Nhấn Sửa tại Hạn mức chính thức.=>Hiển thị ô nhập hạn mức.~Nhập số tiền.=>~Nhấn Lưu hạn mức.=>Hiển thị hạn mức đã cập nhật.',[],
[b('','Số tiền không hợp lệ, ≤0 hoặc vượt 10 tỷ: báo lỗi, không lưu.'),b('','Không còn quyền sửa tại Tiếp nhận: chặn cập nhật.')]);
add('Cho phép CBTD soạn và lưu nháp tờ trình.',
'Đăng nhập CBTD, phụ trách hồ sơ; tờ trình đang lập hoặc được yêu cầu làm rõ.',
'Lưu nháp; giữ nguyên các bản đã trình trước.',
'Mở khung Tờ trình tín dụng.=>Hiển thị nội dung nháp hoặc form trống.~Nhập nội dung tờ trình.=>~Nhấn Lưu nháp tờ trình.=>Thông báo Đã lưu bản nháp.',
[b('Tờ trình cần làm rõ: sửa nội dung theo yêu cầu.','Lưu nháp để trình phiên bản tiếp theo.')],
[b('','Bản đã trình chưa được mở làm rõ: không cho sửa.'),b('','Nội dung không hợp lệ hoặc bản nháp đã đổi: báo lỗi, yêu cầu kiểm tra lại.')]);
add('Cho phép CBTD trình tờ trình đã lưu nháp.',
'CBTD phụ trách; nháp đủ và đã lưu, có hạn mức, đủ chứng từ, không còn bổ sung chờ.',
'Tạo bản đã trình. Lần đầu chuyển Thẩm định; trình lại giữ công đoạn và SLA.',
'Mở tờ trình đã lưu.=>Hiển thị bản nháp.~Nhấn Trình tờ trình.=>Hiển thị bản đã trình và thông báo thành công.',
[b('Trình lại sau yêu cầu làm rõ.','Tạo bản tiếp theo, giữ bản cũ và thời gian đã xử lý.')],
[b('','Chưa lưu nháp hoặc thiếu điều kiện: thông báo nội dung cần hoàn thiện.'),b('','Bản nháp/tài liệu căn cứ đã đổi: yêu cầu kiểm tra lại.')]);
add('Cho phép CBTD tìm và xem hồ sơ được phụ trách.',
'Đã đăng nhập với vai trò Cán bộ tín dụng.',
'Hiển thị hồ sơ phù hợp trong phạm vi quyền.',
'Mở Danh sách hồ sơ.=>Hiển thị các hồ sơ được phép xem.~Nhập mã hồ sơ, tên doanh nghiệp hoặc MST.=>~Nhấn Tìm.=>Hiển thị kết quả phù hợp.~Nhấn Chi tiết tại hồ sơ.=>Hiển thị chi tiết hồ sơ.',
[b('Chọn công đoạn, trạng thái hoặc kiểu xem.','Hiển thị theo bộ lọc và kiểu xem đã chọn.')],
[b('','Không có kết quả: hiển thị danh sách trống.'),b('','Không có quyền: từ chối truy cập. Hồ sơ đã kết thúc chỉ được xem.')]);
add('Cho phép Thẩm quyền xem hồ sơ và tờ trình.',
'Đăng nhập Thẩm quyền; hồ sơ từ công đoạn Thẩm định trở đi.',
'Hiển thị tờ trình và tài liệu ở chế độ chỉ xem.',
'Mở Thẩm định & phê duyệt.=>Hiển thị danh sách hồ sơ.~Nhấn Chi tiết.=>Hiển thị hồ sơ và tờ trình.~Chọn bản đã trình hoặc thẻ tài liệu.=>Hiển thị nội dung tương ứng.',
[b('Nhấn Chạy lại AI khi được phép.','Cập nhật dự báo nguy cơ trễ SLA nếu khả dụng.')],
[b('','Chưa có tờ trình/dự báo: hiển thị chưa có dữ liệu.'),b('','Không độc lập: chặn quyết định/làm rõ. PA1 không tương thích: thông báo chưa có dự báo phù hợp.')]);
add('Cho phép Thẩm quyền yêu cầu CBTD làm rõ tờ trình.',
'Thẩm quyền độc lập; hồ sơ ở Thẩm định, tờ trình đã trình và chưa có quyết định.',
'Tờ trình chuyển CBTD cần làm rõ; SLA nội bộ tiếp tục chạy.',
'Mở tờ trình cần làm rõ.=>Hiển thị tờ trình và ô yêu cầu.~Nhập nội dung cần làm rõ.=>~Nhấn Yêu cầu làm rõ tờ trình.=>Thông báo đã gửi; hiển thị CBTD cần làm rõ.',[],
[b('','Nội dung trống hoặc tờ trình đã đổi: báo lỗi.'),b('','Không độc lập, có COI chặn hoặc hồ sơ kết thúc: từ chối thao tác.')]);
add('Cho phép Thẩm quyền phê duyệt khoản vay.',
'Thẩm quyền độc lập; bản trình mới nhất hợp lệ, không còn bổ sung/làm rõ hoặc COI chặn.',
'Hồ sơ Hoàn tất/Đã phê duyệt; lưu quyết định và khóa ghi nghiệp vụ.',
'Nhấn Phê duyệt Khoản vay tại hồ sơ.=>Hiển thị form số tiền và lãi suất.~Nhập số tiền, lãi suất.=>~Nhấn Xác nhận Phê duyệt.=>Hiển thị Đã phê duyệt.',[],
[b('','Số tiền ≤0/vượt hạn mức hoặc lãi suất ngoài 0–100%: báo lỗi.'),b('','Sai quyền độc lập, căn cứ đã đổi hoặc còn điều kiện chưa đạt: không phê duyệt.'),b('','Hồ sơ đã kết thúc: không ghi quyết định tiếp theo.')]);
add('Cho phép Thẩm quyền từ chối khoản vay.',
'Thẩm quyền độc lập; bản trình mới nhất hợp lệ, không còn bổ sung/làm rõ hoặc COI chặn.',
'Hồ sơ Hoàn tất/Bị từ chối; lưu lý do và khóa ghi nghiệp vụ.',
'Nhấn Từ chối tại hồ sơ.=>Hiển thị mã lý do và ô giải trình.~Chọn mã TC01–TC05.=>~Nhập giải trình.=>~Nhấn Xác nhận Từ chối hồ sơ.=>Hiển thị Bị từ chối.',[],
[b('','Mã không hợp lệ hoặc thiếu giải trình: báo lỗi.'),b('','Không độc lập, bản trình/căn cứ đã đổi hoặc hồ sơ kết thúc: không quyết định.')]);
add('Cho phép Quản lý giao đề nghị mới cho CBTD.',
'Đăng nhập Quản lý; đề nghị đã gửi, chưa có người phụ trách và chưa tiếp nhận.',
'Lưu phân công, đề nghị chuyển Chờ tiếp nhận; chưa bắt đầu SLA khoản vay.',
'Mở đề nghị chưa phân công.=>Hiển thị form Phân công cán bộ tín dụng.~Chọn cán bộ nhận.=>~Nhấn Phân công đề nghị.=>Hiển thị yêu cầu xác nhận.~Nhấn OK.=>Thông báo Đã lưu phân công.',[],
[b('','Tự giao cho mình hoặc cán bộ nhận không còn hoạt động/vai trò CBTD: báo lỗi.'),b('','Đề nghị vừa được phân công hoặc tiếp nhận: yêu cầu tải lại.')]);
add('Cho phép Quản lý bàn giao hồ sơ sang CBTD khác.',
'Đăng nhập Quản lý; hồ sơ chưa kết thúc, cán bộ nhận còn hoạt động và có quyền CBTD.',
'Đổi người phụ trách, lưu bàn giao; giữ mã, lịch sử và SLA đã sử dụng.',
'Nhấn Điều chuyển tại hồ sơ.=>Hiển thị form Điều chuyển hồ sơ.~Chọn cán bộ nhận.=>~Nhập lý do.=>~Nhấn Xác nhận Điều chuyển.=>Thông báo điều chuyển thành công.',
[b('Đề nghị chưa tiếp nhận: chọn Điều chuyển đề nghị.','Đổi người phụ trách; đề nghị đang Cần chỉnh sửa vẫn giữ trạng thái đó.')],
[b('','Thiếu lý do, trùng người cũ/tự giao hoặc người nhận không hợp lệ: báo lỗi.'),b('','Hồ sơ kết thúc hoặc phân công đã đổi: không điều chuyển theo bản cũ.')]);
add('Cho phép Quản lý xử lý đề nghị điều phối do CBTD gửi.',
'Đăng nhập Quản lý; có đề nghị chờ, người quyết định khác người gửi.',
'Lưu chấp thuận và bàn giao hoặc không chấp thuận, giữ người phụ trách.',
'Mở đề nghị điều phối chờ quản lý.=>Hiển thị lý do và cán bộ phụ trách.~Chọn cán bộ nhận.=>~Nhập căn cứ.=>~Nhấn Chấp thuận và bàn giao.=>Hiển thị Đã chấp thuận điều phối.',
[b('Nhập căn cứ, xác nhận CBTD còn xử lý được và chọn Không chấp thuận điều phối.','Lưu không chấp thuận, giữ phân công.')],
[b('','Tự duyệt, thiếu căn cứ hoặc người nhận không hợp lệ: báo lỗi.'),b('','Đề nghị đã xử lý/hết hiệu lực: không bàn giao theo yêu cầu cũ.')]);
add('Cho phép Quản lý xử lý báo cáo xung đột lợi ích.',
'Đăng nhập Quản lý; có COI đang chờ, người quyết định khác người báo.',
'Bàn giao hoặc kết luận không có COI; lưu căn cứ và giải quyết chặn tương ứng.',
'Mở đề nghị Xung đột lợi ích.=>Hiển thị lý do và cảnh báo chặn thao tác.~Chọn cán bộ nhận.=>~Nhập căn cứ.=>~Nhấn Chấp thuận và bàn giao.=>Hiển thị kết quả bàn giao.',
[b('Xác nhận CBTD tiếp tục được, không có COI và chọn Không chấp thuận điều phối.','Lưu kết luận, giữ cán bộ và gỡ chặn COI tương ứng.')],
[b('','Tự duyệt, thiếu căn cứ/xác nhận hoặc đề nghị hết hiệu lực: từ chối.'),b('CBTD tự rút báo cáo COI.','Không cho tự rút hoặc đổi vai trò để gỡ chặn.')]);
add('Cho phép Quản lý duyệt cập nhật dữ liệu doanh nghiệp hiện hữu.',
'Có đối soát chờ; Quản lý khác người lập. Chấp thuận cần checklist đạt, đúng bản gửi và dữ liệu.',
'Cập nhật doanh nghiệp hoặc giữ nguyên nếu từ chối; bảo toàn thông tin hồ sơ vay cũ.',
'Mở đề nghị có yêu cầu đối soát.=>Hiển thị thông tin trước/sau và căn cứ.~Nhập căn cứ quyết định.=>~Nhấn Xác nhận đối soát và cập nhật Company.=>Hiển thị yêu cầu xác nhận.~Nhấn OK.=>Thông báo đã cập nhật; đóng yêu cầu.',
[b('Nhấn Không chấp thuận đối soát sau khi nhập căn cứ.','Giữ dữ liệu doanh nghiệp; lưu kết quả từ chối.')],
[b('','Tự duyệt, chưa đạt checklist hoặc còn xin sửa: không chấp thuận.'),b('','Dữ liệu hoặc lần gửi đã đổi: yêu cầu lập lại đối soát.')]);
add('Cho phép xem cảnh báo nguy cơ trễ SLA.',
'Đăng nhập Quản lý hoặc Thẩm quyền; Thẩm quyền chỉ xem hồ sơ từ Thẩm định.',
'Hiển thị cảnh báo theo quyền; không quyết định tín dụng.',
'Mở Dashboard tổng quan.=>Hiển thị Bảng Cảnh báo Sớm AI.~Nhấn Xử lý tại hồ sơ.=>Hiển thị chi tiết hồ sơ.',
[b('Quản lý nhấn Điều phối cán bộ.','Mở Điều chuyển & phân công.')],
[b('','Chưa có dự báo hoặc không tương thích PA1: hiển thị tình trạng tương ứng.'),b('','Không tải được dữ liệu: báo lỗi, không tạo xác suất giả.')]);
add('Cho phép xem thống kê hồ sơ và SLA của chi nhánh.',
'Đăng nhập Quản lý hoặc Thẩm quyền.',
'Hiển thị số liệu tổng quan và điểm nghẽn theo công đoạn.',
'Mở Dashboard tổng quan.=>Hiển thị các chỉ số hồ sơ và tỷ lệ SLA.~Xem Phân tích Điểm nghẽn Quy trình SLA.=>Hiển thị thời gian trung bình và số lượt trễ theo công đoạn.',[],
[b('','Không tải được dữ liệu: báo lỗi.'),b('','Số liệu SLA cũ/PA1 được tách riêng; chưa có lượt PA1 kết thúc thì chưa có tỷ lệ PA1.')]);
add('Cho phép Quản lý đóng hồ sơ quá hạn bổ sung.',
'Quản lý không là người phụ trách/tiếp nhận; hồ sơ quá hạn và vẫn chờ DN bổ sung.',
'Hồ sơ Hoàn tất/Đã đóng do quá hạn, mã TC05; lưu lý do và khóa ghi nghiệp vụ.',
'Chọn hồ sơ quá hạn trên Dashboard.=>Hiển thị chi tiết hồ sơ.~Nhấn Đóng hồ sơ do quá hạn.=>Hiển thị form lý do.~Nhập lý do đóng hồ sơ.=>~Nhấn Xác nhận đóng hồ sơ.=>Hiển thị Đã đóng do quá hạn bổ sung.',[],
[b('','Thiếu lý do, chưa quá hạn hoặc người đóng không độc lập: không cho đóng.'),b('','DN đã gửi đủ, ngân hàng đang kiểm tra: không đóng quá hạn.')]);
add('Cho phép Quản trị viên tạo tài khoản cán bộ.',
'Đã đăng nhập với vai trò Quản trị viên.',
'Tạo tài khoản nội bộ với các vai trò được chọn.',
'Mở Liên hệ cá nhân.=>Hiển thị danh sách người dùng.~Nhấn Tạo mới liên hệ.=>Hiển thị form Tạo tài khoản.~Nhập thông tin tài khoản.=>~Chọn vai trò.=>~Nhấn Lưu tài khoản.=>Thông báo đã lưu, cập nhật danh sách.',[],
[b('','Trùng tên đăng nhập/email: báo lỗi.'),b('','Thiếu thông tin, mật khẩu dưới 8 ký tự hoặc không chọn vai trò: không lưu.')]);
add('Cho phép Quản trị viên sửa thông tin và vai trò cán bộ.',
'Đăng nhập Quản trị viên; tài khoản cần sửa tồn tại.',
'Lưu thông tin và vai trò hợp lệ.',
'Nhấn Sửa / Cấp quyền tại tài khoản.=>Hiển thị form Cập nhật tài khoản.~Sửa thông tin hoặc vai trò.=>~Nhấn Lưu tài khoản.=>Thông báo đã lưu, cập nhật danh sách.',[],
[b('','Tự bỏ ADMIN hoặc bỏ CBTD khi còn hồ sơ/đề nghị chưa bàn giao: không lưu.'),b('','Thông tin hoặc vai trò không hợp lệ: báo lỗi.')]);
add('Cho phép Quản trị viên khóa hoặc mở khóa tài khoản.',
'Đăng nhập Quản trị viên; tài khoản đích tồn tại.',
'Tài khoản chuyển Đã khóa hoặc Hoạt động.',
'Mở Sửa / Cấp quyền của tài khoản.=>Hiển thị trạng thái Tài khoản hoạt động.~Bỏ chọn Tài khoản hoạt động.=>~Nhấn Lưu tài khoản.=>Thông báo đã khóa tài khoản.',
[b('Chọn lại Tài khoản hoạt động và lưu.','Thông báo đã mở khóa tài khoản.')],
[b('','Tự khóa chính mình hoặc cán bộ còn công việc chưa bàn giao: từ chối khóa.')]);
add('Cho phép Quản trị viên sửa định mức giờ SLA công đoạn.',
'Đăng nhập Quản trị viên; công đoạn đã tồn tại.',
'Lưu định mức cho lượt mở công đoạn mới; không đổi lịch sử đã chốt.',
'Mở Cấu hình SLA.=>Hiển thị danh sách công đoạn và SLA.~Nhập số giờ mới tại công đoạn.=>~Nhấn Lưu.=>Thông báo đã cập nhật.',[],
[b('','Số giờ không nguyên hoặc nhỏ hơn 1: báo lỗi.'),b('','Không có quyền hoặc công đoạn không tồn tại: từ chối cập nhật.')]);
add('Cho phép DN khai thông tin, tải chứng từ và gửi đề nghị vay.',
'DN đã đăng nhập Portal; chức năng gửi đang bật. Đề nghị mới tối đa 10 tỷ.',
'Lưu nháp hoặc gửi vào hàng chờ ngân hàng; chưa tạo hồ sơ vay, chưa tính SLA khoản vay.',
'Nhấn Tạo đề nghị vay.=>Hiển thị form đề nghị.~Nhập thông tin doanh nghiệp, nhu cầu vay và phương án vốn.=>~Nhấn Lưu nháp.=>Hiển thị mã và nội dung nháp.~Tải chứng từ theo danh mục.=>Hiển thị tài liệu đã tải và mục còn thiếu.~Nhấn Gửi đề nghị.=>Hiển thị yêu cầu xác nhận.~Nhấn Xác nhận gửi.=>Thông báo đã gửi; khóa chỉnh sửa.',
[b('Chưa hoàn thiện: chỉ lưu nháp.','Giữ nháp để bổ sung sau; không tự quy đổi doanh thu hoặc điền 0 thay thiếu.'),b('Đề nghị được trả sửa: sửa trên cùng mã rồi nhấn Gửi lại đề nghị.','Lưu lần gửi mới và giữ lịch sử.')],
[b('','Thiếu dữ liệu, nguồn doanh thu năm, tài liệu/cam kết hoặc vượt 10 tỷ: chưa cho gửi.'),b('','Tệp sai định dạng/hỏng hoặc quá 10 MB: yêu cầu tải lại.'),b('','Đề nghị đã khóa, chưa được mở sửa hoặc dữ liệu đã đổi: chặn thao tác, yêu cầu tải lại.')]);

if(short.length!==29)throw Error('Not 29 cases');
const alternativeAnchors={UC01:[5],UC02:[5],UC03:[1,7],UC04:[4],UC05:[4],UC06:[5,7],UC07:[3,4],UC08:[3],UC10:[3],UC11:[3],UC12:[3],UC13:[5],UC18:[1],UC19:[5],UC20:[5],UC21:[4],UC22:[3],UC27:[3],UC29:[4,1]};
const exceptionAnchors={UC12:[5,7],UC13:[4,6],UC20:[6,1],UC22:[2,2],UC23:[4,2],UC29:[9,7,11]};
for(const s of short){
 const rows=[];let step=0;
 for(const [label,key] of [['Tên use case','title'],['Mô tả','description'],['Tiền điều kiện','pre'],['Hậu điều kiện','post'],['Actor chính','actor']])rows.push({kind:'meta',cells:[label,s[key]]});
 rows.push({kind:'section',title:'Luồng sự kiện chính (Basic flow)'},{kind:'columns',cells:['Actor','System']});
 for(const pair of s.flow){
  if(pair.length!==2||!pair[0]&&!pair[1])throw Error('Bad pair '+s.id);
  rows.push({kind:'flow',cells:pair.map(t=>t?`${++step}. ${t}`:'')});
 }
 s.stepCount=step;
 const counts=new Map();
 for(const [key,label] of [['alternatives','Luồng sự kiện thay thế (Alternative flow)'],['exceptions','Luồng sự kiện ngoại lệ (Exception flow)']]){
  if(!s[key].length)continue;
  rows.push({kind:'section',title:label});
  for(const [index,br] of s[key].entries()){
   const anchors=key==='alternatives'?alternativeAnchors[s.id]:exceptionAnchors[s.id];
   const at=anchors?.[index]??step;
   if(at<1||at>step)throw Error('Invalid branch anchor '+s.id);
   let count=counts.get(at)||0;br.at=at;
   rows.push({kind:key,cells:[br.actor?`${at}.${++count}. ${br.actor}`:'',`${at}.${++count}. ${br.system}`]});counts.set(at,count);
  }
 }
 s.rows=rows;
}
for(const [key,source] of Object.entries(detailed.sources)){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex').toUpperCase();
 if(actual!==detailed.sourceHashes[key])throw Error('Source drift '+source.file);
}
const textCount=cases=>cases.reduce((total,s)=>total+s.rows.flatMap(r=>r.cells||[r.title]).join(' ').length,0);
const out={...detailed,specs:short,style:'Ngắn gọn; một bước một thao tác; System chỉ ghi màn hình/kết quả; giữ điều kiện nghiệp vụ chính.',mainFlowRows:short.reduce((sum,s)=>sum+s.flow.length,0),reduction:{before:textCount(detailed.specs),after:textCount(short)}};
fs.writeFileSync(file('specifications-29.json'),JSON.stringify(out,null,2),'utf8');
console.log(JSON.stringify({total:29,mainFlowRows:out.mainFlowRows,steps:short.reduce((sum,s)=>sum+s.stepCount,0),...out.reduction,reductionPercent:Math.round((1-out.reduction.after/out.reduction.before)*100)}));
