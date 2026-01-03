import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type {
  ChannelAggregate,
  ChannelRef,
  CommentAnalytics,
  CreatorTakeaway,
  Platform,
  Sentiment,
  ThemeBucket,
  VideoMetadata,
} from '../src/content/types';

import { writeTextFile } from './fs';
import { channelAggregateMdxPath, analyticsJsonPath, videoJsonPath } from './paths';

type Args = {
  channel?: { platform: Platform; channelId: string };
};

const CONTENT_PLATFORMS_ROOT = path.resolve(process.cwd(), 'content', 'platforms');

function parseArgs(argv: string[]): Args {
  const channelIndex = argv.indexOf('--channel');
  if (channelIndex === -1) {
    throw new Error('Missing required argument: --channel (e.g. youtube:<channelId>)');
  }

  const channelRaw = argv[channelIndex + 1];
  if (!channelRaw || channelRaw.startsWith('-')) {
    throw new Error('Invalid usage: --channel requires a value (e.g. youtube:<channelId>).');
  }

  const normalized = channelRaw.trim();
  if (!normalized) {
    throw new Error(
      'Invalid usage: --channel requires a non-empty value (e.g. youtube:<channelId>).',
    );
  }

  const parts = normalized.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid --channel value. Use youtube:<channelId>');
  }

  const [platformRaw, channelIdRaw] = parts;
  const platform = platformRaw.trim() === 'youtube' ? 'youtube' : null;
  const channelId = channelIdRaw.trim();
  if (!platform || !channelId) {
    throw new Error('Invalid --channel value. Use youtube:<channelId>');
  }

  return { channel: { platform, channelId } };
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
    if (error instanceof Error) {
      throw new Error(message, { cause: error });
    }
    throw new Error(message);
  }
}

async function readJsonObjectFile(
  absolutePath: string,
): Promise<Record<string, unknown>> {
  const parsed = await readJsonFile(absolutePath);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid JSON at ${absolutePath}: expected object.`);
  }
  return parsed;
}

function toVideoMetadata(
  value: Record<string, unknown>,
  absolutePath: string,
): VideoMetadata {
  if (value.platform !== 'youtube') {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected platform 'youtube'.`,
    );
  }

  if (typeof value.videoId !== 'string' || !value.videoId) {
    throw new Error(`Invalid video.json at ${absolutePath}: expected non-empty videoId.`);
  }

  if (typeof value.videoUrl !== 'string' || !value.videoUrl) {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected non-empty videoUrl.`,
    );
  }

  if (typeof value.title !== 'string' || !value.title) {
    throw new Error(`Invalid video.json at ${absolutePath}: expected non-empty title.`);
  }

  const channel = value.channel;
  if (!isRecord(channel)) {
    throw new Error(`Invalid video.json at ${absolutePath}: expected channel object.`);
  }

  if (channel.platform !== 'youtube') {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected channel.platform 'youtube'.`,
    );
  }

  if (typeof channel.channelId !== 'string' || !channel.channelId) {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected non-empty channel.channelId.`,
    );
  }

  if (typeof channel.channelTitle !== 'string' || !channel.channelTitle) {
    throw new Error(
      `Invalid video.json at ${absolutePath}: expected non-empty channel.channelTitle.`,
    );
  }

  return {
    platform: 'youtube',
    videoId: value.videoId,
    videoUrl: value.videoUrl,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : undefined,
    channel: {
      platform: 'youtube',
      channelId: channel.channelId as string,
      channelTitle: channel.channelTitle as string,
      channelUrl: typeof channel.channelUrl === 'string' ? channel.channelUrl : undefined,
    },
    publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : undefined,
    thumbnailUrl: typeof value.thumbnailUrl === 'string' ? value.thumbnailUrl : undefined,
  };
}

async function listDirs(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function aggregateThemes(
  allTopics: Array<{ label: string; count: number }>,
  topN: number,
): ThemeBucket {
  const themeCounts = new Map<string, number>();

  for (const topic of allTopics) {
    themeCounts.set(topic.label, (themeCounts.get(topic.label) ?? 0) + topic.count);
  }

  return [...themeCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, topN);
}

function formatPercent(value: number): string {
  const pct = Math.round(value * 100);
  return `${pct}%`;
}

function buildChannelAggregateMdx(aggregate: ChannelAggregate): string {
  const lines: string[] = [];
  lines.push(`export const channelAggregate = ${JSON.stringify(aggregate, null, 2)}`, '');
  lines.push(
    '{typeof ChannelAggregate !== "undefined" ? <ChannelAggregate channelAggregate={channelAggregate} /> : (',
    '  <div className="callout">',
    '    <strong>Missing widget:</strong> ChannelAggregate',
    '  </div>',
    ')}',
    '',
  );
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.channel) {
    throw new Error('Missing required argument: --channel');
  }

  const { platform, channelId } = args.channel;

  // Find all videos for this channel
  const videosRoot = path.join(CONTENT_PLATFORMS_ROOT, platform, 'videos');
  const videoIds = await listDirs(videosRoot);

  const videoAnalytics: Array<{
    video: VideoMetadata;
    analytics: CommentAnalytics;
  }> = [];

  let channelRef: ChannelRef | null = null;

  for (const videoId of videoIds) {
    const videoPath = videoJsonPath(platform, videoId);
    const analyticsPath = analyticsJsonPath(platform, videoId);

    const hasVideo = await fileExists(videoPath);
    const hasAnalytics = await fileExists(analyticsPath);

    if (!hasVideo || !hasAnalytics) continue;

    const videoRaw = await readJsonObjectFile(videoPath);
    const video = toVideoMetadata(videoRaw, videoPath);

    // Check if this video belongs to the target channel
    if (video.channel.channelId !== channelId) continue;

    // Store channel reference from first matching video
    if (!channelRef) {
      channelRef = video.channel;
    }

    const analyticsRaw = await readJsonFile(analyticsPath);
    if (!isRecord(analyticsRaw)) continue;

    videoAnalytics.push({
      video,
      analytics: analyticsRaw as CommentAnalytics,
    });
  }

  if (!channelRef) {
    throw new Error(
      `No videos found for channel ${platform}:${channelId}. Ensure videos are ingested and analyzed.`,
    );
  }

  if (videoAnalytics.length === 0) {
    throw new Error(
      `No analyzed videos found for channel ${platform}:${channelId}. Run content:analyze on videos first.`,
    );
  }

  // Aggregate metrics
  let totalComments = 0;
  const sentimentBreakdown: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  const allTopics: Array<{ label: string; count: number }> = [];
  const allTakeaways: CreatorTakeaway[] = [];

  for (const { analytics } of videoAnalytics) {
    totalComments += analytics.commentCount;
    sentimentBreakdown.positive += analytics.sentimentBreakdown.positive;
    sentimentBreakdown.neutral += analytics.sentimentBreakdown.neutral;
    sentimentBreakdown.negative += analytics.sentimentBreakdown.negative;

    allTopics.push(...analytics.themes.topics);
    allTakeaways.push(...analytics.takeaways);
  }

  const topTopics = aggregateThemes(allTopics, 8);

  // Generate channel-level takeaways
  const takeaways: CreatorTakeaway[] = [];
  const videoCount = videoAnalytics.length;
  const avgCommentsPerVideo = Math.round(totalComments / videoCount);

  if (totalComments > 0) {
    const positiveRate = sentimentBreakdown.positive / totalComments;
    const negativeRate = sentimentBreakdown.negative / totalComments;

    // Most discussed topics
    if (topTopics.length > 0) {
      const topThree = topTopics.slice(0, 3).map((t) => t.label).join(', ');
      takeaways.push({
        title: 'Channel-wide topic patterns',
        detail: `Across ${videoCount} videos, viewers consistently discuss: ${topThree}.`,
      });
    }

    // Sentiment patterns
    if (positiveRate >= 0.35) {
      takeaways.push({
        title: 'Strong positive engagement across channel',
        detail: `${formatPercent(positiveRate)} of comments show positive sentiment. Your content resonates well with your audience.`,
      });
    } else if (negativeRate >= 0.25) {
      takeaways.push({
        title: 'Consider audience friction points',
        detail: `${formatPercent(negativeRate)} of comments show negative sentiment. Review common themes to identify improvement areas.`,
      });
    }

    // Engagement level
    if (avgCommentsPerVideo >= 100) {
      takeaways.push({
        title: 'High engagement rate',
        detail: `Averaging ${avgCommentsPerVideo.toLocaleString()} comments per video shows strong community interaction.`,
      });
    }
  }

  const aggregate: ChannelAggregate = {
    schema: 'constructive.channel-aggregate@v1',
    generatedAt: new Date().toISOString(),
    channel: channelRef,
    videoCount,
    totalComments,
    sentimentBreakdown,
    topTopics,
    takeaways: takeaways.slice(0, 3),
  };

  const mdxPath = channelAggregateMdxPath(platform, channelId);
  await writeTextFile(mdxPath, buildChannelAggregateMdx(aggregate));

  process.stdout.write(
    `Generated channel aggregate for ${platform}:${channelId} (${videoCount} videos, ${totalComments.toLocaleString()} comments).\n`,
  );
  process.stdout.write(`Output: ${path.relative(process.cwd(), mdxPath)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
