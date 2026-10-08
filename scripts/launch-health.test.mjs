import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'fieldwork-health-'));
after(()=>rm(dir,{recursive:true,force:true}));
await build({entryPoints:['api/health.ts'],outfile:join(dir,'health.cjs'),bundle:true,platform:'node',format:'cjs'});
const module=await import(pathToFileURL(join(dir,'health.cjs')));
const handler=module.default.default;
Object.assign(process.env,{VERCEL_ENV:'production',BAKER_LAUNCH_VERIFIED:'true',BAKER_BILLING_ENABLED:'true',BAKER_STRIPE_SECRET_KEY:'rk_live_fictional',STRIPE_WEBHOOK_SECRET:'whsec_fictional',SUPABASE_SECRET_KEY:'sb_secret_fictional',SUPABASE_URL:'https://fictional.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictional',RESEND_API_KEY:'fictional',BAKER_NOTIFICATION_FROM:'fictional@example.invalid',BAKER_SESSION_SECRET:'fictional-secret-for-tests-at-least-32-characters',AI_GATEWAY_API_KEY:'fictional'});
async function health(){const r={status(n){assert.equal(n,200);return this;},json(v){this.body=v;return this;}};await handler({method:'GET'},r);return r.body;}
test('production readiness requires recorded verification and all configured services',async()=>{const v=await health();assert.equal(v.publicLaunchReady,true);assert.equal(v.storageMode,'account-cloud');assert.equal(v.cloudStorageConnected,true);delete process.env.BAKER_LAUNCH_VERIFIED;assert.equal((await health()).publicLaunchReady,false);assert.equal((await health()).cloudStorageConnected,false);process.env.BAKER_LAUNCH_VERIFIED='true';});
test('preview never claims production readiness',async()=>{process.env.VERCEL_ENV='preview';assert.equal((await health()).publicLaunchReady,false);process.env.VERCEL_ENV='production';});
test('missing cloud or email configuration cannot pass readiness',async()=>{delete process.env.RESEND_API_KEY;assert.equal((await health()).publicLaunchReady,false);process.env.RESEND_API_KEY='fictional';delete process.env.SUPABASE_PUBLISHABLE_KEY;const v=await health();assert.equal(v.publicLaunchReady,false);assert.equal(v.storageMode,'unconfigured');});
