const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {reminderAt,overdueAt}=require('../dist/modules/supplements/supplement-deadlines');
const {SupplementRemindersService}=require('../dist/modules/supplements/supplement-reminders.service');
const {NotificationsService}=require('../dist/modules/notifications/notifications.service');

const iso=d=>d&&d.toISOString();

// Mốc tính theo ngày lịch, múi giờ Asia/Ho_Chi_Minh (UTC+7); mốc rơi vào thứ Bảy/Chủ nhật lùi sang thứ Hai.
test('day 5 and day 10 are calendar days from the request time',()=>{
  const requestedAt=new Date('2026-10-20T03:00:00Z'); // Tue 20/10 10:00 VN
  assert.equal(iso(reminderAt(requestedAt)),'2026-10-26T03:00:00.000Z'); // Sun 25 -> Mon 26
  assert.equal(iso(overdueAt(requestedAt)),'2026-10-30T03:00:00.000Z'); // Fri 30
});
test('a milestone on Saturday or Sunday moves to the next Monday, same time of day',()=>{
  const monday=new Date('2026-10-19T03:00:00Z');
  assert.equal(iso(reminderAt(monday)),'2026-10-26T03:00:00.000Z'); // Sat 24 -> Mon 26
  assert.equal(iso(overdueAt(monday)),'2026-10-29T03:00:00.000Z'); // Thu 29, no change
  const wednesday=new Date('2026-10-21T03:00:00Z');
  assert.equal(iso(reminderAt(wednesday)),'2026-10-26T03:00:00.000Z'); // Mon 26, no change
  assert.equal(iso(overdueAt(wednesday)),'2026-11-02T03:00:00.000Z'); // Sat 31 -> Mon 2/11
});
test('weekday is judged in Vietnam time, not UTC',()=>{
  // 20/10 00:30 VN = 19/10 17:30 UTC. +5 days = Sun 25/10 00:30 VN (= Sat 24/10 17:30 UTC) -> Mon 26/10 00:30 VN
  const requestedAt=new Date('2026-10-19T17:30:00Z');
  assert.equal(iso(reminderAt(requestedAt)),'2026-10-25T17:30:00.000Z');
});
test('an explicit deadline is used as the overdue time without moving it',()=>{
  const requestedAt=new Date('2026-10-20T03:00:00Z');
  const saturday=new Date('2026-10-24T05:00:00Z');
  assert.equal(iso(overdueAt(requestedAt,saturday)),iso(saturday));
});
test('reminder is skipped when the explicit deadline comes before day 5',()=>{
  const requestedAt=new Date('2026-10-20T03:00:00Z');
  assert.equal(reminderAt(requestedAt,new Date('2026-10-22T03:00:00Z')),null);
  assert.equal(iso(reminderAt(requestedAt,new Date('2026-11-20T03:00:00Z'))),'2026-10-26T03:00:00.000Z');
});

const requestedAt=new Date('2026-10-20T03:00:00Z');
const row=(over={})=>({id:'s1',applicationId:'loan1',requestedAt,deadlineAt:null,reminderSentAt:null,reminderEmailSentAt:null,overdueAt:null,
  application:{id:'loan1',applicationCode:'HS-001',assignedTo:'cbtd',portalRequest:{account:{email:'dn@example.test'}}},...over});
function fixture(rows,{mailFails=false}={}) {
  const state={rows,notices:[],emails:[],queries:[],updates:[],claimsLost:false};
  const prisma={
    $transaction:async fn=>fn(prisma),
    supplementRequest:{
      findMany:async args=>{state.queries.push(args);return state.rows;},
      updateMany:async({where,data})=>{
        const r=state.rows.find(x=>x.id===where.id);
        const [field]=Object.keys(where).filter(k=>k!=='id');
        if(state.claimsLost||!r||r[field]!==null) return {count:0};
        Object.assign(r,data);state.updates.push(data);return {count:1};
      },
      update:async()=>{throw new Error('supplement status must not be changed');},
    },
    loanApplication:{update:async()=>{throw new Error('loan must not be changed');},updateMany:async()=>{throw new Error('loan must not be changed');}},
    internalNotification:{create:async({data})=>{state.notices.push(data);return data;}},
  };
  const mailer={sendSupplementReminder:async(email,code)=>{if(mailFails) throw new Error('smtp down');state.emails.push({email,code});}};
  return {state,service:new SupplementRemindersService(prisma,mailer)};
}
const at=iso=>new Date(iso);

test('scan only reads pending requests of loans waiting for supplement',async()=>{
  const {state,service}=fixture([]);
  await service.scan(at('2026-10-26T04:00:00Z'));
  const where=state.queries[0].where;
  assert.equal(where.status,'PENDING');
  assert.equal(where.application.currentStatus,'SUPPLEMENT_REQUIRED');
  assert.equal(where.application.completedAt,null);
});
test('nothing happens before day 5',async()=>{
  const {state,service}=fixture([row()]);
  const result=await service.scan(at('2026-10-25T04:00:00Z'));
  assert.deepEqual(result,{reminded:0,overdue:0});
  assert.equal(state.notices.length,0);assert.equal(state.emails.length,0);
});
test('day 5 notifies the CBTD and emails the enterprise exactly once',async()=>{
  const {state,service}=fixture([row()]);
  const result=await service.scan(at('2026-10-26T04:00:00Z'));
  assert.deepEqual(result,{reminded:1,overdue:0});
  assert.equal(state.notices.length,1);
  assert.equal(state.notices[0].userId,'cbtd');assert.equal(state.notices[0].applicationId,'loan1');
  assert.equal(state.notices[0].requestId,undefined);
  assert.deepEqual(state.emails,[{email:'dn@example.test',code:'HS-001'}]);
  assert.ok(state.rows[0].reminderSentAt&&state.rows[0].reminderEmailSentAt);
  await service.scan(at('2026-10-26T05:00:00Z'));
  assert.equal(state.notices.length,1);assert.equal(state.emails.length,1);
});
test('email retry on the next scan does not notify the CBTD twice',async()=>{
  const state={notices:[],emails:[],fail:true};
  const r=row();
  const prisma={$transaction:async fn=>fn(prisma),
    supplementRequest:{findMany:async()=>[r],updateMany:async({where,data})=>{const [f]=Object.keys(where).filter(k=>k!=='id');if(r[f]!==null) return{count:0};Object.assign(r,data);return{count:1};}},
    internalNotification:{create:async({data})=>{state.notices.push(data);}}};
  const service=new SupplementRemindersService(prisma,{sendSupplementReminder:async e=>{if(state.fail) throw new Error('smtp down');state.emails.push(e);}});
  await service.scan(at('2026-10-26T04:00:00Z'));
  assert.equal(state.notices.length,1);assert.equal(r.reminderEmailSentAt,null);
  state.fail=false;
  await service.scan(at('2026-10-26T05:00:00Z'));
  assert.equal(state.notices.length,1);assert.deepEqual(state.emails,['dn@example.test']);assert.ok(r.reminderEmailSentAt);
});
test('loan without a portal account gets the in-app notice only',async()=>{
  const {state,service}=fixture([row({application:{id:'loan1',applicationCode:'HS-001',assignedTo:'cbtd',portalRequest:null}})]);
  await service.scan(at('2026-10-26T04:00:00Z'));
  assert.equal(state.notices.length,1);assert.equal(state.emails.length,0);
});
test('day 10 marks overdue and notifies the CBTD, without closing or changing anything else',async()=>{
  const {state,service}=fixture([row({reminderSentAt:at('2026-10-26T04:00:00Z'),reminderEmailSentAt:at('2026-10-26T04:00:00Z')})]);
  const result=await service.scan(at('2026-10-30T04:00:00Z'));
  assert.deepEqual(result,{reminded:0,overdue:1});
  assert.ok(state.rows[0].overdueAt);
  assert.equal(state.notices.length,1);assert.equal(state.notices[0].applicationId,'loan1');
  await service.scan(at('2026-10-30T05:00:00Z'));
  assert.equal(state.notices.length,1);
});
test('when day 10 is already reached the reminder is skipped, only overdue is raised',async()=>{
  const {state,service}=fixture([row()]);
  const result=await service.scan(at('2026-11-05T04:00:00Z'));
  assert.deepEqual(result,{reminded:0,overdue:1});
  assert.equal(state.emails.length,0);assert.equal(state.notices.length,1);
});
test('overdue is still marked when the loan has no assigned officer',async()=>{
  const {state,service}=fixture([row({application:{id:'loan1',applicationCode:'HS-001',assignedTo:null,portalRequest:null}})]);
  await service.scan(at('2026-10-30T04:00:00Z'));
  assert.ok(state.rows[0].overdueAt);assert.equal(state.notices.length,0);
});
test('losing the claim to a concurrent scan sends nothing',async()=>{
  const {state,service}=fixture([row()]);
  state.claimsLost=true;
  const result=await service.scan(at('2026-10-26T04:00:00Z'));
  assert.deepEqual(result,{reminded:0,overdue:0});
  assert.equal(state.notices.length,0);assert.equal(state.emails.length,0);
});
test('one failing request does not stop the others',async()=>{
  const bad=row({id:'bad'}),good=row({id:'good',applicationId:'loan2',application:{id:'loan2',applicationCode:'HS-002',assignedTo:'cbtd',portalRequest:null}});
  const state={notices:[]};
  const prisma={$transaction:async fn=>fn(prisma),
    supplementRequest:{findMany:async()=>[bad,good],updateMany:async({where,data})=>{const r=[bad,good].find(x=>x.id===where.id);const [f]=Object.keys(where).filter(k=>k!=='id');if(r[f]!==null) return{count:0};Object.assign(r,data);return{count:1};}},
    internalNotification:{create:async({data})=>{if(data.applicationId==='loan1') throw new Error('db error');state.notices.push(data);}}};
  const result=await new SupplementRemindersService(prisma,{sendSupplementReminder:async()=>{}}).scan(at('2026-10-26T04:00:00Z'));
  assert.equal(state.notices.length,1);assert.equal(result.reminded,1);
});

test('notification list exposes applicationId next to requestId',async()=>{
  let select;
  const prisma={internalNotification:{findMany:async q=>{select=q.select;return[];},count:async()=>0}};
  await new NotificationsService(prisma).list('staff');
  assert.equal(select.applicationId,true);assert.equal(select.requestId,true);
});
