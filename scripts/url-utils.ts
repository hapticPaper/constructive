export function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

export function normalizeOriginPath(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

export function isHostOrSubdomain(url: URL, domain: string): boolean {
  const hostname = url.hostname.toLowerCase();
  const expected = domain.toLowerCase();
  return hostname === expected || hostname.endsWith(`.${expected}`);
}
