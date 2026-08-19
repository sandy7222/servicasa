import React from 'react';
import { DEMO_MODE } from '../lib/featureFlags';
import {
  Wrench,
  Zap,
  Hammer,
  Settings,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Clock,
  FileSignature,
  Star,
  Users,
  Shield,
  Sparkles,
  PhoneCall,
  MapPin,
  ChevronRight,
  Plus,
  Droplets,
  Flame,
  Lightbulb,
} from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { useApp } from '../context/AppContext';

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

export const LandingView: React.FC = () => {
  const { navigate, serviceCategories, services } = useApp();

  const getServiceVisuals = (category: { name: string; icon?: string }) => {
    if (category.icon && CATEGORY_ICON_MAP[category.icon]) {
      return CATEGORY_ICON_MAP[category.icon];
    }
    const cat = (category.name || '').toLowerCase();
    if (cat.includes('plom') || cat.includes('agua') || cat.includes('cañ')) {
      return {
        icon: <Wrench className="w-6 h-6 text-sky-600" />,
        bg: 'bg-sky-50',
        border: 'border-sky-200',
      };
    }
    if (cat.includes('elect') || cat.includes('luz') || cat.includes('tensión')) {
      return {
        icon: <Zap className="w-6 h-6 text-amber-500" />,
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      };
    }
    if (cat.includes('repar') || cat.includes('hogar') || cat.includes('cerraj')) {
      return {
        icon: <Hammer className="w-6 h-6 text-rose-500" />,
        bg: 'bg-rose-50',
        border: 'border-rose-200',
      };
    }
    if (cat.includes('manten') || cat.includes('prevent') || cat.includes('general')) {
      return {
        icon: <Settings className="w-6 h-6 text-emerald-600" />,
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    }
    return {
      icon: <ShieldCheck className="w-6 h-6 text-teal-600" />,
      bg: 'bg-teal-50',
      border: 'border-teal-200',
    };
  };

  const steps = [
    {
      step: '01',
      title: 'Solicitás el servicio',
      desc: 'Detallás el problema, urgencia, franja horaria y dirección del domicilio.',
      icon: <PhoneCall className="w-5 h-5 text-[#003875]" />,
    },
    {
      step: '02',
      title: 'Asignamos técnico',
      desc: 'El sistema selecciona al especialista disponible más cercano con el instrumental adecuado.',
      icon: <UserCheck className="w-5 h-5 text-teal-600" />,
    },
    {
      step: '03',
      title: 'Se realiza el trabajo',
      desc: 'El técnico registra tiempos, checklist de tareas y materiales de inventario en tiempo real.',
      icon: <Wrench className="w-5 h-5 text-[#003875]" />,
    },
    {
      step: '04',
      title: 'Confirmás y firmás',
      desc: 'Revisás el detalle del trabajo y otorgás conformidad con tu firma digital en pantalla.',
      icon: <FileSignature className="w-5 h-5 text-emerald-600" />,
    },
  ];

  const testimonials = [
    {
      name: 'Florencia Soria',
      neighborhood: 'Palermo Soho',
      comment: 'Tenía una fuga en el lavadero que nadie lograba solucionar. Carlos vino puntual, cambió la válvula y firmé todo desde mi celular. Excelente servicio.',
      rating: 5,
      service: 'Plomería',
    },
    {
      name: 'Gonzalo Benítez',
      neighborhood: 'Vicente López',
      comment: 'Instalaron el soporte de TV de 65 pulgadas con nivel láser y prolijidad absoluta. Muy claro el detalle de materiales y tiempos empleados.',
      rating: 5,
      service: 'Instalación de equipos',
    },
    {
      name: 'Julián Albarracín',
      neighborhood: 'Almagro',
      comment: 'La transparencia de ver el checklist técnico y los repuestos utilizados antes de firmar la conformidad da muchísima tranquilidad.',
      rating: 5,
      service: 'Mantenimiento',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" id="tecniurbano-landing-view">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-950 via-[#003875] to-[#00264d] text-white pt-12 pb-20 sm:pt-16 sm:pb-28">
        {/* Subtle background glow circles */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            className={
              DEMO_MODE
                ? 'grid grid-cols-1 lg:grid-cols-12 gap-12 items-center'
                : 'flex justify-center'
            }
          >
            {/* Left Column */}
            <div
              className={
                DEMO_MODE
                  ? 'lg:col-span-7 space-y-5 text-center lg:text-left'
                  : 'max-w-3xl space-y-5 text-center'
              }
            >
              {/* Official Brand Emblem Pill */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-teal-300">
                <Logo size="xs" showText={false} variant="white" />
                <span>Gestión Integral de Servicios Técnicos a Domicilio</span>
              </div>

              {/* Headline with Official Brand Identity */}
              <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-xl border border-white/20 shrink-0">
                  <Logo size="2xl" layout="vertical" showText={false} variant="light" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                    <span className="text-white">Tecni</span>
                    <span className="text-teal-400">Urbano</span>
                  </h1>
                  <span className="block text-base sm:text-lg font-bold text-teal-300 tracking-wide mt-0.5">
                    Servicios a domicilio
                  </span>
                </div>
              </div>

              <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl leading-relaxed">
                La plataforma operativa que conecta a administradores, técnicos en campo y clientes
                para resolver reparaciones, instalaciones y urgencias del hogar con trazabilidad total.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <button
                  onClick={() => navigate('/auth')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span>Ingresar al sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigate('/hub')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm backdrop-blur-xs transition-colors"
                >
                  <Shield className="w-4 h-4 text-sky-300" />
                  <span>Ver Panel de Administración</span>
                </button>
              </div>

            </div>

            {/* Right Column: Interactive Role Selector Card (solo en modo demo) */}
            {DEMO_MODE && (
            <div className="lg:col-span-5">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-7 shadow-2xl border border-white/30 text-slate-800">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#003875] text-white flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Accesos Demo Rápidos</h3>
                      <p className="text-[11px] text-slate-500">Seleccioná tu rol para comenzar</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Listo para probar
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Admin option */}
                  <div
                    onClick={() => navigate('/auth')}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-[#003875] hover:bg-blue-50/50 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#003875] flex items-center justify-center font-bold">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-[#003875] transition-colors">
                          Rol Administrador
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Panel de órdenes, inventario, clientes y métricas
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#003875] group-hover:translate-x-0.5 transition-all" />
                  </div>

                  {/* Technician option */}
                  <div
                    onClick={() => navigate('/auth')}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                          Rol Técnico en Campo (Carlos)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Checklist, tiempos, materiales y solicitud de firma
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  {/* Customer option */}
                  <div
                    onClick={() => navigate('/auth')}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                          Rol Cliente (Julián)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Resumen del servicio, detalle de repuestos y firma digital
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-700 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                  <button
                    onClick={() => navigate('/auth')}
                    className="text-xs font-bold text-[#003875] hover:text-teal-600 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Ver todos los usuarios y perfiles demo</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 sm:py-20 bg-white" id="servicios-ofrecidos">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#003875] mb-2">
              Nuestra Cobertura Especializada
            </h2>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Servicios de TecniUrbano
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Soluciones técnicas integrales para hogares y consorcios con mano de obra calificada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceCategories.filter((cat) => cat.active !== false).map((category) => {
              const serviciosEnCategoria = services.filter(
                (s) => s.category === category.name && s.active !== false
              ).length;

              const visuals = getServiceVisuals(category);

              return (
                <div
                  key={category.id}
                  onClick={() => navigate(`/services-category/${encodeURIComponent(category.name)}`)}
                  className="bg-slate-50/70 rounded-2xl p-6 border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-xl ${visuals.bg} ${visuals.border} border group-hover:scale-110 transition-transform`}>
                        {visuals.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{category.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {serviciosEnCategoria} servicio{serviciosEnCategoria !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      {category.description}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/services-category/${encodeURIComponent(category.name)}`);
                    }}
                    className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Ver Servicios
                  </button>
                </div>
              );
            })}

            {/* CTA Box in grid */}
            <div className="bg-gradient-to-br from-[#003875] to-[#00234b] text-white rounded-2xl p-6 flex flex-col justify-between shadow-md">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                  Operación Real
                </span>
                <h3 className="font-bold text-lg text-white mt-1 mb-2">
                  ¿Tenés una urgencia en tu hogar?
                </h3>
                <p className="text-xs text-blue-100 leading-relaxed">
                  Podés crear una orden de prueba en el Admin Hub o simular la atención técnica en
                  pocos minutos.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate('/auth')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Crear orden en Admin Hub</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Process Section */}
      <section className="py-16 sm:py-20 bg-slate-100/70 border-y border-slate-200" id="como-funciona">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-700 mb-2">
              Flujo Operativo Paso a Paso
            </h2>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ¿Cómo gestionamos cada servicio?
            </p>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Un ciclo transparente y seguro desde la solicitud inicial hasta la firma de
              conformidad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((st) => (
              <div
                key={st.step}
                className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs relative"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                    {st.icon}
                  </div>
                  <span className="font-mono text-xl font-black text-slate-300">{st.step}</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-2">{st.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials / Experience Section */}
      <section className="py-16 sm:py-20 bg-white" id="testimonios">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#003875] mb-2">
              Confianza Comprobada
            </h2>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Experiencias de nuestros clientes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-3">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed mb-4">
                    "{t.comment}"
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{t.name}</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {t.neighborhood}
                    </span>
                  </div>
                  <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {t.service}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Banner */}
      <footer className="bg-slate-900 text-white py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <Logo size="md" variant="white" showTagline={true} />
            <p className="text-xs text-slate-400 mt-2">
              Plataforma interna para la gestión integral de servicios técnicos a domicilio.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              Ingresar al sistema
            </button>
            <button
              onClick={() => navigate('/hub')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              Admin Hub
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
