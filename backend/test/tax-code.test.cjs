const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {hasValidTaxCodeChecksum,assertTaxCodeChecksum}=require('../dist/common/tax-code');

test('Vietnamese tax code check digit accepts real codes and rejects typos',()=>{
  for(const code of ['0300588569','0101248141','0300588569001'])assert.equal(hasValidTaxCodeChecksum(code),true,code);
  for(const code of ['0300588568','0319876543','1234567890','0300588569000','030058856','abc'])assert.equal(hasValidTaxCodeChecksum(code),false,code);
  assert.throws(()=>assertTaxCodeChecksum('0319876543'),e=>e.getStatus()===400);
});

test('portal V2 submit checks the tax code check digit before publishing a new draft',()=>{
  const source=readFileSync(require.resolve('../src/modules/portal/portal.service.ts'),'utf8');
  assert.match(source,/if\(r\.status==='DRAFT'\) assertTaxCodeChecksum\(\(r\.data as any\)\.taxCode\);[^\n]*\n[^\n]*return this\.cycle\(\)\.publish/);
});
