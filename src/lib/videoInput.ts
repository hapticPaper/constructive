import type { Platform } from '../content/types';

import { buildInstagramUrl, extractInstagramShortcode } from './instagram';
import { extractTikTokVideoId } from './tiktok';
import { extractYouTubeVideoId } from './youtube';

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function parseVideoInput(
  platform: Platform,
  input: string,
): { ok: true; videoId: string; videoUrl: string } | { ok: false; error: string } {
  if (platform === 'youtube') {
    const videoId = extractYouTubeVideoId(input);
    if (!videoId) {
      return { ok: false, error: 'Paste a YouTube link or an 11-character video id.' };
    }
    return {
      ok: true,
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (platform === 'instagram') {
    const shortcode = extractInstagramShortcode(input);
    if (!shortcode) {
      return {
        ok: false,
        error: 'Paste an Instagram post/reel link or a shortcode.',
      };
    }

    const normalized = normalizeUrl(input);
    const videoUrl = normalized?.includes('instagram.com')
      ? normalized
      : buildInstagramUrl(shortcode);
    return { ok: true, videoId: shortcode, videoUrl };
  }

  const normalized = normalizeUrl(input);
  if (!normalized) {
    return { ok: false, error: 'Paste a TikTok video link (not just a video id).' };
  }

  const videoId = extractTikTokVideoId(normalized);
  if (!videoId) {
    return {
      ok: false,
      error: 'Paste a TikTok video link that includes /video/<id>.',
    };
  }

  return { ok: true, videoId, videoUrl: normalized };
}
