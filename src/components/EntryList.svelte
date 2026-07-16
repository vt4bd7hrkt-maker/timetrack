<script>
  /** Chronological entry list with edit/delete. */
  import { fmtDate, fmtTime, fmtDur, fmtHM, entryMs, breaksMs } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';
  import { deleteEntry } from '../lib/store.svelte.js';

  /** @type {{ items?: any[], showProject?: boolean, projectsById?: Map<string, any>, onedit?: (entry: any) => void }} */
  let { items = [], showProject = false, projectsById = new Map(), onedit } = $props();

  const sorted = $derived([...items].sort((a, b) => b.start - a.start));

  function remove(e) {
    if (confirm(t('deleteEntryConfirm'))) deleteEntry(e.id);
  }
</script>

{#if sorted.length === 0}
  <p class="empty">{t('noEntries')}</p>
{:else}
  <ul>
    {#each sorted as e (e.id)}
      <li class="card row">
        <button class="main" onclick={() => onedit?.(e)}>
          <span class="line">
            <span class="date">{fmtDate(e.start)}</span>
            <span class="time mono">{fmtTime(e.start)}–{fmtTime(e.end)}</span>
            {#if showProject && projectsById.get(e.projectId)}
              <span class="proj" style="color:{projectsById.get(e.projectId).color}">
                {projectsById.get(e.projectId).title}
              </span>
            {/if}
            {#if e.note}<span class="note">{e.note}</span>{/if}
            <span class="dur mono">{fmtDur(entryMs(e))}</span>
          </span>
          {#if e.breaks?.length}
            <span class="line bline">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a3 3 0 0 1 0 6h-1M4 8h14v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" /></svg>
              {#each e.breaks as b, i (i)}
                <span class="mono btime">{fmtTime(b.start)}–{fmtTime(b.end)}</span>
              {/each}
              <span class="bsum mono">−{fmtHM(breaksMs(e))}</span>
            </span>
          {/if}
        </button>
        <button class="del" onclick={() => remove(e)} aria-label={t('delete')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M4 7h16M10 7V5h4v2M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
          </svg>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: stretch; overflow: hidden; }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 13px 14px;
    text-align: left;
    min-width: 0;
  }
  .line { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .bline { color: var(--text-3); font-size: 12px; gap: 8px; }
  .bline svg { width: 13px; height: 13px; flex-shrink: 0; }
  .btime { font-size: 12px; }
  .bsum { margin-left: auto; font-size: 12px; flex-shrink: 0; }
  .date { font-size: 13px; color: var(--text-2); width: 58px; flex-shrink: 0; }
  .time { font-size: 13.5px; flex-shrink: 0; }
  .proj { font-size: 13px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note { font-size: 12.5px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .dur { margin-left: auto; font-weight: 700; font-size: 14px; flex-shrink: 0; }
  .del {
    padding: 0 14px;
    color: var(--text-3);
    border-left: 1px solid var(--border);
    display: flex;
    align-items: center;
  }
  .del:active { color: var(--danger); }
  .del svg { width: 17px; height: 17px; }
</style>
