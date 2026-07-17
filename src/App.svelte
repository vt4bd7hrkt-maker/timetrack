<script>
  import { onMount } from 'svelte';
  import { init, data, settings } from './lib/store.svelte.js';
  import { initCloudBackup } from './lib/cloudbackup.svelte.js';
  import { initAuth, auth } from './lib/cloud/auth.svelte';
  import { initSync } from './lib/cloud/sync.svelte';
  import { cloudConfigured } from './lib/cloud/supabase';
  import { route } from './lib/router.svelte.js';
  import Welcome from './views/Welcome.svelte';
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

  /* Brand-new visitors (cloud on, signed out, empty device) land on the
     sign-up screen; everyone else goes straight into the app. */
  let welcomeSkipped = $state(
    typeof localStorage !== 'undefined' && localStorage.getItem('tt.welcomeSkipped') === '1'
  );
  const showWelcome = $derived(
    cloudConfigured && auth.ready && !auth.user && !auth.recovery &&
    data.projects.length === 0 && data.entries.length === 0 && !welcomeSkipped
  );
  function skipWelcome() {
    localStorage.setItem('tt.welcomeSkipped', '1');
    welcomeSkipped = true;
  }
</script>

{#if data.ready && showWelcome}
  <Welcome onskip={skipWelcome} />
{:else if data.ready}
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
