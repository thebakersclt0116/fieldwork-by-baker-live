import {getBearerToken} from './_auth.js';
import {CloudError,cloudRequest,verifyCloudUser} from '../server/cloud-client.js';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store');
 try{
  const token=getBearerToken(req);if(!token)throw new CloudError('AUTH_REQUIRED',401);const user=await verifyCloudUser(token);
  if(req.method==='GET'){
   const preferences:any=await cloudRequest(`/rest/v1/community_profiles?owner_id=eq.${user.id}&select=country,show_country,share_presence`,token);
   const members=await cloudRequest('/rest/v1/rpc/community_members',token,{method:'POST',body:'{}'});
   return res.status(200).json({preferences:preferences[0]||{country:'NONE',show_country:false,share_presence:false},members});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
  const b=req.body||{};
  if(b.action==='heartbeat'){await cloudRequest('/rest/v1/rpc/community_heartbeat',token,{method:'POST',body:'{}'});return res.status(200).json({saved:true});}
  if(!['US','AU','GB','OTHER','NONE'].includes(b.country)||typeof b.showCountry!=='boolean'||typeof b.sharePresence!=='boolean')throw new CloudError('INVALID_PREFERENCES',400);
  await cloudRequest('/rest/v1/rpc/save_community_preferences',token,{method:'POST',body:JSON.stringify({p_country:b.country,p_show_country:b.showCountry,p_share_presence:b.sharePresence})});
  return res.status(200).json({saved:true});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('COMMUNITY_UNAVAILABLE');return res.status(failure.status).json({code:failure.code});}
}
