import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Wrench,
  UserCheck,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  MessageCircle,
} from 'lucide-react';
import { Logo } from './Logo';
import { useApp } from '../../context/AppContext';
import { RoleSwitcherModal } from './RoleSwitcherModal';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { DEMO_MODE } from '../../lib/featureFlags';
import { fetchTotalUnreadCount } from '../../lib/conversations';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { UserRole } from '../../types';

const UNREAD_POLL_MS = 30000;

export const Header: React.FC = () => {
  const { currentPath, navigate, currentUser, orders, isAuthenticated, authReady, logout, authLoading, usingRemoteData, technicians } =
    useApp();
  const pathOnly = currentPath.split('?')[0];

  // Foto de perfil circular en el header (reemplaza el badge "v1.2.0 - HD-CORE"
  // que no representaba nada real -- Sandy, 13/9). Para tecnicos usa la foto
  // profesional publica que ya suben desde "Mi perfil" (bucket
  // technician-avatars, technicians.public_avatar_path); para el resto
  // (cliente/admin) usa el avatar de cuenta que ya suben desde su panel de
  // perfil (bucket privado avatars, profiles.avatar_url, via signed URL).
  // Si no subieron nada todavia, se sigue mostrando el circulo con las
  // iniciales (avatarText) como hasta ahora.
  const technicianRecord = useMemo(
    () => technicians.find((item) => item.id === currentUser?.technicianId),
    [technicians, currentUser?.technicianId],
  );
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState<string>();

  useEffect(() => {
    if (!isSupabaseConfigured || !currentUser) { setAvatarPhotoUrl(undefined); return; }
    if (currentUser.role === 'technician') {
      setAvatarPhotoUrl(
        technicianRecord?.publicAvatarPath
          ? supabase.storage.from('technician-avatars').getPublicUrl(technicianRecord.publicAvatarPath).data.publicUrl
          : undefined,
      );
      return;
    }
    if (!currentUser.avatarUrl) { setAvatarPhotoUrl(undefined); return; }
    let cancelled = false;
    void supabase.storage.from('avatars').createSignedUrl(currentUser.avatarUrl, 3600).then(({ data }) => {
      if (!cancelled) setAvatarPhotoUrl(data?.signedUrl);
    });
    return () => { cancelled = true; };
  }, [currentUser, technicianRecord?.publicAvatarPath]);

  const renderAvatar = (sizeClass: string, textSizeClass = 'text-[11px]') =>
    avatarPhotoUrl ? (
      <img src={avatarPhotoUrl} alt={currentUser?.name ?? 'Avatar'} className={`${sizeClass} rounded-full object-cover shrink-0`} />
    ) : (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-teal-500 to-blue-600 text-white flex items-center justify-center font-bold ${textSizeClass} shadow-xs shrink-0`}>
        {currentUser?.avatarText ?? '?'}
      </div>
    );
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled'
  ).length;

  // Conteo liviano por polling — el hilo abierto ya tiene su propio Realtime
  // para actualizarse al instante; esto es solo para el badge del Header.
  React.useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    let cancelled = false;
    const tick = () => {
      fetchTotalUnreadCount()
        .then((count) => { if (!cancelled) setUnreadMessages(count); })
        .catch(() => {});
    };
    tick();
    const interval = window.setInterval(tick, UNREAD_POLL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [isAuthenticated, currentUser]);

  const conversationsPath = currentUser?.role === 'admin' ? '/admin/conversaciones' : currentUser?.role === 'technician' ? '/technician/conversaciones' : '/customer';

  const getRoleBadge = () => {
    if (!currentUser) {
      return {
        label: 'Invitado',
        bg: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        dot: 'bg-slate-400',
      };
    }
    if (currentUser.role === 'admin') {
      return {
        label: 'Admin',
        bg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
        dot: 'bg-teal-400',
      };
    }
    if (currentUser.role === 'technician') {
      return {
        label: 'Técnico',
        bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    }
    return {
      label: 'Cliente',
      bg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      dot: 'bg-sky-400',
    };
  };

  const roleInfo = getRoleBadge();

  // roles omitido = visible para cualquier usuario autenticado. Coincide con los
  // guards de <Protected roles={...}> en App.tsx para no mostrar accesos que la
  // ruta real igual va a rechazar.
  const navLinks: Array<{ label: string; path: string; icon: React.ReactNode; badge?: number; roles?: UserRole[] }> = [
    // No hay un link "Inicio" separado a propósito: para cada rol, su propio
    // link (Admin Hub/Técnico/Cliente) YA es su panel principal — y el logo
    // (ver más abajo) también lleva ahí. Un "Inicio" aparte sería un botón
    // repetido que apunta al mismo lugar que otro ya visible en este mismo
    // menú, para los tres roles.
    { label: 'Admin Hub', path: '/hub', icon: <LayoutDashboard className="w-3.5 h-3.5" />, badge: activeOrdersCount, roles: ['admin'] },
    { label: 'Técnico', path: '/technician', icon: <Wrench className="w-3.5 h-3.5" />, roles: ['admin', 'technician'] },
    { label: 'Cliente', path: '/customer', icon: <UserCheck className="w-3.5 h-3.5" />, roles: ['admin', 'customer'] },
    { label: 'Mensajes', path: conversationsPath, icon: <MessageCircle className="w-3.5 h-3.5" />, badge: unreadMessages || undefined },
    { label: 'Ajustes', path: '/settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  // Público (no autenticado) no ve ningún link de navegación — solo Logo + Ingresar.
  const visibleNavLinks =
    isAuthenticated && currentUser
      ? navLinks.filter((link) => !link.roles || link.roles.includes(currentUser.role))
      : [];

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-[#0F172A] border-b border-slate-800 text-slate-200 shadow-md backdrop-blur-sm"
        id="tecniurbano-main-header"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div
                // Mismo criterio que el link "Inicio" de más abajo: con sesión
                // iniciada, el logo lleva al panel de la app (por rol), nunca
                // a la landing pública — evita el header duplicado. Sin
                // sesión (por ejemplo en /auth), sigue yendo a la landing.
                onClick={() => navigate(isAuthenticated ? '/home' : '/')}
                className="cursor-pointer flex items-center gap-2 group transition-transform hover:scale-[1.02]"
              >
                <Logo size="md" showText={true} showTagline={false} variant="white" />
              </div>
            </div>

            {/* Middle: Compact High Density Nav Links (solo autenticado, filtrado por rol) */}
            {visibleNavLinks.length > 0 && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/50">
              {visibleNavLinks.map((link) => {
                const isActive = pathOnly === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 relative ${
                      isActive
                        ? 'bg-slate-900 text-teal-300 shadow-xs border border-teal-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                    }`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {link.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            )}

            {/* Right: Active Role, Demo Switcher & Quick Access */}
            <div className="hidden sm:flex items-center gap-2">
              <ThemeToggle variant="bar" />
              {!authReady ? null : isAuthenticated && currentUser ? (
                <>
                  <NotificationBell />
                  {DEMO_MODE ? (
                    <button
                      onClick={() => setIsSwitcherOpen(true)}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-teal-500/50 transition-all text-left group"
                      title={usingRemoteData ? 'Sesión Supabase' : 'Cambiar rol demo'}
                    >
                      {renderAvatar('w-6 h-6')}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-200 group-hover:text-teal-300 transition-colors">
                            {currentUser.name}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded border ${roleInfo.bg}`}
                          >
                            {roleInfo.label}
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-400 transition-colors ml-0.5" />
                    </button>
                  ) : (
                    <div
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/80"
                      title="Sesión Supabase"
                    >
                      {renderAvatar('w-6 h-6')}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-200">
                            {currentUser.name}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded border ${roleInfo.bg}`}
                          >
                            {roleInfo.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => void logout()}
                    disabled={authLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors"
                  >
                    Salir
                  </button>
                </>
              ) : null}
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center gap-1.5">
              <ThemeToggle variant="bar" />
              {authReady && isAuthenticated && currentUser && <NotificationBell />}
              {authReady && (DEMO_MODE ? (
                <button
                  onClick={() => setIsSwitcherOpen(true)}
                  className="px-2 py-1 text-xs font-bold rounded-md border border-teal-500/30 bg-teal-500/10 text-teal-300 flex items-center gap-1.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${roleInfo.dot}`} />
                  <span>{roleInfo.label}</span>
                </button>
              ) : (
                <span className="px-2 py-1 text-xs font-bold rounded-md border border-teal-500/30 bg-teal-500/10 text-teal-300 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${roleInfo.dot}`} />
                  <span>{roleInfo.label}</span>
                </span>
              ))}

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-[#0F172A] px-3 pt-2 pb-4 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
            <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700 flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {renderAvatar('w-7 h-7', 'text-xs')}
                <div>
                  <div className="text-xs font-semibold text-slate-200">{currentUser?.name ?? 'Invitado'}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{currentUser?.email || 'Sin sesión'}</div>
                </div>
              </div>
              {DEMO_MODE && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSwitcherOpen(true);
                  }}
                  className="text-[11px] font-semibold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded"
                >
                  Cambiar Rol
                </button>
              )}
            </div>

            {visibleNavLinks.length > 0 && (
            <div className="grid grid-cols-1 gap-1">
              {visibleNavLinks.map((link) => {
                const isActive = pathOnly === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => {
                      navigate(link.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-slate-800 text-teal-300 font-semibold border border-teal-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {link.icon}
                      <span>{link.label}</span>
                    </div>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-teal-500/20 text-teal-300">
                        {link.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {isAuthenticated && (
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  void logout();
                  setIsMobileMenuOpen(false);
                }}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg font-semibold text-xs disabled:opacity-60"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>
            )}
          </div>
        )}
      </header>

      {/* Role Switcher Modal (solo en modo demo) */}
      {DEMO_MODE && (
        <RoleSwitcherModal
          isOpen={isSwitcherOpen}
          onClose={() => setIsSwitcherOpen(false)}
        />
      )}
    </>
  );
};
