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
  items: ReadonlyArray<{ label: string; count: number }>,
  total: number,
): BarListItem[] {
  const denom = total > 0 ? total : 1;
  return items.map((item) => ({
    key: item.label,
    label: item.label,
    count: item.count,
    rate: Math.max(0, Math.min(1, item.count / denom)),
  }));
}

export function barListItemsFromRadarBuckets(
  buckets: ReadonlyArray<{
    key: RadarCategory;
    label: string;
    count: number;
    rate: number;
  }>,
): BarListItem[] {
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: bucket.count,
    rate: bucket.rate,
    color: CATEGORY_COLORS[bucket.key],
  }));
}
