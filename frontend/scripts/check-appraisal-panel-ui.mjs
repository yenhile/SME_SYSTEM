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

let currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1', username: 'cbtd1' } };
let mockApiResponse = undefined; // Simulates 204 No Content returning undefined

const { AppraisalPanel } = await load('../src/components/AppraisalPanel.tsx', {
  '../api/client': {
    api: {
      get: async () => mockApiResponse,
      put: async () => mockApiResponse,
      post: async () => mockApiResponse,
    },
  },
  '../context/AuthContext': { useAuth: () => currentAuth },
  '../appraisalWorkspace': await load('../src/appraisalWorkspace.ts'),
});

const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;

class LifecycleHarness {
  constructor(Component, props) {
    this.Component = Component;
    this.props = props;
    this.hooks = [];
    this.hookIndex = 0;
    this.isMounted = false;
    this.queuedEffects = [];
  }

  render() {
    this.hookIndex = 0;
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
        if (idx >= self.hooks.length) throw new Error('Rendered more hooks than during previous render');
        return [self.hooks[idx].state, self.hooks[idx].setter];
      },
      useEffect(effect, deps) {
        const idx = self.hookIndex++;
        if (!self.isMounted) {
          self.hooks[idx] = { type: 'useEffect', effect, deps };
          self.queuedEffects.push(effect);
        } else {
          if (idx >= self.hooks.length) throw new Error('Rendered more hooks than during previous render');
          const prevDeps = self.hooks[idx].deps;
          self.hooks[idx].deps = deps;
          const changed = !deps || !prevDeps || deps.some((d, i) => !Object.is(d, prevDeps[i]));
          if (changed) self.queuedEffects.push(effect);
        }
      },
      useRef(initial) {
        const idx = self.hookIndex++;
        if (!self.isMounted) {
          const ref = { current: initial };
          self.hooks[idx] = { type: 'useRef', ref };
          return ref;
        }
        return self.hooks[idx].ref;
      },
      useContext() {
        return currentAuth;
      },
      readContext() {
        return currentAuth;
      },
      useMemo(fn) {
        return fn();
      },
      useCallback(fn) {
        return fn;
      },
    };

    try {
      const res = this.Component(this.props);
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
    currentStatus: 'CHECKED',
    isDocumentComplete: true,
    assignedTo: 'cbtd-1',
    completedAt: null,
    coordinationRestrictions: null,
    updatedAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

test('1. D5-01: When GET returns 204 (undefined), AppraisalPanel normalizes to null, shows Đang lập and zero error alert', async () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1', username: 'cbtd1' } };
  mockApiResponse = undefined; // 204 No Content

  let reportedVersion = 'initial';
  const harness = new LifecycleHarness(AppraisalPanel, {
    loan: baseLoan(),
    onChanged: () => {},
    onVersion: (v) => { reportedVersion = v; },
  });

  // Render 1: Loading
  const r1 = harness.render();
  assert.match(renderToStaticMarkup(r1), /Đang tải tờ trình…/);

  // Flush effects -> GET /appraisals/loan-1 resolves to undefined (204)
  await harness.flushEffects();
  await new Promise(r => setTimeout(r, 20));

  // Render 2: Loaded with null report
  const r2 = harness.render();
  const html = renderToStaticMarkup(r2);

  assert.match(html, /Đang lập/, 'Must default to Đang lập status');
  assert.doesNotMatch(html, /portal-error/, 'Must NOT display portal error alert');
  assert.doesNotMatch(html, /Unexpected end of JSON input/);
  assert.match(html, /Lưu nháp tờ trình/, 'CBTD must see draft save button');
  assert.match(html, /Vui lòng bấm .*Lưu nháp tờ trình.* trước khi .*Trình tờ trình/, 'Helper guidance must be visible');
  assert.equal(reportedVersion, undefined, 'Must not report version when draft is not submitted');
});

test('2. D5-02: Button Trình is disabled when content is unsaved; helper indicates draft saving is required', async () => {
  currentAuth = { activeRole: 'CBTD', user: { id: 'cbtd-1', username: 'cbtd1' } };
  // Mock an existing draft
  mockApiResponse = {
    id: 'rep-1',
    status: 'DRAFT',
    revision: 1,
    draft: { legalAssessment: 'Bản nháp 1' },
    versions: [],
  };

  const harness = new LifecycleHarness(AppraisalPanel, {
    loan: baseLoan(),
    onChanged: () => {},
    onVersion: () => {},
  });

  harness.render();
  await harness.flushEffects();
  await new Promise(r => setTimeout(r, 20));

  // Initial loaded state: content matches draft ({ legalAssessment: 'Bản nháp 1' })
  const r2 = harness.render();
  const html2 = renderToStaticMarkup(r2);
  assert.match(html2, /✓ Bản nháp đã lưu khớp nội dung/);
  assert.match(html2, /<button class="btn btn-primary"[^>]*>Trình tờ trình<\/button>/);
  assert.doesNotMatch(html2, /<button class="btn btn-primary"[^>]*disabled=""[^>]*>Trình tờ trình<\/button>/);

  // User edits content -> content does NOT match report.draft anymore!
  // Hook 1 is useState for content
  harness.hooks[1].setter({ legalAssessment: 'Bản nháp 1 đã sửa đổi chưa lưu' });

  const r3 = harness.render();
  const html3 = renderToStaticMarkup(r3);
  // Trình button must be LOCKED (disabled) and helper text appears!
  assert.match(html3, /<button class="btn btn-primary"[^>]*disabled=""[^>]*>Trình tờ trình<\/button>/);
  assert.match(html3, /Vui lòng bấm .*Lưu nháp tờ trình.* trước khi .*Trình tờ trình/);

  // Saving draft succeeds -> report.draft updated to match content
  harness.hooks[0].setter({
    ...harness.hooks[0].state,
    draft: { legalAssessment: 'Bản nháp 1 đã sửa đổi chưa lưu' },
  });

  const r4 = harness.render();
  const html4 = renderToStaticMarkup(r4);
  // Trình button is unlocked again!
  assert.doesNotMatch(html4, /<button class="btn btn-primary"[^>]*disabled=""[^>]*>Trình tờ trình<\/button>/);
  assert.match(html4, /✓ Bản nháp đã lưu khớp nội dung/);
});

async function renderReport(report, role, loanOverrides = {}) {
  currentAuth = { activeRole: role, user: { id: 'viewer-1' } };
  mockApiResponse = report;
  let version = 'not-reported';
  const harness = new LifecycleHarness(AppraisalPanel, {
    loan: baseLoan({ currentStage: 'THAM_DINH', currentStatus: 'PENDING_APPRAISAL', ...loanOverrides }),
    onChanged: () => {},
    onVersion: value => { version = value; },
  });
  harness.render();
  await harness.flushEffects();
  await new Promise(r => setTimeout(r, 20));
  return { html: renderToStaticMarkup(harness.render()), version: () => version, harness };
}
const submitted = { id: 'rep-1', status: 'SUBMITTED', revision: 2, draft: {}, versions: [{ id: 'v2', sequence: 2, content: {}, submittedAt: '2026-11-05T03:00:00Z' }, { id: 'v1', sequence: 1, content: {}, submittedAt: '2026-11-04T03:00:00Z' }] };

test('4. Unchanged evidence lets the decision continue on the latest version', async () => {
  const { html, version } = await renderReport({ ...submitted, evidenceChanged: false }, 'THAM_QUYEN');
  assert.equal(version(), 'v2');
  assert.doesNotMatch(html, /Căn cứ đã thay đổi/);
});

test('5. Changed evidence withholds the version and tells the authority what to do', async () => {
  const { html, version } = await renderReport({ ...submitted, evidenceChanged: true }, 'THAM_QUYEN');
  assert.equal(version(), undefined);
  assert.match(html, /Căn cứ đã thay đổi/);
  assert.match(html, /yêu cầu CBTD làm rõ và trình lại/);
  assert.match(html, /Yêu cầu làm rõ tờ trình/);
});

test('6. The evidence warning waits until the open supplement is finished and is for the authority only', async () => {
  const waiting = await renderReport({ ...submitted, evidenceChanged: true }, 'THAM_QUYEN', { currentStatus: 'SUPPLEMENT_REQUIRED' });
  assert.doesNotMatch(waiting.html, /Căn cứ đã thay đổi/);
  assert.equal(waiting.version(), undefined);
  const manager = await renderReport({ ...submitted, evidenceChanged: true }, 'QUAN_LY');
  assert.doesNotMatch(manager.html, /Căn cứ đã thay đổi/);
});

test('7. A decided report names the version the decision was made on', async () => {
  const { html } = await renderReport({ ...submitted, status: 'DECIDED', decidedVersionId: 'v2' }, 'THAM_QUYEN', { currentStage: 'HOAN_TAT', currentStatus: 'APPROVED' });
  assert.match(html, /Quyết định trên phiên bản 2/);
});

test('7b. The officer writes under the same section names the authority reads', async () => {
  const { html } = await renderReport({ ...submitted }, 'THAM_QUYEN');
  for (const label of ['Pháp lý và người đại diện', 'Kinh doanh và phương án vốn', 'Tài chính và tài liệu làm căn cứ', 'Dòng tiền và nguồn trả nợ', 'Tài sản bảo đảm (ghi không áp dụng nếu có căn cứ)', 'Rủi ro và biện pháp kiểm soát', 'Đề xuất của CBTD', 'Điều kiện đề xuất (nếu có)']) assert.ok(html.includes(label), label);
  for (const old of ['Đánh giá pháp lý', 'Hoạt động kinh doanh', 'Phân tích tài chính', 'Kết luận đề xuất', 'Bản đã trình']) assert.ok(!html.includes(old), old);
  assert.match(html, /Phiên bản 2/);
});

test('8. A new evidence key reloads the report', async () => {
  const { harness } = await renderReport({ ...submitted, evidenceChanged: false }, 'THAM_QUYEN');
  harness.props = { ...harness.props, evidenceKey: 'after-new-document' };
  harness.render();
  assert.equal(harness.queuedEffects.length, 1);
});

test('3. D5-05: Non-assigned CBTD or non-CBTD role cannot edit appraisal fields', async () => {
  // CBTD but different user
  currentAuth = { activeRole: 'CBTD', user: { id: 'other-user' } };
  mockApiResponse = {
    id: 'rep-1',
    status: 'DRAFT',
    revision: 1,
    draft: {},
    versions: [],
  };

  const harness = new LifecycleHarness(AppraisalPanel, {
    loan: baseLoan({ assignedTo: 'cbtd-1' }),
    onChanged: () => {},
    onVersion: () => {},
  });

  harness.render();
  await harness.flushEffects();
  await new Promise(r => setTimeout(r, 20));

  const r2 = harness.render();
  const html = renderToStaticMarkup(r2);

  assert.doesNotMatch(html, /Lưu nháp tờ trình/, 'Unassigned officer must not see draft action');
  assert.match(html, /readonly=""/, 'Textareas must be readonly');
});

