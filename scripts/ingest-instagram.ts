import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CommentRecord, VideoMetadata } from '../src/content/types';

import { buildInstagramUrl, extractInstagramShortcode } from '../src/lib/instagram';

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
      'Usage: bun run ingest:instagram -- <postUrlOrShortcode> (optional overrides: --title, --channel-id, --channel-title, --published-at)',
    );
  }

  return {
    input: positionals[0],
    title: flags.get('--title'),
    channelId: flags.get('--channel-id'),
    channelTitle: flags.get('--channel-title'),
    channelUrl: flags.get('--channel-url'),
    description: flags.get('--description'),
    publishedAt: flags.get('--published-at'),
    thumbnailUrl: flags.get('--thumbnail-url'),
  };
}

function extractQuotedCaption(raw: string): string {
  const first = raw.indexOf('"');
  const last = raw.lastIndexOf('"');
  if (first >= 0 && last > first) {
    return raw.slice(first + 1, last).trim();
  }

  return raw.trim();
}

async function tryFetchPublishedAt({
  shortcode,
}: {
  shortcode: string;
}): Promise<string | undefined> {
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
  let html = '';
  try {
    const res = await fetch(embedUrl, {
      headers: {
        accept: 'text/html',
      },
    });
    html = await res.text();
  } catch {
    return undefined;
  }

  const match = html.match(/\\\"taken_at_timestamp\\\":(\d+)/);
  if (!match) return undefined;

  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(seconds * 1000).toISOString();
}

async function scrapeInstagramPost({
  videoUrl,
  shortcode,
}: {
  videoUrl: string;
  shortcode: string;
}): Promise<{
  video: VideoMetadata;
  comments: CommentRecord[];
  thumbnailFilePath: string;
}> {
  return withPage(async (page) => {
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(4_000);

    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content')
      .catch(() => null);
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content')
      .catch(() => null);
    if (!ogTitle) {
      throw new Error('Failed to scrape Instagram og:title.');
    }

    const displayNameMatch = ogTitle.match(/^(.*?)\s+on\s+Instagram/i);
    const displayName = displayNameMatch?.[1]?.trim() ?? '';
    const handleMatch = ogDescription?.match(/-\s+([^\s]+)\s+on\s+/i);
    const handle = handleMatch?.[1]?.trim() ?? '';
    const caption = extractQuotedCaption(ogTitle);

    if (!handle) {
      throw new Error('Failed to scrape Instagram author handle from og:title.');
    }
    if (!caption) {
      throw new Error('Failed to scrape Instagram caption from og:title.');
    }

    const publishedAt = await tryFetchPublishedAt({ shortcode });

    const thumbPath = thumbnailPublicPath('instagram', shortcode);
    await ensureDir(path.dirname(thumbPath));

    const embedCaptionedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    await page.goto(embedCaptionedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(4_000);

    const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
    await writeFile(thumbPath, screenshot);

    const video: VideoMetadata = {
      platform: 'instagram',
      videoId: shortcode,
      videoUrl,
      title: caption,
      description: caption,
      channel: {
        platform: 'instagram',
        channelId: handle,
        channelTitle: displayName || handle,
        channelUrl: `https://www.instagram.com/${handle}/`,
      },
      publishedAt,
      thumbnailUrl: thumbnailUrl('instagram', shortcode),
    };

    // Instagram comment scraping typically requires an authenticated session.
    const comments: CommentRecord[] = [];

    return { video, comments, thumbnailFilePath: thumbPath };
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const shortcode = extractInstagramShortcode(args.input);
  if (!shortcode) {
    throw new Error('Invalid input: expected an Instagram post/reel URL or shortcode.');
  }

  const inputUrl = tryParseUrl(args.input);
  const videoUrl =
    inputUrl && isHostOrSubdomain(inputUrl, 'instagram.com')
      ? normalizeOriginPath(inputUrl)
      : buildInstagramUrl(shortcode);

  const scraped = await scrapeInstagramPost({ videoUrl, shortcode });

  const normalizedHandle = (args.channelId ?? scraped.video.channel.channelId).startsWith(
    '@',
  )
    ? (args.channelId ?? scraped.video.channel.channelId).slice(1)
    : (args.channelId ?? scraped.video.channel.channelId);
  const channelUrl =
    args.channelUrl ??
    scraped.video.channel.channelUrl ??
    `https://www.instagram.com/${normalizedHandle}/`;

  const video: VideoMetadata = {
    ...scraped.video,
    title: args.title?.trim() || scraped.video.title,
    description: args.description?.trim() || scraped.video.description,
    publishedAt: args.publishedAt?.trim() || scraped.video.publishedAt,
    thumbnailUrl: args.thumbnailUrl?.trim() || scraped.video.thumbnailUrl,
    channel: {
      ...scraped.video.channel,
      channelId: normalizedHandle,
      channelTitle: args.channelTitle?.trim() || scraped.video.channel.channelTitle,
      channelUrl,
    },
  };

  await writeJsonFile(videoJsonPath('instagram', shortcode), video);
  if (scraped.comments.length > 0) {
    await writeJsonFile(commentsJsonPath('instagram', shortcode), scraped.comments);
  } else {
    await rm(commentsJsonPath('instagram', shortcode), { force: true });
  }

  process.stdout.write(
    `Ingested instagram:${shortcode} (video.json; ${scraped.comments.length} comments; thumbnail: ${path.relative(process.cwd(), scraped.thumbnailFilePath)}).\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
