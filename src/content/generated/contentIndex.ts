// AUTO-GENERATED FILE. DO NOT EDIT.
// See scripts/generate-content-index.ts for the generation logic.

import type { VideoContent } from '../types';

import youtube_IPsu4pMpIjk_video from '../../../content/platforms/youtube/videos/IPsu4pMpIjk/video.json';
import youtube_IPsu4pMpIjk_comments from '../../../content/platforms/youtube/videos/IPsu4pMpIjk/comments.json';
import youtube_IPsu4pMpIjk_analytics from '../../../content/platforms/youtube/videos/IPsu4pMpIjk/analytics.json';

import youtube_KXPhaAsnrfs_video from '../../../content/platforms/youtube/videos/KXPhaAsnrfs/video.json';
import youtube_KXPhaAsnrfs_comments from '../../../content/platforms/youtube/videos/KXPhaAsnrfs/comments.json';
import youtube_KXPhaAsnrfs_analytics from '../../../content/platforms/youtube/videos/KXPhaAsnrfs/analytics.json';

export const VIDEO_CONTENT: Record<string, VideoContent> = {
  'youtube:IPsu4pMpIjk': {
    video: {
      ...youtube_IPsu4pMpIjk_video,
      platform: 'youtube',
      channel: { ...youtube_IPsu4pMpIjk_video.channel, platform: 'youtube' },
    },
    comments: youtube_IPsu4pMpIjk_comments,
    analytics: youtube_IPsu4pMpIjk_analytics,
  },
  'youtube:KXPhaAsnrfs': {
    video: {
      ...youtube_KXPhaAsnrfs_video,
      platform: 'youtube',
      channel: { ...youtube_KXPhaAsnrfs_video.channel, platform: 'youtube' },
    },
    comments: youtube_KXPhaAsnrfs_comments,
    analytics: youtube_KXPhaAsnrfs_analytics,
  },
} satisfies Record<string, VideoContent>;
