import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  getNotificationLink,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../lib/notifications';
import type { AppNotification } from '../../types';

const POLL_MS = 30000;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export const NotificationBell: React.FC = () => {
  const { currentUser, isAuthenticated, navigate } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    let cancelled = false;
    const tick = () => {
      fetchUnreadNotificationCount()
        .then((count) => { if (!cancelled) setUnreadCount(count); })
        .catch(() => {});
    };
    tick();
    const interval = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchNotifications(20)
      .then((rows) => { if (!cancelled) { setItems(rows); setLoaded(true); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!isAuthenticated || !currentUser) return null;

  const handleOpenNotification = async (n: AppNotification) => {
    if (!n.readAt) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, readAt: new Date().toISOString() } : it)));
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    const link = getNotificationLink(n, currentUser.role);
    setIsOpen(false);
    if (link) navigate(link);
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => {});
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative p-1.5 text-slate-300 hover:text-teal-300 rounded-md hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
              >
                <Check className="w-3 h-3" /> Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">No tenés notificaciones.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => void handleOpenNotification(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-2 ${
                    !n.readAt ? 'bg-teal-50/50' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      !n.readAt ? (n.priority === 'high' ? 'bg-rose-500' : 'bg-teal-500') : 'bg-transparent'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs ${!n.readAt ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                      {n.title}
                    </div>
                    {n.body && <div className="text-[11px] text-slate-500 truncate mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{relativeTime(n.createdAt)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
