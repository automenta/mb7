import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import path from 'path';

export default defineConfig({
  plugins: [],
  server: {
    https: false,
    open: true,
    mimeTypes: {
      'js': 'application/javascript'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/core': path.resolve(__dirname, './core'),
      '@/ui': path.resolve(__dirname, './ui'),
      '@/test': path.resolve(__dirname, './test'),
    }
  }
});
