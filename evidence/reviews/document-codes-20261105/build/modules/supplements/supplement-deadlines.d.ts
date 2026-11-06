export declare const REMINDER_AFTER_DAYS = 5;
export declare const OVERDUE_AFTER_DAYS = 10;
export declare function overdueAt(requestedAt: Date, deadlineAt?: Date | null): Date;
export declare function reminderAt(requestedAt: Date, deadlineAt?: Date | null): Date | null;
