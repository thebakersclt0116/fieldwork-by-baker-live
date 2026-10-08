import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const dir=await mkdtemp(join(tmpdir(),'fieldwork-review-'));
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});});
await build({entryPoints:['server/managed-review.ts'],outfile:join(dir,'review.mjs'),bundle:true,platform:'node',format:'esm'});
const {readManagedReview,acceptManagedReview}=await import(pathToFileURL(join(dir,'review.mjs')));
process.env.SUPABASE_URL='https://synthetic-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic_public_test_key';
const invitation='c1.'+'a'.repeat(64);
const digest=createHash('sha256').update(invitation).digest('hex');
const user=()=>Response.json({id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',email:'reviewer@example.com',email_confirmed_at:'2026-10-06'});
const req=body=>({headers:{authorization:'Bearer synthetic-user-jwt'},body});
const res=()=>({code:0,headers:{},body:null,status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(v){this.body=v;return this;}});
test('a private invitation alone never grants access',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return user();};const response=res();
 await readManagedReview({body:{token:invitation}},response);
 assert.equal(response.code,401);assert.equal(calls,0);assert.equal(response.headers['Cache-Control'],'private, no-store');
});
test('review reads use the verified bearer identity and hashed invite, ignoring claimed reviewer',async()=>{
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer synthetic-user-jwt');
  if(url.endsWith('/user'))return user();
  assert.ok(url.endsWith('/rpc/read_review'));assert.deepEqual(JSON.parse(options.body),{p_hash:digest});
  return Response.json({reviewEntry:{narrative:'Fictional exact narrative',revision:3}});
 };
 const response=res();await readManagedReview(req({token:invitation,email:'someone-else@example.com'}),response);
 assert.equal(response.code,200);assert.equal(response.body.reviewEntry.narrative,'Fictional exact narrative');
});
test('a database refusal never exposes another account narrative',async()=>{
 globalThis.fetch=async url=>url.endsWith('/user')?user():Response.json({message:'REVIEW_NOT_AVAILABLE private narrative should never escape'},{status:400});
 const response=res();await readManagedReview(req({token:invitation}),response);
 assert.equal(response.code,403);assert.equal(JSON.stringify(response.body).includes('private narrative'),false);
});
test('approval pins revision and idempotency key while ignoring supplied entry or owner',async()=>{
 const body={invitation,revision:3,status:'VERIFIED',note:'Fictional note',message:'Fictional message',requestId:'88888888-8888-8888-8888-888888888888',entryId:'attacker-entry',ownerId:'attacker-owner'};
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/user'))return user();
  assert.ok(url.endsWith('/rpc/accept_review'));assert.deepEqual(JSON.parse(options.body),{p_hash:digest,p_revision:3,p_status:'VERIFIED',p_note:'Fictional note',p_message:'Fictional message',p_request_id:body.requestId});
  return Response.json({saved:true});
 };
 const response=res();await acceptManagedReview(req(body),response);assert.equal(response.code,200);assert.equal(response.body.saved,true);
});
test('stale approval is an explicit conflict and is never automatically retried',async()=>{
 let writes=0;globalThis.fetch=async url=>{if(url.endsWith('/user'))return user();writes++;return Response.json({message:'VERSION_CONFLICT'},{status:400});};
 const response=res();await acceptManagedReview(req({invitation,revision:3,status:'VERIFIED',note:'note',message:'',requestId:'88888888-8888-8888-8888-888888888888'}),response);
 assert.equal(response.code,409);assert.equal(writes,1);assert.equal(response.body.code,'VERSION_CONFLICT');
});
