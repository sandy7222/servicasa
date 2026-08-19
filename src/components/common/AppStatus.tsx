import React from 'react';
import { AlertTriangle, Loader2, RefreshCw, WifiOff } from 'lucide-react';

export const FullPageLoader: React.FC<{ message?: string }> = ({
  message = 'Cargando…',
}) => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
    <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
    <p className="text-sm font-medium text-slate-600">{message}</p>
    <p className="text-[11px] font-mono text-slate-400">TecniUrbano · Supabase</p>
  </div>
);

export const InlineBusyBar: React.FC<{ active: boolean; label?: string }> = ({
  active,
  label = 'Guardando en Supabase…',
}) => {
  if (!active) return null;
  return (
    <div className="fixed top-14 inset-x-0 z-50 pointer-events-none">
      <div className="h-0.5 w-full bg-teal-500/20 overflow-hidden">
        <div className="h-full w-1/3 bg-teal-400 animate-pulse" />
      </div>
      <div className="mx-auto max-w-7xl px-3 sm:px-5">
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-slate-900/90 text-teal-200 text-[10px] font-mono px-2 py-1 border border-teal-500/30 shadow-sm">
          <Loader2 className="w-3 h-3 animate-spin" />
          {label}
        </div>
      </div>
    </div>
  );
};

export const DataErrorBanner: React.FC<{
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}> = ({ message, onRetry, retrying }) => (
  <div className="mx-auto max-w-7xl px-3 sm:px-5 lg:px-6 pt-3">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider font-mono text-amber-800">
            Problema de conexión
          </p>
          <p className="text-sm text-amber-900/90 break-words">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-900 text-amber-50 text-xs font-semibold px-3 py-2 disabled:opacity-60"
        >
          {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Reintentar
        </button>
      )}
    </div>
  </div>
);

export const ConfigMissingBanner: React.FC = () => (
  <div className="mx-auto max-w-md px-4">
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center space-y-2 shadow-sm">
      <WifiOff className="w-6 h-6 text-slate-400 mx-auto" />
      <p className="text-sm font-bold text-slate-800">Supabase no configurado</p>
      <p className="text-xs text-slate-500">
        Faltan <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> en{' '}
        <code className="font-mono">.env.local</code>.
      </p>
    </div>
  </div>
);

export function friendlyErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message || fallback;
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'La cuenta aún no confirmó el email.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch')) {
    return 'Sin conexión con Supabase. Revisá internet o el estado del proyecto.';
  }
  if (lower.includes('jwt') || lower.includes('session')) {
    return 'La sesión expiró. Volvé a iniciar sesión.';
  }
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('permission')) {
    return 'No tenés permiso para esta acción (RLS).';
  }
  return msg;
}
