import { afterEach, describe, expect, test } from 'bun:test';
import { createApp, type DeathDiaryApp } from './app';
import { StorageDatabase } from './db';
import type { InitialItemsConfig } from './initialItems';

const databases: StorageDatabase[] = [];

function createTestApp(initialItems?: InitialItemsConfig) {
    const database = new StorageDatabase(':memory:');
    databases.push(database);
    return createApp({
        database,
        secureCookies: false,
        initialItems,
        initialItemsLoaded: initialItems !== undefined,
    });
}

async function authenticate(app: DeathDiaryApp): Promise<string> {
    const response = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'TestPlayer', password: 'correct-horse-123' }),
    });
    expect(response.status).toBe(201);
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    expect(cookie).toBeTruthy();
    return cookie!;
}

async function putJson(
    app: DeathDiaryApp,
    path: string,
    cookie: string,
    body: unknown,
): Promise<Response> {
    return app.request(path, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
        },
        body: JSON.stringify(body),
    });
}

afterEach(() => {
    while (databases.length > 0) {
        databases.pop()!.close();
    }
});

describe('storage API', () => {
    test('serves the validated initial item configuration without authentication', async () => {
        const initialItems: InitialItemsConfig = {
            version: 1,
            storage: { 1101011: 5 },
            bag: { 1302043: 1 },
        };
        const app = createTestApp(initialItems);

        const response = await app.request('/api/v1/config/initial-items');
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(initialItems);
        expect(response.headers.get('cache-control')).toBe('no-store');

        const health = await app.request('/api/health');
        expect(await health.json()).toMatchObject({ initialItemsLoaded: true });
    });

    test('registers an account and logs in with normalized username', async () => {
        const app = createTestApp();
        const cookie = await authenticate(app);

        const me = await app.request('/api/v1/me', { headers: { Cookie: cookie } });
        expect(me.status).toBe(200);
        const identity = (await me.json()) as { userId: string; username: string; kind: string };
        expect(identity.userId).toHaveLength(36);
        expect(identity).toMatchObject({ username: 'TestPlayer', kind: 'account' });

        const login = await app.request('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'testplayer', password: 'correct-horse-123' }),
        });
        expect(login.status).toBe(200);
        expect(login.headers.get('set-cookie')).toContain('death_diary_session=');

        const rejected = await app.request('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'testplayer', password: 'wrong-password' }),
        });
        expect(rejected.status).toBe(401);
    });

    test('stores saves and rejects stale revisions', async () => {
        const app = createTestApp();
        const cookie = await authenticate(app);

        const missing = await app.request('/api/v1/saves/0', { headers: { Cookie: cookie } });
        expect(missing.status).toBe(404);

        const created = await putJson(app, '/api/v1/saves/0', cookie, {
            expectedRevision: 0,
            schemaVersion: 1,
            clientBuild: '1.1.0',
            state: { session: { role: 'STRANGER', gameTime: 0 } },
        });
        expect(created.status).toBe(200);
        expect((await created.json()) as { revision: number }).toMatchObject({ revision: 1 });

        const updated = await putJson(app, '/api/v1/saves/0', cookie, {
            expectedRevision: 1,
            schemaVersion: 1,
            clientBuild: '1.1.0',
            state: { session: { role: 'STRANGER', gameTime: 60 } },
        });
        expect(updated.status).toBe(200);
        expect((await updated.json()) as { revision: number }).toMatchObject({ revision: 2 });

        const stale = await putJson(app, '/api/v1/saves/0', cookie, {
            expectedRevision: 1,
            schemaVersion: 1,
            clientBuild: '1.1.0',
            state: { session: { role: 'STRANGER', gameTime: 120 } },
        });
        expect(stale.status).toBe(409);
        const conflict = (await stale.json()) as { current: { revision: number } };
        expect(conflict.current.revision).toBe(2);

        const fetched = await app.request('/api/v1/saves/0', { headers: { Cookie: cookie } });
        expect(fetched.status).toBe(200);
        const save = (await fetched.json()) as {
            revision: number;
            state: { session: { gameTime: number } };
        };
        expect(save.revision).toBe(2);
        expect(save.state.session.gameTime).toBe(60);
    });

    test('validates save payloads and origins', async () => {
        const app = createTestApp();
        const cookie = await authenticate(app);

        const invalid = await putJson(app, '/api/v1/saves/0', cookie, {
            expectedRevision: 0,
            schemaVersion: 2,
            clientBuild: '1.1.0',
            state: {},
        });
        expect(invalid.status).toBe(422);
        expect(await invalid.json()).toEqual({
            error: {
                code: 'unsupported_schema_version',
                message: '当前服务仅支持 schemaVersion=1。',
            },
        });

        const malformed = await putJson(app, '/api/v1/saves/0', cookie, {
            expectedRevision: 0,
            schemaVersion: 1,
            clientBuild: '1.1.0',
            state: {},
        });
        expect(malformed.status).toBe(422);
        expect(await malformed.json()).toEqual({
            error: {
                code: 'invalid_save',
                message: '存档必须包含对象类型的 state。',
            },
        });

        const forbidden = await app.request('/api/v1/saves/0', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
                Origin: 'https://attacker.example',
            },
            body: JSON.stringify({
                expectedRevision: 0,
                schemaVersion: 1,
                clientBuild: '1.1.0',
                state: {},
            }),
        });
        expect(forbidden.status).toBe(403);
    });

    test('stores account-level medal progress independently', async () => {
        const app = createTestApp();
        const cookie = await authenticate(app);

        const created = await putJson(app, '/api/v1/progress', cookie, {
            expectedRevision: 0,
            schemaVersion: 1,
            medals: { '101': { aimCompleted: 3, completed: 0 } },
        });
        expect(created.status).toBe(200);

        const fetched = await app.request('/api/v1/progress', { headers: { Cookie: cookie } });
        expect(fetched.status).toBe(200);
        const progress = (await fetched.json()) as {
            revision: number;
            medals: Record<string, { aimCompleted: number }>;
        };
        expect(progress.revision).toBe(1);
        expect(progress.medals['101']?.aimCompleted).toBe(3);
    });
});
