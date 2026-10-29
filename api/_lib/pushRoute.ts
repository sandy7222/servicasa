/**
 * Pantalla a la que abre un aviso push al tocarlo. Es el mismo mapa que
 * `getNotificationLink` (src/lib/notifications.ts), repetido acá porque ese archivo usa el
 * cliente del navegador. Si se cambia uno, cambiar el otro.
 */
export type PushRole = 'admin' | 'technician' | 'customer';

const HOME: Record<PushRole, string> = { admin: '/hub', technician: '/technician', customer: '/customer' };

export function pushPathFor(role: PushRole, entityType: string | null, entityId: string | null): string {
  const home = HOME[role] ?? '/customer';
  if (!entityId) return home;
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case 'claim':
      return role === 'admin' ? `/admin/reclamos/${id}` : role === 'technician' ? `/technician/reclamos/${id}` : `/customer/reclamos/${id}`;
    case 'conversation':
      return role === 'admin' ? `/admin/conversaciones/${id}` : role === 'technician' ? `/technician/conversaciones/${id}` : `/customer/conversaciones/${id}`;
    case 'order':
    case 'quote':
    case 'payment':
      return role === 'admin' ? `/hub?order=${id}` : role === 'technician' ? `/technician?order=${id}` : `/customer/orders/${id}`;
    case 'business_lead':
      return role === 'admin' ? '/hub?tab=leads' : home;
    case 'settlement':
      return role === 'technician' ? '/technician/earnings' : home;
    case 'technician':
      return role === 'admin' ? '/hub?tab=technicians' : home;
    case 'technician_validation':
      return '/technician';
    default:
      return home;
  }
}

/** La app usa rutas con "#" (por ejemplo https://tecniurbano.online/#/hub). */
export function pushUrlFor(role: PushRole, entityType: string | null, entityId: string | null): string {
  return `/#${pushPathFor(role, entityType, entityId)}`;
}
