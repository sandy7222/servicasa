import { afterEach, describe, expect, it } from 'vitest';
import { getAyudanteEnabled, getPendingResponseMessage, setAyudanteEnabled } from './ayudanteTecnico';

const STORAGE_KEY = 'tecnicourbano_ayudante_enabled';

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage,
  });
}

describe('ayudanteTecnico', () => {
  afterEach(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* entorno sin storage */
    }
  });

  it('está activado por defecto y recuerda el toggle', () => {
    installMemoryStorage();
    expect(getAyudanteEnabled()).toBe(true);
    setAyudanteEnabled(false);
    expect(getAyudanteEnabled()).toBe(false);
    setAyudanteEnabled(true);
    expect(getAyudanteEnabled()).toBe(true);
  });

  it('arma el recordatorio solo si hay órdenes pendientes', () => {
    expect(getPendingResponseMessage(0)).toBeNull();
    expect(getPendingResponseMessage(1)).toMatch(/una orden/i);
    expect(getPendingResponseMessage(3)).toMatch(/3 órdenes/);
  });
});
