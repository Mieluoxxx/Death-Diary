import { defineConfig } from "vite";
import { frameAtlasPlugin } from "./frameAtlasPlugin.mjs";

export default defineConfig({
    base: "./",
    plugins: [frameAtlasPlugin()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ["phaser"],
                },
            },
        },
    },
    server: {
        port: 8080,
    },
});
