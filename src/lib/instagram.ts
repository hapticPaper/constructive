export function extractInstagramShortcode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Shortcode (e.g. C0dEAbC12_)
  if (/^[a-zA-Z0-9_-]{5,}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith('instagram.com')) return null;

    const parts = url.pathname.split('/').filter(Boolean);
    const marker = parts[0];
    const shortcode = parts[1];
    if (!shortcode) return null;

    if (marker === 'p' || marker === 'reel' || marker === 'tv') {
      return shortcode;
    }

    return null;
  } catch {
    return null;
  }
}

export function buildInstagramUrl(shortcode: string): string {
  return `https://www.instagram.com/p/${shortcode}/`;
}
