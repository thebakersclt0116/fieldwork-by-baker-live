import { getBearerToken, requireAccountSession } from './_auth.js';

interface Request {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface Response {
  setHeader(name: string, value: string): void;
  status(code: number): Response;
  json(body: unknown): unknown;
}

/** Verify owner access on the server; a browser-stored role never authorizes it. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  }
  if (!getBearerToken(req)) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  const owner = await requireAccountSession(req, ['owner']);
  if (!owner) return res.status(403).json({ code: 'OWNER_REQUIRED' });
  return res.status(200).json({ authorized: true });
}
