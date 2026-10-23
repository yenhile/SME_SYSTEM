const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
test('notification list and unread count are always scoped to signed-in staff',async()=>{
  const {NotificationsService}=require('../dist/modules/notifications/notifications.service');
  const queries=[];
  const prisma={internalNotification:{findMany:async query=>{queries.push(query);return[{id:'mine'}];},count:async query=>{queries.push(query);return 2;}}};
  assert.deepEqual(await new NotificationsService(prisma).list('staff'),{items:[{id:'mine'}],unreadCount:2});
  assert.equal(queries[0].where.userId,'staff');assert.deepEqual(queries[1].where,{userId:'staff',readAt:null});
});
test('mark read hides other recipients and keeps original read timestamp on retry',async()=>{
  const {NotificationsService}=require('../dist/modules/notifications/notifications.service');
  const row={id:'mine',userId:'staff',readAt:null};let changes=0;
  const prisma={internalNotification:{updateMany:async({where,data})=>{if(where.id===row.id && where.userId===row.userId && !row.readAt){Object.assign(row,data);changes++;}return{count:changes};},findFirst:async({where})=>where.id===row.id && where.userId===row.userId?row:null}};
  const service=new NotificationsService(prisma);
  await assert.rejects(service.read('mine','other'),e=>e.getStatus()===404);
  assert.equal(row.readAt,null);
  const first=await service.read('mine','staff');const stamp=first.readAt;
  await service.read('mine','staff');assert.equal(changes,1);assert.equal(row.readAt,stamp);
});

test('internal JWT principal validation rejects portal token markers',async()=>{
  const {JwtStrategy}=require('../dist/modules/auth/jwt.strategy');
  const strategy=new JwtStrategy({user:{findUnique:async()=>{throw Error('Portal principal must never query staff');}}});
  for(const payload of [{sub:'portal',type:'portal'},{sub:'portal',aud:'sme-enterprise-portal'},{sub:'portal',iss:'sme-enterprise-portal'}]) await assert.rejects(strategy.validate({headers:{}},payload),e=>e.getStatus()===401);
});
