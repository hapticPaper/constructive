import { useMemo, useState } from 'react';

import { getVideoContent, listVideos } from '../content/content';
import type { VideoMetadata } from '../content/types';
import { VideoCard } from '../components/VideoCard';
import { unlockVideo } from '../lib/freemium';

function groupByChannel(videos: VideoMetadata[]): Map<string, VideoMetadata[]> {
  const map = new Map<string, VideoMetadata[]>();
  for (const video of videos) {
    const key = `${video.platform}:${video.channel.channelId}`;
    map.set(key, [...(map.get(key) ?? []), video]);
  }
  return map;
}

export function LibraryPage(): JSX.Element {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const videos = useMemo(() => {
    const all = listVideos();
    const q = query.trim().toLowerCase();
    if (!q) return all;

    return all.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.channel.channelTitle.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => groupByChannel(videos), [videos]);

  return (
    <div>
      <div className="hero">
        <h1>Pick content to analyze</h1>
        <p>
          The “backend” for this MVP is just structured files in git. Each video has its
          own metadata, comments snapshot, computed analytics, and a report in MDX.
        </p>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or channel"
          style={{
            flex: '1 1 340px',
            minWidth: 240,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
          }}
        />
      </div>
      {error ? (
        <div style={{ marginTop: 10 }} className="callout">
          <strong>Heads up:</strong> <span className="muted">{error}</span>
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {Array.from(grouped.values()).map((channelVideos) => {
          const channel = channelVideos[0]?.channel;
          if (!channel) return null;

          return (
            <section key={`${channel.platform}:${channel.channelId}`}>
              <div className="row" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 650 }}>{channel.channelTitle}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {channelVideos.length} videos
                  </div>
                </div>
              </div>
              <div className="cards">
                {channelVideos.map((video) => {
                  const content = getVideoContent(video.platform, video.videoId);
                  const commentCount =
                    content?.analytics?.commentCount ?? content?.comments?.length;

                  return (
                    <div
                      key={video.videoId}
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <VideoCard
                        video={video}
                        onCtaClick={(event) => {
                          setError(null);
                          const unlocked = unlockVideo(
                            `${video.platform}:${video.videoId}`,
                          );
                          if (!unlocked.ok) {
                            event.preventDefault();
                            setError(unlocked.reason);
                          }
                        }}
                      />
                      <div
                        className="muted"
                        style={{ padding: '8px 2px 0 2px', fontSize: 13 }}
                      >
                        {typeof commentCount === 'number'
                          ? `${commentCount.toLocaleString()} comments captured`
                          : 'Comments not captured yet'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
