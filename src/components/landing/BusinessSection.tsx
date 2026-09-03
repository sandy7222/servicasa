import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { BusinessModal } from './BusinessModal';

export const BusinessSection: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="py-10" id="contacto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-[#F1F5FB] px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row items-center gap-5 justify-between">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 items-center justify-center text-[#003875]">
              <Building2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-slate-900 dark:text-slate-100">¿Sos una empresa?</h3>
              <p className="text-[13px] text-slate-600 dark:text-slate-400 mt-0.5 max-w-md">
                También conformamos equipos de técnicos especializados para obras, proyectos y
                mantenimiento empresarial.
              </p>
              <a
                href="mailto:hola@tecniurbano.online"
                className="inline-block text-[12px] text-slate-500 dark:text-slate-400 hover:text-teal-700 mt-1.5 transition-colors duration-200"
              >
                hola@tecniurbano.online
              </a>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="shrink-0 w-full sm:w-auto px-6 py-3 rounded-xl bg-[#003875] hover:bg-[#00264d] text-white font-bold text-sm transition-colors duration-200"
          >
            Solicitar propuesta
          </button>
        </div>
      </div>

      <BusinessModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
};
