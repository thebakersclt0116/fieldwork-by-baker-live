import { getBearerToken } from './_auth.js';
import { CloudError, cloudRequest, verifyCloudUser } from '../server/cloud-client.js';

interface Request { method?: string; headers?: Record<string,string|string[]|undefined>; body?: { action?: string; entries?: unknown; deleteIds?: unknown; expectedVersion?: unknown; kind?: unknown; payload?: unknown }; query?: { cursor?: unknown } }
interface Response { status(code:number):Response; setHeader(key:string,value:string):void; json(body:unknown):void }
export default async function handler(req:Request,res:Response) {
 res.setHeader('Cache-Control','private, no-store');
 if (!['GET','POST'].includes(req.method||'')) { res.setHeader('Allow','GET, POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'}); }
 const token=getBearerToken(req);
 if (!token) return res.status(401).json({code:'AUTH_REQUIRED'});
 try {
  const user=await verifyCloudUser(token);
  if(req.method==='GET') {
   const cursor=String(req.query?.cursor||'');
   if(cursor.length>300)throw new CloudError('INVALID_CURSOR',400);
   const filter='owner_id=eq.'+encodeURIComponent(user.id);
   const [workspace,entries,learning]=await Promise.all([
    cloudRequest('/rest/v1/workspaces?'+filter+'&select=version',token),
    cloudRequest('/rest/v1/entries?'+filter+'&deleted_at=is.null&select=id,revision,payload&order=id.asc&limit=501'+(cursor?'&id=gt.'+encodeURIComponent(cursor):''),token),
    cloudRequest('/rest/v1/learning_records?'+filter+'&select=kind,version,payload',token),
   ]);
   if(!Array.isArray(entries)||!Array.isArray(workspace)||!Array.isArray(learning))throw new CloudError('INVALID_CLOUD_RESPONSE');
   return res.status(200).json({ownerId:user.id,version:workspace[0]?.version||0,entries:entries.slice(0,500),nextCursor:entries.length>500?entries[499].id:null,learning});
  }
  const size=Buffer.byteLength(JSON.stringify(req.body||{}));
  if(size>2*1024*1024)throw new CloudError('REQUEST_TOO_LARGE',413);
  const version=req.body?.expectedVersion;
  if(typeof version!=='number'||!Number.isSafeInteger(version)||version<0)throw new CloudError('INVALID_VERSION',400);
  if(req.body?.action==='save-entries') {
   if(!Array.isArray(req.body.entries)||req.body.entries.length>500||!Array.isArray(req.body.deleteIds)||req.body.deleteIds.length>500)throw new CloudError('INVALID_ENTRIES',400);
   const next=await cloudRequest('/rest/v1/rpc/save_entries',token,{method:'POST',body:JSON.stringify({p_entries:req.body.entries,p_expected_version:version,p_delete_ids:req.body.deleteIds})});
   return res.status(200).json({version:next});
  }
  if(req.body?.action==='save-learning') {
   const kinds=['profile','exam-attempt','exam-result','weak-plan','brain-history','brain-resources','resource-saves','supervisors'];
   if(typeof req.body.kind!=='string'||!kinds.includes(req.body.kind))throw new CloudError('INVALID_RECORD_KIND',400);
   const next=await cloudRequest('/rest/v1/rpc/save_learning',token,{method:'POST',body:JSON.stringify({p_kind:req.body.kind,p_payload:req.body.payload,p_expected_version:version})});
   return res.status(200).json({version:next});
  }
  throw new CloudError('INVALID_ACTION',400);
 } catch(error) {
  const failure=error instanceof CloudError?error:new CloudError('CLOUD_UNAVAILABLE');
  return res.status(failure.status).json({code:failure.code,error:failure.code==='VERSION_CONFLICT'?'Another device changed this record. Reload and review before saving.':'Cloud saving did not complete. Keep your local backup and retry.'});
 }
}
