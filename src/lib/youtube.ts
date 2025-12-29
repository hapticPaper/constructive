export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Plain video id.
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.endsWith('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts.at(-1);
      return last && /^[a-zA-Z0-9_-]{11}$/.test(last) ? last : null;
    }
  } catch {
    // ignore
  }

  return null;
}

type YouTubeOEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

export async function fetchYouTubeOEmbed(
  videoId: string,
  signal?: AbortSignal,
): Promise<{ title: string; channelTitle: string; thumbnailUrl?: string } | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown as YouTubeOEmbedResponse;

    const title = typeof raw.title === 'string' ? raw.title : '';
    const channelTitle = typeof raw.author_name === 'string' ? raw.author_name : '';
    const thumbnailUrl = typeof raw.thumbnail_url === 'string' ? raw.thumbnail_url : undefined;

    if (!title || !channelTitle) return null;
    return { title, channelTitle, thumbnailUrl };
  } catch {
    return null;
  }
}
