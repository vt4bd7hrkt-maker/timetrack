import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './' so the built app works from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: {
    target: 'es2019',
    cssCodeSplit: false
  }
});
