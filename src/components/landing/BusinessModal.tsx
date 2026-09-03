import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LandingModal } from './LandingModal';

interface BusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  serviceType: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  serviceType: '',
  description: '',
};

const FIELD_CLASS =
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent';

export const BusinessModal: React.FC<BusinessModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    onClose();
    // Se limpia al cerrar, no en cada render, para no perder lo tipeado si se reabre por error.
    window.setTimeout(() => {
      setForm(EMPTY_FORM);
      setSubmitted(false);
    }, 200);
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: conectar a un backend/API de formularios real cuando exista
    // (spec sección 12 — deliberadamente no se resuelve con `mailto:`).
    setSubmitted(true);
  };

  return (
    <LandingModal
      isOpen={isOpen}
      onClose={handleClose}
      titleId="business-modal-title"
      title="Solicitar propuesta para tu empresa"
      subtitle="Contanos qué necesitás y te contactamos a la brevedad."
      maxWidthClassName="max-w-lg"
    >
      {submitted ? (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <CheckCircle2 className="w-12 h-12 text-teal-500" />
          <p className="font-bold text-slate-900">¡Consulta enviada!</p>
          <p className="text-sm text-slate-600">
            Gracias por contactarnos. Nos comunicaremos contigo a la brevedad.
          </p>
          <button
            onClick={handleClose}
            className="mt-2 px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de empresa</label>
            <input required value={form.companyName} onChange={set('companyName')} className={FIELD_CLASS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Persona de contacto</label>
            <input required value={form.contactName} onChange={set('contactName')} className={FIELD_CLASS} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo</label>
              <input required type="email" value={form.email} onChange={set('email')} className={FIELD_CLASS} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
              <input required type="tel" value={form.phone} onChange={set('phone')} className={FIELD_CLASS} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de servicio</label>
            <input
              required
              value={form.serviceType}
              onChange={set('serviceType')}
              placeholder="Ej: mantenimiento de oficinas, obra nueva..."
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción del proyecto</label>
            <textarea required rows={3} value={form.description} onChange={set('description')} className={FIELD_CLASS} />
          </div>
          <button
            type="submit"
            className="w-full mt-1 px-5 py-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-[#00203d] font-bold text-sm transition-colors duration-200"
          >
            Enviar consulta
          </button>
        </form>
      )}
    </LandingModal>
  );
};
