import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Wrench,
  User,
  ArrowRight,
  Lock,
  Info,
  Loader2,
  Mail,
  Phone,
  MapPin,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEMO_CREDENTIALS } from '../lib/supabaseData';
import { DEMO_MODE } from '../lib/featureFlags';
import { isSupabaseConfigured } from '../lib/supabase';
import { friendlyErrorMessage } from '../components/common/AppStatus';
import { fetchAccountInvite, type AccountInvitePreview } from '../lib/supabaseMutations';
import { GuestServiceRequestForm } from '../components/client/GuestServiceRequestForm';

function readInviteToken() {
  const hash = window.location.hash.replace(/^#/, '');
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('invite');
}

type AuthMode = 'login' | 'register' | 'apply' | 'guest';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 disabled:bg-slate-50 disabled:opacity-70';
const inputWithIconClass =
  'w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 disabled:bg-slate-50 disabled:opacity-70';
const labelClass = 'block text-xs font-bold text-slate-700 font-mono uppercase tracking-wider mb-1.5';

export const AuthView: React.FC = () => {
  const { loginWithPassword, registerWithInvite, registerCustomer, submitTechnicianApplication, authLoading, showToast } =
    useApp();
  const inviteToken = useMemo(() => readInviteToken(), []);
  const [invite, setInvite] = useState<AccountInvitePreview | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Set by ServicesCategoryView when a logged-out visitor picks a service —
  // read once up front, before GuestServiceRequestForm's own effect clears
  // it. Landing here with real purchase intent: skip the mode tabs entirely
  // and go straight to the guest checkout form, no login/register/technician
  // detour. The general /auth entry point (header link, direct visit) is
  // unaffected — this only fires for this one specific referrer.
  const [orderIntent] = useState(() => Boolean(localStorage.getItem('tecniurbano_selectedServiceId')));

  const [mode, setMode] = useState<AuthMode>(orderIntent ? 'guest' : 'login');
  const [error, setError] = useState<string | null>(null);

  // Login
  const [email, setEmail] = useState(DEMO_MODE ? 'admin@tecniurbano.com.ar' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'TecniUrbano2026!' : '');

  // Invite (existing account activation)
  const [invitePassword, setInvitePassword] = useState('');

  // Customer self-registration
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState('');
  const [registerSubmitted, setRegisterSubmitted] = useState(false);

  // "Quiero ser técnico" application
  const [appFullName, setAppFullName] = useState('');
  const [appEmail, setAppEmail] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appSpecialty, setAppSpecialty] = useState('');
  const [appMessage, setAppMessage] = useState('');
  const [applySubmitted, setApplySubmitted] = useState(false);

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

  const handleRegisterInvite = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!inviteToken) return;
    if (invitePassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      await registerWithInvite({ token: inviteToken, password: invitePassword });
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo crear la cuenta');
      setError(message);
      showToast(message, 'error', 'No se pudo registrar');
    }
  };

  const handleRegisterCustomer = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!regFullName.trim() || !regEmail.trim() || !regPhone.trim() || !regAddress.trim() || !regNeighborhood.trim()) {
      setError('Completá todos los campos.');
      return;
    }
    if (regPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      await registerCustomer({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        phone: regPhone,
        address: regAddress,
        neighborhood: regNeighborhood,
      });
      setRegisterSubmitted(true);
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo crear la cuenta');
      setError(message);
      showToast(message, 'error', 'No se pudo registrar');
    }
  };

  const handleApplyTechnician = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!appFullName.trim() || !appEmail.trim() || !appPhone.trim() || !appSpecialty.trim()) {
      setError('Completá nombre, email, teléfono y especialidad.');
      return;
    }
    try {
      await submitTechnicianApplication({
        fullName: appFullName,
        email: appEmail,
        phone: appPhone,
        specialty: appSpecialty,
        message: appMessage.trim() || undefined,
      });
      setApplySubmitted(true);
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo enviar la solicitud');
      setError(message);
      showToast(message, 'error', 'No se pudo enviar');
    }
  };

  const inviteMode = Boolean(inviteToken) && !inviteError;
  const roleLabel = invite?.kind === 'technician' ? 'técnico' : 'cliente';

  const headerTitle = inviteMode
    ? 'Creá tu cuenta'
    : orderIntent
      ? 'Completá tu pedido'
      : mode === 'login'
        ? 'Iniciá sesión'
        : mode === 'register'
          ? 'Creá tu cuenta de cliente'
          : mode === 'guest'
            ? 'Pedí un servicio sin cuenta'
            : 'Quiero ser técnico';

  const headerSubtitle = inviteMode
    ? `Te invitaron como ${roleLabel}. Elegí una contraseña para vincular tu ficha.`
    : orderIntent
      ? 'Completá tus datos y pagá — después te invitamos a crear tu cuenta.'
      : mode === 'login'
        ? 'Ingresá con tu cuenta de Supabase Auth (email y contraseña).'
        : mode === 'register'
          ? 'Registrate como cliente para pedir servicios en minutos.'
          : mode === 'guest'
            ? 'Completá el pedido y pagá — después te invitamos a crear tu cuenta.'
            : 'Contanos de vos. El equipo revisa tu solicitud y te contacta si sos seleccionado.';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8" id="tecniurbano-auth-view">
      <div className={`w-full mx-auto ${mode === 'guest' && !inviteMode ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="text-center mb-6">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">{headerTitle}</h2>
          <p className="text-xs text-slate-500 mt-1">{headerSubtitle}</p>
        </div>

        {!inviteMode && !inviteLoading && !orderIntent && (
          <div className="grid grid-cols-4 gap-1.5 mb-5 bg-slate-100 rounded-lg p-1">
            {([
              ['login', 'Ingresar'],
              ['register', 'Crear cuenta'],
              ['guest', 'Sin cuenta'],
              ['apply', 'Ser técnico'],
            ] as [AuthMode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`px-2 py-2 rounded-md text-[11px] sm:text-xs font-bold transition-all ${
                  mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

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

        {!inviteLoading && inviteMode && (
          <form
            onSubmit={handleRegisterInvite}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-4"
          >
            {invite && (
              <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-900">
                Hola <strong>{invite.fullName}</strong>. Vas a entrar como {roleLabel} con los datos que ya cargó
                administración.
              </div>
            )}

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={invite?.email ?? ''} disabled className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Contraseña</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  disabled={authLoading}
                  placeholder="Mínimo 8 caracteres"
                  className={inputWithIconClass}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={authLoading || !invite}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-lg shadow-sm transition-all"
            >
              {authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando cuenta…
                </>
              ) : (
                <>
                  Crear cuenta y entrar
                  <ArrowRight className="w-4 h-4 text-teal-400" />
                </>
              )}
            </button>
          </form>
        )}

        {!inviteLoading && !inviteMode && mode === 'login' && (
          <form
            onSubmit={handleLogin}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-4"
          >
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={authLoading}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Contraseña</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={authLoading}
                  className={inputWithIconClass}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-lg shadow-sm transition-all"
            >
              {authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4 text-teal-400" />
                </>
              )}
            </button>

            {DEMO_MODE && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">Cuentas de prueba</p>
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

        {!inviteLoading && !inviteMode && mode === 'register' && (
          registerSubmitted ? (
            <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
              <p className="text-sm font-bold text-slate-900">¡Listo! Revisá tu email</p>
              <p className="text-xs text-slate-500">
                Te enviamos un correo para confirmar la cuenta. Después ingresá desde la pestaña "Ingresar".
              </p>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs font-bold text-teal-700 hover:underline"
              >
                Ir a Ingresar
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleRegisterCustomer}
              className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-4"
            >
              <div>
                <label className={labelClass}>Nombre completo</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    disabled={authLoading}
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    autoComplete="username"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    disabled={authLoading}
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Teléfono</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    disabled={authLoading}
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Dirección</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      disabled={authLoading}
                      className={inputWithIconClass}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Barrio</label>
                  <input
                    type="text"
                    value={regNeighborhood}
                    onChange={(e) => setRegNeighborhood(e.target.value)}
                    disabled={authLoading}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Contraseña</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={authLoading}
                    placeholder="Mínimo 8 caracteres"
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-lg shadow-sm transition-all"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando cuenta…
                  </>
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                  </>
                )}
              </button>
            </form>
          )
        )}

        {!inviteLoading && !inviteMode && mode === 'apply' && (
          applySubmitted ? (
            <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
              <p className="text-sm font-bold text-slate-900">¡Solicitud enviada!</p>
              <p className="text-xs text-slate-500">
                El equipo va a revisar tus datos. Si sos seleccionado, te van a contactar para darte de alta.
              </p>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs font-bold text-teal-700 hover:underline"
              >
                Ir a Ingresar
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleApplyTechnician}
              className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-4"
            >
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 flex items-start gap-2">
                <ClipboardList className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                Esto no crea una cuenta. Es una solicitud que revisa el equipo antes de darte acceso.
              </div>

              <div>
                <label className={labelClass}>Nombre completo</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={appFullName}
                    onChange={(e) => setAppFullName(e.target.value)}
                    disabled={authLoading}
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={appEmail}
                    onChange={(e) => setAppEmail(e.target.value)}
                    disabled={authLoading}
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Teléfono</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={appPhone}
                    onChange={(e) => setAppPhone(e.target.value)}
                    disabled={authLoading}
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Especialidad</label>
                <div className="relative">
                  <Wrench className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={appSpecialty}
                    onChange={(e) => setAppSpecialty(e.target.value)}
                    disabled={authLoading}
                    placeholder="Ej: Plomería, Electricidad…"
                    className={inputWithIconClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Mensaje (opcional)</label>
                <textarea
                  value={appMessage}
                  onChange={(e) => setAppMessage(e.target.value)}
                  disabled={authLoading}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Contanos tu experiencia, zona de trabajo, disponibilidad…"
                />
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-lg shadow-sm transition-all"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    Enviar solicitud
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                  </>
                )}
              </button>
            </form>
          )
        )}

        {!inviteLoading && !inviteMode && mode === 'guest' && <GuestServiceRequestForm />}

        {(inviteMode || (DEMO_MODE && !inviteMode && mode === 'login')) && (
          <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Info className="w-4 h-4 text-teal-600 shrink-0" />
            <span>
              {inviteMode
                ? 'El enlace vence a los 14 días y solo sirve para este email.'
                : 'Contraseña de prueba: TecniUrbano2026!'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
