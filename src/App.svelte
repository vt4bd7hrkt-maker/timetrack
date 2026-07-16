<script>
  import { onMount } from 'svelte';
  import { init, data, settings } from './lib/store.svelte.js';
  import { initCloudBackup } from './lib/cloudbackup.svelte.js';
  import { initAuth, auth } from './lib/cloud/auth.svelte';
  import { initSync } from './lib/cloud/sync.svelte';
  import { route } from './lib/router.svelte.js';
  import AccountSheet from './components/AccountSheet.svelte';
  import ImportOfferSheet from './components/ImportOfferSheet.svelte';
  import TabBar from './components/TabBar.svelte';
  import Home from './views/Home.svelte';
  import Projects from './views/Projects.svelte';
  import Stats from './views/Stats.svelte';
  import Calendar from './views/Calendar.svelte';
  import Settings from './views/Settings.svelte';
  import ProjectDetail from './views/ProjectDetail.svelte';

  onMount(init);
  initCloudBackup();
  initAuth();
  initSync();

  // Apply the theme whenever the setting changes.
  $effect(() => {
    document.documentElement.dataset.theme = settings.theme || 'system';
  });
</script>

{#if data.ready}
  <main>
    {#if route.name === 'home'}
      <Home />
    {:else if route.name === 'projects'}
      <Projects />
    {:else if route.name === 'stats'}
      <Stats />
    {:else if route.name === 'calendar'}
      <Calendar />
    {:else if route.name === 'settings'}
      <Settings />
    {:else if route.name === 'project'}
      <ProjectDetail id={route.params.id} />
    {/if}
  </main>
  <TabBar />
  <!-- shown app-wide: password-recovery link landing + first-login import -->
  {#if auth.recovery}
    <AccountSheet open={true} />
  {/if}
  <ImportOfferSheet />
{/if}
