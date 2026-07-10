<script>
  /** Animated line/area chart — hours per day over the selected range. */

  /** @type {{ data?: { label: string, value: number }[] }} */
  let { data = [] } = $props();

  const W = 320;
  const H = 120;
  const PAD = 6;

  const max = $derived(Math.max(1, ...data.map((d) => d.value)));
  const step = $derived(data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0);
  const pts = $derived(data.map((d, i) => [PAD + i * step, H - PAD - (d.value / max) * (H - PAD * 2)]));
  const line = $derived(pts.map((p) => p.join(',')).join(' '));
  const area = $derived(pts.length ? `${PAD},${H - PAD} ${line} ${PAD + (data.length - 1) * step},${H - PAD}` : '');
  const labelEvery = $derived(Math.max(1, Math.ceil(data.length / 6)));
</script>

{#if data.length > 1}
  <svg viewBox="0 0 {W} {H + 16}">
    <defs>
      <linearGradient id="tt-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <polygon points={area} fill="url(#tt-area)" class="fade" />
    <polyline points={line} fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" class="draw" />
    {#each pts as p, i (i)}
      {#if data[i].value > 0}
        <circle cx={p[0]} cy={p[1]} r="2.6" fill="var(--accent)" class="fade" />
      {/if}
      {#if i % labelEvery === 0}
        <text x={p[0]} y={H + 12} text-anchor="middle" class="lbl">{data[i].label}</text>
      {/if}
    {/each}
  </svg>
{/if}

<style>
  svg { width: 100%; height: auto; }
  .draw {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: draw 1.1s var(--ease) forwards;
  }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .fade { animation: fadein 0.9s 0.3s var(--ease) backwards; }
  @keyframes fadein { from { opacity: 0; } }
  .lbl { font-size: 8.5px; fill: var(--text-3); }
</style>
