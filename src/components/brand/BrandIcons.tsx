import React from 'react';

/**
 * Iconos propios de TecniUrbano (pedido de Sandy, 26/11/2026: nada genérico en la página).
 * Mismo idioma que el logo: trazo grueso con puntas rectas en el color de línea (currentColor)
 * y un detalle relleno en turquesa. Los rubros llevan la casita del logo como sello.
 * El color de línea se elige con la clase de texto (p. ej. `text-[#1f45b8] dark:text-[#7aa2ff]`).
 */

export const BRAND_TURQUOISE = '#22c3a6';

type IconProps = { className?: string; title?: string };

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({ className, title, children }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
    fill="none"
    stroke="currentColor"
    strokeWidth={3.6}
    strokeLinejoin="miter"
    strokeLinecap="square"
  >
    {children}
  </svg>
);

const House = () => <path d="M5 23 24 6l19 17M10 19v23h28V19" />;
const T = { fill: BRAND_TURQUOISE, stroke: 'none' } as const;

export const PlumbingIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <path {...T} d="M24 17.5c-1.5 2-8 10-8 15.2a8 8 0 0 0 16 0c0-5.2-6.5-13.2-8-15.2z" />
  </Svg>
);

export const ElectricityIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <path {...T} d="M27.5 17 16.5 32h7l-2.5 9.5L32 26.5h-7l2.5-9.5z" />
  </Svg>
);

export const RepairsIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <path d="M18 39l9.5-10.5" />
    <rect {...T} x="22.5" y="20.5" width="14" height="6.5" transform="rotate(42 29.5 23.75)" />
  </Svg>
);

export const MaintenanceIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <circle cx="24" cy="31" r="8.6" stroke={BRAND_TURQUOISE} strokeWidth={4} strokeDasharray="3.4 3.35" strokeLinecap="butt" />
    <circle cx="24" cy="31" r="4.6" stroke={BRAND_TURQUOISE} strokeWidth={3.6} />
  </Svg>
);

export const InstallationIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <rect {...T} x="19.5" y="20" width="3" height="6" />
    <rect {...T} x="25.5" y="20" width="3" height="6" />
    <rect {...T} x="17" y="25.5" width="14" height="9" rx="1.5" />
    <path d="M24 34.5v5" />
  </Svg>
);

export const GasIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <path {...T} d="M24 18c3 4 7 6.5 7 12a7 7 0 0 1-14 0c0-3 1.5-5 3-6.5.3 2.2 1.3 3.5 2.6 3.8C22 23.5 23 20.5 24 18z" />
  </Svg>
);

export const LocksmithIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <circle cx="18.5" cy="30" r="4.4" stroke={BRAND_TURQUOISE} strokeWidth={3.6} />
    <rect {...T} x="22.5" y="28.4" width="11" height="3.4" />
    <rect {...T} x="27.5" y="31" width="2.8" height="4" />
    <rect {...T} x="31" y="31" width="2.5" height="3" />
  </Svg>
);

export const CoolingIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <path d="M24 22.5v17M16.6 26.75l14.8 8.5M16.6 35.25l14.8-8.5" stroke={BRAND_TURQUOISE} strokeWidth={3} strokeLinecap="butt" />
    <circle cx="24" cy="31" r="2.6" {...T} />
  </Svg>
);

export const WeldingIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <House />
    <path {...T} d="M24 20.5l2.4 7.6 7.6 2.4-7.6 2.4L24 40.5l-2.4-7.6-7.6-2.4 7.6-2.4z" />
    <rect x="31" y="20.5" width="2.6" height="2.6" fill={BRAND_TURQUOISE} stroke="none" />
    <rect x="14.5" y="36" width="2.6" height="2.6" fill={BRAND_TURQUOISE} stroke="none" />
  </Svg>
);

export const TrackingIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M8 38c6-2 7-9 14-10s10-7 14-13" />
    <path {...T} d="M36 4a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7z" />
    <circle cx="36" cy="11" r="2.4" fill="currentColor" stroke="none" />
    <rect x="5" y="35" width="6" height="6" fill="currentColor" stroke="none" />
  </Svg>
);

export const GuaranteeIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M24 5 8 11v11c0 10 7 17 16 21 9-4 16-11 16-21V11z" />
    <path d="M16.5 24l5.5 5.5L32 19" stroke={BRAND_TURQUOISE} strokeWidth={4.4} />
  </Svg>
);

export const ClaimIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 8h36v24H20l-9 8v-8H6z" />
    <rect {...T} x="22" y="12" width="4.4" height="10" />
    <rect {...T} x="22" y="25" width="4.4" height="4" />
  </Svg>
);

export const SecurePaymentIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M15 21v-6a9 9 0 0 1 18 0v6" />
    <rect {...T} x="9" y="21" width="30" height="21" rx="2" />
    <rect x="22" y="27" width="4" height="8" fill="currentColor" stroke="none" />
  </Svg>
);

/** Icono propio de un rubro del catálogo: primero por el nombre de icono guardado, si no por el nombre del rubro. */
export function categoryBrandIcon(category: { name: string; icon?: string }): React.FC<IconProps> {
  const byKey: Record<string, React.FC<IconProps>> = {
    Wrench: PlumbingIcon,
    Droplets: PlumbingIcon,
    Zap: ElectricityIcon,
    Lightbulb: ElectricityIcon,
    Hammer: RepairsIcon,
    Settings: MaintenanceIcon,
    ShieldCheck: InstallationIcon,
    Sparkles: InstallationIcon,
    Flame: GasIcon,
  };
  const name = (category.name || '').toLowerCase();
  if (name.includes('plom') || name.includes('agua') || name.includes('cañ')) return PlumbingIcon;
  if (name.includes('elect') || name.includes('luz') || name.includes('tensión')) return ElectricityIcon;
  if (name.includes('gas')) return GasIcon;
  if (name.includes('cerraj') || name.includes('llave')) return LocksmithIcon;
  if (name.includes('refrig') || name.includes('aire') || name.includes('frío') || name.includes('frio')) return CoolingIcon;
  if (name.includes('sold')) return WeldingIcon;
  if (name.includes('repar') || name.includes('carpint') || name.includes('hogar')) return RepairsIcon;
  if (name.includes('manten') || name.includes('prevent')) return MaintenanceIcon;
  if (name.includes('instal') || name.includes('equipo')) return InstallationIcon;
  return (category.icon && byKey[category.icon]) || InstallationIcon;
}
