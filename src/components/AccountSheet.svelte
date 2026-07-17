<script lang="ts">
  /** Sign in / sign up / forgot password / set-new-password, one sheet. */
  import BottomSheet from './BottomSheet.svelte';
  import { auth, signIn, signUp, resetPassword, updatePassword, signInWithProvider } from '../lib/cloud/auth.svelte';
  import { oauthProviders } from '../lib/cloud/supabase';
  import { t } from '../lib/i18n.svelte.js';

  let {
    open = false,
    onclose,
    initialMode = 'signin'
  }: { open?: boolean; onclose?: () => void; initialMode?: 'signin' | 'signup' } = $props();

  let mode = $state<'signin' | 'signup' | 'forgot'>('signin');

  // the welcome screen opens this sheet directly in sign-up mode
  $effect(() => {
    if (open) mode = initialMode;
  });
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let msg = $state('');
  let msgOk = $state(false);

  // arriving via a recovery e-mail link forces the new-password form
  const recovery = $derived(auth.recovery);

  function reset(m: 'signin' | 'signup' | 'forgot') {
    mode = m;
    msg = '';
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    msg = '';
    try {
      if (recovery) {
        await updatePassword(password);
        msgOk = true;
        msg = t('pwUpdated');
        password = '';
      } else if (mode === 'signin') {
        await signIn(email.trim(), password);
        onclose?.();
      } else if (mode === 'signup') {
        const { needsConfirm } = await signUp(email.trim(), password);
        if (needsConfirm) {
          msgOk = true;
          msg = t('confirmEmailSent');
        } else {
          onclose?.();
        }
      } else {
        await resetPassword(email.trim());
        msgOk = true;
        msg = t('resetEmailSent');
      }
    } catch (err: any) {
      msgOk = false;
      msg = err?.message ?? String(err);
    }
    busy = false;
  }
</script>

<BottomSheet open={open || recovery} title={recovery ? t('setNewPassword') : t(mode === 'signin' ? 'signIn' : mode === 'signup' ? 'createAccount' : 'forgotPassword')} onclose={() => { if (!recovery) onclose?.(); }}>
  <form onsubmit={submit}>
    {#if !recovery}
      <div class="field">
        <label for="ac-email">{t('email')}</label>
        <input id="ac-email" type="email" bind:value={email} required autocomplete="email" inputmode="email" autocapitalize="off" />
      </div>
    {/if}

    {#if recovery || mode !== 'forgot'}
      <div class="field">
        <label for="ac-pw">{recovery ? t('newPassword') : t('password')}</label>
        <input
          id="ac-pw" type="password" bind:value={password} required minlength="8"
          autocomplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'}
        />
      </div>
    {/if}

    {#if msg}<p class="msg" class:ok={msgOk}>{msg}</p>{/if}

    <button type="submit" class="btn btn-accent wide" disabled={busy}>
      {recovery ? t('save') : t(mode === 'signin' ? 'signIn' : mode === 'signup' ? 'createAccount' : 'sendResetLink')}
    </button>

    {#if !recovery && (oauthProviders.google || oauthProviders.apple)}
      <div class="social">
        {#if oauthProviders.google}
          <button type="button" class="btn btn-ghost wide" onclick={() => signInWithProvider('google')}>
            {t('continueWithGoogle')}
          </button>
        {/if}
        {#if oauthProviders.apple}
          <button type="button" class="btn btn-ghost wide" onclick={() => signInWithProvider('apple')}>
            {t('continueWithApple')}
          </button>
        {/if}
      </div>
    {/if}

    {#if !recovery}
      <div class="links">
        {#if mode !== 'signin'}
          <button type="button" onclick={() => reset('signin')}>{t('haveAccount')}</button>
        {/if}
        {#if mode !== 'signup'}
          <button type="button" onclick={() => reset('signup')}>{t('noAccount')}</button>
        {/if}
        {#if mode === 'signin'}
          <button type="button" onclick={() => reset('forgot')}>{t('forgotPassword')}?</button>
        {/if}
      </div>
    {/if}
  </form>
</BottomSheet>

<style>
  .wide { width: 100%; margin-top: 4px; }
  .social { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .msg { color: var(--danger); font-size: 14px; margin: 0 0 10px; }
  .msg.ok { color: var(--text-2); }
  .links {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
    align-items: flex-start;
  }
  .links button { color: var(--text-2); font-size: 14px; font-weight: 600; padding: 2px 0; }
</style>
