import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://rueplmeeutnnajbtejgl.supabase.co/rest/v1/';
export const SUPABASE_ANON_KEY = 'sb_publishable_VvgdIx4Cqc01bNh0WgAIfQ_PTBwk0oT';

// Normalize the URL for @supabase/supabase-js which expects the project origin without /rest/v1/
const originUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(originUrl, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
