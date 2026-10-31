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
const EXPECTED={
  AdminController:{stages:[A],updateStage:[A]},
  AssignmentsController:{getOfficerWorkloads:[Q],getAssignmentHistory:[Q],reassign:[Q]},
  CompaniesController:{checkTaxCode:[C,T,Q],findAll:[C,T,Q],upsert:[C]},
  DashboardController:{getOverviewStats:[Q,T],getSlaBottleneckAnalysis:[Q,T],getEarlyWarningList:[Q,T],getOverdueSupplements:[Q],getStageDistribution:[Q,T]},
  DocumentsController:{findByApplication:[C,T,Q],create:[C,T],delete:[C,T],download:[C,T,Q]},
  LoanApplicationsController:{create:[C],findAll:[C,T,Q],findOne:[C,T,Q],checkDocuments:[C],setAmount:[C]},
  PredictionController:{predict:[T,Q]},
  SupplementsController:{portalDetails:[C,T,Q],review:[C,T],returnCorrections:[C,T],download:[C,T,Q],getSupplements:[C,T,Q],createRequest:[C,T],resolveRequest:[C,T]},
  UsersController:{findAll:[A],findOne:[A],create:[A],update:[A]},
  WorkflowController:{getWorkflowStages:[C,T,Q],getWorkflowHistory:[C,T,Q],transitionStage:[C,T],closeOverdueSupplement:[Q]},
  PortalIntakesController:{list:[C,Q],officers:[Q],config:[C,Q],assign:[Q],history:[C,Q],one:[C,Q],match:[C,Q],cycle:[C,Q],review:[C],returnCorrection:[C],issue:[Q],download:[C,Q],accept:[C]},
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

test('administration routes are Admin-only and loan routes never include Admin',()=>{
  const controllers=loadControllers();
  for(const name of ['AdminController','UsersController'])
    for(const method of methodsOf(controllers[name])) assert.deepEqual(effectiveRoles(controllers[name],method),['ADMIN'],`${name}.${method}`);
  for(const name of ['LoanApplicationsController','DocumentsController','SupplementsController','WorkflowController','PredictionController','AssignmentsController','DashboardController','PortalIntakesController'])
    for(const method of methodsOf(controllers[name])) assert.ok(!effectiveRoles(controllers[name],method)?.includes('ADMIN'),`${name}.${method}`);
});

test('only CBTD may create or confirm loans, and only Quản lý may assign or close overdue loans',()=>{
  const controllers=loadControllers();
  for(const [name,method] of [['LoanApplicationsController','create'],['LoanApplicationsController','checkDocuments'],['LoanApplicationsController','setAmount'],['PortalIntakesController','accept'],['PortalIntakesController','review']])
    assert.deepEqual(effectiveRoles(controllers[name],method),['CBTD'],`${name}.${method}`);
  for(const [name,method] of [['AssignmentsController','reassign'],['PortalIntakesController','assign'],['WorkflowController','closeOverdueSupplement']])
    assert.deepEqual(effectiveRoles(controllers[name],method),['QUAN_LY'],`${name}.${method}`);
});
