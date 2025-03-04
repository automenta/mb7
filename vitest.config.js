import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    test: {
        environment: 'jsdom',
        exclude: [...configDefaults.exclude],
        browser: {
            enabled: true,
            headless: true,
            provider: 'puppeteer',
            launchOptions: {
                args: ['--no-sandbox']
            }
        },
        mockReset: true,
        setupFiles: ['./test/vitest-global-setup.js'],
        define: { 'process.env.NODE_ENV': '"test"' },
        deps: {
            inline: [/yjs/, /js-sha256/],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './')
        }
    },
    globalSetup: [],
})
