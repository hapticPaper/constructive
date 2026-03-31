This repo is a GitHub-Pages-friendly “comment analytics” demo targeted at creators and social media managers.

It’s intentionally file-backed: the ingestion + analytics steps persist structured artifacts into `content/` (git as the database), and the frontend renders those artifacts as widgets + MDX.

## Architecture (modular services)

1. **Backend (file DB + connectors)**
   - `scripts/ingest-youtube.ts` connects to YouTube, fetches video metadata + a comment snapshot, and writes JSON into `content/platforms/youtube/videos/<videoId>/`.
   - `scripts/ingest-instagram.ts` and `scripts/ingest-tiktok.ts` import metadata + comment exports from JSON and normalize them into the same on-disk format.
2. **Analytics (Charlie playbook)**
   - A Charlie playbook generates:
     - `analytics.json` (aggregations)
     - `report.mdx` (creator-friendly summary; harsh language is excluded from quotes)
3. **API/Middleware (future-facing)**
   - For this GitHub Pages MVP, the “API layer” is the stable file format in `content/` + `scripts/generate-content-index.ts` which produces an importable index.
4. **Frontend**
   - Vite + React + MDX. Widgets live in `src/widgets/` and can be used in MDX reports.

## Local development

```bash
bun install

# build content index from whatever is in content/
bun run content:generate

# dev server
bun run dev
```

## Ingest + analyze a YouTube video

```bash
# fetch metadata + comments
bun run ingest:youtube -- https://www.youtube.com/watch?v=IPsu4pMpIjk --max-comments 200

# generate analytics.json + report.mdx (creator-friendly)
bun run content:analyze -- --video youtube:IPsu4pMpIjk

# refresh the build-time index used by the frontend
bun run content:generate
```

The analysis script is designed to be idempotent: it only generates artifacts that are missing, unless
`--overwrite` is passed.

## Ingest + analyze an Instagram or TikTok post (JSON import)

Instagram and TikTok support the same on-disk schema as YouTube (a `video.json` + `comments.json` snapshot under `content/platforms/<platform>/videos/<videoId>/`).

These platforms require an external comment export (any JSON array with a `text` field works; the importer also supports a few common keys like `comment`, `message`, `content`, plus basic metadata fields).

```bash
# Instagram
bun run ingest:instagram -- https://www.instagram.com/reel/<shortcode>/ \
  --title "My reel" \
  --channel-id myhandle \
  --channel-title "My Name" \
  --comments /absolute/or/relative/path/to/comments.json

bun run content:analyze -- --video instagram:<shortcode>

# TikTok
bun run ingest:tiktok -- https://www.tiktok.com/@user/video/<id> \
  --title "My TikTok" \
  --channel-id user \
  --channel-title "User" \
  --comments /absolute/or/relative/path/to/comments.json

bun run content:analyze -- --video tiktok:<id>

# refresh the build-time index used by the frontend
bun run content:generate
```

## Deploy

GitHub Pages deploy is handled via `.github/workflows/pages.yml`.
