import { afterEach, describe, expect, test } from 'bun:test';
import { createApp } from './app';
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

async function authenticate(app: ReturnType<typeof createApp>): Promise<string> {
    const response = await app.request('/api/v1/auth/guest', { method: 'POST' });
    expect(response.status).toBe(201);
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    expect(cookie).toBeTruthy();
    return cookie!;
}

async function putJson(
    app: ReturnType<typeof createApp>,
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

    test('creates and reuses an anonymous authenticated session', async () => {
        const app = createTestApp();
        const cookie = await authenticate(app);

        const me = await app.request('/api/v1/me', { headers: { Cookie: cookie } });
        expect(me.status).toBe(200);
        const identity = (await me.json()) as { userId: string };
        expect(identity.userId).toHaveLength(36);

        const repeated = await app.request('/api/v1/auth/guest', {
            method: 'POST',
            headers: { Cookie: cookie },
        });
        expect(repeated.status).toBe(200);
        expect((await repeated.json()) as { userId: string }).toEqual(identity);
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
