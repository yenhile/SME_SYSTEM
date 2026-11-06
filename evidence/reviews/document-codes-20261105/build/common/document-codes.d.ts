import type { Prisma } from '@prisma/client';
export declare function nextDocumentCode(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, prefix: 'DN' | 'SME'): Promise<string>;
