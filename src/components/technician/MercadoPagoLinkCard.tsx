import React, { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Link2, Unlink, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MP_COLLECTION_AUTH_TEXT } from '../../lib/legalTerms';
import { recordMpCollectionAuthorization } from '../../lib/legalAcceptance';
import { fetchMyMpStatus, isExpiringSoon, startMpLink, unlinkMp, type MpLinkStatus } from '../../lib/mpLinkClient';

type Notice = { kind: 'ok' | 'error'; text: string };

function mpResultFromPath(path: string): 'ok' | 'error' | null {
  const query = path.split('?')[1];
  if (!query) return null;
  const value = new URLSearchParams(query).get('mp');
  return value === 'ok' || value === 'error' ? value : null;
}

/** Tarjeta "Cobros con Mercado Pago" del perfil del técnico (plan-cobro-repartido.md, Fase 1.6). No mueve dinero. */
export const MercadoPagoLinkCard: React.FC = () => {
  const { currentUser, currentPath, showToast } = useApp();
  const [status, setStatus] = useState<MpLinkStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const handledResult = useRef(false);

  const load = async () => {
    try {
      setStatus(await fetchMyMpStatus());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  };

  useEffect(() => { void load(); }, []);

  // Vuelta del OAuth: #/technician/profile?mp=ok|error. Se muestra el aviso una sola vez y se limpia la URL.
  useEffect(() => {
    const result = mpResultFromPath(currentPath);
    if (!result || handledResult.current) return;
    handledResult.current = true;
    setNotice(
      result === 'ok'
        ? { kind: 'ok', text: 'Listo: tu cuenta de Mercado Pago quedó vinculada.' }
        : { kind: 'error', text: 'No se pudo vincular tu cuenta de Mercado Pago. Podés intentarlo de nuevo.' }
    );
    if (result === 'ok') void load();
    try { window.history.replaceState(null, '', '#/technician/profile'); } catch { /* sin historial */ }
  }, [currentPath]);

  const link = async () => {
    if (!accepted || !currentUser || busy) return;
    setBusy(true);
    try {
      await recordMpCollectionAuthorization({ userId: currentUser.id });
      const url = await startMpLink();
      window.location.assign(url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo iniciar la vinculación.', 'error');
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unlinkMp();
      setAccepted(false);
      setNotice(null);
      await load();
      showToast('Mercado Pago desvinculado.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo desvincular.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const linked = Boolean(status?.linked);
  const expiring = linked && isExpiringSoon(status?.expiresAt ?? null);

  return <section aria-label="Cobros con Mercado Pago" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2"><Wallet className="w-4 text-teal-600" /><div><h2 className="font-bold text-sm">Cobros con Mercado Pago</h2><p className="text-[11px] text-slate-500 dark:text-slate-400">Vinculá tu cuenta para cobrar tus trabajos directamente en ella.</p></div></div>
      {status && <span data-testid="mp-status" className={`shrink-0 text-[11px] font-bold rounded-full px-2 py-1 ${linked ? (expiring ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700' : 'bg-emerald-50 text-emerald-700') : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{linked ? (expiring ? 'Vence pronto' : 'Vinculada') : 'No vinculada'}</span>}
    </div>

    {notice && <p role="status" className={`rounded-lg border p-3 text-xs ${notice.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800'}`}>{notice.kind === 'ok' ? <CircleCheck className="inline w-4 mr-1" /> : <CircleAlert className="inline w-4 mr-1" />}{notice.text}</p>}
    {loadFailed && <p className="text-xs text-amber-700">No pudimos consultar el estado de tu vinculación. Recargá la página para reintentar.</p>}

    {status && linked && <>
      <p className="text-xs text-slate-600 dark:text-slate-300">Tu cuenta de Mercado Pago está vinculada{status.mpUserId ? ` (usuario ${status.mpUserId})` : ''}.</p>
      {expiring && <p className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800">La vinculación vence pronto. Se renueva sola; si no se puede, te avisamos para que la vincules de nuevo.</p>}
      <button type="button" onClick={() => void unlink()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-60"><Unlink className="w-3.5" />Desvincular</button>
    </>}

    {status && !linked && <>
      <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5" />
        <span>{MP_COLLECTION_AUTH_TEXT}</span>
      </label>
      <button type="button" onClick={() => void link()} disabled={!accepted || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Link2 className="w-3.5" />Vincular mi Mercado Pago</button>
    </>}
  </section>;
};
