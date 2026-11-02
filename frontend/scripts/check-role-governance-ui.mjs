import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const navbarSource = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
const authContextSource = fs.readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
const clientSource = fs.readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8');

// -------------------------------------------------------------
// TIÊU CHÍ 1: Navbar Role Switcher & R6 UI Selection
// -------------------------------------------------------------
test('D7-01: Navbar displays Role Switcher for multi-role users with unsaved work confirmation', () => {
  // 1. Kiểm tra có vùng role switcher trong Navbar
  assert.ok(navbarSource.includes('account-role-switcher'), 'Navbar phải chứa vùng account-role-switcher');
  assert.ok(navbarSource.includes('role="radiogroup"'), 'Vùng chọn vai trò phải có role radiogroup');
  assert.ok(navbarSource.includes('handleSwitchRole'), 'Phải có hàm handleSwitchRole xử lý chuyển vai trò');

  // 2. Kiểm tra chỉ hiển thị khi tài khoản có nhiều hơn 1 vai trò (user.roles.length > 1)
  assert.match(navbarSource, /user\.roles\.length\s*>\s*1/, 'Chỉ hiển thị bộ chọn khi user có > 1 vai trò');

  // 3. Kiểm tra cảnh báo hủy nội dung chưa lưu trước khi chuyển vai trò (không tự lưu hay gửi thay)
  assert.match(navbarSource, /window\.confirm/, 'Phải có xác nhận trước khi chuyển vai trò');
  assert.match(navbarSource, /hủy bỏ mọi nội dung chưa lưu/i, 'Cảnh báo phải nêu rõ việc hủy bỏ nội dung chưa lưu');
  assert.match(navbarSource, /không tự động lưu hoặc gửi thay/i, 'Cảnh báo nêu rõ hệ thống không tự lưu/gửi thay');

  // 4. Kiểm tra nút radio và đánh dấu vai trò đang chọn
  assert.match(navbarSource, /role="radio"/, 'Mỗi tùy chọn vai trò có role radio');
  assert.match(navbarSource, /aria-checked=\{activeRole === r\}/, 'Thuộc tính aria-checked biểu thị vai trò đang chọn');
});

// -------------------------------------------------------------
// TIÊU CHÍ 2: Đồng bộ hai tab trình duyệt (Multi-tab Storage Sync)
// -------------------------------------------------------------
test('D7-01: Cross-tab sync listens to sme_active_role and updates activeRole only for granted roles', () => {
  // 1. Lắng nghe storage event cho sme_active_role
  assert.match(authContextSource, /event\.key === 'sme_active_role'/, 'AuthContext phải lắng nghe key sme_active_role');

  // 2. Chỉ chuyển vai trò nếu vai trò mới nằm trong user.roles đã cấp
  assert.match(authContextSource, /currentUser\?\.roles\.includes\(newRole\)/, 'Chỉ chấp nhận vai trò nếu thuộc roles được cấp');
  assert.match(authContextSource, /updateRole\(newRole\)/, 'Cập nhật activeRole khi hợp lệ');
});

// -------------------------------------------------------------
// TIÊU CHÍ 3: Mã lỗi riêng ACTIVE_ROLE_INVALID & Chống phục hồi tràn lan
// -------------------------------------------------------------
test('D7-02: Client dispatches sme-role-invalidated ONLY for 403 with ACTIVE_ROLE_INVALID and matching role', () => {
  // 1. Kiểm tra điều kiện bắt đúng 403 và errorCode ACTIVE_ROLE_INVALID
  assert.match(clientSource, /response\.status === 403 && body\?\.errorCode === 'ACTIVE_ROLE_INVALID'/, 'Chỉ bắt 403 có errorCode ACTIVE_ROLE_INVALID');

  // 2. Chống phản hồi cũ tác động vai trò/phiên mới: kiểm tra cả token và role tại thời điểm request
  assert.match(clientSource, /currentRole === roleAtRequest/, 'Phản hồi cũ không được tác động vai trò mới');
  assert.match(clientSource, /currentToken === tokenAtRequest/, 'Phản hồi cũ không được tác động phiên mới kể cả cùng vai trò');

  // 3. Phản hồi 401 cũng được cô lập: chỉ logout nếu token tại thời điểm gửi khớp token hiện tại
  assert.match(clientSource, /getAuthToken\(\) === tokenAtRequest/, 'Phản hồi 401 cũ không được làm hết hạn token mới');

  // 4. ApiError lưu trữ errorCode
  assert.match(clientSource, /constructor\(message: string, public status: number, public errorCode\?: string\)/, 'ApiError chứa errorCode');
});

// -------------------------------------------------------------
// TIÊU CHÍ 4: Phục hồi an toàn 1 lần, chống vòng lặp & Kết thúc an toàn
// -------------------------------------------------------------
test('D7-02: AuthContext performs single recovery, avoids loops, and safely logs out if account locked or 0 roles', () => {
  // 1. Cờ chống vòng lặp phục hồi
  assert.match(authContextSource, /recoveringRef = useRef\(false\)/, 'Phải có ref chống vòng lặp phục hồi');
  assert.match(authContextSource, /if \(recoveringRef\.current\) return/, 'Bỏ qua nếu đang trong quá trình phục hồi');

  // 2. Lắng nghe sự kiện sme-role-invalidated
  assert.match(authContextSource, /window\.addEventListener\('sme-role-invalidated', onRoleInvalidated\)/, 'Lắng nghe sự kiện sme-role-invalidated');

  // 3. Khi tài khoản bị khóa (isActive === false) hoặc không còn vai trò nào -> kết thúc phiên an toàn
  assert.match(authContextSource, /if \(!profile \|\| profile\.isActive === false \|\| !profile\.roles\?\.length\) \{[\s\S]*logout\(\)/, 'Kết thúc an toàn khi không còn vai trò');

  // 4. Chọn vai trò còn hiệu lực trong profile mới
  assert.match(authContextSource, /setActiveRole\(fallbackRole\)/, 'Chuyển về vai trò hợp lệ còn lại');
  assert.match(authContextSource, /updateRole\(fallbackRole\)/, 'Cập nhật state activeRole mới');
});

// -------------------------------------------------------------
// TIÊU CHÍ 5: Workspace unmount dọn sạch modal và state nhập liệu
// -------------------------------------------------------------
test('D7-03: Workspace remounts on key user.id:activeRole to completely isolate state across roles', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /<Workspace key=\{`\$\{user\.id\}:\$\{activeRole\}`\} \/>/, 'Workspace phải remount triệt để khi đổi user hoặc role');
});

