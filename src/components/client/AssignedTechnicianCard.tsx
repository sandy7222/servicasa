import React, { useEffect, useState } from 'react';
import { BadgeCheck, GraduationCap, ShieldCheck, Star, UserRound } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type PublicTechnician = {
  id: string; name: string; specialty: string; rating: number; completed_orders_count: number;
  public_avatar_path: string | null; degree_title: string | null; institution_name: string | null;
  validation_status: string; validated_licenses: Array<{ issuing_entity: string; license_number: string; specialty?: string | null }>;
};

export const AssignedTechnicianCard: React.FC<{ technicianId: string | null }> = ({ technicianId }) => {
  const [technician, setTechnician] = useState<PublicTechnician | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>();

  useEffect(() => {
    if (!technicianId || !isSupabaseConfigured) return;
    void supabase.from('technician_public_view').select('*').eq('id', technicianId).maybeSingle().then(({ data }) => {
      const result = data as PublicTechnician | null;
      setTechnician(result);
      if (result?.public_avatar_path) setAvatarUrl(supabase.storage.from('technician-avatars').getPublicUrl(result.public_avatar_path).data.publicUrl);
    });
  }, [technicianId]);

  if (!technicianId) return null;
  if (!technician) return <section className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-500">Tu técnico fue asignado. Sus datos profesionales verificados aparecerán aquí.</section>;
  const verified = technician.validation_status === 'approved';

  return <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Tu técnico asignado</div><div className="flex gap-3"><div className="w-14 h-14 rounded-full border border-teal-100 bg-teal-50 overflow-hidden shrink-0 flex items-center justify-center text-teal-700 font-bold">{avatarUrl ? <img src={avatarUrl} alt={`Foto de ${technician.name}`} className="w-full h-full object-cover" /> : <UserRound className="w-6 h-6" />}</div><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-900">{technician.name}</h3><p className="text-xs text-teal-700 font-semibold mt-0.5">{technician.specialty}</p><div className="flex gap-2 mt-1.5 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1"><Star className="w-3.5 text-amber-500 fill-amber-500" />{Number(technician.rating).toFixed(1)}</span><span>{technician.completed_orders_count} trabajos</span></div>{technician.degree_title && <p className="mt-2 text-xs text-slate-600 inline-flex items-center gap-1"><GraduationCap className="w-3.5 text-slate-500" />{technician.degree_title}{technician.institution_name ? ` · ${technician.institution_name}` : ''}</p>}{technician.validated_licenses?.map((license, index) => <p key={`${license.license_number}-${index}`} className="mt-1 text-[11px] text-emerald-700 inline-flex items-center gap-1"><BadgeCheck className="w-3.5" />Matrícula {license.license_number} · {license.issuing_entity}</p>)}</div></div><div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] ${verified ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><ShieldCheck className="inline w-3.5 mr-1" />{verified ? 'Técnico verificado por ServiCasa.' : 'Documentación profesional en proceso de validación.'}</div><p className="mt-2 text-[10px] text-slate-400">Por seguridad, sus documentos y datos de cobro son privados.</p></section>;
};
