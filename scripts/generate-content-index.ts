import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { writeTextFile } from './fs';

type Platform = 'youtube';

const CONTENT_ROOT = path.resolve(process.cwd(), 'content', 'platforms');
const OUT_DIR = path.resolve(process.cwd(), 'src', 'content', 'generated');

function safeIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJsonFile<T = unknown>(absolutePath: string): Promise<T> {
  const raw = await readFile(absolutePath, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = `Failed to parse JSON at ${absolutePath}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    const wrapped = new Error(message);
    if (error instanceof Error) {
      (wrapped as Error & { cause?: unknown }).cause = error;
    }
    throw wrapped;
  }
}

async function readJsonObjectFile(absolutePath: string): Promise<Record<string, unknown>> {
  const parsed = await readJsonFile(absolutePath);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid JSON at ${absolutePath}: expected object.`);
  }
  return parsed;
}

function assertValidVideoChannel(
  absolutePath: string,
  platform: Platform,
  channel: unknown,
): void {
  if (!isRecord(channel)) {
    throw new Error(`Invalid video.json at ${absolutePath}: expected video.channel object.`);
  }

  if (channel.platform !== platform) {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected video.channel.platform '${platform}'.`,
    );
  }

  if (typeof channel.channelId !== 'string' || !channel.channelId) {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected non-empty video.channel.channelId.`,
    );
  }

  if (typeof channel.channelTitle !== 'string' || !channel.channelTitle) {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected non-empty video.channel.channelTitle.`,
    );
  }
}

async function assertValidVideoJson(
  absolutePath: string,
  platform: Platform,
  videoId: string,
): Promise<void> {
  const raw = await readJsonObjectFile(absolutePath);

  if (raw.platform !== platform) {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected platform '${platform}'.`,
    );
  }

  // Invariant: video.json must match its on-disk location under content/platforms/{platform}/videos/{videoId}.
  if (raw.videoId !== videoId) {
    throw new Error(`Invalid video.json at ${absolutePath}: expected videoId '${videoId}'.`);
  }

  if (typeof raw.videoUrl !== 'string' || !raw.videoUrl) {
    throw new Error(`Invalid video.json at ${absolutePath}: expected non-empty videoUrl.`);
  }

  if (typeof raw.title !== 'string' || !raw.title) {
    throw new Error(`Invalid video.json at ${absolutePath}: expected non-empty title.`);
  }

  assertValidVideoChannel(absolutePath, platform, raw.channel);
}

async function listVideoIds(platform: Platform): Promise<string[]> {
  const dir = path.join(CONTENT_ROOT, platform, 'videos');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    try {
      const s = await stat(full);
      if (s.isDirectory()) out.push(entry);
    } catch {
      // ignore
    }
  }
  return out.sort();
}

function relFromGenerated(absolutePath: string): string {
  const rel = path.relative(OUT_DIR, absolutePath);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const platforms: Platform[] = ['youtube'];
  const videoEntries: Array<{ platform: Platform; videoId: string }> = [];
  for (const platform of platforms) {
    for (const videoId of await listVideoIds(platform)) {
      videoEntries.push({ platform, videoId });
    }
  }

  type Validation =
    | { ok: true; platform: Platform; videoId: string }
    | { ok: false; platform: Platform; videoId: string; error: unknown };

  const validations: Validation[] = await Promise.all(
    videoEntries.map(async ({ platform, videoId }) => {
      const videoJsonPath = path.join(CONTENT_ROOT, platform, 'videos', videoId, 'video.json');
      try {
        await assertValidVideoJson(videoJsonPath, platform, videoId);
        return { ok: true as const, platform, videoId };
      } catch (error) {
        return { ok: false as const, platform, videoId, error };
      }
    }),
  );

  const invalidEntries = validations.filter((v): v is Extract<Validation, { ok: false }> => !v.ok);
  if (invalidEntries.length > 0) {
    if (strict) {
      const first = invalidEntries[0];
      throw first.error;
    }

    for (const entry of invalidEntries) {
      const message =
        entry.error instanceof Error ? entry.error.message : String(entry.error);
      process.stderr.write(`${message}\n`);
    }
  }

  const validEntries = validations.filter((v): v is Extract<Validation, { ok: true }> => v.ok);

  const contentImports: string[] = [
    '// AUTO-GENERATED FILE. DO NOT EDIT.',
    '// See scripts/generate-content-index.ts for the generation logic.',
    '',
    "import type { VideoContent } from '../types';",
    '',
  ];
  const contentMapLines: string[] = ['export const VIDEO_CONTENT: Record<string, VideoContent> = {'];

  const reportImports: string[] = [
    '// AUTO-GENERATED FILE. DO NOT EDIT.',
    '// See scripts/generate-content-index.ts for the generation logic.',
    '',
    "import type { ComponentType } from 'react';",
    '',
  ];
  const reportMapLines: string[] = [
    'export const VIDEO_REPORTS: Record<string, ComponentType | undefined> = {',
  ];

  for (const { platform, videoId } of validEntries) {
    const ident = safeIdent(`${platform}_${videoId}`);
    const base = path.join(CONTENT_ROOT, platform, 'videos', videoId);

    const videoPath = relFromGenerated(path.join(base, 'video.json'));
    const commentsPath = relFromGenerated(path.join(base, 'comments.json'));
    const analyticsPath = relFromGenerated(path.join(base, 'analytics.json'));
    const reportPath = relFromGenerated(path.join(base, 'report.mdx'));

    contentImports.push(
      `import ${ident}_video from '${videoPath}';`,
      `import ${ident}_comments from '${commentsPath}';`,
      `import ${ident}_analytics from '${analyticsPath}';`,
      '',
    );

    reportImports.push(`import ${ident}_report from '${reportPath}';`, '');

    contentMapLines.push(
      `  '${platform}:${videoId}': {`,
      `    video: ${ident}_video as VideoContent['video'],`,
      `    comments: ${ident}_comments,`,
      `    analytics: ${ident}_analytics,`,
      '  },',
    );

    reportMapLines.push(`  '${platform}:${videoId}': ${ident}_report,`);
  }

  contentMapLines.push('};', '');
  reportMapLines.push('};', '');

  await writeTextFile(
    path.join(OUT_DIR, 'contentIndex.ts'),
    [...contentImports, ...contentMapLines].join('\n'),
  );
  await writeTextFile(
    path.join(OUT_DIR, 'reports.ts'),
    [...reportImports, ...reportMapLines].join('\n'),
  );

  process.stdout.write(
    `Generated content index for ${validEntries.length} videos into src/content/generated/.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
