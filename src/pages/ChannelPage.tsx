import { MDXProvider } from '@mdx-js/react';
import type { MDXComponents } from 'mdx/types';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getVideoContent, listVideos } from '../content/content';
import type { Platform, VideoMetadata } from '../content/types';
import { Hero, type BreadcrumbItem } from '../components/Hero';
import { HeroActionLink } from '../components/HeroActionLink';
import { Button } from '../components/ui/Button';
import * as Widgets from '../widgets';

type ChannelAggregateModule = {
  default: React.ComponentType;
  channelAggregate?: unknown;
};

export function ChannelPage(): JSX.Element {
  const params = useParams();
  const platform = (params.platform as Platform | undefined) ?? 'youtube';
  const channelId = params.channelId ?? '';

  const [aggregateModule, setAggregateModule] = useState<ChannelAggregateModule | null>(
    null,
  );
  const [aggregateLoading, setAggregateLoading] = useState(true);

  // Load channel aggregate dynamically
  useEffect(() => {
    setAggregateLoading(true);

    // Dynamically import the channel aggregate MDX
    import(
      `../../content/platforms/${platform}/channels/${channelId}/channel-aggregate.mdx`
    )
      .then((module) => {
        setAggregateModule(module as ChannelAggregateModule);
        setAggregateLoading(false);
      })
      .catch(() => {
        setAggregateModule(null);
        setAggregateLoading(false);
      });
  }, [platform, channelId]);

  // Get all videos for this channel
  const channelVideos = useMemo(() => {
    const allVideos = listVideos();
    return allVideos.filter(
      (video) => video.channel.channelId === channelId && video.platform === platform,
    );
  }, [platform, channelId]);

  // Group videos by analysis status
  const groupedVideos = useMemo(() => {
    const analyzed: VideoMetadata[] = [];
    const pending: VideoMetadata[] = [];
    const notStarted: VideoMetadata[] = [];

    for (const video of channelVideos) {
      const content = getVideoContent(video.platform, video.videoId);
      if (!content) {
        notStarted.push(video);
      } else if (content.analytics) {
        analyzed.push(video);
      } else {
        pending.push(video);
      }
    }

    return { analyzed, pending, notStarted };
  }, [channelVideos]);

  if (channelVideos.length === 0) {
    return (
      <div className="panel">
        <h2>Channel not found</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          No videos found for channel {channelId} on {platform}. Add videos via the
          ingestion workflow.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link
            to="/library"
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const channel = channelVideos[0].channel;
  const ChannelAggregateComponent = aggregateModule?.default;
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Library', to: '/library' },
    { label: channel.channelTitle },
  ];

  return (
    <div>
      <Hero
        breadcrumbs={breadcrumbs}
        heading={channel.channelTitle}
        description={`${channelVideos.length} video${channelVideos.length !== 1 ? 's' : ''}`}
        actions={
          <>
            {channel.channelUrl ? (
              <HeroActionLink href={channel.channelUrl}>Open on YouTube</HeroActionLink>
            ) : null}
            <HeroActionLink to="/library">Back to Library</HeroActionLink>
          </>
        }
      />

      {/* Channel Aggregate Section */}
      {aggregateLoading ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Channel insights</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Loading channel aggregate...
          </p>
        </div>
      ) : ChannelAggregateComponent ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Channel insights</h2>
          <div className="mdx" style={{ marginTop: 12 }}>
            <MDXProvider components={Widgets as unknown as MDXComponents}>
              <ChannelAggregateComponent />
            </MDXProvider>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Channel insights</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            No channel aggregate available yet. Run the channel analysis script to
            generate insights across all videos.
          </p>
          <div className="callout" style={{ marginTop: 10 }}>
            <strong>How to generate:</strong>
            <pre style={{ marginTop: 6, fontSize: 13 }}>
              bun run analyze:channel -- --channel {platform}:{channelId}
            </pre>
          </div>
        </div>
      )}

      {/* Video Control Panel */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 12 }}>Videos</h2>

        {/* Analyzed videos */}
        {groupedVideos.analyzed.length > 0 && (
          <section style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>
              ✓ Analyzed ({groupedVideos.analyzed.length})
            </h3>
            <div className="cards">
              {groupedVideos.analyzed.map((video) => {
                const content = getVideoContent(video.platform, video.videoId);
                const commentCount = content?.analytics?.commentCount;

                return (
                  <div
                    key={video.videoId}
                    className="panel"
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    {video.thumbnailUrl && (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          aspectRatio: '16/9',
                          objectFit: 'cover',
                        }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 650, lineHeight: 1.3 }}>
                        {video.title}
                      </div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                        {typeof commentCount === 'number'
                          ? `${commentCount.toLocaleString()} comments`
                          : 'Analysis complete'}
                      </div>
                    </div>
                    <Link
                      to={`/video/${video.platform}/${video.videoId}`}
                      className="btn btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      View Report
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Pending videos */}
        {groupedVideos.pending.length > 0 && (
          <section style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>
              ⏳ Pending analysis ({groupedVideos.pending.length})
            </h3>
            <div className="cards">
              {groupedVideos.pending.map((video) => {
                const content = getVideoContent(video.platform, video.videoId);
                const commentCount = content?.comments?.length;

                return (
                  <div
                    key={video.videoId}
                    className="panel"
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    {video.thumbnailUrl && (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          aspectRatio: '16/9',
                          objectFit: 'cover',
                        }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 650, lineHeight: 1.3 }}>
                        {video.title}
                      </div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                        {typeof commentCount === 'number'
                          ? `${commentCount.toLocaleString()} comments captured`
                          : 'Comments not captured yet'}
                      </div>
                    </div>
                    <Button variant="ghost" disabled>
                      Analysis pending
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Not started videos */}
        {groupedVideos.notStarted.length > 0 && (
          <section>
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>
              Not yet ingested ({groupedVideos.notStarted.length})
            </h3>
            <div className="cards">
              {groupedVideos.notStarted.map((video) => (
                <div
                  key={video.videoId}
                  className="panel"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {video.thumbnailUrl && (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        aspectRatio: '16/9',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 650, lineHeight: 1.3 }}>{video.title}</div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      Not ingested yet
                    </div>
                  </div>
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ textDecoration: 'none' }}
                  >
                    Open on YouTube
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
