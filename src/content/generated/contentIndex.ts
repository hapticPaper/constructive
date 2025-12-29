import type { VideoContent } from '../types';

type VideoContentMap = Record<string, VideoContent>;

import youtube_IPsu4pMpIjk_video from '../../../content/platforms/youtube/channels/UC1E1SVcVyU3ntWMSQEp38Yw/videos/IPsu4pMpIjk/video.json';
import youtube_IPsu4pMpIjk_comments from '../../../content/platforms/youtube/channels/UC1E1SVcVyU3ntWMSQEp38Yw/videos/IPsu4pMpIjk/comments.json';
import youtube_IPsu4pMpIjk_analytics from '../../../content/platforms/youtube/channels/UC1E1SVcVyU3ntWMSQEp38Yw/videos/IPsu4pMpIjk/analytics.json';

import youtube_KXPhaAsnrfs_video from '../../../content/platforms/youtube/channels/UC7_gcs09iThXybpVgjHZ_7g/videos/KXPhaAsnrfs/video.json';
import youtube_KXPhaAsnrfs_comments from '../../../content/platforms/youtube/channels/UC7_gcs09iThXybpVgjHZ_7g/videos/KXPhaAsnrfs/comments.json';
import youtube_KXPhaAsnrfs_analytics from '../../../content/platforms/youtube/channels/UC7_gcs09iThXybpVgjHZ_7g/videos/KXPhaAsnrfs/analytics.json';

const VIDEO_CONTENT_DATA = {
  'youtube:IPsu4pMpIjk': {
    video: {
      ...youtube_IPsu4pMpIjk_video,
      platform: 'youtube',
      channel: {
        ...youtube_IPsu4pMpIjk_video.channel,
        platform: 'youtube',
      },
    },
    comments: youtube_IPsu4pMpIjk_comments,
    analytics: youtube_IPsu4pMpIjk_analytics,
  },
  'youtube:KXPhaAsnrfs': {
    video: {
      ...youtube_KXPhaAsnrfs_video,
      platform: 'youtube',
      channel: {
        ...youtube_KXPhaAsnrfs_video.channel,
        platform: 'youtube',
      },
    },
    comments: youtube_KXPhaAsnrfs_comments,
    analytics: youtube_KXPhaAsnrfs_analytics,
  },
} satisfies VideoContentMap;

export const VIDEO_CONTENT: VideoContentMap = VIDEO_CONTENT_DATA;
