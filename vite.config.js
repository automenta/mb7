import {defineConfig} from 'vite';
//import basicSSL from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [
        //basicSSL()
    ],
    server: {
        https: false,
        open: true,
        mimeTypes: {
            'js': 'application/javascript'
        }
    }
});