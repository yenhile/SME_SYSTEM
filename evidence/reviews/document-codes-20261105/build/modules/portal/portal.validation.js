"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groups = exports.portalSecret = void 0;
exports.validatePortalData = validatePortalData;
exports.validatePortalFile = validatePortalFile;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
const pdf_lib_1 = require("pdf-lib");
const pngjs_1 = require("pngjs");
const jpeg = require("jpeg-js");
const yauzl = require("yauzl");
const node_zlib_1 = require("node:zlib");
const fast_xml_parser_1 = require("fast-xml-parser");
const client_1 = require("@prisma/client");
const jwt_secret_1 = require("../../common/security/jwt-secret");
const portalSecret = () => (0, node_crypto_1.createHmac)('sha256', (0, jwt_secret_1.jwtSecret)()).update('sme-enterprise-portal-v1').digest('hex');
exports.portalSecret = portalSecret;
exports.groups = ['A', 'B', 'C', 'D', 'E', 'F'];
const fields = ['taxCode', 'companyName', 'industry', 'establishedYear', 'annualRevenue', 'charterCapital', 'representativeName', 'phone', 'address', 'loanPurpose', 'loanType', 'proposedAmount', 'loanTermMonths'];
function validatePortalData(input, complete = false) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new common_1.BadRequestException('Dữ liệu hồ sơ không hợp lệ.');
    const data = input;
    if (Object.keys(data).some(k => !fields.includes(k)))
        throw new common_1.BadRequestException('Hồ sơ có trường không được phép.');
    for (const field of fields) {
        const value = data[field];
        if (value === undefined) {
            if (complete)
                throw new common_1.BadRequestException(`Thiếu thông tin: ${field}`);
            continue;
        }
        if (['establishedYear', 'annualRevenue', 'charterCapital', 'proposedAmount', 'loanTermMonths'].includes(field)) {
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1e16)
                throw new common_1.BadRequestException(`Giá trị không hợp lệ: ${field}`);
            if (field === 'establishedYear' && (!Number.isInteger(value) || value < 1950 || value > new Date().getFullYear()))
                throw new common_1.BadRequestException('Năm thành lập không hợp lệ.');
            if (field === 'loanTermMonths' && (!Number.isInteger(value) || value < 1 || value > 120))
                throw new common_1.BadRequestException('Thời hạn vay từ 1 đến 120 tháng.');
            if (field === 'proposedAmount' && value < 10000000)
                throw new common_1.BadRequestException('Số tiền vay tối thiểu 10 triệu VND.');
        }
        else {
            if (typeof value !== 'string' || value.length > 4000 || !value.trim())
                throw new common_1.BadRequestException(`Giá trị không hợp lệ: ${field}`);
            if (field === 'taxCode' && !/^(\d{10}|\d{13})$/.test(value))
                throw new common_1.BadRequestException('Mã số thuế phải có 10 hoặc 13 chữ số.');
            if (field === 'loanType' && !Object.values(client_1.LoanType).includes(value))
                throw new common_1.BadRequestException('Loại vay không hợp lệ.');
        }
    }
    return data;
}
async function validateWorkbook(buffer) {
    await new Promise((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
            if (err || !zip) {
                reject(err || new Error('ZIP'));
                return;
            }
            let size = 0, count = 0;
            const found = new Set(), names = new Set();
            const xmls = new Map();
            const fail = (error) => { zip.close(); reject(error); };
            zip.on('error', fail);
            zip.on('entry', entry => {
                size += entry.uncompressedSize;
                count++;
                if (size > 25 * 1024 * 1024 || count > 2000 || names.has(entry.fileName) || /(^\/|\.\.|\\)/.test(entry.fileName) || /vbaProject|externalLinks/i.test(entry.fileName)) {
                    fail(new Error('Unsafe workbook'));
                    return;
                }
                names.add(entry.fileName);
                if (entry.fileName.endsWith('/')) {
                    zip.readEntry();
                    return;
                }
                zip.openReadStream(entry, (e, stream) => {
                    if (e || !stream) {
                        fail(e);
                        return;
                    }
                    let read = 0, checksum = 0;
                    const chunks = [];
                    const xmlEntry = /\.(xml|rels)$/.test(entry.fileName);
                    stream.on('data', chunk => { read += chunk.length; checksum = (0, node_zlib_1.crc32)(chunk, checksum); if (read > entry.uncompressedSize || read > 25 * 1024 * 1024) {
                        stream.destroy(new Error('ZIP size'));
                    } if (xmlEntry)
                        chunks.push(chunk); });
                    stream.on('error', fail);
                    stream.on('end', () => {
                        if (read !== entry.uncompressedSize || checksum !== entry.crc32) {
                            fail(new Error('ZIP truncated or corrupt'));
                            return;
                        }
                        if (xmlEntry) {
                            const xml = Buffer.concat(chunks).toString('utf8');
                            if (/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External|macroEnabled/i.test(xml) || fast_xml_parser_1.XMLValidator.validate(xml) !== true) {
                                fail(new Error('Invalid XML'));
                                return;
                            }
                            xmls.set(entry.fileName, xml);
                            if (entry.fileName === '[Content_Types].xml' && xml.includes('<Types'))
                                found.add('types');
                            if (entry.fileName === 'xl/workbook.xml' && xml.includes('<workbook') && /<(?:\w+:)?sheet\b/.test(xml))
                                found.add('workbook');
                            if (entry.fileName === '_rels/.rels' && xml.includes('<Relationships'))
                                found.add('relationships');
                            if (entry.fileName === 'xl/_rels/workbook.xml.rels' && xml.includes('<Relationships'))
                                found.add('workbookRelationships');
                            if (/^xl\/worksheets\/[^/]+\.xml$/.test(entry.fileName) && /<(?:\w+:)?worksheet\b/.test(xml))
                                found.add('worksheet');
                        }
                        zip.readEntry();
                    });
                });
            });
            zip.on('end', () => {
                try {
                    if (found.size !== 5)
                        throw new Error('Missing workbook');
                    const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, processEntities: false, removeNSPrefix: true });
                    const array = (v) => v === undefined ? [] : Array.isArray(v) ? v : [v];
                    const types = array(parser.parse(xmls.get('[Content_Types].xml')).Types?.Override);
                    if (!types.some(t => t['@_PartName'] === '/xl/workbook.xml' && t['@_ContentType'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'))
                        throw new Error('Workbook content type');
                    const rootRelations = array(parser.parse(xmls.get('_rels/.rels')).Relationships?.Relationship);
                    if (!rootRelations.some(r => r['@_Type']?.endsWith('/officeDocument') && r['@_Target']?.replace(/^\//, '') === 'xl/workbook.xml'))
                        throw new Error('Workbook relationship');
                    const workbook = parser.parse(xmls.get('xl/workbook.xml')).workbook;
                    const sheets = array(workbook?.sheets?.sheet);
                    if (!sheets.length)
                        throw new Error('No sheets');
                    const relationships = array(parser.parse(xmls.get('xl/_rels/workbook.xml.rels')).Relationships?.Relationship);
                    for (const sheet of sheets) {
                        const rel = relationships.find(r => r['@_Id'] === sheet['@_id'] && r['@_Type']?.endsWith('/worksheet'));
                        if (!rel || typeof rel['@_Target'] !== 'string')
                            throw new Error('Missing sheet relationship');
                        const name = rel['@_Target'].startsWith('/') ? rel['@_Target'].slice(1) : node_path_1.posix.normalize(`xl/${rel['@_Target']}`);
                        if (!xmls.has(name) || !parser.parse(xmls.get(name)).worksheet || !types.some(t => t['@_PartName'] === `/${name}` && t['@_ContentType'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'))
                            throw new Error('Missing worksheet');
                    }
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            });
            zip.readEntry();
        });
    });
}
async function validatePortalFile(group, file) {
    const ext = file && (0, node_path_1.extname)(file.originalname).toLowerCase();
    const allowed = group === 'B' || group === 'F' ? ['.pdf', '.xlsx'] : group === 'E' ? ['.pdf', '.jpg', '.jpeg', '.png'] : ['.pdf'];
    if (!exports.groups.includes(group) || !file?.buffer || !allowed.includes(ext) || !file.size || file.size !== file.buffer.length || file.size > 10 * 1024 * 1024)
        throw new common_1.BadRequestException('Nhóm hoặc loại tệp không hợp lệ; dung lượng tối đa 10 MB.');
    try {
        if (ext === '.pdf') {
            if (!file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) || !file.buffer.subarray(-2048).includes(Buffer.from('%%EOF')))
                throw new Error('PDF signature');
            const pdf = await pdf_lib_1.PDFDocument.load(file.buffer, { ignoreEncryption: false });
            if (!pdf.getPageCount())
                throw new Error('Empty PDF');
        }
        else if (ext === '.xlsx') {
            await validateWorkbook(file.buffer);
        }
        else if (ext === '.png') {
            if (file.buffer.readUInt32BE(16) * file.buffer.readUInt32BE(20) > 20000000)
                throw new Error('Image too large');
            pngjs_1.PNG.sync.read(file.buffer, { checkCRC: true });
        }
        else {
            jpeg.decode(file.buffer, { maxResolutionInMP: 20, maxMemoryUsageInMB: 100, tolerantDecoding: false });
        }
    }
    catch {
        throw new common_1.BadRequestException('Tệp bị hỏng hoặc nội dung không khớp định dạng.');
    }
    return { fileName: (0, node_path_1.basename)(file.originalname.replace(/\\/g, '/')).slice(0, 255), mimeType: ext === '.pdf' ? 'application/pdf' : ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : ext === '.png' ? 'image/png' : 'image/jpeg' };
}
//# sourceMappingURL=portal.validation.js.map