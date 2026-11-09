const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PredictionService}=require('../dist/modules/prediction/prediction.service');

// Bộ đánh giá tối thiểu cho đúng dạng điều kiện mà PredictionService dùng khi đếm Thẩm quyền.
const hasRole=(user,code)=>user.roles.includes(code);
const matches=(user,where)=>{
  if(where.isActive!==undefined&&user.isActive!==where.isActive)return false;
  if(where.NOT?.username?.startsWith&&user.username.startsWith(where.NOT.username.startsWith))return false;
  for(const clause of where.AND??[]){
    const roles=clause.roles;
    if(roles.some&&!hasRole(user,roles.some.role.code))return false;
    if(roles.none&&hasRole(user,roles.none.role.code))return false;
  }
  return true;
};
const count=async(users,stageLoan={})=>{
  const prisma={
    user:{count:async({where})=>users.filter(u=>matches(u,where)).length},
    loanApplication:{count:async()=>3},
    appraisalReportEvent:{count:async()=>0},
  };
  const service=new PredictionService(prisma);
  const loan={officialAmount:null,proposedAmount:1e9,loanTermMonths:12,company:{establishedYear:2018,annualRevenue:5e9},portalRequest:null,supplementCount:0,currentStatus:'PENDING_APPRAISAL',stageHistories:[],...stageLoan};
  return (await service.collectInputs(loan,'THAM_DINH')).appraisersActive;
};
const u=(username,roles,isActive=true)=>({username,roles,isActive});
const base=[u('test_tham_quyen',['THAM_QUYEN']),u('ha.le',['THAM_QUYEN']),u('huy.vu',['THAM_QUYEN']),u('lan.dang',['THAM_QUYEN'],false),u('dat.nguyen',['CBTD','THAM_QUYEN'])];

test('only dedicated, active, non-test appraisers are counted (5 accounts in the DB, 2 real people)',async()=>{
  assert.equal(await count(base),2);
});
test('adding demo or test appraiser accounts, or a dual-role one, does not change the count',async()=>{
  const more=[...base,u('test_quan_ly_tq',['THAM_QUYEN']),u('test_tq2',['THAM_QUYEN']),u('kiem.nhiem',['CBTD','THAM_QUYEN'])];
  assert.equal(await count(more),2);
});
test('locking a real appraiser lowers the count and the count never drops below 1',async()=>{
  assert.equal(await count(base.map(x=>x.username==='huy.vu'?{...x,isActive:false}:x)),1);
  assert.equal(await count(base.map(x=>({...x,isActive:false}))),1);
});
