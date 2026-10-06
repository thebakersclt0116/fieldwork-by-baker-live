import {createHmac,timingSafeEqual} from 'node:crypto';
import {CloudError,cloudConfiguration,cloudRequest,verifyCloudUser} from './cloud-client.js';
import {getBearerToken} from '../api/_auth.js';
import catalog from '../config/stripe-live-catalog.json' with {type:'json'};
export type BillingMode='live'|'test';
export type PlanId='individual_monthly'|'professional_monthly'|'professional_annual';
export const isPlan=(plan:unknown):plan is PlanId=>typeof plan==='string'&&Object.hasOwn(catalog.plans,plan);
export function billingMode():BillingMode {
 const key=process.env.STRIPE_SECRET_KEY || '';
 if (key.startsWith('sk_live_'))return 'live';
 if (key.startsWith('sk_test_') && process.env.VERCEL_ENV==='preview' && process.env.BAKER_ALLOW_TEST_CHECKOUT==='true')return 'test';
 throw new CloudError('LIVE_BILLING_NOT_CONFIGURED');
}
export function billingConfigured(){return process.env.BAKER_BILLING_ENABLED==='true'&&Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')&&process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')&&process.env.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'));}
export async function billingRPC(name:'link_billing_customer'|'apply_billing_snapshot'|'claim_billing_checkout',body:unknown){
 const {url}=cloudConfiguration();const key=process.env.SUPABASE_SECRET_KEY;
 if(!key?.startsWith('sb_secret_'))throw new CloudError('BILLING_BACKEND_REQUIRED');
 const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw new CloudError('BILLING_SAVE_FAILED',502);
 return response.json();
}
export async function stripeRequest(path:string,params?:URLSearchParams,idempotencyKey?:string):Promise<any>{
 if(!path.startsWith('/v1/')||path.includes('://'))throw new CloudError('INVALID_BILLING_PATH',400);
 billingMode();const response=await fetch('https://api.stripe.com'+path,{method:params?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},...(params?{body:params.toString()}:{})});
 const result=await response.json();if(!response.ok)throw new CloudError('STRIPE_REQUEST_FAILED',502);return result;
}
export async function billingIdentity(req:any){const token=getBearerToken(req);if(!token)throw new CloudError('AUTH_REQUIRED',401);return {token,user:await verifyCloudUser(token)};}
export async function ownCustomer(token:string,owner:string,mode:BillingMode):Promise<string|null>{
 const rows:any=await cloudRequest('/rest/v1/billing_customers?owner_id=eq.'+owner+'&mode=eq.'+mode+'&select=customer_id',token);
 if(!Array.isArray(rows))throw new CloudError('BILLING_BACKEND_REQUIRED');return rows[0]?.customer_id || null;
}
export async function ensureCustomer(token:string,user:{id:string;email:string},mode:BillingMode):Promise<string>{
 const existing=await ownCustomer(token,user.id,mode);if(existing)return existing;
 const params=new URLSearchParams({email:user.email,'metadata[baker_account_id]':user.id,'metadata[baker_mode]':mode});
 const customer=await stripeRequest('/v1/customers',params,`baker/customer/${mode}/${user.id}`);
 if(!/^cus_[A-Za-z0-9]+$/.test(customer.id)||customer.livemode!==(mode==='live'))throw new CloudError('BILLING_MODE_MISMATCH',400);
 await billingRPC('link_billing_customer',{p_owner:user.id,p_mode:mode,p_customer:customer.id});return customer.id;
}
export function priceFor(plan:PlanId,mode:BillingMode):string {
 const value=mode==='live'?catalog.plans[plan].priceId:process.env['STRIPE_TEST_PRICE_'+plan.toUpperCase()];
 if(!value||!/^price_[A-Za-z0-9]+$/.test(value))throw new CloudError('BILLING_PRICE_NOT_CONFIGURED');return value;
}
export function planForPrice(price:string,mode:BillingMode):PlanId|'none'{return (Object.keys(catalog.plans) as PlanId[]).find(plan=>{try{return priceFor(plan,mode)===price;}catch{return false;}})||'none';}
export function verifyWebhook(raw:Buffer,signature:string,secret:string,now=Math.floor(Date.now()/1000)){
 const components=signature.split(',').map(item=>item.split('='));const timestamps=components.filter(item=>item[0]==='t');
 if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]))throw new CloudError('INVALID_WEBHOOK_SIGNATURE',400);
 const timestamp=Number(timestamps[0][1]);if(Math.abs(now-timestamp)>300)throw new CloudError('INVALID_WEBHOOK_SIGNATURE',400);
 const expected=createHmac('sha256',secret).update(String(timestamp)+'.').update(raw).digest();
 const valid=components.filter(item=>item[0]==='v1'&&/^[a-f0-9]{64}$/.test(item[1])).some(item=>timingSafeEqual(expected,Buffer.from(item[1],'hex')));
 if(!valid)throw new CloudError('INVALID_WEBHOOK_SIGNATURE',400);
 const event=JSON.parse(raw.toString('utf8'));if(typeof event.id!=='string'||!/^evt_[A-Za-z0-9]+$/.test(event.id)||typeof event.type!=='string'||!Number.isSafeInteger(event.created)||typeof event.livemode!=='boolean')throw new CloudError('INVALID_WEBHOOK',400);return event;
}
export async function reconcileSubscription(subscriptionId:string,mode:BillingMode,eventId:string,expectedOwner?:string,expectedCustomer?:string){
 if(!/^sub_[A-Za-z0-9]+$/.test(subscriptionId))throw new CloudError('INVALID_SUBSCRIPTION',400);
 const checkedAt=Date.now();const subscription=await stripeRequest('/v1/subscriptions/'+encodeURIComponent(subscriptionId));
 const owner=subscription.metadata?.baker_account_id;const customer=typeof subscription.customer==='string'?subscription.customer:subscription.customer?.id;
 if(subscription.livemode!==(mode==='live')||subscription.metadata?.baker_mode!==mode||typeof owner!=='string'||!/^[a-f0-9-]{36}$/.test(owner)||!/^cus_[A-Za-z0-9]+$/.test(customer||'')||(expectedOwner&&expectedOwner!==owner)||(expectedCustomer&&expectedCustomer!==customer))throw new CloudError('BILLING_ACCOUNT_MISMATCH',403);
 const items=subscription.items?.data;if(!Array.isArray(items)||items.length!==1||items[0].quantity!==1)throw new CloudError('BILLING_PLAN_MISMATCH',400);
 const plan=planForPrice(items[0].price?.id,mode);
 const periodEnd=subscription.current_period_end || items[0].current_period_end || null;
 await billingRPC('apply_billing_snapshot',{p_owner:owner,p_mode:mode,p_customer:customer,p_subscription:subscription.id,p_plan:plan,p_status:subscription.status,p_period_end:periodEnd,p_cancel_at_period_end:subscription.cancel_at_period_end===true,p_checked_at:checkedAt,p_event_id:eventId});
 return {plan,status:subscription.status,paid:plan!=='none'&&subscription.status==='active'};
}
export const siteOrigin=()=>process.env.VERCEL_ENV==='preview'&&/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(process.env.VERCEL_URL||'')?'https://'+process.env.VERCEL_URL:'https://www.fieldworkbybaker.com';
