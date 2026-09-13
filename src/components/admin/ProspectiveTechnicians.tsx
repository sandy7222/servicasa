import React, { useState } from 'react';
import { UserPlus, Phone, Wrench, Trash2, ArrowRightCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ProspectiveTechnician, ProspectiveTechnicianStatus } from '../../types';

const statusCopy: Record<ProspectiveTechnicianStatus, string> = {
  pendiente: 'Sin contactar',
  contactado: 'Contactado',
  convertido: 'Convertido a técnico',
  descartado: 'Descartado',
};

const statusBadgeClass: Record<ProspectiveTechnicianStatus, string> = {
  pendiente: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  contactado: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  convertido: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  descartado: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800',
};

type Props = {
  /** El admin quiere convertir este prospecto en un técnico real: AdminHubView
   * abre el modal de alta de técnico precargado con nombre/teléfono/rubro y,
   * si el alta se confirma, marca este registro como "convertido". */
  onConvertToTechnician: (prospect: ProspectiveTechnician) => void;
};

/** Agenda interna de "futuros técnicos": el admin carga a mano nombre +
 * teléfono (y opcionalmente un rubro) de gente que todavía no es técnico —
 * por ejemplo, estudiantes que le van pasando el contacto — para hacer
 * seguimiento hasta que se sumen de verdad. No tiene alta pública ni
 * relación con "Solicitudes 'Ser técnico'" (esas las llena la propia
 * persona desde afuera). Ver plan-zona-trabajo-agenda.md. */
export const ProspectiveTechnicians: React.FC<Props> = ({ onConvertToTechnician }) => {
  const { prospectiveTechnicians, addProspectiveTechnician, updateProspectiveTechnicianStatus, deleteProspectiveTechnician } =
    useApp();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    addProspectiveTechnician({
      fullName: name.trim(),
      phone: phone.trim(),
      specialty: specialty.trim() || undefined,
    });
    setName('');
    setPhone('');
    setSpecialty('');
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start gap-2 mb-3">
        <UserPlus className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Futuros técnicos</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Agenda interna de contactos (ej. estudiantes) para hacer seguimiento antes de que se sumen como técnicos.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Nombre *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre y apellido"
            className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            required
          />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Teléfono *</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+54 9 11 ..."
            className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            required
          />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Rubro (opcional)</label>
          <input
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="Ej: gasista"
            className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || !phone.trim()}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 shrink-0"
        >
          Agendar
        </button>
      </form>

      {prospectiveTechnicians.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Todavía no agendaste ningún futuro técnico.</p>
      ) : (
        <div className="space-y-2">
          {prospectiveTechnicians.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <b className="text-xs text-slate-900 dark:text-slate-100">{p.fullName}</b>
                  <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      {p.phone}
                    </div>
                    {p.specialty && (
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                        {p.specialty}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={p.status}
                    onChange={(e) => updateProspectiveTechnicianStatus(p.id, e.target.value as ProspectiveTechnicianStatus)}
                    className={`text-[10px] font-bold rounded-full px-2 py-1 border ${statusBadgeClass[p.status]}`}
                  >
                    {(Object.keys(statusCopy) as ProspectiveTechnicianStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {statusCopy[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => deleteProspectiveTechnician(p.id)}
                    title="Eliminar de la agenda"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {p.status !== 'convertido' && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onConvertToTechnician(p)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-700 hover:text-teal-800"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    Convertir en técnico
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
