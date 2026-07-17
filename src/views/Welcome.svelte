<script>
  /**
   * First-open landing for brand-new visitors: straight to sign-up.
   * Shown only when cloud is configured, nobody is signed in and the
   * device holds no data — existing users never see it.
   */
  import AccountSheet from '../components/AccountSheet.svelte';
  import { t } from '../lib/i18n.svelte.js';

  let { onskip } = $props();
  let sheet = $state(null); // 'signup' | 'signin' | null
</script>

<div class="welcome">
  <div class="hero">
    <img src="{import.meta.env.BASE_URL}icons/icon-192.png" alt="" class="logo" />
    <h1>Timetrack</h1>
    <p class="tag">{t('welcomeTagline')}</p>
  </div>

  <ul class="feats">
    <li>{t('welcomeFeat1')}</li>
    <li>{t('welcomeFeat2')}</li>
    <li>{t('welcomeFeat3')}</li>
  </ul>

  <div class="cta">
    <button class="btn btn-accent wide" onclick={() => (sheet = 'signup')}>{t('createAccount')}</button>
    <button class="btn btn-ghost wide" onclick={() => (sheet = 'signin')}>{t('signIn')}</button>
    <button class="skip" onclick={() => onskip?.()}>{t('welcomeSkip')}</button>
  </div>
</div>

<AccountSheet open={sheet !== null} initialMode={sheet ?? 'signin'} onclose={() => (sheet = null)} />

<style>
  .welcome {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 34px;
    padding: calc(var(--safe-top) + 40px) 28px calc(var(--safe-bottom) + 40px);
    max-width: 480px;
    margin: 0 auto;
  }
  .hero { text-align: center; }
  .logo {
    width: 76px;
    height: 76px;
    border-radius: 18px;
    box-shadow: var(--shadow-md);
    margin-bottom: 14px;
  }
  h1 { font-size: 34px; font-weight: 750; letter-spacing: -0.03em; }
  .tag { color: var(--text-2); font-size: 16px; margin: 6px 0 0; }

  .feats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .feats li {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 13px 16px;
    font-size: 14.5px;
    color: var(--text-2);
    box-shadow: var(--shadow-sm);
  }

  .cta { display: flex; flex-direction: column; gap: 10px; }
  .wide { width: 100%; padding: 14px; font-size: 16px; }
  .skip {
    margin-top: 4px;
    color: var(--text-3);
    font-size: 14px;
    font-weight: 600;
    padding: 8px;
  }
</style>
