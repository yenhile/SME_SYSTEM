const {test}=require('node:test');
const assert=require('node:assert/strict');
const {currentStagePrediction,PREDICTION_UNAVAILABLE_MESSAGES}=require('../dist/modules/prediction/prediction-status');

const open={enteredAt:new Date('2026-11-05T02:00:00Z')};
const pred=(over={})=>({modelVersion:'v4.0-THAM_DINH',predictionTimestamp:new Date('2026-11-05T03:00:00Z'),riskLevel:'CAO',...over});

test('a v4 prediction made in the current stage after entering it is used',()=>{
  assert.equal(currentStagePrediction([pred()],'THAM_DINH',open).riskLevel,'CAO');
});
test('a prediction from an older model version is ignored (SME-2: v1 "Khan 84%")',()=>{
  assert.equal(currentStagePrediction([pred({modelVersion:'v1.0'})],'THAM_DINH',open),null);
});
test('a prediction made for the previous stage is ignored after the loan moves on',()=>{
  assert.equal(currentStagePrediction([pred({modelVersion:'v4.0-TIEP_NHAN'})],'THAM_DINH',open),null);
});
test('a prediction made before the loan entered the current stage is ignored',()=>{
  assert.equal(currentStagePrediction([pred({predictionTimestamp:new Date('2026-11-05T01:59:00Z')})],'THAM_DINH',open),null);
});
test('no open stage or no prediction gives no warning',()=>{
  assert.equal(currentStagePrediction([pred()],'THAM_DINH',null),null);
  assert.equal(currentStagePrediction([],'THAM_DINH',open),null);
  assert.equal(currentStagePrediction(undefined,'THAM_DINH',open),null);
});
test('an in-progress loan without stage history is not described as finished',()=>{
  assert.match(PREDICTION_UNAVAILABLE_MESSAGES.NO_STAGE_HISTORY,/đang xử lý/);
  assert.match(PREDICTION_UNAVAILABLE_MESSAGES.NO_ACTIVE_STAGE,/hoàn tất/);
});
