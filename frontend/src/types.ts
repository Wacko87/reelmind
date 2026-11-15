export interface AuthStatus {
  auth_required: boolean;
  is_authenticated: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string | null;
  icon: string;
  color: string;
  reel_count: number;
  total_reel_count: number;
  children: Folder[];
  created_at: string;
  updated_at: string;
}

export interface Reel {
  id: string;
  url: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook' | 'other';
  author?: string;
  author_url?: string;
  original_title?: string;
  thumbnail_url?: string;
  duration?: number;
  title: string;
  summary: string;
  ai_tools: string[];
  key_steps: string[];
  prompts: string[];
  tags: string[];
  difficulty: 'Principiante' | 'Intermedio' | 'Avanzado';
  estimated_time?: string;
  status: 'pending' | 'tested' | 'favorite';
  user_notes: string;
  folder_id?: string | null;
  folder_name?: string | null;
  media_type?: 'reel' | 'video' | 'image';
  images?: string[];
  is_duplicate?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptVariation {
  label: string;
  prompt: string;
  explanation?: string;
}

export interface PromptOptimizeResponse {
  original_prompt: string;
  mode: string;
  target_model?: string;
  variations: PromptVariation[];
}

export interface VaultCitation {
  reel_id: string;
  title: string;
  platform: string;
  tools: string[];
}

export interface VaultAskResponse {
  answer: string;
  citations: VaultCitation[];
}

export interface Stats {
  total: number;
  reels_count: number;
  videos_count: number;
  images_count: number;
  pending: number;
  tested: number;
  favorite: number;
  unassigned: number;
  top_tools: { name: string; count: number }[];
  top_tags: { name: string; count: number }[];
}

export interface AppSettings {
  has_gemini_key: boolean;
  masked_key: string;
  gemini_model: string;
  is_custom_configured: boolean;
}
