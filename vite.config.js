import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages project site: https://vavar.github.io/lego-sale-price/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/lego-sale-price/',
  publicDir: 'public',
})
