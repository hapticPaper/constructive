function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function extractTikTokVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{10,}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith('tiktok.com')) return null;

    const match = url.pathname.match(/\/video\/(\d{10,})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function fetchTikTokOEmbed(
  videoUrl: string,
  signal?: AbortSignal,
): Promise<{ title: string; channelTitle: string; thumbnailUrl?: string } | null> {
  try {
    const url = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const parsed = (await res.json()) as unknown;
    const raw = asRecord(parsed) ?? {};

    const title = typeof raw.title === 'string' ? raw.title : '';
    const channelTitle = typeof raw.author_name === 'string' ? raw.author_name : '';
    const thumbnailUrl =
      typeof raw.thumbnail_url === 'string' ? raw.thumbnail_url : undefined;

    if (!title || !channelTitle) return null;
    return { title, channelTitle, thumbnailUrl };
  } catch {
    return null;
  }
}
