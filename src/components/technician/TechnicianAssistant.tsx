import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { isOrderPaymentSettled } from '../../lib/workTimer';
import type { ServiceOrder } from '../../types';
import { getAyudanteEnabled } from '../../lib/ayudanteTecnico';

type Props = { order: ServiceOrder | undefined };

type Tip = {
  key: string;
  message: (order: ServiceOrder) => string;
  when: (order: ServiceOrder) => boolean;
};

// Ayudante en pantalla estilo "tutorial de videojuego": un personaje flotante
// que aparece con un globo de diálogo en los momentos clave del flujo de una
// orden, para que un técnico nuevo no se pierda en la lista de tareas. Cada
// tip tiene su propia condición sobre el estado real de la orden (las mismas
// banderas que ya usan los botones de acción de TechnicianView) y se marca
// como visto por técnico — una sola vez, para siempre, guardado en
// technicians.tutorial_tips_seen — para no volverse repetitivo.
const TIPS: Tip[] = [
  {
    key: 'new_order_assigned',
    when: (o) => o.status === 'assigned' && o.technicianResponseStatus === 'pending',
    message: () => 'Tenés una nueva orden asignada. Podés aceptarla o rechazarla con los botones de arriba.',
  },
  {
    key: 'accepted_ready_to_travel',
    when: (o) =>
      o.status === 'assigned' &&
      o.technicianResponseStatus === 'accepted' &&
      isOrderPaymentSettled(o) &&
      !o.travelStartedAt,
    message: () => '¡Buena decisión! Escribile al cliente para coordinar y avisá acá cuando salgas hacia el domicilio.',
  },
  {
    key: 'traveling',
    when: (o) =>
      o.status === 'assigned' &&
      o.technicianResponseStatus === 'accepted' &&
      isOrderPaymentSettled(o) &&
      !!o.travelStartedAt &&
      !o.arrivedAt,
    message: () => 'Estás en camino. Si hace falta, escribile al cliente y usá "Abrir navegación al domicilio" para guiarte.',
  },
  {
    key: 'arrived_needs_quote',
    when: (o) => {
      if (o.workMode !== 'diagnosis' || !o.arrivedAt) return false;
      const quote = o.quotes?.[0];
      return !quote || (quote.status === 'draft' && quote.items.length === 0);
    },
    message: () => 'Llegaste al domicilio. Ahora armá el diagnóstico: elegí los servicios del catálogo para generar el presupuesto.',
  },
  {
    key: 'quote_sent',
    when: (o) => o.quotes?.[0]?.status === 'sent',
    message: () => 'Ya enviaste el presupuesto. Esperá a que el cliente lo acepte y confirme el pago — esta pantalla se actualiza sola.',
  },
  {
    key: 'work_started',
    when: (o) => o.status === 'in_progress' && o.checklist.length === 0,
    message: (o) =>
      o.workMode === 'diagnosis'
        ? 'El cliente aceptó y pagó el presupuesto. Manos a la obra: cargá cada tarea en el Checklist a medida que la completás.'
        : 'Ya podés empezar a trabajar. Cargá cada tarea en el Checklist a medida que la completás.',
  },
  {
    key: 'checklist_complete_ready_to_close',
    when: (o) =>
      o.status === 'in_progress' &&
      o.checklist.length > 0 &&
      o.checklist.every((item) => item.completed) &&
      !o.customerSignature,
    message: () => '¡Buen trabajo! Mostrale el resultado al cliente y pedile que firme la conformidad. Después ya podés retirarte del domicilio.',
  },
];

const AUTO_HIDE_MS = 9000;
const EXIT_ANIMATION_MS = 220;
// Ignoramos gestos de descarte durante este ratito inicial: si no hiciéramos
// esto, el mismo movimiento de mouse/scroll que disparó el cambio de estado
// (por ejemplo, tocar "Aceptar visita") cerraría el tip apenas aparece, sin
// que el técnico llegue a leerlo.
const DISMISS_GRACE_MS = 1200;

export const TechnicianAssistant: React.FC<Props> = ({ order }) => {
  const { currentUser, technicians } = useApp();
  const technician = useMemo(
    () => technicians.find((t) => t.id === currentUser?.technicianId),
    [technicians, currentUser?.technicianId]
  );

  // Además de lo ya persistido en la base, llevamos un set local para que un
  // tip recién descartado no vuelva a aparecer en lo que tarda en confirmarse
  // el update contra Supabase (o si esa llamada llegara a fallar).
  const [dismissedLocally, setDismissedLocally] = useState<Set<string>>(() => new Set());
  const [activeTip, setActiveTip] = useState<Tip | null>(null);
  const [phase, setPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');

  const seenKeys = useMemo(() => {
    const fromDb = technician?.tutorialTipsSeen ?? [];
    return new Set([...fromDb, ...dismissedLocally]);
  }, [technician?.tutorialTipsSeen, dismissedLocally]);

  const matchingTip = useMemo(() => {
    if (!order) return null;
    return TIPS.find((tip) => !seenKeys.has(tip.key) && tip.when(order)) ?? null;
  }, [order, seenKeys]);

  useEffect(() => {
    if (matchingTip && matchingTip.key !== activeTip?.key) {
      setActiveTip(matchingTip);
      setPhase('entering');
      const raf = requestAnimationFrame(() => setPhase('visible'));
      return () => cancelAnimationFrame(raf);
    }
    if (!matchingTip && activeTip) {
      setPhase('leaving');
      const t = window.setTimeout(() => setActiveTip(null), EXIT_ANIMATION_MS);
      return () => window.clearTimeout(t);
    }
  }, [matchingTip, activeTip]);

  const dismiss = useCallback(() => {
    if (!activeTip) return;
    const key = activeTip.key;
    setDismissedLocally((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    setPhase('leaving');
    window.setTimeout(() => setActiveTip((current) => (current?.key === key ? null : current)), EXIT_ANIMATION_MS);

    if (technician) {
      const next = Array.from(new Set([...(technician.tutorialTipsSeen ?? []), key]));
      void supabase.from('technicians').update({ tutorial_tips_seen: next }).eq('id', technician.id);
    }
  }, [activeTip, technician]);

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  // Se retira solo a los pocos segundos.
  useEffect(() => {
    if (!activeTip || phase !== 'visible') return;
    const t = window.setTimeout(() => dismissRef.current(), AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [activeTip, phase]);

  // O se retira antes si el técnico interactúa con la pantalla (mueve el
  // mouse, desliza/scrollea, toca la pantalla) — para no quedar en el medio
  // mientras está trabajando.
  useEffect(() => {
    if (!activeTip || phase !== 'visible') return;
    const shownAt = Date.now();
    const handleInteraction = () => {
      if (Date.now() - shownAt < DISMISS_GRACE_MS) return;
      dismissRef.current();
    };
    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('touchmove', handleInteraction);
    window.addEventListener('wheel', handleInteraction, { passive: true });
    window.addEventListener('scroll', handleInteraction, true);
    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchmove', handleInteraction);
      window.removeEventListener('wheel', handleInteraction);
      window.removeEventListener('scroll', handleInteraction, true);
    };
  }, [activeTip, phase]);

  if (!getAyudanteEnabled() || !activeTip || !order) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-1.5 pointer-events-none">
      <div
        className="relative pointer-events-auto max-w-[16rem] sm:max-w-xs rounded-2xl rounded-bl-sm border-2 border-slate-900 bg-white p-3 pr-7 text-[12px] font-semibold leading-snug text-slate-900 shadow-lg transition-all duration-200 ease-out"
        style={{
          opacity: phase === 'visible' ? 1 : 0,
          transform: phase === 'visible' ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.94)',
        }}
        role="status"
      >
        {activeTip.message(order)}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar sugerencia"
          className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <img
        src="/mascot/tecni-tecnico.png"
        alt=""
        className="h-20 w-auto shrink-0 drop-shadow-md transition-all duration-200 ease-out sm:h-24"
        style={{
          opacity: phase === 'visible' ? 1 : 0,
          transform: phase === 'visible' ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.85)',
        }}
      />
    </div>
  );
};
