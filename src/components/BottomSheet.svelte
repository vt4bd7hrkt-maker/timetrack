<script>
  import { fly, fade } from 'svelte/transition';

  /** @type {{ open?: boolean, title?: string, onclose?: () => void, children?: import('svelte').Snippet }} */
  let { open = false, title = '', onclose, children } = $props();
</script>

{#if open}
  <div class="backdrop" transition:fade={{ duration: 160 }} onclick={onclose} role="presentation"></div>
  <div class="sheet" transition:fly={{ y: 320, duration: 280, opacity: 1 }} role="dialog" aria-modal="true">
    <div class="grabber"></div>
    {#if title}<h3>{title}</h3>{/if}
    {@render children?.()}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 12, 14, 0.44);
    z-index: 90;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 91;
    background: var(--surface);
    border-radius: 22px 22px 0 0;
    padding: 10px 20px calc(20px + var(--safe-bottom));
    box-shadow: var(--shadow-lg);
    max-width: 640px;
    margin: 0 auto;
    max-height: 86vh;
    overflow-y: auto;
  }
  .grabber {
    width: 38px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 4px auto 14px;
  }
  h3 { font-size: 18px; margin-bottom: 14px; }
</style>
