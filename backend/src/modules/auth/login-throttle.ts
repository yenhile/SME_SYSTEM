interface Entry {
  failures: number;
  windowStart: number;
}

/**
 * Giới hạn số lần đăng nhập sai của nhân viên theo tên đăng nhập, để không thử mật khẩu liên tục.
 * Cửa sổ trượt cố định: sai `maxFailures` lần trong `windowMs` thì khóa thử cho tới hết cửa sổ (không khóa vĩnh viễn tài khoản).
 * Đếm theo tên đăng nhập (kể cả tên không tồn tại) để không lộ tên nào có thật. Lưu trong bộ nhớ của tiến trình:
 * khởi động lại hoặc chạy nhiều bản backend thì bộ đếm không dùng chung.
 */
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(
    readonly maxFailures = 5,
    readonly windowMs = 15 * 60 * 1000,
    private readonly maxEntries = 5000,
  ) {}

  /** Số mili giây còn phải chờ trước khi được thử lại; 0 nghĩa là được thử. */
  retryAfterMs(key: string, now: number): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    if (now - entry.windowStart >= this.windowMs) {
      this.entries.delete(key);
      return 0;
    }
    return entry.failures >= this.maxFailures ? entry.windowStart + this.windowMs - now : 0;
  }

  recordFailure(key: string, now: number): void {
    const entry = this.entries.get(key);
    if (entry && now - entry.windowStart < this.windowMs) {
      entry.failures += 1;
      return;
    }
    this.prune(now);
    this.entries.set(key, { failures: 1, windowStart: now });
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(now: number): void {
    if (this.entries.size < this.maxEntries) return;
    for (const [key, entry] of this.entries) if (now - entry.windowStart >= this.windowMs) this.entries.delete(key);
    // Vẫn đầy (nhiều tên khác nhau trong cùng cửa sổ): bỏ các mục cũ nhất để bộ nhớ không tăng vô hạn.
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
