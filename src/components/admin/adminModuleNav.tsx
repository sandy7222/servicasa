import React, { useMemo } from 'react';
import {
  ADMIN_NAV_GROUPS,
  destinationFromPath,
  destinationsForGroup,
  hrefForDestination,
  rememberDestination,
  type AdminNavBadgeKey,
  type AdminNavDestination,
} from '../../lib/adminNav';
import { useApp } from '../../context/AppContext';
import { fetchTotalUnreadCount } from '../../lib/conversations';
import { isOrderPaymentSettled, orderRequiresPaymentGate } from '../../lib/workTimer';
import { usePendingPayoutRequestCount } from './SettlementsHub';

export type AdminNavCounts = Partial<Record<AdminNavBadgeKey, number>>;

export function useAdminNavCounts(): AdminNavCounts {
  const { orders } = useApp();
  const { count: payouts } = usePendingPayoutRequestCount(true);
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetchTotalUnreadCount()
      .then((count) => {
        if (!cancelled) setUnread(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingPayment = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status !== 'completed' &&
          order.status !== 'cancelled' &&
          orderRequiresPaymentGate(order) &&
          !isOrderPaymentSettled(order),
      ).length,
    [orders],
  );
  return { pendingPayment, payouts, unread };
}

export function useAdminNavController() {
  const { currentPath, navigate } = useApp();
  const counts = useAdminNavCounts();
  const current = destinationFromPath(currentPath);

  React.useEffect(() => {
    if (current) rememberDestination(current.id);
  }, [current]);

  const goTo = (destination: AdminNavDestination) => {
    rememberDestination(destination.id);
    navigate(hrefForDestination(destination));
  };

  const badge = (destination: AdminNavDestination) => {
    if (!destination.badgeKey) return 0;
    return counts[destination.badgeKey] ?? 0;
  };

  return { currentPath, current, goTo, badge, groups: ADMIN_NAV_GROUPS, destinationsForGroup };
}

export function NavBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="min-w-4 h-4 px-1 rounded-full bg-amber-600 text-white text-[10px] font-black leading-4 text-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}
