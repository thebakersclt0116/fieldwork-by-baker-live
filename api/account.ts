import { CloudError, cloudConfiguration, cloudRequest, verifyCloudUser } from '../server/cloud-client.js';

// Managed identities are separate from legacy beta sessions. No role is accepted from a client.
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  const send = (status: number, body: unknown) => res.status(status).json(body);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { code: 'METHOD_NOT_ALLOWED' }); }
  try {
    const body = req.body || {};
    const action = body.action;
    cloudConfiguration();
    if (action === 'recover') {
      const email=String(body.email||'').trim().toLowerCase();
      if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return send(400,{code:'INVALID_ACCOUNT_INPUT'});
      // Client input cannot choose where recovery credentials are delivered.
      await cloudRequest('/auth/v1/recover?redirect_to='+encodeURIComponent('https://www.fieldworkbybaker.com/reset-password'),null,{method:'POST',body:JSON.stringify({email})});
      return send(202,{message:'If an account exists, a recovery email will be sent.'});
    }
    if (action === 'reset-password') {
      const password=typeof body.password==='string'?body.password:'';
      if(password.length<8||password.length>1024)return send(400,{code:'INVALID_ACCOUNT_INPUT'});
      const authorization=String(req.headers?.authorization||'');
      if(!authorization.startsWith('Bearer '))throw new CloudError('AUTH_REQUIRED',401);
      const token=authorization.slice(7);
      await verifyCloudUser(token);
      await cloudRequest('/auth/v1/user',token,{method:'PUT',body:JSON.stringify({password})});
      // Do not return recovery credentials or turn this flow into a paid session.
      let sessionsRevoked=true;
      try {await cloudRequest('/auth/v1/logout?scope=global',token,{method:'POST'});} catch {sessionsRevoked=false;}
      return send(200,{passwordChanged:true,sessionsRevoked});
    }
    if (action === 'signup' || action === 'login' || action === 'refresh') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim();
      const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
      if (action === 'refresh' ? refreshToken.length < 8 || refreshToken.length > 8192 : !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 1024 || (action === 'signup' && (name.length < 2 || name.length > 120))) return send(400, { code: 'INVALID_ACCOUNT_INPUT' });
      const payload: any = await cloudRequest(action === 'signup' ? '/auth/v1/signup' : action === 'refresh' ? '/auth/v1/token?grant_type=refresh_token' : '/auth/v1/token?grant_type=password', null, {
        method: 'POST', body: JSON.stringify(action === 'signup' ? { email, password, data: { name } } : action === 'refresh' ? { refresh_token: refreshToken } : { email, password }),
      });
      // A signup must require email confirmation; never create a trial from unverified input.
      if (action === 'signup') {
        if (payload?.access_token) throw new CloudError('EMAIL_CONFIRMATION_NOT_CONFIGURED');
        return send(202, { verificationRequired: true });
      }
      if (!payload?.access_token || !payload?.refresh_token) throw new CloudError('AUTH_REQUIRED', 401);
      const identity = await verifyCloudUser(payload.access_token);
      const profiles: any = await cloudRequest('/rest/v1/profiles?select=display_name,email,role,trial_ends_at,subscription_tier,subscription_status&id=eq.' + identity.id, payload.access_token);
      const profile = profiles?.[0];
      if (!profile) throw new CloudError('ACCOUNT_NOT_READY');
      const activeSubscription = ['active','trialing'].includes(profile.subscription_status) && ['individual','professional'].includes(profile.subscription_tier);
      const role = ['owner','supervisor'].includes(profile.role) ? profile.role : activeSubscription ? (profile.subscription_tier === 'professional' ? 'professional' : 'paid') : 'free';
      return send(200, { token: payload.access_token, refreshToken: payload.refresh_token, expiresAt: payload.expires_at,
        user: { name: profile.display_name, email: identity.email, role,
          subscription: activeSubscription ? profile.subscription_tier : 'none', subscriptionStatus: profile.subscription_status,
          trialEndsAt: profile.trial_ends_at ? Math.floor(Date.parse(profile.trial_ends_at)/1000) : undefined } });
    }
    if (action === 'logout') {
      const authorization = String(req.headers?.authorization || '');
      if (!authorization.startsWith('Bearer ')) throw new CloudError('AUTH_REQUIRED',401);
      const token = authorization.slice(7);
      await verifyCloudUser(token);
      await cloudRequest('/auth/v1/logout?scope=local',token,{method:'POST'});
      return send(200,{signedOut:true});
    }
    return send(400, { code: 'INVALID_ACCOUNT_ACTION' });
  } catch (error) {
    const failure = error instanceof CloudError ? error : new CloudError('ACCOUNT_UNAVAILABLE');
    return send(failure.status, { code: failure.code });
  }
}
