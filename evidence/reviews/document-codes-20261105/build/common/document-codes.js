"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextDocumentCode = nextDocumentCode;
async function nextDocumentCode(tx, prefix) {
    let rows;
    if (prefix === 'DN') {
        rows = await tx.$queryRaw `SELECT nextval('portal_request_reference_seq'::regclass)::text AS value`;
    }
    else if (prefix === 'SME') {
        rows = await tx.$queryRaw `SELECT nextval('loan_application_code_seq'::regclass)::text AS value`;
    }
    else {
        throw new Error('Unsupported document code prefix');
    }
    const value = rows[0]?.value;
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value))
        throw new Error('Database did not allocate a valid document code');
    return `${prefix}-${value}`;
}
//# sourceMappingURL=document-codes.js.map