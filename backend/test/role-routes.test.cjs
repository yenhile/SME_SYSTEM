const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('reflect-metadata');
const {ROLES_KEY}=require('../dist/common/decorators/roles.decorator');

// Ma trận quyền theo từng route nội bộ (khóa chặn hoàn toàn theo vai trò). Thêm hoặc sửa route mà lệch quyền thì test này báo ngay.
// null = chỉ cần đăng nhập (không giới hạn vai trò). Quyền lọc theo hồ sơ (CBTD chỉ hồ sơ của mình, Thẩm quyền từ Thẩm định trở đi)
// do LoanAccessGuard xử lý và được kiểm tra riêng trong loan-access.test.cjs.
const C='CBTD',T='THAM_QUYEN',Q='QUAN_LY',A='ADMIN';
// 11/11/2026 (PO): Admin xem được mọi route đọc nghiệp vụ (GET) nhưng không có quyền ghi; riêng getMyWarnings là cảnh báo cá nhân của CBTD.
// 12/11/2026: getOfficerDashboard (CBTD) và getApproverDashboard (Thẩm quyền) là dashboard cá nhân theo yêu cầu PO; Admin có dashboard quản trị riêng (AdminController.dashboard).
// 06/11/2026: getMyWarnings (CBTD chỉ xem cảnh báo dự báo trễ SLA của hồ sơ mình phụ trách, chỉ đọc) theo yêu cầu của người phụ trách; PO cần xác nhận khi duyệt gói.
const EXPECTED={
  AssignmentChangeRequestsController:{capabilities:[C,Q,A],list:[C,Q,A],detail:[C,Q,A],create:[C],approve:[Q],reject:[Q],cancel:[C]},
  AppraisalController:{view:[C,T,Q,A],save:[C],submit:[C],clarify:[T]},
  AdminController:{dashboard:[A],stages:[A],updateStage:[A],roles:[A],slaOverview:[A],auditLogs:[A],rateBands:[A],createRateBand:[A]},
  AssignmentsController:{getOfficerWorkloads:[Q,A],getAssignmentHistory:[Q,A],reassign:[Q]},
  CompaniesController:{checkTaxCode:[C,T,Q,A],findAll:[C,T,Q,A],upsert:[C]},
  DashboardController:{getOverviewStats:[Q,T,A],getSlaBottleneckAnalysis:[Q,T,A],getEarlyWarningList:[Q,T,A],getMyWarnings:[C],getPeriodReport:[Q,A],getOverdueSupplements:[Q,A],getStageDistribution:[Q,T,A],getOperations:[Q,T,A],getOfficerDashboard:[C],getApproverDashboard:[T]},
  DocumentsController:{findByApplication:[C,T,Q,A],create:[C],delete:[C],download:[C,T,Q,A]},
  LoanApplicationsController:{create:[C],findAll:[C,T,Q,A],findOne:[C,T,Q,A],checkDocuments:[C],setAmount:[C]},
  PredictionController:{predict:[T,Q]},
  SupplementsController:{portalDetails:[C,T,Q,A],review:[C,T],returnCorrections:[C,T],download:[C,T,Q,A],getSupplements:[C,T,Q,A],createRequest:[C,T],resolveRequest:[C,T]},
  UsersController:{findAll:[A],findOne:[A],create:[A],update:[A]},
  WorkflowController:{getWorkflowStages:[C,T,Q,A],getWorkflowHistory:[C,T,Q,A],transitionStage:[C,T],closeOverdueSupplement:[Q]},
  PortalIntakesController:{list:[C,Q,A],officers:[Q,A],config:[C,Q,T,A],assign:[Q],history:[C,Q,A],one:[C,Q,A],match:[C,Q,A],cycle:[C,Q,A],review:[C],returnCorrection:[C],correctionDecision:[C],reconciliation:[C],resolveReconciliation:[Q],issue:[Q],download:[C,Q,A],accept:[C]},
  AuthController:{login:null,getProfile:null,changePassword:null},
  NotificationsController:{list:null,read:null},
};
// Controller công khai hoặc dành cho tài khoản doanh nghiệp (PortalGuard), không dùng vai trò nhân viên.
const NOT_STAFF=new Set(['HealthController','PortalAuthController','PortalRequestsController','PortalSupplementsController']);

function loadControllers() {
  const found={};
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
  for(const file of walk(path.join(__dirname,'..','dist')).filter(f=>f.endsWith('.controller.js'))) {
    const exported=require(file);
    for(const name of Object.keys(exported).filter(n=>n.endsWith('Controller'))) found[name]=exported[name];
  }
  return found;
}
const effectiveRoles=(cls,method)=>{
  const roles=Reflect.getMetadata(ROLES_KEY,cls.prototype[method])??Reflect.getMetadata(ROLES_KEY,cls);
  return roles?[...roles].sort():null;
};
const methodsOf=cls=>Object.getOwnPropertyNames(cls.prototype).filter(m=>m!=='constructor'&&Reflect.hasMetadata('path',cls.prototype[m]));

test('every staff controller is covered by the role matrix (no route can be added without a decision)',()=>{
  const controllers=loadControllers();
  const unknown=Object.keys(controllers).filter(n=>!EXPECTED[n]&&!NOT_STAFF.has(n));
  assert.deepEqual(unknown,[],'controller chưa có trong ma trận quyền');
  for(const [name,routes] of Object.entries(EXPECTED)) {
    assert.ok(controllers[name],`${name} not found`);
    assert.deepEqual(methodsOf(controllers[name]).sort(),Object.keys(routes).sort(),`${name}: danh sách route lệch ma trận`);
  }
});

test('each route allows exactly the roles of the approved matrix',()=>{
  const controllers=loadControllers();
  for(const [name,routes] of Object.entries(EXPECTED))
    for(const [method,expected] of Object.entries(routes))
      assert.deepEqual(effectiveRoles(controllers[name],method),expected?[...expected].sort():null,`${name}.${method}`);
});

test('administration routes are Admin-only; Admin reads every business route but never writes',()=>{
  const controllers=loadControllers();
  const GET=0;
  for(const name of ['AdminController','UsersController'])
    for(const method of methodsOf(controllers[name])) assert.deepEqual(effectiveRoles(controllers[name],method),['ADMIN'],`${name}.${method}`);
  for(const name of Object.keys(EXPECTED).filter(n=>!['AdminController','UsersController','AuthController','NotificationsController'].includes(n)))
    for(const method of methodsOf(controllers[name])) {
      const isGet=Reflect.getMetadata('method',controllers[name].prototype[method])===GET;
      const adminAllowed=!!effectiveRoles(controllers[name],method)?.includes('ADMIN');
      if(!isGet) assert.ok(!adminAllowed,`${name}.${method} là thao tác ghi, Admin không được phép`);
      // Dashboard cá nhân ("của tôi") lấy phạm vi từ chính người đăng nhập nên không có nghĩa với Admin; Admin xem dữ liệu nghiệp vụ qua các route còn lại.
      else if(!(name==='DashboardController'&&['getMyWarnings','getOfficerDashboard','getApproverDashboard'].includes(method))) assert.ok(adminAllowed,`${name}.${method} là route đọc, Admin phải xem được`);
    }
});

test('only CBTD may create or confirm loans, and only Quản lý may assign or close overdue loans',()=>{
  const controllers=loadControllers();
  for(const [name,method] of [['LoanApplicationsController','create'],['LoanApplicationsController','checkDocuments'],['LoanApplicationsController','setAmount'],['PortalIntakesController','accept'],['PortalIntakesController','review']])
    assert.deepEqual(effectiveRoles(controllers[name],method),['CBTD'],`${name}.${method}`);
  for(const [name,method] of [['AssignmentsController','reassign'],['PortalIntakesController','assign'],['WorkflowController','closeOverdueSupplement']])
    assert.deepEqual(effectiveRoles(controllers[name],method),['QUAN_LY'],`${name}.${method}`);
});
