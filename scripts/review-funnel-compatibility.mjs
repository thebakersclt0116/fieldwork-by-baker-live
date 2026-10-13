import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const changed=[];
function patch(path,before,after){let text=fs.readFileSync(path,'utf8');if(text.includes(after))return;if(!text.includes(before))throw new Error('Reviewed source changed: '+path);fs.writeFileSync(path,text.replace(before,after));changed.push(path);}
const ledger='server/funnel-ledger.ts';
patch(ledger,'export function funnelKey(stage: FunnelStage, context: FunnelContext): string {','export function funnelKey(stage: FunnelStage, context: FunnelContext, subjectId?: string): string {');
patch(ledger,"stage, digest(context.flowId)].join('/');","stage, digest(stage !== 'landing_page_loaded' && subjectId && uuid.test(subjectId) ? subjectId : context.flowId)].join('/');");
patch(ledger,'export async function recordFunnelStage(stage: FunnelStage, context: FunnelContext, occurredAt?: string) {\n  const key = funnelKey(stage, context);','export async function recordFunnelStage(stage: FunnelStage, context: FunnelContext, occurredAt?: string, subjectId?: string) {\n  const key = funnelKey(stage, context, subjectId);');
const extra=`\nexport async function readOwnFunnelStages(context: FunnelContext, verifiedUserId: string) {
  if (!uuid.test(verifiedUserId)) throw new CloudError('AUTH_REQUIRED',401);
  const values=await Promise.all(FUNNEL_STAGES.map(async stage=>({stage,recorded:await hasFunnelMarker(funnelKey(stage,context,verifiedUserId))})));
  return {version:FUNNEL_VERSION,qa:context.qa,stages:values};
}\n`;
fs.appendFileSync(ledger,extra);changed.push(ledger);
const events='server/funnel-events.ts';
patch(events,'path?: \'/\' | \'/signup\' };',"path?: '/' | '/signup'; subjectId?: string };");
patch(events,'digest(funnelKey(args.stage, args.context))','digest(funnelKey(args.stage, args.context, args.subjectId))');
patch(events,'recordFunnelStage(args.stage, args.context, args.occurredAt)','recordFunnelStage(args.stage, args.context, args.occurredAt, args.subjectId)');
patch(events,"recordFunnelStage('first_paid_membership', context, new Date(paidAt * 1000).toISOString())","recordFunnelStage('first_paid_membership', context, new Date(paidAt * 1000).toISOString(), subscription.metadata?.baker_account_id)");
const route='api/funnel.ts';
patch(route,'normalizeFunnelContext, readFunnelSummary','normalizeFunnelContext, readFunnelSummary, readOwnFunnelStages');
patch(route,'      const user = await verifyCloudUser(token);',`      const user = await verifyCloudUser(token);
      if(req.query?.view==='self') {
        const context=normalizeFunnelContext(user.user_metadata?.baker_funnel);
        if(!context)return res.status(200).json({version:'funnel-v1',stages:[],instrumented:false});
        // Identity comes from the provider, not a user ID or journey supplied in the request.
        return res.status(200).json({...await readOwnFunnelStages(context,user.id),instrumented:true});
      }`);
const account='api/account.ts';
patch(account,"action === 'signup' ? '/auth/v1/signup' :", "action === 'signup' ? '/auth/v1/signup?redirect_to='+encodeURIComponent('https://www.fieldworkbybaker.com/login?verified=1&return=%2Fupgrade') :");
patch(account,"stage:'account_created',context:createdContext,adMeasurement", "stage:'account_created',context:createdContext,subjectId:created.id,adMeasurement");
patch(account,"stage:'email_verified',context:{...originFunnel", "stage:'email_verified',subjectId:identity.id,context:{...originFunnel");
patch('api/create-checkout-session.ts',"stage:'checkout_opened',context:","stage:'checkout_opened',subjectId:user.id,context:");
const login='src/pages/Login.tsx';
patch(login,"import { useState } from 'react';","import { useEffect, useState } from 'react';");
patch(login,"  const sessionRefresh = params.get('reason') === 'session-refresh';",`  const sessionRefresh = params.get('reason') === 'session-refresh';
  const fromVerification = params.get('verified') === '1';
  useEffect(()=>{
    // Provider confirmation links can include a one-time session in the URL fragment.
    // This app requires a normal password sign-in and never keeps or forwards these fragment credentials.
    if(/(?:access_token|refresh_token|error_code|error_description)=/.test(window.location.hash))window.history.replaceState(null,'',window.location.pathname+window.location.search);
  },[]);`);
patch(login,'            {sessionRefresh && (',`            {fromVerification && <div role="status" className="mb-4 rounded-xl border border-[#CFE7D9] p-3 text-sm">Continue after email verification. Sign in below to choose your membership. No payment has been taken.</div>}
            {sessionRefresh && (`);
patch(login,'<label className="block text-sm font-medium text-[#4D423C] mb-2">Email</label>','<label htmlFor="login-email" className="block text-sm font-medium text-[#4D423C] mb-2">Email</label>');
patch(login,'                    type="email"','                    id="login-email"\n                    type="email"');
patch(login,'<label className="block text-sm font-medium text-[#4D423C] mb-2">Password</label>','<label htmlFor="login-password" className="block text-sm font-medium text-[#4D423C] mb-2">Password</label>');
patch(login,"                    type={showPassword ? 'text' : 'password'}","                    id=\"login-password\"\n                    type={showPassword ? 'text' : 'password'}");
execFileSync('git',['add',...new Set(changed)]);
console.log('Verified-account deduplication, self-only measurement readback, and email handoff integrated. No roles or payments were changed.');
