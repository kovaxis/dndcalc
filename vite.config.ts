import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { plugin as mdPlugin, Mode } from 'vite-plugin-markdown'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), mdPlugin({ mode: [Mode.HTML] })],
  base: process.env.BASE,
})
