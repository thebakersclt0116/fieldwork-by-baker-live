import {getBearerToken} from './_auth.js';
import {CloudError,cloudRequest,verifyCloudUser} from '../server/cloud-client.js';
import {communityPhotos,normalizedPhoto} from '../server/community-photos.js';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store');
 try{
  const token=getBearerToken(req);if(!token)throw new CloudError('AUTH_REQUIRED',401);const user=await verifyCloudUser(token);
  if(req.method==='GET')return res.status(200).json({url:(await communityPhotos(token,[user.id]))[user.id]||null});
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
  if(req.body?.action==='hide'){await cloudRequest('/rest/v1/rpc/set_community_photo',token,{method:'POST',body:JSON.stringify({p_visible:false})});return res.status(200).json({saved:true,url:null});}
  if(req.body?.action!=='upload')throw new CloudError('INVALID_ACTION',400);
  const bytes=normalizedPhoto(req.body?.png);
  await cloudRequest('/storage/v1/object/community-avatars/'+user.id+'/avatar.png',token,{method:'POST',headers:{'Content-Type':'image/png','x-upsert':'true','cache-control':'max-age=0'},body:new Uint8Array(bytes)});
  await cloudRequest('/rest/v1/rpc/set_community_photo',token,{method:'POST',body:JSON.stringify({p_visible:true})});
  return res.status(200).json({saved:true,url:(await communityPhotos(token,[user.id]))[user.id]||null});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('PHOTO_UNAVAILABLE');return res.status(failure.status).json({code:failure.code});}
}
