import {getBearerToken} from './_auth.js';
import {CloudError,cloudRequest,verifyCloudUser} from '../server/cloud-client.js';
import {communityPhotos,validMemberId} from '../server/community-photos.js';
const text=(value:unknown,min:number,max:number)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store');
 try{
  const token=getBearerToken(req);if(!token)throw new CloudError('AUTH_REQUIRED',401);const user=await verifyCloudUser(token);
  if(req.method==='GET'){
   const before=req.query?.before;if(before!==undefined&&(typeof before!=='string'||before.length>40||!Number.isFinite(Date.parse(before))))throw new CloudError('INVALID_CURSOR',400);
   const posts:any=await cloudRequest('/rest/v1/rpc/commons_feed',token,{method:'POST',body:JSON.stringify({p_before:before||null})});if(!Array.isArray(posts))throw new CloudError('COMMUNITY_UNAVAILABLE');
   const authors=posts.flatMap((p:any)=>[p.author,...(p.comments||[]).map((c:any)=>c.author)]);const photos=await communityPhotos(token,authors.map((a:any)=>a?.id).filter(Boolean));for(const author of authors)if(author)author.photo=photos[author.id]||null;
   return res.status(200).json({posts,memberId:user.id,nextCursor:posts.length===30?posts.at(-1).createdAt:null});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
  const b=req.body||{};if(Buffer.byteLength(JSON.stringify(b))>10000)throw new CloudError('REQUEST_TOO_LARGE',413);
  let name:string,body:any;
  if(b.action==='post'&&validMemberId(b.id)&&text(b.title,3,100)&&text(b.body,8,4000)&&text(b.forum,1,64)){name='commons_publish';body={p_id:b.id,p_title:b.title.trim(),p_body:b.body.trim(),p_forum:b.forum};}
  else if(b.action==='comment'&&validMemberId(b.id)&&validMemberId(b.postId)&&text(b.body,2,1500)){name='commons_comment';body={p_id:b.id,p_post:b.postId,p_body:b.body.trim()};}
  else if(b.action==='like'&&validMemberId(b.postId)&&typeof b.liked==='boolean'){name='commons_react';body={p_post:b.postId,p_liked:b.liked};}
  else if(b.action==='hide'&&validMemberId(b.id)&&['post','comment'].includes(b.kind)){name='commons_hide';body={p_id:b.id,p_kind:b.kind};}
  else if(b.action==='report'&&validMemberId(b.postId)&&text(b.reason,5,1000)){name='commons_report';body={p_post:b.postId,p_reason:b.reason.trim()};}
  else throw new CloudError('INVALID_COMMUNITY_ACTION',400);
  await cloudRequest('/rest/v1/rpc/'+name,token,{method:'POST',body:JSON.stringify(body)});return res.status(200).json({saved:true});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('COMMUNITY_UNAVAILABLE');return res.status(failure.status).json({code:failure.code});}
}
