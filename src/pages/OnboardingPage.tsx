import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getVideoContent, listVideos } from '../content/content';
import type { Platform } from '../content/types';
import { unlockVideo } from '../lib/freemium';
import {
  hydrateLocalLibraryVideoMetadata,
  upsertLocalLibraryVideo,
} from '../lib/localLibrary';
import { extractYouTubeVideoId } from '../lib/youtube';
import { VideoCard } from '../components/VideoCard';
import { Button } from '../components/ui/Button';

export function OnboardingPage(): JSX.Element {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const videos = useMemo(() => listVideos().filter((v) => v.platform === 'youtube'), []);

  function goToVideoByInput(): void {
    setError(null);
    const videoId = extractYouTubeVideoId(input);
    if (!videoId) {
      setError('Paste a YouTube link or an 11-character video id.');
      return;
    }

    const platform: Platform = 'youtube';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    upsertLocalLibraryVideo({ platform, videoId, videoUrl });
    void hydrateLocalLibraryVideoMetadata(platform, videoId);

    const content = getVideoContent(platform, videoId);
    if (content?.analytics) {
      navigate(`/video/${platform}/${videoId}`);
      return;
    }

    navigate(`/jobs?video=${platform}:${videoId}`);
  }

  return (
    <div>
      <div className="hero">
        <h1>Comment analytics that protects your energy.</h1>
        <p>
          Pick a video, pull the comments, and generate a creator-friendly report: what
          resonated, what to clarify next time, and what to ignore.
        </p>
      </div>

      <div style={{ marginTop: 18 }} className="panel">
        <h2>Connect a platform</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          This MVP is wired for YouTube (no API key required for ingestion).
          TikTok/Instagram are treated as fast follows via the connector interfaces.
        </p>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span className="pill">YouTube (enabled)</span>
          <span className="pill">TikTok (stub)</span>
          <span className="pill">Instagram (stub)</span>
        </div>
      </div>

      <div style={{ marginTop: 18 }} className="panel">
        <h2>Analyze a YouTube video</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Paste a link to add it to your library and start capture + analysis.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
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
          <Button variant="primary" onClick={goToVideoByInput}>
            Analyze
          </Button>
          <Button variant="ghost" onClick={() => navigate('/jobs')}>
            Jobs dashboard
          </Button>
        </div>
        {error ? (
          <div style={{ marginTop: 10 }} className="callout">
            <strong>Heads up:</strong> <span className="muted">{error}</span>
          </div>
        ) : null}
      </div>

      <div className="cards">
        {videos.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            ctaLabel="View analytics"
            onCtaClick={(event) => {
              setError(null);
              const unlocked = unlockVideo(`${video.platform}:${video.videoId}`);
              if (!unlocked.ok) {
                event.preventDefault();
                setError(unlocked.reason);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
