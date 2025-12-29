This repo is a GitHub-Pages-friendly “comment analytics” demo targeted at creators and social media managers.

It’s intentionally file-backed: the ingestion + analytics steps persist structured artifacts into `content/` (git as the database), and the frontend renders those artifacts as widgets + MDX.

## Architecture (modular services)

1. **Backend (file DB + connectors)**
   - `scripts/ingest-youtube.ts` connects to YouTube, fetches video metadata + a comment snapshot, and writes JSON into `content/platforms/youtube/channels/<channelId>/videos/<videoId>/`.
   - Legacy content at `content/platforms/youtube/videos/<videoId>/` remains readable via the `resolve*` helpers in `scripts/paths.ts`.
2. **Analytics (playbook-style)**
   - `scripts/analyze-comments.ts` reads `comments.json` and writes:
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

# run the analytics “playbook”
bun run analyze -- --platform youtube --video IPsu4pMpIjk

# refresh the build-time index used by the frontend
bun run content:generate
```

## Deploy

GitHub Pages deploy is handled via `.github/workflows/pages.yml`.
