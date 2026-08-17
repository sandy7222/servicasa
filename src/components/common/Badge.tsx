import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  PauseCircle,
  PlayCircle,
  Wrench,
  Zap,
  Hammer,
  Settings,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { OrderPriority, OrderStatus, ServiceType, UserRole } from '../../types';

export const StatusBadge: React.FC<{ status: OrderStatus; size?: 'sm' | 'md' }> = ({
  status,
  size = 'md',
}) => {
  const configs: Record<
    OrderStatus,
    { label: string; bg: string; text: string; border: string; dot: string; icon: React.ReactNode }
  > = {
    assigned: {
      label: 'Asignada',
      bg: 'bg-sky-50 text-sky-700 border-sky-200/80',
      text: 'text-sky-700',
      border: 'border-sky-200',
      dot: 'bg-sky-500',
      icon: <Clock className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />,
    },
    in_progress: {
      label: 'En curso',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      dot: 'bg-emerald-500',
      icon: <PlayCircle className={size === 'sm' ? 'w-3 h-3 text-emerald-600' : 'w-3.5 h-3.5 text-emerald-600'} />,
    },
    paused: {
      label: 'Pausada',
      bg: 'bg-amber-50 text-amber-900 border-amber-300',
      text: 'text-amber-900',
      border: 'border-amber-300',
      dot: 'bg-amber-500',
      icon: <PauseCircle className={size === 'sm' ? 'w-3 h-3 text-amber-600' : 'w-3.5 h-3.5 text-amber-600'} />,
    },
    completed: {
      label: 'Finalizada',
      bg: 'bg-slate-900 text-teal-300 border-slate-700',
      text: 'text-teal-300',
      border: 'border-slate-700',
      dot: 'bg-teal-400',
      icon: <CheckCircle2 className={size === 'sm' ? 'w-3 h-3 text-teal-400' : 'w-3.5 h-3.5 text-teal-400'} />,
    },
    cancelled: {
      label: 'Cancelada',
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      text: 'text-rose-800',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      icon: <XCircle className={size === 'sm' ? 'w-3 h-3 text-rose-500' : 'w-3.5 h-3.5 text-rose-500'} />,
    },
  };

  const c = configs[status] || configs.assigned;
  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.2 text-[10px] font-semibold'
      : 'px-2 py-0.5 text-[11px] font-semibold tracking-wide';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-mono uppercase ${c.bg} ${sizeClasses} whitespace-nowrap shadow-2xs`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <span>{c.label}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: OrderPriority }> = ({ priority }) => {
  const configs: Record<
    OrderPriority,
    { label: string; bg: string; text: string; dot: string; border: string; icon?: React.ReactNode }
  > = {
    baja: {
      label: 'Baja',
      bg: 'bg-slate-100/90 text-slate-700 border-slate-200',
      text: 'text-slate-700',
      dot: 'bg-slate-400',
      border: 'border-slate-200',
    },
    media: {
      label: 'Media',
      bg: 'bg-sky-50 text-sky-800 border-sky-200',
      text: 'text-sky-800',
      dot: 'bg-sky-500',
      border: 'border-sky-200',
    },
    alta: {
      label: 'Alta',
      bg: 'bg-amber-50 text-amber-900 border-amber-300',
      text: 'text-amber-900',
      dot: 'bg-amber-500',
      border: 'border-amber-300',
      icon: <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />,
    },
    urgente: {
      label: 'Urgente',
      bg: 'bg-rose-50 text-rose-800 border-rose-300',
      text: 'text-rose-800',
      dot: 'bg-rose-600',
      border: 'border-rose-300',
      icon: <Flame className="w-2.5 h-2.5 text-rose-600" />,
    },
  };

  const c = configs[priority] || configs.media;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${c.bg} whitespace-nowrap`}
    >
      {c.icon ? c.icon : <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />}
      <span>{c.label}</span>
    </span>
  );
};

export const ServiceBadge: React.FC<{ service: ServiceType; size?: 'sm' | 'md' }> = ({
  service,
  size = 'md',
}) => {
  const getIcon = () => {
    const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    switch (service) {
      case 'Plomería':
        return <Wrench className={`${iconClass} text-sky-600`} />;
      case 'Electricidad':
        return <Zap className={`${iconClass} text-amber-500`} />;
      case 'Reparaciones del hogar':
        return <Hammer className={`${iconClass} text-rose-500`} />;
      case 'Mantenimiento general':
        return <Settings className={`${iconClass} text-emerald-600`} />;
      case 'Instalación de equipos':
        return <ShieldCheck className={`${iconClass} text-teal-600`} />;
      default:
        return <Wrench className={iconClass} />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        size === 'sm' ? 'text-xs' : 'text-xs sm:text-sm font-medium'
      } text-slate-700`}
    >
      <span className="p-1 rounded-md bg-slate-100 text-slate-600 shrink-0">{getIcon()}</span>
      <span>{service}</span>
    </span>
  );
};

export const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const roleNames: Record<UserRole, { name: string; bg: string; text: string }> = {
    admin: { name: 'Administrador', bg: 'bg-[#003875] text-white', text: 'text-white' },
    technician: { name: 'Técnico en campo', bg: 'bg-teal-600 text-white', text: 'text-white' },
    customer: { name: 'Cliente', bg: 'bg-sky-600 text-white', text: 'text-white' },
  };

  const r = roleNames[role] || roleNames.customer;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${r.bg}`}>
      {r.name}
    </span>
  );
};
