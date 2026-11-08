const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPredictPayload,businessScopeOf,riskLevelOf}=require('../dist/modules/prediction/prediction-features');

const base={stage:'TIEP_NHAN',applicationCode:'HS-1',slaHours:80,elapsedHours:12.345,hoursSinceLastEvent:3,proposedAmountVnd:2.5e9,loanTermMonths:12,establishedYear:2020,annualRevenueVnd:15e9,
  supplementCount:2,itemsPendingReview:1,officerWorkload:0,tnBankHours:0,appraisalQueueLen:0,appraisersActive:0,clarifyRoundsSoFar:0,clarifyOpen:false,now:new Date('2026-11-06T00:00:00Z')};

test('Reception payload converts units and uses only Reception features',()=>{
  const p=buildPredictPayload({...base,portalData:{hasExistingDebt:true,businessScope:'TRADING',collateral:{mode:'NONE_REQUESTED'}}});
  assert.equal(p.proposed_amount_billion,2.5);assert.equal(p.annual_revenue_billion,15);assert.equal(p.established_years,6);assert.equal(p.elapsed_hours,12.35);
  assert.equal(p.has_existing_debt,1);assert.equal(p.business_scope,'THUONG_MAI');assert.equal(p.collateral_mode,'NONE_REQUESTED');
  assert.equal(p.supplement_rounds_so_far,2);assert.equal(p.officer_workload,1);assert.equal(p.items_pending_review,1);
  assert.equal('tn_bank_hours' in p,false);
});
test('Appraisal payload carries queue and clarification features and not Reception-only ones',()=>{
  const p=buildPredictPayload({...base,stage:'THAM_DINH',slaHours:40,tnBankHours:30,appraisalQueueLen:5,appraisersActive:0,clarifyRoundsSoFar:1,clarifyOpen:true});
  assert.equal(p.supplement_rounds_total,2);assert.equal(p.tn_bank_hours,30);assert.equal(p.appraisal_queue_len,5);assert.equal(p.appraisers_active,1);assert.equal(p.clarify_open,1);
  assert.equal('officer_workload' in p,false);
});
test('Missing portal data falls back to safe defaults; industry infers scope for old loans',()=>{
  const p=buildPredictPayload({...base,portalData:null,industry:'Vận tải kho bãi'});
  assert.equal(p.has_existing_debt,0);assert.equal(p.collateral_mode,'UNDECIDED');assert.equal(p.business_scope,'DICH_VU');
  assert.equal(businessScopeOf('MANUFACTURING'),'SAN_XUAT');assert.equal(businessScopeOf(undefined,undefined),'THUONG_MAI');
});
test('alert level maps onto the stored risk level',()=>{
  assert.equal(riskLevelOf('QUA_HAN'),'CAO');assert.equal(riskLevelOf('KHAN'),'CAO');assert.equal(riskLevelOf('CHU_Y'),'TRUNG_BINH');assert.equal(riskLevelOf('BINH_THUONG'),'THAP');
});
