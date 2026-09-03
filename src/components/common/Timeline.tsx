import React from 'react';
import {
  CheckCircle2,
  Clock,
  FileSignature,
  FileText,
  Package,
  Pause,
  Play,
  UserCheck,
  XCircle,
  ListTodo,
} from 'lucide-react';
import { OrderEvent, OrderEventType } from '../../types';

export const Timeline: React.FC<{ events: OrderEvent[] }> = ({ events }) => {
  const getEventConfig = (type: OrderEventType) => {
    switch (type) {
      case 'assigned':
      case 'reassigned':
        return {
          icon: <UserCheck className="w-4 h-4 text-sky-600" />,
          bg: 'bg-sky-50 border-sky-200',
        };
      case 'started':
      case 'resumed':
        return {
          icon: <Play className="w-4 h-4 text-emerald-600" />,
          bg: 'bg-emerald-50 border-emerald-200',
        };
      case 'paused':
        return {
          icon: <Pause className="w-4 h-4 text-amber-600" />,
          bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        };
      case 'material_added':
        return {
          icon: <Package className="w-4 h-4 text-indigo-600" />,
          bg: 'bg-indigo-50 border-indigo-200',
        };
      case 'time_logged':
        return {
          icon: <Clock className="w-4 h-4 text-teal-600" />,
          bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
        };
      case 'checklist_updated':
        return {
          icon: <ListTodo className="w-4 h-4 text-teal-600" />,
          bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
        };
      case 'note_added':
        return {
          icon: <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
          bg: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700',
        };
      case 'signed':
        return {
          icon: <FileSignature className="w-4 h-4 text-blue-700" />,
          bg: 'bg-blue-50 border-blue-200',
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-700" />,
          bg: 'bg-emerald-100 border-emerald-300',
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-4 h-4 text-rose-600" />,
          bg: 'bg-rose-50 border-rose-200',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
          bg: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700',
        };
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className="py-6 text-center text-slate-400 text-xs">
        No hay registros en el historial de eventos.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200" id="order-timeline-stream">
      {events.map((ev, index) => {
        const config = getEventConfig(ev.type);
        return (
          <div key={ev.id || index} className="relative group">
            {/* Dot / Icon */}
            <div
              className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center ${config.bg} shadow-2xs`}
            >
              {config.icon}
            </div>

            {/* Event detail */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{ev.author}</span>
                <span className="text-[11px] text-slate-400 font-mono">{ev.timestamp}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{ev.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
