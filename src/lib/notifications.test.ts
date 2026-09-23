import { describe, expect, it } from 'vitest';
import { getNotificationLink } from './notifications';
import type { AppNotification } from '../types';

function notice(partial: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1',
    type: 'order_assigned',
    title: 'Aviso',
    priority: 'normal',
    createdAt: '2026-09-23T00:00:00Z',
    entityType: 'order',
    entityId: 'ord-99',
    ...partial,
  };
}

describe('getNotificationLink', () => {
  it('abre la orden exacta para admin y técnico', () => {
    expect(getNotificationLink(notice({}), 'admin')).toBe('/hub?order=ord-99');
    expect(getNotificationLink(notice({}), 'technician')).toBe('/technician?order=ord-99');
    expect(getNotificationLink(notice({}), 'customer')).toBe('/customer/orders/ord-99');
  });

  it('lleva un lead B2B a la bandeja del hub', () => {
    expect(
      getNotificationLink(notice({ entityType: 'business_lead', entityId: 'lead-1', type: 'business_lead' }), 'admin')
    ).toBe('/hub?tab=leads');
  });
});
