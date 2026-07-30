import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import type { AuthenticatedUser, SaveRecord, StorageDatabase } from './db';

const AUTH_COOKIE = 'death_diary_session';
const AUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_JSON_BYTES = 512 * 1024;
const MAX_CLIENT_BUILD_LENGTH = 64;
const SAVE_SCHEMA_VERSION = 1;

type Variables = {
    authenticatedUser: AuthenticatedUser;
};

type AppEnvironment = {
    Variables: Variables;
};

export type AppOptions = {
    database: StorageDatabase;
    secureCookies?: boolean;
    allowedOrigins?: readonly string[];
    staticRoot?: string;
};

class ApiError extends Error {
    constructor(
        readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422,
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

function errorBody(code: string, message: string): { error: { code: string; message: string } } {
    return { error: { code, message } };
}

function hashToken(token: string): string {
    return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

function randomToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
}

function hashJson(json: string): string {
    return new Bun.CryptoHasher('sha256').update(json).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonBody(context: {
    req: { header(name: string): string | undefined; text(): Promise<string> };
}): Promise<unknown> {
    const contentLength = Number(context.req.header('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
        throw new ApiError(413, 'payload_too_large', '请求内容超过 512 KiB 限制。');
    }
    const text = await context.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
        throw new ApiError(413, 'payload_too_large', '请求内容超过 512 KiB 限制。');
    }
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw new ApiError(422, 'invalid_json', '请求内容不是有效 JSON。');
    }
}

function parseSlot(value: string): number {
    const slot = Number(value);
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) {
        throw new ApiError(422, 'invalid_slot', '存档槽必须是 0 到 9 之间的整数。');
    }
    return slot;
}

function parseExpectedRevision(value: unknown): number {
    if (!Number.isInteger(value) || (value as number) < 0) {
        throw new ApiError(422, 'invalid_revision', 'expectedRevision 必须是非负整数。');
    }
    return value as number;
}

function parseSchemaVersion(value: unknown): number {
    if (!Number.isInteger(value) || (value as number) !== SAVE_SCHEMA_VERSION) {
        throw new ApiError(
            422,
            'unsupported_schema_version',
            `当前服务仅支持 schemaVersion=${SAVE_SCHEMA_VERSION}。`,
        );
    }
    return value as number;
}

function parseClientBuild(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_CLIENT_BUILD_LENGTH) {
        throw new ApiError(422, 'invalid_client_build', 'clientBuild 必须是 1 到 64 字符。');
    }
    return value;
}

function presentSave(save: SaveRecord): Omit<SaveRecord, 'stateHash'> {
    return {
        slot: save.slot,
        schemaVersion: save.schemaVersion,
        revision: save.revision,
        clientBuild: save.clientBuild,
        state: save.state,
        createdAt: save.createdAt,
        updatedAt: save.updatedAt,
    };
}

export function createApp(options: AppOptions): Hono<AppEnvironment> {
    const app = new Hono<AppEnvironment>();
    const secureCookies = options.secureCookies ?? Bun.env.NODE_ENV === 'production';
    const allowedOrigins = new Set(options.allowedOrigins ?? []);

    app.use('/api/*', secureHeaders());
    app.use('/api/*', async (context, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) {
            const origin = context.req.header('origin');
            const ownOrigin = new URL(context.req.url).origin;
            if (origin && origin !== ownOrigin && !allowedOrigins.has(origin)) {
                return context.json(errorBody('origin_forbidden', '请求来源不受信任。'), 403);
            }
        }
        await next();
    });

    const requireAuth = createMiddleware<AppEnvironment>(async (context, next) => {
        const token = getCookie(context, AUTH_COOKIE);
        if (!token) {
            return context.json(errorBody('unauthorized', '需要登录。'), 401);
        }
        const authenticatedUser = options.database.findAuthenticatedUser(hashToken(token));
        if (!authenticatedUser) {
            deleteCookie(context, AUTH_COOKIE, { path: '/' });
            return context.json(errorBody('unauthorized', '登录已失效。'), 401);
        }
        options.database.touchAuthenticatedUser(authenticatedUser);
        context.set('authenticatedUser', authenticatedUser);
        await next();
    });

    app.get('/api/health', (context) =>
        context.json({ ok: true, service: 'death-diary-storage', schemaVersion: 1 }),
    );

    app.post('/api/v1/auth/guest', async (context) => {
        const existingToken = getCookie(context, AUTH_COOKIE);
        if (existingToken) {
            const existing = options.database.findAuthenticatedUser(hashToken(existingToken));
            if (existing) {
                options.database.touchAuthenticatedUser(existing);
                return context.json({ userId: existing.userId, kind: 'guest' as const });
            }
        }

        const token = randomToken();
        const expiresAt = Date.now() + AUTH_MAX_AGE_SECONDS * 1000;
        const created = options.database.createGuestSession(hashToken(token), expiresAt);
        setCookie(context, AUTH_COOKIE, token, {
            httpOnly: true,
            secure: secureCookies,
            sameSite: 'Lax',
            path: '/',
            maxAge: AUTH_MAX_AGE_SECONDS,
        });
        return context.json({ userId: created.userId, kind: 'guest' as const }, 201);
    });

    app.use('/api/v1/me', requireAuth);
    app.get('/api/v1/me', (context) => {
        const user = context.get('authenticatedUser');
        return context.json({ userId: user.userId, kind: 'guest' as const });
    });

    app.use('/api/v1/logout', requireAuth);
    app.post('/api/v1/logout', (context) => {
        const user = context.get('authenticatedUser');
        options.database.revokeAuthSession(user.authSessionId);
        deleteCookie(context, AUTH_COOKIE, { path: '/' });
        return context.json({ ok: true });
    });

    app.use('/api/v1/saves/*', requireAuth);
    app.get('/api/v1/saves/:slot', (context) => {
        const user = context.get('authenticatedUser');
        const slot = parseSlot(context.req.param('slot'));
        const save = options.database.getSave(user.userId, slot);
        if (!save) {
            return context.json(errorBody('save_not_found', '云端存档不存在。'), 404);
        }
        context.header('Cache-Control', 'no-store');
        context.header('ETag', `"${save.revision}"`);
        return context.json(presentSave(save));
    });

    app.put('/api/v1/saves/:slot', async (context) => {
        const user = context.get('authenticatedUser');
        const slot = parseSlot(context.req.param('slot'));
        const body = await readJsonBody(context);
        if (!isRecord(body) || !isRecord(body.state)) {
            throw new ApiError(422, 'invalid_save', '存档必须包含对象类型的 state。');
        }
        const expectedRevision = parseExpectedRevision(body.expectedRevision);
        const schemaVersion = parseSchemaVersion(body.schemaVersion);
        const clientBuild = parseClientBuild(body.clientBuild);
        const stateJson = JSON.stringify(body.state);
        const result = options.database.putSave({
            userId: user.userId,
            slot,
            expectedRevision,
            schemaVersion,
            clientBuild,
            stateJson,
            stateHash: hashJson(stateJson),
        });

        if (!result.ok) {
            if (result.reason === 'conflict') {
                return context.json(
                    {
                        ...errorBody('revision_conflict', '云端存档已被其他客户端更新。'),
                        current: presentSave(result.current),
                    },
                    409,
                );
            }
            return context.json(errorBody('save_not_found', '云端存档不存在。'), 404);
        }
        context.header('ETag', `"${result.value.revision}"`);
        return context.json(presentSave(result.value));
    });

    app.delete('/api/v1/saves/:slot', (context) => {
        const user = context.get('authenticatedUser');
        const slot = parseSlot(context.req.param('slot'));
        const match = context.req.header('if-match')?.replaceAll('"', '');
        const expectedRevision = parseExpectedRevision(match ? Number(match) : Number.NaN);
        const result = options.database.deleteSave(user.userId, slot, expectedRevision);
        if (!result.ok) {
            if (result.reason === 'conflict') {
                return context.json(
                    {
                        ...errorBody('revision_conflict', '云端存档已被其他客户端更新。'),
                        current: presentSave(result.current),
                    },
                    409,
                );
            }
            return context.json(errorBody('save_not_found', '云端存档不存在。'), 404);
        }
        return context.json({ ok: true, deletedRevision: result.value.revision });
    });

    app.use('/api/v1/progress', requireAuth);
    app.get('/api/v1/progress', (context) => {
        const user = context.get('authenticatedUser');
        const progress = options.database.getProgress(user.userId);
        if (!progress) {
            return context.json(errorBody('progress_not_found', '云端进度不存在。'), 404);
        }
        context.header('Cache-Control', 'no-store');
        context.header('ETag', `"${progress.revision}"`);
        return context.json(progress);
    });

    app.put('/api/v1/progress', async (context) => {
        const user = context.get('authenticatedUser');
        const body = await readJsonBody(context);
        if (!isRecord(body) || !isRecord(body.medals)) {
            throw new ApiError(422, 'invalid_progress', '进度必须包含对象类型的 medals。');
        }
        const result = options.database.putProgress({
            userId: user.userId,
            expectedRevision: parseExpectedRevision(body.expectedRevision),
            schemaVersion: parseSchemaVersion(body.schemaVersion),
            medalsJson: JSON.stringify(body.medals),
        });
        if (!result.ok) {
            if (result.reason === 'conflict') {
                return context.json(
                    {
                        ...errorBody('revision_conflict', '云端进度已被其他客户端更新。'),
                        current: result.current,
                    },
                    409,
                );
            }
            return context.json(errorBody('progress_not_found', '云端进度不存在。'), 404);
        }
        context.header('ETag', `"${result.value.revision}"`);
        return context.json(result.value);
    });

    if (options.staticRoot) {
        app.use('/*', serveStatic({ root: options.staticRoot }));
        app.get('*', async (context) => {
            if (context.req.path.startsWith('/api/')) {
                return context.json(errorBody('not_found', '接口不存在。'), 404);
            }
            const indexFile = Bun.file(`${options.staticRoot}/index.html`);
            if (!(await indexFile.exists())) {
                return context.text('Web build not found.', 404);
            }
            return new Response(indexFile);
        });
    }

    app.notFound((context) => context.json(errorBody('not_found', '接口不存在。'), 404));
    app.onError((error, context) => {
        if (error instanceof ApiError) {
            return context.json(errorBody(error.code, error.message), error.status);
        }
        console.error(error);
        return context.json(errorBody('internal_error', '服务器内部错误。'), 500);
    });

    return app;
}
