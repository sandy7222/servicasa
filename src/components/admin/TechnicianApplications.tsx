import React from 'react';
import { ClipboardList, Check, X, Mail, Phone, Wrench } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { TechnicianApplication } from '../../types';

interface Props {
  onApprove: (application: TechnicianApplication) => void;
}

export const TechnicianApplications: React.FC<Props> = ({ onApprove }) => {
  const { technicianApplications, reviewTechnicianApplication, showToast } = useApp();
  const pending = technicianApplications.filter((a) => a.status === 'pending');

  if (!pending.length) return null;

  const handleReject = async (app: TechnicianApplication) => {
    try {
      await reviewTechnicianApplication(app.id, 'rejected');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo rechazar', 'error');
    }
  };

  const handleApprove = async (app: TechnicianApplication) => {
    try {
      await reviewTechnicianApplication(app.id, 'approved');
      onApprove(app);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo aprobar', 'error');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">Solicitudes "Quiero ser técnico"</h3>
          <p className="text-[11px] text-slate-500">
            Aprobar prepara el alta formal (Nuevo Técnico + enlace de invitación). No crea acceso por sí sola.
          </p>
        </div>
        <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold font-mono">
          {pending.length} pendiente{pending.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-2">
        {pending.map((app) => (
          <div key={app.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="text-xs text-slate-900">{app.fullName}</b>
                <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
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
                  <p className="mt-1.5 p-2 bg-slate-50 rounded text-[10px] text-slate-500 border border-slate-100 italic">
                    "{app.message}"
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => void handleReject(app)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-bold transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Rechazar
                </button>
                <button
                  onClick={() => void handleApprove(app)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-[11px] font-bold transition-colors"
                >
                  <Check className="w-3.5 h-3.5 text-teal-400" /> Aprobar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
