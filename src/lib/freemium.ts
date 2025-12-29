import { deleteCookie, getCookie, setCookie } from './cookies';

const COOKIE_ANALYSIS = 'constructive_analysis_runs';
const COOKIE_GOOGLE_ID_TOKEN = 'constructive_google_id_token';
const COOKIE_VIEWED_VIDEOS = 'constructive_viewed_videos';

const MAX_VIEWED_VIDEOS = 200;
const MAX_ANALYSIS_USAGE_ENTRIES = 200;

// Sliding 24-hour window (not calendar days).
const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

type Tier =
  | { kind: 'anonymous'; label: 'Freemium'; maxPer24Hours: 3 }
  | { kind: 'google'; label: 'Registered'; maxPer24Hours: 7 };

type Usage = {
  used: number;
  windowStartMs: number;
};

type ViewedVideos = Record<string, number>;

function nowMs(): number {
  return Date.now();
}

function parseUsageCookie(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Structural validation plus basic numeric sanity (finite numbers only);
    // windowing happens in `loadUsage`.
    // Non-finite values (NaN/Infinity) are dropped to harden against malformed cookies.
    return parsed.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  } catch {
    return [];
  }
}

function loadUsage(now: number): { cutoff: number; timestamps: number[] } {
  const cutoff = now - USAGE_WINDOW_MS;
  // Discard timestamps outside the current window (including future values)
  // to harden against malformed or tampered cookies.
  const timestamps = parseUsageCookie(getCookie(COOKIE_ANALYSIS)).filter(
    (t) => t >= cutoff && t <= now,
  );

  return { cutoff, timestamps };
}

function parseViewedVideosCookie(raw: string | null): ViewedVideos {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const out: ViewedVideos = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'number') continue;
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function pruneViewedVideos(entries: ViewedVideos, cutoff: number): ViewedVideos {
  const kept: Array<[string, number]> = [];
  for (const [key, value] of Object.entries(entries)) {
    if (value >= cutoff) kept.push([key, value]);
  }

  kept.sort((a, b) => a[1] - b[1]);
  return Object.fromEntries(kept.slice(-MAX_VIEWED_VIDEOS)) as ViewedVideos;
}

function viewedVideosEqual(a: ViewedVideos, b: ViewedVideos): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i];
    if (key !== bKeys[i]) return false;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function persistUsage(timestamps: number[]): void {
  setCookie({
    name: COOKIE_ANALYSIS,
    value: JSON.stringify(timestamps.slice(-MAX_ANALYSIS_USAGE_ENTRIES)),
    maxAgeSeconds: 60 * 60 * 24 * 30,
  });
}

function persistViewedVideos(entries: ViewedVideos): void {
  const cutoff = nowMs() - USAGE_WINDOW_MS;
  const pruned = pruneViewedVideos(entries, cutoff);
  setCookie({
    name: COOKIE_VIEWED_VIDEOS,
    value: JSON.stringify(pruned),
    maxAgeSeconds: 60 * 60 * 24 * 30,
  });
}

export function getUserTier(): Tier {
  return getCookie(COOKIE_GOOGLE_ID_TOKEN) ? registeredTier() : freemiumTier();
}

export function getAnalysisUsage(): Usage {
  const tier = getUserTier();
  const now = nowMs();
  const { cutoff, timestamps } = loadUsage(now);
  persistUsage(timestamps);

  return {
    // `used` is capped for UX consistency; enforcement also happens in `canRunAnalysis()`.
    used: Math.min(timestamps.length, tier.maxPer24Hours),
    windowStartMs: cutoff,
  };
}

export function canRunAnalysis(): { ok: true } | { ok: false; reason: string } {
  const tier = getUserTier();
  const usage = getAnalysisUsage();
  if (usage.used < tier.maxPer24Hours) return { ok: true };
  return {
    ok: false,
    reason:
      tier.kind === 'anonymous'
        ? 'Freemium limit reached (3 videos / 24h).'
        : 'Daily limit reached (7 videos / 24h).',
  };
}

export function consumeAnalysisRun(): void {
  // Callers should check `canRunAnalysis()` first; this records usage and does not enforce limits.
  const now = nowMs();
  const { timestamps } = loadUsage(now);
  timestamps.push(now);
  persistUsage(timestamps);
}

/**
* Returns whether video analytics can be viewed.
*
* A video can be re-viewed within 24h if it has already been charged.
*/
export function canViewVideoAnalytics(videoKey: string): { ok: true } | { ok: false; reason: string } {
  const now = nowMs();
  const cutoff = now - USAGE_WINDOW_MS;
  const viewed = parseViewedVideosCookie(getCookie(COOKIE_VIEWED_VIDEOS));
  const pruned = pruneViewedVideos(viewed, cutoff);

  if (typeof pruned[videoKey] === 'number') return { ok: true };
  return canRunAnalysis();
}

/**
* Records a video analytics view.
*
* This is idempotent per video within 24h; first-time views consume an analysis run.
*/
export function consumeVideoAnalyticsView(videoKey: string): void {
  const now = nowMs();
  const cutoff = now - USAGE_WINDOW_MS;
  const viewed = parseViewedVideosCookie(getCookie(COOKIE_VIEWED_VIDEOS));
  const pruned = pruneViewedVideos(viewed, cutoff);

  const hadEntry = typeof pruned[videoKey] === 'number';
  if (!hadEntry) {
    const gate = canRunAnalysis();
    if (!gate.ok) {
      if (!viewedVideosEqual(viewed, pruned)) persistViewedVideos(pruned);
      return;
    }

    consumeAnalysisRun();
    pruned[videoKey] = now;
  }

  if (!viewedVideosEqual(viewed, pruned)) persistViewedVideos(pruned);
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

export function signOut(): void {
  deleteCookie(COOKIE_GOOGLE_ID_TOKEN);
  window.location.reload();
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: 'popup' | 'redirect';
          }): void;
          prompt(): void;
        };
      };
    };
  }
}

function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script.')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Google script.')));
    document.head.append(script);
  });
}

export async function signInWithGoogle(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) return;

  await loadGoogleIdentityScript();
  if (!window.google?.accounts?.id) return;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      setCookie({
        name: COOKIE_GOOGLE_ID_TOKEN,
        value: response.credential,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      });

      window.location.reload();
    },
    ux_mode: 'popup',
  });

  window.google.accounts.id.prompt();
}

function freemiumTier(): Tier {
  return { kind: 'anonymous', label: 'Freemium', maxPer24Hours: 3 };
}

function registeredTier(): Tier {
  return { kind: 'google', label: 'Registered', maxPer24Hours: 7 };
}
