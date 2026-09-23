const STORAGE_KEY = 'tecnicourbano_ayudante_enabled';

export function getAyudanteEnabled(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === null) return true;
    return value !== 'false';
  } catch {
    return true;
  }
}

export function setAyudanteEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* private mode */
  }
}

export function getPendingResponseMessage(pendingCount: number): string | null {
  if (pendingCount <= 0) return null;
  if (pendingCount === 1) {
    return 'Tenés una orden esperando que la aceptes o la rechaces.';
  }
  return `Tenés ${pendingCount} órdenes esperando que las aceptes o las rechaces.`;
}
