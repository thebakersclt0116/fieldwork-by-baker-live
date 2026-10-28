import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountEntryPath, safeReturnPath } from '../src/lib/returnPath.ts';

test('feature intent survives protected login and new-account links', () => {
  const destination = '/exam-lab?practice=full';
  const login = new URL(accountEntryPath('/login', destination), 'https://fieldwork.invalid');
  const signup = new URL(accountEntryPath('/signup', safeReturnPath(login.searchParams.get('return'))), login.origin);
  assert.equal(signup.pathname, '/signup');
  assert.equal(safeReturnPath(signup.searchParams.get('return')), destination);
});

test('external destinations and browser-normalized auth loops fall back safely', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/\n/example.com', '/a/..//example.com', '/%2e%2e//example.com', '/a/../login', '/signup?return=/exam-lab', '/login/', '/login//', '/reset-password']) {
    assert.equal(safeReturnPath(value, '/upgrade'), '/upgrade', value);
  }
  assert.equal(safeReturnPath(null), '/dashboard');
  assert.equal(safeReturnPath('/' + 'x'.repeat(2048)), '/dashboard');
});

test('local feature queries and encoded punctuation stay local without double decoding', () => {
  const destination = '/import/ripley?source=monthly%20report&tab=review#totals';
  const entry = new URL(accountEntryPath('/login', destination), 'https://fieldwork.invalid');
  assert.equal(entry.origin, 'https://fieldwork.invalid');
  assert.equal(safeReturnPath(entry.searchParams.get('return')), destination);
  assert.equal(safeReturnPath('/%2Fexample.com'), '/%2Fexample.com');
});
