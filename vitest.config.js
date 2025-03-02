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
    globalSetup: [],
    define: {'process.env.NODE_ENV': '"test"'}
})