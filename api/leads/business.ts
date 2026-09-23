import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

type LeadBody = {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  serviceType?: string;
  description?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimmed(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const body = (req.body ?? {}) as LeadBody;
  const companyName = trimmed(body.companyName, 160);
  const contactName = trimmed(body.contactName, 120);
  const email = trimmed(body.email, 200).toLowerCase();
  const phone = trimmed(body.phone, 40);
  const serviceType = trimmed(body.serviceType, 80);
  const description = trimmed(body.description, 800);

  if (!companyName || !contactName || !EMAIL_RE.test(email) || !description) {
    return res.status(400).json({ error: 'Completá empresa, contacto, un email válido y qué necesitás.' });
  }

  const { data: lead, error } = await supabaseAdmin
    .from('business_leads')
    .insert({
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: phone || null,
      service_type: serviceType || null,
      description,
    })
    .select('id')
    .single();
  if (error || !lead) {
    console.error('[leads/business] insert', error);
    return res.status(500).json({ error: 'No se pudo enviar la consulta.' });
  }

  const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
  for (const admin of admins ?? []) {
    await supabaseAdmin.from('notifications').insert({
      recipient_profile_id: admin.id,
      type: 'business_lead',
      title: `Consulta B2B — ${companyName}`,
      body: `${contactName} (${email}) pidió una propuesta${serviceType ? ` de ${serviceType}` : ''}.`,
      entity_type: 'business_lead',
      entity_id: lead.id,
      priority: 'normal',
      dedupe_key: `business_lead:${lead.id}:${admin.id}`,
    });
  }

  return res.status(200).json({ ok: true });
}
