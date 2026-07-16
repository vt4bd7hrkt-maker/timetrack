<script>
  /**
   * The one-tap tracking card.
   * Tap        -> start / stop the project's timer.
   * Long press -> parent opens the action sheet via the onmenu callback.
   */
  import { data, clock, startTimer, stopTimer, trackedMs, isRunning } from '../lib/store.svelte.js';
  import { longpress } from '../lib/longpress.js';
  import { fmtClock, fmtHM, HOUR, startOfDay, endOfDay, overlapMs, workedOverlapMs } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';
  import { go } from '../lib/router.svelte.js';

  /** @type {{ project: any, onmenu?: (project: any) => void }} */
  let { project, onmenu } = $props();

  const running = $derived(isRunning(project.id));
  const timer = $derived(data.timers.find((x) => x.projectId === project.id));
  const elapsed = $derived(timer ? Math.max(0, clock.now - timer.startedAt) : 0);
  const totalMs = $derived(trackedMs(project.id)); // quota math only — not displayed
  /* Today's worked time, live: clock.now moves it while a timer runs and
     rolls it over to 0 at midnight. */
  const todayMs = $derived.by(() => {
    const from = startOfDay(clock.now);
    const to = endOfDay(clock.now);
    let ms = 0;
    for (const e of data.entries) if (e.projectId === project.id) ms += workedOverlapMs(e, from, to);
    if (timer) ms += overlapMs(timer.startedAt, clock.now, from, to);
    return ms;
  });
  const quotaMs = $derived((project.quotaHours || 0) * HOUR);
  const pct = $derived(quotaMs ? Math.min(100, (totalMs / quotaMs) * 100) : 0);
  const over = $derived(quotaMs > 0 && totalMs > quotaMs);
  const remaining = $derived(quotaMs - totalMs);
  const tappable = $derived(project.status !== 'completed' && !project.archived);

  function toggle() {
    if (!tappable) return;
    running ? stopTimer(project.id) : startTimer(project.id);
  }
</script>

<div
  class="card pcard"
  class:running
  class:dim={!tappable}
  style="--pcolor: {project.color || 'var(--accent)'}"
  use:longpress={() => onmenu?.(project)}
  onclick={toggle}
  onkeydown={(e) => e.key === 'Enter' && toggle()}
  role="button"
  tabindex="0"
  aria-label="{project.title} — {running ? t('running') : t(project.archived ? 'archived' : project.status)}"
>
  <div class="top">
    <span class="dot"></span>
    <span class="name">{project.title}</span>
    {#if running}
      <span class="clock mono">{fmtClock(elapsed)}</span>
    {:else}
      <span class="status">{t(project.archived ? 'archived' : project.status)}</span>
    {/if}
  </div>

  <div class="mid">
    <span class="hours mono">{fmtHM(todayMs)}</span>
    <span class="sub">{t('today').toLowerCase()}</span>
    {#if quotaMs}
      <span class="rest mono" class:overrun={over}>
        {over ? '+' : ''}{fmtHM(Math.abs(remaining))} {t('remaining')}
      </span>
    {/if}
    <button
      class="more"
      onclick={(e) => {
        e.stopPropagation();
        go('project', { id: project.id });
      }}
      aria-label="details"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  </div>

  {#if quotaMs}
    <div class="progress"><div class:over style="width:{pct}%"></div></div>
  {/if}
</div>

<style>
  .pcard {
    padding: 18px 18px 16px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: transform 0.14s var(--ease), border-color 0.2s, box-shadow 0.3s;
    border-width: 1.5px;
  }
  .pcard:active { transform: scale(0.98); }
  .pcard.dim { opacity: 0.55; }

  .pcard.running {
    border-color: var(--accent);
    animation: pulse 2.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow), var(--shadow-sm); }
    50% { box-shadow: 0 0 0 7px rgba(57, 255, 20, 0), var(--shadow-sm); }
  }

  .top { display: flex; align-items: center; gap: 9px; }
  .dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--pcolor);
    flex-shrink: 0;
  }
  .name {
    font-weight: 650;
    font-size: 17px;
    letter-spacing: -0.01em;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .clock {
    color: var(--accent);
    font-weight: 700;
    font-size: 16px;
    text-shadow: 0 0 12px var(--accent-glow);
  }
  :global(html[data-theme='light']) .clock { text-shadow: none; }
  .status { font-size: 12px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }

  .mid { display: flex; align-items: baseline; gap: 8px; margin: 12px 0 10px; }
  .hours { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
  .sub { font-size: 13px; color: var(--text-3); }
  .rest { margin-left: auto; font-size: 13px; color: var(--text-2); }
  .rest.overrun { color: var(--danger); }

  .more {
    align-self: center;
    color: var(--text-3);
    display: flex;
    padding: 6px;
    margin: -6px -6px -6px 0;
  }
  .more svg { width: 18px; height: 18px; }
</style>
