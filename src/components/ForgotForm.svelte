<script>
  /**
   * "Forgot to track" — pick a past start time; the timer starts retroactively
   * and keeps running live (elapsed = now - chosen start).
   */
  import { startTimer, clock } from '../lib/store.svelte.js';
  import { toDateInput, toTimeInput, fromInputs, fmtClock } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';

  /** @type {{ projectId: string, ondone?: () => void }} */
  let { projectId, ondone } = $props();

  let startDate = $state(toDateInput(Date.now()));
  let startTime = $state(toTimeInput(Date.now() - 3600000));
  let error = $state('');

  const chosen = $derived(fromInputs(startDate, startTime));
  const preview = $derived(chosen && chosen < clock.now ? clock.now - chosen : 0);

  async function submit(e) {
    e.preventDefault();
    if (!(chosen < Date.now())) {
      error = t('invalidRange');
      return;
    }
    await startTimer(projectId, chosen);
    ondone?.();
  }
</script>

<form onsubmit={submit}>
  <div class="field-row">
    <div class="field">
      <label for="ff-d">{t('startDate')}</label>
      <input id="ff-d" type="date" bind:value={startDate} required />
    </div>
    <div class="field">
      <label for="ff-t">{t('startTime')}</label>
      <input id="ff-t" type="time" bind:value={startTime} required />
    </div>
  </div>

  {#if preview > 0}
    <p class="preview mono">+ {fmtClock(preview)}</p>
  {/if}
  {#if error}<p class="err">{error}</p>{/if}

  <div class="actions">
    <button type="button" class="btn btn-ghost" onclick={() => ondone?.()}>{t('cancel')}</button>
    <button type="submit" class="btn btn-accent">{t('startTracking')}</button>
  </div>
</form>

<style>
  .preview {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    margin: 0 0 12px;
  }
  .err { color: var(--danger); font-size: 14px; margin: 0 0 10px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
