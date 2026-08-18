import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, CircleAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

type Requirement = { requirement_type: string; status: string; review_notes: string | null; is_required: boolean };
const labels: Record<string, string> = { profile_complete: 'Perfil profesional', education_verified: 'Formación técnica', matricula_validated: 'Matrícula profesional', monotributo_approved: 'Constancia de monotributo', identity_verified: 'Identidad', bank_account_valid: 'Cuenta de cobro' };

export function ValidationStatusView() {
  const { currentUser } = useApp(); const technicianId = currentUser?.technicianId; const [requirements, setRequirements] = useState<Requirement[]>([]); const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; kind: string }>>([]);
  useEffect(() => { if (!technicianId) return; void Promise.all([supabase.from('technician_requirements').select('requirement_type,status,review_notes,is_required').eq('technician_id', technicianId), supabase.from('technician_notifications').select('id,title,message,kind').eq('technician_id', technicianId).order('created_at', { ascending: false }).limit(3)]).then(([r, n]) => { setRequirements((r.data ?? []) as Requirement[]); setNotifications((n.data ?? []) as Array<{ id: string; title: string; message: string; kind: string }>); }); }, [technicianId]);
  if (!technicianId) return null;
  const pending = requirements.filter((r) => r.is_required && r.status !== 'approved' && r.status !== 'not_required');
  return <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"><div className="flex items-center gap-2"><Bell className="w-4 text-teal-600" /><div><h2 className="text-sm font-bold">Estado de validación</h2><p className="text-[11px] text-slate-500">Completá o corregí lo observado para recibir trabajos.</p></div></div>{pending.length ? pending.map((r) => <div key={r.requirement_type} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950"><CircleAlert className="inline w-3.5 mr-1" /><b>{labels[r.requirement_type]}</b>: {r.review_notes || 'Pendiente de revisión.'}</div>) : <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800"><CheckCircle2 className="inline w-3.5 mr-1" />No tenés requisitos obligatorios pendientes.</div>}{notifications.map((n) => <div key={n.id} className="rounded-lg bg-slate-50 p-2 text-xs"><b>{n.title}</b><p className="text-slate-600">{n.message}</p></div>)}</section>;
}
