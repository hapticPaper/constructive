import { unlockVideo } from './freemium';

export function unlockVideoIfPossible(videoKey: string): void {
  // This is best-effort: if the unlock fails (e.g. quota reached), the analytics page
  // will still render a gated state.
  unlockVideo(videoKey);
}
