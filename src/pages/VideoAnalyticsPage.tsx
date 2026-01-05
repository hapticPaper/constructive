import { MDXProvider } from '@mdx-js/react';
import type { MDXComponents } from 'mdx/types';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getVideoContent, getVideoReportComponent } from '../content/content';
import { getValidRadarFromAnalytics } from '../content/radar';
import type { Platform } from '../content/types';
import { Hero, type BreadcrumbItem } from '../components/Hero';
import { HeroActionLink } from '../components/HeroActionLink';
import { canRunAnalysis, isVideoUnlocked, unlockVideo } from '../lib/freemium';
import { Button } from '../components/ui/Button';
import { RadarGraph } from '../components/ui/RadarGraph';
import * as Widgets from '../widgets';

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

  const channelHref = `/channel/${content.video.channel.platform}/${content.video.channel.channelId}`;
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Library', to: '/library' },
    { label: content.video.channel.channelTitle, to: channelHref },
    { label: content.video.title },
  ];

  const headerActions = (
    <>
      <HeroActionLink href={content.video.videoUrl}>Open on YouTube</HeroActionLink>
      <HeroActionLink to={channelHref}>View channel</HeroActionLink>
      <HeroActionLink to="/library">Back to Library</HeroActionLink>
    </>
  );

  const videoMetaDescription = content.video.channel.channelTitle;

  if (!content.analytics) {
    const commentCount = content.comments?.length;

    return (
      <div>
        <Hero
          breadcrumbs={breadcrumbs}
          heading={content.video.title}
          description={videoMetaDescription}
          actions={headerActions}
        />

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
  const radar = getValidRadarFromAnalytics(analytics);

  if (!unlocked) {
    const gate = canRunAnalysis();

    return (
      <div>
        <Hero
          breadcrumbs={breadcrumbs}
          heading={gate.ok ? 'Unlock this report' : 'Daily limit reached'}
          description={
            gate.ok
              ? 'Unlocking uses 1 run from your daily quota. Re-opening this same video won’t consume again.'
              : gate.reason
          }
          actions={headerActions}
        />
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

  return (
    <div>
      <Hero
        breadcrumbs={breadcrumbs}
        heading={content.video.title}
        description={videoMetaDescription}
        actions={headerActions}
      />

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

      <div style={{ marginTop: 14 }} className="panel">
        <h2>Radar breakdown</h2>
        <p className="muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
          Each axis is the share of analyzed comments that match a standardized category.
          Categories can overlap, and “People” counts comments that mention at least one
          likely person name.
        </p>
        <div style={{ marginTop: 12 }}>
          {radar ? (
            <RadarGraph
              radar={radar}
              totalComments={analytics.commentCount}
              footer={
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                  Hover a category to see the underlying count.
                </div>
              }
            />
          ) : (
            <div className="callout">
              <strong>Radar data missing:</strong>{' '}
              <span className="muted">re-run the analysis playbook to regenerate.</span>
            </div>
          )}
        </div>
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
