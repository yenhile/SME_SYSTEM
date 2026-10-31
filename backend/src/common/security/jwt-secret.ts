import { randomBytes } from 'node:crypto';

/** Độ dài tối thiểu bắt buộc; khuyến nghị từ 32 ký tự trở lên. */
export const MIN_JWT_SECRET_LENGTH = 16;
export const RECOMMENDED_JWT_SECRET_LENGTH = 32;

let generated: string | undefined;
let warnedShort = false;

/**
 * Khóa ký phiên đăng nhập (nhân viên và Portal). Không bao giờ dùng một chuỗi cố định có sẵn trong mã nguồn.
 * - Có `JWT_SECRET`: dùng giá trị đó (từ chối nếu quá ngắn).
 * - Chưa cấu hình ở `production`: từ chối khởi động.
 * - Chưa cấu hình ở môi trường khác: sinh khóa ngẫu nhiên cho tiến trình này; phiên đăng nhập mất khi khởi động lại.
 */
export function jwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    if (configured.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET quá ngắn: cần ít nhất ${MIN_JWT_SECRET_LENGTH} ký tự (khuyến nghị từ ${RECOMMENDED_JWT_SECRET_LENGTH}).`);
    }
    if (configured.length < RECOMMENDED_JWT_SECRET_LENGTH && !warnedShort) {
      warnedShort = true;
      console.warn(`[bảo mật] JWT_SECRET chỉ có ${configured.length} ký tự; nên dùng khóa ngẫu nhiên từ ${RECOMMENDED_JWT_SECRET_LENGTH} ký tự.`);
    }
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Thiếu JWT_SECRET: bắt buộc cấu hình khóa ký đăng nhập khi chạy production.');
  }
  if (!generated) {
    generated = randomBytes(48).toString('hex');
    console.warn('[bảo mật] Chưa cấu hình JWT_SECRET: dùng khóa ngẫu nhiên của tiến trình này, phiên đăng nhập sẽ mất khi khởi động lại.');
  }
  return generated;
}
