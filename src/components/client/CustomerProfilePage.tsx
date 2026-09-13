import React from 'react';
import { ArrowLeft, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomerProfilePanel } from './CustomerProfilePanel';

/** Página dedicada de "Mi Perfil" para el cliente — antes vivía apilada
 * arriba de todo en /customer, ahora se accede desde Ajustes (mismo patrón
 * que /technician/profile). Ver pedido de Sandy del 13/9. */
export const CustomerProfilePage: React.FC = () => {
  const { navigate } = useApp();

  return (
    <main className="min-h-screen bg-slate-100/70 dark:bg-slate-900/80 pb-12">
      <header className="border-b border-slate-800 bg-[#0F172A] text-white">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold">Mi Perfil</h1>
              <p className="text-xs text-slate-400">Tus datos de contacto y foto de cuenta.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/customer')}
            aria-label="Volver al portal del cliente"
            className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 pt-5">
        <CustomerProfilePanel />
      </div>
    </main>
  );
};
