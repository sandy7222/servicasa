import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

type GuestOrderStatus = {
  title: string;
  paymentStatus: string;
  paid: boolean;
  failed: boolean;
  inviteUrl: string | null;
};

const POLL_MS = 4000;
const MAX_POLLS = 45; // ~3 minutes

/**
 * Mercado Pago always redirects back here (success/failure/pending share the
 * same statusUrl), but stamps the outcome as query params. When the checkout
 * was abandoned or errored out before a real payment attempt existed —
 * "volver a la tienda" from an MP error screen, for example — it comes back
 * with payment_id and status both literally "null": there is no payment for
 * our webhook to ever receive, so polling would just spin for 3 minutes
 * before giving up. Detecting that case up front lets us tell the guest
 * immediately instead of making them wait it out.
 */
function readMpAbortedFromUrl(): boolean {
  const hash = window.location.hash || '';
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return false;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  const paymentId = params.get('payment_id');
  const status = params.get('status');
  const hasNoPaymentId = !paymentId || paymentId === 'null';
  const hasNoRealStatus = !status || status === 'null' || status === 'rejected' || status === 'cancelled';
  return hasNoPaymentId && hasNoRealStatus;
}

/** Public, unauthenticated: where a guest lands after paying (or bailing) on
 * Mercado Pago. Polls api/orders/guest-status.ts — the token is opaque and
 * only valid for this one order, so no login is needed to check it. */
export const GuestOrderStatusView: React.FC<{ token: string }> = ({ token }) => {
  const [status, setStatus] = useState<GuestOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [mpAborted] = useState(readMpAbortedFromUrl);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let count = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/orders/guest-status?token=${encodeURIComponent(token)}`);
        const body = (await response.json().catch(() => ({}))) as GuestOrderStatus & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error || 'No pudimos encontrar tu solicitud.');
          if (timer) window.clearInterval(timer);
          return;
        }
        setStatus(body);
        if ((body.paid || body.failed) && timer) {
          window.clearInterval(timer);
          return;
        }
        count += 1;
        setPollCount(count);
        if (count >= MAX_POLLS && timer) {
          window.clearInterval(timer);
        }
      } catch {
        if (!cancelled) setError('No pudimos conectarnos para revisar el estado de tu pago.');
      }
    };

    void poll();
    timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [token]);

  const stillPolling = pollCount < MAX_POLLS;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4" id="tecniurbano-guest-order-status">
      <div className="max-w-md w-full mx-auto bg-white rounded-xl p-6 shadow-md border border-slate-200 text-center space-y-4">
        {error ? (
          <>
            <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-slate-900">{error}</p>
            <p className="text-xs text-slate-500">
              Si ya pagaste, contactanos con tu email y te ayudamos a confirmarlo manualmente.
            </p>
          </>
        ) : !status ? (
          <>
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-600">Buscando tu solicitud…</p>
          </>
        ) : status.failed || (mpAborted && !status.paid) ? (
          <>
            <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-slate-900">El pago no se pudo completar</p>
            <p className="text-xs text-slate-500">
              No se generó ninguna solicitud ni se realizó ningún cargo. Volvé a intentarlo desde el catálogo cuando
              quieras.
            </p>
          </>
        ) : status.paid ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
            <p className="text-sm font-bold text-slate-900">¡Pago confirmado!</p>
            <p className="text-xs text-slate-500">
              Tu solicitud <strong>"{status.title}"</strong> ya está en marcha. Creá tu contraseña para
              hacer seguimiento del pedido:
            </p>
            {status.inviteUrl ? (
              <a
                href={status.inviteUrl}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-sm px-5 py-2.5 shadow-sm"
              >
                Crear mi contraseña
              </a>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Estamos preparando tu enlace de acceso — recargá esta página en unos segundos.
              </p>
            )}
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-900">Esperando la confirmación del pago…</p>
            <p className="text-xs text-slate-500">
              Esto puede tardar unos segundos después de pagar en Mercado Pago. No cierres esta página.
            </p>
            {!stillPolling && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Está tardando más de lo normal. Si ya pagaste, recargá esta página; si no, contactanos.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
