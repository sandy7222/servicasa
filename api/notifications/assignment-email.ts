import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

type Body = { orderId?: string; technicianId?: string };

async function sendResendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.RESEND_FROM_EMAIL || 'TecniUrbano <noreply@tecniurbano.online>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  return response.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  // Suspendido: los técnicos no usan mail. No enviar aunque haya RESEND_API_KEY.
  return res.status(200).json({ ok: true, skipped: 'suspended' });

  const caller = await getAuthenticatedCaller(req);
  if (!caller || caller.role !== 'admin') {
    return res.status(401).json({ error: 'Solo administración puede enviar este aviso.' });
  }

  const body = (req.body ?? {}) as Body;
  const orderId = String(body.orderId ?? '').trim();
  const technicianId = String(body.technicianId ?? '').trim();
  if (!orderId || !technicianId) {
    return res.status(400).json({ error: 'Falta la orden o el técnico.' });
  }

  const [{ data: technician }, { data: order }] = await Promise.all([
    supabaseAdmin.from('technicians').select('name, email, profile_id').eq('id', technicianId).maybeSingle(),
    supabaseAdmin.from('service_orders').select('id, title, client_address, scheduled_date').eq('id', orderId).maybeSingle(),
  ]);
  if (!technician?.email || !order) {
    return res.status(404).json({ error: 'No se encontró al técnico o la orden.' });
  }

  if (technician.profile_id) {
    const { data: prefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('email_assignment')
      .eq('profile_id', technician.profile_id)
      .maybeSingle();
    if (prefs && prefs.email_assignment === false) {
      return res.status(200).json({ ok: true, skipped: 'preference' });
    }
  }

  const origin = `https://${req.headers.host}`;
  const text = [
    `Hola ${technician.name},`,
    '',
    `Te asignaron una nueva orden: ${order.title}.`,
    order.client_address ? `Dirección: ${order.client_address}` : '',
    order.scheduled_date ? `Fecha: ${order.scheduled_date}` : '',
    '',
    `Abrí la Terminal de Campo para aceptarla o rechazarla: ${origin}/#/technician?order=${order.id}`,
  ]
    .filter(Boolean)
    .join('\n');

  const sent = await sendResendEmail(
    technician.email,
    `Nueva asignación — ${order.title}`,
    text
  );

  return res.status(200).json({ ok: true, sent });
}
