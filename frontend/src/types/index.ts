export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'creative' | 'buyer';
  is_active: boolean;
  upload_limit_monthly: number;
  created_at: string;
}

export interface Editor {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  media_file_count?: number;
  ad_count?: number;
  total_spend?: number;
}

export interface MediaFile {
  id: string;
  user_id: string;
  editor_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  s3_key: string;
  s3_bucket: string;
  media_type: 'image' | 'video' | 'other';
  dimensions?: { width: number; height: number };
  duration?: number;
  thumbnail_s3_key?: string;
  tags: string[];
  description?: string;
  download_url?: string;
  thumbnail_url?: string;
  created_at: string;
  uploader_name?: string;
  editor_name?: string;
}

export interface EditorPerformance {
  editor_id: string;
  editor_name: string;
  ad_count: number;
  total_spend: number;
  avg_cpm: number;
  avg_cpc: number;
  avg_cost_per_result: number;
  total_impressions: number;
  total_clicks: number;
}

export interface AdNameChange {
  id: string;
  fb_ad_id: string;
  old_ad_name: string;
  new_ad_name: string;
  old_editor_name?: string;
  new_editor_name?: string;
  editor_changed: boolean;
  detected_at: string;
  current_ad_name?: string;
  campaign_name?: string;
}

export interface StorageStats {
  total_files: number;
  total_size_bytes: number;
  image_count: number;
  video_count: number;
  other_count: number;
}
