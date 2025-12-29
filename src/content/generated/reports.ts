import type { ComponentType } from 'react';

type VideoReportsMap = Record<string, ComponentType | undefined>;

import youtube_IPsu4pMpIjk_report from '../../../content/platforms/youtube/channels/UC1E1SVcVyU3ntWMSQEp38Yw/videos/IPsu4pMpIjk/report.mdx';

import youtube_KXPhaAsnrfs_report from '../../../content/platforms/youtube/channels/UC7_gcs09iThXybpVgjHZ_7g/videos/KXPhaAsnrfs/report.mdx';

const VIDEO_REPORTS_DATA = {
  'youtube:IPsu4pMpIjk': youtube_IPsu4pMpIjk_report,
  'youtube:KXPhaAsnrfs': youtube_KXPhaAsnrfs_report,
} satisfies VideoReportsMap;

export const VIDEO_REPORTS: VideoReportsMap = VIDEO_REPORTS_DATA;
