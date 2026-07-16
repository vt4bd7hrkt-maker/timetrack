<script>
  /** Add time manually (entry omitted) or edit an existing entry,
   *  including its breaks (multiple, each editable/removable). */
  import { addEntry, updateEntry } from '../lib/store.svelte.js';
  import { toDateInput, toTimeInput, fromInputs, fmtHM } from '../lib/time.js';
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
  /* Breaks are edited as times on the entry's start day. */
  let breaks = $state(
    (entry?.breaks || []).map((b) => ({
      startDate: toDateInput(b.start), start: toTimeInput(b.start),
      endDate: toDateInput(b.end), end: toTimeInput(b.end)
    }))
  );

  const start = $derived(fromInputs(startDate, startTime));
  const end = $derived(fromInputs(endDate, endTime));
  const breakMs = $derived(
    breaks.reduce((s, b) => {
      const bs = fromInputs(b.startDate, b.start);
      const be = fromInputs(b.endDate, b.end);
      return s + (be > bs ? be - bs : 0);
    }, 0)
  );
  const workedMs = $derived(end - start - breakMs);

  function addBreak() {
    // sensible default: a 30 min slot in the middle of the entry
    const mid = start + Math.max(0, end - start) / 2;
    const bs = Math.max(start, mid - 900000);
    const be = Math.min(end, mid + 900000);
    breaks.push({ startDate: toDateInput(bs), start: toTimeInput(bs), endDate: toDateInput(be), end: toTimeInput(be) });
  }

  const removeBreak = (i) => breaks.splice(i, 1);

  async function submit(e) {
    e.preventDefault();
    if (!(end > start)) {
      error = t('invalidRange');
      return;
    }
    const parsed = breaks
      .map((b) => ({ start: fromInputs(b.startDate, b.start), end: fromInputs(b.endDate, b.end) }))
      .sort((a, b) => a.start - b.start);
    for (const b of parsed) {
      if (!(b.end > b.start) || b.start < start || b.end > end) {
        error = t('breakInvalid');
        return;
      }
    }
    // merge overlapping breaks so time is never subtracted twice
    const merged = [];
    for (const b of parsed) {
      const last = merged[merged.length - 1];
      if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
      else merged.push({ ...b });
    }
    if (entry) await updateEntry({ ...entry, start, end, note, breaks: merged });
    else await addEntry({ projectId, start, end, note, breaks: merged });
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

  <div class="breaks">
    <span class="label-caps">{t('breaks')}</span>
    {#each breaks as b, i (i)}
      <div class="brow">
        <input type="time" bind:value={b.start} aria-label="{t('breakLabel')} {t('start')}" required />
        <span class="dash">–</span>
        <input type="time" bind:value={b.end} aria-label="{t('breakLabel')} {t('end')}" required />
        <button type="button" class="bdel" onclick={() => removeBreak(i)} aria-label="{t('delete')} {t('breakLabel')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    {/each}
    <button type="button" class="badd" onclick={addBreak}>+ {t('addBreak')}</button>
  </div>

  <div class="field">
    <label for="ef-note">{t('comment')} ({t('optional')})</label>
    <input id="ef-note" bind:value={note} />
  </div>

  {#if end > start}
    <p class="worked mono">{t('worked')}: {fmtHM(workedMs)}</p>
  {/if}
  {#if error}<p class="err">{error}</p>{/if}

  <div class="actions">
    <button type="button" class="btn btn-ghost" onclick={() => ondone?.()}>{t('cancel')}</button>
    <button type="submit" class="btn btn-accent">{entry ? t('save') : t('addTime')}</button>
  </div>
</form>

<style>
  .breaks { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .brow { display: flex; align-items: center; gap: 8px; }
  .brow input { flex: 1; min-width: 0; }
  .dash { color: var(--text-3); }
  .bdel {
    flex-shrink: 0;
    display: flex;
    padding: 9px;
    color: var(--text-3);
    border-radius: var(--radius-sm);
  }
  .bdel:active { color: var(--danger); }
  .bdel svg { width: 15px; height: 15px; }
  .badd {
    align-self: flex-start;
    color: var(--accent);
    filter: brightness(0.8);
    font-weight: 650;
    font-size: 14px;
    padding: 4px 0;
  }
  :global(html[data-theme='dark']) .badd { filter: none; }
  .worked { font-size: 14px; font-weight: 650; color: var(--text-2); margin: 0 0 10px; }
  .err { color: var(--danger); font-size: 14px; margin: 0 0 10px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
