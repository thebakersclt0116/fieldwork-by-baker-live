import {CloudError} from '../server/cloud-client.js';
import {billingConfigured,billingIdentity,billingMode,ownCustomer,reconcileSubscription,stripeRequest} from '../server/billing.js';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
 try{
  const {token,user}=await billingIdentity(req);const mode=billingMode();if(mode==='live'&&!billingConfigured())throw new CloudError('BILLING_BACKEND_REQUIRED');
  const id=req.body?.sessionId;if(typeof id!=='string'||!/^cs_[A-Za-z0-9_]+$/.test(id)||id.length>200)throw new CloudError('INVALID_CHECKOUT',400);
  const customer=await ownCustomer(token,user.id,mode);if(!customer)throw new CloudError('BILLING_ACCOUNT_MISMATCH',403);
  const checkout=await stripeRequest('/v1/checkout/sessions/'+encodeURIComponent(id));
  if(checkout.livemode!==(mode==='live')||checkout.mode!=='subscription'||checkout.client_reference_id!==user.id||checkout.metadata?.baker_account_id!==user.id||checkout.metadata?.baker_mode!==mode||checkout.customer!==customer)throw new CloudError('BILLING_ACCOUNT_MISMATCH',403);
  if(checkout.status!=='complete'||checkout.payment_status!=='paid')throw new CloudError('PAYMENT_NOT_CONFIRMED',402);
  const subscription=typeof checkout.subscription==='string'?checkout.subscription:checkout.subscription?.id;
  const result=await reconcileSubscription(subscription,mode,'checkout/'+checkout.id,user.id,customer);
  if(!result.paid)throw new CloudError('SUBSCRIPTION_NOT_ACTIVE',402);
  return res.status(200).json({verified:true,plan:result.plan,mode});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('BILLING_VERIFICATION_UNAVAILABLE');return res.status(failure.status).json({code:failure.code,error:'Your paid subscription was not confirmed. Keep your receipt and contact support if a payment was completed.'});}
}
