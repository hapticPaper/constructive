import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { parsePlatform } from '../content/platform';
import { getVideoContent } from '../content/content';
import { getCuratedVideos, ONBOARDING_SAMPLE_VIDEOS } from '../content/collections';
import type { Platform } from '../content/types';
import {
  hydrateLocalLibraryVideoMetadata,
  upsertLocalLibraryVideo,
} from '../lib/localLibrary';
import { parseVideoInput } from '../lib/videoInput';
import { VideoCard } from '../components/VideoCard';
import { Button } from '../components/ui/Button';

export function OnboardingPage(): JSX.Element {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sampleVideos = useMemo(() => getCuratedVideos(ONBOARDING_SAMPLE_VIDEOS), []);

  function goToVideoByInput(): void {
    setError(null);
    const parsed = parseVideoInput(platform, input);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    upsertLocalLibraryVideo({
      platform,
      videoId: parsed.videoId,
      videoUrl: parsed.videoUrl,
    });
    void hydrateLocalLibraryVideoMetadata(platform, parsed.videoId);

    const content = getVideoContent(platform, parsed.videoId);
    if (content?.analytics) {
      navigate(`/video/${platform}/${parsed.videoId}`);
      return;
    }

    navigate(`/jobs?video=${platform}:${parsed.videoId}`);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Comment analytics that protects your energy.</h1>
        <p>
          Pick a video, pull the comments, and generate a creator-friendly report: what
          resonated, what to clarify next time, and what to ignore.
        </p>
      </div>

      <div className="section">
        <div className="panel">
          <h2>Analyze a video</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Paste a link to add it to your library and start capture + analysis.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={platform}
              onChange={(e) => {
                const next = parsePlatform(e.target.value);
                if (next) setPlatform(next);
              }}
              className="input"
            >
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                platform === 'youtube'
                  ? 'https://www.youtube.com/watch?v=...'
                  : platform === 'tiktok'
                    ? 'https://www.tiktok.com/@user/video/...'
                    : 'https://www.instagram.com/reel/...'
              }
              className="input input-fluid"
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
      </div>

      <div className="section">
        <div className="panel">
          <h2>Platform Support</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            All platforms share the same report + analytics format. YouTube has a built-in
            connector; TikTok and Instagram are supported via JSON import.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="pill">YouTube (connector)</span>
            <span className="pill">TikTok (import)</span>
            <span className="pill">Instagram (import)</span>
          </div>
        </div>
      </div>

      {sampleVideos.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2>Sample Videos</h2>
            <p>Explore pre-analyzed content to see what Constructive can do</p>
          </div>
          <div className="cards">
            {sampleVideos.map((video) => (
              <VideoCard
                key={`${video.platform}:${video.videoId}`}
                video={video}
                ctaLabel="View analytics"
              />
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="panel">
          <h2>Palette Media</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Browse a dedicated set of pre-analyzed Palette Media sample videos.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => navigate('/palette-media')}>
              Open Palette Media
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
