import { radarBucketsWithRates } from '../../content/radar';
import type { RadarCategoryCounts } from '../../content/types';

import { BarList } from './BarList';
import { barListItemsFromRadarBuckets } from './barListItems';

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
  const items = barListItemsFromRadarBuckets(buckets);

  return <BarList items={items} />;
}
