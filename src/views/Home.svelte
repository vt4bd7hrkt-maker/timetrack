<script>
  /**
   * Home — the heart of the app. Big tappable project cards, one tap to
   * start/stop, long press for the action sheet.
   */
  import { data, clock, setArchived } from '../lib/store.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import { startOfDay, endOfDay, overlapMs, workedOverlapMs, entryMs, fmtHours, HOUR } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';
  import ProjectCard from '../components/ProjectCard.svelte';
  import BottomSheet from '../components/BottomSheet.svelte';
  import ProjectForm from '../components/ProjectForm.svelte';
  import EntryForm from '../components/EntryForm.svelte';
  import ForgotForm from '../components/ForgotForm.svelte';
  import DeleteProjectSheet from '../components/DeleteProjectSheet.svelte';

  let sheet = $state(null); // 'menu' | 'addTime' | 'forgot' | 'edit' | 'new' | 'delete'
  let menuProject = $state(null);

  const active = $derived(
    data.projects
      .filter((p) => !p.archived && p.status !== 'completed')
      .sort((a, b) => {
        const ar = data.timers.some((tm) => tm.projectId === a.id) ? 1 : 0;
        const br = data.timers.some((tm) => tm.projectId === b.id) ? 1 : 0;
        return br - ar || (b.updatedAt || 0) - (a.updatedAt || 0);
      })
  );

  /* --- dashboard widgets --- */
  const dayStart = $derived(startOfDay(clock.now));
  const dayEnd = $derived(endOfDay(clock.now));
  const todayMs = $derived(
    data.entries.reduce((s, e) => s + workedOverlapMs(e, dayStart, dayEnd), 0) +
      data.timers.reduce((s, tm) => s + overlapMs(tm.startedAt, clock.now, dayStart, dayEnd), 0)
  );
  const openMs = $derived(
    data.projects
      .filter((p) => !p.archived && p.status !== 'completed' && p.quotaHours > 0)
      .reduce((s, p) => {
        const tracked = data.entries.filter((e) => e.projectId === p.id).reduce((x, e) => x + entryMs(e), 0);
        return s + Math.max(0, p.quotaHours * HOUR - tracked);
      }, 0)
  );

  function openMenu(project) {
    menuProject = project;
    sheet = 'menu';
  }

  function archiveFromMenu() {
    if (confirm(t('archiveConfirm'))) {
      setArchived(menuProject.id, true);
      sheet = null;
    }
  }
</script>

<div class="view">
  <h1 class="view-title">Timetrack</h1>

  <div class="widgets">
    <div class="card w">
      <span class="label-caps">{t('today')}</span>
      <span class="big mono">{fmtHours(todayMs)}</span>
    </div>
    <div class="card w">
      <span class="label-caps">{t('activeTimers')}</span>
      <span class="big mono" class:lit={data.timers.length > 0}>{data.timers.length}</span>
    </div>
    <div class="card w">
      <span class="label-caps">{t('restAll')}</span>
      <span class="big mono">{fmtHours(openMs)}</span>
    </div>
  </div>

  {#if active.length === 0}
    <p class="empty">{t('addProjectFirst')}</p>
    {#if data.projects.length === 0 && data.entries.length === 0}
      <button class="restore-link" onclick={() => go('settings')}>{t('restoreFromBackup')}</button>
    {/if}
  {:else}
    {#each active as p (p.id)}
      <ProjectCard project={p} onmenu={openMenu} />
    {/each}
  {/if}

  <button class="fab btn btn-accent" onclick={() => (sheet = 'new')} aria-label={t('newProject')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
  </button>
</div>

<!-- long-press action sheet -->
<BottomSheet open={sheet === 'menu'} title={menuProject?.title || ''} onclose={() => (sheet = null)}>
  <div class="menu">
    <button onclick={() => (sheet = 'addTime')}>
      <span>＋</span>{t('addTimeManually')}
    </button>
    <button onclick={() => (sheet = 'forgot')}>
      <span>⏱</span>{t('forgotTracking')}
    </button>
    <button onclick={() => (sheet = 'edit')}>
      <span>✎</span>{t('edit')}
    </button>
    <button class="warn" onclick={archiveFromMenu}>
      <span>▣</span>{t('archive')}
    </button>
    <button class="warn" onclick={() => (sheet = 'delete')}>
      <span>✕</span>{t('deleteProject')}
    </button>
  </div>
</BottomSheet>

<DeleteProjectSheet
  open={sheet === 'delete'}
  project={menuProject}
  onclose={() => (sheet = null)}
/>

<BottomSheet open={sheet === 'addTime'} title={t('addTimeManually')} onclose={() => (sheet = null)}>
  {#if menuProject}
    <EntryForm projectId={menuProject.id} ondone={() => (sheet = null)} />
  {/if}
</BottomSheet>

<BottomSheet open={sheet === 'forgot'} title={t('forgotTracking')} onclose={() => (sheet = null)}>
  {#if menuProject}
    <ForgotForm projectId={menuProject.id} ondone={() => (sheet = null)} />
  {/if}
</BottomSheet>

<BottomSheet open={sheet === 'edit'} title={t('editProject')} onclose={() => (sheet = null)}>
  {#if menuProject}
    <ProjectForm project={menuProject} ondone={() => (sheet = null)} />
  {/if}
</BottomSheet>

<BottomSheet open={sheet === 'new'} title={t('newProject')} onclose={() => (sheet = null)}>
  <ProjectForm ondone={() => (sheet = null)} />
</BottomSheet>

<style>
  .widgets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 18px;
  }
  .w { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  /* h:mm:ss must fit a third of a small phone screen */
  .big { font-size: clamp(14px, 4.4vw, 21px); font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
  .big.lit { color: var(--accent); }

  .fab {
    position: fixed;
    right: 18px;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 18px);
    width: 54px;
    height: 54px;
    border-radius: 50%;
    padding: 0;
    z-index: 40;
  }
  .fab svg { width: 24px; height: 24px; }

  .menu { display: flex; flex-direction: column; }
  .menu button {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 15px 4px;
    font-size: 16px;
    font-weight: 600;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }
  .menu button:last-child { border-bottom: none; }
  .menu button span { width: 22px; text-align: center; color: var(--accent); }
  .menu button.warn { color: var(--danger); }
  .menu button.warn span { color: var(--danger); }

  .restore-link {
    display: block;
    margin: 4px auto 0;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }
</style>
