/* Dọn dữ liệu thử nghiệm do `seed:portal-flow` và các lần thử tay tạo ra, để hệ thống sạch và dễ kiểm thử.
 *   npm run cleanup:test            xem trước (chạy thật trong transaction rồi hoàn tác, không giữ thay đổi nào)
 *   npm run cleanup:test -- --apply thực hiện xóa
 *
 * Xóa: tài khoản cổng doanh nghiệp có email mo.phong.* hoặc dn.e2e.* (kèm đề nghị, tài liệu, lịch sử của chúng), mọi công ty có tên bắt đầu
 * "[MÔ PHỎNG]" cùng hồ sơ vay, dự báo, tờ trình gắn với chúng. KHÔNG đụng: bộ demo (`seed:demo`, mã số thuế DEMO*), tài khoản cán bộ,
 * công ty mẫu của prisma:seed và mọi tài khoản cổng khác. Xóa theo sơ đồ khóa ngoại thật trong DB (dòng con trước, dòng cha sau).
 * Không chạy khi NODE_ENV=production. Nên sao lưu DB trước khi dùng --apply.
 * Tệp tải lên mồ côi và thư trong hộp thư nội bộ không thuộc phạm vi script này (xem docs/SME_KY_THUAT.md).
 */
const { PrismaClient } = require('@prisma/client');
if (process.env.NODE_ENV === 'production') { console.error('Không chạy trên production.'); process.exit(1); }
const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();
const ROLLBACK = new Error('ROLLBACK_PREVIEW');

const FUNCTION_SQL = `
CREATE FUNCTION pg_temp.del_rows(tbl text, ids text[]) RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE r record; child_ids text[]; has_id boolean; total bigint := 0; fresh text[];
BEGIN
  SELECT coalesce(array_agg(x), '{}') INTO fresh FROM unnest(ids) x WHERE NOT EXISTS (SELECT 1 FROM del_seen s WHERE s.tbl = del_rows.tbl AND s.id = x);
  IF array_length(fresh, 1) IS NULL THEN RETURN 0; END IF;
  INSERT INTO del_seen SELECT tbl, unnest(fresh) ON CONFLICT DO NOTHING;
  FOR r IN SELECT conrelid::regclass::text AS child, a.attname AS col
           FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
           WHERE c.contype = 'f' AND c.confrelid = tbl::regclass LOOP
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.child AND column_name = 'id') INTO has_id;
    IF has_id THEN
      EXECUTE format('SELECT coalesce(array_agg(id::text), ''{}'') FROM %s WHERE %I::text = ANY($1)', r.child, r.col) INTO child_ids USING fresh;
      IF array_length(child_ids, 1) IS NOT NULL THEN total := total + pg_temp.del_rows(r.child, child_ids); END IF;
    ELSE
      EXECUTE format('DELETE FROM %s WHERE %I::text = ANY($1)', r.child, r.col) USING fresh;
    END IF;
  END LOOP;
  EXECUTE format('DELETE FROM %s WHERE id::text = ANY($1)', tbl) USING fresh;
  RETURN total + array_length(fresh, 1);
END $f$;`;

const counts = async (tx) => (await tx.$queryRawUnsafe(`SELECT
  (SELECT count(*)::int FROM portal_accounts WHERE email LIKE 'mo.phong.%' OR email LIKE 'dn.e2e.%') AS portal_accounts_test,
  (SELECT count(*)::int FROM companies WHERE company_name LIKE '[MÔ PHỎNG]%') AS companies_test,
  (SELECT count(*)::int FROM portal_accounts) AS portal_accounts,
  (SELECT count(*)::int FROM portal_requests) AS portal_requests,
  (SELECT count(*)::int FROM loan_applications) AS loans,
  (SELECT count(*)::int FROM companies) AS companies,
  (SELECT count(*)::int FROM delay_predictions) AS predictions`))[0];

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const before = await counts(tx);
      console.log('Trước:', JSON.stringify(before));
      console.log(`Sẽ dọn: ${before.portal_accounts_test} tài khoản cổng thử nghiệm và ${before.companies_test} công ty "[MÔ PHỎNG]" (kèm dữ liệu gắn với chúng).`);
      await tx.$executeRawUnsafe('CREATE TEMP TABLE del_seen(tbl text, id text, PRIMARY KEY (tbl, id)) ON COMMIT DROP');
      await tx.$executeRawUnsafe(FUNCTION_SQL);
      const del = async (table, where) => {
        const [{ n }] = await tx.$queryRawUnsafe(`SELECT pg_temp.del_rows('${table}', (SELECT array_agg(id::text) FROM ${where})) AS n`);
        return Number(n ?? 0);
      };
      const a = await del('portal_accounts', "portal_accounts WHERE email LIKE 'mo.phong.%' OR email LIKE 'dn.e2e.%'");
      const l = await del('loan_applications', "loan_applications WHERE company_id IN (SELECT id FROM companies WHERE company_name LIKE '[MÔ PHỎNG]%')");
      const c = await del('companies', "companies WHERE company_name LIKE '[MÔ PHỎNG]%'");
      const after = await counts(tx);
      console.log(`Đã xóa (kể cả dòng con): từ tài khoản ${a}, từ hồ sơ vay ${l}, từ công ty ${c}`);
      console.log('Sau:   ', JSON.stringify(after));
      if (!apply) throw ROLLBACK;
    }, { timeout: 120000 });
    console.log('\nĐã áp dụng.');
  } catch (e) {
    if (e === ROLLBACK || (e && e.message && e.message.includes('ROLLBACK_PREVIEW'))) console.log('\nChỉ xem trước, đã hoàn tác (chưa xóa gì). Thêm --apply để thực hiện.');
    else { console.error('Lỗi, đã hoàn tác:', e.message || e); process.exitCode = 1; }
  } finally { await prisma.$disconnect(); }
}
main();
