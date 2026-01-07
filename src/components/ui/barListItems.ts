import type { BarListItem } from './BarList';

import type { RadarCategory } from '../../content/types';

const CATEGORY_COLORS: Partial<Record<RadarCategory, string>> = {
  praise: 'var(--positive)',
  criticism: 'var(--negative)',
  toxic: 'var(--danger)',
};

/**
 * Builds prevalence-style bar items where `rate` is derived from `count / total`.
 *
 * `total` should be the denominator you want to present as 100%.
 */
export function barListItemsFromCounts(
  items: ReadonlyArray<{ id?: string; label: string; count: number }>,
  total: number,
): BarListItem[] {
  if (total <= 0) {
    return items.map((item) => ({
      id: item.id ?? item.label,
      label: item.label,
      count: item.count,
      rate: 0,
    }));
  }

  const denom = total;
  return items.map((item) => {
    const countForRate = Math.max(0, Math.min(item.count, denom));
    return {
      id: item.id ?? item.label,
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
  return buckets.map((bucket) => ({
    id: bucket.id ?? bucket.key,
    label: bucket.label,
    count: bucket.count,
    rate: bucket.rate,
    color: CATEGORY_COLORS[bucket.key],
  }));
}
