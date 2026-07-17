/**
 * Authentication state (Svelte 5 runes module).
 * All auth flows go through here; the sync engine reacts to auth.user.
 */
import { supabase, appUrl } from './supabase';
import type { Provider } from '@supabase/supabase-js';

export const auth = $state({
  ready: false, // initial session resolved
  user: null as { id: string; email: string | null } | null,
  /** true when the user arrived via a password-recovery email link */
  recovery: false
});

export function initAuth(): void {
  if (!supabase) {
    auth.ready = true;
    return;
  }
  supabase.auth.onAuthStateChange((event, session) => {
    auth.user = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
    if (event === 'PASSWORD_RECOVERY') auth.recovery = true;
    auth.ready = true;
  });
}

const err = (e: unknown): never => {
  throw e instanceof Error ? e : new Error(String(e));
};

export async function signUp(email: string, password: string): Promise<{ needsConfirm: boolean }> {
  if (!supabase) return err('cloud not configured');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl() }
  });
  if (error) return err(error);
  // When email confirmation is on, there's a user but no session yet.
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) return err('cloud not configured');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return err(error);
}

export async function signInWithProvider(provider: Provider): Promise<void> {
  if (!supabase) return err('cloud not configured');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: appUrl() }
  });
  if (error) return err(error);
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<void> {
  if (!supabase) return err('cloud not configured');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) return err(error);
}

/** Completes the recovery flow (user typed a new password). */
export async function updatePassword(password: string): Promise<void> {
  if (!supabase) return err('cloud not configured');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return err(error);
  auth.recovery = false;
}
