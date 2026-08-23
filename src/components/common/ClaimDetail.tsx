import { useEffect, useState } from 'react';
import { ArrowLeft, Lock, Pause, Send, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  addCaseMessage,
  closeCase,
  fetchClaim,
  pauseCaseSettlement,
  releaseCaseSettlement,
  resolveCase,
  suggestedSettlementAction,
  updateCaseStatus,
} from '../../lib/supportCases';
import type { ClaimCase, ClaimResolutionType, ClaimStatus } from '../../types';
import {
  ClaimPriorityBadge,
  ClaimStatusBadge,
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  RESOLUTION_TYPE_LABELS,
  formatDateTime,
  money,
} from '../admin/claimShared';

/**
 * Un único detalle de caso, reutilizado por admin, cliente y técnico — cada
 * uno ve exactamente lo que RLS le deja leer (support_case_messages.is_internal
 * ya filtra las notas internas del lado del servidor). Solo `canManage`
 * (admin) ve los controles de estado/resolución/liquidación.
 */
export function ClaimDetail({ claimId, onBack }: { claimId: string; onBack: () => void }) {
  const { currentUser, showToast } = useApp();
  const [claim, setClaim] = useState<ClaimCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [resolutionType, setResolutionType] = useState<ClaimResolutionType>('no_action');
  const [resolutionAmount, setResolutionAmount] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const senderType = isAdmin ? 'admin' : currentUser?.role === 'technician' ? 'technician' : 'client';

  const load = async () => {
    setLoading(true);
    try {
      setClaim(await fetchClaim(claimId));
    } catch {
      showToast('No se pudo cargar el caso.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const actor = { name: currentUser?.name ?? 'Usuario', profileId: currentUser?.id };

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      await addCaseMessage(
        claimId,
        { senderType, channel: 'in_app', message: messageText.trim(), isInternal: isAdmin && isInternal },
        actor
      );
      setMessageText('');
      setIsInternal(false);
      await load();
    } catch {
      showToast('No se pudo enviar el mensaje.', 'error');
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: ClaimStatus) => {
    try {
      await updateCaseStatus(claimId, status, actor);
      await load();
    } catch {
      showToast('No se pudo cambiar el estado.', 'error');
    }
  };

  const submitResolution = async () => {
    setResolving(true);
    try {
      await resolveCase(
        claimId,
        {
          resolutionType,
          resolutionAmount: resolutionAmount ? Number(resolutionAmount) : undefined,
          resolutionNotes: resolutionNotes.trim() || undefined,
        },
        suggestedSettlementAction(resolutionType),
        actor
      );
      showToast('Caso resuelto.', 'success', 'Reclamos');
      await load();
    } catch {
      showToast('No se pudo resolver el caso.', 'error');
    } finally {
      setResolving(false);
    }
  };

  const togglePause = async () => {
    if (!claim?.orderId) return;
    try {
      if (claim.settlementPaused) {
        await releaseCaseSettlement(claimId, claim.orderId, actor);
      } else {
        await pauseCaseSettlement(claimId, claim.orderId, `Pausada manualmente desde el caso ${claim.caseNumber}`, actor);
      }
      await load();
    } catch {
      showToast('No se pudo actualizar la liquidación.', 'error');
    }
  };

  if (loading) {
    return <main className="max-w-4xl mx-auto px-4 py-10 text-center text-slate-500">Cargando caso…</main>;
  }
  if (!claim) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-slate-500">No encontramos ese caso, o no tenés acceso a él.</p>
        <button onClick={onBack} className="mt-3 text-teal-700 font-bold hover:underline">← Volver</button>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:underline">
        <ArrowLeft className="w-4 h-4" />Volver
      </button>

      <section className="rounded-2xl bg-[#0f1b35] text-white p-5 sm:p-6">
        <div className="flex items-center gap-2 text-teal-300 mb-1">
          <ShieldAlert className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-wider">{claim.caseNumber}</span>
        </div>
        <h1 className="text-xl font-black">{claim.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <ClaimStatusBadge status={claim.status} />
          <ClaimPriorityBadge priority={claim.priority} />
          <span className="text-[11px] font-bold text-slate-300 border border-slate-700 rounded px-2 py-0.5">{CLAIM_TYPE_LABELS[claim.type]}</span>
          {claim.settlementPaused && (
            <span className="text-[11px] font-bold text-rose-300 border border-rose-700 rounded px-2 py-0.5">⏸ Liquidación pausada</span>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs text-slate-300">
          <div><span className="text-slate-500 block">Cliente</span>{claim.customerName || '—'}</div>
          <div><span className="text-slate-500 block">Técnico</span>{claim.technicianName || '—'}</div>
          <div><span className="text-slate-500 block">Abierto</span>{formatDateTime(claim.openedAt)}</div>
        </div>
        {claim.description && <p className="text-sm text-slate-300 mt-3 border-t border-slate-800 pt-3">{claim.description}</p>}
      </section>

      {isAdmin && (
        <section className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Gestión (solo administración)</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-700">Estado
              <select value={claim.status} onChange={(e) => void changeStatus(e.target.value as ClaimStatus)} className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                {(Object.keys(CLAIM_STATUS_LABELS) as ClaimStatus[]).map((s) => <option key={s} value={s}>{CLAIM_STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            {claim.orderId && (
              <button onClick={() => void togglePause()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 px-3 py-1.5 text-xs font-bold">
                <Pause className="w-3.5 h-3.5" />{claim.settlementPaused ? 'Liberar liquidación' : 'Pausar liquidación'}
              </button>
            )}
            {claim.status !== 'closed' && (
              <button onClick={() => { void closeCase(claimId, actor).then(load); }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-bold">
                <X className="w-3.5 h-3.5" />Cerrar caso
              </button>
            )}
          </div>

          {claim.status !== 'resolved' && claim.status !== 'closed' && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-xs font-bold text-slate-700">Resolver caso</p>
              <div className="grid sm:grid-cols-3 gap-2">
                <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value as ClaimResolutionType)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
                  {(Object.keys(RESOLUTION_TYPE_LABELS) as ClaimResolutionType[]).map((t) => <option key={t} value={t}>{RESOLUTION_TYPE_LABELS[t]}</option>)}
                </select>
                <input value={resolutionAmount} onChange={(e) => setResolutionAmount(e.target.value)} type="number" placeholder="Monto (opcional)" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <button onClick={() => void submitResolution()} disabled={resolving} className="rounded-lg bg-[#003875] hover:bg-[#00265a] disabled:opacity-50 text-white px-3 py-2 text-xs font-bold">
                  {resolving ? 'Resolviendo…' : 'Confirmar resolución'}
                </button>
              </div>
              <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={2} placeholder="Notas de la resolución (el cliente y el técnico pueden verlas)…" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" />
              <p className="text-[11px] text-slate-400">Acción sobre la liquidación sugerida: <strong>{suggestedSettlementAction(resolutionType) === 'release' ? 'liberar' : suggestedSettlementAction(resolutionType) === 'cancel' ? 'cancelar' : 'retener para revisión'}</strong>.</p>
            </div>
          )}
          {claim.resolutionType && (
            <div className="border-t border-slate-100 pt-3 text-xs text-slate-600">
              <p><strong>Resolución:</strong> {RESOLUTION_TYPE_LABELS[claim.resolutionType]}{claim.resolutionAmount ? ` — ${money.format(claim.resolutionAmount)}` : ''}</p>
              {claim.resolutionNotes && <p className="mt-1">{claim.resolutionNotes}</p>}
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Comunicación</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {claim.messages.length === 0 && <p className="text-sm text-slate-400">Todavía no hay mensajes.</p>}
          {claim.messages.map((m) => (
            <div key={m.id} className={`rounded-lg p-3 text-sm ${m.isInternal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mb-1">
                {m.isInternal && <Lock className="w-3 h-3 text-amber-600" />}
                <span>{m.senderType === 'admin' ? 'Administración' : m.senderType === 'client' ? 'Cliente' : m.senderType === 'technician' ? 'Técnico' : 'Sistema'}</span>
                {m.isInternal && <span className="text-amber-700">· Nota interna</span>}
                <span>· {formatDateTime(m.createdAt)}</span>
              </div>
              <p className="text-slate-800 whitespace-pre-wrap">{m.message}</p>
            </div>
          ))}
        </div>
        {claim.status !== 'closed' && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={2} placeholder="Escribir un mensaje…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex items-center justify-between">
              {isAdmin ? (
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                  Nota interna (no la ve el cliente ni el técnico)
                </label>
              ) : <span />}
              <button onClick={() => void sendMessage()} disabled={sending || !messageText.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-teal-300 px-4 py-2 text-xs font-bold">
                <Send className="w-3.5 h-3.5" />Enviar
              </button>
            </div>
          </div>
        )}
      </section>

      {claim.history.length > 0 && (
        <section className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Historial</h2>
          <ol className="space-y-1.5 text-xs text-slate-600">
            {claim.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-2 border-b border-slate-50 pb-1.5 last:border-0">
                <span>{h.notes || h.changeType}{h.newValue ? ` → ${h.newValue}` : ''}</span>
                <span className="text-slate-400 shrink-0">{formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
