import type { ServiceType } from '../types';

export type FixedPriceService = {
  id: string;
  category: ServiceType;
  name: string;
  description: string;
  unit: string;
  unitPrice: number;
  /** Only fixed-price services may use the direct-payment flow. */
  fixedPrice: true;
};

export const VISIT_DEPOSIT_AMOUNT = 6000;
export const PLATFORM_COMMISSION_RATE = 0.17;

export const FIXED_PRICE_SERVICES: FixedPriceService[] = [
  { id: 'electricidad-tomacorriente', category: 'Electricidad', name: 'Cambio de tomacorriente', description: 'Reemplazo de un tomacorriente estándar.', unit: 'unidad', unitPrice: 8000, fixedPrice: true },
  { id: 'electricidad-termica', category: 'Electricidad', name: 'Cambio de llave térmica', description: 'Reemplazo de una llave térmica estándar.', unit: 'unidad', unitPrice: 12000, fixedPrice: true },
  { id: 'refrigeracion-limpieza-split', category: 'Refrigeración', name: 'Limpieza de split', description: 'Limpieza preventiva de una unidad interior.', unit: 'unidad', unitPrice: 20000, fixedPrice: true },
  { id: 'cerrajeria-apertura', category: 'Cerrajería', name: 'Apertura de puerta', description: 'Apertura de puerta sin cambio de cerradura.', unit: 'servicio', unitPrice: 12000, fixedPrice: true },
  { id: 'cerrajeria-cerradura', category: 'Cerrajería', name: 'Cambio de cerradura', description: 'Cambio de una cerradura estándar.', unit: 'unidad', unitPrice: 15000, fixedPrice: true },
  { id: 'soldadura-reja', category: 'Soldadura', name: 'Soldadura puntual de reja', description: 'Reparación puntual de una reja.', unit: 'servicio', unitPrice: 20000, fixedPrice: true },
];

export function getFixedPriceServices(category?: string) {
  if (!category) return FIXED_PRICE_SERVICES;
  return FIXED_PRICE_SERVICES.filter((service) => service.category.toLowerCase() === category.toLowerCase());
}

export function formatArs(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
}
