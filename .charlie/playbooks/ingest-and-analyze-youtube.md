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

3. Generate analytics + report artifacts:

   ```bash
   bun run content:analyze -- --video youtube:<videoId>
   ```

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
