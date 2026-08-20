import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasMpAccessToken: Boolean(process.env.MP_ACCESS_TOKEN),
    hasMpWebhookSecret: Boolean(process.env.MP_WEBHOOK_SECRET),
    nodeVersion: process.version,
  });
}
