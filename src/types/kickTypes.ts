// src/types/kickTypes.ts

// Structure directly from Kick API response
export interface KickClip {
    livestream_id: string;
    id: string;
    title: string;
    video_url: string;
    thumbnail_url: string;
    created_at: string; // ISO 8601 timestamp string
    view_count: number;
    clip_url: string;
    likes_count?: number;
    privacy?: string;
    duration?: number;
    is_mature: boolean;
    creator?: {
      id: number;
      username: string;
      slug: string;
    };
    channel?: {
      id: number;
      username: string;
      slug: string;
      profile_picture: string;
    };
    category?: {
      id: string;
      name: string;
      slug: string;
      parent_category: string;
    };
    score?: number;
    is_boosted?: boolean;
  }
  
  // Structure of the overall API response containing clips and cursor
  export interface KickApiResponse {
    clips: KickClip[];
    nextCursor?: string | null;
  }
  
  // Our standardized structure for the final feed items (used by frontend/DB)
  export interface FeedItem {
    id: string;
    source: 'kick' | 'youtube';
    title: string;
    videoUrl: string;
    thumbnailUrl: string;
    author: string;
    timestamp: string; // Keep as ISO string
    sourceUrl: string;
    viewCount: number;
    // Optional fields we might add later:
    // likesCount?: number;
    // duration?: number;
    // categoryName?: string;
    score?: number; // Store the calculated score
  }
  
  // Type for the raw Kick clip augmented with our score
  export type ScoredKickClip = KickClip & { score: number };
