import { describe, expect, it } from 'vitest';
import { draftFromCompletedOrder } from './rebooking';

describe('draftFromCompletedOrder', () => {
  it('precarga rubro, título y marca el pedido como repetición', () => {
    const draft = draftFromCompletedOrder({
      title: 'Cambio de grifería',
      description: 'Gotea la canilla de la cocina.',
      serviceType: 'Plomería',
      workMode: 'diagnosis',
    });
    expect(draft.serviceType).toBe('Plomería');
    expect(draft.title).toBe('Cambio de grifería');
    expect(draft.workMode).toBe('diagnosis');
    expect(draft.description).toMatch(/repetido/i);
  });
});
