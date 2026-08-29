import { describe, expect, it } from 'vitest';
import {
  compareByDisplayOrder,
  groupItemsBySubcategory,
  sortByDisplayOrder,
  UNGROUPED_DISPLAY_ORDER,
  UNGROUPED_SUBCATEGORY_LABEL,
} from './catalogOrder';

describe('sortByDisplayOrder', () => {
  it('ordena por displayOrder y desempatá por nombre en español', () => {
    const sorted = sortByDisplayOrder([
      { id: 'c', displayOrder: 2, name: 'Pintura' },
      { id: 'a', displayOrder: 1, name: 'Cerrajería' },
      { id: 'b', displayOrder: 1, name: 'Albañilería' },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('compareByDisplayOrder', () => {
  it('manda el grupo sin subcategoría (999) al final', () => {
    expect(
      compareByDisplayOrder({ displayOrder: 3, name: 'CCTV' }, { displayOrder: UNGROUPED_DISPLAY_ORDER, name: 'Sin subcategoría' })
    ).toBeLessThan(0);
  });
});

describe('groupItemsBySubcategory', () => {
  const subcategories = [
    { id: 'sub-b', name: 'Cableado', displayOrder: 2, active: true },
    { id: 'sub-a', name: 'Acometidas', displayOrder: 1, active: true },
    { id: 'sub-hidden', name: 'Oculta', displayOrder: 0, active: false },
  ];

  it('agrupa por subcategory_id y respeta display_order', () => {
    const groups = groupItemsBySubcategory(
      [
        { id: '1', subcategoryId: 'sub-b' },
        { id: '2', subcategoryId: 'sub-a' },
        { id: '3', subcategoryId: null },
      ],
      subcategories
    );
    expect(groups.map((g) => g.name)).toEqual(['Acometidas', 'Cableado', UNGROUPED_SUBCATEGORY_LABEL]);
  });

  it('en vistas públicas trata las subcategorías inactivas como sin grupo', () => {
    const groups = groupItemsBySubcategory([{ id: '1', subcategoryId: 'sub-hidden' }], subcategories);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe(UNGROUPED_SUBCATEGORY_LABEL);
  });

  it('en el tarifario del técnico puede incluir subcategorías inactivas', () => {
    const groups = groupItemsBySubcategory([{ id: '1', subcategoryId: 'sub-hidden' }], subcategories, {
      includeInactive: true,
    });
    expect(groups[0].name).toBe('Oculta');
  });
});
