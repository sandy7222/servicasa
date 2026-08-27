import type { AppNotification, NotificationEntityType, NotificationType, UserRole } from '../types';
import { supabase } from './supabase';
import type { DbNotification } from './supabase';

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapNotification(row: DbNotification): AppNotification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    entityType: row.entity_type as NotificationEntityType | null,
    entityId: row.entity_id,
    priority: row.priority,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Últimos avisos del usuario actual (RLS ya filtra a los propios, o a todos
 * si es admin), más nuevos primero. */
export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  throwIfError(error);
  return (data ?? []).map((row) => mapNotification(row as DbNotification));
}

/** Total sin leer del usuario actual, para el badge de la campana. */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  throwIfError(error);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  throwIfError(error);
}

/** Ruta a la que debería llevar un aviso al hacer click, según el rol del
 * usuario actual. Para orden/presupuesto/pago no hay una vista propia por
 * id en admin/técnico todavía — se aterriza en su espacio de trabajo. */
export function getNotificationLink(notification: AppNotification, role: UserRole): string | null {
  const { entityType, entityId } = notification;
  if (!entityId) return null;
  switch (entityType) {
    case 'claim':
      return role === 'admin' ? `/admin/reclamos/${entityId}` : role === 'technician' ? `/technician/reclamos/${entityId}` : `/customer/reclamos/${entityId}`;
    case 'conversation':
      return role === 'admin' ? `/admin/conversaciones/${entityId}` : role === 'technician' ? `/technician/conversaciones/${entityId}` : `/customer/conversaciones/${entityId}`;
    case 'order':
    case 'quote':
    case 'payment':
      return role === 'admin' ? '/hub' : role === 'technician' ? '/technician' : `/customer/orders/${entityId}`;
    case 'settlement':
      return role === 'technician' ? '/technician/earnings' : '/hub';
    case 'technician_validation':
      return '/technician';
    default:
      return null;
  }
}
