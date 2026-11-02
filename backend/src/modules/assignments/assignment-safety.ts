import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export function validateAssignmentOperation(body: { expectedAssignmentVersion?: unknown; clientRequestId?: unknown }) {
  if (!Number.isSafeInteger(body?.expectedAssignmentVersion) || Number(body.expectedAssignmentVersion) < 0 ||
    typeof body?.clientRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientRequestId)) {
    throw new BadRequestException('Cần phiên bản phân công và mã thao tác hợp lệ. Vui lòng tải lại màn hình nếu đang dùng phiên bản cũ.');
  }
}

export function assignmentReason(value: unknown, required = true): string | null {
  if (value !== undefined && (typeof value !== 'string' || value.length > 2000)) throw new BadRequestException('Lý do phân công tối đa 2.000 ký tự.');
  const reason = typeof value === 'string' ? value.trim() : '';
  if (required && !reason) throw new BadRequestException('Vui lòng nhập lý do điều chuyển.');
  return reason || null;
}

export const assignmentPayloadHash = (parts: unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

export function assertAssignmentVersion(actual: number | undefined, expected: number) {
  if ((actual ?? 0) !== expected) throw new ConflictException('Phân công đã thay đổi. Hãy tải lại, đối chiếu người phụ trách và xác nhận lại trước khi chuyển.');
}
