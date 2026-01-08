import type { CSSProperties } from 'react';

import type { CreatorTakeaway, Sentiment, ThemeBucket } from '../content/types';

import { BarList } from '../components/ui/BarList';
import { barListItemsFromCounts } from '../components/ui/barListItems';

import { Callout } from './Callout';
import { WidgetGrid } from './WidgetGrid';
import { WidgetPanel } from './WidgetPanel';

type ThemeItem = ThemeBucket[number];

const REPORT_SCHEMA = 'constructive.comment-report@v2' as const;

export type CommentReport = {
  schema: typeof REPORT_SCHEMA;
  generatedAt: string;
  video: {
    platform: string;
    videoId: string;
    title: string;
    channelTitle: string;
    videoUrl: string;
  };
  snapshot: {
    commentCount: number;
    sentimentBreakdown: Record<Sentiment, number>;
    toxicCount: number;
    questionCount: number;
    suggestionCount: number;
  };
  core: {
    takeaways: CreatorTakeaway[];
    topics: ThemeItem[];
    questions: string[];
    suggestions: string[];
  };
  optional?: {
    people?: ThemeItem[];
    quotes?: string[];
  };
};

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
  // Theme labels are derived from tokenized text and filtered by the analyzer
  // (stopwords + toxic words), so they should be short and safe to render.
  if (items.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        No strong cluster stood out in this snapshot.
      </p>
    );
  }

  const barItems = barListItemsFromCounts(items, total);

  return <BarList items={barItems} style={{ gap: 10, marginTop: 10 }} />;
}

function BulletList({ items }: { items: string[] }): JSX.Element {
  if (items.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        Nothing strong stood out in this snapshot.
      </p>
    );
  }

  return (
    <ul className="muted" style={{ margin: '10px 0 0 18px' }}>
      {items.map((item, index) => (
        <li key={`${index}:${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function TakeawayList({ takeaways }: { takeaways: CreatorTakeaway[] }): JSX.Element {
  if (takeaways.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        No strong takeaways stood out in this snapshot.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {takeaways.map((takeaway) => (
        <div key={`${takeaway.title}:${takeaway.detail}`}>
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

export function Report({ report }: { report: CommentReport }): JSX.Element {
  if (report.schema !== REPORT_SCHEMA) {
    return (
      <Callout title="Unsupported report schema">
        Expected <code>{REPORT_SCHEMA}</code>, got <code>{report.schema}</code>.
      </Callout>
    );
  }

  const total = report.snapshot.commentCount;
  const denom = total > 0 ? total : 1;

  const people = report.optional?.people ?? [];
  const quotes = report.optional?.quotes ?? [];

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Generated from a snapshot of YouTube comments for{' '}
        <strong>{report.video.title}</strong>.
      </p>
      <Callout title="Tone filter">
        We focus on actionable signal. Harsh/insulting language is excluded from quotes
        and softened in summaries.
      </Callout>

      <div style={{ marginTop: 14 }}>
        <WidgetGrid columns={3}>
          <WidgetPanel title="Snapshot">
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}
            >
              <StatRow
                label="Comments analyzed"
                value={report.snapshot.commentCount.toLocaleString()}
              />
              <StatRow
                label="Questions"
                value={report.snapshot.questionCount.toLocaleString()}
              />
              <StatRow
                label="Suggestions"
                value={report.snapshot.suggestionCount.toLocaleString()}
              />
              <StatRow
                label="Toxic language (filtered)"
                value={report.snapshot.toxicCount.toLocaleString()}
                valueStyle={{ color: 'var(--danger)' }}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontWeight: 650 }}>
                Sentiment mix
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
                        report.snapshot.sentimentBreakdown[sentiment] / denom,
                      )}{' '}
                      · {report.snapshot.sentimentBreakdown[sentiment].toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </WidgetPanel>

          <WidgetPanel title="30-second takeaways">
            <TakeawayList takeaways={report.core.takeaways} />
          </WidgetPanel>

          <WidgetPanel title="Topics (content)">
            <p className="muted" style={{ marginTop: 6 }}>
              Themes are counted as “comments mentioning the term” (they can overlap), not
              raw word frequency. Labels assume a manual curation pass to merge
              near-duplicates and drop background noise.
            </p>
            <HistogramList
              items={report.core.topics}
              total={report.snapshot.commentCount}
            />
          </WidgetPanel>
        </WidgetGrid>
      </div>

      {people.length || report.core.questions.length || report.core.suggestions.length ? (
        <div style={{ marginTop: 14 }}>
          <WidgetGrid columns={3}>
            {people.length ? (
              <WidgetPanel title="People mentioned">
                <p className="muted" style={{ marginTop: 6 }}>
                  These are often “host/guest” reactions (separate from content/topic
                  reactions).
                </p>
                <HistogramList items={people} total={report.snapshot.commentCount} />
              </WidgetPanel>
            ) : null}

            {report.core.questions.length ? (
              <WidgetPanel title="Questions people asked">
                <BulletList items={report.core.questions} />
              </WidgetPanel>
            ) : null}

            {report.core.suggestions.length ? (
              <WidgetPanel title="Suggestions / requests">
                <BulletList items={report.core.suggestions} />
              </WidgetPanel>
            ) : null}
          </WidgetGrid>
        </div>
      ) : null}

      {quotes.length ? (
        <div style={{ marginTop: 14 }}>
          <WidgetPanel title="Representative quotes (safe)">
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}
            >
              {quotes.map((quote, index) => (
                <div key={`${index}:${quote}`} className="callout">
                  <div className="muted">“{quote}”</div>
                </div>
              ))}
            </div>
          </WidgetPanel>
        </div>
      ) : null}
    </div>
  );
}
