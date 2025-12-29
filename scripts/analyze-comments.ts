import { readFile } from 'node:fs/promises';

import type { CommentAnalytics, CommentRecord, Platform, Sentiment } from '../src/content/types';
import { extractYouTubeVideoId } from '../src/lib/youtube';

import { writeJsonFile, writeTextFile } from './fs';
import {
  resolveAnalyticsJsonPath,
  resolveCommentsJsonPath,
  resolveReportMdxPath,
  resolveVideoJsonPath,
} from './paths';

const POSITIVE = new Set([
  'love',
  'loved',
  'amazing',
  'great',
  'awesome',
  'helpful',
  'thanks',
  'thank',
  'fantastic',
  'perfect',
  'nice',
  'good',
  'brilliant',
]);

const NEGATIVE = new Set([
  'bad',
  'boring',
  'confusing',
  'wrong',
  'worse',
  'worst',
  'annoying',
  'hate',
  'awful',
  'terrible',
]);

const TOXIC = [
  /\bidiot\b/i,
  /\bstupid\b/i,
  /\btrash\b/i,
  /\bsucks\b/i,
  /\bshut up\b/i,
  /\bout of touch\b/i,
  /\bembarrass\w*\b/i,
  /\boff the air\b/i,
  /f\W*u\W*c\W*k/i,
  /\bf\W{2,}\b/i,
  /s\W*h\W*i\W*t/i,
  /b\W*i\W*t\W*c\W*h/i,
];

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'with',
  'you',
  'your',
  'are',
  'was',
  'were',
  'they',
  'their',
  'them',
  'have',
  'has',
  'had',
  'but',
  'not',
  'just',
  'like',
  'from',
  'what',
  'when',
  'where',
  'who',
  'why',
  'how',
  'can',
  'could',
  'should',
  'would',
  'about',
  'into',
  'out',
  'also',
  'really',
  'very',
  'more',
  'less',
  'than',
  'then',
  'been',
  'because',
  'video',
  'channel',
]);

function parseArgs(argv: string[]): { platform: Platform; videoId: string } {
  const platformIndex = argv.indexOf('--platform');
  const platform = (platformIndex >= 0 ? argv[platformIndex + 1] : 'youtube') as Platform;

  const videoIndex = argv.indexOf('--video');
  const videoRaw =
    videoIndex >= 0 ? argv[videoIndex + 1] : argv.find((a) => !a.startsWith('-'));
  if (!videoRaw) {
    throw new Error('Usage: bun run analyze -- --platform youtube --video <videoId>');
  }

  if (platform !== 'youtube') {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const videoId = extractYouTubeVideoId(videoRaw);
  if (!videoId) throw new Error('Could not parse a YouTube video id from input.');

  return { platform, videoId };
}

function isToxic(text: string): boolean {
  return TOXIC.some((re) => re.test(text));
}

function isQuestion(text: string): boolean {
  return text.includes('?');
}

function isSuggestion(text: string): boolean {
  return /\b(should|could|please|wish|would love|can you|it'd be nice|it would be nice)\b/i.test(
    text,
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 4)
    .filter((t) => !STOPWORDS.has(t));
}

function scoreSentiment(tokens: string[], toxic: boolean): Sentiment {
  if (toxic) return 'negative';
  let score = 0;
  for (const token of tokens) {
    if (POSITIVE.has(token)) score += 1;
    if (NEGATIVE.has(token)) score -= 1;
  }

  if (score >= 1) return 'positive';
  if (score <= -1) return 'negative';
  return 'neutral';
}

function shorten(text: string, max = 120): string {
  const cleaned = sanitize(text).replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function sanitize(text: string): string {
  return text
    .replace(/f\W*u\W*c\W*k/gi, '…')
    .replace(/\bf\W{2,}\b/gi, '…')
    .replace(/s\W*h\W*i\W*t/gi, '…')
    .replace(/b\W*i\W*t\W*c\W*h/gi, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeMdxText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '\\`')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/!/g, '\\!')
    .replace(/\|/g, '\\|');
}

function dedupeStable(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildGentleCritiques(comments: Array<{ text: string; toxic: boolean; question: boolean; suggestion: boolean; sentiment: Sentiment }>): string[] {
  const suggestions = comments
    .filter((c) => !c.toxic && c.suggestion)
    .map((c) => shorten(c.text));

  const questions = comments
    .filter((c) => !c.toxic && c.question)
    .map((c) => shorten(c.text));

  const out: string[] = [];
  for (const q of dedupeStable(questions).slice(0, 4)) {
    out.push(`Clarify: viewers are asking “${q}”`);
  }

  for (const s of dedupeStable(suggestions).slice(0, 8)) {
    out.push(`Improve: consider addressing “${s}”`);
  }

  return out.slice(0, 12);
}

function buildSafeQuotes(comments: Array<{ text: string; toxic: boolean; sentiment: Sentiment }>): string[] {
  const candidates = comments
    .filter((c) => !c.toxic && c.sentiment === 'positive')
    .map((c) => sanitize(c.text))
    .filter((t) => t.length >= 20 && t.length <= 160);

  return dedupeStable(candidates).slice(0, 12);
}

function buildMdxReport({
  videoTitle,
  analytics,
}: {
  videoTitle: string;
  analytics: CommentAnalytics;
}): string {
  // `analytics.*` strings are expected to already be tone-filtered (via `sanitize` / `shorten`).
  // This function is responsible for MDX/JSX safety via `escapeMdxText`.
  const safeTitle = escapeMdxText(videoTitle);
  const themes = analytics.topThemes
    .map((t) => `- **${escapeMdxText(t.label)}** (${t.count})`)
    .join('\n');
  const critiques = analytics.gentleCritiques
    .map((c) => `- ${escapeMdxText(c)}`)
    .join('\n');
  const quotes = analytics.safeQuotes.map((q) => `- “${escapeMdxText(q)}”`).join('\n');

  return `# Comment report\n\nThis report was generated from a snapshot of YouTube comments for **${safeTitle}**.\n\n<Callout title="Tone filter">
  We focus on actionable signal. Harsh/insulting language is excluded from quotes and softened in summaries.
</Callout>\n\n## What people are talking about\n\n${themes || '- (Not enough signal yet)'}\n\n## Creator-friendly takeaways\n\n${critiques || '- (No constructive critiques detected in the captured comments)'}\n\n## Quotes (safe)\n\n${quotes || '- (No safe quotes detected in the captured comments)'}\n`;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function main(): Promise<void> {
  const { platform, videoId } = parseArgs(process.argv.slice(2));
  const comments = await readJsonFile<CommentRecord[]>(resolveCommentsJsonPath(platform, videoId));
  const video = await readJsonFile<{ title: string }>(resolveVideoJsonPath(platform, videoId));

  const signals = comments.map((c) => {
    const toxic = isToxic(c.text);
    const question = isQuestion(c.text);
    const suggestion = isSuggestion(c.text);
    const tokens = tokenize(c.text);

    return {
      ...c,
      tokens,
      toxic,
      question,
      suggestion,
      sentiment: scoreSentiment(tokens, toxic),
    };
  });

  const sentimentBreakdown: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  const themeCounts = new Map<string, number>();
  let toxicCount = 0;
  let questionCount = 0;
  let suggestionCount = 0;

  for (const s of signals) {
    sentimentBreakdown[s.sentiment] += 1;
    if (s.toxic) toxicCount += 1;
    if (s.question) questionCount += 1;
    if (s.suggestion) suggestionCount += 1;
    for (const token of s.tokens) {
      themeCounts.set(token, (themeCounts.get(token) ?? 0) + 1);
    }
  }

  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  const analytics: CommentAnalytics = {
    commentCount: comments.length,
    analyzedAt: new Date().toISOString(),
    sentimentBreakdown,
    toxicCount,
    questionCount,
    suggestionCount,
    topThemes,
    safeQuotes: buildSafeQuotes(signals),
    gentleCritiques: buildGentleCritiques(signals),
  };

  await writeJsonFile(resolveAnalyticsJsonPath(platform, videoId), analytics);
  await writeTextFile(
    resolveReportMdxPath(platform, videoId),
    buildMdxReport({ videoTitle: video.title, analytics }),
  );

  process.stdout.write(`Analyzed ${comments.length} comments for ${platform}:${videoId}.\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
