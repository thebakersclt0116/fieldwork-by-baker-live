import {createHash,randomBytes} from 'node:crypto';
import {getBearerToken,canUseSupervisorTools,requireAccountSession} from '../api/_auth.js';
import {cloudRequest,verifyCloudUser,CloudError} from './cloud-client.js';
export const isManagedReview=(token:unknown):token is string=>typeof token==='string'&&/^c1\.[a-f0-9]{64}$/.test(token);
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const send=(res:any,status:number,body:unknown)=>{res.setHeader('Cache-Control','private, no-store');return res.status(status).json(body);};
export async function createManagedReview(req:any,res:any){
 try{
  const session=await requireAccountSession(req);const token=getBearerToken(req);
  if(!token||session?.authProvider!=='supabase'||!canUseSupervisorTools(session))throw new CloudError('SUPERVISOR_TOOLS_REQUIRED',403);
  const body=req.body||{};const revision=body.reviewEntry?.revision;const email=String(body.supervisorEmail||'').trim().toLowerCase();const name=String(body.supervisorName||'').trim();const entryId=body.reviewEntry?.id;
  if(!Number.isSafeInteger(revision)||revision<0||typeof entryId!=='string'||entryId.length<1||entryId.length>300||name.length<1||name.length>120||email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new CloudError('INVALID_INVITATION',400);
  const inviteToken='c1.'+randomBytes(32).toString('hex');
  const id=await cloudRequest('/rest/v1/rpc/invite_review',token,{method:'POST',body:JSON.stringify({p_entry_id:entryId,p_revision:revision,p_email:email,p_name:name,p_hash:digest(inviteToken)})});
  return send(res,200,{path:'/supervisor/'+inviteToken,invitationId:id,expiresInDays:14,supervisorEmail:email,superviseeEmail:session.email,managed:true,notification:{configured:false,emailSent:false,channel:'none'}});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('REVIEW_UNAVAILABLE');return send(res,failure.status,{code:failure.code,error:'Review invitation did not finish. Save the entry and check the supervisor address before retrying.'});}
}
export async function readManagedReview(req:any,res:any){
 try{
  const token=getBearerToken(req);if(!token)throw new CloudError('SUPERVISOR_SIGN_IN_REQUIRED',401);await verifyCloudUser(token);
  const invite=req.body?.token;if(!isManagedReview(invite))throw new CloudError('INVALID_INVITATION',400);
  const result=await cloudRequest('/rest/v1/rpc/read_review',token,{method:'POST',body:JSON.stringify({p_hash:digest(invite)})});return send(res,200,{...(result as object),managed:true});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('REVIEW_UNAVAILABLE');return send(res,failure.status,{code:failure.code,error:failure.status===401?'Sign in with the verified email address that received this invitation.':'This review is unavailable, expired, or the entry has changed. Request a new invitation.'});}
}
export async function acceptManagedReview(req:any,res:any){
 try{
  const token=getBearerToken(req);if(!token)throw new CloudError('SUPERVISOR_SIGN_IN_REQUIRED',401);await verifyCloudUser(token);
  const body=req.body||{};
  if(!isManagedReview(body.invitation)||!Number.isSafeInteger(body.revision)||body.revision<0||!['VERIFIED','PENDING','REJECTED'].includes(body.status)||typeof body.note!=='string'||typeof body.message!=='string'||body.note.length>2000||body.message.length>2000||typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(body.requestId))throw new CloudError('INVALID_REVIEW',400);
  const result=await cloudRequest('/rest/v1/rpc/accept_review',token,{method:'POST',body:JSON.stringify({p_hash:digest(body.invitation),p_revision:body.revision,p_status:body.status,p_note:body.note,p_message:body.message,p_request_id:body.requestId})});return send(res,200,{...(result as object),managed:true});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('REVIEW_UNAVAILABLE');return send(res,failure.status,{code:failure.code,error:'Approval was not confirmed. Keep your notes and reload the review before trying again.'});}
}
