import { completeSetup, setupError } from '../shared/fieldwork-profile.js';
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
   const finalized = req.body.entries.filter((entry: any) => entry?.status !== 'DRAFT');
   if (finalized.length) {
    if (finalized.some((entry: any) => typeof entry?.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(entry.id))) throw new CloudError('INVALID_ENTRIES',400);
    const profileRows: any = await cloudRequest('/rest/v1/learning_records?owner_id=eq.'+encodeURIComponent(user.id)+'&kind=eq.profile&select=payload&limit=1',token);
    if (!completeSetup(profileRows?.[0]?.payload?.fieldworkSetup)) {
     // Existing entries may still be corrected or deleted; no one loses historical access because onboarding is new.
     const ids = finalized.map((entry: any) => entry.id);
     const known: any = await cloudRequest('/rest/v1/entries?owner_id=eq.'+encodeURIComponent(user.id)+'&deleted_at=is.null&select=id&id=in.'+encodeURIComponent('('+ids.join(',')+')')+'&limit=500',token);
     const existing = new Set(Array.isArray(known) ? known.map((entry: any) => entry.id) : []);
     if (ids.some((id: string) => !existing.has(id))) throw new CloudError('FIELDWORK_PROFILE_REQUIRED',409);
    }
   }
   const next=await cloudRequest('/rest/v1/rpc/save_entries' ,token,{method:'POST',body:JSON.stringify({p_entries:req.body.entries,p_expected_version:version,p_delete_ids:req.body.deleteIds})});
   return res.status(200).json({version:next});
  }
  if(req.body?.action==='save-learning') {
   const kinds=['profile','exam-attempt','exam-result','weak-plan','brain-history','brain-resources','resource-saves','supervisors'];
   if(typeof req.body.kind!=='string'||!kinds.includes(req.body.kind))throw new CloudError('INVALID_RECORD_KIND',400);
   if (req.body.kind==='profile' && req.body.payload && typeof req.body.payload==='object' && 'fieldworkSetup' in req.body.payload) {
    const error=setupError((req.body.payload as {fieldworkSetup:unknown}).fieldworkSetup);
    if(error)throw new CloudError('INVALID_FIELDWORK_PROFILE',400);
   }
   const next=await cloudRequest('/rest/v1/rpc/save_learning' ,token,{method:'POST',body:JSON.stringify({p_kind:req.body.kind,p_payload:req.body.payload,p_expected_version:version})});
   return res.status(200).json({version:next});
  }
  throw new CloudError('INVALID_ACTION',400);
 } catch(error) {
  const failure=error instanceof CloudError?error:new CloudError('CLOUD_UNAVAILABLE');
  return res.status(failure.status).json({code:failure.code,error:failure.code==='FIELDWORK_PROFILE_REQUIRED'?'Complete your fieldwork profile before adding new hours. Existing records remain available.':failure.code==='INVALID_FIELDWORK_PROFILE'?'Complete the application timing, fieldwork type, organization and supervisor choices before saving.':failure.code==='VERSION_CONFLICT'?'Another device changed this record. Reload and review before saving.':'Cloud saving did not complete. Keep your local backup and retry.'});
 }
}
