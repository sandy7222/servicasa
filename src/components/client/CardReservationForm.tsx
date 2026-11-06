import React, { useEffect, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { formatArs } from '../../lib/pricing';
import { reserveWorkPayment, type CardFormData } from '../../lib/workPaymentClient';

/**
 * Formulario de tarjeta de Mercado Pago (Card Payment Brick) para RESERVAR el pago del trabajo en la cuenta
 * del técnico (plan-cobro-repartido.md, Fase 2). Los datos de la tarjeta se escriben dentro de los campos
 * seguros de Mercado Pago: nunca pasan por TecniUrbano, solo el token que devuelve el formulario.
 *
 * Solo tarjeta de CRÉDITO (la reserva con débito no está documentada) y en 1 pago (ofrecer cuotas obliga a
 * mostrar CFT/TEA, Res. E 51/2017).
 */

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const CONTAINER_ID = 'tu-card-reservation-brick';

type BrickController = { unmount: () => void };
type MercadoPagoCtor = new (publicKey: string, options?: { locale?: string }) => {
  bricks: () => { create: (kind: 'cardPayment', containerId: string, settings: unknown) => Promise<BrickController> };
};

declare global {
  interface Window {
    MercadoPago?: MercadoPagoCtor;
  }
}

let sdkPromise: Promise<MercadoPagoCtor> | null = null;

function loadSdk(): Promise<MercadoPagoCtor> {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => (window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error('sdk')));
    script.onerror = () => {
      sdkPromise = null;
      script.remove();
      reject(new Error('sdk'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

type Props = {
  orderId: string;
  quoteId: string;
  publicKey: string;
  amount: number;
  onReserved: () => void;
  onClose: () => void;
};

export const CardReservationForm: React.FC<Props> = ({ orderId, quoteId, publicKey, amount, onReserved, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<BrickController | null>(null);
  // Los callbacks del formulario se crean una sola vez: leen siempre la versión actual por referencia.
  const onReservedRef = useRef(onReserved);
  onReservedRef.current = onReserved;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadSdk()
      .then(async (MercadoPago) => {
        if (cancelled) return;
        const mp = new MercadoPago(publicKey, { locale: 'es-AR' });
        const controller = await mp.bricks().create('cardPayment', CONTAINER_ID, {
          initialization: { amount },
          customization: {
            paymentMethods: { types: { excluded: ['debit_card', 'prepaid_card'] }, minInstallments: 1, maxInstallments: 1 },
            visual: { texts: { formSubmit: 'Reservar pago' } },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setLoading(false);
            },
            onSubmit: async (formData: CardFormData) => {
              setError(null);
              try {
                await reserveWorkPayment(orderId, quoteId, formData);
                onReservedRef.current();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo procesar el pago.');
                // El formulario de Mercado Pago espera que la promesa se rechace para volver a habilitarse.
                throw err;
              }
            },
            onError: () => {
              if (!cancelled) setError('Hubo un problema con el formulario de pago. Cerralo y probá de nuevo.');
            },
          },
        });
        if (cancelled) controller.unmount();
        else controllerRef.current = controller;
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError('No se pudo cargar el formulario de pago de Mercado Pago. Revisá tu conexión y probá de nuevo.');
        }
      });

    return () => {
      cancelled = true;
      controllerRef.current?.unmount();
      controllerRef.current = null;
    };
  }, [orderId, quoteId, publicKey, amount]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="card-reservation-title">
      <div className="w-full sm:max-w-md max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="card-reservation-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Pagar el trabajo con tarjeta</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">Total: <strong>{formatArs(amount)}</strong></p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 p-3 text-xs text-teal-950 dark:text-teal-100 space-y-1">
          <p><strong>Tu tarjeta queda reservada, no se cobra todavía.</strong></p>
          <p>El monto se cobra cuando el técnico termina y vos das la conformidad del trabajo. Si el trabajo no se hace, la reserva se cancela y no pagás nada.</p>
          <p>Solo tarjeta de crédito, en un pago.</p>
        </div>

        {loading && <p className="text-xs text-slate-500 dark:text-slate-400">Cargando el formulario seguro de Mercado Pago…</p>}
        <div id={CONTAINER_ID} />
        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}

        <p className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <Lock className="w-3 h-3" />Los datos de tu tarjeta los procesa Mercado Pago. TecniUrbano no los ve ni los guarda.
        </p>
      </div>
    </div>
  );
};
