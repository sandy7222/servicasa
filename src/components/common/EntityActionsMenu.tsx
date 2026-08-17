import React, { useEffect, useRef, useState } from 'react';
import { Link2, MoreVertical, Pencil, Trash2 } from 'lucide-react';

export type EntityActionItem = {
  id: string;
  label: string;
  icon: 'edit' | 'delete' | 'invite';
  disabled?: boolean;
  hint?: string;
  onSelect: () => void;
};

export const EntityActionsMenu: React.FC<{ items: EntityActionItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs"
        aria-label="Más acciones"
        aria-expanded={open}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-30 w-52 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          {items.map((item) => {
            const Icon = item.icon === 'edit' ? Pencil : item.icon === 'delete' ? Trash2 : Link2;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                title={item.hint}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold ${
                  item.disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : item.icon === 'delete'
                      ? 'text-rose-700 hover:bg-rose-50'
                      : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
