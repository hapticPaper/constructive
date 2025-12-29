import type { VideoContent } from '../types';

import youtube_IPsu4pMpIjk_video from '../../../content/platforms/youtube/channels/UC1E1SVcVyU3ntWMSQEp38Yw/videos/IPsu4pMpIjk/video.json';
import youtube_IPsu4pMpIjk_comments from '../../../content/platforms/youtube/channels/UC1E1SVcVyU3ntWMSQEp38Yw/videos/IPsu4pMpIjk/comments.json';
import youtube_IPsu4pMpIjk_analytics from '../../../content/platforms/youtube/channels/UC1E1SVcVyU3ntWMSQEp38Yw/videos/IPsu4pMpIjk/analytics.json';

import youtube_KXPhaAsnrfs_video from '../../../content/platforms/youtube/channels/UC7_gcs09iThXybpVgjHZ_7g/videos/KXPhaAsnrfs/video.json';
import youtube_KXPhaAsnrfs_comments from '../../../content/platforms/youtube/channels/UC7_gcs09iThXybpVgjHZ_7g/videos/KXPhaAsnrfs/comments.json';
import youtube_KXPhaAsnrfs_analytics from '../../../content/platforms/youtube/channels/UC7_gcs09iThXybpVgjHZ_7g/videos/KXPhaAsnrfs/analytics.json';

export const VIDEO_CONTENT: Record<string, VideoContent> = {
  'youtube:IPsu4pMpIjk': {
    video: youtube_IPsu4pMpIjk_video as unknown as VideoContent['video'],
    comments: youtube_IPsu4pMpIjk_comments as unknown as VideoContent['comments'],
    analytics: youtube_IPsu4pMpIjk_analytics as unknown as VideoContent['analytics'],
  },
  'youtube:KXPhaAsnrfs': {
    video: youtube_KXPhaAsnrfs_video as unknown as VideoContent['video'],
    comments: youtube_KXPhaAsnrfs_comments as unknown as VideoContent['comments'],
    analytics: youtube_KXPhaAsnrfs_analytics as unknown as VideoContent['analytics'],
  },
};
