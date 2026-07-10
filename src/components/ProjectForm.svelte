<script>
  import { saveProject } from '../lib/store.svelte.js';
  import { t } from '../lib/i18n.svelte.js';

  /** @type {{ project?: any, ondone?: () => void }} — pass a project to edit, omit to create. */
  let { project = null, ondone } = $props();

  const palette = ['#39ff14', '#4d9fff', '#ff9f43', '#ff5d8f', '#b06bff', '#ffd93d', '#2dd4bf', '#e5484d'];

  let title = $state(project?.title ?? '');
  let client = $state(project?.client ?? '');
  let description = $state(project?.description ?? '');
  let quotaHours = $state(project?.quotaHours ?? '');
  let hourlyRate = $state(project?.hourlyRate ?? '');
  let color = $state(project?.color ?? '#39ff14');
  let status = $state(project?.status ?? 'active');

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await saveProject({
      ...(project || {}),
      title: title.trim(),
      client: client.trim(),
      description: description.trim(),
      quotaHours: +quotaHours || 0,
      hourlyRate: hourlyRate === '' ? null : +hourlyRate,
      color,
      status
    });
    ondone?.();
  }
</script>

<form onsubmit={submit}>
  <div class="field">
    <label for="pf-title">{t('title')}</label>
    <input id="pf-title" bind:value={title} required placeholder="Website Redesign" />
  </div>

  <div class="field">
    <label for="pf-client">{t('client')}</label>
    <input id="pf-client" bind:value={client} placeholder="Acme GmbH" />
  </div>

  <div class="field">
    <label for="pf-desc">{t('description')}</label>
    <textarea id="pf-desc" bind:value={description} rows="2"></textarea>
  </div>

  <div class="field-row">
    <div class="field">
      <label for="pf-quota">{t('quota')} (h)</label>
      <input id="pf-quota" type="number" inputmode="decimal" min="0" step="0.5" bind:value={quotaHours} placeholder="40" />
    </div>
    <div class="field">
      <label for="pf-rate">{t('rate')} (€, {t('optional')})</label>
      <input id="pf-rate" type="number" inputmode="decimal" min="0" step="1" bind:value={hourlyRate} placeholder="90" />
    </div>
  </div>

  <div class="field">
    <span class="lbl">{t('color')}</span>
    <div class="swatches">
      {#each palette as c (c)}
        <button type="button" class="swatch" class:sel={color === c} style="background:{c}" onclick={() => (color = c)} aria-label={c}></button>
      {/each}
    </div>
  </div>

  <div class="field">
    <label for="pf-status">{t('status')}</label>
    <select id="pf-status" bind:value={status}>
      <option value="active">{t('active')}</option>
      <option value="paused">{t('paused')}</option>
      <option value="completed">{t('completed')}</option>
    </select>
  </div>

  <div class="actions">
    <button type="button" class="btn btn-ghost" onclick={() => ondone?.()}>{t('cancel')}</button>
    <button type="submit" class="btn btn-accent">{t('save')}</button>
  </div>
</form>

<style>
  .lbl { font-size: 13px; font-weight: 600; color: var(--text-2); }
  .swatches { display: flex; gap: 10px; flex-wrap: wrap; padding: 4px 0; }
  .swatch {
    width: 32px; height: 32px; border-radius: 50%;
    border: 2px solid transparent;
    transition: transform 0.12s var(--ease), border-color 0.12s;
  }
  .swatch.sel { border-color: var(--text); transform: scale(1.15); }
  .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
</style>
