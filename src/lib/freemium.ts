import { deleteCookie, getCookie, setCookie } from './cookies';

const COOKIE_ANALYSIS = 'constructive_analysis_runs';
const COOKIE_GOOGLE_ID_TOKEN = 'constructive_google_id_token';
const COOKIE_UNLOCKED = 'constructive_unlocked_videos';

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
    return parsed.filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
    );
  } catch {
    return [];
  }
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
        if (!Number.isFinite(unlockedAtMs) || unlockedAtMs <= 0) return null;
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

function getRecentUnlockedEntries(): UnlockedEntry[] {
  const now = nowMs();
  const maxFutureSkewMs = 5 * 60 * 1000;
  const cutoff = now - 24 * 60 * 60 * 1000;
  const upperBound = now + maxFutureSkewMs;

  const entries = parseUnlockedCookie(getCookie(COOKIE_UNLOCKED)).filter(
    (e) => e.unlockedAtMs >= cutoff && e.unlockedAtMs <= upperBound,
  );
  persistUnlocked(entries);

  return entries;
}

export function getUserTier(): Tier {
  return getCookie(COOKIE_GOOGLE_ID_TOKEN) ? registeredTier() : freemiumTier();
}

export function getAnalysisUsage(): Usage {
  const tier = getUserTier();
  const now = nowMs();
  const maxFutureSkewMs = 5 * 60 * 1000;
  const cutoff = now - 24 * 60 * 60 * 1000;
  const upperBound = now + maxFutureSkewMs;
  const timestamps = parseUsageCookie(getCookie(COOKIE_ANALYSIS)).filter(
    (t) => t >= cutoff && t <= upperBound,
  );
  persistUsage(timestamps);

  return {
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
  const now = nowMs();
  const maxFutureSkewMs = 5 * 60 * 1000;
  const cutoff = now - 24 * 60 * 60 * 1000;
  const upperBound = now + maxFutureSkewMs;
  const timestamps = parseUsageCookie(getCookie(COOKIE_ANALYSIS)).filter(
    (t) => t >= cutoff && t <= upperBound,
  );
  timestamps.push(now);
  persistUsage(timestamps);
}

export function isVideoUnlocked(key: string): boolean {
  return getRecentUnlockedEntries().some((e) => e.key === key);
}

export function unlockVideo(key: string): { ok: true } | { ok: false; reason: string } {
  if (isVideoUnlocked(key)) return { ok: true };

  const gate = canRunAnalysis();
  if (!gate.ok) return gate;

  consumeAnalysisRun();

  const entries = getRecentUnlockedEntries();
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
