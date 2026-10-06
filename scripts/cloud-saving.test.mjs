import {test,after} from 'node:test';
import assert from 'node:assert/strict';
const originalFetch=globalThis.fetch;
after(()=>{globalThis.fetch=originalFetch;delete globalThis.localStorage;});
let sequence=0;
async function setup(){
 const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index],get length(){return values.size;}};
 localStorage.setItem('authUser',JSON.stringify({email:'candidate@example.com',authProvider:'supabase'}));localStorage.setItem('bakerSessionToken','synthetic-token');
 const cloud=await import('../src/lib/cloudWorkspace.ts?test='+sequence++);
 return {cloud,values};
}
function snapshot(version=0,entries=[]){return {ownerId:'synthetic-owner',version,entries:entries.map(payload=>({id:payload.id,revision:0,payload})),nextCursor:null,learning:[]};}
const response=body=>new Response(JSON.stringify(body),{status:200});
function settled(cloud){return new Promise(resolve=>{const off=cloud.subscribeCloud(()=>{if(['saved','blocked'].includes(cloud.cloudState())){off();resolve();}});});}
test('cloud hydration never imports legacy browser records into the managed account',async()=>{
 const {cloud,values}=await setup();values.set('fieldworkByBaker:v1:candidate@example.com:entries','private legacy records');let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.method,'GET');return response(snapshot());};
 await cloud.initializeCloud('candidate@example.com');assert.equal(calls,1);assert.equal(values.get('fieldworkByBaker:v1:candidate@example.com:entries'),'private legacy records');assert.equal(values.get(cloud.cloudKey('entries')),'[]');
});
test('unknown save outcome retains local draft and blocks further writes without retries',async()=>{
 const {cloud,values}=await setup();globalThis.fetch=async()=>response(snapshot());await cloud.initializeCloud('candidate@example.com');let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('network interrupted');};const done=settled(cloud);cloud.queueEntries([{id:'one',duration:1,date:'2026-01-01'}]);await done;
 assert.equal(cloud.cloudState(),'blocked');assert.equal(calls,1);assert.ok(values.has(cloud.cloudKey('pending')));assert.equal(JSON.parse(values.get(cloud.cloudKey('entries')))[0].id,'one');assert.throws(()=>cloud.queueEntries([]));
});
test('pending local drafts prevent hydration from overwriting them after reload',async()=>{
 const {cloud,values}=await setup();values.set(cloud.cloudKey('pending'),'{}');values.set(cloud.cloudKey('entries'),'retained draft');globalThis.fetch=async()=>{throw new Error('must not load');};
 await assert.rejects(cloud.initializeCloud('candidate@example.com'));assert.equal(values.get(cloud.cloudKey('entries')),'retained draft');
});
test('successful save reconciles authoritative revision and approval state before reporting saved',async()=>{
 const {cloud,values}=await setup();globalThis.fetch=async()=>response(snapshot());await cloud.initializeCloud('candidate@example.com');let writes=0;
 globalThis.fetch=async(url,options)=>{if(options.method==='POST'){writes++;assert.equal(JSON.parse(options.body).expectedVersion,0);return response({version:1});}return response(snapshot(1,[{id:'one',status:'PENDING',duration:1,date:'2026-01-01'}]));};
 const done=settled(cloud);cloud.queueEntries([{id:'one',status:'VERIFIED',duration:1,date:'2026-01-01'}]);await done;
 assert.equal(writes,1);assert.equal(cloud.cloudState(),'saved');assert.equal(values.has(cloud.cloudKey('pending')),false);assert.equal(JSON.parse(values.get(cloud.cloudKey('entries')))[0].status,'PENDING');
});
test('explicit conflict recovery keeps a separate copy of the unsaved draft before loading cloud records',async()=>{
 const {cloud,values}=await setup();values.set(cloud.cloudKey('pending'),'{}');values.set(cloud.cloudKey('entries'),JSON.stringify([{id:'unsaved'}]));
 globalThis.fetch=async()=>response(snapshot(3,[{id:'cloud-entry',duration:1,date:'2026-01-01'}]));
 await cloud.useCloudCopy();const backup=[...values.entries()].find(([key])=>key.startsWith('fieldwork:recovery:'));
 assert.ok(backup);assert.equal(JSON.parse(JSON.parse(backup[1]).entries)[0].id,'unsaved');assert.equal(JSON.parse(values.get(cloud.cloudKey('entries')))[0].id,'cloud-entry');assert.equal(cloud.cloudState(),'saved');
});
