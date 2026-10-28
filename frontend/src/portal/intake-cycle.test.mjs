import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=new URL('./intake-cycle.ts',import.meta.url);
const api=fs.existsSync(source)?await import(source):{};
test('returned approved draft can edit, submitted and legacy returned cannot',()=>{assert.equal(typeof api.canEditCycle,'function');const config={previewEnabled:true,intakeCycleEnabled:true,checklistVersion:'preview'};assert.equal(api.canEditCycle({formVersion:2,status:'RETURNED',checklistVersion:'approved'},config),true);assert.equal(api.canEditCycle({formVersion:1,status:'RETURNED'},config),false);assert.equal(api.canEditCycle({formVersion:2,status:'ASSIGNED'},config),false);});
test('send requires fresh server readiness and no unsaved or queued work',()=>{assert.equal(typeof api.canSendCycle,'function');const input={enabled:true,editable:true,dirty:false,busy:false,conflict:false,pendingFiles:0,dataReady:true,assessmentRevision:5,revision:5};assert.equal(api.canSendCycle(input),true);for(const change of [{dirty:true},{pendingFiles:1},{dataReady:false},{assessmentRevision:4},{busy:true},{conflict:true}])assert.equal(api.canSendCycle({...input,...change}),false);});
