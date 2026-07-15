<script>
  /** Animated SVG donut — percentage distribution across projects. */
  import { fmtHours } from '../../lib/time.js';

  /** @type {{ data?: { label: string, value: number, color?: string }[] }} */
  let { data = [] } = $props();

  const R = 44;
  const C = 2 * Math.PI * R;

  const total = $derived(data.reduce((s, d) => s + d.value, 0) || 1);
  const totalTxt = $derived(fmtHours(total === 1 ? 0 : total));
  const segments = $derived.by(() => {
    let acc = 0;
    return data.map((d) => {
      const frac = d.value / total;
      const seg = { ...d, frac, offset: acc };
      acc += frac;
      return seg;
    });
  });
</script>

<div class="wrap">
  <svg viewBox="0 0 120 120">
    <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" stroke-width="13" />
    {#each segments as s, i (s.label)}
      <circle
        cx="60" cy="60" r={R} fill="none"
        stroke={s.color || 'var(--accent)'}
        stroke-width="13"
        stroke-linecap="butt"
        stroke-dasharray="{Math.max(0.01, s.frac * C - 1.5)} {C}"
        stroke-dashoffset={-s.offset * C}
        transform="rotate(-90 60 60)"
        style="animation-delay:{i * 60}ms"
        class="seg"
      />
    {/each}
    <text x="60" y="57" text-anchor="middle" class="big mono" style="font-size:{totalTxt.length > 7 ? 12.5 : 17}px">{totalTxt}</text>
    <text x="60" y="72" text-anchor="middle" class="small">total</text>
  </svg>

  <ul class="legend">
    {#each segments as s (s.label)}
      <li>
        <span class="dot" style="background:{s.color || 'var(--accent)'}"></span>
        <span class="name">{s.label}</span>
        <span class="pct mono">{Math.round(s.frac * 100)}%</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .wrap { display: flex; align-items: center; gap: 18px; }
  svg { width: 128px; height: 128px; flex-shrink: 0; }
  .seg { animation: sweep 0.8s var(--ease) backwards; }
  @keyframes sweep { from { stroke-dasharray: 0.01 999; } }
  .big { font-size: 17px; font-weight: 700; fill: var(--text); }
  .small { font-size: 9px; fill: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
  .legend { list-style: none; margin: 0; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
  .legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); font-weight: 600; }
  .pct { color: var(--text-3); }
</style>
