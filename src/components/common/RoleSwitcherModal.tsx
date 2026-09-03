import React from 'react';
import { Shield, Wrench, User, Check, X, RotateCcw } from 'lucide-react';
import { DEMO_USERS, useApp } from '../../context/AppContext';
import { CurrentUserData } from '../../types';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser, navigate, resetDemoData } = useApp();

  if (!isOpen) return null;

  const handleSelectUser = (user: CurrentUserData) => {
    setCurrentUser(user);
    if (user.role === 'admin') navigate('/hub');
    else if (user.role === 'technician') navigate('/technician');
    else navigate('/customer');
    onClose();
  };

  const usersList = Object.values(DEMO_USERS);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      id="role-switcher-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-4 shadow-xl border border-slate-200 dark:border-slate-700 relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        id="role-switcher-modal-card"
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono uppercase tracking-wider">Simulador de Usuarios</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cambiá de perfil en tiempo real para probar el ciclo completo de TecniUrbano
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User items */}
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {usersList.map((u) => {
            const isSelected = currentUser?.id === u.id;

            const getRoleLabel = () => {
              if (u.role === 'admin') return 'Admin General';
              if (u.role === 'technician') return 'Técnico Campo';
              return 'Cliente Demo';
            };

            const getBadgeBg = () => {
              if (u.role === 'admin') return 'bg-slate-900 text-teal-300 border-slate-800';
              if (u.role === 'technician') return 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 border-teal-200 dark:border-teal-800';
              return 'bg-sky-50 text-sky-700 border-sky-200';
            };

            return (
              <div
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-slate-700 font-mono">
                    {u.avatarText}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{u.name}</span>
                      <span
                        className={`text-[9px] uppercase font-bold font-mono px-1.5 py-0.2 rounded border ${getBadgeBg()}`}
                      >
                        {getRoleLabel()}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{u.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {isSelected ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold font-mono text-teal-700 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                      <Check className="w-3 h-3" />
                      Activo
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-mono">
                      Cambiar →
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              resetDemoData();
              onClose();
            }}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-rose-600 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reiniciar demo
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-md transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
