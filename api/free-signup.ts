function send(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return send(res, 410, {
    code: 'PERSISTENT_ACCOUNT_REQUIRED',
    error: 'Use the current signup page to create a recoverable, verified account.',
  });
}
