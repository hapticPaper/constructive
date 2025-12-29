import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import type { VideoMetadata } from '../content/types';

export function VideoCard({
  video,
  ctaLabel = 'View analytics',
  onCtaClick,
}: {
  video: VideoMetadata;
  ctaLabel?: string;
  onCtaClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}): JSX.Element {
  return (
    <div className="panel card">
      {video.thumbnailUrl ? (
        <img className="thumb" src={video.thumbnailUrl} alt={video.title} loading="lazy" />
      ) : null}
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 650 }}>{video.title}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {video.channel.channelTitle}
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            to={`/video/${video.platform}/${video.videoId}`}
            className="btn btn-primary"
            onClick={onCtaClick}
            style={{ textDecoration: 'none' }}
          >
            {ctaLabel}
          </Link>
          <a className="muted" href={video.videoUrl} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
        </div>
      </div>
    </div>
  );
}
