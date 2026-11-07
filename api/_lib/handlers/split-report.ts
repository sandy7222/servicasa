import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';

/**
 * Cobro repartido, Fase 4 (plan-cobro-repartido.md): informe mensual de lo cobrado por reparto.
 * /api/payments/split-report?month=YYYY-MM → /api/gateway?action=split-report
 *
 * - Admin: todos los técnicos (para facturarle a cada uno la comisión).
 * - Técnico: solo lo suyo (informativo: la plata ya está en su Mercado Pago).
 * Cuenta los pagos COBRADOS (approved) y los devueltos (refunded) del mes, por fecha de cobro, en hora argentina.
 * Sin tokens, sin datos de tarjeta, sin datos del cliente más allá del título de la orden.
 */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const AR_OFFSET_HOURS = 3; // Argentina, UTC-3 sin horario de verano

export function monthRange(month: string): { from: string; to: string } | null {
  const match = MONTH.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return {
    from: new Date(Date.UTC(year, index, 1, AR_OFFSET_HOURS)).toISOString(),
    to: new Date(Date.UTC(year, index + 1, 1, AR_OFFSET_HOURS)).toISOString(),
  };
}

export function currentArgentinaMonth(now = Date.now()): string {
  return new Date(now - AR_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 7);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type SplitReportRow = {
  id: string;
  orderId: string;
  orderTitle: string;
  technicianId: string;
  technicianName: string;
  capturedAt: string | null;
  status: 'approved' | 'refunded';
  amount: number;
  commission: number;
  mpFee: number;
  technicianNet: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const caller = await getAuthenticatedCaller(req);
  if (!caller) return res.status(401).json({ error: 'Tu sesión expiró. Volvé a iniciar sesión.' });
  const isAdmin = caller.role === 'admin';
  if (!isAdmin && !(caller.role === 'technician' && caller.technicianId)) {
    return res.status(403).json({ error: 'No tenés acceso a este informe.' });
  }

  const month = typeof req.query.month === 'string' && req.query.month ? req.query.month : currentArgentinaMonth();
  const range = monthRange(month);
  if (!range) return res.status(400).json({ error: 'Mes inválido.' });

  let query = supabaseAdmin
    .from('payment_transactions')
    .select('id, order_id, split_technician_id, status, amount, application_fee, mp_fee_amount, captured_at, service_orders(title), technicians:split_technician_id(name)')
    .eq('split', true)
    .in('status', ['approved', 'refunded'])
    .gte('captured_at', range.from)
    .lt('captured_at', range.to)
    .order('captured_at', { ascending: true });
  if (!isAdmin) query = query.eq('split_technician_id', caller.technicianId as string);

  const { data, error } = await query;
  if (error) {
    console.error('[split-report] no se pudo armar el informe', error.message);
    return res.status(500).json({ error: 'No se pudo cargar el informe.' });
  }

  const rows: SplitReportRow[] = ((data ?? []) as Array<Record<string, any>>).map((p) => {
    const amount = Number(p.amount ?? 0);
    const commission = Number(p.application_fee ?? 0);
    const mpFee = Number(p.mp_fee_amount ?? 0);
    return {
      id: String(p.id),
      orderId: String(p.order_id),
      orderTitle: String(p.service_orders?.title ?? 'Orden'),
      technicianId: String(p.split_technician_id ?? ''),
      technicianName: String(p.technicians?.name ?? 'Técnico'),
      capturedAt: p.captured_at ?? null,
      status: p.status === 'refunded' ? 'refunded' : 'approved',
      amount,
      commission,
      mpFee,
      technicianNet: round2(amount - commission - mpFee),
    };
  });

  // Los devueltos se muestran pero no suman: esa plata volvió al cliente.
  const counted = rows.filter((r) => r.status === 'approved');
  const totals = {
    count: counted.length,
    amount: round2(counted.reduce((s, r) => s + r.amount, 0)),
    commission: round2(counted.reduce((s, r) => s + r.commission, 0)),
    mpFee: round2(counted.reduce((s, r) => s + r.mpFee, 0)),
    technicianNet: round2(counted.reduce((s, r) => s + r.technicianNet, 0)),
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ month, rows, totals });
}
