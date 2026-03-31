import type { Platform } from './types';

export const PLATFORMS: readonly Platform[] = ['youtube', 'instagram', 'tiktok'];

export function parsePlatform(raw: string): Platform | null {
  if (raw === 'youtube' || raw === 'instagram' || raw === 'tiktok') return raw;
  return null;
}

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
  }
}
