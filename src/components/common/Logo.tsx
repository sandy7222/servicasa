import React from 'react';
import logoServicasa from '../../assets/logo-servicasa.png';

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

/** Marca oficial (PNG). El archivo ya incluye el wordmark ServiCasa. */
export const LogoEmblem: React.FC<{
  className?: string;
  size?: number;
  variant?: 'light' | 'dark' | 'white';
}> = ({ className = 'w-10 h-10', size = 48, variant = 'light' }) => {
  // El PNG es azul con fondo transparente. Sobre fondos oscuros lo pasamos a
  // blanco (monocromo) para que tenga contraste; sobre fondos claros se mantiene azul.
  const filterClass = variant === 'white' ? 'brightness-0 invert' : '';
  return (
    <img
      src={logoServicasa}
      alt="ServiCasa"
      width={size}
      height={size}
      className={`object-contain rounded-md ${filterClass} ${className}`}
      id="servicasa-logo-emblem"
      draggable={false}
    />
  );
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
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

  if (layout === 'vertical') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center text-center select-none ${className}`}
        id="servicasa-brand-logo-vertical"
      >
        <div className="shrink-0 transition-transform duration-200 hover:scale-105 mb-1.5">
          <LogoEmblem className={current.className} size={current.px} variant={variant} />
        </div>
        {tagline}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}
      id="servicasa-brand-logo"
    >
      <div className="shrink-0 transition-transform duration-200 hover:scale-105">
        <LogoEmblem className={current.className} size={current.px} variant={variant} />
      </div>
      {tagline ? <div className="flex flex-col justify-center leading-none">{tagline}</div> : null}
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
      id="servicasa-official-badge"
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
