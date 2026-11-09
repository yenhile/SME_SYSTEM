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

test('L9: the Watch level is not used at appraisal; it is still used at intake', () => {
  const {riskLevelOf}=require('../dist/modules/prediction/prediction-features');
  assert.equal(riskLevelOf('CHU_Y','THAM_DINH'),'THAP');
  assert.equal(riskLevelOf('CHU_Y','TIEP_NHAN'),'TRUNG_BINH');
  assert.equal(riskLevelOf('CHU_Y'),'TRUNG_BINH', 'no stage given keeps the old mapping');
  for (const stage of ['THAM_DINH','TIEP_NHAN']) { assert.equal(riskLevelOf('KHAN',stage),'CAO'); assert.equal(riskLevelOf('QUA_HAN',stage),'CAO'); assert.equal(riskLevelOf('BINH_THUONG',stage),'THAP'); }
});
test('L9: an appraisal prediction stored as Watch before the change is shown as Normal, an intake one is not touched', () => {
  const stored = (modelVersion) => [{ modelVersion, predictionTimestamp: new Date('2026-11-05T03:00:00Z'), riskLevel: 'TRUNG_BINH' }];
  assert.equal(currentStagePrediction(stored('v4.0-THAM_DINH'), 'THAM_DINH', open).riskLevel, 'THAP');
  assert.equal(currentStagePrediction(stored('v4.0-TIEP_NHAN'), 'TIEP_NHAN', open).riskLevel, 'TRUNG_BINH');
  const urgent = [{ modelVersion: 'v4.0-THAM_DINH', predictionTimestamp: new Date('2026-11-05T03:00:00Z'), riskLevel: 'CAO' }];
  assert.equal(currentStagePrediction(urgent, 'THAM_DINH', open).riskLevel, 'CAO');
});
