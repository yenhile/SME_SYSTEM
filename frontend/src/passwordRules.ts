export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordChange(oldPassword: string, newPassword: string, confirmPassword: string): string {
  if (!oldPassword) return 'Vui lòng nhập mật khẩu hiện tại.';
  if (newPassword.length < MIN_PASSWORD_LENGTH) return `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  if (newPassword !== confirmPassword) return 'Xác nhận mật khẩu mới không khớp.';
  return '';
}
