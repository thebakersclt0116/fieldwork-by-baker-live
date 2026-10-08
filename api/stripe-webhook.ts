import {CloudError} from '../server/cloud-client.js';
import {billingMode,reconcileSubscription,verifyWebhook} from '../server/billing.js';
export const config={api:{bodyParser:false}};
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store');if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
 try{
  const secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret?.startsWith('whsec_'))throw new CloudError('WEBHOOK_NOT_CONFIGURED');
  let size=0;const chunks:Buffer[]=[];for await(const chunk of req){const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=value.length;if(size>1048576)throw new CloudError('REQUEST_TOO_LARGE',413);chunks.push(value);}
  const event=verifyWebhook(Buffer.concat(chunks),String(req.headers?.['stripe-signature']||''),secret);const mode=billingMode();
  if(event.livemode!==(mode==='live'))throw new CloudError('WEBHOOK_MODE_MISMATCH',400);
  const object=event.data?.object;let subscription:string|undefined;
  if(event.type.startsWith('customer.subscription.'))subscription=object?.id;
  else if(['invoice.paid','invoice.payment_failed','invoice.payment_action_required','checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   const value=object?.subscription || object?.parent?.subscription_details?.subscription;subscription=typeof value==='string'?value:value?.id;
  }else return res.status(200).json({received:true,ignored:true});
  if(!subscription)return res.status(200).json({received:true,ignored:true});
  await reconcileSubscription(subscription,mode,event.id);return res.status(200).json({received:true});
 }catch(error){const failure=error instanceof CloudError?error:new CloudError('WEBHOOK_PROCESSING_FAILED',500);return res.status(failure.status).json({code:failure.code});}
}
