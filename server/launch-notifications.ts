import {cloudConfiguration} from './cloud-client.js';
export async function deliverLaunchNotifications(owner?:string) {
 const key=process.env.SUPABASE_SECRET_KEY;const resend=process.env.RESEND_API_KEY;const from=process.env.BAKER_NOTIFICATION_FROM;
 if(!key?.startsWith('sb_secret_')||!resend||!from||process.env.VERCEL_ENV!=='production')return;
 const {url}=cloudConfiguration();const headers={apikey:key,'Content-Type':'application/json'};
 const response=await fetch(url+'/rest/v1/launch_notifications?sent_at=is.null&order=created_at.asc&limit=10'+(owner?'&owner_id=eq.'+encodeURIComponent(owner):''),{headers,signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('NOTIFICATION_QUEUE_UNAVAILABLE');
 const rows:any[]=await response.json();
 for(const row of rows){
  const plans:Record<string,string>={individual_monthly:'Individual — $16.99/month',professional_monthly:'Professional — $34.99/month',professional_annual:'Professional Annual — $349/year'};
  const delivered=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json','Idempotency-Key':'launch/'+row.id},signal:AbortSignal.timeout(10000),body:JSON.stringify({from,to:['thebakersclt@gmail.com','Justin@bakerholdings.co'],reply_to:row.email,subject:row.kind==='signup'?'New user! — Fieldwork by Baker':'New paid user! — '+(plans[row.plan]||row.plan),text:`${row.kind==='signup'?'A new verified user has joined Fieldwork.':'A user has activated a paid Fieldwork membership.'}\n\nName: ${row.display_name}\nEmail: ${row.email}\nSubscription: ${plans[row.plan]||row.plan}\n\n${row.kind==='signup'?'The account is verified. No payment is implied by signup.':'Payment status was confirmed through the protected live billing integration.'}`})});
  if(!delivered.ok)throw new Error('NOTIFICATION_NOT_SENT');
  const saved=await fetch(url+'/rest/v1/launch_notifications?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',headers,signal:AbortSignal.timeout(10000),body:JSON.stringify({sent_at:new Date().toISOString()})});
  if(!saved.ok)throw new Error('NOTIFICATION_ACK_FAILED');
 }
}
