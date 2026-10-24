import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/passwordRules.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const rules = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const modal = await readFile(new URL('../src/components/ChangePasswordModal.tsx', import.meta.url), 'utf8');
const navbar = await readFile(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');

test('minimum length matches the backend ChangePasswordDto (8 characters)', () => {
  assert.equal(rules.MIN_PASSWORD_LENGTH, 8);
});

test('validation rejects empty current password, short new password and mismatched confirmation', () => {
  assert.match(rules.validatePasswordChange('', 'password1', 'password1'), /mật khẩu hiện tại/);
  assert.match(rules.validatePasswordChange('old', 'short', 'short'), /ít nhất 8 ký tự/);
  assert.match(rules.validatePasswordChange('old', 'password1', 'password2'), /không khớp/);
  assert.equal(rules.validatePasswordChange('old', 'password1', 'password1'), '');
});

test('modal calls the existing change-password endpoint and navbar exposes it', () => {
  assert.match(modal, /api\.post\('\/auth\/change-password', \{ oldPassword, newPassword \}\)/);
  assert.match(navbar, /ChangePasswordModal/);
  assert.match(navbar, /Đổi mật khẩu/);
});
