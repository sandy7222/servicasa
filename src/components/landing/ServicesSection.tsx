import React from 'react';
import {
  Wrench,
  Zap,
  Hammer,
  Settings,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Droplets,
  Flame,
  Lightbulb,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { sortByDisplayOrder } from '../../lib/catalogOrder';
import type { CatalogCategory } from '../../types';

const CATEGORY_ICON_MAP: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
  Wrench: { icon: <Wrench className="w-6 h-6 text-sky-600" />, bg: 'bg-sky-50', border: 'border-sky-200' },
  Zap: { icon: <Zap className="w-6 h-6 text-amber-500" />, bg: 'bg-amber-50', border: 'border-amber-200' },
  Hammer: { icon: <Hammer className="w-6 h-6 text-rose-500" />, bg: 'bg-rose-50', border: 'border-rose-200' },
  Settings: { icon: <Settings className="w-6 h-6 text-emerald-600" />, bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ShieldCheck: { icon: <ShieldCheck className="w-6 h-6 text-teal-600" />, bg: 'bg-teal-50', border: 'border-teal-200' },
  Droplets: { icon: <Droplets className="w-6 h-6 text-blue-600" />, bg: 'bg-blue-50', border: 'border-blue-200' },
  Flame: { icon: <Flame className="w-6 h-6 text-rose-600" />, bg: 'bg-rose-50', border: 'border-rose-200' },
  Lightbulb: { icon: <Lightbulb className="w-6 h-6 text-yellow-600" />, bg: 'bg-yellow-50', border: 'border-yellow-200' },
  Sparkles: { icon: <Sparkles className="w-6 h-6 text-teal-600" />, bg: 'bg-teal-50', border: 'border-teal-200' },
};

function getServiceVisuals(category: { name: string; icon?: string }) {
  if (category.icon && CATEGORY_ICON_MAP[category.icon]) {
    return CATEGORY_ICON_MAP[category.icon];
  }
  const cat = (category.name || '').toLowerCase();
  if (cat.includes('plom') || cat.includes('agua') || cat.includes('cañ')) {
    return { icon: <Wrench className="w-6 h-6 text-sky-600" />, bg: 'bg-sky-50', border: 'border-sky-200' };
  }
  if (cat.includes('elect') || cat.includes('luz') || cat.includes('tensión')) {
    return { icon: <Zap className="w-6 h-6 text-amber-500" />, bg: 'bg-amber-50', border: 'border-amber-200' };
  }
  if (cat.includes('repar') || cat.includes('hogar') || cat.includes('cerraj')) {
    return { icon: <Hammer className="w-6 h-6 text-rose-500" />, bg: 'bg-rose-50', border: 'border-rose-200' };
  }
  if (cat.includes('manten') || cat.includes('prevent') || cat.includes('general')) {
    return { icon: <Settings className="w-6 h-6 text-emerald-600" />, bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }
  return { icon: <ShieldCheck className="w-6 h-6 text-teal-600" />, bg: 'bg-teal-50', border: 'border-teal-200' };
}

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
    <section className="py-14 sm:py-16 bg-white" id="servicios-ofrecidos">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            ¿Qué servicio necesitás?
          </h2>
          <p className="text-base text-slate-500 mt-2.5">
            Contamos con técnicos especializados para resolver cualquier problema en tu hogar.
          </p>
        </div>

        <div className={`grid grid-cols-2 ${gridColsClass} gap-4`}>
          {activeCategories.map((category) => {
            const visuals = getServiceVisuals(category);
            const count = services.filter((s) => s.category === category.name && s.active !== false).length;

            return (
              <button
                key={category.id}
                onClick={() => navigate(`/services-category/${encodeURIComponent(category.name)}`)}
                className="text-left bg-white rounded-2xl p-5 border border-slate-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 group"
              >
                <div className={`w-11 h-11 rounded-xl ${visuals.bg} ${visuals.border} border flex items-center justify-center mb-3.5`}>
                  {visuals.icon}
                </div>
                <h3 className="font-bold text-[15px] text-slate-900">{category.name}</h3>
                <p className="text-[13px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
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
