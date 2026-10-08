import {CloudError} from '../server/cloud-client.js';
import {billingConfigured,billingIdentity,billingMode,billingRPC,ensureCustomer,isPlan,priceFor,siteOrigin,stripeRequest} from '../server/billing.js';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
 try{
  const {token,user}=await billingIdentity(req);
  if(!isPlan(req.body?.plan))throw new CloudError('INVALID_PLAN',400);
  const mode=billingMode();
  if(mode==='live'&&!billingConfigured())throw new CloudError('BILLING_BACKEND_REQUIRED');
  const plan=req.body.plan;const price=priceFor(plan,mode);
  const customer=await ensureCustomer(token,user,mode);
  const subscriptions=await stripeRequest('/v1/subscriptions?customer='+encodeURIComponent(customer)+'&status=all&limit=100');
  if(!Array.isArray(subscriptions.data)||subscriptions.has_more)throw new CloudError('SUBSCRIPTION_REVIEW_REQUIRED',409);
  if(subscriptions.data.some((value:any)=>!['canceled','incomplete_expired'].includes(value.status)))throw new CloudError('EXISTING_SUBSCRIPTION_USE_PORTAL',409);
  const claim:any=await billingRPC('claim_billing_checkout',{p_owner:user.id,p_mode:mode,p_plan:plan,p_origin:siteOrigin()});
  if(typeof claim?.id!=='string'||typeof claim.origin!=='string'||!Number.isSafeInteger(claim.expiresAt))throw new CloudError('BILLING_SAVE_FAILED');
  const params=new URLSearchParams({mode:'subscription',customer,'line_items[0][price]':price,'line_items[0][quantity]':'1',success_url:claim.origin+'/upgrade/success?session_id={CHECKOUT_SESSION_ID}',cancel_url:claim.origin+'/upgrade?canceled=1',client_reference_id:user.id,expires_at:String(claim.expiresAt),
   'metadata[baker_account_id]':user.id,'metadata[baker_mode]':mode,'metadata[baker_plan]':plan,
   'subscription_data[metadata][baker_account_id]':user.id,'subscription_data[metadata][baker_mode]':mode,'subscription_data[metadata][baker_plan]':plan});
  const checkout=await stripeRequest('/v1/checkout/sessions',params,`baker/checkout/${mode}/${user.id}/${claim.id}`);
  if(checkout.livemode!==(mode==='live')||!/^cs_[A-Za-z0-9_]+$/.test(checkout.id||'')||typeof checkout.url!=='string'||!checkout.url.startsWith('https://checkout.stripe.com/'))throw new CloudError('INVALID_CHECKOUT_RESPONSE');
  return res.status(200).json({id:checkout.id,url:checkout.url,plan});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('CHECKOUT_UNAVAILABLE');return res.status(failure.status).json({code:failure.code,error:failure.code==='EXISTING_SUBSCRIPTION_USE_PORTAL'?'Manage your existing subscription from Account settings.':'Checkout could not open. No new payment was confirmed.'});}
}
