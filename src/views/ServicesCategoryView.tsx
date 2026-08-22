import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Wrench,
  Zap,
  Hammer,
  Settings,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Search,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const formatDuration = (minutes?: number) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

export const ServicesCategoryView: React.FC = () => {
  const { navigate, services, catalogCategories, catalogSubcategories, currentPath, currentUser, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string>();

  // Extraer la categoría del path (ej: "#/services-category/Plomería")
  const selectedCategory = useMemo(() => {
    const match = currentPath.match(/services-category\/(.+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [currentPath]);

  const categoryServices = useMemo(() => {
    if (!selectedCategory) return [];
    const base = services.filter(
      (s) => s.category.toLowerCase() === selectedCategory.toLowerCase() && s.active !== false
    );
    const term = search.trim().toLowerCase();
    const filtered = term ? base.filter((s) => s.name.toLowerCase().includes(term)) : base;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [services, selectedCategory, search]);

  // Agrupa por subcategoría real (categories/subcategories, ver
  // plan-categorias-subcategorias.md Fase 3). Los servicios sin
  // subcategoryId (categorías de un solo ítem) quedan en un grupo "suelto"
  // sin encabezado propio.
  const subcategoryGroups = useMemo(() => {
    const category = catalogCategories.find(
      (c) => c.name.toLowerCase() === (selectedCategory ?? '').toLowerCase()
    );
    const orderedSubcategories = category
      ? catalogSubcategories
          .filter((sc) => sc.categoryId === category.id)
          .sort((a, b) => a.displayOrder - b.displayOrder)
      : [];

    const groups: { id: string | null; name: string | null; services: typeof categoryServices }[] = [];
    const placedIds = new Set<string>();
    orderedSubcategories.forEach((sc) => {
      const items = categoryServices.filter((s) => s.subcategoryId === sc.id);
      if (items.length > 0) {
        groups.push({ id: sc.id, name: sc.name, services: items });
        items.forEach((s) => placedIds.add(s.id));
      }
    });
    // Cualquier servicio que no cayó en ningún grupo de arriba — ya sea
    // porque no tiene subcategoryId, o porque categories/subcategories
    // todavía no cargó (ej. RLS de lectura anónima pendiente) — se muestra
    // igual, sin encabezado, en vez de desaparecer silenciosamente.
    const ungrouped = categoryServices.filter((s) => !placedIds.has(s.id));
    if (ungrouped.length > 0) groups.push({ id: null, name: null, services: ungrouped });
    return groups;
  }, [categoryServices, catalogCategories, catalogSubcategories, selectedCategory]);

  const totalInCategory = useMemo(() => {
    if (!selectedCategory) return 0;
    return services.filter((s) => s.category.toLowerCase() === selectedCategory.toLowerCase() && s.active !== false)
      .length;
  }, [services, selectedCategory]);

  const getCategoryVisuals = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('plom') || cat.includes('agua') || cat.includes('cañ')) {
      return { icon: <Wrench className="w-6 h-6 text-sky-600" />, bg: 'bg-sky-50', border: 'border-sky-200', textColor: 'text-sky-700' };
    }
    if (cat.includes('elec')) {
      return { icon: <Zap className="w-6 h-6 text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-700' };
    }
    if (cat.includes('repara') || cat.includes('hogar')) {
      return { icon: <Hammer className="w-6 h-6 text-orange-600" />, bg: 'bg-orange-50', border: 'border-orange-200', textColor: 'text-orange-700' };
    }
    if (cat.includes('mante')) {
      return { icon: <Settings className="w-6 h-6 text-slate-600" />, bg: 'bg-slate-50', border: 'border-slate-200', textColor: 'text-slate-700' };
    }
    if (cat.includes('instala')) {
      return { icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />, bg: 'bg-emerald-50', border: 'border-emerald-200', textColor: 'text-emerald-700' };
    }
    return { icon: <Wrench className="w-6 h-6 text-teal-600" />, bg: 'bg-teal-50', border: 'border-teal-200', textColor: 'text-teal-700' };
  };

  const handleCreateOrder = (serviceId: string) => {
    localStorage.setItem('tecniurbano_selectedServiceId', serviceId);
    // The order editor belongs to Admin Hub. Sending visitors
    // directly there caused a protected-route redirect that
    // looked like the button had done nothing.
    if (!currentUser) {
      sessionStorage.setItem('tecniurbano_pending_service_id', serviceId);
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
  };

  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Categoría no encontrada</h2>
          <button onClick={() => navigate('/')} className="text-teal-600 hover:text-teal-700 font-medium">
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver a Servicios</span>
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-xl ${visuals.bg} ${visuals.border} border`}>{visuals.icon}</div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">{selectedCategory}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {totalInCategory} servicio{totalInCategory !== 1 ? 's' : ''} disponible{totalInCategory !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {totalInCategory > 6 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar dentro de este rubro..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {categoryServices.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-12 border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {search ? 'Sin resultados para tu búsqueda' : 'Sin servicios en esta categoría'}
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              {search
                ? 'Probá con otra palabra o revisá la ortografía.'
                : `Actualmente no hay servicios disponibles en ${selectedCategory}`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {subcategoryGroups.map((group) => (
              <div key={group.id ?? 'sin-subcategoria'}>
                {group.name && (
                  <h2 className="text-sm font-bold text-slate-700 mb-2 px-1">{group.name}</h2>
                )}
                <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {group.services.map((srv) => {
                    const isOpen = openId === srv.id;
                    const duration = formatDuration(srv.estimatedDurationMinutes);
                    return (
                      <div key={srv.id} className="bg-white">
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? undefined : srv.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-slate-900 truncate">{srv.name}</p>
                            {duration && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <Clock className="w-3 h-3" />
                                {duration}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg text-xs sm:text-sm">
                              ${srv.price.toLocaleString('es-AR')}
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-slate-100 bg-slate-50/60 space-y-3">
                            <p className="text-sm text-slate-600 leading-relaxed pt-3">{srv.description}</p>

                            {srv.features && srv.features.length > 0 && (
                              <div className="space-y-1.5">
                                {srv.features.map((feat, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                    <span>{feat}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCreateOrder(srv.id)}
                              className="w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                            >
                              <Plus className="w-4 h-4" />
                              Crear Orden
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
