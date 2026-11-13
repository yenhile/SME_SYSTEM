import type { RoleCode } from './types';

/** Phạm vi việc của từng vai trò, hiển thị ở hồ sơ cá nhân và cạnh ô chọn vai trò trong form tài khoản của Admin. */
export const ROLE_GUIDE: Record<RoleCode, string[]> = {
  CBTD: [
    'Tiếp nhận hồ sơ do Quản lý giao, kiểm tra chứng từ và yêu cầu doanh nghiệp bổ sung khi còn thiếu.',
    'Xác nhận đủ chứng từ, xác nhận hạn mức chính thức, lập và trình tờ trình cho Thẩm quyền.',
    'Khi hồ sơ đang chờ doanh nghiệp bổ sung, SLA tạm dừng và các thao tác sửa bị khóa cho đến khi doanh nghiệp phản hồi.',
    'Hồ sơ đã trình lên Thẩm định chỉ xem; bạn chỉ sửa lại tờ trình khi Thẩm quyền yêu cầu làm rõ.',
    'Bạn chỉ thấy và chỉnh sửa hồ sơ do mình phụ trách.',
  ],
  THAM_QUYEN: [
    'Xem xét tờ trình đã trình, yêu cầu CBTD làm rõ, phê duyệt hoặc từ chối hồ sơ.',
    'Không được quyết định hồ sơ mà mình đã tiếp nhận hoặc tham gia lập tờ trình (kiểm soát độc lập).',
    'Dashboard tổng quan cho thấy các hồ sơ từ Thẩm định trở đi theo mức cảnh báo trễ SLA.',
  ],
  QUAN_LY: [
    'Theo dõi dashboard, điểm nghẽn SLA và các hồ sơ có nguy cơ trễ.',
    'Phân công và điều chuyển hồ sơ giữa các CBTD, xử lý yêu cầu điều phối.',
    'Xử lý hồ sơ quá hạn chờ doanh nghiệp bổ sung.',
  ],
  ADMIN: [
    'Quản lý tài khoản người dùng và cấp vai trò cho người khác; không tự đổi vai trò của chính mình.',
    'Cấu hình định mức SLA của từng công đoạn (tính theo giờ làm việc).',
    'Xem toàn bộ Dashboard, hồ sơ vay, doanh nghiệp, tài liệu, tờ trình, thẩm định và phân công ở chế độ chỉ xem.',
    'Không tạo, sửa, xóa, trình, phê duyệt, điều chuyển hay chạy lại dự báo trên hồ sơ.',
  ],
};
