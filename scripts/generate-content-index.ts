import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { writeTextFile } from './fs';

type Platform = 'youtube';

const CONTENT_ROOT = path.resolve(process.cwd(), 'content', 'platforms');
const OUT_DIR = path.resolve(process.cwd(), 'src', 'content', 'generated');

function safeIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
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
  const platforms: Platform[] = ['youtube'];
  const videoEntries: Array<{ platform: Platform; videoId: string }> = [];
  for (const platform of platforms) {
    for (const videoId of await listVideoIds(platform)) {
      videoEntries.push({ platform, videoId });
    }
  }

  const contentImports: string[] = [
    "import type { VideoContent } from '../types';",
    '',
  ];
  const contentMapLines: string[] = ['export const VIDEO_CONTENT: Record<string, VideoContent> = {'];

  const reportImports: string[] = ["import type { ComponentType } from 'react';", ''];
  const reportMapLines: string[] = [
    'export const VIDEO_REPORTS: Record<string, ComponentType | undefined> = {',
  ];

  for (const { platform, videoId } of videoEntries) {
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
      `    video: ${ident}_video as unknown as VideoContent['video'],`,
      `    comments: ${ident}_comments as unknown as VideoContent['comments'],`,
      `    analytics: ${ident}_analytics as unknown as VideoContent['analytics'],`,
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
    `Generated content index for ${videoEntries.length} videos into src/content/generated/.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
