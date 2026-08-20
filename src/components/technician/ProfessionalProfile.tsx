import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Building2, Camera, CircleAlert, CreditCard, FileText, Landmark, Save, ShieldCheck, Upload, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ValidationStatusView } from './ValidationStatusView';

type Professional = {
  name: string; work_phone: string; bio: string; education_level: string; degree_title: string;
  institution_name: string; public_avatar_path: string | null; validation_status: string; validation_notes: string | null;
};
type Checklist = { profile_complete: boolean; identity_verified: boolean; tax_document_approved: boolean; payment_account_valid: boolean; professional_license_valid: boolean; is_ready: boolean };
type DocumentRow = { id: string; document_type: string; label: string; storage_path: string; validation_status: string; validation_notes: string | null; created_at: string };
type Account = { account_holder: string; cbu_cvu: string; alias: string | null; provider: string; validation_status: string };

const educationOptions = [
  ['idoneo', 'Idóneo/a'], ['curso_certificado', 'Curso certificado'], ['tecnico', 'Técnico/a'],
  ['tecnico_superior', 'Técnico/a superior'], ['ingeniero', 'Ingeniero/a'], ['otro', 'Otro'],
];
const statusCopy: Record<string, string> = { pending: 'Pendiente de revisión', approved: 'Aprobado', observed: 'Con observaciones', suspended: 'Suspendido', replaced: 'Reemplazado' };

export const ProfessionalProfile: React.FC = () => {
  const { currentUser, technicians, showToast, refreshRemoteData, navigate } = useApp();
  const technician = useMemo(() => technicians.find((item) => item.id === currentUser?.technicianId), [technicians, currentUser?.technicianId]);
  const [profile, setProfile] = useState<Professional | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [account, setAccount] = useState<Account>({ account_holder: '', cbu_cvu: '', alias: '', provider: 'bank', validation_status: 'pending' });
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!technician || !isSupabaseConfigured) return;
    const [profileRes, checklistRes, documentsRes, accountRes] = await Promise.all([
      supabase.from('technicians').select('name, work_phone, bio, education_level, degree_title, institution_name, public_avatar_path, validation_status, validation_notes').eq('id', technician.id).single(),
      supabase.from('technician_enablement_checklist').select('*').eq('technician_id', technician.id).maybeSingle(),
      supabase.from('technician_documents').select('id, document_type, label, storage_path, validation_status, validation_notes, created_at').eq('technician_id', technician.id).eq('is_current', true).order('created_at', { ascending: false }),
      supabase.from('technician_payment_accounts').select('account_holder, cbu_cvu, alias, provider, validation_status').eq('technician_id', technician.id).maybeSingle(),
    ]);
    if (profileRes.error) { showToast('No se pudo cargar tu perfil profesional.', 'error'); return; }
    // Supabase returns null for empty optional columns. Keep the form state
    // string-only so saveProfile can safely trim its values.
    setProfile({
      name: profileRes.data.name ?? technician.name,
      work_phone: profileRes.data.work_phone ?? '',
      bio: profileRes.data.bio ?? '',
      education_level: profileRes.data.education_level ?? '',
      degree_title: profileRes.data.degree_title ?? '',
      institution_name: profileRes.data.institution_name ?? '',
      public_avatar_path: profileRes.data.public_avatar_path ?? null,
      validation_status: profileRes.data.validation_status ?? 'pending',
      validation_notes: profileRes.data.validation_notes ?? null,
    });
    setChecklist((checklistRes.data as Checklist | null) ?? null);
    setDocuments((documentsRes.data as DocumentRow[] | null) ?? []);
    if (accountRes.data) setAccount(accountRes.data as Account);
    const path = profileRes.data?.public_avatar_path;
    if (path) setAvatarUrl(supabase.storage.from('technician-avatars').getPublicUrl(path).data.publicUrl);
  };

  useEffect(() => { void load(); }, [technician?.id]);
  if (!technician || !currentUser) return null;

  const saveProfile = async () => {
    if (!profile?.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('technicians').update({
        name: profile.name.trim(), work_phone: (profile.work_phone ?? '').trim() || null, bio: (profile.bio ?? '').trim() || null,
        education_level: profile.education_level || null, degree_title: (profile.degree_title ?? '').trim() || null,
        institution_name: (profile.institution_name ?? '').trim() || null,
      }).eq('id', technician.id).select('id').single();
      if (error) throw error;
      await refreshRemoteData(); showToast('Perfil profesional guardado.', 'success');
    } catch (error) { showToast(`No se pudo guardar el perfil: ${error instanceof Error ? error.message : 'revisá los permisos.'}`, 'error'); } finally { setSaving(false); }
  };

  const saveAccount = async () => {
    const digits = account.cbu_cvu.replace(/\D/g, '');
    if (!account.account_holder.trim() || digits.length !== 22) { showToast('Ingresá titular y un CBU/CVU de 22 dígitos.', 'warning'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('technician_payment_accounts').upsert({ technician_id: technician.id, account_holder: account.account_holder.trim(), cbu_cvu: digits, alias: account.alias?.trim() || null, provider: account.provider }, { onConflict: 'technician_id' });
      if (error) throw error;
      showToast('Datos de cobro guardados para revisión.', 'success'); await load();
    } catch { showToast('No se pudieron guardar los datos de cobro.', 'error'); } finally { setSaving(false); }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { showToast('Usá JPG, PNG o WebP de hasta 2 MB.', 'warning'); return; }
    // A unique object avoids an upsert. Storage upserts require SELECT + UPDATE
    // policies and can fail even though the technician owns the new avatar.
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${technician.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('technician-avatars').upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: '3600',
    });
    if (error) { showToast(`No se pudo cargar la foto: ${error.message}`, 'error'); return; }
    const { error: dbError } = await supabase.from('technicians').update({ public_avatar_path: path }).eq('id', technician.id).select('id').single();
    if (dbError) { showToast(`La foto se cargó, pero no se pudo vincular: ${dbError.message}`, 'error'); return; }
    const publicUrl = supabase.storage.from('technician-avatars').getPublicUrl(path).data.publicUrl;
    setAvatarUrl(`${publicUrl}?v=${Date.now()}`); await refreshRemoteData(); showToast('Foto profesional actualizada.', 'success');
  };

  const uploadDocument = async (type: string, file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { showToast('El documento debe ser PDF y pesar hasta 10 MB.', 'warning'); return; }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-'); const path = `${technician.id}/${type}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('technician-documents').upload(path, file, { contentType: 'application/pdf' });
    if (error) { showToast('No se pudo subir el PDF.', 'error'); return; }
    await supabase.from('technician_documents').update({ is_current: false }).eq('technician_id', technician.id).eq('document_type', type).eq('is_current', true);
    const { error: dbError } = await supabase.from('technician_documents').insert({ technician_id: technician.id, document_type: type, label: file.name, storage_path: path });
    if (dbError) { showToast('El PDF subió, pero no se pudo registrar.', 'error'); return; }
    showToast('Documento enviado para revisión.', 'success'); await load();
  };

  const requirements = checklist ? [
    ['Perfil profesional', checklist.profile_complete], ['Identidad validada', checklist.identity_verified], ['Monotributo aprobado', checklist.tax_document_approved], ['Cuenta de cobro validada', checklist.payment_account_valid], ['Matrícula válida (si aplica)', checklist.professional_license_valid],
  ] : [];

  return <div className="max-w-4xl mx-auto space-y-4 py-4">
    <section className="rounded-2xl bg-[#0F172A] border border-slate-800 p-5 text-white"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-300 flex items-center justify-center"><UserRound className="w-5 h-5" /></div><div><h1 className="font-bold">Mi perfil profesional</h1><p className="text-xs text-slate-400 mt-1">Completá tus datos para que administración pueda validarte y asignarte servicios.</p></div></div><button onClick={() => navigate('/technician')} aria-label="Volver a la Terminal de Campo" className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300"><ArrowLeft className="w-4 h-4" /></button></div></section>
    <ValidationStatusView />
    {profile && <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4"><div className="flex items-center justify-between"><h2 className="font-bold text-sm">Perfil público</h2><span className={`text-[11px] font-bold rounded-full px-2 py-1 ${profile.validation_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{statusCopy[profile.validation_status] ?? profile.validation_status}</span></div>
      <div className="flex gap-4 items-center"><div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center font-bold text-slate-500">{avatarUrl ? <img src={avatarUrl} alt="Foto profesional" className="w-full h-full object-cover" /> : technician.name.slice(0, 2).toUpperCase()}</div><label className="cursor-pointer text-xs font-bold text-teal-700"><Camera className="inline w-4 mr-1" />Cambiar foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void uploadAvatar(e.target.files?.[0])} /></label></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Nombre profesional" value={profile.name} onChange={(value) => setProfile({ ...profile, name: value })} /><Field label="Teléfono laboral" value={profile.work_phone ?? ''} onChange={(value) => setProfile({ ...profile, work_phone: value })} /><label className="text-xs font-semibold text-slate-700">Nivel de formación<select value={profile.education_level ?? ''} onChange={(e) => setProfile({ ...profile, education_level: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"><option value="">Seleccionar</option>{educationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Field label="Título / certificación" value={profile.degree_title ?? ''} onChange={(value) => setProfile({ ...profile, degree_title: value })} /><Field label="Institución emisora" value={profile.institution_name ?? ''} onChange={(value) => setProfile({ ...profile, institution_name: value })} /></div>
      <label className="block text-xs font-semibold text-slate-700">Presentación profesional<textarea value={profile.bio ?? ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} maxLength={500} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="Contale al cliente tu experiencia y especialidades." /></label>
      {profile.validation_notes && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><CircleAlert className="inline w-4 mr-1" />{profile.validation_notes}</p>}<button onClick={() => void saveProfile()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><Save className="w-3.5" />Guardar perfil</button></section>}
    <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"><div className="flex items-center gap-2"><FileText className="w-4 text-teal-600" /><div><h2 className="font-bold text-sm">Documentación privada</h2><p className="text-[11px] text-slate-500">Sólo vos y la administración pueden ver estos PDFs.</p></div></div><div className="grid sm:grid-cols-2 gap-2">{[['monotributo', 'Constancia de monotributo'], ['identity', 'Documento de identidad'], ['degree', 'Título o certificación']].map(([type, label]) => { const row = documents.find((doc) => doc.document_type === type); return <label key={type} className="rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-teal-300"><span className="block text-xs font-bold text-slate-800">{label}</span><span className="block mt-1 text-[11px] text-slate-500">{row ? `${row.label} · ${statusCopy[row.validation_status] ?? row.validation_status}` : 'Adjuntar PDF (máx. 10 MB)'}</span>{row?.validation_notes && <span className="block mt-1 text-[11px] text-amber-700">{row.validation_notes}</span>}<input type="file" accept="application/pdf" className="hidden" onChange={(e) => void uploadDocument(type, e.target.files?.[0])} /></label>; })}</div></section>
    <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"><div className="flex items-center gap-2"><Landmark className="w-4 text-teal-600" /><div><h2 className="font-bold text-sm">Cuenta para liquidaciones</h2><p className="text-[11px] text-slate-500">Sólo vos y los administradores ven estos datos.</p></div></div><div className="grid sm:grid-cols-2 gap-3"><Field label="Titular de la cuenta" value={account.account_holder} onChange={(value) => setAccount({ ...account, account_holder: value })} /><Field label="CBU o CVU (22 dígitos)" value={account.cbu_cvu} onChange={(value) => setAccount({ ...account, cbu_cvu: value.replace(/\D/g, '').slice(0, 22) })} /><Field label="Alias (opcional)" value={account.alias ?? ''} onChange={(value) => setAccount({ ...account, alias: value })} /><label className="text-xs font-semibold text-slate-700">Entidad<select value={account.provider} onChange={(e) => setAccount({ ...account, provider: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"><option value="bank">Banco</option><option value="mercadopago">Mercado Pago</option><option value="other">Otra billetera</option></select></label></div><p className="text-[11px] text-slate-500"><ShieldCheck className="inline w-3.5 mr-1 text-teal-600" />Estado de cuenta: {statusCopy[account.validation_status] ?? 'Pendiente'}</p><button onClick={() => void saveAccount()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><CreditCard className="w-3.5" />Guardar datos de cobro</button></section>
    <section className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-3"><BadgeCheck className="w-4 text-teal-600" /><h2 className="font-bold text-sm">Habilitación para recibir trabajos</h2></div>{checklist ? <div className="space-y-2">{requirements.map(([label, done]) => <div key={String(label)} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{label}</span><span className={done ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{done ? 'Listo' : 'Pendiente'}</span></div>)}<p className={`mt-3 text-xs font-bold ${checklist.is_ready ? 'text-emerald-700' : 'text-slate-500'}`}>{checklist.is_ready ? 'Tu perfil está habilitado para recibir trabajos.' : 'Completá los requisitos y administración revisará tu perfil.'}</p></div> : <p className="text-xs text-slate-500">El checklist se generará al guardar los primeros datos.</p>}</section>
  </div>;
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => <label className="block text-xs font-semibold text-slate-700">{label}<input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal" /></label>;
