import type { MouseEvent } from 'react';

import { unlockVideo } from './freemium';

export function gateVideoCardCtaClick({
  videoKey,
  event,
  setError,
}: {
  videoKey: string;
  event: MouseEvent<HTMLAnchorElement>;
  setError: (error: string | null) => void;
}): void {
  setError(null);
  const unlocked = unlockVideo(videoKey);
  if (unlocked.ok) return;

  event.preventDefault();
  setError(unlocked.reason);
}
