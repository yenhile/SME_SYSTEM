"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECOMMENDED_JWT_SECRET_LENGTH = exports.MIN_JWT_SECRET_LENGTH = void 0;
exports.jwtSecret = jwtSecret;
const node_crypto_1 = require("node:crypto");
exports.MIN_JWT_SECRET_LENGTH = 16;
exports.RECOMMENDED_JWT_SECRET_LENGTH = 32;
let generated;
let warnedShort = false;
function jwtSecret() {
    const configured = process.env.JWT_SECRET?.trim();
    if (configured) {
        if (configured.length < exports.MIN_JWT_SECRET_LENGTH) {
            throw new Error(`JWT_SECRET quá ngắn: cần ít nhất ${exports.MIN_JWT_SECRET_LENGTH} ký tự (khuyến nghị từ ${exports.RECOMMENDED_JWT_SECRET_LENGTH}).`);
        }
        if (configured.length < exports.RECOMMENDED_JWT_SECRET_LENGTH && !warnedShort) {
            warnedShort = true;
            console.warn(`[bảo mật] JWT_SECRET chỉ có ${configured.length} ký tự; nên dùng khóa ngẫu nhiên từ ${exports.RECOMMENDED_JWT_SECRET_LENGTH} ký tự.`);
        }
        return configured;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Thiếu JWT_SECRET: bắt buộc cấu hình khóa ký đăng nhập khi chạy production.');
    }
    if (!generated) {
        generated = (0, node_crypto_1.randomBytes)(48).toString('hex');
        console.warn('[bảo mật] Chưa cấu hình JWT_SECRET: dùng khóa ngẫu nhiên của tiến trình này, phiên đăng nhập sẽ mất khi khởi động lại.');
    }
    return generated;
}
//# sourceMappingURL=jwt-secret.js.map