import React, { useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Wrench,
  Zap,
  Hammer,
  Settings,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ServiceBadge } from '../components/common/Badge';

export const ServicesCategoryView: React.FC = () => {
  const { navigate, services, currentPath, currentUser, showToast } = useApp();

  // Extraer la categoría del path (ej: "#/services-category/Plomería")
  const selectedCategory = useMemo(() => {
    const match = currentPath.match(/services-category\/(.+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [currentPath]);

  const categoryServices = useMemo(() => {
    if (!selectedCategory) return [];
    return services.filter(
      (s) => s.category.toLowerCase() === selectedCategory.toLowerCase() && s.active !== false
    );
  }, [services, selectedCategory]);

  const getCategoryVisuals = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('plom') || cat.includes('agua') || cat.includes('cañ')) {
      return {
        icon: <Wrench className="w-6 h-6 text-sky-600" />,
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        textColor: 'text-sky-700',
      };
    }
    if (cat.includes('elec')) {
      return {
        icon: <Zap className="w-6 h-6 text-amber-600" />,
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        textColor: 'text-amber-700',
      };
    }
    if (cat.includes('repara') || cat.includes('hogar')) {
      return {
        icon: <Hammer className="w-6 h-6 text-orange-600" />,
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        textColor: 'text-orange-700',
      };
    }
    if (cat.includes('mante')) {
      return {
        icon: <Settings className="w-6 h-6 text-slate-600" />,
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        textColor: 'text-slate-700',
      };
    }
    if (cat.includes('instala')) {
      return {
        icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        textColor: 'text-emerald-700',
      };
    }
    return {
      icon: <Wrench className="w-6 h-6 text-teal-600" />,
      bg: 'bg-teal-50',
      border: 'border-teal-200',
      textColor: 'text-teal-700',
    };
  };

  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Categoría no encontrada</h2>
          <button
            onClick={() => navigate('/')}
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const visuals = getCategoryVisuals(selectedCategory);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver a Servicios</span>
          </button>

          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${visuals.bg} ${visuals.border} border`}>
              {visuals.icon}
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">{selectedCategory}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {categoryServices.length} servicio{categoryServices.length !== 1 ? 's' : ''} disponible{categoryServices.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {categoryServices.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-12 border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Sin servicios en esta categoría</h3>
            <p className="text-sm text-slate-500 mt-2">
              Actualmente no hay servicios disponibles en {selectedCategory}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryServices.map((srv) => {
              const srvVisuals = getCategoryVisuals(srv.category);
              return (
                <div
                  key={srv.id}
                  className="bg-slate-50/70 rounded-2xl p-6 border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2.5 rounded-xl ${srvVisuals.bg} ${srvVisuals.border} border`}>
                        {srvVisuals.icon}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                          {srv.category}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-base text-slate-900 mb-3">{srv.name}</h3>

                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60">
                      <div className="text-xs text-slate-500 font-medium">Mano de obra base:</div>
                      <div className="text-sm font-mono font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        ${srv.price.toLocaleString('es-AR')}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
                      {srv.description}
                    </p>
                  </div>

                  {srv.features && srv.features.length > 0 && (
                    <div className="space-y-1.5 pt-3 border-t border-slate-200/60 mb-4">
                      {srv.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      localStorage.setItem('tecniurbano_selectedServiceId', srv.id);
                      // The order editor belongs to Admin Hub. Sending visitors
                      // directly there caused a protected-route redirect that
                      // looked like the button had done nothing.
                      if (!currentUser) {
                        sessionStorage.setItem('tecniurbano_pending_service_id', srv.id);
                        navigate('/auth');
                        return;
                      }

                      if (currentUser.role === 'admin') {
                        navigate('/hub');
                        return;
                      }

                      localStorage.removeItem('tecniurbano_selectedServiceId');
                      showToast(
                        'Ingresaste como cliente. El pedido debe cargarse desde el portal del cliente.',
                        'info',
                        'Servicio seleccionado'
                      );
                      navigate('/customer');
                    }}
                    className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Crear Orden
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
