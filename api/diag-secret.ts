import { BAKER_RUNTIME_SECRET } from './_runtime-secret';

export default async function handler(req: any, res: any) {
  return res.status(200).json({ ok: true, generatedSecretAvailable: Boolean(BAKER_RUNTIME_SECRET) });
}
