/**
 * Avisos push al celular (plan-notificaciones-push.md, Fase 1).
 * Funciones del navegador para suscribirse. El envío lo hace el servidor.
 */
import { supabase } from './supabase';

export type PushSupport =
  /** El navegador no puede recibir avisos push. */
  | 'unsupported'
  /** iPhone/iPad en Safari sin instalar: los avisos solo funcionan con la app instalada. */
  | 'needs-install'
  | 'supported';

type Env = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
};

export function readEnv(): Env {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : undefined;
  const standalone =
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true) || nav?.standalone === true;
  return {
    userAgent: nav?.userAgent ?? '',
    platform: nav?.platform,
    maxTouchPoints: nav?.maxTouchPoints,
    standalone,
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    hasNotification: typeof window !== 'undefined' && 'Notification' in window,
  };
}

/** iPhone, iPad (incluido el iPad que se presenta como Mac) o iPod. */
export function isIOS(env: Pick<Env, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  if (/iphone|ipad|ipod/i.test(env.userAgent)) return true;
  return env.platform === 'MacIntel' && (env.maxTouchPoints ?? 0) > 1;
}

export function detectPushSupport(env: Env = readEnv()): PushSupport {
  // En iOS el navegador normal no expone push: solo la web instalada en la pantalla de inicio (iOS 16.4+).
  if (isIOS(env) && !env.standalone) return 'needs-install';
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported';
  return 'supported';
}

/** La clave pública VAPID viaja en base64url; el navegador la pide como bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export type PushPermission = 'default' | 'granted' | 'denied';

export function getPermission(): PushPermission {
  return typeof Notification === 'undefined' ? 'default' : (Notification.permission as PushPermission);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function isSubscribed(): Promise<boolean> {
  try {
    return (await currentSubscription()) !== null;
  } catch {
    return false;
  }
}

/** Pide permiso (hay que llamarla desde un click), suscribe el dispositivo y lo guarda para el usuario actual. */
export async function enablePush(): Promise<void> {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!publicKey) throw new Error('Los avisos todavía no están configurados.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('No diste permiso para recibir avisos. Podés activarlo desde los ajustes del navegador.');
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));
  const json = subscription.toJSON();
  const { endpoint, keys } = json;
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('No se pudo crear la suscripción de avisos.');
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error('No se pudo guardar la suscripción de avisos.');
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await supabase.rpc('remove_push_subscription', { p_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
