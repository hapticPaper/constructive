import { readFile } from 'node:fs/promises';

import { Innertube } from 'youtubei.js';

import type { CommentRecord, VideoMetadata, VideoReach } from '../src/content/types';

import { writeJsonFile } from './fs';
import {
  commentsJsonPath,
  ingestionMetaPath,
  reachJsonPath,
  videoJsonPath,
} from './paths';

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.endsWith('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    }
  } catch {
    // ignore
  }

  return null;
}

function parseArgs(argv: string[]): { input: string; maxComments: number | null } {
  const maxIndex = argv.indexOf('--max-comments');
  const maxCommentsRaw = maxIndex >= 0 ? argv[maxIndex + 1] : undefined;
  const maxComments = maxCommentsRaw ? Number(maxCommentsRaw) : null;
  if (maxComments !== null && (!Number.isFinite(maxComments) || maxComments <= 0)) {
    throw new Error('Invalid --max-comments value (must be a positive number).');
  }

  const input = argv.find((a) => !a.startsWith('-'));
  if (!input) {
    throw new Error(
      'Usage: bun run ingest:youtube -- <videoUrlOrId> [--max-comments <N>]',
    );
  }

  return { input, maxComments };
}

function toStringSafe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    return value.toString();
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function parseCountFromText(text: string): number | undefined {
  const raw = text.trim();
  if (!raw) return undefined;

  const normalized = raw.replace(/,/g, '');
  const match = normalized.match(/(\d+(?:\.\d+)?)(?:\s*([KMB]))?/i);
  if (!match) return undefined;

  const num = Number(match[1]);
  if (!Number.isFinite(num)) return undefined;

  const suffix = match[2]?.toUpperCase();
  switch (suffix) {
    case 'K':
      return Math.round(num * 1_000);
    case 'M':
      return Math.round(num * 1_000_000);
    case 'B':
      return Math.round(num * 1_000_000_000);
    default:
      return Math.round(num);
  }
}

function parseCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return parseCountFromText(value);

  const asObj = asRecord(value);
  if (!asObj) return undefined;

  // youtubei.js uses "Text" objects in a few places.
  const fromToString = parseCountFromText(toStringSafe(asObj));
  if (typeof fromToString === 'number') return fromToString;

  const viewCount = asRecord(asObj.view_count);
  if (viewCount) {
    const viewCountText = toStringSafe(viewCount.text);
    const fromViewCountText = parseCountFromText(viewCountText);
    if (typeof fromViewCountText === 'number') return fromViewCountText;
  }

  const shortViewCount = asRecord(asObj.short_view_count);
  if (shortViewCount) {
    const shortViewCountText = toStringSafe(shortViewCount.text);
    const fromShort = parseCountFromText(shortViewCountText);
    if (typeof fromShort === 'number') return fromShort;
  }

  return undefined;
}

async function readJsonMaybe(filePath: string): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function readExistingComments(filePath: string): Promise<CommentRecord[]> {
  const parsed = await readJsonMaybe(filePath);
  if (!Array.isArray(parsed)) return [];

  const out: CommentRecord[] = [];
  for (const item of parsed) {
    const rec = asRecord(item);
    if (!rec) continue;
    if (typeof rec.id !== 'string' || !rec.id) continue;
    if (typeof rec.text !== 'string' || !rec.text) continue;

    out.push({
      id: rec.id,
      authorName: typeof rec.authorName === 'string' ? rec.authorName : undefined,
      publishedAt: typeof rec.publishedAt === 'string' ? rec.publishedAt : undefined,
      likeCount: typeof rec.likeCount === 'number' ? rec.likeCount : undefined,
      text: rec.text,
    });
  }

  return out;
}

async function readExistingReach(filePath: string): Promise<VideoReach | null> {
  const parsed = await readJsonMaybe(filePath);
  const obj = asRecord(parsed);
  if (!obj) return null;

  if (obj.schema !== 'constructive.video-reach@v1') return null;
  if (obj.platform !== 'youtube') return null;
  if (typeof obj.videoId !== 'string' || !obj.videoId) return null;
  if (!Array.isArray(obj.snapshots)) return null;

  const snapshots: VideoReach['snapshots'] = [];
  for (const snap of obj.snapshots) {
    const snapRec = asRecord(snap);
    if (!snapRec) continue;
    if (typeof snapRec.capturedAt !== 'string' || !snapRec.capturedAt) continue;
    snapshots.push({
      capturedAt: snapRec.capturedAt,
      viewCount: typeof snapRec.viewCount === 'number' ? snapRec.viewCount : undefined,
      likeCount: typeof snapRec.likeCount === 'number' ? snapRec.likeCount : undefined,
    });
  }

  return {
    schema: 'constructive.video-reach@v1',
    platform: 'youtube',
    videoId: obj.videoId,
    snapshots,
  };
}

type YouTubeInfo = {
  basic_info?: {
    like_count?: unknown;
    view_count?: unknown;
  };
  primary_info?: {
    title?: unknown;
    published?: unknown;
    view_count?: unknown;
  };
  secondary_info?: {
    description?: unknown;
    owner?: {
      author?: {
        id?: unknown;
        name?: unknown;
        url?: unknown;
      };
    };
  };
};

type CommentsCursor = {
  contents?: unknown;
  comments?: unknown;
  getContinuation?: () => Promise<unknown>;
};

async function main(): Promise<void> {
  const { input, maxComments: maxCommentsArg } = parseArgs(process.argv.slice(2));
  const videoId = extractVideoId(input);
  if (!videoId) throw new Error('Could not parse a YouTube video id from input.');

  const existingComments = await readExistingComments(
    commentsJsonPath('youtube', videoId),
  );
  const existingIngestion = asRecord(
    await readJsonMaybe(ingestionMetaPath('youtube', videoId)),
  );
  const wasPreviouslyComplete = existingIngestion?.commentsComplete === true;

  const yt = await Innertube.create();
  const info = (await yt.getInfo(videoId)) as unknown as YouTubeInfo;

  const title = toStringSafe(info?.primary_info?.title);
  const publishedAt = toStringSafe(info?.primary_info?.published);
  const description = toStringSafe(info?.secondary_info?.description);

  const author = info.secondary_info?.owner?.author;
  const channelId = toStringSafe(author?.id).trim();
  const channelTitle = toStringSafe(author?.name).trim();
  const channelUrl = toStringSafe(author?.url).trim() || undefined;

  const video: VideoMetadata = {
    platform: 'youtube',
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    description: description || undefined,
    channel: {
      platform: 'youtube',
      channelId,
      channelTitle,
      channelUrl:
        channelUrl ??
        (channelId ? `https://www.youtube.com/channel/${channelId}` : undefined),
    },
    publishedAt: publishedAt || undefined,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };

  const now = new Date().toISOString();
  const viewCount =
    parseCount(info.primary_info?.view_count) ?? parseCount(info.basic_info?.view_count);
  const likeCount = parseCount(info.basic_info?.like_count);

  if (typeof viewCount === 'number' || typeof likeCount === 'number') {
    const reachPath = reachJsonPath('youtube', videoId);
    const existingReach = await readExistingReach(reachPath);
    const reach: VideoReach = existingReach ?? {
      schema: 'constructive.video-reach@v1',
      platform: 'youtube',
      videoId,
      snapshots: [],
    };
    reach.snapshots.push({ capturedAt: now, viewCount, likeCount });
    await writeJsonFile(reachPath, reach);
  }

  const existingById = new Map<string, CommentRecord>();
  for (const comment of existingComments) {
    existingById.set(comment.id, comment);
  }

  const maxComments = maxCommentsArg ?? Number.POSITIVE_INFINITY;

  const commentRecords: CommentRecord[] = [];
  const seenIds = new Set<string>();
  let pagesFetched = 0;
  let newCommentCount = 0;
  let cursor = (await yt.getComments(
    videoId,
    'NEWEST_FIRST',
  )) as unknown as CommentsCursor;
  let reachedEnd = false;
  while (cursor && commentRecords.length < maxComments) {
    pagesFetched += 1;
    const maybeThreads = cursor.contents ?? cursor.comments ?? [];
    const threads = Array.isArray(maybeThreads) ? maybeThreads : [];

    let newThisPage = 0;
    for (const thread of threads) {
      const threadRec = asRecord(thread);
      const commentRaw = threadRec?.comment ?? thread;
      const commentRec = asRecord(commentRaw);

      const id =
        typeof commentRec?.comment_id === 'string' ? commentRec.comment_id : null;
      if (!id) continue;
      if (seenIds.has(id)) continue;

      const existing = existingById.get(id);
      if (existing) {
        commentRecords.push(existing);
      } else {
        const text = toStringSafe(commentRec?.content ?? commentRec?.text);
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (!cleaned) continue;

        const authorName = (() => {
          if (typeof commentRec?.author === 'string') return commentRec.author;
          const authorRec = asRecord(commentRec?.author);
          const name = toStringSafe(authorRec?.name).trim();
          return name || undefined;
        })();

        const publishedAt =
          typeof commentRec?.published === 'string'
            ? commentRec.published
            : typeof commentRec?.published_time === 'string'
              ? commentRec.published_time
              : undefined;

        commentRecords.push({
          id,
          authorName,
          publishedAt,
          likeCount: parseCount(commentRec?.like_count),
          text: cleaned,
        });
        newThisPage += 1;
        newCommentCount += 1;
      }

      seenIds.add(id);
      if (commentRecords.length >= maxComments) break;
    }

    if (commentRecords.length >= maxComments) break;

    if (wasPreviouslyComplete && threads.length > 0 && newThisPage === 0) {
      break;
    }

    if (typeof cursor.getContinuation !== 'function') {
      reachedEnd = true;
      break;
    }

    cursor = (await cursor.getContinuation()) as unknown as CommentsCursor;
  }

  // If we stopped early (or hit maxComments), preserve previously captured comments.
  for (const comment of existingComments) {
    if (commentRecords.length >= maxComments) break;
    if (seenIds.has(comment.id)) continue;
    commentRecords.push(comment);
  }

  const commentsComplete =
    commentRecords.length >= maxComments ? false : wasPreviouslyComplete || reachedEnd;

  await writeJsonFile(videoJsonPath('youtube', videoId), video);
  await writeJsonFile(commentsJsonPath('youtube', videoId), commentRecords);
  await writeJsonFile(ingestionMetaPath('youtube', videoId), {
    ingestedAt: now,
    maxComments: maxCommentsArg ?? 'all',
    commentCount: commentRecords.length,
    commentsComplete,
    pagesFetched,
    newCommentCount,
    existingCommentCount: existingComments.length,
    reachCapturedAt:
      typeof viewCount === 'number' || typeof likeCount === 'number' ? now : undefined,
  });

  process.stdout.write(
    `Ingested ${commentRecords.length} comments for ${videoId} (${video.title}).\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
