import { Innertube } from 'youtubei.js';

import type { CommentRecord, VideoMetadata } from '../src/content/types';

import { writeJsonFile } from './fs';
import {
  channelJsonPath,
  commentsJsonPath,
  ingestionMetaPath,
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

function parseArgs(argv: string[]): { input: string; maxComments: number } {
  const maxIndex = argv.indexOf('--max-comments');
  const maxCommentsRaw = maxIndex >= 0 ? argv[maxIndex + 1] : undefined;
  const maxComments = maxCommentsRaw ? Number(maxCommentsRaw) : 200;
  if (!Number.isFinite(maxComments) || maxComments <= 0) {
    throw new Error('Invalid --max-comments value.');
  }

  const input = argv.find((a) => !a.startsWith('-'));
  if (!input) {
    throw new Error('Usage: bun run ingest:youtube -- <videoUrlOrId> [--max-comments 200]');
  }

  return { input, maxComments };
}

function toStringSafe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    return value.toString();
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

type YouTubeInfo = {
  primary_info?: {
    title?: unknown;
    published?: unknown;
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
  const { input, maxComments } = parseArgs(process.argv.slice(2));
  const videoId = extractVideoId(input);
  if (!videoId) throw new Error('Could not parse a YouTube video id from input.');

  const yt = await Innertube.create();
  const info = (await yt.getInfo(videoId)) as unknown as YouTubeInfo;

  const title = toStringSafe(info?.primary_info?.title);
  const publishedAt = toStringSafe(info?.primary_info?.published);
  const description = toStringSafe(info?.secondary_info?.description);

  const author = info.secondary_info?.owner?.author;
  const channelId = typeof author?.id === 'string' ? author.id : '';
  const channelTitle = typeof author?.name === 'string' ? author.name : '';
  const channelUrl = typeof author?.url === 'string' ? author.url : undefined;

  if (!channelId) {
    throw new Error(
      `Could not resolve a channel id for ${videoId} (input: ${input}). This is required for channel-scoped storage.`,
    );
  }

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
      channelUrl: channelUrl ?? (channelId ? `https://www.youtube.com/channel/${channelId}` : undefined),
    },
    publishedAt: publishedAt || undefined,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };

  const commentRecords: CommentRecord[] = [];
  let cursor = (await yt.getComments(videoId)) as unknown as CommentsCursor;
  while (cursor && commentRecords.length < maxComments) {
    const maybeThreads = cursor.contents ?? cursor.comments ?? [];
    const threads = Array.isArray(maybeThreads) ? maybeThreads : [];
    for (const thread of threads) {
      const threadRec = asRecord(thread);
      const commentRaw = threadRec?.comment ?? thread;
      const commentRec = asRecord(commentRaw);
      const text = toStringSafe(commentRec?.content ?? commentRec?.text);
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;
      commentRecords.push({
        id: String(
          commentRec?.comment_id ?? commentRec?.id ?? `${videoId}:${commentRecords.length}`,
        ),
        authorName: typeof commentRec?.author === 'string' ? commentRec.author : undefined,
        publishedAt:
          typeof commentRec?.published === 'string'
            ? commentRec.published
            : typeof commentRec?.published_time === 'string'
              ? commentRec.published_time
              : undefined,
        likeCount:
          typeof commentRec?.vote_count === 'number' ? commentRec.vote_count : undefined,
        text: cleaned,
      });
      if (commentRecords.length >= maxComments) break;
    }

    if (commentRecords.length >= maxComments) break;
    if (typeof cursor.getContinuation !== 'function') break;
    cursor = (await cursor.getContinuation()) as unknown as CommentsCursor;
  }

  await writeJsonFile(channelJsonPath('youtube', channelId), video.channel);
  await writeJsonFile(videoJsonPath('youtube', channelId, videoId), video);
  await writeJsonFile(commentsJsonPath('youtube', channelId, videoId), commentRecords);
  await writeJsonFile(ingestionMetaPath('youtube', channelId, videoId), {
    ingestedAt: new Date().toISOString(),
    maxComments,
    commentCount: commentRecords.length,
  });

  process.stdout.write(
    `Ingested ${commentRecords.length} comments for ${videoId} (${video.title}).\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
