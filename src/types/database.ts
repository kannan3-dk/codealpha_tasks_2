export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface Post {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
  comments?: { count: number }[];
  comments_count?: number;
  likes?: { count: number }[];
  likes_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
}

export interface Like {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}
