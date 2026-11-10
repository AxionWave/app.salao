import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd());
    // Sem token não há upload; nesse caso o build de produção não gera mapas (não podem ir para o nginx).
    const enviaSourceMaps = mode === 'production' && !!process.env.SENTRY_AUTH_TOKEN;
    return {
        base: env.VITE_BASE_PATH || '/',
        plugins: [
            react(),
            enviaSourceMaps &&
                sentryVitePlugin({
                    org: 'lumen-6u',
                    project: 'lyra-web',
                    authToken: process.env.SENTRY_AUTH_TOKEN,
                    release: { name: env.VITE_SENTRY_RELEASE },
                    sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
                }),
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@core': path.resolve(__dirname, './src/@core'),
            },
        },
        server: {
            port: Number(env.VITE_APP_PORT) || 3002,
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: mode !== 'production' ? true : enviaSourceMaps ? 'hidden' : false,
        },
    };
});
