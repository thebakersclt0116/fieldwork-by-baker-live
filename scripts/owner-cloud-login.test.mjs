import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'owner-cloud-login-'));
const original = globalThis.fetch;
after(async () => { globalThis.fetch = original; delete globalThis.localStorage; delete globalThis.window; await rm(dir,{recursive:true,force:true}); });
await build({ entryPoints:['src/hooks/useAuth.ts'],outfile:join(dir,'auth.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'isolated-hooks',setup(build){
 build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
 build.onResolve({filter:/^@\/lib\/acquisitionFunnel$/},()=>({path:'funnel',namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='react'?`export const useState=initial=>[typeof initial==='function'?initial():initial,()=>{}];export const useEffect=()=>{};export const useCallback=callback=>callback;`:`export const accountFunnelInput=()=>({});`,loader:'js'}));
 }}]});
const {useAuth}=await import(pathToFileURL(join(dir,'auth.mjs')));
function setup() { const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};globalThis.window={dispatchEvent(){},location:{}};return values; }
test('verified cloud account with empty name stays managed and preserves server role',async()=>{
 const values=setup();let calls=0;globalThis.fetch=async(url)=>{calls++;assert.equal(url,'/api/account');return Response.json({token:'synthetic-access',refreshToken:'synthetic-refresh',expiresAt:9999999999,user:{name:'',email:'owner@example.invalid',role:'owner'}});};
 assert.equal(await useAuth().login('owner@example.invalid','synthetic-password',{managedOnly:true}),true);assert.equal(calls,1);
 const saved=JSON.parse(values.get('authUser'));assert.equal(saved.authProvider,'supabase');assert.equal(saved.name,'owner');assert.equal(saved.role,'owner');
});
test('cloud-only owner flow never falls back when managed credentials fail',async()=>{
 setup();const paths=[];globalThis.fetch=async(url)=>{paths.push(url);return Response.json({code:'AUTH_REQUIRED'},{status:401});};
 assert.equal(await useAuth().login('owner@example.invalid','synthetic-password',{managedOnly:true}),false);assert.deepEqual(paths,['/api/account']);
});
test('normal legacy fallback remains available and cannot manufacture a managed session',async()=>{
 const values=setup();const paths=[];globalThis.fetch=async(url)=>{paths.push(url);return url==='/api/account'?Response.json({},{status:401}):Response.json({token:'synthetic-legacy',user:{name:'Synthetic Owner',email:'owner@example.invalid',role:'owner'}});};
 assert.equal(await useAuth().login('owner@example.invalid','synthetic-password'),true);assert.deepEqual(paths,['/api/account','/api/auth']);assert.equal(JSON.parse(values.get('authUser')).authProvider,undefined);assert.equal(values.has('bakerManagedSession'),false);
});
test('managed sign-in never elevates a nonowner based on email or owner-flow selection',async()=>{
 const values=setup();globalThis.fetch=async()=>Response.json({token:'synthetic-access',refreshToken:'synthetic-refresh',expiresAt:9999999999,user:{name:'',email:'justin@bakerholdings.co',role:'free'}});
 assert.equal(await useAuth().login('justin@bakerholdings.co','synthetic-password',{managedOnly:true}),true);assert.equal(JSON.parse(values.get('authUser')).role,'free');
});
