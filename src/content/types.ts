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

export type CommentRecord = {
  id: string;
  authorName?: string;
  publishedAt?: string;
  likeCount?: number;
  text: string;
};

export type Sentiment = 'positive' | 'neutral' | 'negative';

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

export type CommentAnalytics = {
  schema: 'constructive.comment-analytics@v2';
  commentCount: number;
  analyzedAt: string;
  sentimentBreakdown: Record<Sentiment, number>;
  toxicCount: number;
  questionCount: number;
  suggestionCount: number;
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
};
