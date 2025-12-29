import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { writeTextFile } from './fs';

type Platform = 'youtube';

const CONTENT_ROOT = path.resolve(process.cwd(), 'content', 'platforms');
const OUT_DIR = path.resolve(process.cwd(), 'src', 'content', 'generated');

function safeIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

async function listSubdirs(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listVideoDirs(
  platform: Platform,
): Promise<Array<{ videoId: string; baseDir: string }>> {
  const byVideoId = new Map<string, string>();

  const channelsDir = path.join(CONTENT_ROOT, platform, 'channels');
  const channelEntries = await listSubdirs(channelsDir);

  for (const channelId of channelEntries) {
    const videosDir = path.join(channelsDir, channelId, 'videos');
    const videoEntries = await listSubdirs(videosDir);

    for (const videoId of videoEntries) {
      const baseDir = path.join(videosDir, videoId);
      if (byVideoId.has(videoId)) {
        const existing = byVideoId.get(videoId);
        throw new Error(
          `Duplicate video id detected for ${platform}:${videoId} in channels tree (check platforms/${platform}/channels/*/videos): ${existing} and ${baseDir}.`,
        );
      }
      byVideoId.set(videoId, baseDir);
    }
  }

  const legacyDir = path.join(CONTENT_ROOT, platform, 'videos');
  const legacyEntries = await listSubdirs(legacyDir);

  for (const videoId of legacyEntries) {
    if (byVideoId.has(videoId)) continue;
    const baseDir = path.join(legacyDir, videoId);
    byVideoId.set(videoId, baseDir);
  }

  return Array.from(byVideoId.entries())
    .map(([videoId, baseDir]) => ({ videoId, baseDir }))
    .sort((a, b) => a.videoId.localeCompare(b.videoId));
}

function relFromGenerated(absolutePath: string): string {
  const rel = path.relative(OUT_DIR, absolutePath);
  const spec = rel.split(path.sep).join('/');
  return spec.startsWith('.') ? spec : `./${spec}`;
}

async function main(): Promise<void> {
  const platforms: Platform[] = ['youtube'];
  const videoEntries: Array<{ platform: Platform; videoId: string; baseDir: string }> = [];
  for (const platform of platforms) {
    for (const entry of await listVideoDirs(platform)) {
      videoEntries.push({ platform, ...entry });
    }
  }

  const contentImports: string[] = [
    "import type { VideoContent } from '../types';",
    '',
  ];
  const contentMapLines: string[] = ['const VIDEO_CONTENT_LITERAL = {'];

  const reportImports: string[] = ["import type { ComponentType } from 'react';", ''];
  const reportMapLines: string[] = [
    'export const VIDEO_REPORTS: Record<string, ComponentType | undefined> = {',
  ];

  for (const { platform, videoId, baseDir } of videoEntries) {
    const ident = safeIdent(`${platform}_${videoId}`);

    const videoPath = relFromGenerated(path.join(baseDir, 'video.json'));
    const commentsPath = relFromGenerated(path.join(baseDir, 'comments.json'));
    const analyticsPath = relFromGenerated(path.join(baseDir, 'analytics.json'));
    const reportPath = relFromGenerated(path.join(baseDir, 'report.mdx'));

    contentImports.push(
      `import ${ident}_video from '${videoPath}';`,
      `import ${ident}_comments from '${commentsPath}';`,
      `import ${ident}_analytics from '${analyticsPath}';`,
      '',
    );

    reportImports.push(`import ${ident}_report from '${reportPath}';`, '');

    contentMapLines.push(
      `  '${platform}:${videoId}': {`,
      '    video: {',
      `      ...${ident}_video,`,
      `      platform: '${platform}',`,
      '      channel: {',
      `        ...${ident}_video.channel,`,
      `        platform: '${platform}',`,
      '      },',
      '    },',
      `    comments: ${ident}_comments,`,
      `    analytics: ${ident}_analytics,`,
      '  },',
    );

    reportMapLines.push(`  '${platform}:${videoId}': ${ident}_report,`);
  }

  contentMapLines.push(
    '} satisfies Record<string, VideoContent>;',
    '',
    'export const VIDEO_CONTENT: Record<string, VideoContent> = VIDEO_CONTENT_LITERAL;',
    '',
  );
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
