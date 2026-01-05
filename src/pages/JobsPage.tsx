import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getVideoContent } from '../content/content';
import type { Platform } from '../content/types';
import {
  hydrateLocalLibraryVideoMetadata,
  listLocalLibraryVideos,
  removeLocalLibraryVideo,
  upsertLocalLibraryVideo,
} from '../lib/localLibrary';
import { extractYouTubeVideoId } from '../lib/youtube';
import { Button } from '../components/ui/Button';

type JobStage =
  | { kind: 'scraping'; label: string; detail: string }
  | { kind: 'analysis'; label: string; detail: string }
  | { kind: 'ready'; label: string; detail: string };

function getJobStage(platform: Platform, videoId: string): JobStage {
  const content = getVideoContent(platform, videoId);
  if (!content) {
    return {
      kind: 'scraping',
      label: 'Scraping',
      detail: 'Queued to capture comments.',
    };
  }

  if (content.analytics) {
    return {
      kind: 'ready',
      label: 'Analysis ready',
      detail: 'Open the report when you’re ready.',
    };
  }

  if (content.comments) {
    return {
      kind: 'analysis',
      label: 'Comments captured',
      detail: 'Analysis is pending the next playbook run.',
    };
  }

  return {
    kind: 'scraping',
    label: 'Scraping',
    detail: 'Capturing comments (this can take a bit).',
  };
}

const FOCUSED_JOB_STYLE = {
  borderColor: 'rgba(var(--brand-rgb), 0.35)',
  boxShadow: '0 0 0 4px rgba(var(--brand-rgb), 0.12)',
} as const;

export function JobsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const focused = searchParams.get('video');

  // oEmbed hydration is performed in a batched effect (cancellable + de-duplicated).
  const oembedInFlight = useRef(new Set<string>());

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [videos, setVideos] = useState(() => listLocalLibraryVideos());

  useEffect(() => {
    let active = true;

    // One controller per effect run. Cleanup aborts the whole batch on unmount/list changes.
    const controller = new AbortController();
    const missing = videos.filter(
      (v) => v.platform === 'youtube' && (!v.title || !v.channelTitle),
    );
    const batch = missing
      .filter((v) => !oembedInFlight.current.has(`${v.platform}:${v.videoId}`))
      .slice(0, 5);
    if (batch.length === 0) return () => controller.abort();

    for (const v of batch) {
      oembedInFlight.current.add(`${v.platform}:${v.videoId}`);
    }

    void Promise.all(
      batch.map((v) =>
        hydrateLocalLibraryVideoMetadata(
          v.platform,
          v.videoId,
          controller.signal,
        ).finally(() => {
          oembedInFlight.current.delete(`${v.platform}:${v.videoId}`);
        }),
      ),
    ).then((results) => {
      if (!active) return;
      if (results.some(Boolean)) setVideos(listLocalLibraryVideos());
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [videos]);

  function addByInput(): void {
    setError(null);
    const videoId = extractYouTubeVideoId(input);
    if (!videoId) {
      setError('Paste a YouTube link or an 11-character video id.');
      return;
    }

    const platform: Platform = 'youtube';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    upsertLocalLibraryVideo({ platform, videoId, videoUrl });
    setVideos(listLocalLibraryVideos());

    const key = `${platform}:${videoId}`;
    if (!oembedInFlight.current.has(key)) {
      oembedInFlight.current.add(key);
      void hydrateLocalLibraryVideoMetadata(platform, videoId)
        .then((updated) => {
          if (updated) setVideos(listLocalLibraryVideos());
        })
        .finally(() => {
          oembedInFlight.current.delete(key);
        });
    }

    setInput('');
    setSearchParams({ video: `${platform}:${videoId}` });
  }

  return (
    <div>
      <div className="hero">
        <h1>Jobs</h1>
        <p>
          This browser keeps a local library of the videos you’ve requested. Ingestion and
          analysis are idempotent (keyed by video id): comments get captured first, then
          playbook runs fill in analytics + MDX reports.
        </p>
      </div>

      <div style={{ marginTop: 18 }} className="panel">
        <h2>Add a YouTube video</h2>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input"
            style={{
              flex: '1 1 340px',
              minWidth: 240,
            }}
          />
          <Button variant="primary" onClick={addByInput}>
            Add
          </Button>
        </div>
        {error ? (
          <div style={{ marginTop: 10 }} className="callout">
            <strong>Heads up:</strong> <span className="muted">{error}</span>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {videos.length === 0 ? (
          <div className="panel">
            <h2>No jobs yet</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Add a YouTube URL above and it’ll show up here.
            </p>
          </div>
        ) : (
          videos.map((video) => {
            const stage = getJobStage(video.platform, video.videoId);
            const isFocused = focused === `${video.platform}:${video.videoId}`;
            const title = video.title ?? video.videoUrl;
            const channel = video.channelTitle ?? 'YouTube';

            return (
              <div
                key={`${video.platform}:${video.videoId}`}
                className="panel"
                style={isFocused ? FOCUSED_JOB_STYLE : undefined}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      style={{
                        width: 120,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                      }}
                    />
                  ) : null}
                  <div style={{ flex: '1 1 260px' }}>
                    <div style={{ fontWeight: 650 }}>{title}</div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      {channel} ·{' '}
                      <span style={{ color: 'var(--muted-2)' }}>
                        {video.videoId}
                      </span>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      <strong>{stage.label}:</strong> {stage.detail}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <a
                      className="muted"
                      href={video.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on YouTube
                    </a>
                    {stage.kind === 'ready' ? (
                      <Link
                        to={`/video/${video.platform}/${video.videoId}`}
                        className="btn btn-primary"
                        style={{ textDecoration: 'none' }}
                      >
                        Open report
                      </Link>
                    ) : null}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        removeLocalLibraryVideo(video.platform, video.videoId);
                        setVideos(listLocalLibraryVideos());
                        if (isFocused) setSearchParams({});
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
