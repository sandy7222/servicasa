import React from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MyClaimsPanel } from '../common/MyClaimsPanel';

export const TechnicianClaimsView: React.FC = () => {
  const { navigate } = useApp();

  return (
    <main className="min-h-screen bg-slate-100/70 pb-12">
      <header className="border-b border-slate-800 bg-[#0F172A] text-white">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-400/15 text-rose-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold">Reclamos y garantías</h1>
              <p className="text-xs text-slate-400">Casos asociados a tus trabajos y su comunicación.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/technician')}
            aria-label="Volver a la Terminal de Campo"
            className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-5">
        <MyClaimsPanel onOpen={(claimId) => (window.location.hash = `#/technician/reclamos/${claimId}`)} />
      </div>
    </main>
  );
};
