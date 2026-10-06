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
await build({entryPoints:['api/archive.ts'],outfile:join(dir,'archive.mjs'),bundle:true,platform:'node',format:'esm'});
const {default:archive}=await import(pathToFileURL(join(dir,'archive.mjs')));
await build({entryPoints:['api/_auth.ts'],outfile:join(dir,'auth.mjs'),bundle:true,platform:'node',format:'esm'});
const {requireAccountSession,canUsePaidTools}=await import(pathToFileURL(join(dir,'auth.mjs')));
process.env.SUPABASE_URL='https://synthetic-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic_public_test_key';
const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch;});
test('recovery email uses only the canonical reset destination and returns no account details',async()=>{
 let called=false;globalThis.fetch=async(url,options)=>{called=true;assert.ok(String(url).includes(encodeURIComponent('https://www.fieldworkbybaker.com/reset-password')));assert.deepEqual(JSON.parse(options.body),{email:'candidate@example.com'});return new Response('{}',{status:200});};
 const result=res();await account({method:'POST',body:{action:'recover',email:'candidate@example.com',redirectTo:'https://attacker.invalid'}},result);
 assert.ok(called);assert.equal(result.code,202);assert.equal(result.body.token,undefined);assert.equal(result.body.user,undefined);
});
test('password reset requires provider-verified identity and never returns recovery credentials',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});if(options.method==='PUT')assert.deepEqual(JSON.parse(options.body),{password:'synthetic-new-password'});return new Response(JSON.stringify(String(url).endsWith('/user')&&options.method!=='PUT'?{id:owner,email:'candidate@example.com',email_confirmed_at:'2026-01-01'}:{}),{status:200});};
 const missing=res();await account({method:'POST',headers:{},body:{action:'reset-password',password:'synthetic-new-password'}},missing);assert.equal(missing.code,401);assert.equal(calls.length,0);
 const result=res();await account({method:'POST',headers:{authorization:'Bearer synthetic-recovery'},body:{action:'reset-password',password:'synthetic-new-password',role:'owner'}},result);
 assert.equal(result.code,200);assert.equal(result.body.passwordChanged,true);assert.equal(result.body.token,undefined);assert.equal(calls.length,3);assert.ok(calls[2].url.includes('scope=global'));
});
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
test('original uploads cannot choose another account path or overwrite an original',async()=>{
 const seen=[];globalThis.fetch=async(url,options)=>{seen.push({url,options});return url.endsWith('/user')?user():Response.json(true);};
 const result=res();const hash='a'.repeat(64);await archive(req({action:'prepare',hash,ownerId:'another-account',path:'other/original'}),result);
 assert.equal(result.code,200);assert.equal(result.body.url,'https://synthetic-project.supabase.co/storage/v1/object/fieldwork-originals/'+owner+'/'+hash);
 assert.deepEqual(JSON.parse(seen[1].options.body),{p_hash:hash});assert.ok(seen.every(call=>call.options.headers.Authorization==='Bearer synthetic-user-jwt'));
});
test('original completion rejects changed bytes and never records a successful archive',async()=>{
 let writes=0;globalThis.fetch=async(url)=>{if(url.endsWith('/user'))return user();if(url.includes('/storage/'))return new Response('changed original');writes++;return Response.json(null);};
 const result=res();await archive(req({action:'complete',hash:'a'.repeat(64),filename:'fixture.txt',size:16,mime:'text/plain',kind:'supporting-document'}),result);
 assert.equal(result.code,409);assert.equal(writes,0);assert.equal(result.body.code,'ORIGINAL_NOT_VERIFIED');
});
test('private original download expires after 60 seconds and remains limited to its verified owner',async()=>{
 const hash='b'.repeat(64);globalThis.fetch=async(url,options)=>{if(url.endsWith('/user'))return user();assert.equal(url,'https://synthetic-project.supabase.co/storage/v1/object/sign/fieldwork-originals/'+owner+'/'+hash);assert.deepEqual(JSON.parse(options.body),{expiresIn:60});return Response.json({signedURL:'/object/sign/fieldwork-originals/'+owner+'/'+hash+'?token=synthetic'});};
 const result=res();await archive(req({action:'download',hash}),result);assert.equal(result.code,200);assert.ok(result.body.url.includes('/'+owner+'/'+hash+'?'));
});
test('archive list ignores claimed account identifiers and never exposes originals or upload tokens',async()=>{
 globalThis.fetch=async(url)=>{if(url.endsWith('/user'))return user();assert.ok(url.includes('owner_id=eq.'+owner));return Response.json([]);};
 const result=res();await archive({...req(null,'GET'),query:{ownerId:'another-account'}},result);assert.equal(result.code,200);assert.deepEqual(result.body,{rows:[],nextCursor:null});
});
