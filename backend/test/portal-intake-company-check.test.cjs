const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PortalService}=require('../dist/modules/portal/portal.service');

test('staff intake list flags a tax code that already belongs to a differently named enterprise, in one query',async()=>{
  const calls=[];
  const rows=[
    {id:'a',status:'ASSIGNED',formVersion:1,data:{taxCode:'0300588569',companyName:'Công ty Minh Phát'}},
    {id:'b',status:'SUBMITTED',formVersion:1,data:{taxCode:'0101248141',companyName:'  CÔNG TY FPT '}},
    {id:'c',status:'SUBMITTED',formVersion:1,data:{taxCode:'0319876546',companyName:'Mới'}},
    {id:'d',status:'ACCEPTED',formVersion:1,data:{taxCode:'0300588569',companyName:'x'}},
  ];
  const prisma={
    portalRequest:{findMany:async()=>rows},
    assignmentChangeRequest:{findMany:async()=>[]},
    loanApplication:{findUnique:async()=>null},
    company:{findMany:async args=>{calls.push(args);return[{taxCode:'0300588569',companyName:'Công ty Nông Sản Xanh'},{taxCode:'0101248141',companyName:'Công ty FPT'}];}},
  };
  const service=Object.create(PortalService.prototype);service.prisma=prisma;
  const out=await service.list(undefined,{id:'mgr',roles:['QUAN_LY']});
  assert.equal(calls.length,1);assert.deepEqual(calls[0].where.taxCode.in.sort(),['0101248141','0300588569','0319876546']);
  assert.deepEqual(out.map(r=>r.companyCheck),[{status:'NAME_MISMATCH',companyName:'Công ty Nông Sản Xanh'},{status:'EXISTING'},{status:'NEW'},undefined]);
});

test('enterprise list never carries the staff company hint',async()=>{
  const service=Object.create(PortalService.prototype);service.prisma={portalRequest:{findMany:async()=>[{id:'a',status:'SUBMITTED',data:{taxCode:'0300588569'}}]},company:{findMany:async()=>{throw new Error('must not query');}}};
  const out=await service.list('acc-1');assert.equal(out[0].companyCheck,undefined);
});
