export type Platform = 'youtube';

export type VideoKey = {
  platform: Platform;
  videoId: string;
};

export type ChannelRef = {
  platform: Platform;
  channelId: string;
  channelTitle: string;
  channelUrl?: string;
};

export type VideoMetadata = {
  platform: Platform;
  videoId: string;
  videoUrl: string;
  title: string;
  description?: string;
  channel: ChannelRef;
  publishedAt?: string;
  thumbnailUrl?: string;
};

export type VideoReachSnapshot = {
  capturedAt: string;
  viewCount?: number;
  likeCount?: number;
};

export type VideoReach = {
  // `schema` is a versioned discriminator for the on-disk reach snapshot format.
  schema: 'constructive.video-reach@v1';
  platform: Platform;
  videoId: string;
  snapshots: VideoReachSnapshot[];
};

export type CommentRecord = {
  id: string;
  // When true, `id` is synthetic (not a native YouTube `comment_id`).
  syntheticId?: true;
  authorName?: string;
  publishedAt?: string;
  likeCount?: number;
  text: string;
};

export type Sentiment = 'positive' | 'neutral' | 'negative';

export type RadarCategory =
  | 'praise'
  | 'criticism'
  | 'question'
  | 'suggestion'
  | 'toxic'
  | 'people';

export type RadarCategoryCounts = Record<RadarCategory, number>;

export type CommentSignals = {
  sentiment: Sentiment;
  isToxic: boolean;
  isQuestion: boolean;
  isSuggestion: boolean;
};

export type ThemeBucket = Array<{ label: string; count: number }>;

export type CreatorTakeaway = {
  title: string;
  detail: string;
};

// Comment analytics schema is versioned. This type represents the latest version.
export type CommentAnalytics = {
  schema: 'constructive.comment-analytics@v3';
  commentCount: number;
  analyzedAt: string;
  sentimentBreakdown: Record<Sentiment, number>;
  toxicCount: number;
  questionCount: number;
  suggestionCount: number;
  radar: RadarCategoryCounts;
  themes: {
    topics: ThemeBucket;
    people: ThemeBucket;
  };
  highlights: {
    questions: string[];
    suggestions: string[];
    quotes: string[];
  };
  takeaways: CreatorTakeaway[];
};

/**
 * Build-time content for a video.
 *
 * `comments` and `analytics` are optional to support partial ingestion states
 * (e.g. comments are captured, but analysis/report haven't run yet).
 */
export type VideoContent = {
  video: VideoMetadata;
  comments?: CommentRecord[];
  analytics?: CommentAnalytics;
  reach?: VideoReach;
};

/**
 * Channel-level aggregate of video analytics.
 */
export type ChannelAggregate = {
  schema: 'constructive.channel-aggregate@v1';
  generatedAt: string;
  channel: ChannelRef;
  videoCount: number;
  totalComments: number;
  sentimentBreakdown: Record<Sentiment, number>;
  topTopics: ThemeBucket;
  takeaways: CreatorTakeaway[];
};
