import {CloudError} from '../server/cloud-client.js';
import {billingIdentity,billingMode,ownCustomer,siteOrigin,stripeRequest} from '../server/billing.js';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store');if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
 try{const {token,user}=await billingIdentity(req);const mode=billingMode();const customer=await ownCustomer(token,user.id,mode);if(!customer)throw new CloudError('NO_SUBSCRIPTION_CUSTOMER',404);
  const portal=await stripeRequest('/v1/billing_portal/sessions',new URLSearchParams({customer,return_url:siteOrigin()+'/settings'}));
  if(typeof portal.url!=='string'||!portal.url.startsWith('https://billing.stripe.com/'))throw new CloudError('INVALID_BILLING_RESPONSE');return res.status(200).json({url:portal.url});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('BILLING_PORTAL_UNAVAILABLE');return res.status(failure.status).json({code:failure.code,error:'Your billing page could not open. Please try again.'});}
}
