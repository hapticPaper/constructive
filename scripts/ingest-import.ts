import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { CommentRecord } from '../src/content/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCommentText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stringifyId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toIsoDateString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;

  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function syntheticIdStable(fields: {
  text: string;
  authorName?: string;
  publishedAt?: string;
}): string {
  const payload = `${fields.text}|${fields.authorName ?? ''}|${fields.publishedAt ?? ''}`;
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 12);
  return `synthetic_${hash}`;
}

function ensureUniqueSyntheticId(
  baseId: string,
  existing: Set<string>,
  idx: number,
): string {
  if (!existing.has(baseId)) return baseId;
  return `${baseId}_${idx}`;
}

function pickText(rec: Record<string, unknown>): string | null {
  for (const key of ['text', 'comment', 'message', 'content', 'textDisplay']) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function pickAuthor(rec: Record<string, unknown>): string | undefined {
  for (const key of ['authorName', 'username', 'userName', 'author']) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  const user = rec.user;
  if (isRecord(user)) {
    for (const key of ['username', 'userName', 'name']) {
      const value = user[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }

  const author = rec.author;
  if (isRecord(author)) {
    for (const key of ['unique_id', 'username', 'name']) {
      const value = author[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }

  return undefined;
}

function pickLikeCount(rec: Record<string, unknown>): number | undefined {
  for (const key of ['likeCount', 'likes', 'like_count', 'diggCount', 'digg_count']) {
    const value = rec[key];
    const n = toNumberOrUndefined(value);
    if (typeof n === 'number') return n;
  }
  return undefined;
}

function pickPublishedAt(rec: Record<string, unknown>): string | undefined {
  for (const key of [
    'publishedAt',
    'createdAt',
    'create_time',
    'createTime',
    'timestamp',
    'created_time',
  ]) {
    const value = rec[key];
    const iso = toIsoDateString(value);
    if (iso) return iso;
  }
  return undefined;
}

function unwrapCommentArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!isRecord(parsed)) return null;

  for (const key of ['comments', 'items', 'data', 'results']) {
    const value = parsed[key];
    if (Array.isArray(value)) return value;
  }

  return null;
}

export async function readCommentExportFile(
  absolutePath: string,
): Promise<CommentRecord[]> {
  const raw = await readFile(absolutePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = `Failed to parse JSON at ${absolutePath}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (error instanceof Error) {
      throw new Error(message, { cause: error });
    }
    throw new Error(message);
  }

  const entries = unwrapCommentArray(parsed);
  if (!entries) {
    throw new Error(
      `Invalid comments export at ${absolutePath}: expected an array (or an object containing an array).`,
    );
  }

  const syntheticIds = new Set<string>();
  const out: CommentRecord[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (typeof entry === 'string' && entry.trim()) {
      const text = normalizeCommentText(entry);
      if (!text) continue;
      const baseId = syntheticIdStable({ text });
      const id = ensureUniqueSyntheticId(baseId, syntheticIds, i);
      syntheticIds.add(id);
      out.push({ id, syntheticId: true, text });
      continue;
    }

    if (!isRecord(entry)) continue;
    const rawText = pickText(entry);
    if (!rawText) continue;
    const text = normalizeCommentText(rawText);
    if (!text) continue;

    const authorName = pickAuthor(entry);
    const publishedAt = pickPublishedAt(entry);

    const rawId =
      stringifyId(entry.id) ??
      stringifyId(entry.commentId) ??
      stringifyId(entry.comment_id) ??
      stringifyId(entry.pk);

    const isSynthetic = rawId == null;
    const baseId = isSynthetic
      ? syntheticIdStable({ text, authorName, publishedAt })
      : rawId;
    const id = isSynthetic ? ensureUniqueSyntheticId(baseId, syntheticIds, i) : baseId;
    if (isSynthetic) syntheticIds.add(id);

    out.push({
      id,
      syntheticId: isSynthetic ? true : undefined,
      authorName,
      publishedAt,
      likeCount: pickLikeCount(entry),
      text,
    });
  }

  if (out.length === 0) {
    throw new Error(
      `Invalid comments export at ${absolutePath}: no valid comment records found.`,
    );
  }

  return out;
}
