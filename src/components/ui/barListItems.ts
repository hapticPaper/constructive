import type { BarListItem } from './BarList';

import type { RadarCategory } from '../../content/types';

const CATEGORY_COLORS: Partial<Record<RadarCategory, string>> = {
  praise: 'var(--positive)',
  criticism: 'var(--negative)',
  toxic: 'var(--danger)',
};

function uniqueId(baseId: string, counts: Map<string, number>): string {
  const count = counts.get(baseId) ?? 0;
  counts.set(baseId, count + 1);
  return count === 0 ? baseId : `${baseId}:${count}`;
}

/**
 * Builds prevalence-style bar items where `rate` is derived from `count / total`.
 *
 * `total` should be the denominator you want to present as 100%.
 */
export function barListItemsFromCounts(
  items: ReadonlyArray<{ id?: string; label: string; count: number }>,
  total: number,
): BarListItem[] {
  const idCounts = new Map<string, number>();

  if (total <= 0) {
    return items.map((item) => ({
      id: uniqueId(item.id ?? item.label, idCounts),
      label: item.label,
      count: item.count,
      rate: 0,
    }));
  }

  const denom = total;
  return items.map((item) => {
    const countForRate = Math.max(0, Math.min(item.count, denom));
    return {
      id: uniqueId(item.id ?? item.label, idCounts),
      label: item.label,
      count: item.count,
      rate: countForRate / denom,
    };
  });
}

export function barListItemsFromRadarBuckets(
  buckets: ReadonlyArray<{
    id?: string;
    key: RadarCategory;
    label: string;
    count: number;
    rate: number;
  }>,
): BarListItem[] {
  const idCounts = new Map<string, number>();

  return buckets.map((bucket) => ({
    id: uniqueId(bucket.id ?? bucket.key, idCounts),
    label: bucket.label,
    count: bucket.count,
    rate: bucket.rate,
    color: CATEGORY_COLORS[bucket.key],
  }));
}
