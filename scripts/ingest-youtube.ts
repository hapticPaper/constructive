import { createHash } from 'node:crypto';
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

function parseArgs(argv: string[]): {
  input: string;
  maxComments: number | 'all';
  forceFullScan: boolean;
} {
  const positionals: string[] = [];
  let maxComments: number | 'all' = 'all';
  let forceFullScan = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--force-full-scan') {
      forceFullScan = true;
      continue;
    }

    if (arg === '--max-comments') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --max-comments.');
      i += 1;

      if (value.toLowerCase() === 'all') {
        maxComments = 'all';
      } else {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(
            'Invalid --max-comments value (must be a positive number or "all").',
          );
        }
        maxComments = n;
      }
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length !== 1) {
    throw new Error(
      'Usage: bun run ingest:youtube -- <videoUrlOrId> [--max-comments <N|all>] [--force-full-scan]',
    );
  }

  return { input: positionals[0], maxComments, forceFullScan };
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

function normalizeCommentText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isContinuationNotFoundError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes('continuation') && message.includes('not found');
}

function mergeCommentRecord(params: {
  id: string;
  existing: CommentRecord | undefined;
  fetched: {
    text: string | undefined;
    authorName: string | undefined;
    publishedAt: string | undefined;
    likeCount: number | undefined;
    syntheticId: true | undefined;
  };
}): CommentRecord | null {
  const text = params.fetched.text || params.existing?.text;
  if (!text) return null;

  return {
    id: params.id,
    syntheticId: params.existing?.syntheticId ?? params.fetched.syntheticId,
    authorName: params.fetched.authorName ?? params.existing?.authorName,
    publishedAt: params.fetched.publishedAt ?? params.existing?.publishedAt,
    likeCount: params.fetched.likeCount ?? params.existing?.likeCount,
    text,
  };
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
  const directText = toStringSafe(asObj.text).trim();
  const fromDirectText = parseCountFromText(directText);
  if (typeof fromDirectText === 'number') return fromDirectText;

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

function extractCommentAuthorName(
  commentRec: Record<string, unknown> | null,
): string | undefined {
  if (typeof commentRec?.author === 'string') return commentRec.author;
  const authorRec = asRecord(commentRec?.author);
  const name = toStringSafe(authorRec?.name).trim();
  return name || undefined;
}

function extractCommentPublishedAt(
  commentRec: Record<string, unknown> | null,
): string | undefined {
  if (typeof commentRec?.published === 'string') return commentRec.published;
  if (typeof commentRec?.published_time === 'string') return commentRec.published_time;
  return undefined;
}

function syntheticCommentId(params: {
  videoId: string;
  authorName?: string;
  text: string;
}): string {
  const hash = createHash('sha256')
    .update(`${params.videoId}\n${params.authorName ?? ''}\n${params.text}`)
    .digest('hex')
    .slice(0, 32);
  return `synthetic:${hash}`;
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
      syntheticId: rec.syntheticId === true ? true : undefined,
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
    like_count?: unknown;
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
  const {
    input,
    maxComments: maxCommentsArg,
    forceFullScan,
  } = parseArgs(process.argv.slice(2));
  const videoId = extractVideoId(input);
  if (!videoId) throw new Error('Could not parse a YouTube video id from input.');

  const existingComments = await readExistingComments(
    commentsJsonPath('youtube', videoId),
  );
  const existingIngestion = asRecord(
    await readJsonMaybe(ingestionMetaPath('youtube', videoId)),
  );
  const wasPreviouslyCompleteConfirmed =
    existingIngestion?.commentsCompleteConfirmed === true;
  const resumeEnabled = wasPreviouslyCompleteConfirmed && !forceFullScan;

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
  const likeCount =
    parseCount(info.basic_info?.like_count) ?? parseCount(info.primary_info?.like_count);

  const existingIds = new Set<string>();
  const existingById = new Map<string, CommentRecord>();
  for (const comment of existingComments) {
    existingIds.add(comment.id);
    existingById.set(comment.id, comment);
  }

  const maxComments =
    maxCommentsArg === 'all' ? Number.POSITIVE_INFINITY : maxCommentsArg;

  const fetchedComments: CommentRecord[] = [];
  const seenIds = new Set<string>();
  let pagesFetched = 0;
  let newCommentCount = 0;
  let cursor = (await yt.getComments(
    videoId,
    'NEWEST_FIRST',
  )) as unknown as CommentsCursor;
  let reachedEnd = false;
  let stoppedBecauseNoNew = false;
  let stoppedBecauseContinuationNotFound = false;
  let consecutiveNoNewPages = 0;
  let lastFingerprint: string | null = null;
  let consecutiveFingerprintRepeats = 0;
  let paginationLoopGuardTriggered = false;
  while (cursor && fetchedComments.length < maxComments) {
    pagesFetched += 1;
    const maybeThreads = cursor.contents ?? cursor.comments ?? [];
    const threads = Array.isArray(maybeThreads) ? maybeThreads : [];

    const fingerprint = (() => {
      const ids: string[] = [];
      const head = threads.slice(0, 3);
      const tail = threads.slice(-3);
      for (const thread of [...head, ...tail]) {
        const threadRec = asRecord(thread);
        const commentRaw = threadRec?.comment ?? thread;
        const commentRec = asRecord(commentRaw);
        const commentId =
          typeof commentRec?.comment_id === 'string' ? commentRec.comment_id.trim() : '';
        if (commentId) ids.push(commentId);
      }
      return ids.join('|');
    })();

    if (fingerprint) {
      if (fingerprint === lastFingerprint) {
        consecutiveFingerprintRepeats += 1;
      } else {
        lastFingerprint = fingerprint;
        consecutiveFingerprintRepeats = 0;
      }

      if (consecutiveFingerprintRepeats >= 2) {
        paginationLoopGuardTriggered = true;
        break;
      }
    }

    let newThisPage = 0;
    for (const thread of threads) {
      const threadRec = asRecord(thread);
      const commentRaw = threadRec?.comment ?? thread;
      const commentRec = asRecord(commentRaw);

      const realId =
        typeof commentRec?.comment_id === 'string' ? commentRec.comment_id : null;
      const knownId = realId?.trim() || null;

      let id = knownId;
      const fetchedAuthorName = extractCommentAuthorName(commentRec);
      const fetchedRawText = toStringSafe(commentRec?.content ?? commentRec?.text);
      const fetchedText = normalizeCommentText(fetchedRawText);

      if (!id) {
        if (!fetchedText) continue;

        id = syntheticCommentId({ videoId, authorName: fetchedAuthorName, text: fetchedText });
      }

      if (seenIds.has(id)) continue;

      const existing = existingById.get(id);
      const publishedAt = extractCommentPublishedAt(commentRec);
      const likeCount = parseCount(commentRec?.like_count);

      const merged = mergeCommentRecord({
        id,
        existing,
        fetched: {
          syntheticId: id.startsWith('synthetic:') ? true : undefined,
          authorName: fetchedAuthorName,
          publishedAt,
          likeCount,
          text: fetchedText || undefined,
        },
      });
      if (!merged) continue;

      fetchedComments.push(merged);

      if (!existing) {
        newThisPage += 1;
        newCommentCount += 1;
      }

      seenIds.add(id);
      if (fetchedComments.length >= maxComments) break;
    }

    if (fetchedComments.length >= maxComments) break;

    if (threads.length > 0) {
      consecutiveNoNewPages = newThisPage === 0 ? consecutiveNoNewPages + 1 : 0;

      if (resumeEnabled && consecutiveNoNewPages >= 2) {
        stoppedBecauseNoNew = true;
        break;
      }
    }

    if (typeof cursor.getContinuation !== 'function') {
      reachedEnd = true;
      break;
    }

    try {
      cursor = (await cursor.getContinuation()) as unknown as CommentsCursor;
    } catch (error) {
      if (isContinuationNotFoundError(error)) {
        stoppedBecauseContinuationNotFound = true;
        break;
      }
      throw error;
    }
  }

  if (paginationLoopGuardTriggered) {
    process.stderr.write(
      `Warning: detected possible pagination loop for ${videoId}; stopping early.\n`,
    );
    process.exitCode = 1;
  }

  if (stoppedBecauseContinuationNotFound) {
    process.stderr.write(
      `Warning: continuation not found for ${videoId}; stopping comment pagination early.\n`,
    );
    process.exitCode = 1;
  }

  const remainingExisting = existingComments.filter(
    (comment) => !seenIds.has(comment.id),
  );
  const fetchedPlusExisting = [...fetchedComments, ...remainingExisting];

  const newComments = resumeEnabled
    ? fetchedPlusExisting.filter((comment) => !existingIds.has(comment.id))
    : [];
  const newCommentIds = new Set<string>(newComments.map((comment) => comment.id));

  const finalComments = resumeEnabled
    ? [
        ...newComments,
        ...existingComments.filter((comment) => !newCommentIds.has(comment.id)),
      ]
    : fetchedPlusExisting;

  const truncatedByLimit =
    maxComments !== Number.POSITIVE_INFINITY && finalComments.length > maxComments;
  const commentRecords = truncatedByLimit
    ? finalComments.slice(0, maxComments)
    : finalComments;

  const commentsCompleteConfirmed =
    !paginationLoopGuardTriggered &&
    !truncatedByLimit &&
    (wasPreviouslyCompleteConfirmed || reachedEnd);
  const commentsComplete =
    !paginationLoopGuardTriggered &&
    !truncatedByLimit &&
    (reachedEnd || stoppedBecauseNoNew || stoppedBecauseContinuationNotFound);

  const status = paginationLoopGuardTriggered
    ? 'warning-pagination-loop'
    : stoppedBecauseContinuationNotFound
      ? 'warning-continuation-not-found'
      : 'ok';

  if (typeof viewCount === 'number' || typeof likeCount === 'number') {
    const reachPath = reachJsonPath('youtube', videoId);
    const existingReach = await readExistingReach(reachPath);
    const reach: VideoReach = existingReach ?? {
      schema: 'constructive.video-reach@v1',
      platform: 'youtube',
      videoId,
      snapshots: [],
    };
    const lastSnapshot = reach.snapshots.at(-1);
    if (
      !lastSnapshot ||
      lastSnapshot.viewCount !== viewCount ||
      lastSnapshot.likeCount !== likeCount
    ) {
      reach.snapshots.push({ capturedAt: now, viewCount, likeCount });
    }
    await writeJsonFile(reachPath, reach);
  }

  await writeJsonFile(videoJsonPath('youtube', videoId), video);
  await writeJsonFile(commentsJsonPath('youtube', videoId), commentRecords);
  await writeJsonFile(ingestionMetaPath('youtube', videoId), {
    status,
    ingestedAt: now,
    maxComments: maxCommentsArg === 'all' ? undefined : maxCommentsArg,
    commentCount: commentRecords.length,
    commentsComplete,
    commentsCompleteConfirmed,
    pagesFetched,
    newCommentCount,
    existingCommentCount: existingComments.length,
    paginationLoopGuardTriggered: paginationLoopGuardTriggered ? true : undefined,
    continuationNotFound: stoppedBecauseContinuationNotFound ? true : undefined,
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
