import type { VercelRequest, VercelResponse } from '@vercel/node';

async function tryStep(name: string, fn: () => Promise<unknown> | unknown) {
  try {
    await fn();
    return { name, ok: true };
  } catch (err) {
    return { name, ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const steps = [
    await tryStep('import @supabase/supabase-js', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient;
    }),
    await tryStep('init supabaseAdmin client', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }),
    await tryStep('import mercadopago', async () => {
      const mp = await import('mercadopago');
      return mp.MercadoPagoConfig;
    }),
    await tryStep('init MercadoPagoConfig', async () => {
      const { MercadoPagoConfig } = await import('mercadopago');
      return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    }),
    await tryStep('import ../_lib/supabaseAdmin', async () => {
      const mod = await import('./_lib/supabaseAdmin');
      return mod.supabaseAdmin;
    }),
    await tryStep('import ../_lib/mercadopago', async () => {
      const mod = await import('./_lib/mercadopago');
      return mod.mpClient;
    }),
  ];

  res.status(200).json({ ok: true, nodeVersion: process.version, steps });
}
