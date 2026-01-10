// File Request Types
// 13 predefined types for file requests

export const FILE_REQUEST_TYPES = [
  'UGC + B-Roll',
  'Stock Video',
  'Caption Change Only',
  'Hook Change Only',
  'Minor Modification',
  'Special Request',
  'Avatar Variation',
  'UGC',
  'Image',
  'Image + Voiceover',
  'map + ugc',
  'Script',
  'Broll'
] as const;

export type FileRequestType = typeof FILE_REQUEST_TYPES[number];
