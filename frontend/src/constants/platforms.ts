// Platforms
export const PLATFORMS = [
  'Bigo',
  'Facebook',
  'Google',
  'Newsbreak',
  'Snapchat',
  'Tiktok',
] as const;

export type Platform = typeof PLATFORMS[number];
