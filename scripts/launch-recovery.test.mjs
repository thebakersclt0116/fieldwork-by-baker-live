import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AiGatewayError, classifyGatewayFailure, parseStructuredResponse, requestStructuredGateway, safeAiFailure } from '../server/ai-gateway-client.ts';
const read = path => fs.readFileSync(path,'utf8');
const params = { token: 'synthetic-test-token-never-valid', model: 'openai/gpt-5.6-sol', instructions: 'Explain a BCBA concept.', input: 'What is latency?', schemaName: 'test', schema: { type:'object', properties:{answer:{type:'string'}}, required:['answer'],additionalProperties:false }, feature:'product:baker-test', maxOutputTokens:2000 };
const good = { answer: 'Latency is the time from the specified antecedent to response onset.' };
const responsePayload = { status:'completed', output:[{ type:'message', content:[{type:'output_text',text:JSON.stringify(good)}] }] };

test('classifies account billing, authentication, rate, model and format failures separately',()=>{
  assert.equal(classifyGatewayFailure(402,'payment required').code,'AI_BILLING_REQUIRED');
  assert.equal(classifyGatewayFailure(429,{error:{code:'insufficient_quota'}}).code,'AI_BILLING_REQUIRED');
  assert.equal(classifyGatewayFailure(401,'unauthorized').code,'AI_AUTH_REQUIRED');
  assert.equal(classifyGatewayFailure(403,'forbidden').code,'AI_AUTH_REQUIRED');
  assert.equal(classifyGatewayFailure(429,'rate limit').code,'AI_RATE_LIMITED');
  assert.equal(classifyGatewayFailure(404,{error:{code:'model_not_found'}}).code,'AI_MODEL_UNAVAILABLE');
  assert.equal(classifyGatewayFailure(400,'format unsupported').code,'AI_REQUEST_REJECTED');
  assert.equal(classifyGatewayFailure(504,'timeout').code,'AI_TIMEOUT');
});
test('safe failures cannot leak provider bodies, user data or credentials',()=>{
  const raw = 'Bearer SECRET_EXAMPLE User example and private fieldwork text';
  const a=safeAiFailure(classifyGatewayFailure(403,raw)), b=safeAiFailure(new Error(raw));
  assert.equal(a.liveModelResponded,false); assert.equal(b.liveModelResponded,false);
  assert.equal(JSON.stringify([a,b]).includes(raw),false);
  assert.equal(JSON.stringify([a,b]).includes('SECRET_EXAMPLE'),false);
});
test('Responses JSON and compatible Chat JSON parse correctly',()=>{
  assert.deepEqual(parseStructuredResponse(responsePayload,'responses'),good);
  assert.deepEqual(parseStructuredResponse({choices:[{finish_reason:'stop',message:{content:'```json\n'+JSON.stringify(good)+'\n```'}}]},'chat'),good);
});
test('incomplete, refusal, absent and malformed answers never count as a live response',()=>{
  assert.throws(()=>parseStructuredResponse({...responsePayload,status:'incomplete'},'responses'),AiGatewayError);
  assert.throws(()=>parseStructuredResponse({choices:[{finish_reason:'length',message:{content:JSON.stringify(good)}}]},'chat'),AiGatewayError);
  assert.throws(()=>parseStructuredResponse({output:[{content:[{type:'refusal'}]}]},'responses'),/could not answer/);
  assert.throws(()=>parseStructuredResponse({output_text:'not json'},'responses'),AiGatewayError);
  assert.throws(()=>parseStructuredResponse({},'responses'),AiGatewayError);
});
test('live request has fixed upstream origin, same model, privacy flag and bounded deadline/output',async()=>{
  let request;
  const result=await requestStructuredGateway({...params,fetchImpl:async(url,init)=>{request={url,...init};return Response.json(responsePayload);}});
  assert.deepEqual(result.data,good); assert.equal(result.transport,'responses');
  assert.equal(request.url,'https://ai-gateway.vercel.sh/v1/responses');
  assert.ok(request.signal instanceof AbortSignal);
  const body=JSON.parse(request.body); assert.equal(body.model,params.model); assert.equal(body.store,false); assert.equal(body.max_output_tokens,2000);
  assert.equal(Object.keys(request.headers).some(k=>k==='ai-reporting-user'),false);
});
test('format incompatibility retries once using same-model Chat Completions',async()=>{
  const seen=[];
  const result=await requestStructuredGateway({...params,fetchImpl:async(url,init)=>{
    seen.push({url,body:JSON.parse(init.body)});
    return seen.length===1?Response.json({error:{code:'unsupported_parameter'}},{status:400}):Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(good)}}]});
  }});
  assert.equal(result.transport,'chat'); assert.equal(seen.length,2);
  assert.ok(seen.every(s=>s.body.model===params.model)); assert.ok(seen[1].url.endsWith('/chat/completions'));
});
for(const [status,code] of [[402,'AI_BILLING_REQUIRED'],[401,'AI_AUTH_REQUIRED'],[403,'AI_AUTH_REQUIRED'],[429,'AI_RATE_LIMITED'],[503,'AI_PROVIDER_UNAVAILABLE']])test(`does not retry or circumvent upstream ${status}`,async()=>{
  let calls=0;
  await assert.rejects(requestStructuredGateway({...params,fetchImpl:async()=>{calls++;return Response.json({error:{code:'generic'}},{status});}}),e=>e.code===code);
  assert.equal(calls,1);
});
test('network and timeout failures are safe and never successful fallback answers',async()=>{
  await assert.rejects(requestStructuredGateway({...params,fetchImpl:async()=>{throw new Error('network detail SECRET');}}),e=>e.code==='AI_PROVIDER_UNAVAILABLE'&&!e.message.includes('SECRET'));
  await assert.rejects(requestStructuredGateway({...params,fetchImpl:async()=>{throw new DOMException('Timeout','TimeoutError');}}),e=>e.code==='AI_TIMEOUT');
});
test('API status, UI and owner diagnostic all require genuine model success',()=>{
  const api=read('api/baker-ai.ts'), ui=read('src/pages/BakerBrainHub.tsx'), admin=read('src/pages/AdminLaunchCheck.tsx');
  assert.ok(api.includes("status: 'degraded'")); assert.ok(api.includes('return send(res, 503, { ...createBakerBrainFallback'));
  assert.ok(api.includes('liveModelVerified: false')); assert.ok(ui.includes('payload.liveModelResponded !== true'));
  assert.ok(ui.includes('Retry question')); assert.ok(admin.includes('payload.liveModelResponded === true'));
  assert.equal(api.includes("console.error('Baker Brain request failed', error)"),false);
});
test('known recovery origin no longer redirects back to a broken custom domain',()=>{
  const main=read('src/main.tsx'),layout=read('src/components/Layout.tsx');
  assert.equal(main.includes('target.host = CANONICAL_HOST'),false);
  assert.ok(layout.includes('Temporary recovery address.')); assert.ok(layout.includes('Do not clear browser data'));
});
test('production blocks both test payments and unsafe live entitlement grants',()=>{
  for(const path of ['api/create-checkout-session.ts','api/checkout-complete.ts']){
    const src=read(path);
    assert.ok(src.includes('await requireSession'));
    assert.ok(src.includes('forwardCloudBilling'));
    assert.equal(src.includes('signSession'),false);
    assert.equal(src.includes('api.stripe.com'),false);
  }
  // Signature, live-mode, lifecycle, and finite access behavior is exercised by
  // cloud/tests/billing.test.ts against the SDK and an isolated PostgreSQL DB.
  const proxy=read('server/cloud-billing.ts');
  assert.ok(proxy.includes('allowedBrowserOrigin(req)'));
  assert.ok(proxy.includes('BILLING_BACKEND_REQUIRED'));
  assert.ok(proxy.includes("redirect: 'error'"));
  assert.ok(read('src/pages/Upgrade.tsx').includes('!billingEnabled || Boolean(loadingPlan)'));
});
test('verified live catalog is consistent with approved launch prices and does not start subscriptions',()=>{
  const catalog=JSON.parse(read('config/stripe-live-catalog.json'));
  assert.equal(catalog.mode,'live'); assert.equal(catalog.checkoutEnabled,false);
  assert.equal(catalog.plans.individual_monthly.unitAmount,1699);
  assert.equal(catalog.plans.professional_monthly.unitAmount,3499);
  assert.equal(catalog.plans.professional_annual.unitAmount,34900);
  assert.equal(catalog.trial.days,3); assert.equal(catalog.trial.automaticChargeOnDayFour,false);
  assert.ok(Object.values(catalog.plans).every(p=>p.priceId.startsWith('price_')));
});
