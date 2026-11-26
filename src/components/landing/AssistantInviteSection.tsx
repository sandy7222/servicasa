import React from 'react';
import { Mascot } from '../brand/MascotEmptyState';
import { OPEN_DIAGNOSIS_ASSISTANT_EVENT } from '../common/DiagnosisAssistant';

/** Invitación a usar el asistente guiado, con el muñequito propio de TecniUrbano. */
export const AssistantInviteSection: React.FC = () => {
  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent(OPEN_DIAGNOSIS_ASSISTANT_EVENT, { detail: { reset: true } }));
  };

  return (
    <section className="bg-white dark:bg-slate-900 pb-14 sm:pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-end gap-3 sm:gap-6">
          <Mascot className="h-32 sm:h-44 shrink-0" />
          <div className="relative flex-1 mb-4 rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 p-4 sm:p-6">
            {/* Puntita del globo de diálogo, apuntando al muñequito */}
            <span
              aria-hidden="true"
              className="absolute -left-[7px] bottom-8 h-3.5 w-3.5 rotate-45 border-b border-l border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-slate-900"
            />
            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              ¿No sabés qué técnico necesitás?
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
              Contame qué pasó en tu casa y te ayudo a armar el pedido.
            </p>
            <button
              type="button"
              onClick={openAssistant}
              className="mt-3 inline-flex items-center rounded-lg bg-teal-400 hover:bg-teal-300 px-5 py-2.5 text-sm font-bold text-[#0B1B33] transition-colors"
            >
              Contame qué pasó
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
