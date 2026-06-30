import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vitePluginAppinfo from 'vite-plugin-build-info'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vitePluginAppinfo({
      enableGlobal: true,
    }),
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdf-parse')) {
            return 'pdf-lib';
          }
          if (id.includes('node_modules/vue')) {
            return 'vue-vendor';
          }
        }
      }
    }
  }
})
