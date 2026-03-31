const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export function resolveAssetUrl(url: string): string {
  if (!url) return url;

  if (ABSOLUTE_URL_PATTERN.test(url)) {
    return url;
  }

  const base = import.meta.env.BASE_URL ?? '/';
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
  const path = url.startsWith('/') ? url.slice(1) : url;

  return `${baseWithSlash}${path}`;
}
