import { deleteCookie, getCookie, setCookie } from './cookies';

const COOKIE_ANALYSIS = 'constructive_analysis_runs';
const COOKIE_GOOGLE_ID_TOKEN = 'constructive_google_id_token';
const COOKIE_UNLOCKED = 'constructive_unlocked_videos';

// Sliding 24-hour window (not calendar days).
const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

type Tier =
  | { kind: 'anonymous'; label: 'Freemium'; maxPer24Hours: 3 }
  | { kind: 'google'; label: 'Registered'; maxPer24Hours: 7 };

type Usage = {
  used: number;
  windowStartMs: number;
};

type UnlockedEntry = {
  key: string;
  unlockedAtMs: number;
};

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

function parseUnlockedCookie(raw: string | null): UnlockedEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const maybe = entry as Record<string, unknown>;
        const key = typeof maybe.key === 'string' ? maybe.key : null;
        const unlockedAtMs = typeof maybe.unlockedAtMs === 'number' ? maybe.unlockedAtMs : null;
        if (!key || unlockedAtMs === null) return null;
        return { key, unlockedAtMs };
      })
      .filter((v): v is UnlockedEntry => Boolean(v));
  } catch {
    return [];
  }
}

function persistUsage(timestamps: number[]): void {
  setCookie({
    name: COOKIE_ANALYSIS,
    value: JSON.stringify(timestamps.slice(-200)),
    maxAgeSeconds: 60 * 60 * 24 * 30,
  });
}

function persistUnlocked(entries: UnlockedEntry[]): void {
  setCookie({
    name: COOKIE_UNLOCKED,
    value: JSON.stringify(entries.slice(-200)),
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

export function isVideoUnlocked(key: string): boolean {
  const cutoff = nowMs() - 24 * 60 * 60 * 1000;
  const entries = parseUnlockedCookie(getCookie(COOKIE_UNLOCKED)).filter(
    (e) => e.unlockedAtMs >= cutoff,
  );
  persistUnlocked(entries);

  return entries.some((e) => e.key === key);
}

export function unlockVideo(key: string): { ok: true } | { ok: false; reason: string } {
  if (isVideoUnlocked(key)) return { ok: true };

  const gate = canRunAnalysis();
  if (!gate.ok) return gate;

  consumeAnalysisRun();

  const cutoff = nowMs() - 24 * 60 * 60 * 1000;
  const entries = parseUnlockedCookie(getCookie(COOKIE_UNLOCKED)).filter(
    (e) => e.unlockedAtMs >= cutoff,
  );
  entries.push({ key, unlockedAtMs: nowMs() });
  persistUnlocked(entries);

  return { ok: true };
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
