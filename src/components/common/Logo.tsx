import React from 'react';
import logoTecniUrbano from '../../assets/logo-tecniurbano.png';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  showTagline?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
  variant?: 'light' | 'dark' | 'white';
}

const SIZE_MAP = {
  xs: { px: 28, className: 'w-7 h-7' },
  sm: { px: 36, className: 'w-9 h-9' },
  md: { px: 48, className: 'w-12 h-12' },
  lg: { px: 72, className: 'w-[4.5rem] h-[4.5rem]' },
  xl: { px: 112, className: 'w-28 h-28' },
  '2xl': { px: 160, className: 'w-36 h-36 sm:w-40 sm:h-40' },
} as const;

const TAGLINE_SIZES = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-base',
  '2xl': 'text-lg',
} as const;

/** Marca oficial (PNG). El archivo ya incluye el wordmark TecniUrbano. */
export const LogoEmblem: React.FC<{
  className?: string;
  size?: number;
  variant?: 'light' | 'dark' | 'white';
}> = ({ className = 'w-10 h-10', size = 48, variant = 'light' }) => {
  // En tamaños compactos se recorta el wordmark incorporado para priorizar
  // el símbolo, que conserva legibilidad en la barra superior.
  const filterClass = '';
  return (
    <span
      className={`relative block overflow-hidden rounded-md bg-black ${className}`}
      id="tecniurbano-logo-emblem"
      aria-hidden="true"
    >
      <img
        src={logoTecniUrbano}
        alt=""
        width={size}
        height={size}
        className={`absolute inset-0 h-full w-full scale-[1.55] object-cover object-[center_35%] ${filterClass}`}
        draggable={false}
      />
    </span>
  );
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  showTagline = false,
  layout = 'horizontal',
  className = '',
  variant = 'light',
}) => {
  const current = SIZE_MAP[size];

  const taglineColor =
    variant === 'white' ? 'text-slate-300' : 'text-slate-500';

  const tagline = showTagline ? (
    <span className={`font-semibold tracking-wide ${TAGLINE_SIZES[size]} ${taglineColor}`}>
      Servicios a domicilio
    </span>
  ) : null;

  const name = showText ? (
    <span className={`font-black tracking-tight leading-none ${size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-base'} ${variant === 'white' ? 'text-white' : 'text-[#083b92]'}`}>
      Tecni<span className="text-teal-400">Urbano</span>
    </span>
  ) : null;

  if (layout === 'vertical') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center text-center select-none ${className}`}
        id="tecniurbano-brand-logo-vertical"
      >
        <div className="shrink-0 transition-transform duration-200 hover:scale-105 mb-1.5">
          <LogoEmblem className={current.className} size={current.px} variant={variant} />
        </div>
        {name}
        {tagline}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}
      id="tecniurbano-brand-logo"
    >
      <div className="shrink-0 transition-transform duration-200 hover:scale-105">
        <LogoEmblem className={current.className} size={current.px} variant={variant} />
      </div>
      {(name || tagline) ? <div className="flex flex-col justify-center gap-1 leading-none">{name}{tagline}</div> : null}
    </div>
  );
};

export const LogoBadge: React.FC<{
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'white';
}> = ({ className = '', size = 'md', variant = 'light' }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-2xl ${className}`}
      id="tecniurbano-official-badge"
    >
      <Logo
        size={size === 'sm' ? 'md' : size === 'md' ? 'xl' : '2xl'}
        layout="vertical"
        showTagline={true}
        variant={variant}
      />
    </div>
  );
};
