import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// =========================================================================
// TEST HARNESS CHO AUTHPROVIDER THẬT (TỪ src/context/AuthContext.tsx)
// =========================================================================
function createAuthContextHarness(customClient, customSource = null) {
  const sourceCode = customSource || fs.readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const { outputText } = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
  });

  const win = new EventTarget();
  win.addEventListener = win.addEventListener.bind(win);
  win.removeEventListener = win.removeEventListener.bind(win);
  win.dispatchEvent = win.dispatchEvent.bind(win);

  const module = { exports: {} };
  const fn = new Function('require', 'module', 'exports', 'window', 'localStorage', outputText);
  fn(name => {
    if (name === 'react') return { ...React, default: React };
    if (name.includes('client')) return customClient;
    if (name.includes('types')) return {};
    return require(name);
  }, module, module.exports, win, customClient.localStorage);

  const { AuthProvider, ROLE_NAMES } = module.exports;

  class Harness {
    constructor(Component) {
      this.Component = Component;
      this.hooks = [];
      this.queuedEffects = [];
      this.cleanups = [];
      this.isMounted = false;
      this.window = win;
    }

    render() {
      let hookIndex = 0;
      const self = this;
      const prevDispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = {
        useState(initial) {
          const idx = hookIndex++;
          if (!self.isMounted) {
            const state = typeof initial === 'function' ? initial() : initial;
            const setter = (nextVal) => {
              const val = typeof nextVal === 'function' ? nextVal(self.hooks[idx].state) : nextVal;
              self.hooks[idx].state = val;
            };
            self.hooks[idx] = { type: 'useState', state, setter };
            return [state, setter];
          }
          return [self.hooks[idx].state, self.hooks[idx].setter];
        },
        useEffect(effect, deps) {
          const idx = hookIndex++;
          if (!self.isMounted) {
            self.hooks[idx] = { type: 'useEffect', effect, deps };
            self.queuedEffects.push(effect);
          } else {
            const prevDeps = self.hooks[idx].deps;
            self.hooks[idx].deps = deps;
            const changed = !deps || !prevDeps || deps.some((d, i) => !Object.is(d, prevDeps[i]));
            if (changed) self.queuedEffects.push(effect);
          }
        },
        useRef(initial) {
          const idx = hookIndex++;
          if (!self.isMounted) {
            const ref = { current: initial };
            self.hooks[idx] = { type: 'useRef', ref };
            return ref;
          }
          return self.hooks[idx].ref;
        },
        useContext() {},
        readContext() {},
        useMemo(fn) { return fn(); },
        useCallback(fn) { return fn; },
      };

      try {
        const el = this.Component({ children: null });
        this.isMounted = true;
        this.contextValue = el?.props?.value;
        return this.contextValue;
      } finally {
        React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = prevDispatcher;
      }
    }

    getContext() {
      this.render();
      return this.contextValue;
    }

    async flushEffects() {
      const effects = [...this.queuedEffects];
      this.queuedEffects = [];
      for (const eff of effects) {
        const cleanup = await eff();
        if (typeof cleanup === 'function') this.cleanups.push(cleanup);
      }
    }

    unmount() {
      for (const c of this.cleanups) c();
      this.cleanups = [];
    }
  }

  return {
    Harness,
    AuthProvider,
    ROLE_NAMES,
    window: win,
  };
}

// Giả lập client state
function createMockClient() {
  const store = new Map();
  let currentToken = null;

  class ApiError extends Error {
    constructor(msg, status = 500) {
      super(msg);
      this.status = status;
    }
  }

  const localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  const client = {
    localStorage,
    ApiError,
    getAuthToken: () => currentToken,
    setAuthToken: (t) => {
      currentToken = t;
      if (t) localStorage.setItem('sme_token', t);
      else localStorage.removeItem('sme_token');
    },
    setActiveRole: (r) => {
      if (r) localStorage.setItem('sme_active_role', r);
      else localStorage.removeItem('sme_active_role');
    },
    api: {
      get: async () => {},
      post: async () => {},
    },
  };

  return client;
}

// Payload thật từ AuthService.getProfile trên backend (backend/src/modules/auth/auth.service.ts:116-125)
const realAuthServiceProfilePayload = {
  id: 'usr-cbtd-001',
  username: 'cbtd_hanoi',
  fullName: 'Nguyễn Văn A',
  email: 'a.nguyen@sme.vn',
  phone: '0901234567',
  branchName: 'Chi nhánh Hà Nội',
  roles: ['CBTD', 'QUAN_LY'],
  // TUYỆT ĐỐI KHÔNG CÓ TRƯỜNG isActive TRONG PAYLOAD NÀY
};

// =========================================================================
// CA 1: ĐỒNG NHẤT CONTRACT /auth/me - THIẾU isActive KHÔNG ĐỒNG NGHĨA BỊ KHÓA
// =========================================================================
test('Ca 1: Contract /auth/me: missing isActive must NOT mean locked; proves pre-fix failure and post-fix success', async () => {
  // 1. CHỨNG MINH THẤT BẠI TRƯỚC SỬA (Pre-fix):
  // Bản code cũ có điều kiện: if (!profile || !profile.isActive || !profile.roles?.length) logout();
  const preFixAuthSource = fs.readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    .replace('profile.isActive === false', '!profile.isActive');

  const clientPre = createMockClient();
  clientPre.setAuthToken('token-user-1');
  clientPre.setActiveRole('CBTD');
  clientPre.api.get = async (url) => {
    if (url === '/auth/me') return realAuthServiceProfilePayload;
  };

  const { Harness: HarnessPre, AuthProvider: AuthProviderPre, window: winPre } = createAuthContextHarness(clientPre, preFixAuthSource);
  const harnessPre = new HarnessPre(AuthProviderPre);
  harnessPre.render();
  await harnessPre.flushEffects();

  // Kích hoạt sự kiện thu hồi vai trò CBTD
  winPre.dispatchEvent(new CustomEvent('sme-role-invalidated', {
    detail: { token: 'token-user-1', requestedRole: 'CBTD', availableRoles: ['QUAN_LY'] }
  }));
  await new Promise(r => setTimeout(r, 20));

  const ctxPre = harnessPre.getContext();
  assert.equal(ctxPre.user, null, 'Bản cũ: Thiếu isActive bị đánh giá !profile.isActive === true -> logout sai!');
  assert.match(ctxPre.sessionError, /tạm khóa|bị khóa/, 'Bản cũ: Báo lỗi tài khoản bị khóa sai thực tế');

  // 2. CHỨNG MINH ĐẠT SAU SỬA (Post-fix):
  // Bản code sửa dùng: if (!profile || profile.isActive === false || !profile.roles?.length) logout();
  const clientPost = createMockClient();
  clientPost.setAuthToken('token-user-1');
  clientPost.setActiveRole('CBTD');
  clientPost.api.get = async (url) => {
    if (url === '/auth/me') return realAuthServiceProfilePayload;
  };

  const { Harness: HarnessPost, AuthProvider: AuthProviderPost, window: winPost } = createAuthContextHarness(clientPost);
  const harnessPost = new HarnessPost(AuthProviderPost);
  harnessPost.render();
  await harnessPost.flushEffects();

  winPost.dispatchEvent(new CustomEvent('sme-role-invalidated', {
    detail: { token: 'token-user-1', requestedRole: 'CBTD', availableRoles: ['QUAN_LY'] }
  }));
  await new Promise(r => setTimeout(r, 20));

  const ctxPost = harnessPost.getContext();
  assert.notEqual(ctxPost.user, null, 'Bản sửa: Chấp nhận payload thật của AuthService.getProfile');
  assert.equal(ctxPost.user.username, 'cbtd_hanoi', 'User được giữ nguyên vẹn');
  assert.equal(ctxPost.activeRole, 'QUAN_LY', 'Chuyển sang vai trò hợp lệ còn lại thành công');
  assert.match(ctxPost.sessionNotice, /tự động chuyển sang vai trò/, 'Hiển thị thông báo điều chỉnh phiên');
  assert.equal(ctxPost.sessionError, '', 'Không có lỗi session');
});

// =========================================================================
// CA 2: SỬA LOADING KHI restoreSession NHẬN 401/LOGOUT - PHẢI VỀ MÀN HÌNH ĐĂNG NHẬP
// =========================================================================
test('Ca 2: Loading state on 401/logout during restoreSession; proves pre-fix failure and post-fix success', async () => {
  // 1. CHỨNG MINH THẤT BẠI TRƯỚC SỬA (Pre-fix):
  // Bản cũ không gọi setLoading(false) trong logout() hoặc catch, và finally bị bỏ qua do sessionEpoch++
  const preFixAuthSource = fs.readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    .replace('setLoading(false);\n    [\'sme_demo_actor\'', '[\'sme_demo_actor\'')
    .replace('logout();\n        setLoading(false);', 'logout();');

  const clientPre = createMockClient();
  clientPre.setAuthToken('token-expired');
  clientPre.setActiveRole('CBTD');
  clientPre.api.get = async (url) => {
    if (url === '/auth/me') throw new clientPre.ApiError('Unauthorized', 401);
  };

  const { Harness: HarnessPre, AuthProvider: AuthProviderPre } = createAuthContextHarness(clientPre, preFixAuthSource);
  const harnessPre = new HarnessPre(AuthProviderPre);
  harnessPre.render();
  await harnessPre.flushEffects();
  await new Promise(r => setTimeout(r, 20));

  const ctxPre = harnessPre.getContext();
  assert.equal(ctxPre.loading, true, 'Bản cũ: loading kẹt true khiến AppContent vĩnh viễn hiển thị Đang kiểm tra phiên!');

  // 2. CHỨNG MINH ĐẠT SAU SỬA (Post-fix):
  const clientPost = createMockClient();
  clientPost.setAuthToken('token-expired');
  clientPost.setActiveRole('CBTD');
  clientPost.api.get = async (url) => {
    if (url === '/auth/me') throw new clientPost.ApiError('Unauthorized', 401);
  };

  const { Harness: HarnessPost, AuthProvider: AuthProviderPost } = createAuthContextHarness(clientPost);
  const harnessPost = new HarnessPost(AuthProviderPost);
  harnessPost.render();
  await harnessPost.flushEffects();
  await new Promise(r => setTimeout(r, 20));

  const ctxPost = harnessPost.getContext();
  assert.equal(ctxPost.loading, false, 'Bản sửa: loading chuyển về false ngay khi nhận 401/logout');
  assert.equal(ctxPost.user, null, 'User null sẵn sàng hiển thị màn hình LoginPage');
  assert.match(ctxPost.sessionError, /Phiên đăng nhập đã hết hạn/, 'Hiển thị đúng thông báo hết hạn');
});

// =========================================================================
// CA 3: NHÁNH LỖI PHỤC HỒI CŨ KHÔNG ĐƯỢC LOGOUT HOẶC THAY ĐỔI PHIÊN MỚI
// =========================================================================
test('Ca 3: Stale recovery error catch block must NOT logout or mutate new session; proves pre-fix failure and post-fix success', async () => {
  // 1. CHỨNG MINH THẤT BẠI TRƯỚC SỬA (Pre-fix):
  // Khối catch cũ của onRoleInvalidated không kiểm tra epoch/token:
  const preFixAuthSource = fs.readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    .replace('if (sessionEpoch.current !== currentEpoch || getAuthToken() !== token) return;\n          if (localStorage.getItem(\'sme_active_role\') !== currentRole) return;\n\n          const error = err as ApiError;', 'const error = err as ApiError;');

  let rejectDelayedMePre;
  const delayedMePromisePre = new Promise((_, reject) => { rejectDelayedMePre = reject; });

  const clientPre = createMockClient();
  clientPre.setAuthToken('token-user-A');
  clientPre.setActiveRole('CBTD');
  clientPre.api.get = async (url) => {
    if (url === '/auth/me') return delayedMePromisePre;
  };

  const { Harness: HarnessPre, AuthProvider: AuthProviderPre, window: winPre } = createAuthContextHarness(clientPre, preFixAuthSource);
  const harnessPre = new HarnessPre(AuthProviderPre);
  harnessPre.render();
  await harnessPre.flushEffects();

  // Kích hoạt phục hồi vai trò cho user A
  winPre.dispatchEvent(new CustomEvent('sme-role-invalidated', {
    detail: { token: 'token-user-A', requestedRole: 'CBTD', availableRoles: ['QUAN_LY'] }
  }));

  // Trong lúc /auth/me đang pending, user B đăng nhập vào hệ thống
  clientPre.api.post = async () => ({ accessToken: 'token-user-B', user: { id: 'usr-B', username: 'user_b', roles: ['THAM_QUYEN'] } });
  await harnessPre.getContext().login('user_b', 'pass');
  assert.equal(harnessPre.getContext().user?.username, 'user_b', 'User B đã đăng nhập thành công');

  // Giờ request /auth/me của user A giải quyết muộn và thất bại với 401
  rejectDelayedMePre(new clientPre.ApiError('Unauthorized', 401));
  await new Promise(r => setTimeout(r, 30));

  const ctxPreAfter = harnessPre.getContext();
  assert.equal(ctxPreAfter.user, null, 'Bản cũ: Lỗi phục hồi cũ của user A đã gọi logout() xóa sổ phiên của user B!');

  // 2. CHỨNG MINH ĐẠT SAU SỬA (Post-fix):
  let rejectDelayedMePost;
  const delayedMePromisePost = new Promise((_, reject) => { rejectDelayedMePost = reject; });

  const clientPost = createMockClient();
  clientPost.setAuthToken('token-user-A');
  clientPost.setActiveRole('CBTD');
  clientPost.api.get = async (url) => {
    if (url === '/auth/me') return delayedMePromisePost;
  };

  const { Harness: HarnessPost, AuthProvider: AuthProviderPost, window: winPost } = createAuthContextHarness(clientPost);
  const harnessPost = new HarnessPost(AuthProviderPost);
  harnessPost.render();
  await harnessPost.flushEffects();

  winPost.dispatchEvent(new CustomEvent('sme-role-invalidated', {
    detail: { token: 'token-user-A', requestedRole: 'CBTD', availableRoles: ['QUAN_LY'] }
  }));

  // User B đăng nhập vào hệ thống bằng hàm login thật của AuthProvider
  clientPost.api.post = async () => ({ accessToken: 'token-user-B', user: { id: 'usr-B', username: 'user_b', roles: ['THAM_QUYEN'] } });
  await harnessPost.getContext().login('user_b', 'pass');
  assert.equal(harnessPost.getContext().user?.username, 'user_b', 'User B đã đăng nhập thành công');

  // Giờ request cũ từ user A reject với 401
  rejectDelayedMePost(new clientPost.ApiError('Unauthorized', 401));
  await new Promise(r => setTimeout(r, 30));

  const ctxPostAfter = harnessPost.getContext();
  assert.notEqual(ctxPostAfter.user, null, 'Bản sửa: Lỗi phục hồi cũ bị hủy bỏ an toàn, không xóa phiên user B');
  assert.equal(ctxPostAfter.user?.username, 'user_b', 'User B vẫn đang đăng nhập và làm việc bình thường');
  assert.equal(clientPost.getAuthToken(), 'token-user-B', 'Token của User B được giữ nguyên vẹn');
});

// =========================================================================
// CA 4: PHẢN HỒI 403 CŨ KHÔNG TÁC ĐỘNG PHIÊN MỚI (api/client.ts)
// =========================================================================
test('Ca 4: Stale 403 response does NOT trigger recovery on new session even with same role', () => {
  const source = fs.readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8');
  assert.match(
    source,
    /currentToken\s*&&\s*currentToken\s*===\s*tokenAtRequest\s*&&\s*currentRole\s*===\s*roleAtRequest/,
    'client.ts bắt buộc kiểm tra cả token và role hiện tại trước khi dispatch sme-role-invalidated'
  );
});

// =========================================================================
// CA 5: ĐỔI VAI TRÒ THỦ CÔNG KHÔNG BỊ REVERT BỞI RECOVERY TRÌ HOÃN CŨ
// =========================================================================
test('Ca 5: Delayed recovery does NOT revert manual role change', async () => {
  let resolveAuthMe;
  const delayedMe = new Promise(resolve => { resolveAuthMe = resolve; });

  const client = createMockClient();
  client.setAuthToken('token-multi-role');
  client.setActiveRole('CBTD');
  client.api.get = async (url) => {
    if (url === '/auth/me') return delayedMe;
  };

  const { Harness, AuthProvider, window: win } = createAuthContextHarness(client);
  const harness = new Harness(AuthProvider);
  harness.render();
  await harness.flushEffects();

  // Khởi động phục hồi khi CBTD bị tước
  win.dispatchEvent(new CustomEvent('sme-role-invalidated', {
    detail: { token: 'token-multi-role', requestedRole: 'CBTD', availableRoles: ['QUAN_LY', 'THAM_QUYEN'] }
  }));

  // Trong lúc /auth/me đang pending, người dùng chủ động switch sang THAM_QUYEN
  const ctx = harness.getContext();
  // Giả lập user ban đầu có roles
  ctx.selectRole('THAM_QUYEN');
  client.setActiveRole('THAM_QUYEN');

  // Giờ /auth/me mới trả về kết quả
  resolveAuthMe(realAuthServiceProfilePayload);
  await new Promise(r => setTimeout(r, 30));

  assert.equal(client.localStorage.getItem('sme_active_role'), 'THAM_QUYEN', 'Vai trò đã chọn thủ công không bị ghi đè bởi recovery cũ');
});

// =========================================================================
// CA 6: LỖI MẠNG / TIMEOUT (408) / 5XX KHÔNG XÓA TOKEN VÀ KHÔNG KẾT LUẬN KHÓA TÀI KHOẢN
// =========================================================================
test('Ca 6: Network error, timeout (408), or 5xx does NOT clear token or conclude locked in AuthProvider', async () => {
  for (const status of [0, 408, 500, 502]) {
    const client = createMockClient();
    client.setAuthToken('token-active');
    client.setActiveRole('CBTD');
    client.api.get = async (url) => {
      if (url === '/auth/me') throw new client.ApiError('Transient error', status);
    };

    const { Harness, AuthProvider } = createAuthContextHarness(client);
    const harness = new Harness(AuthProvider);
    harness.render();
    await harness.flushEffects();
    await new Promise(r => setTimeout(r, 10));

    const ctx = harness.getContext();
    assert.equal(client.getAuthToken(), 'token-active', `Status ${status} không được xóa token`);
    assert.equal(ctx.loading, false, `Status ${status} phải kết thúc loading`);
    assert.match(ctx.sessionError, /Không thể kết nối máy chủ/i, `Status ${status} hiển thị lỗi kết nối có thể thử lại`);
  }
});

// =========================================================================
// CA 7: WORKSPACE HIỂN THỊ BANNER THÔNG BÁO PHỤC HỒI
// =========================================================================
test('Ca 7: Workspace renders session-recovery-banner when sessionNotice is present', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /sessionNotice\s*&&/, 'Phải có điều kiện render sessionNotice');
  assert.match(appSource, /session-recovery-banner/, 'Phải có class session-recovery-banner');
  assert.match(appSource, /clearSessionNotice/, 'Phải có nút đóng gọi clearSessionNotice');
});
