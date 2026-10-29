import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { detectPushSupport, disablePush, enablePush, getPermission, isSubscribed, type PushSupport } from '../../lib/push';

const BTN = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50';

/**
 * Activar/desactivar los avisos al celular (plan-notificaciones-push.md). En iPhone solo
 * funciona con la app instalada desde Safari: si no lo está, se explica cómo hacerlo.
 */
export const PushOptIn: React.FC = () => {
  const { showToast } = useApp();
  const [support] = useState<PushSupport>(() => detectPushSupport());
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState(getPermission());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setPermission(getPermission());
    setSubscribed(await isSubscribed());
  }, []);

  useEffect(() => {
    if (support === 'supported') void refresh();
  }, [support, refresh]);

  if (support === 'unsupported') return null;

  const run = async (action: () => Promise<void>, okMessage: string) => {
    setBusy(true);
    try {
      await action();
      showToast(okMessage, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo completar la operación.', 'error');
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2" aria-label="Avisos en el celular">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <Bell className="w-4 h-4 text-teal-600" /> Avisos en el celular
      </h3>

      {support === 'needs-install' && (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Para recibir avisos en tu iPhone, primero instalá la app: abrí <strong>tecniurbano.online</strong> en <strong>Safari</strong>, tocá{' '}
          <strong>Compartir</strong> y elegí <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong>. Después abrila desde el ícono y activá los avisos acá.
        </p>
      )}

      {support === 'supported' && permission === 'denied' && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Los avisos están bloqueados en este navegador. Para recibirlos, habilitá las notificaciones de TecniUrbano en los ajustes del teléfono.
        </p>
      )}

      {support === 'supported' && permission !== 'denied' && !subscribed && (
        <>
          <p className="text-xs text-slate-600 dark:text-slate-300">Te avisamos al celular cuando te asignan un trabajo, te escribe alguien o cambia el estado de un pedido.</p>
          <button type="button" disabled={busy} onClick={() => void run(enablePush, 'Avisos activados.')} className={`${BTN} bg-teal-600 text-white hover:bg-teal-700`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />} Activar avisos
          </button>
        </>
      )}

      {support === 'supported' && subscribed && (
        <>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">✅ Los avisos están activados en este dispositivo.</p>
          <button type="button" disabled={busy} onClick={() => void run(disablePush, 'Avisos desactivados.')} className={`${BTN} border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />} Desactivar avisos
          </button>
        </>
      )}
    </section>
  );
};
