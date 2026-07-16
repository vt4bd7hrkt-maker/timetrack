<script lang="ts">
  /** First-login question: bring existing local data into the cloud account? */
  import BottomSheet from './BottomSheet.svelte';
  import { sync, acceptImport, declineImport } from '../lib/cloud/sync.svelte';
  import { t } from '../lib/i18n.svelte.js';

  let busy = $state(false);

  async function choose(yes: boolean) {
    busy = true;
    await (yes ? acceptImport() : declineImport());
    busy = false;
  }
</script>

<BottomSheet open={sync.importOffer !== null} title={t('importLocalTitle')} onclose={() => {}}>
  {#if sync.importOffer}
    <p class="txt">
      {t('importLocalText')
        .replace('{p}', String(sync.importOffer.projects))
        .replace('{e}', String(sync.importOffer.entries))}
    </p>
    <div class="opts">
      <button class="btn btn-accent" disabled={busy} onclick={() => choose(true)}>{t('importLocalYes')}</button>
      <button class="btn btn-ghost" disabled={busy} onclick={() => choose(false)}>{t('importLocalNo')}</button>
    </div>
  {/if}
</BottomSheet>

<style>
  .txt { color: var(--text-2); font-size: 14.5px; margin: 0 0 16px; }
  .opts { display: flex; flex-direction: column; gap: 10px; }
</style>
