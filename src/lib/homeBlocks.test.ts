import { describe, expect, it } from 'vitest';
import type { HomeBanner, HomeCard } from '../types';
import {
  combineHomeBlocks,
  combinedMaxDisplayOrder,
  groupHomeBlockRuns,
  isCurrentlyVigent,
  visibleCustomerHomeBlocks,
} from './homeBlocks';

function banner(partial: Partial<HomeBanner> & { id: string; displayOrder: number }): HomeBanner {
  return {
    rubro: 'Test',
    badgeLabel: 'PROMO',
    title: partial.title ?? partial.id,
    description: 'desc',
    isActive: true,
    mediaType: 'image',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

function card(partial: Partial<HomeCard> & { id: string; displayOrder: number }): HomeCard {
  return {
    icon: 'Wrench',
    title: partial.title ?? partial.id,
    linkPath: '/customer/solicitar',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

describe('combinedMaxDisplayOrder', () => {
  it('usa el máximo de ambas listas, no de una sola tabla', () => {
    expect(combinedMaxDisplayOrder([{ displayOrder: 1 }], [{ displayOrder: 4 }])).toBe(4);
    expect(combinedMaxDisplayOrder([], [])).toBe(-1);
  });
});

describe('combineHomeBlocks', () => {
  it('mezcla banners y tarjetas por displayOrder', () => {
    const blocks = combineHomeBlocks(
      [banner({ id: 'b1', displayOrder: 2, title: 'Banner' })],
      [card({ id: 'c1', displayOrder: 0, title: 'Card A' }), card({ id: 'c2', displayOrder: 1, title: 'Card B' })]
    );
    expect(blocks.map((b) => b.item.id)).toEqual(['c1', 'c2', 'b1']);
  });
});

describe('visibleCustomerHomeBlocks', () => {
  it('omite banners inactivos o fuera de vigencia y tarjetas inactivas', () => {
    const blocks = visibleCustomerHomeBlocks(
      [
        banner({ id: 'on', displayOrder: 0 }),
        banner({ id: 'off', displayOrder: 1, isActive: false }),
        banner({ id: 'future', displayOrder: 2, startsAt: '2026-12-01' }),
      ],
      [card({ id: 'c-on', displayOrder: 3 }), card({ id: 'c-off', displayOrder: 4, isActive: false })],
      '2026-09-17'
    );
    expect(blocks.map((b) => b.item.id)).toEqual(['on', 'c-on']);
  });
});

describe('isCurrentlyVigent', () => {
  it('respeta startsAt y endsAt inclusivos', () => {
    expect(isCurrentlyVigent({ startsAt: '2026-09-17', endsAt: '2026-09-17' }, '2026-09-17')).toBe(true);
    expect(isCurrentlyVigent({ startsAt: '2026-09-18' }, '2026-09-17')).toBe(false);
    expect(isCurrentlyVigent({ endsAt: '2026-09-16' }, '2026-09-17')).toBe(false);
  });
});

describe('groupHomeBlockRuns', () => {
  it('agrupa tarjetas consecutivas y deja cada tramo de banners junto', () => {
    const runs = groupHomeBlockRuns(
      combineHomeBlocks(
        [banner({ id: 'b1', displayOrder: 0 }), banner({ id: 'b2', displayOrder: 3 })],
        [card({ id: 'c1', displayOrder: 1 }), card({ id: 'c2', displayOrder: 2 })]
      )
    );
    expect(runs).toHaveLength(3);
    expect(runs[0]).toMatchObject({ type: 'banner', items: [{ id: 'b1' }] });
    expect(runs[1].type).toBe('card');
    if (runs[1].type === 'card') {
      expect(runs[1].items.map((c) => c.id)).toEqual(['c1', 'c2']);
    }
    expect(runs[2]).toMatchObject({ type: 'banner', items: [{ id: 'b2' }] });
  });
});
