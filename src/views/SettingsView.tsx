import React from 'react';
import {
  Settings,
  Shield,
  Wrench,
  User,
  RotateCcw,
  Sparkles,
  Database,
  Info,
  Check,
  CheckCircle2,
  ExternalLink,
  Layers,
  UserRound,
  MapPin,
  MapPinned,
  CalendarDays,
  ChevronRight,
} from 'lucide-react';
import { DEMO_USERS, useApp } from '../context/AppContext';
import { CurrentUserData } from '../types';
import { VisitFeeSettings } from '../components/admin/VisitFeeSettings';
import { SystemSettingsPanel } from '../components/admin/SystemSettingsPanel';
import { DEMO_MODE } from '../lib/featureFlags';

export const SettingsView: React.FC = () => {
  const { currentUser, setCurrentUser, navigate, resetDemoData, orders, materials, customers, technicians, usingRemoteData, refreshRemoteData, dataLoading, remoteBusy } =
    useApp();

  if (!currentUser) {
    return null;
  }

  const handleSelectUser = (user: CurrentUserData) => {
    setCurrentUser(user);
    if (user.role === 'admin') navigate('/hub');
    else if (user.role === 'technician') navigate('/technician');
    else navigate('/customer');
  };

  const usersList = Object.values(DEMO_USERS);

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-900/80 pb-12" id="settings-view-container">
      {/* Header - High Density Dark */}
      <div className="bg-[#0F172A] border-b border-slate-800 text-white shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm shadow-xs">
              <Settings className="w-4 h-4" />
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Ajustes & Perfil del Sistema
              </h1>
              <p className="text-[11px] text-slate-400">
                Configuración del entorno demo, selector de identidad y estado del almacenamiento en memoria.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-3 sm:px-5 lg:px-6 pt-4 space-y-3">
        {/* Active Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
              Perfil activo
            </h3>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded border ${
                usingRemoteData
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 border-teal-200 dark:border-teal-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 border-amber-200 dark:border-amber-800'
              }`}
            >
              {usingRemoteData ? 'Supabase' : 'Demo local'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-slate-900 to-teal-700 text-white flex items-center justify-center font-black text-sm shadow-xs font-mono">
              {currentUser.avatarText}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentUser.name}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentUser.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-bold font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-900 text-teal-300 border border-slate-800">
                  Rol: {currentUser.role.toUpperCase()}
                </span>
                {currentUser.technicianId && (
                  <span className="text-[9px] font-mono font-bold text-teal-700 bg-teal-50 dark:bg-teal-950/40 px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800">
                    ID Técnico: {currentUser.technicianId}
                  </span>
                )}
                {currentUser.customerId && (
                  <span className="text-[9px] font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                    ID Cliente: {currentUser.customerId}
                  </span>
                )}
              </div>
            </div>
            {usingRemoteData && (
              <button
                type="button"
                onClick={() => void refreshRemoteData()}
                disabled={dataLoading || remoteBusy}
                className="text-[11px] font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                {dataLoading ? 'Sincronizando…' : 'Refrescar datos'}
              </button>
            )}
          </div>
        </div>

        {currentUser.role === 'technician' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono pb-2 border-b border-slate-100 dark:border-slate-800">
            Mi cuenta
          </h3>
          {[
            { path: '/technician/profile', label: 'Mi perfil', description: 'Datos profesionales, foto y documentación.', icon: UserRound },
            { path: '/technician/zona-trabajo', label: 'Zona de trabajo', description: 'Dónde recibís los pedidos asignados.', icon: MapPinned },
            { path: '/technician/disponibilidad', label: 'Disponibilidad', description: 'Días y horarios en los que trabajás.', icon: CalendarDays },
          ].map(({ path, label, description, icon: Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-1.5 -mx-1.5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">{label}</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">{description}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
        )}

        {currentUser.role === 'customer' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono pb-2 border-b border-slate-100 dark:border-slate-800">
            Mi cuenta
          </h3>
          {[
            { path: '/customer/profile', label: 'Mi Perfil', description: 'Tus datos de contacto y foto de cuenta.', icon: UserRound },
            { path: '/customer/direcciones', label: 'Mis direcciones', description: 'Domicilios guardados para pedir servicios más rápido.', icon: MapPin },
          ].map(({ path, label, description, icon: Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-1.5 -mx-1.5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">{label}</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">{description}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
        )}

        {currentUser.role === 'admin' && <VisitFeeSettings />}
        {currentUser.role === 'admin' && <SystemSettingsPanel />}

        {/* Change User / Role Quick Grid (solo en modo demo) */}
        {DEMO_MODE && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                Cambiar Usuario para Probar los 3 Roles
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Hacé click en cualquier cuenta para cambiar de perspectiva inmediatamente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {usersList.map((u) => {
              const isSelected = currentUser.id === u.id;

              const getRoleLabel = () => {
                if (u.role === 'admin') return 'Administrador';
                if (u.role === 'technician') return 'Técnico';
                return 'Cliente';
              };

              const getBadgeColor = () => {
                if (u.role === 'admin') return 'bg-slate-900 text-teal-300 border-slate-800';
                if (u.role === 'technician') return 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 border-teal-200 dark:border-teal-800';
                return 'bg-sky-50 text-sky-700 border-sky-200';
              };

              return (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 font-mono">
                      {u.avatarText}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{u.name}</span>
                        <span
                          className={`text-[9px] uppercase font-bold font-mono px-1 py-0.2 rounded border ${getBadgeColor()}`}
                        >
                          {getRoleLabel()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                        {u.email}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* System & Architecture Info -- solo admin: son metricas de todo el
            sistema, no de la cuenta del usuario que esta mirando sus Ajustes. */}
        {currentUser.role === 'admin' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                Estado del Almacenamiento en Memoria
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">Órdenes:</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm font-black font-mono">{orders.length}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">Técnicos:</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm font-black font-mono">{technicians.length}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">Clientes:</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm font-black font-mono">{customers.length}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">Insumos:</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm font-black font-mono">{materials.length}</strong>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {usingRemoteData
                ? 'Los datos viven en Supabase.'
                : 'Los cambios persisten en memoria local reactiva.'}
            </p>
            {DEMO_MODE && !usingRemoteData && (
              <button
                onClick={resetDemoData}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer Datos</span>
              </button>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
};
