# Ingest + analyze a YouTube video

## Overview

Ingest a YouTube video’s metadata + comment snapshot into `content/`, then generate the corresponding `analytics.json` + `report.mdx` artifacts so the demo site can render the video.

This playbook produces **actionable, aggregated takeaways**. The goal is to avoid recreating the “scrolling experience” (lots of similar quotes) and instead surface:

- The top things people cared about (topics)
- The top things people cared about *re: the host/guest* (people)
- A short list of distilled, creator-friendly takeaways (think “30-second summary”)

Not every video will have every section: the report is split into **core** and **optional** sections, and the UI only renders the sections that have signal.

## Prerequisites

- Devbox access (to run `bun` scripts)
- `bun install` has been run

## Steps

1. Ingest video metadata + comments:

   ```bash
   # Defaults to fetching all comments.
   bun run ingest:youtube -- <YOUTUBE_URL_OR_ID>

   # Optional: use a smaller max when iterating.
   bun run ingest:youtube -- <YOUTUBE_URL_OR_ID> --max-comments <N>
   ```

2. Read:
   - `content/platforms/youtube/videos/<videoId>/video.json`
   - `content/platforms/youtube/videos/<videoId>/comments.json`

3. Generate analytics + report artifacts:

   ```bash
   bun run content:analyze -- --video youtube:<videoId>
   ```

## Output formats

### `analytics.json`

`content/platforms/youtube/videos/<videoId>/analytics.json` is the structured aggregation artifact consumed by the frontend.

Key fields (current schema):

```ts
type CommentAnalytics = {
  schema: 'constructive.comment-analytics@v2';
  commentCount: number;
  analyzedAt: string;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  toxicCount: number;
  questionCount: number;
  suggestionCount: number;

  // Core: separate “topic” words from “people” words so host/guest chatter doesn’t pollute topic histograms.
  themes: {
    topics: Array<{ label: string; count: number }>;
    people: Array<{ label: string; count: number }>;
  };

  // A few examples for grounding (not exhaustive).
  highlights: {
    questions: string[];
    suggestions: string[];
    quotes: string[];
  };

  // The “dimensionality reduction” output: up to ~3 items.
  takeaways: Array<{ title: string; detail: string }>;
};
```

Note: the analyzer validates `schema` at runtime. If a cached `analytics.json` doesn’t match the current schema, re-run `bun run content:analyze -- --overwrite` to regenerate it.

### `report.mdx`

`content/platforms/youtube/videos/<videoId>/report.mdx` is the presentation artifact. It exports a `report` object and renders it via the `<Report />` widget (injected via `MDXProvider`).

Core idea: `report.mdx` should be mostly **data**, not prose.

```mdx
export const report = {
  schema: 'constructive.comment-report@v2',
  generatedAt: '…',
  video: { platform: 'youtube', videoId: '…', title: '…', channelTitle: '…', videoUrl: '…' },
  snapshot: { commentCount: 0, sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 }, toxicCount: 0, questionCount: 0, suggestionCount: 0 },
  core: { takeaways: [], topics: [], questions: [], suggestions: [] },
  optional: { people: [], quotes: [] },
};

{typeof Report !== 'undefined' ? <Report report={report} /> : (
  <div className="callout">
    <strong>Missing widget:</strong> Report
  </div>
)}
```

**Core sections** (rendered when present): Snapshot, 30-second takeaways, Topics.

**Optional sections** (rendered only when non-empty): People mentioned (host/guest), Questions, Suggestions, Representative quotes.

4. Refresh the build-time content index:

   ```bash
   bun run content:generate
   ```

5. Commit and open (or update) a PR with:
   - the new/updated `content/` artifacts
   - updated `src/content/generated/*`

## Verify

```bash
bun run typecheck
bun run lint
bun run build
```
