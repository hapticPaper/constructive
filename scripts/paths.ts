import fs from 'node:fs';
import path from 'node:path';

import type { Platform } from '../src/content/types';

const ROOT = path.resolve(process.cwd(), 'content');

// Process-local caches for short-lived CLI scripts.
// These do not reflect on-disk changes after they are initialized.
const RESOLVED_VIDEO_ROOTS = new Map<string, string>();
const VIDEO_INDEX_BY_PLATFORM = new Map<Platform, Map<string, string>>();

function assertChannelId(platform: Platform, channelId: string): void {
  if (!channelId) {
    throw new Error('channelId is required for channel-scoped storage.');
  }

  if (platform === 'youtube' && /^[a-zA-Z0-9_-]{11}$/.test(channelId)) {
    throw new Error(
      `channelId "${channelId}" looks like a YouTube video id; did you swap parameters?`,
    );
  }
}

function buildVideoIndex(platform: Platform): Map<string, string> {
  const index = new Map<string, string>();

  function isChannelScoped(p: string): boolean {
    return p.includes(`${path.sep}channels${path.sep}`);
  }

  const legacyDir = path.join(ROOT, 'platforms', platform, 'videos');
  if (fs.existsSync(legacyDir)) {
    for (const entry of fs.readdirSync(legacyDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      index.set(entry.name, path.join(legacyDir, entry.name));
    }
  }

  const channelsDir = path.join(ROOT, 'platforms', platform, 'channels');
  if (fs.existsSync(channelsDir)) {
    for (const channelEntry of fs.readdirSync(channelsDir, { withFileTypes: true })) {
      if (!channelEntry.isDirectory()) continue;
      const videosDir = path.join(channelsDir, channelEntry.name, 'videos');
      if (!fs.existsSync(videosDir)) continue;

      for (const videoEntry of fs.readdirSync(videosDir, { withFileTypes: true })) {
        if (!videoEntry.isDirectory()) continue;
        const videoId = videoEntry.name;
        const baseDir = path.join(videosDir, videoId);

        const existing = index.get(videoId);
        if (existing && existing !== baseDir) {
          const existingIsChannel = isChannelScoped(existing);
          const currentIsChannel = isChannelScoped(baseDir);

          if (existingIsChannel && currentIsChannel) {
            throw new Error(
              `Duplicate video id detected for ${platform}:${videoId} in channels tree (check platforms/${platform}/channels/*/videos): ${existing} and ${baseDir}.`,
            );
          }

          if (!existingIsChannel && currentIsChannel) {
            process.stderr.write(
              `Duplicate video id detected for ${platform}:${videoId}. Preferring channel-scoped ${baseDir} over legacy ${existing}.\n`,
            );
            index.set(videoId, baseDir);
            continue;
          }

          process.stderr.write(
            `Duplicate video id detected for ${platform}:${videoId}. Keeping existing ${existing} and ignoring ${baseDir}.\n`,
          );
          continue;
        }

        index.set(videoId, baseDir);
      }
    }
  }

  return index;
}

export function channelRoot(platform: Platform, channelId: string): string {
  assertChannelId(platform, channelId);
  return path.join(ROOT, 'platforms', platform, 'channels', channelId);
}

export function channelJsonPath(platform: Platform, channelId: string): string {
  return path.join(channelRoot(platform, channelId), 'channel.json');
}

export function videoRoot(platform: Platform, channelId: string, videoId: string): string {
  assertChannelId(platform, channelId);
  return path.join(channelRoot(platform, channelId), 'videos', videoId);
}

export function resolveVideoRoot(platform: Platform, videoId: string): string {
  const key = `${platform}:${videoId}`;
  const cached = RESOLVED_VIDEO_ROOTS.get(key);
  if (cached) return cached;

  const index = VIDEO_INDEX_BY_PLATFORM.get(platform) ?? buildVideoIndex(platform);
  VIDEO_INDEX_BY_PLATFORM.set(platform, index);

  const resolved = index.get(videoId);
  if (!resolved) {
    throw new Error(
      `Video not found for ${platform}:${videoId}. Checked legacy videos/ and channels/*/videos/.`,
    );
  }

  RESOLVED_VIDEO_ROOTS.set(key, resolved);
  return resolved;
}

export function videoJsonPath(platform: Platform, channelId: string, videoId: string): string {
  return path.join(videoRoot(platform, channelId, videoId), 'video.json');
}

export function resolveVideoJsonPath(platform: Platform, videoId: string): string {
  return path.join(resolveVideoRoot(platform, videoId), 'video.json');
}

export function commentsJsonPath(platform: Platform, channelId: string, videoId: string): string {
  return path.join(videoRoot(platform, channelId, videoId), 'comments.json');
}

export function resolveCommentsJsonPath(platform: Platform, videoId: string): string {
  return path.join(resolveVideoRoot(platform, videoId), 'comments.json');
}

export function analyticsJsonPath(platform: Platform, channelId: string, videoId: string): string {
  return path.join(videoRoot(platform, channelId, videoId), 'analytics.json');
}

export function resolveAnalyticsJsonPath(platform: Platform, videoId: string): string {
  return path.join(resolveVideoRoot(platform, videoId), 'analytics.json');
}

export function reportMdxPath(platform: Platform, channelId: string, videoId: string): string {
  return path.join(videoRoot(platform, channelId, videoId), 'report.mdx');
}

export function resolveReportMdxPath(platform: Platform, videoId: string): string {
  return path.join(resolveVideoRoot(platform, videoId), 'report.mdx');
}

export function ingestionMetaPath(platform: Platform, channelId: string, videoId: string): string {
  return path.join(videoRoot(platform, channelId, videoId), 'ingestion.json');
}

export function resolveIngestionMetaPath(platform: Platform, videoId: string): string {
  return path.join(resolveVideoRoot(platform, videoId), 'ingestion.json');
}
