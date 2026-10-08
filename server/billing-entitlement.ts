import {cloudRequest,CloudError} from './cloud-client.js';
export function sandboxBillingEnabled(){return process.env.VERCEL_ENV==='preview'&&process.env.BAKER_ALLOW_TEST_CHECKOUT==='true'&&Boolean(/^(?:sk|rk)_test_/.test((process.env.BAKER_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY) || ''));}
export async function effectiveSubscription(profile:any,owner:string,token:string){
 if(!sandboxBillingEnabled())return {tier:profile.subscription_tier,status:profile.subscription_status,mode:'live' as const};
 const rows:any=await cloudRequest('/rest/v1/billing_subscriptions?owner_id=eq.'+owner+'&mode=eq.test&select=plan,status,checked_at&order=checked_at.desc&limit=100',token);
 if(!Array.isArray(rows))throw new CloudError('BILLING_BACKEND_REQUIRED');
 const chosen=rows.find(row=>row.status==='active'&&row.plan!=='none') || rows.find(row=>row.status==='trialing'&&row.plan!=='none') || rows[0];
 return {tier:chosen?.plan==='individual_monthly'?'individual':['professional_monthly','professional_annual'].includes(chosen?.plan)?'professional':'none',status:chosen?.status || 'none',mode:'test' as const};
}
