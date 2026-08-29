/** Shared catalog ordering for categories/subcategories.
 * Always sort by `displayOrder`, then by name (es) so ties stay stable. */

export const UNGROUPED_DISPLAY_ORDER = 999;
export const UNGROUPED_SUBCATEGORY_LABEL = 'Sin subcategoría';

export function compareByDisplayOrder(
  a: { displayOrder: number; name?: string | null },
  b: { displayOrder: number; name?: string | null }
): number {
  const byOrder = a.displayOrder - b.displayOrder;
  if (byOrder !== 0) return byOrder;
  return (a.name ?? '').localeCompare(b.name ?? '', 'es');
}

export function sortByDisplayOrder<T extends { displayOrder: number; name: string }>(
  items: readonly T[]
): T[] {
  const result: T[] = items.slice();
  result.sort((left, right) => compareByDisplayOrder(left, right));
  return result;
}

export type SubcategoryGroup<T> = {
  id: string | null;
  name: string;
  order: number;
  items: T[];
};

type CatalogSubcategoryRef = {
  id: string;
  name: string;
  displayOrder: number;
  active?: boolean;
};

/** Groups tarifario/service items by the real subcategory row, then sorts by display_order. */
export function groupItemsBySubcategory<T extends { subcategoryId?: string | null }>(
  items: readonly T[],
  subcategories: readonly CatalogSubcategoryRef[],
  options?: { includeInactive?: boolean }
): SubcategoryGroup<T>[] {
  const includeInactive = options?.includeInactive === true;
  const groups = new Map<string, SubcategoryGroup<T>>();

  for (const item of items) {
    const sub = item.subcategoryId
      ? subcategories.find((s) => s.id === item.subcategoryId && (includeInactive || s.active !== false))
      : undefined;
    const key = sub?.id ?? 'sin-subcategoria';
    let group = groups.get(key);
    if (!group) {
      group = {
        id: sub?.id ?? null,
        name: sub?.name ?? UNGROUPED_SUBCATEGORY_LABEL,
        order: sub?.displayOrder ?? UNGROUPED_DISPLAY_ORDER,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return Array.from(groups.values()).sort((a, b) =>
    compareByDisplayOrder({ displayOrder: a.order, name: a.name }, { displayOrder: b.order, name: b.name })
  );
}
