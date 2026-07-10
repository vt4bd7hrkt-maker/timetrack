<script>
  import { route, go } from '../lib/router.svelte.js';
  import { t } from '../lib/i18n.svelte.js';

  const tabs = [
    { name: 'home', label: 'home', icon: 'M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8' },
    { name: 'projects', label: 'projects', icon: 'M4 7h16M4 12h16M4 17h10' },
    { name: 'stats', label: 'stats', icon: 'M5 20V12M12 20V6M19 20v-4' },
    { name: 'calendar', label: 'calendar', icon: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4' },
    { name: 'settings', label: 'settings', icon: 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8' }
  ];

  const current = $derived(route.name === 'project' ? 'projects' : route.name);
</script>

<nav>
  {#each tabs as tab (tab.name)}
    <button class:on={current === tab.name} onclick={() => go(tab.name)} aria-label={t(tab.label)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d={tab.icon} />
      </svg>
      <span>{t(tab.label)}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--tabbar-h) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    display: flex;
    background: color-mix(in srgb, var(--surface) 82%, transparent);
    -webkit-backdrop-filter: blur(18px);
    backdrop-filter: blur(18px);
    border-top: 1px solid var(--border);
    z-index: 50;
  }
  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--text-3);
    transition: color 0.15s var(--ease), transform 0.15s var(--ease);
  }
  button:active { transform: scale(0.92); }
  button.on { color: var(--text); }
  button.on svg { stroke: var(--accent); filter: drop-shadow(0 0 6px var(--accent-glow)); }
  svg { width: 23px; height: 23px; }
  span { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; }
</style>
