import {createHash} from 'node:crypto';
import {getBearerToken} from './_auth.js';
import {CloudError,cloudConfiguration,cloudRequest,verifyCloudUser} from '../server/cloud-client.js';
interface Request {method?:string;headers?:Record<string,string|string[]|undefined>;body?:{action?:string;hash?:string;filename?:string;size?:number;mime?:string;kind?:string;batch?:unknown};query?:{kind?:unknown;cursor?:unknown}}
interface Response {status(code:number):Response;setHeader(key:string,value:string):void;json(body:unknown):void}
const validHash=(hash:unknown):hash is string=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash);
const bucket='fieldwork-originals';
export default async function handler(req:Request,res:Response){
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','POST'].includes(req.method||'')){res.setHeader('Allow','GET, POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
 const token=getBearerToken(req);if(!token)return res.status(401).json({code:'AUTH_REQUIRED'});
 try{
  const user=await verifyCloudUser(token);const filter='owner_id=eq.'+user.id;
  if(req.method==='GET'){
   const journal=req.query?.kind==='journals';const cursor=String(req.query?.cursor||'');
   if(cursor.length>300)throw new CloudError('INVALID_CURSOR',400);
   const rows=await cloudRequest(journal?'/rest/v1/import_journals?'+filter+'&select=batch_id,state,payload,created_at&order=batch_id.asc,state.asc&limit=1000'+(cursor?'&batch_id=gt.'+encodeURIComponent(cursor):''):'/rest/v1/source_documents?'+filter+'&select=sha256,original_filename,bytes,mime,kind,created_at&order=sha256.asc&limit=501'+(cursor?'&sha256=gt.'+encodeURIComponent(cursor):''),token);
   if(!Array.isArray(rows))throw new CloudError('INVALID_CLOUD_RESPONSE');
   // Journal events are paged by complete batch; no state may be split over two pages.
   if(journal){const ids=[...new Set(rows.map(row=>row.batch_id))];const last=rows.length===1000?ids.at(-1):null;const complete=last?rows.filter(row=>row.batch_id!==last):rows;if(last&&!complete.length)throw new CloudError('INVALID_CLOUD_RESPONSE');return res.status(200).json({rows:complete,nextCursor:last?complete.at(-1).batch_id:null});}
   return res.status(200).json({rows:rows.slice(0,500),nextCursor:rows.length>500?rows[499].sha256:null});
  }
  if(Buffer.byteLength(JSON.stringify(req.body||{}))>2200000)throw new CloudError('REQUEST_TOO_LARGE',413);
  const body=req.body||{};
  if(body.action==='journal'){await cloudRequest('/rest/v1/rpc/record_import',token,{method:'POST',body:JSON.stringify({p_batch:body.batch})});return res.status(200).json({saved:true});}
  if(!validHash(body.hash))throw new CloudError('INVALID_HASH',400);
  const path=user.id+'/'+body.hash;
  if(body.action==='prepare'){
   const needed=await cloudRequest('/rest/v1/rpc/prepare_original',token,{method:'POST',body:JSON.stringify({p_hash:body.hash})});
   const {url,key}=cloudConfiguration();return res.status(200).json({uploadNeeded:needed===true,url:url+'/storage/v1/object/'+bucket+'/'+path,publishableKey:key});
  }
  if(body.action==='download'){
   const signed=await cloudRequest('/storage/v1/object/sign/'+bucket+'/'+path,token,{method:'POST',body:JSON.stringify({expiresIn:60})}) as {signedURL?:string};
   if(!signed?.signedURL?.startsWith('/object/sign/'+bucket+'/'+path+'?'))throw new CloudError('INVALID_CLOUD_RESPONSE');
   return res.status(200).json({url:cloudConfiguration().url+'/storage/v1'+signed.signedURL});
  }
  if(body.action==='complete'){
   if(typeof body.filename!=='string'||body.filename.length<1||body.filename.length>255||!Number.isSafeInteger(body.size)||(body.size as number)<1||(body.size as number)>26214400||typeof body.mime!=='string'||body.mime.length>100||!['detailed-source','supporting-document'].includes(body.kind||''))throw new CloudError('INVALID_DOCUMENT',400);
   // Verify actual immutable object bytes before recording a successful source archive.
   const {url,key}=cloudConfiguration();const response=await fetch(url+'/storage/v1/object/authenticated/'+bucket+'/'+path,{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
   if(!response.ok||!response.body)throw new CloudError('ORIGINAL_NOT_VERIFIED',409);
   const reader=response.body.getReader();const hash=createHash('sha256');let size=0;
   for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>26214400){await reader.cancel();throw new CloudError('REQUEST_TOO_LARGE',413);}hash.update(part.value);}
   if(size!==body.size||hash.digest('hex')!==body.hash)throw new CloudError('ORIGINAL_NOT_VERIFIED',409);
   await cloudRequest('/rest/v1/rpc/record_original',token,{method:'POST',body:JSON.stringify({p_hash:body.hash,p_filename:body.filename,p_bytes:size,p_mime:body.mime,p_kind:body.kind})});
   return res.status(200).json({saved:true,hash:body.hash,bytes:size});
  }
  throw new CloudError('INVALID_ACTION',400);
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('ARCHIVE_UNAVAILABLE');return res.status(failure.status).json({code:failure.code,error:'The archive operation did not finish. Your original remains on this device. Keep it and retry after checking the connection.'});}
}
