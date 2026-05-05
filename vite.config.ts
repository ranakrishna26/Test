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
    /**
     * Omit explicit `host: true` (0.0.0.0 / IPv4-only on many setups): on macOS,
     * `localhost` often resolves to ::1 first while the dev server is only on IPv4,
     * so http://localhost:5173/ fails with connection refused while 127.0.0.1 works.
     * Default host is loopback-friendly; use `npm run dev:lan` when you need LAN URLs.
     */
  },
}))
