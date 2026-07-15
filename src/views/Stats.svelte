<script>
  /** Analytics: range filters, KPIs, bar / donut / line charts. */
  import { data } from '../lib/store.svelte.js';
  import { rangeFor, overlapMs, fmtHours, fromInputs, toDateInput, DAY, HOUR } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';
  import Bars from '../components/charts/Bars.svelte';
  import Donut from '../components/charts/Donut.svelte';
  import Line from '../components/charts/Line.svelte';

  const filters = ['today', 'week', 'month', 'year', 'custom'];
  const filterLabel = { today: 'today', week: 'thisWeek', month: 'thisMonth', year: 'thisYear', custom: 'customRange' };

  let filter = $state('week');
  let customFrom = $state(toDateInput(Date.now() - 7 * DAY));
  let customTo = $state(toDateInput(Date.now()));

  const custom = $derived({ from: fromInputs(customFrom, '00:00'), to: fromInputs(customTo, '00:00') });
  const range = $derived(rangeFor(filter, Date.now(), custom));
  const from = $derived(range[0]);
  const to = $derived(range[1]);

  const inRange = $derived(
    data.entries
      .map((e) => ({ ...e, ms: overlapMs(e.start, e.end, from, to) }))
      .filter((e) => e.ms > 0)
  );

  const totalMs = $derived(inRange.reduce((s, e) => s + e.ms, 0));

  const perProject = $derived.by(() => {
    const ids = new Set(data.projects.map((p) => p.id));
    const rows = data.projects.map((p) => ({
      label: p.title,
      color: p.color,
      value: inRange.filter((e) => e.projectId === p.id).reduce((s, e) => s + e.ms, 0)
    }));
    // Entries of permanently deleted projects stay countable as "Unassigned".
    const orphanMs = inRange.filter((e) => !ids.has(e.projectId)).reduce((s, e) => s + e.ms, 0);
    if (orphanMs > 0) rows.push({ label: t('unassigned'), color: '#9a9ea2', value: orphanMs });
    return rows.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  });

  /* averages over elapsed days in range (capped at now) */
  const elapsedDays = $derived(Math.max(1, Math.ceil((Math.min(to, Date.now()) - from) / DAY)));
  const avgDay = $derived(totalMs / elapsedDays);
  const avgWeek = $derived(totalMs / Math.max(1, elapsedDays / 7));
  const avgMonth = $derived(totalMs / Math.max(1, elapsedDays / 30.44));

  /* per-day series */
  const series = $derived.by(() => {
    const end = Math.min(to, Date.now() + DAY);
    const days = Math.min(370, Math.ceil((end - from) / DAY));
    const out = [];
    for (let i = 0; i < days; i++) {
      const dFrom = from + i * DAY;
      const ms = inRange.reduce((s, e) => s + overlapMs(e.start, e.end, dFrom, dFrom + DAY), 0);
      const d = new Date(dFrom);
      out.push({ label: `${d.getDate()}.${d.getMonth() + 1}`, value: ms / HOUR });
    }
    return out;
  });
</script>

<div class="view">
  <h1 class="view-title">{t('stats')}</h1>

  <div class="chips">
    {#each filters as f (f)}
      <button class="chip" class:on={filter === f} onclick={() => (filter = f)}>
        {t(filterLabel[f])}
      </button>
    {/each}
  </div>

  {#if filter === 'custom'}
    <div class="field-row custom">
      <div class="field">
        <label for="st-from">{t('from')}</label>
        <input id="st-from" type="date" bind:value={customFrom} />
      </div>
      <div class="field">
        <label for="st-to">{t('to')}</label>
        <input id="st-to" type="date" bind:value={customTo} />
      </div>
    </div>
  {/if}

  <div class="kpis">
    <div class="card kpi main">
      <span class="label-caps">{t('totalHours')}</span>
      <span class="v mono">{fmtHours(totalMs)}</span>
    </div>
    <div class="card kpi">
      <span class="label-caps">{t('avgPerDay')}</span>
      <span class="v mono">{fmtHours(avgDay)}</span>
    </div>
    <div class="card kpi">
      <span class="label-caps">{t('avgPerWeek')}</span>
      <span class="v mono">{fmtHours(avgWeek)}</span>
    </div>
    <div class="card kpi">
      <span class="label-caps">{t('avgPerMonth')}</span>
      <span class="v mono">{fmtHours(avgMonth)}</span>
    </div>
  </div>

  {#if totalMs === 0}
    <p class="empty">{t('noData')}</p>
  {:else}
    <div class="card block">
      <p class="label-caps head">{t('hoursPerProject')}</p>
      <Bars data={perProject} />
    </div>

    <div class="card block">
      <p class="label-caps head">{t('distribution')}</p>
      <Donut data={perProject} />
    </div>

    {#if series.length > 1}
      <div class="card block">
        <p class="label-caps head">{t('perDay')}</p>
        <Line data={series} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; }
  .custom { margin-bottom: 8px; }
  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .kpi { padding: 13px 15px; display: flex; flex-direction: column; gap: 4px; }
  .kpi.main { grid-column: 1 / -1; }
  .kpi.main .v { color: var(--accent); filter: brightness(0.92); font-size: 32px; }
  :global(html[data-theme='dark']) .kpi.main .v { filter: none; }
  .v { font-size: 21px; font-weight: 700; letter-spacing: -0.02em; }
  .block { padding: 16px; margin-bottom: 12px; }
  .head { margin: 0 0 14px; }
</style>
