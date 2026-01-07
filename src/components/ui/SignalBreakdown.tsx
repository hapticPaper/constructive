import { radarBucketsWithRates } from '../../content/radar';
import type { RadarCategory, RadarCategoryCounts } from '../../content/types';

import type { BarListItem } from './BarList';
import { BarList } from './BarList';

const CATEGORY_COLORS: Partial<Record<RadarCategory, string>> = {
  praise: 'var(--positive)',
  criticism: 'var(--negative)',
  toxic: 'var(--danger)',
};

export function SignalBreakdown({
  radar,
  totalComments,
}: {
  radar: RadarCategoryCounts;
  totalComments: number;
}): JSX.Element {
  if (totalComments === 0) {
    return <p className="muted">No comments analyzed yet.</p>;
  }

  const buckets = radarBucketsWithRates(radar, totalComments);
  const items: BarListItem[] = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: bucket.count,
    rate: bucket.rate,
    color: CATEGORY_COLORS[bucket.key],
  }));

  return <BarList items={items} />;
}
