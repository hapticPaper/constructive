# Ingest + analyze a YouTube video

## Overview

Ingest a YouTube video’s metadata + comment snapshot into `content/`, then generate the corresponding `analytics.json` + `report.mdx` artifacts so the demo site can render the video.

## Prerequisites

- Devbox access (to run `bun` scripts)
- `bun install` has been run

## Steps

1. Ingest video metadata + comments:

   ```bash
   bun run ingest:youtube -- <YOUTUBE_URL_OR_ID> --max-comments <N>
   ```

2. Read:

   - `content/platforms/youtube/videos/<videoId>/video.json`
   - `content/platforms/youtube/videos/<videoId>/comments.json`

3. Generate `content/platforms/youtube/videos/<videoId>/analytics.json` matching `CommentAnalytics` in `src/content/types.ts`.

4. Generate `content/platforms/youtube/videos/<videoId>/report.mdx`.

   - Keep it short and creator-friendly.
   - Prefer actionable takeaways.
   - Use existing widgets from `src/widgets/*` when helpful (e.g. `<Callout />`).

5. Refresh the build-time content index:

   ```bash
   bun run content:generate
   ```

6. Commit and open (or update) a PR with:

   - the new/updated `content/` artifacts
   - updated `src/content/generated/*`

## Verify

```bash
bun run typecheck
bun run lint
bun run build
```
