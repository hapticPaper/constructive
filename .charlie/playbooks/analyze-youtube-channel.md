# Analyze YouTube channel

## Overview

Aggregate and analyze all videos from a YouTube channel that have been ingested into `content/`. Generate a channel-level aggregation MDX file that provides creator insights across all videos in the channel.

This playbook produces **channel-level insights** to help creators understand patterns across their content, not just individual videos. The goal is to surface:

- Channel-level engagement patterns (sentiment trends, toxic comment rates)
- Recurring topics and themes across all videos
- Videos that need attention (high question rates, high negative sentiment)
- Channel health metrics (average engagement, content consistency)

## Prerequisites

- Devbox access (to run `bun` scripts)
- `bun install` has been run
- At least one video from the target channel must be ingested and analyzed

## Steps

1. Ensure videos are ingested and analyzed:

   For each video you want to include in the channel analysis, make sure both `comments.json` and `analytics.json` exist:

   ```bash
   # Defaults to fetching all comments.
   bun run ingest:youtube -- <YOUTUBE_URL_OR_ID>
   bun run content:analyze -- --video youtube:<videoId>
   ```

   For channel-level aggregation to work well, make sure you also do the **per-video
   dimensionality reduction** step (merge synonyms, rewrite topic labels, rewrite
   takeaways). The channel script aggregates by `label`, so label normalization happens
   upstream.

2. Run the channel aggregation script:

   ```bash
   bun run analyze:channel -- --channel youtube:<channelId>
   ```

   This script will:
   - Find all videos for the given channel
   - Aggregate analytics across all videos
   - Generate channel-level insights
   - Create the channel aggregation MDX file

3. Optional: if the aggregated output still has near-duplicate labels (e.g. `ai` vs
   `artificial intelligence`), do a final reduction pass by editing:
   - `content/platforms/youtube/channels/<channelId>/channel-aggregate.mdx`

   Keep `topTopics` sorted by count, and cap any merged topic count at `totalComments`.

## Output format

### `channel-aggregate.mdx`

`content/platforms/youtube/channels/<channelId>/channel-aggregate.mdx` is the presentation artifact for the channel page.

It exports a `channelAggregate` object and renders it via the `<ChannelAggregate />` widget (injected via `MDXProvider`).

**Channel aggregate schema:**

```ts
type ChannelAggregate = {
  schema: 'constructive.channel-aggregate@v1';
  generatedAt: string;
  channel: {
    platform: 'youtube';
    channelId: string;
    channelTitle: string;
    channelUrl?: string;
  };

  videoCount: number;
  totalComments: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  topTopics: Array<{ label: string; count: number }>;
  takeaways: Array<{ title: string; detail: string }>;
};
```

Note: after any manual merging, keep `topTopics[*].count <= totalComments`.

**Example MDX structure:**

```mdx
export const channelAggregate = {
  schema: 'constructive.channel-aggregate@v1',
  generatedAt: '2026-01-03T12:00:00.000Z',
  channel: {
    platform: 'youtube',
    channelId: 'UCxyz',
    channelTitle: 'My Channel',
    channelUrl: 'https://www.youtube.com/channel/UCxyz',
  },
  videoCount: 10,
  totalComments: 2000,
  sentimentBreakdown: {
    positive: 180,
    neutral: 1700,
    negative: 120,
  },
  topTopics: [
    { label: 'technology', count: 450 },
    { label: 'innovation', count: 320 },
  ],
  takeaways: [
    {
      title: 'Your audience loves technical deep-dives',
      detail:
        'Videos with "technology" and "innovation" themes get 2.3x more positive engagement.',
    },
  ],
};

{typeof ChannelAggregate !== 'undefined' ? (

  <ChannelAggregate channelAggregate={channelAggregate} />
) : (
  <div className="callout">
    <strong>Missing widget:</strong> ChannelAggregate
  </div>
)}
```

## Output conventions

1. **File location**: `content/platforms/youtube/channels/<channelId>/channel-aggregate.mdx`
2. **Data focus**: Aggregated, not duplicative. Don't list every video's full analytics.
3. **Topics**: Keep `topTopics` to 8 or fewer items; merge near-duplicates.
4. **Counts**: If you merge topics, keep `count <= totalComments`.
5. **Takeaways**: Limit to 3 channel-level insights.

## Verification

After generation:

```bash
bun run content:generate
bun run typecheck
bun run lint
bun run build
```

Navigate to `/channel/youtube/<channelId>` to view the channel page.
