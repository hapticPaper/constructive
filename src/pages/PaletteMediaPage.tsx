import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { VideoCard } from '../components/VideoCard';
import { Button } from '../components/ui/Button';
import { getCuratedVideos, PALETTE_MEDIA_VIDEOS } from '../content/collections';
import { gateVideoCardCtaClick } from '../lib/videoUnlock';

export function PaletteMediaPage(): JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const videos = useMemo(() => getCuratedVideos(PALETTE_MEDIA_VIDEOS), []);

  return (
    <div>
      <div className="page-header">
        <h1>Palette Media</h1>
        <p>A curated set of pre-analyzed videos to explore the reporting experience.</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Back to overview
          </Button>
          <Button variant="ghost" onClick={() => navigate('/library')}>
            Open library
          </Button>
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 16 }} className="callout">
          <strong>Heads up:</strong> <span className="muted">{error}</span>
        </div>
      ) : null}

      <div className="cards">
        {videos.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            ctaLabel="View analytics"
            onCtaClick={(event) => {
              gateVideoCardCtaClick({
                videoKey: `${video.platform}:${video.videoId}`,
                event,
                setError,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}
