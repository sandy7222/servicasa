import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, HelpCircle, MessageCircle, Send, Wrench, X } from 'lucide-react';
import { FAQ_ITEMS, formatPrice } from '../../lib/helpFaq';
import { WHATSAPP_NUMBER, whatsappUrl } from '../../lib/appLinks';
import assistantBody from '../../assets/landing/asistente-cuerpo.png';

export type HelpMode = 'home' | 'faq' | 'ai';

type Props = {
  mode: HelpMode;
  onModeChange: (mode: HelpMode) => void;
  onStartOrder: () => void;
  onClose: () => void;
  visitPrice: number;
};

type ChatLine = { role: 'user' | 'assistant'; content: string; kind?: string };

const faceClass = 'object-cover object-[54%_16%] bg-white';
const optionClass =
  'w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition';

const UNAVAILABLE = 'Ahora mismo no puedo responder. Escribinos por WhatsApp y te contestamos a la brevedad.';

function WhatsAppButton({ number }: { number?: string | null }) {
  const url = whatsappUrl(number ?? WHATSAPP_NUMBER);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
    >
      <MessageCircle className="w-3.5 h-3.5" /> Escribinos por WhatsApp
    </a>
  );
}

function Bubble({ line }: { line: ChatLine }) {
  const mine = line.role === 'user';
  return (
    <div className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && <img src={assistantBody} alt="" className={`w-7 h-7 rounded-full ${faceClass} border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5`} />}
      <p
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
          mine
            ? 'bg-teal-600 text-white rounded-tr-md'
            : line.kind === 'safety'
              ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 rounded-tl-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-md'
        }`}
      >
        {line.content}
      </p>
    </div>
  );
}

function Faq({ visitPrice, onStartOrder }: Pick<Props, 'visitPrice' | 'onStartOrder'>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const item = FAQ_ITEMS.find((i) => i.id === openId);
  if (item) {
    return (
      <div className="space-y-2">
        <Bubble line={{ role: 'user', content: item.question }} />
        <Bubble line={{ role: 'assistant', content: item.answer(formatPrice(visitPrice)) }} />
        <div className="flex flex-wrap gap-2 pt-1">
          {item.cta === 'order' && (
            <button type="button" onClick={onStartOrder} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700">
              <Wrench className="w-3.5 h-3.5" /> Armar mi pedido
            </button>
          )}
          <button type="button" onClick={() => setOpenId(null)} className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            Otra pregunta
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Bubble line={{ role: 'assistant', content: '¿Sobre qué querés saber? Elegí una pregunta:' }} />
      <div className="grid gap-1.5">
        {FAQ_ITEMS.map((i) => (
          <button key={i.id} type="button" onClick={() => setOpenId(i.id)} className={`${optionClass} text-xs font-semibold text-slate-800 dark:text-slate-200`}>
            {i.question}
          </button>
        ))}
      </div>
    </div>
  );
}

function AiChat({ onStartOrder }: Pick<Props, 'onStartOrder'>) {
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: 'assistant',
      content:
        'Hola, soy el asistente virtual de TecniUrbano (una IA). Te oriento sobre cómo usar el servicio: pedir una visita, seguir su estado, escribirle al técnico, reclamos y más. No resuelvo problemas técnicos: para eso están nuestros técnicos. Por favor no escribas datos personales ni de tarjeta.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [showHandoff, setShowHandoff] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [lines.length, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatLine[] = [...lines, { role: 'user', content: text }];
    setLines(next);
    setInput('');
    setLoading(true);
    try {
      const history = next.slice(1).map(({ role, content }) => ({ role, content }));
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await response.json().catch(() => ({}))) as { kind?: string; reply?: string; whatsapp?: string | null; error?: string };
      if (!response.ok || !data.reply) throw new Error(data.error || 'sin respuesta');
      setWhatsapp(data.whatsapp ?? null);
      setShowHandoff(data.kind === 'handoff' || data.kind === 'limit' || data.kind === 'unavailable');
      setLines((current) => [...current, { role: 'assistant', content: data.reply as string, kind: data.kind }]);
    } catch {
      setShowHandoff(true);
      setLines((current) => [...current, { role: 'assistant', content: UNAVAILABLE, kind: 'unavailable' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          <Bubble line={line} />
        </React.Fragment>
      ))}
      {loading && <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-9">Escribiendo…</p>}
      {showHandoff && (
        <div className="flex flex-wrap gap-2 pl-9">
          <WhatsAppButton number={whatsapp} />
        </div>
      )}
      <div className="pl-9">
        <button type="button" onClick={onStartOrder} className="inline-flex items-center gap-1.5 rounded-xl border border-teal-600 px-3 py-1.5 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30">
          <Wrench className="w-3 h-3" /> Armar mi pedido
        </button>
      </div>
      <div ref={end} />
      <form
        className="sticky bottom-0 -mx-3 -mb-3 mt-1 flex items-end gap-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value.slice(0, 500))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Escribí tu consulta…"
          aria-label="Tu consulta"
          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
        />
        <button type="submit" disabled={!input.trim() || loading} aria-label="Enviar" className="rounded-xl bg-teal-600 p-2.5 text-white disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

/**
 * Panel de ayuda: menú con las tres opciones (Armar mi pedido / Preguntas frecuentes /
 * Escribir una consulta). "Armar mi pedido" es el asistente de diagnóstico de siempre,
 * que NO se toca: este panel solo lo lanza. Ver plan-avisos-telegram-y-chat.md, Fase B.
 */
export const HelpHub: React.FC<Props> = ({ mode, onModeChange, onStartOrder, onClose, visitPrice }) => {
  const title = mode === 'faq' ? 'Preguntas frecuentes' : mode === 'ai' ? 'Consultas (asistente virtual)' : 'Ayuda de TecniUrbano';
  return (
    <section
      className="pointer-events-auto w-[min(100vw-2rem,26rem)] max-h-[min(40rem,calc(100vh-6.5rem))] flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20"
      aria-label="Ayuda de TecniUrbano"
    >
      <header className="flex items-center gap-2.5 px-3 py-2.5 bg-[#0F172A] text-white">
        {mode !== 'home' ? (
          <button type="button" onClick={() => onModeChange('home')} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Volver al menú">
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <img src={assistantBody} alt="" className={`w-9 h-9 rounded-full ${faceClass}`} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight">{title}</p>
          <p className="text-[10px] text-slate-400">{mode === 'ai' ? 'IA · orienta sobre el uso de la app' : 'Te ayudamos a usar la app'}</p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Cerrar ayuda">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50 dark:bg-slate-950">
        {mode === 'home' && (
          <div className="space-y-2">
            <Bubble line={{ role: 'assistant', content: '¡Hola! ¿En qué te puedo ayudar?' }} />
            <div className="grid gap-1.5">
              <button type="button" onClick={onStartOrder} className={optionClass}>
                <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100"><Wrench className="w-4 h-4 text-teal-700" />Armar mi pedido</span>
                <span className="block mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Te guío paso a paso para pedir tu Visita de Presupuesto.</span>
              </button>
              <button type="button" onClick={() => onModeChange('faq')} className={optionClass}>
                <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100"><HelpCircle className="w-4 h-4 text-teal-700" />Preguntas frecuentes</span>
                <span className="block mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Cómo funciona la visita, el pago, el seguimiento y los reclamos.</span>
              </button>
              <button type="button" onClick={() => onModeChange('ai')} className={optionClass}>
                <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100"><MessageCircle className="w-4 h-4 text-teal-700" />Escribir una consulta</span>
                <span className="block mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Un asistente virtual (IA) te orienta sobre el uso de la app.</span>
              </button>
            </div>
            <div className="pt-1"><WhatsAppButton /></div>
          </div>
        )}
        {mode === 'faq' && <Faq visitPrice={visitPrice} onStartOrder={onStartOrder} />}
        {mode === 'ai' && <AiChat onStartOrder={onStartOrder} />}
      </div>
    </section>
  );
};
