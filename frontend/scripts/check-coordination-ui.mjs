import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../src/components/notificationTarget.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {notificationTarget}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
test('coordination notice opens its minimal receipt before any linked case',()=>{assert.deepEqual(notificationTarget({assignmentChangeRequestId:'receipt',applicationId:'loan',requestId:'portal'}),{kind:'coordination',id:'receipt'});});
test('existing Portal and Loan notices retain their own destination',()=>{assert.deepEqual(notificationTarget({requestId:'portal'}),{kind:'intake',id:'portal'});assert.deepEqual(notificationTarget({applicationId:'loan'}),{kind:'loan',id:'loan'});});
test('plain handover notice for a former owner cannot open a case',()=>{assert.equal(notificationTarget({requestId:null,applicationId:null,assignmentChangeRequestId:null}),null);});

const {createRequire}=await import('node:module');
const React=(await import('react')).default;
const {renderToStaticMarkup}=await import('react-dom/server');
const requireCjs=createRequire(import.meta.url);
async function loadCjs(path,stubs={}){
  const code=await fs.readFile(new URL(path,import.meta.url),'utf8');
  const out=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',out)(id=>stubs[id]??requireCjs(id),module,module.exports);
  return module.exports;
}
const queue=await loadCjs('../src/components/AssignmentChangeRequestsView.tsx',{'../api/client':{api:{}},'./AssignmentChangeRequestPanel':{AssignmentChangeRequestPanel:()=>null,coordinationStatus:{PENDING:'Chờ quản lý xử lý',APPROVED:'Đã chấp thuận điều phối'}}});
const receipt={id:'r1',subjectCode:'HS-001',reasonCode:'WORKLOAD',status:'APPROVED',createdAt:'2026-11-12T03:00:00Z',requester:{fullName:'Bùi Thị Mai'}};
test('an empty coordination filter shows an empty row instead of a blank table',()=>{
  const html=renderToStaticMarkup(React.createElement(queue.CoordinationQueueRows,{rows:[],onSelect:()=>{}}));
  assert.match(html,/<td colSpan="5"[^>]*>Không có đề nghị điều phối ở trạng thái này\.<\/td>/);
  assert.match(renderToStaticMarkup(React.createElement(queue.CoordinationQueueRows,{rows:[receipt],onSelect:()=>{}})),/HS-001.*Bùi Thị Mai.*Đã chấp thuận điều phối/);
});
test('the filter result line is a short muted count without a sorting explanation',async()=>{
  const view=await fs.readFile(new URL('../src/components/AssignmentChangeRequestsView.tsx',import.meta.url),'utf8');
  assert.match(view,/className="coordination-queue-count">\{rows\?\(rows\.length\?`\$\{rows\.length\} đề nghị`:'Không đề nghị'\)/);
  assert.doesNotMatch(view,/được ưu tiên trước, sau đó theo thời gian gửi/);
  const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(css,/\.coordination-queue-count \{[^}]*color: var\(--text-secondary\)[^}]*font-size: 13px/);
});
test('the officer workload table title is Vietnamese only',async()=>{
  const view=await fs.readFile(new URL('../src/components/AssignmentsView.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(view,/Workload Monitoring|Trắng Sáng/);
  assert.match(view,/Bảng giám sát tải công việc CBTD/);
});
