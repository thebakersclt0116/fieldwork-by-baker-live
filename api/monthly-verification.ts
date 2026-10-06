import { getBearerToken } from './_auth.js';
import { CloudError, cloudRequest, verifyCloudUser } from '../server/cloud-client.js';
import { fillMonthlyVerification, type VerificationIdentity } from '../server/monthly-verification.js';
import {createHash} from 'node:crypto';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({code:'METHOD_NOT_ALLOWED'}); }
  try {
    const token = getBearerToken(req);
    if (!token) throw new CloudError('AUTH_REQUIRED',401);
    // Only a confirmed managed identity with an ACTIVE protected subscription qualifies.
    // Owner, beta, export-pass, local role and three-day/Stripe trials cannot bypass this.
    const user = await verifyCloudUser(token);
    const profiles: any = await cloudRequest('/rest/v1/profiles?id=eq.'+user.id+'&select=display_name,subscription_tier,subscription_status',token);
    const profile = profiles?.[0];
    if (profile?.subscription_status !== 'active' || !['individual','professional','enterprise'].includes(profile?.subscription_tier)) throw new CloudError('PAID_SUBSCRIPTION_REQUIRED',403);
    const body = req.body || {};
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) || !['individual','organization'].includes(body.structure) || !['2022','2027'].includes(body.requirements) || !['SUPERVISED','CONCENTRATED'].includes(body.fieldworkType) || typeof body.organization !== 'string' || !body.organization.trim() || body.organization.length > 200) throw new CloudError('INVALID_FORM_INPUT',400);
    const filter = 'owner_id=eq.'+user.id;
    const version = async () => { const result: any = await cloudRequest('/rest/v1/workspaces?'+filter+'&select=version',token); return result?.[0]?.version; };
    const before = await version();
    const records: any[] = []; let cursor = '';
    for (let page=0;page<20;page++) {
      const result = await cloudRequest('/rest/v1/entries?'+filter+'&deleted_at=is.null&select=id,payload&order=id.asc&limit=500'+(cursor?'&id=gt.'+encodeURIComponent(cursor):''),token);
      if (!Array.isArray(result)) throw new CloudError('INVALID_CLOUD_RESPONSE');
      records.push(...result);
      if (result.length < 500) break;
      cursor = result.at(-1)?.id;
      if (page===19) throw new CloudError('EXPORT_TOO_LARGE',413);
    }
    if (before !== await version()) throw new CloudError('VERSION_CONFLICT',409);
    const identity: VerificationIdentity = { traineeName: body.traineeName || profile.display_name, bacbId: body.bacbId,
      state: body.state, country: body.country, supervisorName: body.supervisorName, supervisorCertification: body.supervisorCertification };
    const entries = records.map(record => record.payload).filter(entry => entry?.date?.slice(0,7) === body.month && entry.organizationName === body.organization &&
      (body.structure === 'organization' || entry.supervisorName === identity.supervisorName) &&
      (body.requirements === '2027' && body.structure === 'organization' || entry.fieldworkType === body.fieldworkType));
    if (!entries.length) throw new CloudError('NO_MONTHLY_ENTRIES',400);
    if (entries.some(entry => !Number.isFinite(entry.duration) || entry.duration < 0 || typeof entry.supervisionMinutes !== 'number' || !Number.isFinite(entry.supervisionMinutes) || entry.supervisionMinutes < 0 || entry.supervisionMinutes > entry.duration*60+0.01 || (entry.observationMinutes !== undefined && (!Number.isFinite(entry.observationMinutes) || entry.observationMinutes < 0 || entry.observationMinutes > entry.supervisionMinutes)))) throw new CloudError('REVIEW_HOUR_ALLOCATION',400);
    const totalMinutes = Math.round(entries.reduce((sum,entry) => sum+entry.duration*60,0));
    const supervisionMinutes = Math.round(entries.reduce((sum,entry) => sum+entry.supervisionMinutes,0));
    const observationMinutes = Math.round(entries.reduce((sum,entry) => sum+(entry.observationMinutes || 0),0));
    const pdf = await fillMonthlyVerification(identity,{totalMinutes,supervisionMinutes,observationMinutes},body.month,body.structure,body.requirements,body.fieldworkType);
    if (body.action === 'email') {
      const recipient = String(body.supervisorEmail || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(recipient) || recipient.length > 254 || !/^[a-f0-9-]{36}$/.test(body.requestId || '') || body.confirmSharing !== true) throw new CloudError('SUPERVISOR_EMAIL_REQUIRED',400);
      const key = process.env.RESEND_API_KEY; const from = process.env.BAKER_NOTIFICATION_FROM;
      if (!key || !from) throw new CloudError('EMAIL_NOT_CONFIGURED');
      const hash = createHash('sha256').update(JSON.stringify({identity,totalMinutes,supervisionMinutes,observationMinutes,month:body.month,structure:body.structure,requirements:body.requirements,fieldworkType:body.fieldworkType,recipient,organization:body.organization})).digest('hex');
      await cloudRequest('/rest/v1/rpc/reserve_monthly_form_email',token,{method:'POST',body:JSON.stringify({p_request_id:body.requestId,p_content_hash:hash})});
      const delivery = await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`monthly-form/${user.id}/${body.requestId}`},body:JSON.stringify({
        from,to:[recipient],reply_to:user.email,subject:`Monthly fieldwork verification — ${body.month}`,
        text:`${identity.traineeName} has sent you an unsigned monthly fieldwork verification form for ${body.month}. Please review every value against the records you supervised. If accurate, print and sign it or use an acceptable signature in a desktop PDF application. Both the trainee and supervisor must sign and date the form. Reply to this email to return the signed copy to the trainee. Both parties should retain their signed copy. This email does not approve or certify any hours.`,
        attachments:[{filename:`Fieldwork-${body.month}-unsigned-monthly-verification.pdf`,content:Buffer.from(pdf).toString('base64')}],
      })});
      if (!delivery.ok) throw new CloudError('FORM_EMAIL_NOT_SENT',502);
      const result: any = await delivery.json();
      if (!result?.id) throw new CloudError('FORM_EMAIL_NOT_CONFIRMED',502);
      return res.status(200).json({emailAccepted:true,supervisorEmail:recipient});
    }
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="Fieldwork-${body.month}-unsigned-monthly-verification.pdf"`);
    return res.status(200).send(Buffer.from(pdf));
  } catch (error) {
    const failure = error instanceof CloudError ? error : new CloudError('EXPORT_UNAVAILABLE');
    return res.status(failure.status).json({code:failure.code});
  }
}
