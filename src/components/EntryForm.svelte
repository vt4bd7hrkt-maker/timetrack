<script>
  /** Add time manually (entry omitted) or edit an existing entry. */
  import { addEntry, updateEntry } from '../lib/store.svelte.js';
  import { toDateInput, toTimeInput, fromInputs } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';

  /** @type {{ projectId: string, entry?: any, ondone?: () => void }} */
  let { projectId, entry = null, ondone } = $props();

  const base = entry?.start ?? Date.now() - 3600000;
  const baseEnd = entry?.end ?? Date.now();

  let startDate = $state(toDateInput(base));
  let startTime = $state(toTimeInput(base));
  let endDate = $state(toDateInput(baseEnd));
  let endTime = $state(toTimeInput(baseEnd));
  let note = $state(entry?.note ?? '');
  let error = $state('');

  async function submit(e) {
    e.preventDefault();
    const start = fromInputs(startDate, startTime);
    const end = fromInputs(endDate, endTime);
    if (!(end > start)) {
      error = t('invalidRange');
      return;
    }
    if (entry) await updateEntry({ ...entry, start, end, note });
    else await addEntry({ projectId, start, end, note });
    ondone?.();
  }
</script>

<form onsubmit={submit}>
  <div class="field-row">
    <div class="field">
      <label for="ef-sd">{t('startDate')}</label>
      <input id="ef-sd" type="date" bind:value={startDate} required />
    </div>
    <div class="field">
      <label for="ef-st">{t('startTime')}</label>
      <input id="ef-st" type="time" bind:value={startTime} required />
    </div>
  </div>

  <div class="field-row">
    <div class="field">
      <label for="ef-ed">{t('endDate')}</label>
      <input id="ef-ed" type="date" bind:value={endDate} required />
    </div>
    <div class="field">
      <label for="ef-et">{t('endTime')}</label>
      <input id="ef-et" type="time" bind:value={endTime} required />
    </div>
  </div>

  <div class="field">
    <label for="ef-note">{t('comment')} ({t('optional')})</label>
    <input id="ef-note" bind:value={note} />
  </div>

  {#if error}<p class="err">{error}</p>{/if}

  <div class="actions">
    <button type="button" class="btn btn-ghost" onclick={() => ondone?.()}>{t('cancel')}</button>
    <button type="submit" class="btn btn-accent">{entry ? t('save') : t('addTime')}</button>
  </div>
</form>

<style>
  .err { color: var(--danger); font-size: 14px; margin: 0 0 10px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
