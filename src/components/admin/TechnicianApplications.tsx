import React from 'react';
import { ClipboardList, Mail, Phone, Wrench } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const statusCopy: Record<string, string> = {
  pending: 'Sin procesar (solicitud previa al alta automática)',
  approved: 'Cuenta creada',
  rejected: 'Rechazada',
};

/** Bitácora de solo lectura: "Ser técnico" ahora crea la cuenta y la ficha
 * del técnico automáticamente al enviar el formulario (self_register_technician),
 * así que no hay nada que aprobar o rechazar acá — la aprobación real pasa a
 * "Validación de técnicos". Esta lista solo muestra qué puso cada persona al
 * registrarse, para referencia. */
export const TechnicianApplications: React.FC = () => {
  const { technicianApplications } = useApp();

  if (!technicianApplications.length) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Solicitudes "Ser técnico"</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Bitácora de alta — la cuenta y la ficha se crean automáticamente al enviar el
            formulario. La aprobación final del perfil se hace desde "Validación de técnicos".
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {technicianApplications.map((app) => (
          <div key={app.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="text-xs text-slate-900 dark:text-slate-100">{app.fullName}</b>
                <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{app.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    {app.phone}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                    {app.specialty}
                  </div>
                </div>
                {app.message && (
                  <p className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-950 rounded text-[10px] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 italic">
                    "{app.message}"
                  </p>
                )}
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                {statusCopy[app.status] ?? app.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
