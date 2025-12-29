import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type {
  CommentAnalytics,
  CommentRecord,
  Platform,
  Sentiment,
  VideoMetadata,
} from '../src/content/types';

import { writeJsonFile, writeTextFile } from './fs';
import {
  analyticsJsonPath,
  commentsJsonPath,
  reportMdxPath,
  videoJsonPath,
  videoRoot,
} from './paths';

type Args = {
  overwrite: boolean;
  video?: { platform: Platform; videoId: string };
};

const CONTENT_PLATFORMS_ROOT = path.resolve(process.cwd(), 'content', 'platforms');

function parseArgs(argv: string[]): Args {
  const overwrite = argv.includes('--overwrite');

  const videoIndex = argv.indexOf('--video');
  if (videoIndex === -1) return { overwrite };

  const videoRaw = argv[videoIndex + 1];
  if (!videoRaw || videoRaw.startsWith('-')) {
    throw new Error('Invalid usage: --video requires a value (e.g. youtube:<videoId>).');
  }

  const normalized = videoRaw.trim();
  if (!normalized) return { overwrite };

  if (!normalized.includes(':')) {
    return { overwrite, video: { platform: 'youtube', videoId: normalized } };
  }

  const [platformRaw, videoIdRaw] = normalized.split(':');
  const platform = platformRaw === 'youtube' ? 'youtube' : null;
  if (!platform || !videoIdRaw) {
    throw new Error('Invalid --video value. Use youtube:<videoId>');
  }

  return { overwrite, video: { platform, videoId: videoIdRaw } };
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

async function readJsonObjectFile(
  absolutePath: string,
): Promise<Record<string, unknown>> {
  const parsed = await readJsonFile(absolutePath);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid JSON at ${absolutePath}: expected object.`);
  }
  return parsed;
}

async function readJsonArrayFile(absolutePath: string): Promise<unknown[]> {
  const parsed = await readJsonFile(absolutePath);
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid JSON at ${absolutePath}: expected array.`);
  }
  return parsed;
}

function toCommentRecords(value: unknown[], absolutePath: string): CommentRecord[] {
  const out: CommentRecord[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== 'string' || typeof entry.text !== 'string') continue;
    out.push({
      id: entry.id,
      authorName: typeof entry.authorName === 'string' ? entry.authorName : undefined,
      publishedAt: typeof entry.publishedAt === 'string' ? entry.publishedAt : undefined,
      likeCount: typeof entry.likeCount === 'number' ? entry.likeCount : undefined,
      text: entry.text,
    });
  }

  if (out.length === 0) {
    throw new Error(
      `Invalid comments.json at ${absolutePath}: no valid comment records.`,
    );
  }

  return out;
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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const TOXIC_WORDS = new Set([
  'asshole',
  'bitch',
  'bullshit',
  'crap',
  'damn',
  'dick',
  'fuck',
  'fucking',
  'pissed',
  'shit',
  'stfu',
  'wtf',
]);

const POSITIVE_WORDS = new Set([
  'amazing',
  'awesome',
  'beautiful',
  'brilliant',
  'excellent',
  'fantastic',
  'great',
  'helpful',
  'insight',
  'insightful',
  'interesting',
  'love',
  'loved',
  'nice',
  'smart',
  'thank',
  'thanks',
  'thoughtful',
  'wonderful',
]);

const NEGATIVE_WORDS = new Set([
  'awful',
  'bad',
  'boring',
  'disappointing',
  'garbage',
  'gross',
  'hate',
  'horrible',
  'idiot',
  'nonsense',
  'terrible',
  'wrong',
]);

const STOPWORDS = new Set([
  'a',
  'about',
  'after',
  'again',
  'all',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'don',
  'down',
  'even',
  'for',
  'from',
  'get',
  'go',
  'good',
  'got',
  'has',
  'have',
  'he',
  'her',
  'here',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'like',
  'love',
  'me',
  'more',
  'most',
  'my',
  'no',
  'not',
  'of',
  'on',
  'one',
  'or',
  'our',
  'out',
  'people',
  'really',
  's',
  'she',
  'so',
  'some',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'too',
  'up',
  'us',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isToxicText(tokens: string[]): boolean {
  for (const token of tokens) {
    if (TOXIC_WORDS.has(token)) return true;
  }
  return false;
}

function sentimentForTokens(tokens: string[]): Sentiment {
  let score = 0;
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) score += 1;
    if (NEGATIVE_WORDS.has(token)) score -= 1;
  }

  if (score >= 2) return 'positive';
  if (score <= -2) return 'negative';
  return 'neutral';
}

function isQuestionText(text: string): boolean {
  if (text.includes('?')) return true;
  const lowered = text.toLowerCase();
  return (
    lowered.startsWith('why ') ||
    lowered.startsWith('how ') ||
    lowered.startsWith('what ') ||
    lowered.startsWith('when ') ||
    lowered.startsWith('where ') ||
    lowered.startsWith('who ')
  );
}

function isSuggestionText(text: string): boolean {
  const lowered = text.toLowerCase();
  return (
    /\b(should|could|please|recommend|consider|try)\b/.test(lowered) ||
    /\b(would love|wish|can you|could you|it would be great)\b/.test(lowered)
  );
}

function ellipsize(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.replace(/\s+$/g, '')}…`;
}

function escapeMdxText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function analyzeComments(comments: CommentRecord[]): CommentAnalytics {
  const sentimentBreakdown: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  let toxicCount = 0;
  let questionCount = 0;
  let suggestionCount = 0;

  const themeCounts = new Map<string, number>();
  const safeQuoteCandidates: Array<{ score: number; text: string }> = [];
  const questionCandidates: string[] = [];
  const suggestionCandidates: string[] = [];

  for (const comment of comments) {
    const cleaned = normalizeText(comment.text);
    if (!cleaned) continue;
    const tokens = tokenize(cleaned);

    const toxic = isToxicText(tokens);
    if (toxic) toxicCount += 1;

    const sentiment = sentimentForTokens(tokens);
    sentimentBreakdown[sentiment] += 1;

    const isQuestion = isQuestionText(cleaned);
    if (isQuestion) {
      questionCount += 1;
      if (!toxic) questionCandidates.push(cleaned);
    }

    const isSuggestion = isSuggestionText(cleaned);
    if (isSuggestion) {
      suggestionCount += 1;
      if (!toxic) suggestionCandidates.push(cleaned);
    }

    for (const token of tokens) {
      if (token.length < 4) continue;
      if (STOPWORDS.has(token)) continue;
      if (TOXIC_WORDS.has(token)) continue;
      themeCounts.set(token, (themeCounts.get(token) ?? 0) + 1);
    }

    if (!toxic) {
      const likeScore =
        typeof comment.likeCount === 'number' ? Math.min(comment.likeCount, 25) : 0;
      const lengthScore = Math.min(cleaned.length, 220) / 220;
      const sentimentScore =
        sentiment === 'positive' ? 1 : sentiment === 'negative' ? -0.25 : 0;
      safeQuoteCandidates.push({
        score: likeScore + lengthScore + sentimentScore,
        text: cleaned,
      });
    }
  }

  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  const safeQuotes = safeQuoteCandidates
    .sort((a, b) => b.score - a.score)
    .map((q) => q.text)
    .filter((t, index, all) => all.indexOf(t) === index)
    .slice(0, 12);

  const gentleCritiques: string[] = [];
  for (const text of questionCandidates.slice(0, 6)) {
    gentleCritiques.push(`Clarify: viewers are asking “${ellipsize(text, 120)}”`);
  }
  for (const text of suggestionCandidates.slice(0, 8)) {
    gentleCritiques.push(`Improve: consider addressing “${ellipsize(text, 120)}”`);
  }

  return {
    commentCount: comments.length,
    analyzedAt: new Date().toISOString(),
    sentimentBreakdown,
    toxicCount,
    questionCount,
    suggestionCount,
    topThemes,
    safeQuotes,
    gentleCritiques,
  };
}

function buildReportMdx(video: VideoMetadata, analytics: CommentAnalytics): string {
  const lines: string[] = [];
  lines.push('# Comment report', '');
  lines.push(
    `This report was generated from a snapshot of YouTube comments for **${escapeMdxText(video.title)}**.`,
    '',
  );
  lines.push('<Callout title="Tone filter">');
  lines.push(
    '  We focus on actionable signal. Harsh/insulting language is excluded from quotes and softened in summaries.',
  );
  lines.push('</Callout>', '');

  lines.push('## What people are talking about', '');
  if (analytics.topThemes.length === 0) {
    lines.push('No strong themes yet.', '');
  } else {
    for (const theme of analytics.topThemes) {
      lines.push(`- **${escapeMdxText(theme.label)}** (${theme.count})`);
    }
    lines.push('');
  }

  lines.push('## Creator-friendly takeaways', '');
  if (analytics.gentleCritiques.length === 0) {
    lines.push('No strong asks stood out in this snapshot.', '');
  } else {
    for (const item of analytics.gentleCritiques) {
      lines.push(`- ${escapeMdxText(item)}`);
    }
    lines.push('');
  }

  lines.push('## Quotes (safe)', '');
  if (analytics.safeQuotes.length === 0) {
    lines.push('No safe quotes stood out in this snapshot.', '');
  } else {
    for (const quote of analytics.safeQuotes) {
      lines.push(`- “${escapeMdxText(quote)}”`);
    }
    lines.push('');
  }

  return lines.join('\n');
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
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const targets: Array<{ platform: Platform; videoId: string }> = [];

  if (args.video) {
    targets.push(args.video);
  } else {
    for (const platformName of await listDirs(CONTENT_PLATFORMS_ROOT)) {
      if (platformName !== 'youtube') continue;
      const videosRoot = path.join(CONTENT_PLATFORMS_ROOT, platformName, 'videos');
      for (const videoId of await listDirs(videosRoot)) {
        targets.push({ platform: 'youtube', videoId });
      }
    }
  }

  let updated = 0;
  for (const { platform, videoId } of targets) {
    const root = videoRoot(platform, videoId);
    const commentsPath = commentsJsonPath(platform, videoId);
    const analyticsPath = analyticsJsonPath(platform, videoId);
    const reportPath = reportMdxPath(platform, videoId);
    const videoPath = videoJsonPath(platform, videoId);

    const hasComments = await fileExists(commentsPath);
    if (!hasComments) continue;

    const hasAnalytics = await fileExists(analyticsPath);
    const hasReport = await fileExists(reportPath);

    if (!args.overwrite && hasAnalytics && hasReport) continue;

    const videoRaw = await readJsonObjectFile(videoPath);
    const video = toVideoMetadata(videoRaw, videoPath);

    const commentsRaw = await readJsonArrayFile(commentsPath);
    const comments = toCommentRecords(commentsRaw, commentsPath);

    let analytics: CommentAnalytics;
    if (!args.overwrite && hasAnalytics) {
      analytics = (await readJsonFile(analyticsPath)) as CommentAnalytics;
    } else {
      analytics = analyzeComments(comments);
      await writeJsonFile(analyticsPath, analytics);
    }

    if (args.overwrite || !hasReport) {
      await writeTextFile(reportPath, buildReportMdx(video, analytics));
    }

    updated += 1;
    process.stdout.write(
      `Generated analysis for ${platform}:${videoId} into ${path.relative(process.cwd(), root)}.\n`,
    );
  }

  process.stdout.write(`Done. Updated ${updated} video(s).\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
