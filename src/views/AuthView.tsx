import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Wrench,
  User,
  ArrowRight,
  Lock,
  Info,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEMO_CREDENTIALS } from '../lib/supabaseData';
import { DEMO_MODE } from '../lib/featureFlags';
import { isSupabaseConfigured } from '../lib/supabase';
import { friendlyErrorMessage } from '../components/common/AppStatus';
import { fetchAccountInvite, type AccountInvitePreview } from '../lib/supabaseMutations';

function readInviteToken() {
  const hash = window.location.hash.replace(/^#/, '');
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('invite');
}

export const AuthView: React.FC = () => {
  const { loginWithPassword, registerWithInvite, authLoading, showToast } = useApp();
  const inviteToken = useMemo(() => readInviteToken(), []);
  const [invite, setInvite] = useState<AccountInvitePreview | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [email, setEmail] = useState('admin@tecniurbano.com.ar');
  const [password, setPassword] = useState('TecniUrbano2026!');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    setInviteLoading(true);
    fetchAccountInvite(inviteToken)
      .then((preview) => {
        if (cancelled) return;
        if (!preview) {
          setInviteError('El enlace de invitación no es válido.');
          return;
        }
        if (preview.alreadyUsed) {
          setInviteError('Esta invitación ya fue utilizada. Ingresá con tu cuenta.');
          return;
        }
        if (new Date(preview.expiresAt).getTime() < Date.now()) {
          setInviteError('Esta invitación venció. Pedile una nueva al administrador.');
          return;
        }
        setInvite(preview);
        setEmail(preview.email);
        setPassword('');
      })
      .catch((err) => {
        if (!cancelled) setInviteError(friendlyErrorMessage(err, 'No se pudo leer la invitación'));
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Faltan variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local');
      return;
    }
    try {
      await loginWithPassword(email, password);
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo iniciar sesión');
      setError(message);
      showToast(message, 'error', 'Error de acceso');
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!inviteToken) return;
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      await registerWithInvite({ token: inviteToken, password });
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo crear la cuenta');
      setError(message);
      showToast(message, 'error', 'No se pudo registrar');
    }
  };

  const inviteMode = Boolean(inviteToken) && !inviteError;
  const roleLabel = invite?.kind === 'technician' ? 'técnico' : 'cliente';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8" id="tecniurbano-auth-view">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            {inviteMode ? 'Creá tu cuenta' : 'Iniciá sesión'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {inviteMode
              ? `Te invitaron como ${roleLabel}. Elegí una contraseña para vincular tu ficha.`
              : 'Ingresá con tu cuenta de Supabase Auth (email y contraseña).'}
          </p>
        </div>

        {inviteLoading && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 text-center text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
            Validando invitación…
          </div>
        )}

        {inviteError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs mb-4">
            {inviteError}
          </div>
        )}

        {!inviteLoading && (
        <form
          onSubmit={inviteMode ? handleRegister : handleLogin}
          className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-4"
        >
          {invite && (
            <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-900">
              Hola <strong>{invite.fullName}</strong>. Vas a entrar como {roleLabel} con los datos
              que ya cargó administración.
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 font-mono uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={authLoading || inviteMode}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 disabled:bg-slate-50 disabled:opacity-70"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 font-mono uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoComplete={inviteMode ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={authLoading}
                placeholder={inviteMode ? 'Mínimo 8 caracteres' : undefined}
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 disabled:bg-slate-50 disabled:opacity-70"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading || (Boolean(inviteToken) && !invite && !inviteError)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-lg shadow-sm transition-all"
          >
            {authLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {inviteMode ? 'Creando cuenta…' : 'Ingresando…'}
              </>
            ) : inviteMode ? (
              <>
                Crear cuenta y entrar
                <ArrowRight className="w-4 h-4 text-teal-400" />
              </>
            ) : (
              <>
                Ingresar
                <ArrowRight className="w-4 h-4 text-teal-400" />
              </>
            )}
          </button>

          {!inviteMode && DEMO_MODE && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
              Cuentas de prueba
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_CREDENTIALS.map((cred) => {
                const Icon = cred.role === 'admin' ? Shield : cred.role === 'technician' ? Wrench : User;
                return (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => {
                      setEmail(cred.email);
                      setPassword(cred.password);
                      setError(null);
                    }}
                    className="flex items-center gap-2 text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs"
                  >
                    <Icon className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span className="font-semibold text-slate-800">{cred.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-500">{cred.email}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Info className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            {inviteMode
              ? 'El enlace vence a los 14 días y solo sirve para este email.'
              : 'Contraseña de prueba: TecniUrbano2026!'}
          </span>
        </div>
      </div>
    </div>
  );
};
