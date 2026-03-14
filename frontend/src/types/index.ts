export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'team_lead' | 'assistant_team_lead' | 'creative' | 'buyer' | 'editor' | 'ceo' | 'head_media_buying' | 'creative_head';
  is_active: boolean;
  upload_limit_monthly: number;
  view_all_requests?: boolean;
  additional_roles?: string[];
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
  uploaded_by: string;
  editor_id: string;
  editor_name: string;
  filename: string;
  original_filename: string;
  file_type: 'image' | 'video' | 'other';
  mime_type: string;
  file_size: number;
  s3_key: string;
  s3_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  tags: string[];
  description?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
  folder_id?: string;
  is_starred?: boolean;
  analytics_metrics?: {
    creative_performance: {
      hook_rate: number | null;
      hold_rate: number | null;
      avg_video_duration: number | null;
      ctr: number | null;
      ff_retention: number | null;
      video_plays_25: number | null;
      video_plays_50: number | null;
      video_plays_75: number | null;
      video_plays_100: number | null;
    };
    profitability: {
      spend: number | null;
      profit: number | null;
      revenue: number | null;
      roi: number | null;
    };
  };
  created_at: string;
  updated_at: string;
  upload_date?: string;
  // Joined fields from query
  uploader_name?: string;
  uploader_email?: string;
  editor_display_name?: string;
  // Generated URLs for display
  download_url?: string;
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
