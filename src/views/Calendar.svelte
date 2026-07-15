<script>
  /** Month view; tapping a day shows its timeline. */
  import { data } from '../lib/store.svelte.js';
  import { DAY, HOUR, overlapMs, fmtHours, fmtTime, fmtDateFull, startOfDay } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';

  let cursor = $state(new Date());
  let selected = $state(null); // epoch ms of a day start

  const year = $derived(cursor.getFullYear());
  const month = $derived(cursor.getMonth());
  const monthName = $derived(cursor.toLocaleDateString([], { month: 'long', year: 'numeric' }));
  const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
  const lead = $derived((new Date(year, month, 1).getDay() + 6) % 7); // Monday-first offset

  const projById = $derived(new Map(data.projects.map((p) => [p.id, p])));
  /** Entries whose project was permanently deleted are shown as "Unassigned". */
  const UNASSIGNED_COLOR = '#9a9ea2';
  const projOf = (pid) => projById.get(pid) || { id: '__unassigned__', title: t('unassigned'), color: UNASSIGNED_COLOR };

  /** day start ms -> { ms, colors:Set } */
  const dayMap = $derived.by(() => {
    const map = new Map();
    const mFrom = new Date(year, month, 1).getTime();
    const mTo = new Date(year, month + 1, 1).getTime();
    for (const e of data.entries) {
      if (e.end <= mFrom || e.start >= mTo) continue;
      let d = Math.max(startOfDay(e.start), mFrom);
      while (d < Math.min(e.end, mTo)) {
        const ms = overlapMs(e.start, e.end, d, d + DAY);
        if (ms > 0) {
          const cur = map.get(d) || { ms: 0, colors: new Set() };
          cur.ms += ms;
          cur.colors.add(projOf(e.projectId).color);
          map.set(d, cur);
        }
        d += DAY;
      }
    }
    return map;
  });

  const dayEntries = $derived(
    selected == null
      ? []
      : data.entries
          .filter((e) => overlapMs(e.start, e.end, selected, selected + DAY) > 0)
          .sort((a, b) => a.start - b.start)
  );

  const dayTotal = $derived(dayEntries.reduce((s, e) => s + overlapMs(e.start, e.end, selected, selected + DAY), 0));

  /** per-project totals for the selected day */
  const dayPerProject = $derived.by(() => {
    const m = new Map();
    for (const e of dayEntries) {
      const ms = overlapMs(e.start, e.end, selected, selected + DAY);
      m.set(e.projectId, (m.get(e.projectId) || 0) + ms);
    }
    return [...m.entries()]
      .map(([pid, ms]) => ({ p: projOf(pid), ms }))
      .sort((a, b) => b.ms - a.ms);
  });

  function move(dir) {
    cursor = new Date(year, month + dir, 1);
    selected = null;
  }

  const dayTs = (d) => new Date(year, month, d).getTime();
  const todayTs = $derived(startOfDay(Date.now()));
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
</script>

<div class="view">
  <h1 class="view-title">{t('calendar')}</h1>

  <div class="card cal">
    <div class="nav">
      <button onclick={() => move(-1)} aria-label="prev">‹</button>
      <span class="mname">{monthName}</span>
      <button onclick={() => move(1)} aria-label="next">›</button>
    </div>

    <div class="grid head">
      {#each weekdays as w, i (i)}<span class="wd" class:we={i > 4}>{w}</span>{/each}
    </div>

    <div class="grid">
      {#each Array(lead) as _, i (i)}<span></span>{/each}
      {#each Array(daysInMonth) as _, i (i)}
        {@const ts = dayTs(i + 1)}
        {@const info = dayMap.get(ts)}
        <button
          class="day"
          class:sel={selected === ts}
          class:today={ts === todayTs}
          class:has={!!info}
          onclick={() => (selected = selected === ts ? null : ts)}
        >
          <span class="num">{i + 1}</span>
          {#if info}
            <span class="hrs mono">{(info.ms / HOUR).toFixed(1)}</span>
            <span class="dots">
              {#each [...info.colors].slice(0, 3) as c (c)}<i style="background:{c}"></i>{/each}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  {#if selected != null}
    <div class="card detail">
      <div class="dhead">
        <span class="dtitle">{fmtDateFull(selected)}</span>
        <span class="dtotal mono">{fmtHours(dayTotal)}</span>
      </div>

      {#if dayPerProject.length}
        <div class="per-proj">
          {#each dayPerProject as x (x.p.id)}
            <span class="pp"><i style="background:{x.p.color}"></i>{x.p.title} <b class="mono">{fmtHours(x.ms)}</b></span>
          {/each}
        </div>
      {/if}

      {#if dayEntries.length === 0}
        <p class="empty">{t('noEntries')}</p>
      {:else}
        <ul>
          {#each dayEntries as e (e.id)}
            <li>
              <span class="mono trange">{fmtTime(Math.max(e.start, selected))}–{fmtTime(Math.min(e.end, selected + DAY))}</span>
              <span class="pname" style="color:{projOf(e.projectId).color}">{projOf(e.projectId).title}</span>
              {#if e.note}<span class="note">{e.note}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cal { padding: 14px; }
  .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .nav button { font-size: 26px; padding: 0 14px; color: var(--text-2); line-height: 1; }
  .mname { font-weight: 700; font-size: 16px; }

  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .grid.head { margin-bottom: 4px; }
  .wd { text-align: center; font-size: 10.5px; font-weight: 700; color: var(--text-3); }
  .wd.we { opacity: 0.55; }

  .day {
    aspect-ratio: 1 / 1.15;
    border-radius: 9px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 5px;
    gap: 1px;
    font-size: 13px;
    position: relative;
    transition: background 0.15s, transform 0.12s var(--ease);
  }
  .day:active { transform: scale(0.92); }
  .day.has { background: var(--surface-2); }
  .day.today .num {
    color: var(--on-accent);
    background: var(--accent);
    border-radius: 50%;
    width: 20px; height: 20px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .day.sel { outline: 2px solid var(--accent); outline-offset: -2px; }
  .num { font-weight: 600; font-size: 12.5px; }
  .hrs { font-size: 9.5px; color: var(--text-2); font-weight: 700; }
  .dots { display: flex; gap: 2px; }
  .dots i { width: 4px; height: 4px; border-radius: 50%; }

  .detail { margin-top: 12px; padding: 16px; animation: view-in 0.2s var(--ease); }
  .dhead { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .dtitle { font-weight: 700; }
  .dtotal { font-weight: 700; color: var(--accent); filter: brightness(0.85); }
  :global(html[data-theme='dark']) .dtotal { filter: none; }

  .per-proj { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .pp {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; color: var(--text-2);
    background: var(--surface-2);
    padding: 4px 10px; border-radius: 999px;
  }
  .pp i { width: 7px; height: 7px; border-radius: 50%; }
  .pp b { font-weight: 700; color: var(--text); }

  ul { list-style: none; margin: 0; padding: 0; }
  li {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
  }
  li:last-child { border-bottom: none; }
  .trange { color: var(--text-2); font-size: 13px; }
  .pname { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note { color: var(--text-3); font-size: 12.5px; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40%; }
</style>
