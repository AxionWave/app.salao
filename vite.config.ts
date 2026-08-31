import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd());
    return {
        base: env.VITE_BASE_PATH || '/',
        plugins: [react()],
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
            sourcemap: mode !== 'production',
        },
    };
});
