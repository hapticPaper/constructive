import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type {
  CommentAnalytics,
  CommentRecord,
  Platform,
  Sentiment,
  VideoMetadata,
} from '../src/content/types';

import { RADAR_CATEGORIES, emptyRadarCounts } from '../src/content/radar';

import { writeJsonFile, writeTextFile } from './fs';
import {
  analyticsJsonPath,
  commentsJsonPath,
  reportMdxPath,
  videoJsonPath,
  videoRoot,
} from './paths';
import { COMMON_FIRST_NAMES } from './person-names';

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
  if (!normalized) {
    throw new Error(
      'Invalid usage: --video requires a non-empty value (e.g. youtube:<videoId> or <videoId>).',
    );
  }

  const parts = normalized.split(':');
  if (parts.length === 1) {
    return { overwrite, video: { platform: 'youtube', videoId: parts[0] } };
  }

  if (parts.length !== 2) {
    throw new Error('Invalid --video value. Use youtube:<videoId> (or <videoId>).');
  }

  const [platformRaw, videoIdRaw] = parts;
  const platform = platformRaw.trim() === 'youtube' ? 'youtube' : null;
  const videoId = videoIdRaw.trim();
  if (!platform || !videoId) {
    throw new Error('Invalid --video value. Use youtube:<videoId>');
  }

  return { overwrite, video: { platform, videoId } };
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
  'moron',
  'pissed',
  'shit',
  'stfu',
  'stupid',
  'wtf',
]);

// Match against lowercased comment text.
const TOXIC_PHRASES = [/\b(who|what|why|how) the hell\b/u];

const POSITIVE_WORDS = new Set([
  'agree',
  'agreed',
  'amazing',
  'awesome',
  'best',
  'beautiful',
  'brilliant',
  'cool',
  'favorite',
  'enjoy',
  'enjoyed',
  'excellent',
  'fantastic',
  'fascinating',
  'good',
  'great',
  'grateful',
  'helpful',
  'incredible',
  'incredibly',
  'impressive',
  'insight',
  'insightful',
  'interesting',
  'love',
  'loved',
  'nice',
  'respect',
  'smart',
  'thank',
  'thanks',
  'thankful',
  'thoughtful',
  'valuable',
  'wow',
  'wonderful',
]);

const NEGATIVE_WORDS = new Set([
  'awful',
  'bad',
  'boring',
  'clueless',
  'disappointing',
  'disgusting',
  'dumb',
  'garbage',
  'gross',
  'hate',
  'horrible',
  'idiot',
  'misleading',
  'nonsense',
  'pathetic',
  'ridiculous',
  'sad',
  'shame',
  'shameful',
  'terrible',
  'unfortunate',
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
  // A few common high-frequency words that tend to pollute “topics”.
  'being',
  'need',
  'right',
  'think',
  // Platform meta words that are rarely useful as “topics”.
  'channel',
  'episode',
  'interview',
  'podcast',
  'video',
]);

const LIKE_SCORE_CAP = 25;
const THEME_BUCKET_SIZE = 8;
const THEME_RANKED_CANDIDATES = 16;
const HIGHLIGHT_LIMIT = 3;
const TAKEAWAY_LIMIT = 3;
const HIGHLIGHT_TEXT_LEN = 140;
const QUOTE_TEXT_LEN = 160;
const HIGHLIGHT_LEN_SCORE_DENOM = 200;
const QUOTE_LEN_SCORE_DENOM = 220;

function tokenizeRaw(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .map((t) => t.trim())
    .filter(Boolean);
}

function tokenize(text: string): string[] {
  return tokenizeRaw(text.toLowerCase());
}

function isThemeToken(token: string): boolean {
  if (token.length < 4) return false;
  if (/^\d+$/u.test(token)) return false;
  if (STOPWORDS.has(token)) return false;
  if (POSITIVE_WORDS.has(token) || NEGATIVE_WORDS.has(token)) return false;
  if (TOXIC_WORDS.has(token)) return false;
  return true;
}

type ToxicSignals = {
  hard: boolean;
  soft: boolean;
};

function getToxicSignals(loweredText: string, tokens: string[]): ToxicSignals {
  const hard = tokens.some((token) => TOXIC_WORDS.has(token));
  const soft = TOXIC_PHRASES.some((phrase) => phrase.test(loweredText));
  return { hard, soft };
}

function sentimentForTokens(tokens: string[]): Sentiment {
  let score = 0;
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) score += 1;
    if (NEGATIVE_WORDS.has(token)) score -= 1;
  }

  if (score >= 1) return 'positive';
  if (score <= -1) return 'negative';
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

function formatPercent(value: number): string {
  const pct = Math.round(value * 100);
  return `${pct}%`;
}

function isLikelyPersonToken(token: string): boolean {
  // Intentionally small heuristic: we only classify single-word, lowercased tokens.
  // Multi-word names and edge cases (e.g. last names) will be treated as topics.
  if (!/^[a-z]+$/u.test(token)) return false;
  if (!isThemeToken(token)) return false;
  return COMMON_FIRST_NAMES.has(token);
}

function summarizeThemeLabels(
  themes: Array<{ label: string; count: number }>,
  limit: number,
): string {
  return themes
    .slice(0, limit)
    .map((theme) => theme.label)
    .join(', ');
}

function analyzeComments(comments: CommentRecord[]): CommentAnalytics {
  const sentimentBreakdown: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  const isPersonToken = (token: string): boolean => isLikelyPersonToken(token);

  const radar = emptyRadarCounts();

  let toxicCount = 0;
  let questionCount = 0;
  let suggestionCount = 0;

  const themeCounts = new Map<string, number>();
  const quoteCandidates: Array<{ score: number; text: string }> = [];
  const questionCandidates: Array<{ score: number; text: string }> = [];
  const suggestionCandidates: Array<{ score: number; text: string }> = [];

  let analyzedCount = 0;

  for (const comment of comments) {
    const cleaned = normalizeText(comment.text);
    if (!cleaned) continue;
    analyzedCount += 1;
    const lowered = cleaned.toLowerCase();
    const tokens = tokenizeRaw(lowered);

    const toxicity = getToxicSignals(lowered, tokens);
    if (toxicity.hard) toxicCount += 1;
    const unsafeForHighlights = toxicity.hard || toxicity.soft;

    const sentiment = sentimentForTokens(tokens);
    sentimentBreakdown[sentiment] += 1;

    const isQuestion = isQuestionText(cleaned);
    if (isQuestion) {
      questionCount += 1;
      if (!unsafeForHighlights) {
        const likeScore =
          typeof comment.likeCount === 'number'
            ? Math.min(comment.likeCount, LIKE_SCORE_CAP)
            : 0;
        const lengthScore =
          Math.min(cleaned.length, HIGHLIGHT_LEN_SCORE_DENOM) / HIGHLIGHT_LEN_SCORE_DENOM;
        questionCandidates.push({ score: likeScore + lengthScore, text: cleaned });
      }
    }

    const isSuggestion = isSuggestionText(cleaned);
    if (isSuggestion) {
      suggestionCount += 1;
      if (!unsafeForHighlights) {
        const likeScore =
          typeof comment.likeCount === 'number'
            ? Math.min(comment.likeCount, LIKE_SCORE_CAP)
            : 0;
        const lengthScore =
          Math.min(cleaned.length, HIGHLIGHT_LEN_SCORE_DENOM) / HIGHLIGHT_LEN_SCORE_DENOM;
        suggestionCandidates.push({ score: likeScore + lengthScore, text: cleaned });
      }
    }

    const themeTokens = new Set<string>();
    for (const token of tokens) {
      if (!isThemeToken(token)) continue;
      themeTokens.add(token);
    }

    // Count “themes” as the number of comments that mention the token (not raw token
    // occurrences). This reduces noise from repeated words within a single comment.
    for (const theme of themeTokens) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }

    // Count comments that mention at least one likely person token (same heuristic as
    // `themes.people`; not total mentions).
    if (tokens.some(isPersonToken)) {
      radar.people += 1;
    }

    if (!unsafeForHighlights) {
      const likeScore =
        typeof comment.likeCount === 'number'
          ? Math.min(comment.likeCount, LIKE_SCORE_CAP)
          : 0;
      const lengthScore =
        Math.min(cleaned.length, QUOTE_LEN_SCORE_DENOM) / QUOTE_LEN_SCORE_DENOM;
      const sentimentScore =
        sentiment === 'positive' ? 1 : sentiment === 'negative' ? -0.25 : 0;
      quoteCandidates.push({
        score: likeScore + lengthScore + sentimentScore,
        text: cleaned,
      });
    }
  }

  const rankedThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));

  const themes = rankedThemes.slice(0, THEME_RANKED_CANDIDATES).reduce(
    (acc, theme) => {
      if (isPersonToken(theme.label)) {
        acc.people.push(theme);
      } else {
        acc.topics.push(theme);
      }
      return acc;
    },
    {
      topics: [] as Array<{ label: string; count: number }>,
      people: [] as Array<{ label: string; count: number }>,
    },
  );

  const quotes = quoteCandidates
    .sort((a, b) => b.score - a.score)
    .map((q) => q.text)
    .filter((t, index, all) => all.indexOf(t) === index)
    .slice(0, HIGHLIGHT_LIMIT)
    .map((t) => ellipsize(t, QUOTE_TEXT_LEN));

  const questions = questionCandidates
    .sort((a, b) => b.score - a.score)
    .map((q) => q.text)
    .filter((t, index, all) => all.indexOf(t) === index)
    .slice(0, HIGHLIGHT_LIMIT)
    .map((t) => ellipsize(t, HIGHLIGHT_TEXT_LEN));

  const suggestions = suggestionCandidates
    .sort((a, b) => b.score - a.score)
    .map((s) => s.text)
    .filter((t, index, all) => all.indexOf(t) === index)
    .slice(0, HIGHLIGHT_LIMIT)
    .map((t) => ellipsize(t, HIGHLIGHT_TEXT_LEN));

  const topicsSummary = summarizeThemeLabels(themes.topics, 3);
  const peopleSummary = summarizeThemeLabels(themes.people, 3);

  type TakeawayCandidate = { priority: number; title: string; detail: string };
  const takeawayCandidates: TakeawayCandidate[] = [];

  if (analyzedCount > 0) {
    const questionRate = questionCount / analyzedCount;
    const suggestionRate = suggestionCount / analyzedCount;
    const negativeRate = sentimentBreakdown.negative / analyzedCount;
    const positiveRate = sentimentBreakdown.positive / analyzedCount;

    takeawayCandidates.push({
      priority: 0.55,
      title: 'What people latched onto',
      detail: topicsSummary
        ? `Most discussion clusters around: ${topicsSummary}.`
        : 'No strong topic cluster stood out in this snapshot.',
    });

    if (themes.people.length > 0) {
      takeawayCandidates.push({
        priority: 0.7 + Math.min(themes.people[0].count / analyzedCount, 0.25),
        title: 'The conversation is partly about the people',
        detail: peopleSummary
          ? `A meaningful slice of comments mention: ${peopleSummary}. Treat those as “host/guest” feedback, not topic feedback.`
          : 'A meaningful slice of comments focus on the host/guest rather than the topic.',
      });
    }

    if (questionCount >= 3) {
      takeawayCandidates.push({
        priority: 0.75 + questionRate,
        title: 'Viewers want clarity',
        detail: `Questions make up ${formatPercent(questionRate)} of comments (${questionCount.toLocaleString()} total).`,
      });
    }

    if (suggestionCount >= 2) {
      takeawayCandidates.push({
        priority: 0.7 + suggestionRate,
        title: 'There are clear improvement requests',
        detail: `Suggestions show up in ${formatPercent(suggestionRate)} of comments (${suggestionCount.toLocaleString()} total).`,
      });
    }

    if (negativeRate >= 0.25) {
      takeawayCandidates.push({
        priority: 0.6 + negativeRate,
        title: 'Sentiment is meaningfully negative',
        detail: `Negative sentiment appears in ${formatPercent(negativeRate)} of comments. Consider a pinned comment or follow-up to address the most common friction.`,
      });
    } else if (positiveRate >= 0.45) {
      takeawayCandidates.push({
        priority: 0.6 + positiveRate,
        title: 'Sentiment is strongly positive',
        detail: `Positive sentiment appears in ${formatPercent(positiveRate)} of comments. Lean into the angle that’s resonating (and repeat the format).`,
      });
    }
  }

  const takeaways = takeawayCandidates
    .sort((a, b) => b.priority - a.priority)
    .map((entry) => ({ title: entry.title, detail: entry.detail }))
    .filter(
      (entry, index, all) =>
        all.findIndex((candidate) => candidate.title === entry.title) === index,
    )
    .slice(0, TAKEAWAY_LIMIT);

  radar.praise = sentimentBreakdown.positive;
  radar.criticism = sentimentBreakdown.negative;
  radar.question = questionCount;
  radar.suggestion = suggestionCount;
  radar.toxic = toxicCount;

  return {
    schema: 'constructive.comment-analytics@v3',
    commentCount: analyzedCount,
    analyzedAt: new Date().toISOString(),
    sentimentBreakdown,
    toxicCount,
    questionCount,
    suggestionCount,
    radar,
    themes: {
      topics: themes.topics.slice(0, THEME_BUCKET_SIZE),
      people: themes.people.slice(0, THEME_BUCKET_SIZE),
    },
    highlights: {
      questions,
      suggestions,
      quotes,
    },
    takeaways,
  };
}

function isCommentAnalytics(value: unknown): value is CommentAnalytics {
  if (!isRecord(value)) return false;
  if (value.schema !== 'constructive.comment-analytics@v3') return false;
  if (typeof value.commentCount !== 'number' || value.commentCount < 0) return false;
  if (typeof value.analyzedAt !== 'string') return false;

  if (!isRecord(value.sentimentBreakdown)) return false;
  if (
    typeof value.sentimentBreakdown.positive !== 'number' ||
    value.sentimentBreakdown.positive < 0
  ) {
    return false;
  }
  if (
    typeof value.sentimentBreakdown.neutral !== 'number' ||
    value.sentimentBreakdown.neutral < 0
  ) {
    return false;
  }
  if (
    typeof value.sentimentBreakdown.negative !== 'number' ||
    value.sentimentBreakdown.negative < 0
  ) {
    return false;
  }

  const totalSentiment =
    value.sentimentBreakdown.positive +
    value.sentimentBreakdown.neutral +
    value.sentimentBreakdown.negative;
  if (totalSentiment !== value.commentCount) return false;

  if (typeof value.toxicCount !== 'number' || value.toxicCount < 0) return false;
  if (typeof value.questionCount !== 'number' || value.questionCount < 0) return false;
  if (typeof value.suggestionCount !== 'number' || value.suggestionCount < 0) {
    return false;
  }

  if (!isRecord(value.radar)) return false;
  for (const category of RADAR_CATEGORIES) {
    const count = value.radar[category.key];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return false;
    if (count > value.commentCount) return false;
  }

  // Radar buckets are validated independently. Some categories may mirror other
  // summary metrics today, but the schema does not enforce strict equality.

  if (!isRecord(value.themes)) return false;
  if (!Array.isArray(value.themes.topics)) return false;
  for (const theme of value.themes.topics) {
    if (!isRecord(theme)) return false;
    if (typeof theme.label !== 'string') return false;
    if (typeof theme.count !== 'number' || theme.count < 0) return false;
  }
  if (!Array.isArray(value.themes.people)) return false;
  for (const theme of value.themes.people) {
    if (!isRecord(theme)) return false;
    if (typeof theme.label !== 'string') return false;
    if (typeof theme.count !== 'number' || theme.count < 0) return false;
  }

  if (!isRecord(value.highlights)) return false;
  if (!Array.isArray(value.highlights.questions)) return false;
  for (const question of value.highlights.questions) {
    if (typeof question !== 'string') return false;
  }
  if (!Array.isArray(value.highlights.suggestions)) return false;
  for (const suggestion of value.highlights.suggestions) {
    if (typeof suggestion !== 'string') return false;
  }
  if (!Array.isArray(value.highlights.quotes)) return false;
  for (const quote of value.highlights.quotes) {
    if (typeof quote !== 'string') return false;
  }

  if (!Array.isArray(value.takeaways)) return false;
  for (const takeaway of value.takeaways) {
    if (!isRecord(takeaway)) return false;
    if (typeof takeaway.title !== 'string') return false;
    if (typeof takeaway.detail !== 'string') return false;
  }

  return true;
}

// The generated MDX expects `<Report />` to be injected via the app's `MDXProvider`.
// If it's missing, the report renders a small fallback callout instead.
function buildReportMdx(video: VideoMetadata, analytics: CommentAnalytics): string {
  const report = {
    schema: 'constructive.comment-report@v2',
    generatedAt: analytics.analyzedAt,
    video: {
      platform: video.platform,
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channel.channelTitle,
      videoUrl: video.videoUrl,
    },
    snapshot: {
      commentCount: analytics.commentCount,
      sentimentBreakdown: analytics.sentimentBreakdown,
      toxicCount: analytics.toxicCount,
      questionCount: analytics.questionCount,
      suggestionCount: analytics.suggestionCount,
    },
    core: {
      takeaways: analytics.takeaways,
      topics: analytics.themes.topics,
      questions: analytics.highlights.questions,
      suggestions: analytics.highlights.suggestions,
    },
    optional: {
      people: analytics.themes.people,
      quotes: analytics.highlights.quotes,
    },
  };

  const lines: string[] = [];
  lines.push(`export const report = ${JSON.stringify(report, null, 2)}`, '');
  lines.push(
    '{typeof Report !== "undefined" ? <Report report={report} /> : (',
    '  <div className="callout">',
    '    <strong>Missing widget:</strong> Report',
    '  </div>',
    ')}',
    '',
  );
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
    const fileStat = await stat(filePath);
    return fileStat.isFile();
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
      const existing = await readJsonFile(analyticsPath);
      if (isCommentAnalytics(existing)) {
        analytics = existing;
      } else {
        analytics = analyzeComments(comments);
        await writeJsonFile(analyticsPath, analytics);
      }
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
