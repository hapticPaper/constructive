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
 *
 * By default this function is strict and throws if any entry is incompatible.
 * Use `onIncompatible: 'skip'` to ignore incompatible entries instead; skipped
 * entries are excluded from the returned totals.
 */
export type AggregateRadarAnalyticsOptions = {
  onIncompatible?: 'skip' | 'throw';
};

export function aggregateRadarAnalytics(
  analytics: ReadonlyArray<CommentAnalytics>,
  options?: AggregateRadarAnalyticsOptions,
): Pick<CommentAnalytics, 'commentCount' | 'radar'>;
export function aggregateRadarAnalytics(
  analytics: ReadonlyArray<unknown>,
  options?: AggregateRadarAnalyticsOptions,
): Pick<CommentAnalytics, 'commentCount' | 'radar'>;
export function aggregateRadarAnalytics(
  analytics: ReadonlyArray<unknown>,
  options: AggregateRadarAnalyticsOptions = {},
): Pick<CommentAnalytics, 'commentCount' | 'radar'> {
  const onIncompatible = options.onIncompatible ?? 'throw';
  const radar = emptyRadarCounts();
  let commentCount = 0;

  for (const [index, entry] of analytics.entries()) {
    const v3 = coerceRadarAnalyticsV3(entry, index, onIncompatible);
    if (!v3) continue;

    commentCount += v3.commentCount;
    for (const category of RADAR_CATEGORIES) {
      radar[category.key] += v3.radar[category.key];
    }
  }

  return { commentCount, radar };
}

type RadarAnalyticsV3 = Pick<CommentAnalytics, 'commentCount' | 'radar' | 'schema'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function coerceRadarAnalyticsV3(
  value: unknown,
  index: number,
  onIncompatible: 'skip' | 'throw',
): RadarAnalyticsV3 | null {
  if (!isRecord(value) || value.schema !== 'constructive.comment-analytics@v3') {
    if (onIncompatible === 'skip') return null;

    const schemaValue = isRecord(value) ? value.schema : undefined;
    throw new Error(
      `aggregateRadarAnalytics requires v3 analytics; entry at index ${index} has schema ${String(schemaValue)}.`,
    );
  }

  if (typeof value.commentCount !== 'number' || !Number.isInteger(value.commentCount)) {
    if (onIncompatible === 'skip') return null;
    throw new Error(
      `aggregateRadarAnalytics requires integer commentCount; entry at index ${index} has commentCount ${String(value.commentCount)}.`,
    );
  }

  if (!isRecord(value.radar)) {
    if (onIncompatible === 'skip') return null;
    throw new Error(
      `aggregateRadarAnalytics requires a radar object; entry at index ${index} is missing radar.`,
    );
  }

  const radar = emptyRadarCounts();
  for (const category of RADAR_CATEGORIES) {
    const count = value.radar[category.key];

    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      if (onIncompatible === 'skip') return null;
      throw new Error(
        `aggregateRadarAnalytics requires integer radar counts; entry at index ${index} has invalid count for ${category.key}.`,
      );
    }

    if (count > value.commentCount) {
      if (onIncompatible === 'skip') return null;
      throw new Error(
        `Radar category "${category.key}" exceeds commentCount for analytics entry at index ${index}.`,
      );
    }

    radar[category.key] = count;
  }

  return {
    schema: 'constructive.comment-analytics@v3',
    commentCount: value.commentCount,
    radar,
  };
}
