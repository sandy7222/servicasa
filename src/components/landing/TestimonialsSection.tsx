import React from 'react';
import { Star } from 'lucide-react';
import familiaWebp from '../../assets/landing/familia.webp';
import familiaPng from '../../assets/landing/familia.png';

// Ejemplos ilustrativos hasta contar con testimonios reales de clientes — ver spec sección 11.
const TESTIMONIALS = [
  {
    name: 'María G.',
    neighborhood: 'Quilmes',
    comment: 'Excelente servicio, el técnico llegó puntual y solucionó todo. Pude seguir el trabajo desde la app en tiempo real.',
    rating: 5,
  },
  {
    name: 'Carlos R.',
    neighborhood: 'Berazategui',
    comment: 'Muy profesionales y prolijos. Además, tener 30 días de garantía te da mucha tranquilidad.',
    rating: 5,
  },
  {
    name: 'Lucía P.',
    neighborhood: 'Florencio Varela',
    comment: 'Abrí un reclamo por una pequeña fuga y lo resolvieron al día siguiente. ¡Así da gusto!',
    rating: 5,
  },
];

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-white dark:bg-slate-900" id="testimonios">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div>
            <div className="text-center lg:text-left max-w-xl mx-auto lg:mx-0 mb-8">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Experiencias de nuestros clientes
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 italic">
                Ejemplo ilustrativo — todavía no contamos con testimonios reales publicados.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/70 shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center gap-1 text-amber-400 mb-3">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" strokeWidth={0} />
                    ))}
                  </div>
                  <p className="text-[13px] text-slate-600 dark:text-slate-400 italic leading-relaxed mb-4">"{t.comment}"</p>
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 block">{t.name}</span>
                  <span className="text-[12px] text-slate-500 dark:text-slate-400">{t.neighborhood}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="order-first lg:order-last">
            <picture>
              <source srcSet={familiaWebp} type="image/webp" />
              <img
                src={familiaPng}
                alt="Familia usando la app de TecniUrbano tranquila desde su casa"
                width={1000}
                height={667}
                loading="lazy"
                className="w-full h-auto rounded-[20px] shadow-[0_16px_40px_-16px_rgba(15,23,42,0.25)] object-cover"
              />
            </picture>
          </div>
        </div>
      </div>
    </section>
  );
};
