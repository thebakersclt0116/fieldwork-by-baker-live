import {currentManagedToken} from './managedSession';
import {managedEmail} from './cloudWorkspace';
import type {SourceDocument,AuditBatch} from './migrationArchive';
function requireOwner(owner:string){if(managedEmail()!==owner.trim().toLowerCase())throw new Error('Account changed. Reopen the archive.');}
async function request(owner:string,body?:unknown,kind?:string,cursor?:string):Promise<any>{
 requireOwner(owner);const token=await currentManagedToken();requireOwner(owner);
 const query=new URLSearchParams();if(kind)query.set('kind',kind);if(cursor)query.set('cursor',cursor);
 const response=await fetch('/api/archive'+(query.size?'?'+query:''),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 const payload=await response.json();requireOwner(owner);if(!response.ok)throw new Error(payload.code==='STORAGE_LIMIT'?'Your archive has reached its current storage limit. Download a backup and contact support.':payload.error||'Cloud archive did not finish. Keep the original file.');return payload;
}
function storageUrl(value:unknown):URL{
 const url=new URL(String(value));if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||!url.pathname.startsWith('/storage/v1/object/'))throw new Error('Invalid private storage destination.');return url;
}
export async function archiveCloudOriginal(doc:SourceDocument){
 const owner=doc.owner;const prepared=await request(owner,{action:'prepare',hash:doc.hash});
 if(prepared.uploadNeeded){
  const url=storageUrl(prepared.url);const token=await currentManagedToken();requireOwner(owner);
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,apikey:prepared.publishableKey,'Content-Type':doc.mime||'application/octet-stream','x-upsert':'false'},body:new Uint8Array(doc.bytes),signal:AbortSignal.timeout(120000)});
  requireOwner(owner);if(!response.ok)throw new Error('Private upload did not finish. The original is retained here; retry to check its saved copy.');
 }
 await request(owner,{action:'complete',hash:doc.hash,filename:doc.filename,size:doc.size,mime:doc.mime,kind:doc.kind});
}
async function pages(owner:string,kind?:string){
 const rows:any[]=[];let cursor:string|undefined;const visited=new Set<string>();
 do{const page=await request(owner,undefined,kind,cursor);if(!Array.isArray(page.rows))throw new Error('Archive listing is unavailable.');rows.push(...page.rows);cursor=page.nextCursor||undefined;if(cursor){if(visited.has(cursor))throw new Error('Archive pagination did not finish.');visited.add(cursor);}}while(cursor);return rows;
}
export async function cloudDocuments(owner:string):Promise<SourceDocument[]>{return (await pages(owner)).map(row=>({id:'managed:'+owner+':'+row.sha256,owner,hash:row.sha256,filename:row.original_filename,size:row.bytes,mime:row.mime,kind:row.kind,savedAt:row.created_at,bytes:new Uint8Array(),cloudSaved:true}));}
export async function cloudBatches(owner:string):Promise<AuditBatch[]>{
 const grouped=new Map<string,AuditBatch>();const rank={prepared:0,failed:1,committed:2};
 for(const row of await pages(owner,'journals')){const batch=row.payload as AuditBatch;if(!batch||!['prepared','committed','failed'].includes(batch.state))throw new Error('Invalid archive journal.');const prior=grouped.get(batch.id);if(!prior||rank[batch.state]>rank[prior.state])grouped.set(batch.id,{...batch,owner});}
 return [...grouped.values()];
}
export async function saveCloudJournal(batch:AuditBatch){await request(batch.owner,{action:'journal',batch});}
export async function readCloudOriginal(doc:SourceDocument):Promise<Uint8Array>{
 const owner=doc.owner;const result=await request(owner,{action:'download',hash:doc.hash});const url=storageUrl(result.url);
 const response=await fetch(url,{signal:AbortSignal.timeout(120000)});requireOwner(owner);
 if(!response.ok||!response.body)throw new Error('Original download did not finish.');
 const reader=response.body.getReader();const parts:Uint8Array[]=[];let size=0;
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>doc.size||size>26214400){await reader.cancel();throw new Error('Original size verification failed.');}parts.push(part.value);}
 if(size!==doc.size)throw new Error('Original size verification failed.');const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}requireOwner(owner);return bytes;
}
