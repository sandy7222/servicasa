import React from 'react';
import { ChevronRight } from 'lucide-react';
import { categoryBrandIcon } from '../brand/BrandIcons';
import { useApp } from '../../context/AppContext';
import { sortByDisplayOrder } from '../../lib/catalogOrder';
import type { CatalogCategory } from '../../types';

export const ServicesSection: React.FC = () => {
  const { navigate, catalogCategories, services } = useApp();
  const activeCategories = sortByDisplayOrder<CatalogCategory>(
    catalogCategories.filter((cat) => cat.active !== false)
  );
  // 3x2 se ve más equilibrado que 4+2 cuando hay exactamente 6 categorías;
  // con cualquier otra cantidad, 4 columnas sigue siendo lo más prolijo.
  const gridColsClass =
    activeCategories.length === 6 ? 'sm:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-4';

  return (
    <section className="py-14 sm:py-16 bg-white dark:bg-slate-900" id="servicios-ofrecidos">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            ¿Qué servicio necesitás?
          </h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-2.5">
            Contamos con técnicos especializados para resolver cualquier problema en tu hogar.
          </p>
        </div>

        <div className={`grid grid-cols-2 ${gridColsClass} gap-4`}>
          {activeCategories.map((category) => {
            const Icon = categoryBrandIcon(category);
            const count = services.filter((s) => s.category === category.name && s.active !== false).length;

            return (
              <button
                key={category.id}
                onClick={() => navigate(`/services-category/${encodeURIComponent(category.name)}`)}
                className="text-left bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 group"
              >
                <Icon className="w-12 h-12 mb-3 text-[#1f45b8] dark:text-[#7aa2ff] transition-transform duration-200 group-hover:-translate-y-0.5" />
                <h3 className="font-bold text-[15px] text-slate-900 dark:text-slate-100">{category.name}</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                  {category.description || `${count} servicio${count !== 1 ? 's' : ''}`}
                </p>
              </button>
            );
          })}
        </div>

        <div className="text-center mt-7">
          <button
            onClick={() => navigate('/auth')}
            className="group inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-800"
          >
            Ver todos los servicios
            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
