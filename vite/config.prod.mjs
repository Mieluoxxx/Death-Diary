import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { frameAtlasPlugin } from './frameAtlasPlugin.mjs';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = '---------------------------------------------------------';
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);

            process.stdout.write(`✨ Done ✨\n`);
        },
    };
};

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                },
            },
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2,
            },
            mangle: true,
            format: {
                comments: false,
            },
        },
    },
    server: {
        port: 8080,
    },
    plugins: [
        frameAtlasPlugin(),
        phasermsg(),
        VitePWA({
            strategies: 'generateSW',
            injectRegister: 'script-defer',
            manifest: false,
            workbox: {
                globPatterns: [
                    '**/*.{html,js,css,json,png,jpg,jpeg,webp,avif,svg,mp3,ogg,wav,ttf,woff,woff2,wasm}',
                ],
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                cleanupOutdatedCaches: true,
                navigateFallback: 'index.html',
            },
        }),
    ],
});
