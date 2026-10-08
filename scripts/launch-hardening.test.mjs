import { accountStorageKey } from '../src/lib/accountStorage.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursBetween } from '../src/lib/fieldworkStore.ts';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after } from 'node:test';
const output = await mkdtemp(join(tmpdir(), 'baker-hardening-'));
after(() => rm(output, { recursive: true, force: true }));
await build({ entryPoints: ['api/_auth.ts', 'api/supervisor-feedback.ts'], outdir: output, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' } });
const { signSession } = await import(pathToFileURL(join(output, '_auth.mjs')));
const { default: feedback } = await import(pathToFileURL(join(output, 'supervisor-feedback.mjs')));

process.env.BAKER_SESSION_SECRET = 'synthetic-local-test-secret-only-never-deploy';
function response() {
  return { code: 0, headers: {}, body: null, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; return this; }, send(body) { this.body = JSON.parse(body); return this; } };
}
test('time records retain exact elapsed minutes while displaying familiar decimals', () => {
  for (const [start, end, minutes, display] of [['08:30','10:15',105,'1.75'],['08:30','12:07',217,'3.62'],['08:30','08:55',25,'0.42']]) {
    const value = hoursBetween(start,end);
    assert.equal(value,minutes/60);
    assert.equal(value.toFixed(2),display);
  }
  assert.ok(Math.abs(Array.from({length:60},()=>hoursBetween('08:30','08:55')).reduce((a,b)=>a+b,0)-25)<1e-10);
  for (const [start,end] of [['24:00','25:00'],['08:60','09:00'],['','09:00'],['09:00','08:00'],['09:00','09:00']]) assert.equal(hoursBetween(start,end),0);
});
test('supervisor cannot submit feedback for a different entry', async () => {
  const token = signSession({email:'supervisor@example.com',name:'Fictional Supervisor',role:'supervisor',superviseeEmail:'candidate@example.com',reviewEntry:{id:'assigned-entry',date:'2026-01-01',duration:1,activityCategory:'UNRESTRICTED',narrative:'Synthetic educational record'}});
  const res = response();
  await feedback({method:'POST',headers:{authorization:'Bearer '+token},body:{entryId:'another-entry',status:'VERIFIED'}},res);
  assert.equal(res.code,403);
  assert.equal(res.body.feedbackToken,undefined);
  assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('supervisor may submit feedback for the assigned entry', async () => {
  const token = signSession({email:'supervisor@example.com',name:'Fictional Supervisor',role:'supervisor',superviseeEmail:'candidate@example.com',reviewEntry:{id:'assigned-entry',date:'2026-01-01',duration:1,activityCategory:'UNRESTRICTED',narrative:'Synthetic educational record'}});
  const res = response();
  await feedback({method:'POST',headers:{authorization:'Bearer '+token},body:{entryId:'assigned-entry',status:'VERIFIED'}},res);
  assert.equal(res.code,200);
  assert.ok(res.body.feedbackToken);
});

test('learning storage isolates accounts and never falls back to legacy shared records', () => {
  const storage = email => ({ getItem: () => JSON.stringify({ email }) });
  const key = 'fieldworkByBaker:examLab:lastResult:v2';
  assert.notEqual(accountStorageKey(key, storage('a@example.com')),accountStorageKey(key, storage('b@example.com')));
  assert.equal(accountStorageKey(key, storage(' A@EXAMPLE.COM ')),accountStorageKey(key, storage('a@example.com')));
  assert.notEqual(accountStorageKey(key,storage('a@example.com')),key);
  assert.throws(() => accountStorageKey(key,storage('')),/Sign in/);
});
