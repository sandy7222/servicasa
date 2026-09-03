import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, RotateCcw, Send, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatArs } from '../../lib/pricing';
import {
  answer,
  filterServicesForPrompt,
  optionLabel,
  pickCatalogItem,
  skipItemPick,
  startAssistant,
  submitPlaceholder,
  updateDraftDescription,
  updateDraftQuantity,
  visiblePrompt,
  type AssistantSession,
} from '../../lib/diagnosisAssistant';
import { saveAssistantDraft } from '../../lib/diagnosisDraft';
import type { CatalogSubcategory, ServiceItem } from '../../types';
import assistantPortrait from '../../assets/landing/asistente-avatar.png';

function slugMap(subcategories: readonly CatalogSubcategory[]) {
  return new Map(subcategories.map((sub) => [sub.id, sub.slug]));
}

export const DiagnosisAssistant: React.FC = () => {
  const { services, catalogSubcategories, currentUser, navigate, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<AssistantSession>(() => startAssistant());
  const [freeText, setFreeText] = useState('');
  const [photoName, setPhotoName] = useState<string | undefined>();
  const scroller = useRef<HTMLDivElement>(null);
  const prompt = visiblePrompt(session);

  const slugsById = useMemo(() => slugMap(catalogSubcategories), [catalogSubcategories]);

  const pickable = useMemo(() => {
    if (prompt.kind !== 'pick-items') return [];
    return filterServicesForPrompt(services, slugsById, prompt);
  }, [prompt, services, slugsById]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [session.messages.length, session.step, open]);

  useEffect(() => {
    if (!open || prompt.kind !== 'pick-items' || prompt.allowUnsure || pickable.length !== 1) return;
    setSession((current) => (current.step === 'pick-items' ? pickCatalogItem(current, pickable[0]) : current));
  }, [open, prompt, pickable]);

  const restart = () => {
    setSession(startAssistant());
    setFreeText('');
    setPhotoName(undefined);
  };

  const choose = (id: string, label: string) => setSession((current) => answer(current, id, label));

  const handoff = () => {
    const draft = session.draft;
    if (!draft) return;
    saveAssistantDraft(draft);
    setOpen(false);
    if (currentUser?.role === 'customer') {
      navigate('/customer');
      window.setTimeout(() => {
        document.getElementById('solicitar-servicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    } else {
      navigate('/auth');
    }
    showToast('Revisá el pedido armado y confirmalo cuando esté bien.', 'success', 'Asistente de diagnóstico');
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-3 pointer-events-none">
      {open && (
        <section
          className="pointer-events-auto w-[min(100vw-2rem,26rem)] max-h-[min(40rem,calc(100vh-6.5rem))] flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20"
          aria-label="Asistente de diagnóstico guiado"
        >
          <header className="flex items-center gap-2.5 px-3 py-2.5 bg-[#0F172A] text-white">
            <img src={assistantPortrait} alt="" className="w-9 h-9 rounded-full object-cover object-top bg-white dark:bg-slate-900" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight">Asistente de diagnóstico</p>
              <p className="text-[10px] text-slate-400">Preguntas con botones · Electricidad piloto</p>
            </div>
            <button type="button" onClick={restart} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Empezar de nuevo">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Cerrar asistente">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50 dark:bg-slate-950">
            {session.messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <img src={assistantPortrait} alt="" className="w-7 h-7 rounded-full object-cover object-top bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5" />
                )}
                <p
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                    message.role === 'assistant'
                      ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-md'
                      : 'bg-teal-600 text-white rounded-tr-md'
                  }`}
                >
                  {message.text}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
            {prompt.kind === 'buttons' && (
              <div className="grid gap-1.5">
                {prompt.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choose(option.id, optionLabel(prompt.options, option.id))}
                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-teal-400 hover:bg-teal-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {prompt.kind === 'placeholder' && (
              <div className="space-y-2">
                <textarea
                  value={freeText}
                  onChange={(event) => setFreeText(event.target.value)}
                  rows={3}
                  placeholder="Contanos qué ves o qué dejó de andar…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
                />
                <label className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-teal-600 bg-teal-50 dark:bg-teal-950/40 px-3 py-3 text-sm font-bold text-teal-800 cursor-pointer active:bg-teal-100 touch-manipulation">
                  <Camera className="w-6 h-6 shrink-0" />
                  <span className="truncate">{photoName ? photoName : 'Adjuntar foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setPhotoName(event.target.files?.[0]?.name)}
                  />
                </label>
                <button
                  type="button"
                  disabled={!freeText.trim()}
                  onClick={() => {
                    setSession((current) => submitPlaceholder(current, freeText, photoName));
                    setFreeText('');
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" /> Continuar
                </button>
              </div>
            )}

            {prompt.kind === 'pick-items' && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pickable.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSession((current) => pickCatalogItem(current, service))}
                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 hover:border-teal-400 hover:bg-teal-50"
                  >
                    <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">{service.name}</span>
                    <span className="block text-[11px] font-mono font-bold text-teal-800 mt-0.5">{formatArs(service.price)}</span>
                  </button>
                ))}
                {prompt.allowUnsure && (
                  <button
                    type="button"
                    onClick={() => setSession((current) => skipItemPick(current))}
                    className="w-full text-left rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Que lo vea el técnico / no estoy seguro
                  </button>
                )}
                {pickable.length === 0 && prompt.allowUnsure && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">No hay un ítem exacto para filtrar. Podés dejarlo en diagnóstico.</p>
                )}
              </div>
            )}

            {(prompt.kind === 'outage' || prompt.kind === 'safety-stop') && (
              <button type="button" onClick={restart} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white">
                Entendido
              </button>
            )}

            {prompt.kind === 'summary' && session.draft && (
              <SummaryPane
                session={session}
                services={services}
                onDescription={(value) => setSession((current) => updateDraftDescription(current, value))}
                onQuantity={(value) => setSession((current) => updateDraftQuantity(current, value))}
                onConfirm={() => handoff()}
              />
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-xl shadow-slate-900/25 ring-2 ring-teal-500/40 hover:ring-teal-500 transition-transform duration-200 motion-safe:hover:scale-[1.03] focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-400"
        aria-label={open ? 'Cerrar asistente de diagnóstico' : 'Abrir asistente de diagnóstico'}
        aria-expanded={open}
      >
        <img
          src={assistantPortrait}
          alt="Asistente de diagnóstico"
          className="w-full h-full object-cover bg-white dark:bg-slate-900"
          style={{ transform: 'scale(1.9)', transformOrigin: 'center 32%' }}
        />
      </button>
    </div>
  );
};

const SummaryPane: React.FC<{
  session: AssistantSession;
  services: ServiceItem[];
  onDescription: (value: string) => void;
  onQuantity: (value: number) => void;
  onConfirm: () => void;
}> = ({ session, services, onDescription, onQuantity, onConfirm }) => {
  const draft = session.draft!;
  const priced = draft.fixedPriceServiceId
    ? services.find((service) => service.id === draft.fixedPriceServiceId)
    : undefined;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{draft.title}</p>
      {priced && (
        <p className="text-xs font-black text-teal-800">
          {formatArs(priced.price * draft.quantity)}
          {draft.quantity > 1 ? ` · ${draft.quantity} u.` : ''}
        </p>
      )}
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Descripción (editable)
        <textarea
          value={draft.description}
          onChange={(event) => onDescription(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-800 dark:text-slate-200"
        />
      </label>
      {priced && (
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Cantidad
          <input
            type="number"
            min={1}
            max={20}
            value={draft.quantity}
            onChange={(event) => onQuantity(Number(event.target.value) || 1)}
            className="mt-1 block w-20 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-xs font-normal normal-case"
          />
        </label>
      )}
      <p className="text-[10px] text-slate-500 dark:text-slate-400">El asistente no envía el pedido: lo revisás y confirmás en el formulario.</p>
      <button type="button" onClick={onConfirm} className="w-full rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700">
        Revisar y pedir
      </button>
    </div>
  );
};
