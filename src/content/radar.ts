import type { CommentAnalytics, RadarCategory, RadarCategoryCounts } from './types';

export type RadarCategoryDefinition = {
  key: RadarCategory;
  label: string;
};

// Each category represents a per-comment binary classification (0/1 per comment), so
// any category count is always <= the total number of analyzed comments.
export const RADAR_CATEGORIES: readonly RadarCategoryDefinition[] = [
  { key: 'praise', label: 'Praise' },
  { key: 'criticism', label: 'Criticism' },
  { key: 'question', label: 'Questions' },
  { key: 'suggestion', label: 'Suggestions' },
  { key: 'toxic', label: 'Toxic' },
  { key: 'people', label: 'People' },
] as const;

export function emptyRadarCounts(): RadarCategoryCounts {
  return {
    praise: 0,
    criticism: 0,
    question: 0,
    suggestion: 0,
    toxic: 0,
    people: 0,
  };
}

export type RadarBucket = {
  key: RadarCategory;
  label: string;
  count: number;
};

export type RadarBucketWithRate = RadarBucket & {
  rate: number;
};

export function radarCountsToBuckets(radar: RadarCategoryCounts): RadarBucket[] {
  return RADAR_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    count: radar[category.key],
  }));
}

export function radarBucketsWithRates(
  radar: RadarCategoryCounts,
  totalComments: number,
): RadarBucketWithRate[] {
  if (totalComments <= 0) {
    return radarCountsToBuckets(radar).map((bucket) => ({
      ...bucket,
      rate: 0,
    }));
  }

  return radarCountsToBuckets(radar).map((bucket) => ({
    ...bucket,
    rate: bucket.count / totalComments,
  }));
}

/**
* Aggregates radar analytics across v3 CommentAnalytics entries.
* Assumes entries represent disjoint comment sets (e.g. one entry per video).
* Throws if any entry is not schema v3; callers should pre-filter inputs.
*/
export function aggregateRadarAnalytics(
  analytics: CommentAnalytics[],
): Pick<CommentAnalytics, 'commentCount' | 'radar'> {
  const radar = emptyRadarCounts();
  let commentCount = 0;

  for (const [index, entry] of analytics.entries()) {
    if (entry.schema !== 'constructive.comment-analytics@v3') {
      throw new Error(
        `aggregateRadarAnalytics requires v3 analytics; entry at index ${index} has schema ${entry.schema}.`,
      );
    }

    for (const category of RADAR_CATEGORIES) {
      if (entry.radar[category.key] > entry.commentCount) {
        throw new Error(
          `Radar category "${category.key}" exceeds commentCount for analytics entry at index ${index}.`,
        );
      }
    }
    commentCount += entry.commentCount;
    for (const category of RADAR_CATEGORIES) {
      radar[category.key] += entry.radar[category.key];
    }
  }

  return { commentCount, radar };
}
