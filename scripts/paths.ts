import path from 'node:path';

import type { Platform } from '../src/content/types';

const ROOT = path.resolve(process.cwd(), 'content');

export function videoRoot(platform: Platform, videoId: string): string {
  return path.join(ROOT, 'platforms', platform, 'videos', videoId);
}

export function videoJsonPath(platform: Platform, videoId: string): string {
  return path.join(videoRoot(platform, videoId), 'video.json');
}

export function commentsJsonPath(platform: Platform, videoId: string): string {
  return path.join(videoRoot(platform, videoId), 'comments.json');
}

export function analyticsJsonPath(platform: Platform, videoId: string): string {
  return path.join(videoRoot(platform, videoId), 'analytics.json');
}

export function reportMdxPath(platform: Platform, videoId: string): string {
  return path.join(videoRoot(platform, videoId), 'report.mdx');
}

export function ingestionMetaPath(platform: Platform, videoId: string): string {
  return path.join(videoRoot(platform, videoId), 'ingestion.json');
}

export function channelRoot(platform: Platform, channelId: string): string {
  return path.join(ROOT, 'platforms', platform, 'channels', channelId);
}

export function channelAggregateMdxPath(platform: Platform, channelId: string): string {
  return path.join(channelRoot(platform, channelId), 'channel-aggregate.mdx');
}
