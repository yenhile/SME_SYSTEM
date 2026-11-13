const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {ParseEnumPipe,BadRequestException}=require('@nestjs/common');
const {StageCode,LoanStatus}=require('@prisma/client');
const {AdminService}=require('../dist/admin.service');
const {buildTracking}=require('../dist/modules/portal/portal.tracking');

const body={stageName:'Tên công đoạn',standardSlaHours:40};

test('Quy trình chỉ có ba công đoạn và không có trạng thái chờ Cấp trên',()=>{
  assert.deepEqual(Object.keys(StageCode),['TIEP_NHAN','THAM_DINH','HOAN_TAT']);
  assert.ok(!('WAITING_HEAD_OFFICE' in LoanStatus));
});

test('Mã công đoạn Cấp trên bị từ chối khi sửa định mức',async()=>{
  const pipe=new ParseEnumPipe(StageCode);
  await assert.rejects(pipe.transform('CAP_TREN',{type:'param',data:'code'}),BadRequestException);
  assert.equal(await pipe.transform('THAM_DINH',{type:'param',data:'code'}),'THAM_DINH');
});

test('Admin chỉ sửa định mức giờ, tên công đoạn giữ nguyên dù request gửi kèm',async()=>{
  const calls=[];
  const tx={
    workflowStage:{findUnique:async()=>({stageCode:'THAM_DINH',stageName:'Thẩm định',standardSlaHours:32}),update:async args=>{calls.push(args);return args.data;}},
    user:{findUnique:async()=>({username:'admin',fullName:'Admin'})},
    adminAuditLog:{createMany:async({data})=>({count:data.length})},
  };
  const service=new AdminService({...tx,$transaction:async fn=>fn(tx)});
  await service.updateStageSla('THAM_DINH',body,'admin-1');
  assert.deepEqual(calls,[{where:{stageCode:'THAM_DINH'},data:{standardSlaHours:40}}]);
});

test('Hoàn tất không có định mức để sửa',async()=>{
  const service=new AdminService({workflowStage:{update:async()=>assert.fail('không được ghi')}});
  await assert.rejects(service.updateStageSla('HOAN_TAT',body),BadRequestException);
});

test('Danh mục vai trò chỉ xem kèm số tài khoản đang hoạt động',async()=>{
  const service=new AdminService({role:{findMany:async()=>[
    {code:'ADMIN',name:'Quản trị viên hệ thống',description:'Mô tả',users:[{user:{isActive:true}}]},
    {code:'CBTD',name:'Cán bộ tín dụng',description:null,users:[{user:{isActive:true}},{user:{isActive:false}}]},
  ]}});
  assert.deepEqual(await service.roles(),[
    {code:'ADMIN',name:'Quản trị viên hệ thống',description:'Mô tả',activeUsers:1,totalUsers:1},
    {code:'CBTD',name:'Cán bộ tín dụng',description:null,activeUsers:1,totalUsers:2},
  ]);
});

test('Tổng quan SLA: số hồ sơ đang mở theo công đoạn và dải định mức của mô hình dự báo',async()=>{
  const calls=[];
  const prisma={loanApplication:{groupBy:async args=>{calls.push(args);return [{currentStage:'TIEP_NHAN',_count:{_all:7}},{currentStage:'THAM_DINH',_count:{_all:3}}];}}};
  const original=global.fetch;
  global.fetch=async url=>{assert.match(String(url),/\/metadata$/);return {ok:true,json:async()=>({thresholds:{watch:0.35,urgent:0.6},sla_grid_hours:{TIEP_NHAN:[24,40,128],THAM_DINH:[16,80,40]}})};};
  try {
    const view=await new AdminService(prisma).slaOverview();
    assert.deepEqual(calls,[{by:['currentStage'],where:{completedAt:null},_count:{_all:true}}]);
    assert.deepEqual(view.openLoans,{TIEP_NHAN:7,THAM_DINH:3});
    assert.deepEqual(view,{openLoans:{TIEP_NHAN:7,THAM_DINH:3},prediction:{slaRangeHours:{TIEP_NHAN:[24,128],THAM_DINH:[16,80]}}});
    global.fetch=async()=>{throw new Error('ML tắt');};
    assert.equal((await new AdminService(prisma).slaOverview()).prediction,null);
  } finally { global.fetch=original; }
});

test('Theo dõi ở Portal vẫn đủ bốn bước khi hồ sơ qua Thẩm định rồi được duyệt',()=>{
  const request={id:'r',reference:'R',status:'ACCEPTED'};
  const states=loan=>buildTracking(request,loan).steps.map(step=>step.state).join(',');
  assert.equal(states({currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL'}),'done,current,pending,pending');
  assert.equal(states({currentStage:'HOAN_TAT',currentStatus:'APPROVED',completedAt:new Date()}),'done,done,done,done');
});
