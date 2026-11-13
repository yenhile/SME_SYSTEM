const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {BadRequestException}=require('@nestjs/common');
const {UsersService}=require('../dist/modules/users/users.service');
const {AdminService}=require('../dist/admin.service');
const {AdminController}=require('../dist/admin.controller');
const {ROLES_KEY}=require('../dist/common/decorators/roles.decorator');

const ADMIN={id:'admin-1',username:'khoa.tran',fullName:'Trần Khoa'};

function usersDb({target={id:'u1',username:'nam.hoang',fullName:'Hoàng Nam',phone:'0901',branchName:'CN HCM',isActive:true,roles:['CBTD']},openLoans=0}={}) {
  const logs=[],writes=[];
  const tx={
    $queryRaw:async()=>[],
    portalRequest:{count:async()=>0},
    loanApplication:{count:async()=>openLoans},
    role:{findMany:async({where})=>where.code.in.map(code=>({id:code,code}))},
    user:{
      findFirst:async()=>null,
      findUnique:async({where})=>where.id===ADMIN.id&&target.id!==ADMIN.id?{...ADMIN,roles:[{role:{code:'ADMIN'}}]}:{...target,roles:target.roles.map(code=>({role:{code}}))},
      update:async({data})=>{writes.push('user');return data;},
      create:async({data})=>({id:'new-1',...data,roles:data.roles.create.map(r=>({role:{code:r.roleId}}))}),
    },
    userRole:{deleteMany:async()=>{writes.push('roles');},createMany:async()=>{}},
    adminAuditLog:{createMany:async({data})=>{logs.push(...data);return {count:data.length};}},
  };
  const db={...tx,$transaction:async fn=>fn(tx)};
  return {logs,writes,service:new UsersService(db)};
}

test('tạo tài khoản ghi đúng một dòng, không chứa mật khẩu, kèm người làm',async()=>{
  const {logs,service}=usersDb();
  await service.create({username:'moi.cb',password:'Bi-mat-123',fullName:'Cán bộ mới',email:'moi@bank.test',phone:'0909',branchName:'CN HCM',roles:['CBTD']},ADMIN.id);
  assert.equal(logs.length,1);
  const [row]=logs;
  assert.equal(row.action,'USER_CREATED');
  assert.equal(row.actorId,ADMIN.id);
  assert.equal(row.actorUsername,ADMIN.username);
  assert.equal(row.targetType,'USER');
  assert.equal(row.targetId,'new-1');
  assert.equal(row.targetLabel,'moi.cb');
  assert.equal(row.before??null,null);
  assert.deepEqual(row.after.roles,['CBTD']);
  assert.ok(!JSON.stringify(row).includes('Bi-mat-123'));
  assert.ok(!JSON.stringify(row).toLowerCase().includes('password'));
});

test('script dựng dữ liệu tạo tài khoản không qua giao diện quản trị thì không ghi nhật ký',async()=>{
  const {logs,service}=usersDb();
  const result=await service.create({username:'demo.cb',password:'x',fullName:'Demo',email:'demo@bank.test',roles:['CBTD']});
  assert.equal(result.user.username,'demo.cb');
  assert.equal(logs.length,0);
});

test('sửa thông tin chỉ ghi các trường đã đổi',async()=>{
  const {logs,service}=usersDb();
  await service.update('u1',{fullName:'Hoàng Văn Nam',phone:'0901',branchName:'CN HCM'},ADMIN.id);
  assert.equal(logs.length,1);
  assert.equal(logs[0].action,'USER_PROFILE_UPDATED');
  assert.deepEqual(logs[0].before,{fullName:'Hoàng Nam'});
  assert.deepEqual(logs[0].after,{fullName:'Hoàng Văn Nam'});
});

test('khóa, mở khóa và đổi vai trò mỗi loại một dòng, cùng một lần lưu',async()=>{
  const lock=usersDb();
  await lock.service.update('u1',{isActive:false},ADMIN.id);
  assert.deepEqual(lock.logs.map(r=>[r.action,r.before,r.after]),[['USER_LOCKED',{isActive:true},{isActive:false}]]);

  const unlock=usersDb({target:{id:'u1',username:'nam.hoang',fullName:'Hoàng Nam',phone:null,branchName:'CN HCM',isActive:false,roles:['CBTD']}});
  await unlock.service.update('u1',{isActive:true},ADMIN.id);
  assert.deepEqual(unlock.logs.map(r=>r.action),['USER_UNLOCKED']);

  const both=usersDb();
  await both.service.update('u1',{phone:'0999',roles:['THAM_QUYEN','CBTD']},ADMIN.id);
  assert.deepEqual(both.logs.map(r=>r.action).sort(),['USER_PROFILE_UPDATED','USER_ROLES_CHANGED']);
  const roles=both.logs.find(r=>r.action==='USER_ROLES_CHANGED');
  assert.deepEqual(roles.before,{roles:['CBTD']});
  assert.deepEqual(roles.after,{roles:['CBTD','THAM_QUYEN']});
});

test('lưu không đổi gì hoặc thao tác bị từ chối thì không có dòng nhật ký',async()=>{
  const same=usersDb();
  await same.service.update('u1',{fullName:'Hoàng Nam',roles:['CBTD'],isActive:true},ADMIN.id);
  assert.equal(same.logs.length,0);

  const refused=usersDb({openLoans:2});
  await assert.rejects(refused.service.update('u1',{isActive:false},ADMIN.id),BadRequestException);
  assert.equal(refused.logs.length,0);
});

function stageDb(hours=40) {
  const logs=[],updates=[];
  const tx={
    workflowStage:{findUnique:async({where})=>({stageCode:where.stageCode,stageName:'Thẩm định',standardSlaHours:hours}),update:async args=>{updates.push(args);return {stageCode:'THAM_DINH',stageName:'Thẩm định',...args.data};}},
    user:{findUnique:async()=>ADMIN},
    adminAuditLog:{createMany:async({data})=>{logs.push(...data);return {count:data.length};}},
  };
  return {logs,updates,service:new AdminService({...tx,$transaction:async fn=>fn(tx)})};
}

test('sửa định mức SLA ghi số giờ trước và sau, tên công đoạn làm nhãn',async()=>{
  const {logs,updates,service}=stageDb(40);
  await service.updateStageSla('THAM_DINH',{standardSlaHours:56},ADMIN.id);
  assert.deepEqual(updates,[{where:{stageCode:'THAM_DINH'},data:{standardSlaHours:56}}]);
  assert.equal(logs.length,1);
  assert.equal(logs[0].action,'STAGE_SLA_UPDATED');
  assert.equal(logs[0].targetType,'WORKFLOW_STAGE');
  assert.equal(logs[0].targetId,'THAM_DINH');
  assert.equal(logs[0].targetLabel,'Thẩm định');
  assert.deepEqual([logs[0].before,logs[0].after],[{standardSlaHours:40},{standardSlaHours:56}]);

  const same=stageDb(56);
  await same.service.updateStageSla('THAM_DINH',{standardSlaHours:56},ADMIN.id);
  assert.equal(same.logs.length,0);
});

function readDb(rows=[]) {
  const calls=[];
  return {calls,service:new AdminService({adminAuditLog:{
    findMany:async args=>{calls.push(['findMany',args]);return rows;},
    count:async args=>{calls.push(['count',args]);return rows.length;},
  }})};
}

test('đọc nhật ký: lọc theo người làm, loại, khoảng ngày giờ Việt Nam, mới nhất trước, có phân trang',async()=>{
  const {calls,service}=readDb([{id:'l1'}]);
  const page=await service.auditLogs({actorId:'admin-1',action:'USER_LOCKED',from:'2026-11-01',to:'2026-11-12',page:'2',pageSize:'10'});
  assert.deepEqual(page,{items:[{id:'l1'}],total:1,page:2,pageSize:10});
  const [,args]=calls.find(c=>c[0]==='findMany');
  assert.deepEqual(args.where,{actorId:'admin-1',action:'USER_LOCKED',createdAt:{gte:new Date('2026-11-01T00:00:00+07:00'),lt:new Date('2026-11-13T00:00:00+07:00')}});
  assert.deepEqual(args.orderBy,[{createdAt:'desc'},{id:'desc'}]);
  assert.equal(args.skip,10);
  assert.equal(args.take,10);
});

test('đọc nhật ký từ chối đầu vào sai và giới hạn số dòng mỗi trang',async()=>{
  const {service}=readDb();
  for(const bad of [{action:'USER_DELETED'},{from:'12/11/2026'},{from:'2026-11-12',to:'2026-11-01'},{page:'0'},{pageSize:'500'},{actorId:''}]) {
    await assert.rejects(service.auditLogs(bad),BadRequestException,JSON.stringify(bad));
  }
});

test('API nhật ký chỉ cho Admin và chỉ có thao tác đọc',()=>{
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY,AdminController),['ADMIN']);
  const methods=Object.getOwnPropertyNames(AdminController.prototype);
  assert.ok(methods.includes('auditLogs'));
  const paths=methods.map(m=>[Reflect.getMetadata('path',AdminController.prototype[m]),Reflect.getMetadata('method',AdminController.prototype[m])]).filter(([p])=>typeof p==='string'&&p.startsWith('audit-logs'));
  assert.deepEqual(paths,[['audit-logs',0]]);
});
