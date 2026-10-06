import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {currentManagedToken,renewManagedSession,MANAGED_SESSION_KEY} from '../src/lib/managedSession.ts';
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch;delete globalThis.localStorage;});
function setup(){const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};return values;}
test('concurrent cloud calls renew a rotating refresh token once',async()=>{
 const values=setup();values.set(MANAGED_SESSION_KEY,JSON.stringify({refreshToken:'synthetic-old',expiresAt:1}));values.set('bakerSessionToken','expired');let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).refreshToken,'synthetic-old');return Response.json({token:'synthetic-new',refreshToken:'synthetic-rotated',expiresAt:9999999999,user:{name:'Synthetic Candidate',email:'candidate@example.invalid',role:'free'}});};
 assert.deepEqual(await Promise.all([currentManagedToken(),currentManagedToken(),currentManagedToken()]),['synthetic-new','synthetic-new','synthetic-new']);assert.equal(calls,1);assert.equal(JSON.parse(values.get(MANAGED_SESSION_KEY)).refreshToken,'synthetic-rotated');
});
test('signing out while renewal is in flight cannot silently recreate the old session',async()=>{
 const values=setup();values.set(MANAGED_SESSION_KEY,JSON.stringify({refreshToken:'synthetic-old',expiresAt:1}));let finish;
 globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});const pending=renewManagedSession();values.delete(MANAGED_SESSION_KEY);
 finish(Response.json({token:'synthetic-new',refreshToken:'synthetic-rotated',expiresAt:9999999999,user:{name:'Synthetic Candidate',email:'candidate@example.invalid',role:'free'}}));
 await assert.rejects(pending,/Account changed/);assert.equal(values.has('bakerSessionToken'),false);assert.equal(values.has('authUser'),false);
});
