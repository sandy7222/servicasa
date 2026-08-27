import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, FileText, Landmark, ShieldAlert, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { playClickSound } from '../../lib/uiSound';

type TechnicianRow = { id: string; name: string; specialty: string; phone: string | null; work_phone: string | null; bio: string | null; education_level: string | null; degree_title: string | null; institution_name: string | null; validation_status: string; validation_notes: string | null };
type Requirement = { id: string; requirement_type: string; is_required: boolean; status: 'pending' | 'approved' | 'observed' | 'not_required'; review_notes: string | null };
type DocumentRow = { id: string; document_type: string; label: string; storage_path: string; validation_status: string; validation_notes: string | null };
type License = { id: string; issuing_entity: string; license_number: string; specialty: string | null; validation_status: string; validation_notes: string | null };
type Account = { id: string; account_holder: string; cbu_cvu: string; alias: string | null; provider: string; validation_status: string; validation_notes: string | null };

const labels: Record<string, string> = {
  profile_complete: 'Perfil profesional',
  education_verified: 'Formación técnica',
  matricula_validated: 'Matrícula profesional',
  monotributo_approved: 'Constancia de monotributo',
  identity_verified: 'Identidad (DNI)',
  bank_account_valid: 'Cuenta de cobro',
};

export function TechnicianReviewCard({ technicianId, onClose, onChanged }: { technicianId: string; onClose: () => void; onChanged: () => Promise<void> }) {
  const { currentUser, showToast } = useApp();
  const [tech, setTech] = useState<TechnicianRow | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState('');
  const [matriculaForm, setMatriculaForm] = useState({ issuing_entity: '', license_number: '' });
  const [accountForm, setAccountForm] = useState({ account_holder: '', cbu_cvu: '', alias: '', provider: 'bank' });
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [savingExtra, setSavingExtra] = useState(false);

  const load = async () => {
    setLoading(true);
    const [t, r, d, l, a] = await Promise.all([
      supabase.from('technicians').select('id,name,specialty,phone,work_phone,bio,education_level,degree_title,institution_name,validation_status,validation_notes').eq('id', technicianId).single(),
      supabase.from('technician_requirements').select('*').eq('technician_id', technicianId).order('requirement_type'),
      supabase.from('technician_documents').select('id,document_type,label,storage_path,validation_status,validation_notes').eq('technician_id', technicianId).eq('is_current', true),
      supabase.from('technician_matriculas').select('id,issuing_entity,license_number,specialty,validation_status,validation_notes').eq('technician_id', technicianId),
      supabase.from('technician_payment_accounts').select('id,account_holder,cbu_cvu,alias,provider,validation_status,validation_notes').eq('technician_id', technicianId).maybeSingle(),
    ]);
    setTech(t.data as TechnicianRow | null);
    setRequirements((r.data ?? []) as Requirement[]);
    setDocs((d.data ?? []) as DocumentRow[]);
    setLicenses((l.data ?? []) as License[]);
    setAccount(a.data as Account | null);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [technicianId]);

  const reviewed = requirements.filter((r) => !r.is_required || r.status === 'approved' || r.status === 'not_required').length;
  const canApprove = requirements.length > 0 && requirements.every((r) => !r.is_required || r.status === 'approved' || r.status === 'not_required');
  const unresolvedRequired = requirements.filter((r) => r.is_required && r.status !== 'approved' && r.status !== 'not_required');

  const applyRequirementStatus = async (requirement: Requirement, status: Requirement['status'], note: string) => {
    const now = new Date().toISOString();
    await supabase.from('technician_requirements').update({ status, review_notes: note || null, reviewed_at: now, reviewed_by: currentUser?.id ?? null }).eq('id', requirement.id);
    await supabase.from('technician_review_history').insert({
      technician_id: technicianId,
      requirement_type: requirement.requirement_type,
      action: status === 'approved' ? 'requirement_approved' : status === 'observed' ? 'requirement_observed' : 'requirement_not_required',
      reason: note || null,
      reviewed_by: currentUser?.id ?? null,
    });
    await supabase.from('technician_notifications').insert({
      technician_id: technicianId,
      title: `Revisión: ${labels[requirement.requirement_type]}`,
      message: status === 'approved' ? 'Requisito aprobado.' : status === 'not_required' ? 'Este requisito no aplica a tus especialidades.' : `Observación: ${note}`,
      kind: status === 'approved' ? 'success' : 'warning',
    });
  };

  const toggleReqSelection = (id: string) => {
    setSelectedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkUpdateSelected = async (status: 'approved' | 'observed') => {
    const chosen = requirements.filter((r) => selectedReqIds.has(r.id));
    if (chosen.length === 0) return;
    if (status === 'observed' && !bulkNote.trim()) return showToast('Escribí el motivo para observar.', 'warning');
    setPending(`bulk:${status}`);
    try {
      for (const r of chosen) await applyRequirementStatus(r, status, bulkNote.trim());
      showToast(`${chosen.length} requisito${chosen.length === 1 ? '' : 's'} ${status === 'approved' ? 'aprobado' : 'observado'}${chosen.length === 1 ? '' : 's'}.`, 'success');
      setSelectedReqIds(new Set());
      setBulkNote('');
      await load();
    } catch {
      showToast('No se pudieron actualizar todos los requisitos seleccionados.', 'error');
    } finally {
      setPending(null);
    }
  };

  const markNotApplicable = async (r: Requirement) => {
    playClickSound();
    setPending(`${r.id}:not_required`);
    await applyRequirementStatus(r, 'not_required', '');
    await load();
    setPending(null);
  };

  const saveMatricula = async () => {
    if (!matriculaForm.issuing_entity.trim() || !matriculaForm.license_number.trim()) return showToast('Completá entidad y número de matrícula.', 'warning');
    playClickSound();
    setSavingExtra(true);
    const { error } = await supabase.from('technician_matriculas').insert({ technician_id: technicianId, issuing_entity: matriculaForm.issuing_entity.trim(), license_number: matriculaForm.license_number.trim() });
    if (error) { setSavingExtra(false); return showToast('No se pudo guardar la matrícula.', 'error'); }
    setMatriculaForm({ issuing_entity: '', license_number: '' });
    showToast('Matrícula cargada.', 'success');
    await load();
    setSavingExtra(false);
  };

  const saveAccount = async () => {
    const digits = accountForm.cbu_cvu.replace(/\D/g, '');
    if (!accountForm.account_holder.trim() || digits.length !== 22) return showToast('Ingresá titular y un CBU/CVU de 22 dígitos.', 'warning');
    playClickSound();
    setSavingExtra(true);
    const { error } = await supabase.from('technician_payment_accounts').upsert(
      { technician_id: technicianId, account_holder: accountForm.account_holder.trim(), cbu_cvu: digits, alias: accountForm.alias.trim() || null, provider: accountForm.provider },
      { onConflict: 'technician_id' }
    );
    if (error) { setSavingExtra(false); return showToast('No se pudo guardar la cuenta.', 'error'); }
    setAccountForm({ account_holder: '', cbu_cvu: '', alias: '', provider: 'bank' });
    showToast('Cuenta cargada.', 'success');
    await load();
    setSavingExtra(false);
  };

  const uploadDocumentForTechnician = async (docType: 'monotributo' | 'identity', file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) return showToast('El documento debe ser PDF y pesar hasta 10 MB.', 'warning');
    setUploadingDocType(docType);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${technicianId}/${docType}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('technician-documents').upload(path, file, { contentType: 'application/pdf' });
    if (error) { setUploadingDocType(null); return showToast('No se pudo subir el PDF.', 'error'); }
    await supabase.from('technician_documents').update({ is_current: false }).eq('technician_id', technicianId).eq('document_type', docType).eq('is_current', true);
    const { error: dbError } = await supabase.from('technician_documents').insert({ technician_id: technicianId, document_type: docType, label: file.name, storage_path: path });
    if (dbError) { setUploadingDocType(null); return showToast('El PDF subió, pero no se pudo registrar.', 'error'); }
    showToast('Documento cargado.', 'success');
    await load();
    setUploadingDocType(null);
  };

  const decide = async (action: 'approved' | 'observed' | 'suspended') => {
    const note = decisionNote.trim();
    if ((action === 'observed' || action === 'suspended') && !note) return showToast('Escribí un motivo antes de continuar.', 'warning');
    if (action === 'approved' && !canApprove) return showToast('No podés aprobar: quedan requisitos obligatorios pendientes.', 'warning');
    setPending(`decide:${action}`);
    const { error } = await supabase.from('technicians').update({
      validation_status: action, validation_notes: note || null, is_enabled: action === 'approved', can_receive_orders: action === 'approved',
      validated_at: new Date().toISOString(), validated_by: currentUser?.id ?? null,
    }).eq('id', technicianId);
    if (error) { setPending(null); return showToast('No se pudo guardar la decisión final.', 'error'); }
    await supabase.from('technician_enablement_checklist').update({ is_ready: action === 'approved', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id ?? null }).eq('technician_id', technicianId);
    await supabase.from('technician_review_history').insert({
      technician_id: technicianId,
      action: action === 'approved' ? 'technician_approved' : action === 'suspended' ? 'technician_suspended' : 'technician_observed',
      reason: note || null, reviewed_by: currentUser?.id ?? null,
    });
    await supabase.from('technician_notifications').insert({
      technician_id: technicianId,
      title: action === 'approved' ? 'Ya podés recibir trabajos' : action === 'suspended' ? 'Cuenta suspendida' : 'Perfil con observaciones',
      message: action === 'approved' ? 'Tu perfil fue aprobado por TecniUrbano.' : note,
      kind: action === 'approved' ? 'success' : action === 'suspended' ? 'error' : 'warning',
    });
    showToast(
      action === 'approved' ? `${tech?.name ?? 'Técnico'} aprobado: ya puede recibir órdenes.` : action === 'suspended' ? `${tech?.name ?? 'Técnico'} suspendido.` : `${tech?.name ?? 'Técnico'} marcado con observaciones.`,
      'success'
    );
    setPending(null);
    await onChanged();
    onClose();
  };

  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from('technician-documents').createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return showToast('No se pudo abrir el documento privado.', 'error');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // Each requirement type checks a different table — show the actual submitted
  // evidence right where the admin decides, and let them load it themselves
  // (upload PDF / cargar matrícula / cargar cuenta) when the technician hasn't.
  const renderRequirementEvidence = (r: Requirement) => {
    if (r.requirement_type === 'matricula_validated') {
      if (licenses.length > 0) {
        return <div className="mt-1 space-y-0.5">{licenses.map((l) => <p key={l.id} className="text-[11px] text-slate-700">{l.issuing_entity} · matrícula {l.license_number}{l.specialty ? ` · ${l.specialty}` : ''} · <span className="font-bold uppercase">{l.validation_status}</span></p>)}</div>;
      }
      return (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input value={matriculaForm.issuing_entity} onChange={(e) => setMatriculaForm({ ...matriculaForm, issuing_entity: e.target.value })} placeholder="Entidad emisora" className="w-32 rounded border border-slate-200 px-2 py-1 text-[11px]" />
          <input value={matriculaForm.license_number} onChange={(e) => setMatriculaForm({ ...matriculaForm, license_number: e.target.value })} placeholder="N° de matrícula" className="w-28 rounded border border-slate-200 px-2 py-1 text-[11px]" />
          <button type="button" disabled={savingExtra} onClick={() => void saveMatricula()} className="rounded bg-slate-900 px-2 py-1 text-[11px] font-bold text-teal-300 disabled:opacity-50">{savingExtra ? 'Guardando…' : 'Cargar matrícula'}</button>
        </div>
      );
    }
    if (r.requirement_type === 'monotributo_approved' || r.requirement_type === 'identity_verified') {
      const docType = r.requirement_type === 'monotributo_approved' ? 'monotributo' : 'identity';
      const doc = docs.find((d) => d.document_type === docType);
      if (doc) return <button type="button" onClick={() => void openDocument(doc.storage_path)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline"><FileText className="w-3.5 h-3.5" />Ver PDF: {doc.label} · {doc.validation_status}</button>;
      return (
        <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-teal-700">
          <Upload className="w-3.5 h-3.5" />{uploadingDocType === docType ? 'Subiendo…' : 'Adjuntar PDF'}
          <input type="file" accept="application/pdf" className="hidden" disabled={uploadingDocType !== null} onChange={(e) => void uploadDocumentForTechnician(docType, e.target.files?.[0])} />
        </label>
      );
    }
    if (r.requirement_type === 'bank_account_valid') {
      if (account) return <p className="mt-1 text-[11px] text-slate-700"><Landmark className="mr-1 inline w-3.5 h-3.5 text-teal-600" />{account.account_holder} · {account.provider} · CBU/CVU {account.cbu_cvu}{account.alias ? ` · alias ${account.alias}` : ''} · <span className="font-bold uppercase">{account.validation_status}</span></p>;
      return (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
          <input value={accountForm.account_holder} onChange={(e) => setAccountForm({ ...accountForm, account_holder: e.target.value })} placeholder="Titular" className="rounded border border-slate-200 px-2 py-1 text-[11px]" />
          <input value={accountForm.cbu_cvu} onChange={(e) => setAccountForm({ ...accountForm, cbu_cvu: e.target.value.replace(/\D/g, '').slice(0, 22) })} placeholder="CBU/CVU (22 dígitos)" className="rounded border border-slate-200 px-2 py-1 text-[11px]" />
          <input value={accountForm.alias} onChange={(e) => setAccountForm({ ...accountForm, alias: e.target.value })} placeholder="Alias (opcional)" className="rounded border border-slate-200 px-2 py-1 text-[11px]" />
          <select value={accountForm.provider} onChange={(e) => setAccountForm({ ...accountForm, provider: e.target.value })} className="rounded border border-slate-200 px-2 py-1 text-[11px]">
            <option value="bank">Banco</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="other">Otra billetera</option>
          </select>
          <button type="button" disabled={savingExtra} onClick={() => void saveAccount()} className="rounded bg-slate-900 px-2 py-1 text-[11px] font-bold text-teal-300 disabled:opacity-50">{savingExtra ? 'Guardando…' : 'Cargar cuenta'}</button>
        </div>
      );
    }
    if (r.requirement_type === 'education_verified') {
      return <p className="mt-1 text-[11px] text-slate-700">{tech?.degree_title || tech?.education_level || 'Sin cargar'}{tech?.institution_name ? ` · ${tech.institution_name}` : ''}</p>;
    }
    return null;
  };

  if (loading || !tech) return <div className="p-5 text-sm text-slate-500">Cargando revisión…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Revisión de {tech.name}</h2>
          <p className="text-xs text-slate-500">{tech.specialty} · {reviewed}/{requirements.length} requisitos resueltos</p>
        </div>
        <button onClick={onClose} className="text-xs font-bold text-slate-500">Cerrar</button>
      </div>
      <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${requirements.length ? (reviewed / requirements.length) * 100 : 0}%` }} /></div>

      <section className="grid gap-2 rounded-xl border border-slate-200 p-3 text-xs sm:grid-cols-2">
        <p><b>Teléfono:</b> {tech.work_phone || tech.phone || 'Sin cargar'}</p>
        <p><b>Formación:</b> {tech.degree_title || tech.education_level || 'Sin cargar'}</p>
        <p className="sm:col-span-2"><b>Presentación:</b> {tech.bio || 'Sin cargar'}</p>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Requisitos</h3>
          <div className="flex items-center gap-2 text-[11px]">
            <button type="button" onClick={() => setSelectedReqIds(new Set(requirements.filter((r) => r.status === 'pending').map((r) => r.id)))} className="font-bold text-teal-700 underline">Seleccionar pendientes</button>
            {selectedReqIds.size > 0 && <button type="button" onClick={() => setSelectedReqIds(new Set())} className="font-bold text-slate-500 underline">Ninguno</button>}
          </div>
        </div>

        {requirements.length === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            Este técnico todavía no tiene un checklist de requisitos generado, así que no se lo puede aprobar. Corré de nuevo el backfill de <code>enable_technician_validation_workflow.sql</code> para generarlo.
          </p>
        )}

        {selectedReqIds.size > 0 && (
          <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/50 p-2">
            <p className="text-[11px] font-bold text-slate-600">{selectedReqIds.size} requisito{selectedReqIds.size === 1 ? '' : 's'} seleccionado{selectedReqIds.size === 1 ? '' : 's'}</p>
            <textarea value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Motivo (obligatorio solo para observar)" rows={2} className="w-full rounded border border-slate-200 p-2 text-xs" />
            <div className="flex gap-1.5">
              <button type="button" disabled={pending !== null} onClick={() => { playClickSound(); void bulkUpdateSelected('approved'); }} className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:cursor-wait disabled:opacity-50">
                {pending === 'bulk:approved' ? 'Guardando…' : 'Aprobar seleccionados'}
              </button>
              <button type="button" disabled={pending !== null} onClick={() => { playClickSound(); void bulkUpdateSelected('observed'); }} className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 disabled:cursor-wait disabled:opacity-50">
                {pending === 'bulk:observed' ? 'Guardando…' : 'Observar seleccionados'}
              </button>
            </div>
          </div>
        )}

        {requirements.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5" checked={selectedReqIds.has(r.id)} onChange={() => toggleReqSelection(r.id)} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <b className="text-xs">{labels[r.requirement_type]}</b>
                  <span className="text-[10px] font-bold uppercase">{r.status === 'not_required' ? 'No aplica' : r.status}</span>
                </div>
                {renderRequirementEvidence(r)}
                {!r.is_required && r.status !== 'not_required' && (
                  <button type="button" onClick={() => void markNotApplicable(r)} className="mt-1 text-[10px] font-bold text-slate-500 underline">Marcar como no aplica</button>
                )}
              </div>
            </label>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 p-3 text-xs">
        <h3 className="mb-2 text-sm font-bold">Documentos privados</h3>
        {docs.length ? docs.map((d) => <button key={d.id} onClick={() => void openDocument(d.storage_path)} className="block w-full rounded p-2 text-left hover:bg-slate-50"><FileText className="mr-1 inline w-4 text-teal-600" />{d.label} · {d.validation_status}</button>) : <p className="text-slate-500">No adjuntó documentos.</p>}
        <p className="mt-2"><Landmark className="mr-1 inline w-4 text-teal-600" />Cuenta: {account ? `${account.provider} · ****${account.cbu_cvu.slice(-4)} · ${account.validation_status}` : 'No cargada'}</p>
        <p className="mt-1">Matrículas: {licenses.length ? licenses.map((l) => `${l.issuing_entity} ${l.license_number} (${l.validation_status})`).join(', ') : 'No cargadas'}</p>
      </section>

      <section className="rounded-xl border border-slate-200 p-3">
        <label className="mb-2 block text-xs font-semibold text-slate-700">
          Motivo de la decisión (obligatorio para observar o suspender)
          <textarea value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} className="mt-1 w-full rounded border border-slate-200 p-2 text-xs" placeholder="Ej: falta la constancia de monotributo actualizada" rows={2} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { playClickSound(); void decide('approved'); }} disabled={pending !== null} className={`inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-wait ${!canApprove ? 'opacity-50' : 'disabled:opacity-50'}`}>
            <CheckCircle2 className="w-4" />{pending === 'decide:approved' ? 'Guardando…' : 'Aprobar técnico'}
          </button>
          <button onClick={() => { playClickSound(); void decide('observed'); }} disabled={pending !== null} className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:cursor-wait disabled:opacity-50">
            <CircleAlert className="w-4" />{pending === 'decide:observed' ? 'Guardando…' : 'Observar perfil'}
          </button>
          <button onClick={() => { playClickSound(); void decide('suspended'); }} disabled={pending !== null} className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 disabled:cursor-wait disabled:opacity-50">
            <ShieldAlert className="w-4" />{pending === 'decide:suspended' ? 'Guardando…' : 'Suspender'}
          </button>
        </div>
        {!canApprove && unresolvedRequired.length > 0 && (
          <p className="mt-2 text-[11px] font-bold text-amber-700">No se puede aprobar todavía — falta resolver: {unresolvedRequired.map((r) => labels[r.requirement_type]).join(', ')}.</p>
        )}
      </section>
    </div>
  );
}
