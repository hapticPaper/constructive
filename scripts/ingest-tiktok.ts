import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CommentRecord, VideoMetadata } from '../src/content/types';

import { extractTikTokVideoId } from '../src/lib/tiktok';

import { ensureDir, writeJsonFile } from './fs';
import {
  commentsJsonPath,
  thumbnailPublicPath,
  thumbnailUrl,
  videoJsonPath,
} from './paths';
import { withPage } from './lib/playwright';
import { isHostOrSubdomain, normalizeOriginPath, tryParseUrl } from './url-utils';

type Args = {
  input: string;
  videoUrl?: string;
  maxComments: number;
  title?: string;
  channelId?: string;
  channelTitle?: string;
  channelUrl?: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
};

function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for ${arg}.`);
      }
      flags.set(arg, value);
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length !== 1) {
    throw new Error(
      'Usage: bun run ingest:tiktok -- <videoUrlOrId> [--video-url <tiktok.com url>] [--max-comments <n>]',
    );
  }

  const maxCommentsRaw = flags.get('--max-comments')?.trim();
  const maxComments = maxCommentsRaw ? Number.parseInt(maxCommentsRaw, 10) : 50;
  if (!Number.isFinite(maxComments) || maxComments < 0) {
    throw new Error('Invalid --max-comments: expected a non-negative integer.');
  }

  return {
    input: positionals[0],
    videoUrl: flags.get('--video-url'),
    maxComments,
    title: flags.get('--title'),
    channelId: flags.get('--channel-id'),
    channelTitle: flags.get('--channel-title'),
    channelUrl: flags.get('--channel-url'),
    description: flags.get('--description'),
    publishedAt: flags.get('--published-at'),
    thumbnailUrl: flags.get('--thumbnail-url'),
  };
}

type TikTokRehydration = {
  __DEFAULT_SCOPE__?: {
    ['webapp.video-detail']?: {
      itemInfo?: {
        itemStruct?: {
          id?: string;
          desc?: string;
          createTime?: number | string;
          author?: {
            uniqueId?: string;
            nickname?: string;
          };
        };
      };
    };
  };
};

type TikTokItemStruct = {
  id?: string;
  desc?: string;
  createTime?: number | string;
  author?: {
    uniqueId?: string;
    nickname?: string;
  };
};

async function scrapeTikTokVideo({
  videoUrl,
  videoId,
  maxComments,
}: {
  videoUrl: string;
  videoId: string;
  maxComments: number;
}): Promise<{
  video: VideoMetadata;
  comments: CommentRecord[];
  thumbnailFilePath: string;
}> {
  return withPage(async (page) => {
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(6_000);

    const rehydrationRaw = await page
      .locator('script#__UNIVERSAL_DATA_FOR_REHYDRATION__')
      .textContent();
    if (!rehydrationRaw) {
      throw new Error('Failed to read TikTok rehydration data.');
    }

    let item: TikTokItemStruct | null = null;
    try {
      const parsed = JSON.parse(rehydrationRaw) as TikTokRehydration;
      item =
        parsed.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct ?? null;
    } catch {
      item = null;
    }

    if (!item) {
      throw new Error('Failed to parse TikTok item metadata.');
    }

    const channelId = item.author?.uniqueId?.trim() ?? '';
    const channelTitle = item.author?.nickname?.trim() ?? channelId;
    const title = item.desc?.trim() ?? '';

    if (!title) {
      throw new Error('Failed to scrape TikTok caption/title.');
    }
    if (!channelId) {
      throw new Error('Failed to scrape TikTok author handle.');
    }

    const publishedAtSeconds =
      typeof item.createTime === 'number'
        ? item.createTime
        : typeof item.createTime === 'string'
          ? Number.parseInt(item.createTime, 10)
          : null;
    const publishedAt =
      typeof publishedAtSeconds === 'number' && Number.isFinite(publishedAtSeconds)
        ? new Date(publishedAtSeconds * 1000).toISOString()
        : undefined;

    const localThumbUrl = thumbnailUrl('tiktok', videoId);
    const video: VideoMetadata = {
      platform: 'tiktok',
      videoId,
      videoUrl,
      title,
      description: title,
      channel: {
        platform: 'tiktok',
        channelId,
        channelTitle,
        channelUrl: `https://www.tiktok.com/@${channelId}`,
      },
      publishedAt,
      thumbnailUrl: localThumbUrl,
    };

    const thumbPath = thumbnailPublicPath('tiktok', videoId);
    await ensureDir(path.dirname(thumbPath));
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
    });
    await writeFile(thumbPath, screenshot);

    const comments: CommentRecord[] = [];
    if (maxComments > 0) {
      const responsePromise = page.waitForResponse(
        (r) => r.url().includes('/api/comment/list/') && r.status() === 200,
        { timeout: 30_000 },
      );

      for (const selector of [
        'button[aria-label*=comment i]',
        'div[role=button][aria-label*=comment i]',
        '[data-e2e*=comment i]',
      ]) {
        const loc = page.locator(selector).first();
        if (!(await loc.count().catch(() => 0))) continue;
        try {
          await loc.click({ timeout: 2_000 });
          break;
        } catch {
          // ignore and try the next selector
        }
      }

      const response = await responsePromise;
      const jsonText = await response.text();
      if (jsonText) {
        try {
          const parsed = JSON.parse(jsonText) as {
            comments?: Array<{
              cid?: string;
              text?: string;
              create_time?: number;
              digg_count?: number;
              user?: { nickname?: string; unique_id?: string };
            }>;
          };

          for (const comment of parsed.comments ?? []) {
            const id = comment.cid?.trim() ?? '';
            const text = comment.text?.trim() ?? '';
            if (!id || !text) continue;

            comments.push({
              id,
              authorName:
                comment.user?.nickname?.trim() ??
                comment.user?.unique_id?.trim() ??
                undefined,
              publishedAt:
                typeof comment.create_time === 'number'
                  ? new Date(comment.create_time * 1000).toISOString()
                  : undefined,
              likeCount:
                typeof comment.digg_count === 'number' ? comment.digg_count : undefined,
              text,
            });

            if (comments.length >= maxComments) break;
          }
        } catch {
          // ignore: comments are best-effort
        }
      }
    }

    return { video, comments, thumbnailFilePath: thumbPath };
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const inputUrl = tryParseUrl(args.input);
  const flagUrl = args.videoUrl ? tryParseUrl(args.videoUrl) : null;
  const chosen = [inputUrl, flagUrl].find((url): url is URL =>
    Boolean(url && isHostOrSubdomain(url, 'tiktok.com')),
  );
  if (!chosen) {
    throw new Error(
      'Invalid input: pass a TikTok video URL (preferred), or ingest by id with --video-url pointing at tiktok.com.',
    );
  }

  const videoUrl = normalizeOriginPath(chosen);
  const videoId = extractTikTokVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid TikTok URL: expected a path containing /video/<id>.');
  }

  const scraped = await scrapeTikTokVideo({
    videoUrl,
    videoId,
    maxComments: args.maxComments,
  });

  const video: VideoMetadata = {
    ...scraped.video,
    title: args.title?.trim() || scraped.video.title,
    description: args.description?.trim() || scraped.video.description,
    publishedAt: args.publishedAt?.trim() || scraped.video.publishedAt,
    thumbnailUrl: args.thumbnailUrl?.trim() || scraped.video.thumbnailUrl,
    channel: {
      ...scraped.video.channel,
      channelId: args.channelId?.trim() || scraped.video.channel.channelId,
      channelTitle: args.channelTitle?.trim() || scraped.video.channel.channelTitle,
      channelUrl: args.channelUrl?.trim() || scraped.video.channel.channelUrl,
    },
  };

  await writeJsonFile(videoJsonPath('tiktok', videoId), video);
  await writeJsonFile(commentsJsonPath('tiktok', videoId), scraped.comments);

  process.stdout.write(
    `Ingested tiktok:${videoId} (video.json + comments.json; ${scraped.comments.length} comments; thumbnail: ${path.relative(process.cwd(), scraped.thumbnailFilePath)}).\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
