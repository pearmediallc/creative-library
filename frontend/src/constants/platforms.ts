// Platforms
export const PLATFORMS = [
  'Google',
  'Facebook',
  'Tiktok',
  'Newsbreak',
  'Bigo',
  'Snapchat'
] as const;

export type Platform = typeof PLATFORMS[number];
