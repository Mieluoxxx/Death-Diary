import { createApp } from './app';
import { StorageDatabase } from './db';

const database = new StorageDatabase();
const port = Number(Bun.env.PORT ?? 3001);
const hostname = Bun.env.HOST ?? '0.0.0.0';
const allowedOrigins = (Bun.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const staticRoot = Bun.env.SERVE_STATIC === 'false' ? undefined : (Bun.env.STATIC_ROOT ?? 'dist');
const app = createApp({
    database,
    allowedOrigins,
    secureCookies: Bun.env.NODE_ENV === 'production',
    staticRoot,
});

const server = Bun.serve({
    hostname,
    port,
    fetch: app.fetch,
});

console.log(`Death-Diary storage listening on ${server.url}`);
console.log(`SQLite: ${database.path}`);

let shuttingDown = false;

async function shutdown(): Promise<void> {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    await server.stop(true);
    database.close();
    process.exitCode = 0;
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
