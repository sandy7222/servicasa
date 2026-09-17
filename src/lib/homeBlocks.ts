import type { HomeBanner, HomeCard } from '../types';

export type HomeBlockKind = 'banner' | 'card';

export type HomeBlockRef = { id: string; type: HomeBlockKind };

export type HomeBlock =
  | { type: 'banner'; item: HomeBanner }
  | { type: 'card'; item: HomeCard };

export type HomeBlockRun =
  | { type: 'banner'; items: HomeBanner[] }
  | { type: 'card'; items: HomeCard[] };

export function combinedMaxDisplayOrder(
  banners: readonly { displayOrder: number }[],
  cards: readonly { displayOrder: number }[]
): number {
  const bannerMax = banners.reduce((max, b) => Math.max(max, b.displayOrder), -1);
  const cardMax = cards.reduce((max, c) => Math.max(max, c.displayOrder), -1);
  return Math.max(bannerMax, cardMax);
}

export function isCurrentlyVigent(
  item: { startsAt?: string | null; endsAt?: string | null },
  today = new Date().toISOString().slice(0, 10)
): boolean {
  if (item.startsAt && item.startsAt > today) return false;
  if (item.endsAt && item.endsAt < today) return false;
  return true;
}

export function combineHomeBlocks(
  banners: readonly HomeBanner[],
  cards: readonly HomeCard[]
): HomeBlock[] {
  const blocks: HomeBlock[] = [
    ...banners.map((item) => ({ type: 'banner' as const, item })),
    ...cards.map((item) => ({ type: 'card' as const, item })),
  ];
  blocks.sort((a, b) => {
    const byOrder = a.item.displayOrder - b.item.displayOrder;
    if (byOrder !== 0) return byOrder;
    return a.item.id.localeCompare(b.item.id);
  });
  return blocks;
}

export function visibleCustomerHomeBlocks(
  banners: readonly HomeBanner[],
  cards: readonly HomeCard[],
  today = new Date().toISOString().slice(0, 10)
): HomeBlock[] {
  const activeBanners = banners.filter(
    (b) => b.isActive && isCurrentlyVigent(b, today)
  );
  const activeCards = cards.filter((c) => c.isActive);
  return combineHomeBlocks(activeBanners, activeCards);
}

export function groupHomeBlockRuns(blocks: readonly HomeBlock[]): HomeBlockRun[] {
  const runs: HomeBlockRun[] = [];
  for (const block of blocks) {
    const last = runs[runs.length - 1];
    if (block.type === 'banner') {
      if (last?.type === 'banner') {
        last.items.push(block.item);
      } else {
        runs.push({ type: 'banner', items: [block.item] });
      }
    } else if (last?.type === 'card') {
      last.items.push(block.item);
    } else {
      runs.push({ type: 'card', items: [block.item] });
    }
  }
  return runs;
}
