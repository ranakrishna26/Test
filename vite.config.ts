import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://<user>.github.io/<repo>/
// Must match the repository name. Change if you rename the repo.
const GITHUB_PAGES_BASE = '/Test/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
  server: {
    port: 5173,
    strictPort: false,
    /** Helps when `localhost` fails; terminal will also show a Network URL to try. */
    host: true,
  },
}))
