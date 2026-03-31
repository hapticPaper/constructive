import { createHash } from 'node:crypto';
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
      'Usage: bun run ingest:instagram -- <postUrlOrShortcode> [--max-comments <n>] (optional overrides: --title, --channel-id, --channel-title, --published-at)',
    );
  }

  const maxCommentsRaw = flags.get('--max-comments')?.trim();
  const maxComments = maxCommentsRaw ? Number.parseInt(maxCommentsRaw, 10) : 50;
  if (!Number.isFinite(maxComments) || maxComments < 0) {
    throw new Error('Invalid --max-comments: expected a non-negative integer.');
  }

  return {
    input: positionals[0],
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

function isCommentBlockStart(ageRaw: string | undefined): boolean {
  if (!ageRaw) return false;
  return /^\d+\s*[smhdwy]$/u.test(ageRaw.trim());
}

function stableSyntheticId(parts: string[]): string {
  const hash = createHash('sha256').update(parts.join('\u0000')).digest('hex');
  return hash.slice(0, 24);
}

function normalizeCommentText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isLikelyHandleLine(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === 'Like' || trimmed === 'Reply') return false;
  return /^[a-zA-Z0-9_.]{2,50}$/u.test(trimmed);
}

function parseCommentsFromBodyText(
  bodyText: string,
  maxComments: number,
): Array<{ authorName: string; text: string }> {
  const lines = bodyText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const out: Array<{ authorName: string; text: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const authorName = lines[i];
    const age = lines[i + 1];
    if (!isLikelyHandleLine(authorName) || !isCommentBlockStart(age)) continue;

    const textLines: string[] = [];
    let cursor = i + 2;
    while (cursor < lines.length && lines[cursor] !== 'Like') {
      if (
        isLikelyHandleLine(lines[cursor]) &&
        isCommentBlockStart(lines[cursor + 1])
      ) {
        break;
      }
      if (lines[cursor] === 'Reply') break;
      if (lines[cursor] === 'See translation') break;
      if (lines[cursor] === 'Log in to like or comment.') break;
      textLines.push(lines[cursor]);
      cursor += 1;
    }

    if (lines[cursor] !== 'Like') continue;
    if (lines[cursor + 1] !== 'Reply') continue;

    const text = normalizeCommentText(textLines.join(' '));
    if (!text) continue;

    out.push({ authorName, text });
    if (out.length >= maxComments) break;

    i = cursor + 1;
  }

  return out;
}

type InstagramWebInfoItem = {
  caption?: { text?: string };
  taken_at?: number;
  user?: {
    username?: string;
    full_name?: string;
  };
  preview_comments?: Array<{ pk?: string; text?: string; user?: { username?: string } }>;
};

function findInstagramWebInfoItem(value: unknown): InstagramWebInfoItem | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findInstagramWebInfoItem(entry);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const webInfo = record.xdt_api__v1__media__shortcode__web_info;
  if (webInfo && typeof webInfo === 'object' && !Array.isArray(webInfo)) {
    const items = (webInfo as Record<string, unknown>).items;
    if (Array.isArray(items) && items[0] && typeof items[0] === 'object') {
      return items[0] as InstagramWebInfoItem;
    }
  }

  for (const key of Object.keys(record)) {
    const found = findInstagramWebInfoItem(record[key]);
    if (found) return found;
  }
  return null;
}

async function scrapeInstagramPost({
  videoUrl,
  shortcode,
  maxComments,
}: {
  videoUrl: string;
  shortcode: string;
  maxComments: number;
}): Promise<{
  video: VideoMetadata;
  comments: CommentRecord[];
  thumbnailFilePath: string;
}> {
  return withPage(async (page) => {
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(4_000);

    const bodyText = await page.locator('body').innerText().catch(() => '');

    const webInfoRaw = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/json"]'),
      ) as HTMLScriptElement[];
      const hit = scripts.find((s) =>
        (s.textContent ?? '').includes('xdt_api__v1__media__shortcode__web_info'),
      );
      return hit?.textContent ?? null;
    });

    let webInfoItem: InstagramWebInfoItem | null = null;
    if (webInfoRaw) {
      try {
        webInfoItem = findInstagramWebInfoItem(JSON.parse(webInfoRaw) as unknown);
      } catch {
        webInfoItem = null;
      }
    }

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
    const displayName =
      webInfoItem?.user?.full_name?.trim() ?? displayNameMatch?.[1]?.trim() ?? '';
    const handleMatch = ogDescription?.match(/-\s+([^\s]+)\s+on\s+/i);
    const handle =
      webInfoItem?.user?.username?.trim() ?? handleMatch?.[1]?.trim() ?? '';
    const caption = webInfoItem?.caption?.text?.trim() ?? extractQuotedCaption(ogTitle);

    if (!handle) {
      throw new Error('Failed to scrape Instagram author handle from og:title.');
    }
    if (!caption) {
      throw new Error('Failed to scrape Instagram caption from og:title.');
    }

    const publishedAt =
      typeof webInfoItem?.taken_at === 'number' && Number.isFinite(webInfoItem.taken_at)
        ? new Date(webInfoItem.taken_at * 1000).toISOString()
        : await tryFetchPublishedAt({ shortcode });

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

    const comments: CommentRecord[] = [];
    if (maxComments > 0) {
      const previewByKey = new Map<string, { id: string }>();
      for (const comment of webInfoItem?.preview_comments ?? []) {
        const id = comment.pk?.trim() ?? '';
        const authorName = comment.user?.username?.trim() ?? '';
        const text = normalizeCommentText(comment.text ?? '');
        if (!id || !authorName || !text) continue;
        previewByKey.set(`${authorName}\u0000${text}`, { id });
      }

      const parsed = parseCommentsFromBodyText(bodyText, maxComments);
      for (const entry of parsed) {
        const key = `${entry.authorName}\u0000${entry.text}`;
        const preview = previewByKey.get(key);

        comments.push({
          id:
            preview?.id ??
            `ig_synth_${stableSyntheticId(['instagram', shortcode, entry.authorName, entry.text])}`,
          authorName: entry.authorName,
          text: entry.text,
        });

        if (comments.length >= maxComments) break;
      }
    }

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

  const scraped = await scrapeInstagramPost({
    videoUrl,
    shortcode,
    maxComments: args.maxComments,
  });

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
