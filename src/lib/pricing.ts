export const VISIT_DEPOSIT_AMOUNT = 6000;
export const PLATFORM_COMMISSION_RATE = 0.17;

export function formatArs(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
}
