<script>
  /** Per-project page: facts, quota progress, mini stats, entry history, export. */
  import { data, setArchived, trackedMs } from '../lib/store.svelte.js';
  import { fmtHours, HOUR, DAY, overlapMs, startOfDay } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import EntryList from '../components/EntryList.svelte';
  import BottomSheet from '../components/BottomSheet.svelte';
  import ProjectForm from '../components/ProjectForm.svelte';
  import EntryForm from '../components/EntryForm.svelte';
  import Line from '../components/charts/Line.svelte';
  import { buildRows, exportCSV, exportXLSX, exportPDF } from '../lib/export.js';

  /** @type {{ id: string }} */
  let { id } = $props();

  let sheet = $state(null); // 'edit' | 'entry' | 'addTime'
  let editEntry = $state(null);

  const project = $derived(data.projects.find((p) => p.id === id));
  const myEntries = $derived(data.entries.filter((e) => e.projectId === id));
  const totalMs = $derived(project ? trackedMs(id) : 0);
  const quotaMs = $derived((project?.quotaHours || 0) * HOUR);
  const pct = $derived(quotaMs ? Math.min(100, (totalMs / quotaMs) * 100) : 0);
  const over = $derived(quotaMs > 0 && totalMs > quotaMs);
  const earnings = $derived(project?.hourlyRate ? (totalMs / HOUR) * project.hourlyRate : null);

  /* last 14 days mini chart */
  const series = $derived.by(() => {
    const out = [];
    const today = startOfDay(Date.now());
    for (let i = 13; i >= 0; i--) {
      const from = today - i * DAY;
      const ms = myEntries.reduce((s, e) => s + overlapMs(e.start, e.end, from, from + DAY), 0);
      const d = new Date(from);
      out.push({ label: `${d.getDate()}.`, value: ms / HOUR });
    }
    return out;
  });

  function toggleArchive() {
    if (project.archived) setArchived(id, false);
    else if (confirm(t('archiveConfirm'))) setArchived(id, true);
  }

  function onEditEntry(entry) {
    editEntry = entry;
    sheet = 'entry';
  }

  const rows = () => buildRows(myEntries, data.projects);
  const stamp = () => new Date().toISOString().slice(0, 10);
</script>

{#if !project}
  <div class="view"><p class="empty">?</p></div>
{:else}
  <div class="view">
    <button class="back" onclick={() => go('projects')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {t('projects')}
    </button>

    <div class="head">
      <span class="dot" style="background:{project.color}"></span>
      <div class="ht">
        <h1>{project.title}</h1>
        {#if project.client}<p class="client">{project.client}</p>{/if}
      </div>
      <span class="status">{t(project.archived ? 'archived' : project.status)}</span>
    </div>

    {#if project.description}
      <p class="desc">{project.description}</p>
    {/if}

    <div class="kpis">
      <div class="card kpi">
        <span class="label-caps">{t('totalHours')}</span>
        <span class="v mono">{fmtHours(totalMs)}</span>
      </div>
      <div class="card kpi">
        <span class="label-caps">{t('restLabel')}</span>
        <span class="v mono" class:overrun={over}>{quotaMs ? (over ? '+' : '') + fmtHours(Math.abs(quotaMs - totalMs)) : '—'}</span>
      </div>
      <div class="card kpi">
        <span class="label-caps">{t('quotaLabel')}</span>
        <span class="v mono">{project.quotaHours ? project.quotaHours + 'h' : '—'}</span>
      </div>
      <div class="card kpi">
        <span class="label-caps">{earnings != null ? '€' : t('entries')}</span>
        <span class="v mono">{earnings != null ? Math.round(earnings).toLocaleString() : myEntries.length}</span>
      </div>
    </div>

    {#if quotaMs}
      <div class="progress big"><div class:over style="width:{pct}%"></div></div>
    {/if}

    <div class="actions">
      <button class="btn btn-ghost" onclick={() => (sheet = 'edit')}>{t('edit')}</button>
      <button class="btn btn-ghost" onclick={() => { editEntry = null; sheet = 'addTime'; }}>+ {t('addTime')}</button>
      <button class="btn btn-ghost" onclick={toggleArchive}>{t(project.archived ? 'unarchive' : 'archive')}</button>
    </div>

    {#if series.some((s) => s.value > 0)}
      <div class="card block">
        <p class="label-caps bhead">{t('perDay')} · 14d</p>
        <Line data={series} />
      </div>
    {/if}

    <p class="label-caps section">{t('history')}</p>
    <EntryList items={myEntries} onedit={onEditEntry} />

    <div class="exp">
      <button class="btn btn-ghost" onclick={() => exportCSV(rows(), `${project.title}_${stamp()}.csv`)}>{t('exportCsv')}</button>
      <button class="btn btn-ghost" onclick={() => exportXLSX(rows(), `${project.title}_${stamp()}.xlsx`)}>{t('exportXlsx')}</button>
      <button class="btn btn-ghost" onclick={() => exportPDF(rows(), { title: project.title, subtitle: project.client }, `${project.title}_${stamp()}.pdf`)}>{t('exportPdf')}</button>
    </div>
  </div>

  <BottomSheet open={sheet === 'edit'} title={t('editProject')} onclose={() => (sheet = null)}>
    <ProjectForm {project} ondone={() => (sheet = null)} />
  </BottomSheet>

  <BottomSheet open={sheet === 'addTime'} title={t('addTimeManually')} onclose={() => (sheet = null)}>
    <EntryForm projectId={id} ondone={() => (sheet = null)} />
  </BottomSheet>

  <BottomSheet open={sheet === 'entry'} title={t('editEntry')} onclose={() => (sheet = null)}>
    {#if editEntry}
      <EntryForm projectId={id} entry={editEntry} ondone={() => { sheet = null; editEntry = null; }} />
    {/if}
  </BottomSheet>
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-2);
    font-weight: 600;
    font-size: 14px;
    margin: calc(var(--safe-top) + 4px) 0 14px;
  }
  .back svg { width: 18px; height: 18px; }

  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
  .ht { flex: 1; min-width: 0; }
  h1 { font-size: 24px; letter-spacing: -0.02em; }
  .client { margin: 2px 0 0; color: var(--text-2); font-size: 14px; }
  .status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-3); }

  .desc { color: var(--text-2); font-size: 14.5px; margin: 0 0 16px; }

  .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
  .kpi { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
  .v { font-size: 20px; font-weight: 700; }
  .v.overrun { color: var(--danger); }

  .progress.big { height: 8px; margin-bottom: 16px; }

  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

  .block { padding: 16px; margin-bottom: 8px; }
  .bhead { margin: 0 0 12px; }
  .section { margin: 16px 2px 8px; }

  .exp { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
</style>
