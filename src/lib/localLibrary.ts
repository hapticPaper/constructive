import type { Platform } from '../content/types';
import { fetchYouTubeOEmbed } from './youtube';

const STORAGE_KEY = 'constructive_local_library_v1';

export type LocalLibraryVideo = {
  platform: Platform;
  videoId: string;
  videoUrl: string;
  addedAtMs: number;
  updatedAtMs: number;
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
};

function nowMs(): number {
  return Date.now();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseLocalLibrary(raw: string | null): LocalLibraryVideo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        const rec = asRecord(entry);
        if (!rec) return null;
        const platform = rec.platform === 'youtube' ? 'youtube' : null;
        const videoId = typeof rec.videoId === 'string' ? rec.videoId : null;
        const videoUrl = typeof rec.videoUrl === 'string' ? rec.videoUrl : null;
        const addedAtMs = typeof rec.addedAtMs === 'number' ? rec.addedAtMs : null;
        const updatedAtMs = typeof rec.updatedAtMs === 'number' ? rec.updatedAtMs : null;
        if (!platform || !videoId || !videoUrl) return null;
        if (addedAtMs === null || updatedAtMs === null) return null;
        if (!Number.isFinite(addedAtMs) || !Number.isFinite(updatedAtMs)) return null;

        const out: LocalLibraryVideo = {
          platform,
          videoId,
          videoUrl,
          addedAtMs,
          updatedAtMs,
        };

        if (typeof rec.title === 'string') out.title = rec.title;
        if (typeof rec.channelTitle === 'string') out.channelTitle = rec.channelTitle;
        if (typeof rec.thumbnailUrl === 'string') out.thumbnailUrl = rec.thumbnailUrl;

        return out;
      })
      .filter((v): v is LocalLibraryVideo => v !== null);
  } catch {
    return [];
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadLibrary(): LocalLibraryVideo[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    return parseLocalLibrary(storage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function persistLibrary(entries: LocalLibraryVideo[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-200)));
  } catch {
    // ignore: local library is best-effort
  }
}

export function listLocalLibraryVideos(): LocalLibraryVideo[] {
  return loadLibrary().sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export function upsertLocalLibraryVideo({
  platform,
  videoId,
  videoUrl,
}: {
  platform: Platform;
  videoId: string;
  videoUrl: string;
}): void {
  const entries = loadLibrary();
  const now = nowMs();
  const idx = entries.findIndex((e) => e.platform === platform && e.videoId === videoId);
  const existing = idx >= 0 ? entries[idx] : null;

  const next: LocalLibraryVideo = {
    platform,
    videoId,
    videoUrl,
    addedAtMs: existing?.addedAtMs ?? now,
    updatedAtMs: now,
    title: existing?.title,
    channelTitle: existing?.channelTitle,
    thumbnailUrl: existing?.thumbnailUrl,
  };

  if (idx >= 0) {
    entries[idx] = next;
  } else {
    entries.push(next);
  }

  persistLibrary(entries);
}

export function removeLocalLibraryVideo(platform: Platform, videoId: string): void {
  persistLibrary(
    loadLibrary().filter((e) => !(e.platform === platform && e.videoId === videoId)),
  );
}

export async function hydrateLocalLibraryVideoMetadata(
  platform: Platform,
  videoId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (platform !== 'youtube') return false;

  const entries = loadLibrary();
  const idx = entries.findIndex((e) => e.platform === platform && e.videoId === videoId);
  const existing = idx >= 0 ? entries[idx] : null;
  if (!existing) return false;
  if (existing.title && existing.channelTitle && existing.thumbnailUrl) return false;

  const oembed = await fetchYouTubeOEmbed(videoId, signal);
  if (!oembed) return false;

  const fresh = loadLibrary();
  const freshIdx = fresh.findIndex(
    (e) => e.platform === platform && e.videoId === videoId,
  );
  if (freshIdx < 0) return false;

  fresh[freshIdx] = {
    ...fresh[freshIdx],
    title: fresh[freshIdx].title ?? oembed.title,
    channelTitle: fresh[freshIdx].channelTitle ?? oembed.channelTitle,
    thumbnailUrl: fresh[freshIdx].thumbnailUrl ?? oembed.thumbnailUrl,
    updatedAtMs: nowMs(),
  };

  persistLibrary(fresh);

  return true;
}
