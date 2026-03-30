import path from 'node:path';

import type { VideoMetadata } from '../src/content/types';

import { buildInstagramUrl, extractInstagramShortcode } from '../src/lib/instagram';

import { writeJsonFile } from './fs';
import { commentsJsonPath, videoJsonPath } from './paths';
import { readCommentExportFile } from './ingest-import';

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

type Args = {
  input: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelUrl?: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  commentsPath?: string;
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
      'Usage: bun run ingest:instagram -- <postUrlOrShortcode> --title <title> --channel-id <id> --channel-title <title> [--comments <jsonPath>]',
    );
  }

  const title = flags.get('--title')?.trim() ?? '';
  const channelId = flags.get('--channel-id')?.trim() ?? '';
  const channelTitle = flags.get('--channel-title')?.trim() ?? '';

  if (!title) throw new Error('Missing required flag: --title');
  if (!channelId) throw new Error('Missing required flag: --channel-id');
  if (!channelTitle) throw new Error('Missing required flag: --channel-title');

  const commentsPath = flags.get('--comments');

  return {
    input: positionals[0],
    title,
    channelId,
    channelTitle,
    channelUrl: flags.get('--channel-url'),
    description: flags.get('--description'),
    publishedAt: flags.get('--published-at'),
    thumbnailUrl: flags.get('--thumbnail-url'),
    commentsPath,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const shortcode = extractInstagramShortcode(args.input);
  if (!shortcode) {
    throw new Error('Invalid input: expected an Instagram post/reel URL or shortcode.');
  }

  const normalizedUrl = normalizeUrl(args.input);
  const videoUrl = normalizedUrl?.includes('instagram.com')
    ? normalizedUrl
    : buildInstagramUrl(shortcode);

  const video: VideoMetadata = {
    platform: 'instagram',
    videoId: shortcode,
    videoUrl,
    title: args.title,
    description: args.description,
    channel: {
      platform: 'instagram',
      channelId: args.channelId,
      channelTitle: args.channelTitle,
      channelUrl: args.channelUrl,
    },
    publishedAt: args.publishedAt,
    thumbnailUrl: args.thumbnailUrl,
  };

  await writeJsonFile(videoJsonPath('instagram', shortcode), video);

  if (args.commentsPath) {
    const absoluteComments = path.resolve(process.cwd(), args.commentsPath);
    const comments = await readCommentExportFile(absoluteComments);
    await writeJsonFile(commentsJsonPath('instagram', shortcode), comments);
    process.stdout.write(
      `Ingested instagram:${shortcode} (video.json + comments.json; ${comments.length} comments).\n`,
    );
  } else {
    process.stdout.write(
      `Ingested instagram:${shortcode} (video.json only; pass --comments <jsonPath> to import comments).\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
