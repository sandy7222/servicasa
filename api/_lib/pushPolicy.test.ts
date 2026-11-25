// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PUSH_TYPES, shouldPush } from './pushPolicy';

describe('pushPolicy', () => {
  it('manda push de los momentos importantes de cada proceso', () => {
    for (const type of ['order_assigned', 'quote_sent', 'quote_accepted', 'payment_approved', 'payment_received', 'technician_en_route', 'technician_arrived', 'work_completed', 'settlement_paid', 'message_new', 'claim_opened']) {
      expect(shouldPush(type), type).toBe(true);
    }
  });

  it('no manda push de lo que ya sale por Telegram ni de avisos menores', () => {
    for (const type of ['payment_pending', 'technician_validation', 'visit_paid', 'technician_registered', 'technician_documents', 'business_lead']) {
      expect(shouldPush(type), type).toBe(false);
    }
  });

  it('un tipo desconocido o vacío no manda push', () => {
    expect(shouldPush(undefined)).toBe(false);
    expect(shouldPush(null)).toBe(false);
    expect(shouldPush('inventado')).toBe(false);
    expect(PUSH_TYPES.size).toBeGreaterThan(10);
  });
});
