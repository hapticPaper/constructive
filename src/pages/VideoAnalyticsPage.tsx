import { MDXProvider } from '@mdx-js/react';
import type { MDXComponents } from 'mdx/types';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { getVideoContent, getVideoReportComponent } from '../content/content';
import type { Platform } from '../content/types';
import { canRunAnalysis, isVideoUnlocked, unlockVideo } from '../lib/freemium';
import { Button } from '../components/ui/Button';
import * as Widgets from '../widgets';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#8cffcb',
  neutral: 'rgba(255,255,255,0.40)',
  negative: '#ff6376',
};

export function VideoAnalyticsPage(): JSX.Element {
  const params = useParams();
  const platform = (params.platform as Platform | undefined) ?? 'youtube';
  const videoId = params.videoId ?? '';
  const key = `${platform}:${videoId}`;

  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(() => isVideoUnlocked(key));

  const content = useMemo(() => getVideoContent(platform, videoId), [platform, videoId]);
  const Report = useMemo(
    () => getVideoReportComponent(platform, videoId),
    [platform, videoId],
  );

  useEffect(() => {
    setUnlockError(null);
    setUnlocking(false);
    setUnlocked(isVideoUnlocked(key));
  }, [key]);

  if (!content) {
    return (
      <div className="panel">
        <h2>Not ready yet</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          This video isn’t in this build yet. If you added it via the UI, check the Jobs
          dashboard for capture + analysis status.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link to="/jobs" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Open Jobs
          </Link>
        </div>
      </div>
    );
  }

  if (!content.analytics) {
    const commentCount = content.comments?.length;

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

        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Analysis pending</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            {typeof commentCount === 'number'
              ? `${commentCount.toLocaleString()} comments captured. Analytics + report will show up after the next playbook run.`
              : 'This video has been requested but comments aren’t captured yet.'}
          </p>
          <div style={{ marginTop: 12 }}>
            <Link
              to="/jobs"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              Open Jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const analytics = content.analytics;

  if (!unlocked) {
    const gate = canRunAnalysis();

    return (
      <div>
        <div className="hero">
          <h1>{gate.ok ? 'Unlock this report' : 'Daily limit reached'}</h1>
          <p>
            {gate.ok
              ? 'Unlocking uses 1 run from your daily quota. Re-opening this same video won’t consume again.'
              : gate.reason}
          </p>
        </div>
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Access</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Unlocks are stored in your browser for this device.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              disabled={!gate.ok || unlocking}
              onClick={() => {
                if (unlocking) return;
                setUnlocking(true);
                setUnlockError(null);
                const unlockedNow = unlockVideo(key);
                if (!unlockedNow.ok) {
                  setUnlockError(unlockedNow.reason);
                  setUnlocking(false);
                  return;
                }
                setUnlocked(true);
                setUnlocking(false);
              }}
            >
              Unlock report
            </Button>
          </div>
          {unlockError ? (
            <div style={{ marginTop: 10 }} className="callout">
              <strong>Heads up:</strong> <span className="muted">{unlockError}</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const sentimentData = Object.entries(analytics.sentimentBreakdown).map(
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
          <div className="value">{analytics.commentCount.toLocaleString()}</div>
          <div className="label">Comments captured</div>
        </section>
        <section className="panel kpi">
          <div className="value">{analytics.questionCount.toLocaleString()}</div>
          <div className="label">Questions</div>
        </section>
        <section className="panel kpi">
          <div className="value">{analytics.suggestionCount.toLocaleString()}</div>
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
            This is a fast heuristic pass (lexicon + tone filter), not a fully-trained
            sentiment model.
          </p>
        </section>
      </div>

      {Report ? (
        <div style={{ marginTop: 14 }} className="panel">
          <h2>Summary report (playbook)</h2>
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
