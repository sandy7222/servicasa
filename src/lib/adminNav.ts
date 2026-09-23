export type AdminHubTab =
  | 'orders'
  | 'pendingPayment'
  | 'technicians'
  | 'contracts'
  | 'settlements'
  | 'inventory'
  | 'services'
  | 'categories'
  | 'pageEditor'
  | 'leads';

export type AdminNavGroupId = 'operacion' | 'personas' | 'catalogo' | 'plataforma';

export type AdminNavBadgeKey = 'pendingPayment' | 'payouts' | 'unread';

export type AdminNavDestination = {
  id: string;
  label: string;
  groupId: AdminNavGroupId;
  kind: 'tab' | 'route';
  tab?: AdminHubTab;
  path?: string;
  badgeKey?: AdminNavBadgeKey;
};

export type AdminNavGroup = {
  id: AdminNavGroupId;
  label: string;
  defaultDestinationId: string;
};

const HUB_TABS: AdminHubTab[] = [
  'orders',
  'pendingPayment',
  'technicians',
  'contracts',
  'settlements',
  'inventory',
  'services',
  'categories',
  'pageEditor',
  'leads',
];

const LAST_DEST_KEY = 'tecniurbano_admin_last_dest';

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { id: 'operacion', label: 'Operación', defaultDestinationId: 'orders' },
  { id: 'personas', label: 'Personas', defaultDestinationId: 'clientes' },
  { id: 'catalogo', label: 'Catálogo', defaultDestinationId: 'services' },
  { id: 'plataforma', label: 'Plataforma', defaultDestinationId: 'pageEditor' },
];

export const ADMIN_NAV_DESTINATIONS: AdminNavDestination[] = [
  { id: 'orders', label: 'Órdenes', groupId: 'operacion', kind: 'tab', tab: 'orders' },
  {
    id: 'pendingPayment',
    label: 'Pendientes de pago',
    groupId: 'operacion',
    kind: 'tab',
    tab: 'pendingPayment',
    badgeKey: 'pendingPayment',
  },
  { id: 'clientes', label: 'Clientes', groupId: 'personas', kind: 'route', path: '/admin/clientes' },
  { id: 'technicians', label: 'Técnicos', groupId: 'personas', kind: 'tab', tab: 'technicians' },
  { id: 'conversaciones', label: 'Conversaciones', groupId: 'personas', kind: 'route', path: '/admin/conversaciones', badgeKey: 'unread' },
  { id: 'reclamos', label: 'Reclamos', groupId: 'personas', kind: 'route', path: '/admin/reclamos' },
  { id: 'services', label: 'Servicios', groupId: 'catalogo', kind: 'tab', tab: 'services' },
  { id: 'categories', label: 'Categorías', groupId: 'catalogo', kind: 'tab', tab: 'categories' },
  { id: 'inventory', label: 'Inventario', groupId: 'catalogo', kind: 'tab', tab: 'inventory' },
  { id: 'contracts', label: 'Contratos', groupId: 'plataforma', kind: 'tab', tab: 'contracts' },
  {
    id: 'settlements',
    label: 'Liquidaciones',
    groupId: 'plataforma',
    kind: 'tab',
    tab: 'settlements',
    badgeKey: 'payouts',
  },
  { id: 'pageEditor', label: 'Página del cliente', groupId: 'plataforma', kind: 'tab', tab: 'pageEditor' },
  { id: 'leads', label: 'Empresas', groupId: 'plataforma', kind: 'tab', tab: 'leads' },
];

export function isAdminHubTab(value: string): value is AdminHubTab {
  return HUB_TABS.includes(value as AdminHubTab);
}

export function isAdminWorkspacePath(path: string): boolean {
  const pathOnly = path.split('?')[0];
  return pathOnly === '/hub' || pathOnly === '/home' || pathOnly.startsWith('/admin/');
}

export function pathOnly(path: string): string {
  return path.split('?')[0] || '/';
}

export function hubPathForTab(tab: AdminHubTab): string {
  return tab === 'orders' ? '/hub' : `/hub?tab=${tab}`;
}

export function tabFromPath(path: string): AdminHubTab | null {
  const only = pathOnly(path);
  if (only !== '/hub' && only !== '/home') return null;
  const params = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
  const tab = params.get('tab');
  if (tab && isAdminHubTab(tab)) return tab;
  return 'orders';
}

export function destinationById(id: string): AdminNavDestination | undefined {
  return ADMIN_NAV_DESTINATIONS.find((item) => item.id === id);
}

export function destinationsForGroup(groupId: AdminNavGroupId): AdminNavDestination[] {
  return ADMIN_NAV_DESTINATIONS.filter((item) => item.groupId === groupId);
}

export function defaultDestination(groupId: AdminNavGroupId): AdminNavDestination {
  const group = ADMIN_NAV_GROUPS.find((item) => item.id === groupId) ?? ADMIN_NAV_GROUPS[0];
  return destinationById(group.defaultDestinationId) ?? ADMIN_NAV_DESTINATIONS[0];
}

export function hrefForDestination(destination: AdminNavDestination): string {
  if (destination.kind === 'route' && destination.path) return destination.path;
  return hubPathForTab(destination.tab ?? 'orders');
}

export function destinationFromPath(path: string): AdminNavDestination | undefined {
  const only = pathOnly(path);
  const routeMatch = ADMIN_NAV_DESTINATIONS.find(
    (item) => item.kind === 'route' && item.path && (only === item.path || only.startsWith(`${item.path}/`)),
  );
  if (routeMatch) return routeMatch;
  const tab = tabFromPath(path);
  if (!tab) return undefined;
  return ADMIN_NAV_DESTINATIONS.find((item) => item.kind === 'tab' && item.tab === tab);
}

export function groupFromPath(path: string): AdminNavGroupId {
  return destinationFromPath(path)?.groupId ?? 'operacion';
}

export function rememberDestination(destinationId: string): void {
  const destination = destinationById(destinationId);
  if (!destination || typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(LAST_DEST_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[destination.groupId] = destination.id;
    sessionStorage.setItem(LAST_DEST_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function destinationForGroupTap(groupId: AdminNavGroupId): AdminNavDestination {
  if (typeof sessionStorage === 'undefined') return defaultDestination(groupId);
  try {
    const raw = sessionStorage.getItem(LAST_DEST_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const remembered = map[groupId] ? destinationById(map[groupId]) : undefined;
    if (remembered && remembered.groupId === groupId) return remembered;
  } catch {
    /* ignore */
  }
  return defaultDestination(groupId);
}
