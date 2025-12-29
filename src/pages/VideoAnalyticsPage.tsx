import { MDXProvider } from '@mdx-js/react';
import type { MDXComponents } from 'mdx/types';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getVideoContent, getVideoReportComponent } from '../content/content';
import type { Platform } from '../content/types';
import { canRunAnalysis, consumeAnalysisRun } from '../lib/freemium';
import * as Widgets from '../widgets';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#8cffcb',
  neutral: 'rgba(255,255,255,0.40)',
  negative: '#ff6376',
};

function useConsumeAnalysisOncePerSession({
  key,
  enabled,
}: {
  key: string;
  enabled: boolean;
}): void {
  useEffect(() => {
    if (!enabled) return;

    const storageKey = `constructive_viewed:${key}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // ignore
    }

    consumeAnalysisRun();
  }, [enabled, key]);
}

export function VideoAnalyticsPage(): JSX.Element {
  const params = useParams();
  const platform = (params.platform as Platform | undefined) ?? 'youtube';
  const videoId = params.videoId ?? '';

  const content = useMemo(() => getVideoContent(platform, videoId), [platform, videoId]);
  const Report = useMemo(
    () => getVideoReportComponent(platform, videoId),
    [platform, videoId],
  );

  const gate = canRunAnalysis();

  useConsumeAnalysisOncePerSession({
    key: `${platform}:${videoId}`,
    enabled: Boolean(content) && gate.ok,
  });

  if (!content) {
    return (
      <div className="panel">
        <h2>Video not found</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          This build only includes a small demo library. Add more videos by running the ingestion
          and analysis scripts in the repo.
        </p>
      </div>
    );
  }

  if (!gate.ok) {
    return (
      <div>
        <div className="hero">
          <h1>Daily limit reached</h1>
          <p>{gate.reason}</p>
        </div>
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>How this demo works</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            The freemium gate is intentionally lightweight (cookie-based) so the demo can run
            entirely on GitHub Pages.
          </p>
        </div>
      </div>
    );
  }

  const sentimentData = Object.entries(content.analytics.sentimentBreakdown).map(
    ([name, value]) => ({ name, value }),
  );

  return (
    <div>
      <div className="hero">
        <h1>{content.video.title}</h1>
        <p>
          {content.video.channel.channelTitle} ·{' '}
          <a href={content.video.videoUrl} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
        </p>
      </div>

      <div style={{ marginTop: 18 }} className="grid grid-3">
        <section className="panel kpi">
          <div className="value">{content.analytics.commentCount.toLocaleString()}</div>
          <div className="label">Comments captured</div>
        </section>
        <section className="panel kpi">
          <div className="value">{content.analytics.questionCount.toLocaleString()}</div>
          <div className="label">Questions</div>
        </section>
        <section className="panel kpi">
          <div className="value">{content.analytics.suggestionCount.toLocaleString()}</div>
          <div className="label">Suggestions</div>
        </section>
      </div>

      <div style={{ marginTop: 14 }} className="grid grid-3">
        <section className="panel">
          <h2>Sentiment mix</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {sentimentData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SENTIMENT_COLORS[entry.name] ?? 'rgba(255,255,255,0.4)'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(7, 10, 19, 0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            This is a fast heuristic pass (lexicon + tone filter), not a fully-trained sentiment
            model.
          </p>
        </section>

        <section className="panel">
          <h2>Top themes</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={content.analytics.topThemes} layout="vertical" margin={{ left: 18 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={80} tick={{ fill: '#cfd5ff' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(7, 10, 19, 0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                  }}
                />
                <Bar dataKey="count" fill="rgba(106, 169, 255, 0.75)" radius={[6, 6, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Themes are pulled from comment text (stopword removal + frequency).
          </p>
        </section>

        <section className="panel">
          <h2>Protective filter</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            We don’t need to re-traumatize creators to find signal.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <div className="row">
              <span className="muted">Toxic / harsh</span>
              <span style={{ color: 'var(--danger)', fontWeight: 650 }}>
                {content.analytics.toxicCount.toLocaleString()}
              </span>
            </div>
            <div className="row">
              <span className="muted">Shown quotes</span>
              <span style={{ fontWeight: 650 }}>{content.analytics.safeQuotes.length}</span>
            </div>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 14 }} className="grid grid-3">
        <section className="panel">
          <h2>Constructive takeaways</h2>
          <ul className="muted" style={{ margin: '10px 0 0 18px' }}>
            {content.analytics.gentleCritiques.slice(0, 6).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="panel" style={{ gridColumn: 'span 2' }}>
          <h2>Notable quotes (safe)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {content.analytics.safeQuotes.slice(0, 6).map((quote) => (
              <div key={quote} className="callout">
                <div className="muted">“{quote}”</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {Report ? (
        <div style={{ marginTop: 14 }} className="panel">
          <h2>Playbook report (MDX)</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            This section is rendered from an MDX artifact generated by the analytics playbook.
          </p>
          <div className="mdx" style={{ marginTop: 12 }}>
            <MDXProvider components={Widgets as unknown as MDXComponents}>
              <Report />
            </MDXProvider>
          </div>
        </div>
      ) : null}
    </div>
  );
}
