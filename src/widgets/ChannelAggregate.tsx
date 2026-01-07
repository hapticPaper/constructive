import type { CSSProperties } from 'react';

import type {
  ChannelAggregate,
  CreatorTakeaway,
  Sentiment,
  ThemeBucket,
} from '../content/types';

import { Callout } from './Callout';
import { WidgetGrid } from './WidgetGrid';
import { WidgetPanel } from './WidgetPanel';

type ThemeItem = ThemeBucket[number];

const CHANNEL_AGGREGATE_SCHEMA = 'constructive.channel-aggregate@v1' as const;

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: 'var(--positive)',
  neutral: 'var(--neutral)',
  negative: 'var(--negative)',
};

const SENTIMENT_ORDER: Sentiment[] = ['positive', 'neutral', 'negative'];

const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: 'positive',
  neutral: 'neutral / informational',
  negative: 'negative',
};

function StatRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: CSSProperties;
}): JSX.Element {
  return (
    <div className="row">
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 650, ...valueStyle }}>{value}</span>
    </div>
  );
}

function HistogramList({
  items,
  total,
}: {
  items: ThemeItem[];
  total: number;
}): JSX.Element {
  if (items.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        No strong cluster stood out across videos.
      </p>
    );
  }

  const denom = total > 0 ? total : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div className="row" style={{ gap: 12 }}>
            <span style={{ fontWeight: 650 }}>{item.label}</span>
            <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatPercent(item.count / denom)} · {item.count.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              height: 8,
              borderRadius: 999,
              background: 'rgba(148, 163, 184, 0.22)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(1, item.count / denom)) * 100}%`,
                background: 'var(--brand)',
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TakeawayList({ takeaways }: { takeaways: CreatorTakeaway[] }): JSX.Element {
  if (takeaways.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        No strong takeaways identified across the channel.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {takeaways.map((takeaway) => (
        <div key={takeaway.title}>
          <div style={{ fontWeight: 650 }}>{takeaway.title}</div>
          <div className="muted" style={{ marginTop: 4, lineHeight: 1.35 }}>
            {takeaway.detail}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatPercent(value: number): string {
  const pct = Math.round(value * 100);
  return `${pct}%`;
}

export function ChannelAggregate({
  channelAggregate,
}: {
  channelAggregate: ChannelAggregate;
}): JSX.Element {
  if (channelAggregate.schema !== CHANNEL_AGGREGATE_SCHEMA) {
    return (
      <Callout title="Unsupported channel aggregate schema">
        Expected <code>{CHANNEL_AGGREGATE_SCHEMA}</code>, got{' '}
        <code>{channelAggregate.schema}</code>.
      </Callout>
    );
  }

  const total = channelAggregate.totalComments;
  const denom = total > 0 ? total : 1;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Channel-level insights aggregated from {channelAggregate.videoCount} analyzed
        video{channelAggregate.videoCount !== 1 ? 's' : ''} for{' '}
        <strong>{channelAggregate.channel.channelTitle}</strong>.
      </p>
      <Callout title="Channel view">
        This aggregates patterns across all analyzed videos to help identify channel-wide
        trends and opportunities.
      </Callout>

      <div style={{ marginTop: 14 }}>
        <WidgetGrid columns={3}>
          <WidgetPanel title="Channel summary">
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}
            >
              <StatRow
                label="Videos analyzed"
                value={channelAggregate.videoCount.toLocaleString()}
              />
              <StatRow
                label="Total comments"
                value={channelAggregate.totalComments.toLocaleString()}
              />
              <StatRow
                label="Avg per video"
                value={Math.round(
                  channelAggregate.totalComments / channelAggregate.videoCount,
                ).toLocaleString()}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontWeight: 650 }}>
                Sentiment breakdown
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {SENTIMENT_ORDER.map((sentiment) => (
                  <div key={sentiment} className="row">
                    <span className="muted">{SENTIMENT_LABELS[sentiment]}</span>
                    <span style={{ fontWeight: 650, color: SENTIMENT_COLORS[sentiment] }}>
                      {formatPercent(
                        channelAggregate.sentimentBreakdown[sentiment] / denom,
                      )}{' '}
                      · {channelAggregate.sentimentBreakdown[sentiment].toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </WidgetPanel>

          <WidgetPanel title="Channel-level takeaways">
            <TakeawayList takeaways={channelAggregate.takeaways} />
          </WidgetPanel>

          <WidgetPanel title="Top topics across channel">
            <p className="muted" style={{ marginTop: 6 }}>
              Themes are counted as “comments mentioning the term” (they can overlap).
              Very common filler terms are suppressed.
            </p>
            <HistogramList
              items={channelAggregate.topTopics}
              total={channelAggregate.totalComments}
            />
          </WidgetPanel>
        </WidgetGrid>
      </div>
    </div>
  );
}
