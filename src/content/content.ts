import type { ComponentType } from 'react';

import type { Platform, VideoContent, VideoMetadata } from './types';

import { VIDEO_CONTENT } from './generated/contentIndex';
import { VIDEO_REPORTS } from './generated/reports';

export function listVideos(): VideoMetadata[] {
  return Object.values(VIDEO_CONTENT).map((entry) => entry.video);
}

export function getVideoContent(platform: Platform, videoId: string): VideoContent | null {
  const key = `${platform}:${videoId}`;
  const entry: VideoContent | undefined = VIDEO_CONTENT[key];
  if (!entry) return null;
  return entry;
}

export function getVideoReportComponent(
  platform: Platform,
  videoId: string,
): ComponentType | null {
  const key = `${platform}:${videoId}`;
  return VIDEO_REPORTS[key] ?? null;
}
