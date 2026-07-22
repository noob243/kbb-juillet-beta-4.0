import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials are missing. Please check your .env file.');
}

// Main client for authenticated users
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Secondary client for admin operations (like creating users)
// with persistSession: false to avoid switching the current session
export const secondarySupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
