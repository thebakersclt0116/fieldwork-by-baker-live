import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'fieldwork-cloud-'));
after(()=>rm(dir,{recursive:true,force:true}));
await build({entryPoints:['api/workspace.ts'],outfile:join(dir,'workspace.mjs'),bundle:true,platform:'node',format:'esm'});
const {default:workspace}=await import(pathToFileURL(join(dir,'workspace.mjs')));
await build({entryPoints:['api/account.ts'],outfile:join(dir,'account.mjs'),bundle:true,platform:'node',format:'esm'});
const {default:account}=await import(pathToFileURL(join(dir,'account.mjs')));
await build({entryPoints:['api/_auth.ts'],outfile:join(dir,'auth.mjs'),bundle:true,platform:'node',format:'esm'});
const {requireAccountSession,canUsePaidTools}=await import(pathToFileURL(join(dir,'auth.mjs')));
process.env.SUPABASE_URL='https://synthetic-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic_public_test_key';
const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch;});
function res(){return {code:0,headers:{},body:null,status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(v){this.body=v;}};}
const req=(body,method='POST')=>({method,headers:{authorization:'Bearer synthetic-user-jwt'},body});
const user=()=>Response.json({id:owner,email:'a@example.com',email_confirmed_at:'2026-10-06T00:00:00Z'});
test('workspace refuses unauthenticated requests without an upstream call',async()=>{
 let called=false;globalThis.fetch=async()=>{called=true;throw Error();};const response=res();await workspace({method:'GET'},response);assert.equal(response.code,401);assert.equal(called,false);
});
test('unverified identity cannot read cloud records',async()=>{
 globalThis.fetch=async()=>Response.json({id:owner,email:'a@example.com',email_confirmed_at:null});const response=res();await workspace(req(null,'GET'),response);assert.equal(response.code,401);
});
test('workspace reads retain the user JWT and filter by verified owner, ignoring supplied owner',async()=>{
 const seen=[];globalThis.fetch=async(url,options)=>{seen.push({url,headers:options.headers});if(url.endsWith('/auth/v1/user'))return user();return Response.json([]);};const response=res();await workspace({...req(null,'GET'),query:{owner_id:'another-owner'}},response);
 assert.equal(response.code,200);assert.equal(response.body.ownerId,owner);assert.ok(seen.slice(1).every(r=>r.url.includes('owner_id=eq.'+owner)));assert.ok(seen.every(r=>r.headers.Authorization==='Bearer synthetic-user-jwt'));assert.equal(response.headers['Cache-Control'],'private, no-store');
});
test('users cannot write their own subscription/role through a learning record',async()=>{
 globalThis.fetch=async()=>user();const response=res();await workspace(req({action:'save-learning',kind:'role',payload:'owner',expectedVersion:0}),response);assert.equal(response.code,400);
});
test('stale concurrent writes fail explicitly and never retry as an overwrite',async()=>{
 let calls=0;globalThis.fetch=async(url)=>{calls++;return url.endsWith('/auth/v1/user')?user():Response.json({message:'VERSION_CONFLICT'},{status:400});};const response=res();await workspace(req({action:'save-entries',entries:[],deleteIds:[],expectedVersion:3}),response);assert.equal(response.code,409);assert.equal(response.body.code,'VERSION_CONFLICT');assert.equal(calls,2);
});
test('provider failures never echo upstream credential or data details',async()=>{
 globalThis.fetch=async()=>Response.json({message:'private prompt SECRET_EXAMPLE'},{status:500});const response=res();await workspace(req(null,'GET'),response);assert.equal(response.code,502);assert.equal(JSON.stringify(response.body).includes('SECRET_EXAMPLE'),false);
});
test('signup sends only name metadata and requires confirmation rather than granting client roles',async()=>{
 let sent;globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return Response.json({user:{id:owner}});};
 const response=res();await account(req({action:'signup',name:'Example User',email:'a@example.com',password:'synthetic-password',role:'owner',trialEndsAt:9999999999}),response);
 assert.equal(response.code,202);assert.deepEqual(sent,{email:'a@example.com',password:'synthetic-password',data:{name:'Example User'}});assert.equal(response.body.token,undefined);
});
test('signup detects accidentally disabled email confirmation',async()=>{
 globalThis.fetch=async()=>Response.json({access_token:'synthetic-token'});const response=res();await account(req({action:'signup',name:'Example User',email:'a@example.com',password:'synthetic-password'}),response);assert.equal(response.code,503);assert.equal(response.body.code,'EMAIL_CONFIRMATION_NOT_CONFIGURED');
});
test('login derives entitlements from protected profile data after verifying identity',async()=>{
 globalThis.fetch=async(url)=>url.includes('/token?')?Response.json({access_token:'synthetic-token',refresh_token:'synthetic-refresh',expires_at:123}):url.endsWith('/user')?user():Response.json([{display_name:'Example User',role:'professional',subscription_tier:'professional',subscription_status:'canceled',trial_ends_at:null}]);
 const response=res();await account(req({action:'login',email:'a@example.com',password:'synthetic-password',role:'owner'}),response);assert.equal(response.code,200);assert.equal(response.body.user.role,'free');assert.equal(response.body.user.subscription,'none');
});
test('refresh obtains a rotated session and rechecks identity and paid state',async()=>{
 let sent;globalThis.fetch=async(url,options)=>{
  if(url.includes('grant_type=refresh_token')){sent=JSON.parse(options.body);assert.equal(options.headers.Authorization,undefined);return Response.json({access_token:'rotated-access',refresh_token:'rotated-refresh',expires_at:456});}
  return url.endsWith('/user')?user():Response.json([{display_name:'Example User',role:'free',subscription_tier:'individual',subscription_status:'active'}]);
 };
 const response=res();await account(req({action:'refresh',refreshToken:'synthetic-refresh'}),response);assert.deepEqual(sent,{refresh_token:'synthetic-refresh'});assert.equal(response.code,200);assert.equal(response.body.refreshToken,'rotated-refresh');assert.equal(response.body.user.role,'paid');
});
test('logout revokes the verified current session without revoking other devices',async()=>{
 let endpoint;globalThis.fetch=async(url)=>{endpoint=url;return url.endsWith('/user')?user():new Response(null,{status:204});};
 const response=res();await account(req({action:'logout'}),response);assert.equal(response.code,200);assert.ok(endpoint.endsWith('/logout?scope=local'));
});
test('managed protected APIs ignore claimed roles and do not grant legacy email-based beta privileges',async()=>{
 globalThis.fetch=async(url)=>url.endsWith('/user')?Response.json({id:owner,email:'ayalaemily52@gmail.com',email_confirmed_at:'2026-10-06T00:00:00Z'}):Response.json([{display_name:'Synthetic User',role:'professional',subscription_status:'canceled',subscription_tier:'professional',trial_ends_at:null}]);
 const session=await requireAccountSession(req(null));assert.equal(session.role,'free');assert.equal(session.accountId,owner);assert.equal(canUsePaidTools(session),false);
});
test('managed protected APIs fail closed when the provider cannot verify the account',async()=>{
 globalThis.fetch=async()=>Response.json({id:owner,email:'a@example.com',email_confirmed_at:null});assert.equal(await requireAccountSession(req(null)),null);
});
