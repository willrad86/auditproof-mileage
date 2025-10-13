import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
  }
} else {
  console.log('Supabase not configured - running in offline-only mode');
}

export const supabase = supabaseInstance;

export function isSupabaseAvailable(): boolean {
  return supabaseInstance !== null;
}
