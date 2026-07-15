<script>
  /** Horizontal animated bar chart — hours per project. */
  import { fmtHours } from '../../lib/time.js';

  /** @type {{ data?: { label: string, value: number, color?: string }[] }} */
  let { data = [] } = $props();

  const max = $derived(Math.max(1, ...data.map((d) => d.value)));
</script>

<div class="bars">
  {#each data as d (d.label)}
    <div class="row">
      <span class="label">{d.label}</span>
      <div class="track">
        <div class="bar" style="width:{(d.value / max) * 100}%; background:{d.color || 'var(--accent)'}"></div>
      </div>
      <span class="val mono">{fmtHours(d.value)}</span>
    </div>
  {/each}
</div>

<style>
  .bars { display: flex; flex-direction: column; gap: 10px; }
  .row { display: grid; grid-template-columns: 84px 1fr 64px; align-items: center; gap: 10px; }
  .label { font-size: 12.5px; font-weight: 600; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { height: 10px; border-radius: 5px; background: var(--surface-2); overflow: hidden; }
  .bar {
    height: 100%;
    border-radius: 5px;
    animation: grow 0.7s var(--ease) backwards;
    transform-origin: left;
  }
  @keyframes grow { from { transform: scaleX(0); } }
  .val { font-size: 12.5px; text-align: right; color: var(--text-2); }
</style>
