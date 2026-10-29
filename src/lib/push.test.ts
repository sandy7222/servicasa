import { describe, expect, it } from 'vitest';
import { detectPushSupport, isIOS, urlBase64ToUint8Array } from './push';

const base = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120', standalone: false, hasServiceWorker: true, hasPushManager: true, hasNotification: true };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1';

describe('detectPushSupport', () => {
  it('Android o escritorio con soporte completo: se puede', () => {
    expect(detectPushSupport(base)).toBe('supported');
  });
  it('iPhone en Safari sin instalar: hay que instalar la app primero', () => {
    expect(detectPushSupport({ ...base, userAgent: IPHONE, hasPushManager: false })).toBe('needs-install');
  });
  it('iPhone con la app instalada: se puede', () => {
    expect(detectPushSupport({ ...base, userAgent: IPHONE, standalone: true })).toBe('supported');
  });
  it('iPad que se presenta como Mac también cuenta como iOS', () => {
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });
  it('navegador sin service worker o sin Push: no soportado', () => {
    expect(detectPushSupport({ ...base, hasPushManager: false })).toBe('unsupported');
    expect(detectPushSupport({ ...base, hasServiceWorker: false })).toBe('unsupported');
    expect(detectPushSupport({ ...base, hasNotification: false })).toBe('unsupported');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('convierte base64url (con - y _, sin relleno) en bytes', () => {
    // "hola?>" en base64url sin relleno
    const bytes = urlBase64ToUint8Array('aG9sYT8-');
    expect(Array.from(bytes)).toEqual([104, 111, 108, 97, 63, 62]);
  });
  it('una clave VAPID pública (65 bytes) se decodifica entera', () => {
    const key = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});
