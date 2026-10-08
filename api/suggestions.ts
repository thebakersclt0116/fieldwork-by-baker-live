import { getBearerToken } from './_auth.js';
import { CloudError, cloudRequest, verifyCloudUser } from '../server/cloud-client.js';
import { createHash } from 'node:crypto';
const categories = ['Site improvement','Performance or speed','Feature request','Something isn’t working','Mobile app idea'];
export default async function handler(req: any, res: any) {
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
 try{
  const token=getBearerToken(req);if(!token)throw new CloudError('AUTH_REQUIRED',401);
  const user=await verifyCloudUser(token);const body=req.body||{};
  const message=typeof body.message==='string'?body.message.trim():'';const page=typeof body.page==='string'?body.page.trim():'';
  if(!categories.includes(body.category)||message.length<10||message.length>4000||page.length>200||!/^[a-f0-9-]{36}$/.test(body.requestId||''))throw new CloudError('INVALID_SUGGESTION',400);
  const key=process.env.RESEND_API_KEY;const from=process.env.BAKER_NOTIFICATION_FROM;if(!key||!from)throw new CloudError('EMAIL_NOT_CONFIGURED');
  const hash=createHash('sha256').update(JSON.stringify({category:body.category,message,page})).digest('hex');
  const reservation=await cloudRequest('/rest/v1/rpc/reserve_suggestion',token,{method:'POST',body:JSON.stringify({p_request_id:body.requestId,p_content_hash:hash})});
  if(reservation==='SUGGESTION_LIMIT')throw new CloudError('SUGGESTION_LIMIT',429);if(reservation==='SUGGESTION_CONFLICT')throw new CloudError('SUGGESTION_CONFLICT',409);
  const delivery=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`suggestion/${user.id}/${body.requestId}`},body:JSON.stringify({from,to:['thebakersclt@gmail.com','Justin@bakerholdings.co'],reply_to:user.email,subject:`Fieldwork suggestion: ${body.category}`,text:`From: ${user.email}\nCategory: ${body.category}\nPage: ${page||'Not specified'}\n\n${message}\n\nSubmission: ${body.requestId}`})});
  if(!delivery.ok)throw new CloudError('SUGGESTION_NOT_SENT',502);const result:any=await delivery.json();if(!result?.id)throw new CloudError('SUGGESTION_NOT_CONFIRMED',502);
  return res.status(200).json({accepted:true});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('SUGGESTION_UNAVAILABLE');return res.status(failure.status).json({code:failure.code});}
}
