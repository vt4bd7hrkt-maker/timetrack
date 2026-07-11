<script>
  /** Theme, language, daily goal, exports, backup, danger zone. */
  import { settings, saveSetting, data, exportBackup, importBackup, eraseAll } from '../lib/store.svelte.js';
  import { cloud, connect, disconnect, backupNow, restoreNow } from '../lib/cloudbackup.svelte.js';
  import { buildRows, exportCSV, exportXLSX, exportPDF } from '../lib/export.js';
  import { toDateInput, fromInputs, DAY } from '../lib/time.js';
  import { t } from '../lib/i18n.svelte.js';

  let expFrom = $state(toDateInput(Date.now() - 30 * DAY));
  let expTo = $state(toDateInput(Date.now()));
  let expProject = $state('all');
  let fileInput = $state(null);

  function exportRows() {
    const from = fromInputs(expFrom, '00:00');
    const to = fromInputs(expTo, '00:00') + DAY;
    const list = data.entries.filter(
      (e) => e.start < to && e.end > from && (expProject === 'all' || e.projectId === expProject)
    );
    return buildRows(list, data.projects);
  }

  const doCSV = () => exportCSV(exportRows(), `timetrack_${expFrom}_${expTo}.csv`);
  const doXLSX = () => exportXLSX(exportRows(), `timetrack_${expFrom}_${expTo}.xlsx`);
  const doPDF = () => {
    const pName = expProject === 'all' ? t('allProjects') : data.projects.find((p) => p.id === expProject)?.title;
    exportPDF(exportRows(), { title: 'Timetrack Report', subtitle: `${pName} · ${expFrom} – ${expTo}` }, `timetrack_${expFrom}_${expTo}.pdf`);
  };

  function downloadBackup() {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `timetrack_backup_${toDateInput(Date.now())}.json`;
    a.click();
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(t('importConfirm'))) return;
    try {
      await importBackup(await file.text());
    } catch (err) {
      alert(String(err.message || err));
    }
    e.target.value = '';
  }

  async function toggleReminders(e) {
    const on = e.target.checked;
    if (on && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    saveSetting('reminders', on);
  }

  function erase() {
    if (confirm(t('eraseConfirm'))) eraseAll();
  }

  /* --- cloud backup --- */
  let tokenInput = $state('');
  let cloudBusy = $state(false);
  let cloudMsg = $state('');

  async function doConnect() {
    cloudBusy = true;
    cloudMsg = '';
    try {
      const { hasBackup } = await connect(tokenInput.trim());
      tokenInput = '';
      if (hasBackup && confirm(t('restoreConfirm'))) {
        await restoreNow();
        cloudMsg = t('restoreDone');
      } else {
        await backupNow();
      }
    } catch {
      cloudMsg = t('invalidToken');
    }
    cloudBusy = false;
  }

  async function doRestore() {
    if (!confirm(t('restoreConfirm'))) return;
    cloudBusy = true;
    cloudMsg = '';
    try {
      await restoreNow();
      cloudMsg = t('restoreDone');
    } catch (err) {
      cloudMsg = String(err.message || err);
    }
    cloudBusy = false;
  }
</script>

<div class="view">
  <h1 class="view-title">{t('settings')}</h1>

  <div class="card sec">
    <p class="label-caps head">{t('theme')}</p>
    <div class="seg">
      {#each ['light', 'dark', 'system'] as th (th)}
        <button class:on={settings.theme === th} onclick={() => saveSetting('theme', th)}>{t(th)}</button>
      {/each}
    </div>

    <div class="row">
      <label for="set-lang">{t('language')}</label>
      <select id="set-lang" value={settings.language} onchange={(e) => saveSetting('language', e.target.value)}>
        <option value="en">English</option>
        <option value="de">Deutsch</option>
      </select>
    </div>

    <div class="row">
      <label for="set-goal">{t('dailyGoal')} (h)</label>
      <input
        id="set-goal"
        type="number" min="0" max="24" step="0.5" inputmode="decimal"
        value={settings.dailyGoal}
        onchange={(e) => saveSetting('dailyGoal', +e.target.value || 0)}
      />
    </div>

    <div class="row">
      <label for="set-rem">{t('longRunReminder')}</label>
      <input id="set-rem" type="checkbox" class="switch" checked={settings.reminders} onchange={toggleReminders} />
    </div>
  </div>

  <div class="card sec">
    <p class="label-caps head">{t('export')}</p>
    <div class="field-row">
      <div class="field">
        <label for="ex-from">{t('from')}</label>
        <input id="ex-from" type="date" bind:value={expFrom} />
      </div>
      <div class="field">
        <label for="ex-to">{t('to')}</label>
        <input id="ex-to" type="date" bind:value={expTo} />
      </div>
    </div>
    <div class="field">
      <label for="ex-proj">{t('project')}</label>
      <select id="ex-proj" bind:value={expProject}>
        <option value="all">{t('allProjects')}</option>
        {#each data.projects as p (p.id)}
          <option value={p.id}>{p.title}</option>
        {/each}
      </select>
    </div>
    <div class="exp-btns">
      <button class="btn btn-ghost" onclick={doCSV}>{t('exportCsv')}</button>
      <button class="btn btn-ghost" onclick={doXLSX}>{t('exportXlsx')}</button>
      <button class="btn btn-accent" onclick={doPDF}>{t('exportPdf')}</button>
    </div>
  </div>

  <div class="card sec">
    <p class="label-caps head">{t('backup')}</p>
    <div class="exp-btns">
      <button class="btn btn-ghost" onclick={downloadBackup}>{t('exportJson')}</button>
      <button class="btn btn-ghost" onclick={() => fileInput?.click()}>{t('importJson')}</button>
      <input type="file" accept="application/json" bind:this={fileInput} onchange={onImportFile} hidden />
    </div>
  </div>

  <div class="card sec">
    <p class="label-caps head">{t('cloudBackup')}</p>
    {#if cloud.enabled}
      <p class="cloud-status" class:err={cloud.status === 'error'}>
        {#if cloud.status === 'saving'}{t('backupSaving')}
        {:else if cloud.status === 'offline'}{t('backupOffline')}
        {:else if cloud.status === 'error'}{t('backupError')}: {cloud.error}
        {:else}{t('lastBackup')}: {cloud.lastBackup ? new Date(cloud.lastBackup).toLocaleString() : t('neverBackedUp')}{/if}
      </p>
      <div class="exp-btns">
        <button class="btn btn-ghost" disabled={cloudBusy} onclick={() => backupNow()}>{t('backupNow')}</button>
        <button class="btn btn-ghost" disabled={cloudBusy} onclick={doRestore}>{t('restoreCloud')}</button>
        <button class="btn btn-ghost" disabled={cloudBusy} onclick={disconnect}>{t('disconnect')}</button>
      </div>
    {:else}
      <p class="cloud-info">{t('cloudInfo')}</p>
      <div class="field">
        <label for="cb-token">{t('cloudToken')}</label>
        <input
          id="cb-token" type="password" bind:value={tokenInput}
          placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"
        />
      </div>
      <button class="btn btn-accent" disabled={!tokenInput.trim() || cloudBusy} onclick={doConnect}>{t('connect')}</button>
    {/if}
    {#if cloudMsg}<p class="cloud-msg">{cloudMsg}</p>{/if}
  </div>

  <div class="card sec danger">
    <p class="label-caps head">{t('dangerZone')}</p>
    <button class="btn btn-danger" onclick={erase}>{t('eraseAll')}</button>
  </div>

  <p class="about">Timetrack 1.0 · local-first · built for freelancers</p>
</div>

<style>
  .sec { padding: 16px; margin-bottom: 12px; }
  .head { margin: 0 0 14px; }

  .seg {
    display: flex;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 3px;
    margin-bottom: 16px;
  }
  .seg button {
    flex: 1;
    padding: 8px 0;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
    transition: all 0.18s var(--ease);
  }
  .seg button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
  }
  .row label { flex-shrink: 0; }
  .row select, .row input[type='number'] { width: 130px; }

  .switch {
    appearance: none;
    -webkit-appearance: none;
    width: 46px; height: 28px;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    position: relative;
    transition: background 0.2s;
    padding: 0;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px; left: 2px;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s var(--ease);
  }
  .switch:checked { background: var(--accent); border-color: var(--accent); }
  .switch:checked::after { transform: translateX(18px); }

  .exp-btns { display: flex; gap: 10px; flex-wrap: wrap; }
  .cloud-info, .cloud-status, .cloud-msg { font-size: 13.5px; color: var(--text-2); margin: 0 0 14px; }
  .cloud-msg { margin: 12px 0 0; }
  .cloud-status.err { color: var(--danger); }
  .field { margin-bottom: 14px; }
  .danger { border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); }
  .about { text-align: center; color: var(--text-3); font-size: 12.5px; margin-top: 20px; }
</style>
