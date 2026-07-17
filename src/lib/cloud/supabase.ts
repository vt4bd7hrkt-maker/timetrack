/**
 * Supabase client. If the environment variables are missing, `supabase`
 * is null and the app behaves exactly like the original local-only PWA —
 * no accounts, no sync, no errors.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured: boolean = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true, // stay logged in between visits
        autoRefreshToken: true,
        detectSessionInUrl: true // handles confirmation & recovery links
      }
    })
  : null;

/** Social providers become visible in the UI only when configured. */
export const oauthProviders = {
  google: import.meta.env.VITE_AUTH_GOOGLE === 'true',
  apple: import.meta.env.VITE_AUTH_APPLE === 'true'
};

/** The app's own URL — where confirmation/recovery emails link back to. */
export const appUrl = (): string =>
  typeof window === 'undefined' ? '' : new URL('.', window.location.href).href;
