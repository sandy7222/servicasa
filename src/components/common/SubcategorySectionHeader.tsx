import React from 'react';
import { ChevronDown } from 'lucide-react';

type Props = {
  name: string;
  count: number;
  ungrouped?: boolean;
  compact?: boolean;
  sticky?: boolean;
  collapsed?: boolean;
  accentBarClass?: string;
  onToggle?: () => void;
};

export const SubcategorySectionHeader: React.FC<Props> = ({
  name,
  count,
  ungrouped = false,
  compact = false,
  sticky = false,
  collapsed = false,
  accentBarClass = 'bg-teal-500',
  onToggle,
}) => {
  const countLabel = `${count} servicio${count !== 1 ? 's' : ''}`;
  const className = [
    'flex w-full items-center gap-2 text-left',
    compact ? 'py-1.5 pr-1' : 'py-2 pr-1',
    sticky ? 'sticky top-0 z-10 bg-white/95 backdrop-blur-sm' : '',
    onToggle ? 'rounded-lg hover:bg-slate-50/80 transition-colors cursor-pointer' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <span
        className={`w-1 shrink-0 self-stretch rounded-full ${ungrouped ? 'bg-slate-300' : accentBarClass}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span
          className={
            ungrouped
              ? `${compact ? 'text-xs' : 'text-sm'} font-semibold italic text-slate-500`
              : `${compact ? 'text-xs font-bold text-slate-800' : 'text-sm font-bold text-slate-900'}`
          }
        >
          {name}
        </span>
        <span
          title={countLabel}
          className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
            ungrouped
              ? 'bg-slate-50 text-slate-500 border-slate-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {count}
        </span>
      </div>
      {onToggle && (
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          aria-hidden
        />
      )}
    </>
  );

  if (onToggle) {
    return (
      <button type="button" className={className} onClick={onToggle} aria-expanded={!collapsed}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
};
