import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages: https://redsky19785388-web.github.io/book-summary-app/
  base: '/book-summary-app/',
  plugins: [react()],
  server: {
    proxy: {
      '/binance': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/binance/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
