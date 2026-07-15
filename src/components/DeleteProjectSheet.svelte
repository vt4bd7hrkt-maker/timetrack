<script>
  /** Confirmation sheet for permanent project deletion, with the choice to
   *  keep the tracked time (entries become "unassigned") or delete it too. */
  import BottomSheet from './BottomSheet.svelte';
  import { data, deleteProject } from '../lib/store.svelte.js';
  import { t } from '../lib/i18n.svelte.js';

  /** @type {{ project?: any, open?: boolean, onclose?: () => void, ondeleted?: () => void }} */
  let { project = null, open = false, onclose, ondeleted } = $props();

  const count = $derived(project ? data.entries.filter((e) => e.projectId === project.id).length : 0);

  async function del(deleteEntries) {
    if (deleteEntries && count > 0 && !confirm(t('deleteEntriesConfirm').replace('{n}', count))) return;
    await deleteProject(project.id, { deleteEntries });
    onclose?.();
    ondeleted?.();
  }
</script>

<BottomSheet {open} title={t('deleteProject')} {onclose}>
  {#if project}
    <p class="txt">
      {t('deleteProjectText').replace('{title}', project.title).replace('{n}', count)}
    </p>
    <div class="opts">
      {#if count > 0}
        <button class="btn btn-ghost" onclick={() => del(false)}>{t('deleteKeepEntries')}</button>
      {/if}
      <button class="btn solid-danger" onclick={() => del(true)}>{t('deleteWithEntries')}</button>
      <button class="btn btn-ghost" onclick={() => onclose?.()}>{t('cancel')}</button>
    </div>
  {/if}
</BottomSheet>

<style>
  .txt { color: var(--text-2); font-size: 14.5px; margin: 0 0 16px; }
  .opts { display: flex; flex-direction: column; gap: 10px; }
  .solid-danger { background: var(--danger); color: #fff; }
</style>
