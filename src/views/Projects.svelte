<script>
  /** All projects with search, grouped by status, incl. archive. */
  import { data, setArchived } from '../lib/store.svelte.js';
  import { fmtHours, entryMs } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import BottomSheet from '../components/BottomSheet.svelte';
  import ProjectForm from '../components/ProjectForm.svelte';

  let q = $state('');
  let showNew = $state(false);
  let showArchived = $state(false);

  const norm = (s) => (s || '').toLowerCase();

  const filtered = $derived(
    data.projects.filter((p) => {
      if (!q) return true;
      const n = norm(q);
      return norm(p.title).includes(n) || norm(p.client).includes(n) || norm(p.description).includes(n);
    })
  );

  const groups = $derived(
    [
      { key: 'active', items: filtered.filter((p) => !p.archived && p.status === 'active') },
      { key: 'paused', items: filtered.filter((p) => !p.archived && p.status === 'paused') },
      { key: 'completed', items: filtered.filter((p) => !p.archived && p.status === 'completed') }
    ].filter((g) => g.items.length)
  );

  const archived = $derived(filtered.filter((p) => p.archived));

  const totalFor = (id) => data.entries.filter((x) => x.projectId === id).reduce((s, x) => s + entryMs(x), 0);
</script>

<div class="view">
  <h1 class="view-title">{t('projects')}</h1>

  <div class="searchbar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    <input placeholder={t('search')} bind:value={q} />
  </div>

  {#if data.projects.length === 0}
    <p class="empty">{t('noProjects')}</p>
  {/if}

  {#each groups as g (g.key)}
    <p class="label-caps section">{t(g.key)}</p>
    {#each g.items as p (p.id)}
      <button class="card prow" onclick={() => go('project', { id: p.id })}>
        <span class="dot" style="background:{p.color}"></span>
        <span class="info">
          <span class="name">{p.title}</span>
          {#if p.client}<span class="client">{p.client}</span>{/if}
        </span>
        <span class="hours mono">{fmtHours(totalFor(p.id))}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6" /></svg>
      </button>
    {/each}
  {/each}

  {#if archived.length}
    <button class="arch-toggle" onclick={() => (showArchived = !showArchived)}>
      {t('showArchived')} ({archived.length}) {showArchived ? '▾' : '▸'}
    </button>
    {#if showArchived}
      {#each archived as p (p.id)}
        <div class="card prow dim">
          <span class="dot" style="background:{p.color}"></span>
          <button class="info" onclick={() => go('project', { id: p.id })}>
            <span class="name">{p.title}</span>
            {#if p.client}<span class="client">{p.client}</span>{/if}
          </button>
          <button class="restore" onclick={() => setArchived(p.id, false)}>{t('unarchive')}</button>
        </div>
      {/each}
    {/if}
  {/if}

  <button class="btn btn-accent wide" onclick={() => (showNew = true)}>+ {t('newProject')}</button>
</div>

<BottomSheet open={showNew} title={t('newProject')} onclose={() => (showNew = false)}>
  <ProjectForm ondone={() => (showNew = false)} />
</BottomSheet>

<style>
  .searchbar {
    position: relative;
    margin-bottom: 16px;
  }
  .searchbar svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 17px;
    height: 17px;
    color: var(--text-3);
    pointer-events: none;
  }
  .searchbar input { padding-left: 38px; background: var(--surface); }

  .section { margin: 18px 2px 8px; }

  .prow {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 14px;
    margin-bottom: 8px;
    text-align: left;
  }
  .prow.dim { opacity: 0.6; }
  .prow > svg { width: 16px; height: 16px; color: var(--text-3); flex-shrink: 0; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; }
  .name { font-weight: 650; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .client { font-size: 12.5px; color: var(--text-3); }
  .hours { font-size: 14px; color: var(--text-2); font-weight: 650; }
  .restore { font-size: 13px; font-weight: 650; color: var(--accent); filter: brightness(0.8); }

  .arch-toggle { display: block; margin: 18px 2px 8px; font-size: 13px; font-weight: 650; color: var(--text-3); }
  .wide { width: 100%; margin-top: 20px; }
</style>
