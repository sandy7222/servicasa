import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface LandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Modal accesible compartido: Escape para cerrar, foco atrapado, restaura el foco al elemento que lo abrió. */
export const LandingModal: React.FC<LandingModalProps> = ({
  isOpen,
  onClose,
  titleId,
  title,
  subtitle,
  children,
  maxWidthClassName = 'max-w-2xl',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    const focusable = card?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable && focusable[0] ? focusable[0] : card)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      const items = card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white rounded-2xl w-full ${maxWidthClassName} max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150 outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h2 id={titleId} className="text-xl font-black text-slate-900">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
