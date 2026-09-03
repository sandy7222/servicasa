import React from 'react';
import { ShieldCheck, Clock, Lock } from 'lucide-react';

const PILLARS = [
  {
    icon: <ShieldCheck className="w-6 h-6" strokeWidth={1.75} />,
    title: 'Garantía de 30 días',
    desc: 'Si algo no queda bien, lo solucionamos sin cargo durante 30 días.',
  },
  {
    icon: <Clock className="w-6 h-6" strokeWidth={1.75} />,
    title: 'Reclamos en 48 hs',
    desc: 'Tenés hasta 48 horas después del servicio para abrir y seguir un reclamo desde la app.',
  },
  {
    icon: <Lock className="w-6 h-6" strokeWidth={1.75} />,
    title: 'Pagos seguros',
    desc: 'Pagá de forma segura desde la app con Mercado Pago.',
  },
];

export const TrustBand: React.FC = () => {
  return (
    <section className="bg-gradient-to-br from-[#003875] to-[#00234b] text-white" id="garantia">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
        {PILLARS.map((p) => (
          <div key={p.title} className="flex items-start gap-4 sm:px-8 first:sm:pl-0 last:sm:pr-0 py-3 sm:py-0">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-teal-300">
              {p.icon}
            </div>
            <div>
              <h3 className="font-bold text-[15px]">{p.title}</h3>
              <p className="text-[13px] text-blue-100/75 mt-1 leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
