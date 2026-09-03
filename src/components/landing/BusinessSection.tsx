import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { BusinessModal } from './BusinessModal';

export const BusinessSection: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="py-8" id="contacto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-slate-100 border border-slate-200 px-5 py-5 sm:px-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="hidden sm:flex shrink-0 w-11 h-11 rounded-xl bg-white border border-slate-200 items-center justify-center text-[#003875]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">¿Sos una empresa?</h3>
              <p className="text-xs text-slate-600">
                También conformamos equipos de técnicos especializados para obras, proyectos y
                mantenimiento empresarial.
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#003875] hover:bg-[#00264d] text-white font-bold text-sm transition-colors"
          >
            Solicitar propuesta
          </button>
        </div>
        <p className="text-center text-xs text-slate-500 mt-3">
          <a href="mailto:hola@tecniurbano.online" className="hover:text-teal-700 underline underline-offset-2">
            hola@tecniurbano.online
          </a>
        </p>
      </div>

      <BusinessModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
};
