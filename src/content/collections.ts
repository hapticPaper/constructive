import type { Platform, VideoMetadata } from './types';

import { getVideoContent } from './content';

export type VideoRef = {
  platform: Platform;
  videoId: string;
};

export const ONBOARDING_SAMPLE_VIDEOS: readonly VideoRef[] = [
  { platform: 'youtube', videoId: 'IPsu4pMpIjk' },
  { platform: 'youtube', videoId: 'KXPhaAsnrfs' },
];

export const PALETTE_MEDIA_VIDEOS: readonly VideoRef[] = [
  { platform: 'youtube', videoId: 'tvq4nsaWRCY' },
  { platform: 'youtube', videoId: 'JBeTnhChWd0' },
  { platform: 'youtube', videoId: '1oTcaRbSxuM' },
  { platform: 'youtube', videoId: 'gf8LP9XvgeY' },
];

export function getCuratedVideos(refs: readonly VideoRef[]): VideoMetadata[] {
  const videos: VideoMetadata[] = [];
  for (const ref of refs) {
    const content = getVideoContent(ref.platform, ref.videoId);
    if (content) videos.push(content.video);
  }
  return videos;
}
