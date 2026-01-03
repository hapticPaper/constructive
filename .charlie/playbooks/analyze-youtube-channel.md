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
   bun run ingest:youtube -- <YOUTUBE_URL_OR_ID> --max-comments <N>
   bun run content:analyze -- --video youtube:<videoId>
   ```

2. Run the channel aggregation script:

   ```bash
   bun run content:analyze-channel -- youtube:<channelId>
   ```

   This script will:
   - Find all videos for the given channel
   - Aggregate analytics across all videos
   - Generate channel-level insights
   - Create the channel aggregation MDX file

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
  
  // Summary stats across all analyzed videos
  summary: {
    videoCount: number;
    totalComments: number;
    analyzedVideos: number;
    avgCommentsPerVideo: number;
    lastAnalyzedAt: string;
  };
  
  // Aggregated sentiment across all videos
  aggregateSentiment: {
    positive: number;
    neutral: number;
    negative: number;
    avgToxicRate: number;
  };
  
  // Recurring themes across the channel
  channelThemes: {
    topics: Array<{ label: string; count: number; videoCount: number }>;
    people: Array<{ label: string; count: number; videoCount: number }>;
  };
  
  // Videos that need attention
  videosNeedingAttention: Array<{
    videoId: string;
    title: string;
    reason: string; // "High question rate" | "High negative sentiment" | "High toxic rate"
    metric: number;
  }>;
  
  // Top performing videos (by positive sentiment)
  topVideos: Array<{
    videoId: string;
    title: string;
    commentCount: number;
    positiveRate: number;
  }>;
  
  // Channel-level takeaways
  takeaways: Array<{
    title: string;
    detail: string;
  }>;
};
```

**Example MDX structure:**

```mdx
export const channelAggregate = {
  schema: 'constructive.channel-aggregate@v1',
  generatedAt: '2026-01-03T12:00:00.000Z',
  channel: {
    platform: 'youtube',
    channelId: 'UCxyz',
    channelTitle: 'My Channel',
    channelUrl: 'https://www.youtube.com/channel/UCxyz'
  },
  summary: {
    videoCount: 10,
    totalComments: 2000,
    analyzedVideos: 10,
    avgCommentsPerVideo: 200,
    lastAnalyzedAt: '2026-01-03T12:00:00.000Z'
  },
  aggregateSentiment: {
    positive: 180,
    neutral: 1700,
    negative: 120,
    avgToxicRate: 0.02
  },
  channelThemes: {
    topics: [
      { label: 'technology', count: 450, videoCount: 8 },
      { label: 'innovation', count: 320, videoCount: 7 }
    ],
    people: [
      { label: 'john', count: 150, videoCount: 5 }
    ]
  },
  videosNeedingAttention: [
    {
      videoId: 'abc123',
      title: 'Controversial Topic Discussion',
      reason: 'High negative sentiment',
      metric: 0.35
    }
  ],
  topVideos: [
    {
      videoId: 'xyz789',
      title: 'Great Tutorial',
      commentCount: 300,
      positiveRate: 0.45
    }
  ],
  takeaways: [
    {
      title: 'Your audience loves technical deep-dives',
      detail: 'Videos with "technology" and "innovation" themes get 2.3x more positive engagement.'
    }
  ]
};

{typeof ChannelAggregate !== 'undefined' ? <ChannelAggregate aggregate={channelAggregate} /> : (
  <div className="callout">
    <strong>Missing widget:</strong> ChannelAggregate
  </div>
)}
```

## Output conventions

1. **File location**: `content/platforms/youtube/channels/<channelId>/channel-aggregate.mdx`
2. **Data focus**: Aggregated, not duplicative. Don't list every video's full analytics.
3. **Attention triggers**: Flag videos with question rates > 15%, negative sentiment > 25%, or toxic rates > 5%.
4. **Themes**: Only include topics/people that appear in 3+ videos.
5. **Top videos**: Limit to 5 videos, ranked by positive sentiment rate.
6. **Takeaways**: Limit to 3 channel-level insights.

## Verification

After generation:

```bash
bun run content:generate
bun run typecheck
bun run lint
bun run build
```

Navigate to `/channel/youtube/<channelId>` to view the channel page.
