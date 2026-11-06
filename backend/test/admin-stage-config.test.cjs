const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {ParseEnumPipe,BadRequestException}=require('@nestjs/common');
const {StageCode,LoanStatus}=require('@prisma/client');
const {AdminController}=require('../dist/admin.controller');
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

test('Admin sửa được định mức công đoạn đang dùng',async()=>{
  const calls=[];
  const controller=new AdminController({workflowStage:{update:async args=>{calls.push(args);return args.data;}}});
  await controller.updateStage('THAM_DINH',body);
  assert.deepEqual(calls,[{where:{stageCode:'THAM_DINH'},data:body}]);
});

test('Theo dõi ở Portal vẫn đủ bốn bước khi hồ sơ qua Thẩm định rồi được duyệt',()=>{
  const request={id:'r',reference:'R',status:'ACCEPTED'};
  const states=loan=>buildTracking(request,loan).steps.map(step=>step.state).join(',');
  assert.equal(states({currentStage:'THAM_DINH',currentStatus:'PENDING_APPRAISAL'}),'done,current,pending,pending');
  assert.equal(states({currentStage:'HOAN_TAT',currentStatus:'APPROVED',completedAt:new Date()}),'done,done,done,done');
});
