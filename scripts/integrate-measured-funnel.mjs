import fs from 'node:fs';
function change(path, before, after) { const source=fs.readFileSync(path,'utf8'); if(source.includes(after))return; if(!source.includes(before))throw new Error('Integration source changed; inspect before editing: '+path); fs.writeFileSync(path,source.replace(before,after)); }
function replaceAll(path, before, after) { const source=fs.readFileSync(path,'utf8'); if(!source.includes(before))throw new Error('Integration source changed: '+path); fs.writeFileSync(path,source.split(before).join(after)); }
const account='api/account.ts';
change(account,"import {deliverLaunchNotifications}","import { scheduleFunnelEvent } from '../server/funnel-events.js';\nimport { newFunnelContext, normalizeFunnelContext, isFunnelQaEmail } from '../server/funnel-ledger.js';\nimport {deliverLaunchNotifications}");
change(account,"    if (action === 'recover') {",`    if (action === 'resend-verification') {
      const email=String(body.email||'').trim().toLowerCase();
      if(!/^\\S+@\\S+\\.\\S+$/.test(email)||email.length>254)return send(400,{code:'INVALID_ACCOUNT_INPUT'});
      // Supabase enforces email send limits; no new account or conversion is created by resending.
      await cloudRequest('/auth/v1/resend',null,{method:'POST',body:JSON.stringify({type:'signup',email})});
      return send(202,{verificationRequired:true});
    }
    if (action === 'recover') {`);
change(account,"      const payload: any = await cloudRequest(action === 'signup'", "      const funnel = newFunnelContext(body.funnel, isFunnelQaEmail(email));\n      const adMeasurement = req.headers?.['sec-gpc'] === '1' ? undefined : body.adMeasurement;\n      const payload: any = await cloudRequest(action === 'signup'");
change(account,"{ email, password, data: { name } }", "{ email, password, data: { name, baker_funnel: funnel } }");
change(account,"        return send(202, { verificationRequired: true });",`        const created = payload?.user || payload;
        const createdContext = normalizeFunnelContext(created?.user_metadata?.baker_funnel);
        const age = Date.now() - Date.parse(created?.created_at || '');
        // Supabase returns obfuscated data for an existing confirmed email. Do not count that or a resend as a new account.
        if (typeof created?.id === 'string' && /^[a-f0-9-]{36}$/i.test(created.id) && Array.isArray(created.identities) && created.identities.length > 0 && age >= -1000 && age < 300000 && createdContext?.flowId === funnel.flowId) {
          scheduleFunnelEvent({stage:'account_created',context:createdContext,adMeasurement,email,userAgent:req.headers?.['user-agent'],occurredAt:created.created_at});
        }
        return send(202, { verificationRequired: true });`);
change(account,"      const identity = await verifyCloudUser(payload.access_token);",`      const identity = await verifyCloudUser(payload.access_token);
      const originFunnel = normalizeFunnelContext(identity.user_metadata?.baker_funnel);
      if (action === 'login' && originFunnel) scheduleFunnelEvent({stage:'email_verified',context:{...originFunnel,qa:originFunnel.qa||isFunnelQaEmail(identity.email)},adMeasurement,email:identity.email,userAgent:req.headers?.['user-agent'],occurredAt:identity.email_confirmed_at});`);
change('server/cloud-client.ts',"user_metadata?: { name?: string }", "user_metadata?: { name?: string; baker_funnel?: unknown }");
change('src/hooks/useAuth.ts',"import { useState, useEffect, useCallback } from 'react';", "import { useState, useEffect, useCallback } from 'react';\nimport { accountFunnelInput } from '@/lib/acquisitionFunnel';");
change('src/hooks/useAuth.ts',"accountRequest({action:'login',email,password})", "accountRequest({action:'login',email,password,...accountFunnelInput()})");
change('src/hooks/useAuth.ts',"accountRequest({action:'signup',name,email,password})", "accountRequest({action:'signup',name,email,password,...accountFunnelInput()})");
const checkout='api/create-checkout-session.ts';
change(checkout,"import {CloudError}","import {scheduleFunnelEvent,subscriptionFunnelMetadata} from '../server/funnel-events.js';\nimport {newFunnelContext,normalizeFunnelContext,isFunnelQaEmail} from '../server/funnel-ledger.js';\nimport {CloudError}");
change(checkout,"  let attributionKey='';", "  const originFunnel=normalizeFunnelContext(user.user_metadata?.baker_funnel);\n  const funnel=originFunnel || newFunnelContext(req.body?.funnel,isFunnelQaEmail(user.email));\n  for(const [key,value] of Object.entries(subscriptionFunnelMetadata({...funnel,qa:funnel.qa||isFunnelQaEmail(user.email)})))params.set('subscription_data[metadata]['+key+']',value);\n  let attributionKey='';");
change(checkout,"attributionMetadata(req.body?.adMeasurement,user.email,req.headers?.['user-agent'])", "attributionMetadata(req.headers?.['sec-gpc']==='1'?undefined:req.body?.adMeasurement,user.email,req.headers?.['user-agent'])");
change(checkout,"  return res.status(200).json({id:checkout.id,url:checkout.url,plan});", "  if(mode==='live')scheduleFunnelEvent({stage:'checkout_opened',context:{...funnel,qa:funnel.qa||isFunnelQaEmail(user.email)},adMeasurement:req.headers?.['sec-gpc']==='1'?undefined:req.body?.adMeasurement,email:user.email,userAgent:req.headers?.['user-agent']});\n  return res.status(200).json({id:checkout.id,url:checkout.url,plan});");
change('api/stripe-webhook.ts',"import {deliverLaunchNotifications}","import {scheduleFirstPaidMembership} from '../server/funnel-events.js';\nimport {deliverLaunchNotifications}");
change('api/stripe-webhook.ts',"  if(mode==='live' && event.type==='invoice.paid')await reportFirstPayment(object.id,subscription);", "  if(mode==='live' && event.type==='invoice.paid'){scheduleFirstPaidMembership(object.id,subscription);await reportFirstPayment(object.id,subscription);}");
const ads='server/ad-measurement.ts';
change(ads,"input.consent !== 'ads-v1'", "!['ads-v1','ads-v2'].includes(input.consent)");
change(ads,"baker_ads_consent: 'ads-v1'", "baker_ads_consent: input.consent");
change(ads,"metadata?.baker_ads_consent !== 'ads-v1'", "!['ads-v1','ads-v2'].includes(metadata?.baker_ads_consent)");
change(ads,"  if (subscription.livemode !== true", "  if (subscription.metadata?.baker_funnel_qa === 'true') return false;\n  if (subscription.livemode !== true");
change('server/funnel-events.ts',"  if (args.context.qa || isFunnelQaEmail(args.email)) return null;", "  if (args.context.qa || isFunnelQaEmail(args.email) || (args.adMeasurement as {consent?:string}|undefined)?.consent !== 'ads-v2') return null;");
change('api/funnel.ts',"    const consent = attributionMetadata(adMeasurement", "    if(adMeasurement?.consent!=='ads-v2')return res.status(200).json({recorded:false,reason:'CURRENT_CONSENT_REQUIRED'});\n    const consent = attributionMetadata(adMeasurement");
for(const path of ['src/pages/Upgrade.tsx','src/components/StripeCheckout.tsx']) {
  change(path,"import {", "import { accountFunnelInput } from '@/lib/acquisitionFunnel';\nimport {");
}
change('src/pages/Upgrade.tsx',"JSON.stringify({ plan, adMeasurement: checkoutAdMeasurement() })", "JSON.stringify({ plan, ...accountFunnelInput(), adMeasurement: checkoutAdMeasurement() })");
change('src/components/StripeCheckout.tsx',"JSON.stringify({ plan: selectedPlan })", "JSON.stringify({ plan: selectedPlan, ...accountFunnelInput() })");
change('src/App.tsx',"const WorkspacePreview=", "const AcquisitionStart=lazy(()=>import('./pages/AcquisitionStart'));\nconst AdminFunnel=lazy(()=>import('./pages/AdminFunnel'));\nconst WorkspacePreview=");
change('src/App.tsx','        <Route path="/demo"', '        <Route path="/start" element={<AcquisitionStart />} />\n        <Route path="/admin/funnel" element={<ProtectedRoute><AdminFunnel /></ProtectedRoute>} />\n        <Route path="/demo"');
change('src/pages/PlatformHome.tsx',"import MobileAppAnnouncement", "import PublicLandingMeasurement from '@/components/PublicLandingMeasurement';\nimport MobileAppAnnouncement");
change('src/pages/PlatformHome.tsx','      <section className="relative min-h-[88dvh]', '      <PublicLandingMeasurement path="/" />\n      <section className="relative min-h-[88dvh]');
const choice='src/components/AdMeasurementChoice.tsx';
change(choice,"['/', '/demo'", "['/', '/start', '/login', '/demo'");
change(choice,'Optional ad measurement helps us understand which ads bring new members. If you allow it, Meta receives ad/browser identifiers, a hashed email, browser type, and first-payment details. Your fieldwork records, files and supervisor information stay private.', 'Optional ad measurement sends Meta public-page visits, account creation, confirmed email, checkout and first-payment events, plus ad/browser identifiers, browser type and a hashed email when available. Your fieldwork records, files and supervisor information are never included. Declining does not affect your account.');
const legal='src/pages/Legal.tsx';
replaceAll(legal,'first-payment details','signup and checkout stages plus first-payment details');
change('api/ad-measurement-config.ts','serverSide: true, consentRequired: true',"serverSide: true, consentRequired: true, consentVersion: 'ads-v2', funnelVersion: 'funnel-v1'");
change('api/health.ts',"    detailedMigrationVersion: 'entry-audit-v1',", "    detailedMigrationVersion: 'entry-audit-v1',\n    acquisitionFunnelVersion: 'funnel-v1',");
// Same marketing experiment, lower sign-in friction; retain the existing desktop design.
change('src/pages/Login.tsx',"if (!value || !value.startsWith('/') || value.startsWith('//'))", "if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\\\'))");
change('src/pages/Login.tsx','bg-gradient-to-br from-[#FFF5F7] via-[#FFFCF9] to-[#FBF3EB] flex flex-col', 'bg-gradient-to-br from-[#FFF5F7] via-[#FFFCF9] to-[#FBF3EB] hidden lg:flex flex-col');
console.log('Authoritative funnel stages, renewed consent and destination experiment integrated. No customer records changed.');
