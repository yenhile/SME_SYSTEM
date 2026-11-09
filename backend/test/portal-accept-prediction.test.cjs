const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PortalIntakesController}=require('../dist/modules/portal/portal.controller');

const make=(predict)=>{
  const calls=[];
  const service={accept:async(...args)=>{calls.push(args);return{loanId:'loan-1',request:{}};}};
  const prediction={predictForApplication:async id=>{calls.push(['predict',id]);return predict(id);}};
  return{calls,controller:new PortalIntakesController(service,prediction)};
};
const req={user:{id:'officer'}};

test('a loan accepted from the portal is scored straight away',async()=>{
  const {controller,calls}=make(async()=>({}));
  const result=await controller.accept(req,'request-1',{});
  assert.equal(result.loanId,'loan-1');
  assert.deepEqual(calls.at(-1),['predict','loan-1']);
});
test('a failing prediction does not undo or fail the acceptance',async()=>{
  const {controller}=make(async()=>{throw new Error('ML tắt');});
  const result=await controller.accept(req,'request-1',{});
  assert.equal(result.loanId,'loan-1');
});
