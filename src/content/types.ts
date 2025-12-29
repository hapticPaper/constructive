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

export type CommentAnalytics = {
  commentCount: number;
  analyzedAt: string;
  sentimentBreakdown: Record<Sentiment, number>;
  toxicCount: number;
  questionCount: number;
  suggestionCount: number;
  topThemes: Array<{ label: string; count: number }>;
  safeQuotes: string[];
  gentleCritiques: string[];
};

export type VideoContent = {
  video: VideoMetadata;
  comments: CommentRecord[];
  analytics: CommentAnalytics;
};
