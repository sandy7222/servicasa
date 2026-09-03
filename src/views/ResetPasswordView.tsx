import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyErrorMessage } from '../components/common/AppStatus';

/**
 * Se muestra en vez de cualquier otra pantalla cuando AppContext detecta el
 * evento PASSWORD_RECOVERY de Supabase (llegó desde el link del mail de
 * "olvidé mi contraseña"). No hay ruta propia — el gate vive en App.tsx.
 */
export const ResetPasswordView: React.FC = () => {
  const { completePasswordRecovery, authLoading } = useApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    try {
      await completePasswordRecovery(password);
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo actualizar la contraseña.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-700 flex items-center justify-center">
            <KeyRound className="w-4.5 h-4.5" />
          </span>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Elegí tu nueva contraseña</h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Vas a tener que iniciar sesión de nuevo después de guardarla.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-mono uppercase tracking-wider mb-1.5">
              Contraseña nueva
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={authLoading}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:opacity-70"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-mono uppercase tracking-wider mb-1.5">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={authLoading}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:opacity-70"
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={authLoading}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};
