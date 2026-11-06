import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}

const helpers = await load('../src/portal/supplements.ts');
let currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1', username: 'cbtd1', fullName: 'Cán bộ 1' } };
let mockApiGet = async () => null;

const lucideMock = new Proxy({}, {
  get: (_, prop) => () => React.createElement('span', { 'data-icon': String(prop) }),
});

const appraisalHelpers = await load('../src/appraisalWorkspace.ts');
const decisionResult = await load('../src/components/DecisionResult.tsx', { '../appraisalWorkspace': appraisalHelpers });
let appraisalPanelProps = null;

const { LoanDetailModal } = await load('../src/components/LoanDetailModal.tsx', {
  './DecisionResult': decisionResult,
  './loanInputRules': await load('../src/components/loanInputRules.ts'),
  '../appraisalWorkspace': appraisalHelpers,
  '../loanListDisplay': await load('../src/loanListDisplay.ts', { './appraisalWorkspace': appraisalHelpers, './slaDisplay': await load('../src/slaDisplay.ts') }),
  './AppraisalPanel': { AppraisalPanel: props => { appraisalPanelProps = props; return null; } },
  './AssignmentChangeRequestPanel': { AssignmentChangeRequestPanel: () => null },
  '../api/client': {
    api: {
      get: async (url) => mockApiGet(url),
      post: async () => null,
      put: async () => null,
      delete: async () => null,
      download: async () => new Blob(),
    },
  },
  '../context/AuthContext': { useAuth: () => currentAuth },
  '../slaDisplay': { predictionLabel: () => '', slaPolicyLabel: () => '', slaStateLabel: () => '', slaSummaryText: () => '', stageDurationText: () => '', stageStandardText: () => '' },
  './PortalIntakeDetails': { PortalIntakeDetails: () => null },
  './SupplementPanel': { SupplementPanel: () => null },
  './SupplementDeadlineBadge': { SupplementDeadlineBadge: () => null },
  './CloseOverdueForm': { CloseOverdueForm: () => null },
  './closeOverdue': { canCloseOverdue: () => false },
  '../portal/supplements': helpers,
  'lucide-react': lucideMock,
});

const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;

class ComponentLifecycleHarness {
  constructor(Component, props) {
    this.Component = Component;
    this.props = props;
    this.hooks = [];
    this.hookIndex = 0;
    this.isMounted = false;
    this.queuedEffects = [];
    this.renderCount = 0;
  }

  render() {
    this.hookIndex = 0;
    this.renderCount++;
    const prevDispatcher = dispatcher.current;
    const self = this;

    dispatcher.current = {
      useState(initial) {
        const idx = self.hookIndex++;
        if (!self.isMounted) {
          const state = typeof initial === 'function' ? initial() : initial;
          const setter = (nextVal) => {
            const val = typeof nextVal === 'function' ? nextVal(self.hooks[idx].state) : nextVal;
            self.hooks[idx].state = val;
          };
          self.hooks[idx] = { type: 'useState', state, setter };
          return [state, setter];
        }
        if (idx >= self.hooks.length) {
          throw new Error('Rendered more hooks than during the previous render.');
        }
        if (self.hooks[idx].type !== 'useState') {
          throw new Error(`Hook type mismatch at ${idx}: expected ${self.hooks[idx].type} but got useState`);
        }
        return [self.hooks[idx].state, self.hooks[idx].setter];
      },
      useEffect(effect, deps) {
        const idx = self.hookIndex++;
        if (!self.isMounted) {
          self.hooks[idx] = { type: 'useEffect', effect, deps };
          self.queuedEffects.push(effect);
        } else {
          if (idx >= self.hooks.length) {
            throw new Error('Rendered more hooks than during the previous render.');
          }
          if (self.hooks[idx].type !== 'useEffect') {
            throw new Error(`Hook type mismatch at ${idx}: expected ${self.hooks[idx].type} but got useEffect`);
          }
          const prevDeps = self.hooks[idx].deps;
          self.hooks[idx].deps = deps;
          const changed = !deps || !prevDeps || deps.some((d, i) => !Object.is(d, prevDeps[i]));
          if (changed) self.queuedEffects.push(effect);
        }
      },
      useMemo(factory, deps) {
        const idx = self.hookIndex++;
        if (!self.isMounted) {
          const val = factory();
          self.hooks[idx] = { type: 'useMemo', val, deps };
          return val;
        }
        if (idx >= self.hooks.length) {
          throw new Error('Rendered more hooks than during the previous render.');
        }
        if (self.hooks[idx].type !== 'useMemo') {
          throw new Error(`Hook type mismatch at ${idx}: expected ${self.hooks[idx].type} but got useMemo`);
        }
        const prev = self.hooks[idx];
        const changed = !deps || !prev.deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
        if (changed) {
          prev.val = factory();
          prev.deps = deps;
        }
        return prev.val;
      },
      useContext() {
        return currentAuth;
      },
      readContext() {
        return currentAuth;
      },
      useCallback(fn) {
        return fn;
      },
      useRef(initial) {
        return { current: initial };
      },
    };

    try {
      const res = this.Component(this.props);
      if (this.isMounted && this.hookIndex < this.hooks.length) {
        throw new Error('Rendered fewer hooks than during the previous render.');
      }
      this.isMounted = true;
      return res;
    } finally {
      dispatcher.current = prevDispatcher;
    }
  }

  async flushEffects() {
    const effects = [...this.queuedEffects];
    this.queuedEffects = [];
    for (const eff of effects) {
      await eff();
    }
  }
}

function baseLoan(overrides = {}) {
  return {
    id: 'loan-1',
    applicationCode: 'HS-2026-001',
    businessPolicyVersion: 'SME_BRANCH_20261031_V1',
    currentStage: 'TIEP_NHAN',
    currentStatus: 'RECEIVED',
    proposedAmount: 5000000000,
    officialAmount: 5000000000,
    loanTermMonths: 12,
    isDocumentComplete: false,
    assignedTo: 'cbtd-1',
    assignedUser: { id: 'cbtd-1', username: 'cbtd1', fullName: 'Cán bộ 1' },
    company: { companyName: 'Công ty TNHH Ánh Dương', taxCode: '0101234567', charterCapital: 10000000000 },
    documents: [
      { id: 'doc-1', documentType: 'PHAP_LY', fileName: 'gpkd.pdf', fileSize: 1048576, uploadedAt: '2026-11-01T08:00:00Z' },
      { id: 'doc-2', documentType: 'TAI_CHINH', fileName: 'bctc.pdf', fileSize: 2097152, uploadedAt: '2026-11-01T08:00:00Z' },
    ],
    supplementRequests: [],
    stageHistories: [],
    ...overrides,
  };
}

test('1. LoanDetailModal renders null without hook errors when loan has no data yet (initial null)', () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };
  const htmlNullApp = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: null, onClose: () => {}, onRefresh: () => {}, initialLoan: null }));
  assert.equal(htmlNullApp, '');

  const htmlUnloaded = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: null }));
  assert.equal(htmlUnloaded, '');
});

test('2. Real Component Lifecycle: LoanDetailModal mounts unloaded, fetches data, updates state and re-renders on the SAME instance without hook error', async () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1', username: 'cbtd1', fullName: 'Cán bộ 1' } };
  const mockLoan = baseLoan();
  mockApiGet = async (url) => {
    if (url === '/loan-applications/loan-1') return mockLoan;
    if (url === '/portal-intakes/form-config') return null;
    return null;
  };

  // Mount LoanDetailModal on ComponentLifecycleHarness
  const harness = new ComponentLifecycleHarness(LoanDetailModal, {
    applicationId: 'loan-1',
    onClose: () => {},
    onRefresh: () => {},
    initialLoan: null,
  });

  // Render 1: Loan has no data yet -> returns null
  const render1 = harness.render();
  assert.equal(render1, null, 'First render must return null while loading');
  assert.equal(harness.hooks.length, 23, 'Must register exactly 23 hooks on mount');

  // Trigger useEffect lifecycle: runs fetchDetail() -> calls setLoan(mockLoan)
  await harness.flushEffects();
  // Allow async fetchDetail promise chain to resolve
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Render 2: Re-render on the EXACT SAME component instance with updated state
  const render2 = harness.render();
  assert.notEqual(render2, null, 'Second render must return modal JSX once data is resolved');
  assert.equal(harness.hooks.length, 23, 'Hook count must remain exactly 23 across lifecycle renders');

  // Render static HTML from the returned element tree
  const html = renderToStaticMarkup(render2);
  assert.match(html, /modal-content/);
  assert.match(html, /HS-2026-001/);
  assert.match(html, /Công ty TNHH Ánh Dương/);
});

test('2.B Isolated Proof: Harness catches pre-fix hook order violation and validates post-fix immunity', () => {
  // 1. Buggy pattern (reproducing pre-fix bug: useMemo called AFTER early return)
  function BuggyModal({ loan }) {
    const [auth] = React.useState('CBTD');
    const [loading, setLoading] = React.useState(false);
    if (!loan) return null; // Early return before useMemo!
    const acceptedFiles = React.useMemo(() => ['file-1'], [loan]);
    return React.createElement('div', null, `Loaded: ${loan.id}, files: ${acceptedFiles.length}`);
  }

  const buggyHarness = new ComponentLifecycleHarness(BuggyModal, { loan: null });
  const r1Buggy = buggyHarness.render();
  assert.equal(r1Buggy, null);
  assert.equal(buggyHarness.hooks.length, 2, 'Only 2 useState hooks registered on render 1');

  // Update props on same instance to simulate data arrival
  buggyHarness.props = { loan: { id: 'loan-1' } };
  assert.throws(
    () => buggyHarness.render(),
    (err) => {
      assert.match(err.message, /Rendered more hooks than during the previous render/);
      return true;
    },
    'Harness must detect and throw on hook order invariant violation'
  );

  // 2. Fixed pattern (post-fix: useMemo called BEFORE early return)
  function FixedModal({ loan }) {
    const [auth] = React.useState('CBTD');
    const [loading, setLoading] = React.useState(false);
    const acceptedFiles = React.useMemo(() => (loan ? ['file-1'] : []), [loan]); // Called unconditionally!
    if (!loan) return null;
    return React.createElement('div', null, `Loaded: ${loan.id}, files: ${acceptedFiles.length}`);
  }

  const fixedHarness = new ComponentLifecycleHarness(FixedModal, { loan: null });
  const r1Fixed = fixedHarness.render();
  assert.equal(r1Fixed, null);
  assert.equal(fixedHarness.hooks.length, 3, 'All 3 hooks registered on render 1');

  // Update props on same instance
  fixedHarness.props = { loan: { id: 'loan-1' } };
  const r2Fixed = fixedHarness.render();
  assert.notEqual(r2Fixed, null);
  assert.equal(fixedHarness.hooks.length, 3, 'Hook count strictly preserved at 3');
  assert.match(renderToStaticMarkup(r2Fixed), /Loaded: loan-1, files: 1/);
});

test('3. Document check reminder banner: hidden on SUPPLEMENT_REQUIRED, shown on RECEIVED for assigned CBTD, hidden when checked', () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };

  // Case A: Waiting for supplement (SUPPLEMENT_REQUIRED) -> Banner must NOT be shown!
  const waitingLoan = baseLoan({ currentStatus: 'SUPPLEMENT_REQUIRED', isDocumentComplete: false });
  const htmlWaiting = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: waitingLoan }));
  assert.doesNotMatch(htmlWaiting, /Hồ sơ tại công đoạn Tiếp nhận — Cần kiểm tra và xác nhận danh mục chứng từ/);

  // Case B: Received back at TIEP_NHAN, incomplete documents, assigned CBTD -> Banner MUST be shown!
  const receivedLoan = baseLoan({ currentStatus: 'RECEIVED', isDocumentComplete: false, assignedTo: 'cbtd-1' });
  const htmlReceived = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: receivedLoan }));
  assert.match(htmlReceived, /Hồ sơ tại công đoạn Tiếp nhận — Cần kiểm tra và xác nhận danh mục chứng từ/);
  assert.match(htmlReceived, /Xem chứng từ/);

  // Case C: Documents already complete (isDocumentComplete: true or status: CHECKED) -> Banner must be hidden!
  const completedLoan = baseLoan({ currentStatus: 'CHECKED', isDocumentComplete: true });
  const htmlCompleted = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: completedLoan }));
  assert.doesNotMatch(htmlCompleted, /Hồ sơ tại công đoạn Tiếp nhận — Cần kiểm tra và xác nhận danh mục chứng từ/);

  // Case D: Another officer looking at the loan -> Banner must NOT be shown!
  const otherOfficerLoan = baseLoan({ currentStatus: 'RECEIVED', isDocumentComplete: false, assignedTo: 'other-officer' });
  const htmlOther = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: otherOfficerLoan }));
  assert.doesNotMatch(htmlOther, /Hồ sơ tại công đoạn Tiếp nhận — Cần kiểm tra và xác nhận danh mục chứng từ/);

  // Case E: At Appraisal stage (THAM_DINH) -> Banner must NOT be shown!
  const appraisalLoan = baseLoan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL', isDocumentComplete: false });
  const htmlAppraisal = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: appraisalLoan }));
  assert.doesNotMatch(htmlAppraisal, /Hồ sơ tại công đoạn Tiếp nhận — Cần kiểm tra và xác nhận danh mục chứng từ/);
});

test('3b. The officer reads business names, never codes or emoji', () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };
  const suppRequest = { id: 'supp-1', portalSupplement: { items: [{ id: 'item-1', documentGroup: 'A', documentTypeCode: 'A_BUSINESS_REGISTRATION', status: 'ACCEPTED' }], files: [{ id: 'file-a', itemId: 'item-1', fileName: 'gpkd.pdf', fileSize: 1024, version: 1, submittedAt: '2026-11-01' }] } };
  const loan = baseLoan({ supplementRequests: [suppRequest], documents: [{ id: 'doc-1', documentType: 'PHAP_LY', fileName: 'gpkd.pdf', fileSize: 1048576, uploadedAt: '2026-11-01T08:00:00Z' }] });
  const html = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: loan, initialTab: 'documents' }));
  for (const code of ['>RECEIVED<', '>TIEP_NHAN<', '>PHAP_LY<', 'A_BUSINESS_REGISTRATION', 'AI Early Warning', 'Explainable AI', 'RandomForest']) assert.ok(!html.includes(code), code);
  assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}\u{26AB}]/u);
  assert.match(html, />Mới tiếp nhận</);
  assert.match(html, />Tiếp nhận<\/strong>/);
  assert.match(html, />Pháp lý</);
  assert.match(html, /Nguy cơ trễ SLA/);
});

test('4. Unified document counter reflects both initial documents and accepted supplement heads', () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };

  // Loan with 2 initial documents + 1 supplement request having chain A -> B (where B is accepted)
  const suppRequest = {
    id: 'supp-1',
    portalSupplement: {
      items: [
        { id: 'item-1', documentGroup: 'A', documentTypeCode: 'GPKD', status: 'ACCEPTED' },
      ],
      files: [
        { id: 'file-a', itemId: 'item-1', fileName: 'gpkd_v1.pdf', fileSize: 1024, version: 1, submittedAt: '2026-11-01' },
        { id: 'file-b', itemId: 'item-1', fileName: 'gpkd_v2.pdf', fileSize: 2048, version: 2, supersedesId: 'file-a', submittedAt: '2026-11-02' },
      ],
    },
  };

  const loan = baseLoan({ supplementRequests: [suppRequest] });
  const html = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: loan, initialTab: 'documents' }));

  // Tab button counter must reflect unified total: 2 initial + 1 accepted supplement = 3!
  assert.match(html, /Danh mục chứng từ \(3\)/);
  // Table must contain accepted supplement file B
  assert.match(html, /gpkd_v2\.pdf/);
  assert.match(html, /badge-soft-green">Bổ sung</);
  assert.match(html, /\(v2\)/);
  assert.match(html, /Đã chấp nhận/);
  // Table must NOT contain superseded file A in the main list
  assert.doesNotMatch(html, />gpkd_v1\.pdf</);
});

test('5. D4-01 branch limit: 10 billion is allowed and green, > 10 billion on new policy warns red without escalation', () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };

  // Exactly 10 billion on new policy
  const tenBillionLoan = baseLoan({ proposedAmount: 10000000000, officialAmount: 10000000000 });
  const html10B = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: tenBillionLoan }));
  assert.match(html10B, /≤ 10 tỷ \(Duyệt tại chi nhánh\)/);
  assert.doesNotMatch(html10B, /Vượt hạn mức chi nhánh/);

  // 12 billion on new policy -> warns red, no escalation button
  const over10BLoan = baseLoan({ proposedAmount: 12000000000, officialAmount: 12000000000 });
  const htmlOver = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: over10BLoan }));
  assert.match(htmlOver, /Vượt hạn mức chi nhánh \(tối đa 10 tỷ\)/);
  assert.doesNotMatch(htmlOver, /Cần Cấp trên/);
  assert.doesNotMatch(htmlOver, /Trình Hội đồng \/ Cấp trên/);

  const legacyOver = baseLoan({ businessPolicyVersion: null, proposedAmount: 15000000000, officialAmount: 15000000000 });
  const htmlLegacy = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: legacyOver }));
  assert.match(htmlLegacy, /Vượt hạn mức chi nhánh \(tối đa 10 tỷ\)/);
});

const renderLoan = overrides => renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: baseLoan(overrides) }));
const doneHistory = { stage: { stageCode: 'HOAN_TAT' }, handler: { fullName: 'Thẩm quyền A', username: 'tq_a' }, enteredAt: '2026-11-05T03:00:00Z', exitedAt: '2026-11-05T03:00:00Z', slaStandardHours: 8, pausedDurationHours: 0 };

test('7. Approved loan shows the approved amount, rate, decider and date', () => {
  currentAuth = { activeRole: 'THAM_QUYEN', user: { id: 'tq-1' } };
  const html = renderLoan({ currentStage: 'HOAN_TAT', currentStatus: 'APPROVED', approvedAmount: '4000000000', interestRate: '8.5', completedAt: '2026-11-05T03:00:00Z', stageHistories: [doneHistory] });
  assert.match(html, /Kết quả quyết định/);
  assert.match(html, /4\.000\.000\.000 VNĐ/);
  assert.match(html, /8,5%\/năm/);
  assert.match(html, /Thẩm quyền A/);
  assert.match(html, /05\/11\/2026|5\/11\/2026/);
});

test('8. Rejected and timed-out loans show the reason and who closed them', () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };
  const rejected = renderLoan({ currentStage: 'HOAN_TAT', currentStatus: 'REJECTED', rejectionReasonCode: 'TC02', rejectionNote: 'Dòng tiền không đủ', completedAt: '2026-11-05T03:00:00Z', stageHistories: [doneHistory] });
  assert.match(rejected, /TC02 - Năng lực tài chính không đảm bảo/);
  assert.match(rejected, /Dòng tiền không đủ/);
  assert.match(rejected, /Thẩm quyền A/);
  const timedOut = renderLoan({ currentStage: 'HOAN_TAT', currentStatus: 'CLOSED_TIMEOUT', rejectionReasonCode: 'TC05', rejectionNote: 'Quá hạn', completedAt: '2026-11-05T03:00:00Z', stageHistories: [doneHistory] });
  assert.match(timedOut, /TC05 - Quá hạn thời gian bổ sung chứng từ/);
});

test('9. Loans still in progress show no decision block, and old loans without history say so', () => {
  currentAuth = { activeRole: 'THAM_QUYEN', user: { id: 'tq-1' } };
  assert.doesNotMatch(renderLoan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' }), /Kết quả quyết định/);
  const old = renderLoan({ currentStage: 'HOAN_TAT', currentStatus: 'APPROVED', approvedAmount: 3500000000, interestRate: 8.5, stageHistories: [] });
  assert.match(old, /3\.500\.000\.000 VNĐ/);
  assert.match(old, /Chưa ghi nhận/);
});

test('10. The report panel reloads when the evidence of the loan changes', () => {
  currentAuth = { activeRole: 'THAM_QUYEN', user: { id: 'tq-1' } };
  const base = { currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' };
  renderLoan(base);
  const before = appraisalPanelProps.evidenceKey;
  assert.equal(typeof before, 'string');
  renderLoan({ ...base, documents: [{ id: 'doc-9', documentType: 'KHAC', fileName: 'them.pdf', fileSize: 1, uploadedAt: '2026-11-05T03:00:00Z' }] });
  assert.notEqual(appraisalPanelProps.evidenceKey, before);
  renderLoan(base);
  assert.equal(appraisalPanelProps.evidenceKey, before);
  renderLoan({ ...base, supplementRequests: [{ id: 's1', status: 'RESOLVED', resolvedAt: '2026-11-05T03:00:00Z' }] });
  assert.notEqual(appraisalPanelProps.evidenceKey, before);
});

test('11. Only the assigned officer at Tiếp nhận sees the add-document action', () => {
  const documentsTab = overrides => renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: baseLoan(overrides), initialTab: 'documents' }));
  currentAuth = { activeRole: 'THAM_QUYEN', user: { id: 'tq-1' } };
  assert.doesNotMatch(documentsTab({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' }), /Thêm tài liệu/);
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };
  assert.match(documentsTab({ currentStage: 'TIEP_NHAN', currentStatus: 'RECEIVED' }), /Thêm tài liệu/);
});

test('12. Only the assigned officer at Tiếp nhận sees the delete-document action', () => {
  const documentsTab = overrides => renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: baseLoan(overrides), initialTab: 'documents' }));
  currentAuth = { activeRole: 'THAM_QUYEN', user: { id: 'tq-1' } };
  assert.doesNotMatch(documentsTab({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' }), /btn-outline-danger/);
  assert.doesNotMatch(documentsTab({ businessPolicyVersion: null, currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' }), /btn-outline-danger/);
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1' } };
  assert.match(documentsTab({ currentStage: 'TIEP_NHAN', currentStatus: 'RECEIVED' }), /btn-outline-danger/);
});

test('13. The approval form starts with no interest rate and cannot be confirmed until one is entered', async () => {
  currentAuth = { activeRole: 'THAM_QUYEN', user: { id: 'tq-1' } };
  const harness = new ComponentLifecycleHarness(LoanDetailModal, {
    applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {},
    initialLoan: baseLoan({ businessPolicyVersion: null, currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' }),
  });
  harness.render();
  await harness.flushEffects();
  const SHOW_APPROVE_FORM = 9, INTEREST_RATE = 11;
  harness.hooks[SHOW_APPROVE_FORM].setter(true);
  const confirm = html => html.match(/<button[^>]*>Xác nhận Phê duyệt<\/button>/)[0];
  const rateInput = html => html.match(/<input[^>]*max="100"[^>]*>/)[0];

  const empty = renderToStaticMarkup(harness.render());
  assert.doesNotMatch(rateInput(empty), /value="[^"]+"/);
  assert.match(confirm(empty), /disabled=""/);

  harness.hooks[INTEREST_RATE].setter('7.9');
  const filled = renderToStaticMarkup(harness.render());
  assert.match(rateInput(filled), /value="7.9"/);
  assert.doesNotMatch(confirm(filled), /disabled=""/);

  harness.hooks[INTEREST_RATE].setter('0');
  assert.doesNotMatch(confirm(renderToStaticMarkup(harness.render())), /disabled=""/);

  harness.hooks[INTEREST_RATE].setter('101');
  assert.match(confirm(renderToStaticMarkup(harness.render())), /disabled=""/);
});

test('6. Progress bar has exactly three steps for every loan', () => {
  currentAuth = { activeRole: 'THAM_QUYEN', user: { id: 'tq-1' } };
  for (const overrides of [
    { currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' },
    { businessPolicyVersion: null, currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL' },
    { currentStage: 'HOAN_TAT', currentStatus: 'APPROVED' },
  ]) {
    const html = renderToStaticMarkup(React.createElement(LoanDetailModal, { applicationId: 'loan-1', onClose: () => {}, onRefresh: () => {}, initialLoan: baseLoan({ ...overrides, stageHistories: [] }) }));
    assert.equal((html.match(/class="progress-step-circle"/g) ?? []).length, 3);
    assert.doesNotMatch(html, /Hội đồng|Cấp trên/);
  }
});
