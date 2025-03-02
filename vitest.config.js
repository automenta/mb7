import {defineConfig} from 'vite'
import {configDefaults} from 'vitest/config'

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
    },
    globalSetup: ['./test/vitest-global-setup.js'],
})