import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useApp();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-teal-500 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-200 bg-white text-emerald-950',
    error: 'border-rose-200 bg-white text-rose-950',
    warning: 'border-amber-200 bg-white text-amber-950',
    info: 'border-teal-200 bg-white text-slate-900',
  };

  return (
    <div
      className="fixed bottom-5 right-5 z-50 max-w-md w-full sm:w-auto animate-in slide-in-from-bottom-4 duration-200"
      id="global-toast-alert"
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${
          borderColors[toast.type] || borderColors.info
        }`}
      >
        {icons[toast.type] || icons.info}
        <div className="flex-1 pr-2">
          {toast.title && (
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-0.5">
              {toast.title}
            </h4>
          )}
          <p className="text-xs sm:text-sm font-medium text-slate-700 whitespace-pre-line leading-snug">
            {toast.message}
          </p>
        </div>
        <button
          onClick={hideToast}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          title="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
