import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MIGRATIONS } from './migrations';

export type AuthenticatedUser = {
    userId: string;
    authSessionId: string;
};

export type SaveRecord = {
    slot: number;
    schemaVersion: number;
    revision: number;
    clientBuild: string;
    state: unknown;
    stateHash: string;
    createdAt: number;
    updatedAt: number;
};

export type ProgressRecord = {
    schemaVersion: number;
    revision: number;
    medals: unknown;
    createdAt: number;
    updatedAt: number;
};

export type WriteResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: 'conflict'; current: T }
    | { ok: false; reason: 'not_found' };

type SaveRow = {
    slot: number;
    schema_version: number;
    revision: number;
    client_build: string;
    state_json: string;
    state_hash: string;
    created_at: number;
    updated_at: number;
};

type ProgressRow = {
    schema_version: number;
    revision: number;
    medals_json: string;
    created_at: number;
    updated_at: number;
};

const MAX_SAVE_BACKUPS = 5;

function asSaveRecord(row: SaveRow): SaveRecord {
    return {
        slot: row.slot,
        schemaVersion: row.schema_version,
        revision: row.revision,
        clientBuild: row.client_build,
        state: JSON.parse(row.state_json) as unknown,
        stateHash: row.state_hash,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function asProgressRecord(row: ProgressRow): ProgressRecord {
    return {
        schemaVersion: row.schema_version,
        revision: row.revision,
        medals: JSON.parse(row.medals_json) as unknown,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class StorageDatabase {
    readonly path: string;
    private readonly database: Database;

    constructor(path = Bun.env.DATABASE_PATH ?? 'data/death-diary.sqlite') {
        this.path = path === ':memory:' ? path : resolve(path);
        if (this.path !== ':memory:') {
            mkdirSync(dirname(this.path), { recursive: true });
        }

        this.database = new Database(this.path, { create: true, strict: true });
        this.database.exec('PRAGMA foreign_keys = ON;');
        this.database.exec('PRAGMA busy_timeout = 5000;');
        this.database.exec('PRAGMA synchronous = NORMAL;');
        if (this.path !== ':memory:') {
            this.database.exec('PRAGMA journal_mode = WAL;');
        }
        this.applyMigrations();
    }

    close(): void {
        this.database.close();
    }

    createGuestSession(tokenHash: string, expiresAt: number): AuthenticatedUser {
        const userId = crypto.randomUUID();
        const authSessionId = crypto.randomUUID();
        const now = Date.now();

        this.database.transaction(() => {
            this.database
                .query('INSERT INTO users (id, created_at, last_seen_at) VALUES (?, ?, ?)')
                .run(userId, now, now);
            this.database
                .query(
                    `INSERT INTO auth_sessions
                        (id, user_id, token_hash, created_at, expires_at, last_seen_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                )
                .run(authSessionId, userId, tokenHash, now, expiresAt, now);
        })();

        return { userId, authSessionId };
    }

    findAuthenticatedUser(tokenHash: string, now = Date.now()): AuthenticatedUser | null {
        const row = this.database
            .query(
                `SELECT auth_sessions.id AS auth_session_id, auth_sessions.user_id AS user_id
                 FROM auth_sessions
                 INNER JOIN users ON users.id = auth_sessions.user_id
                 WHERE auth_sessions.token_hash = ?
                   AND auth_sessions.expires_at > ?
                   AND users.status = 'active'`,
            )
            .get(tokenHash, now) as { auth_session_id: string; user_id: string } | null;

        if (!row) {
            return null;
        }
        return { userId: row.user_id, authSessionId: row.auth_session_id };
    }

    touchAuthenticatedUser(user: AuthenticatedUser, now = Date.now()): void {
        this.database.transaction(() => {
            this.database
                .query('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?')
                .run(now, user.authSessionId);
            this.database
                .query('UPDATE users SET last_seen_at = ? WHERE id = ?')
                .run(now, user.userId);
        })();
    }

    revokeAuthSession(authSessionId: string): void {
        this.database.query('DELETE FROM auth_sessions WHERE id = ?').run(authSessionId);
    }

    deleteExpiredAuthSessions(now = Date.now()): number {
        return this.database.query('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now)
            .changes;
    }

    getSave(userId: string, slot: number): SaveRecord | null {
        const row = this.database
            .query(
                `SELECT slot, schema_version, revision, client_build, state_json, state_hash,
                        created_at, updated_at
                 FROM game_saves
                 WHERE user_id = ? AND slot = ?`,
            )
            .get(userId, slot) as SaveRow | null;
        return row ? asSaveRecord(row) : null;
    }

    putSave(input: {
        userId: string;
        slot: number;
        expectedRevision: number;
        schemaVersion: number;
        clientBuild: string;
        stateJson: string;
        stateHash: string;
    }): WriteResult<SaveRecord> {
        return this.database.transaction(() => {
            const current = this.getSave(input.userId, input.slot);
            const now = Date.now();

            if (!current) {
                if (input.expectedRevision !== 0) {
                    return { ok: false, reason: 'not_found' } as const;
                }
                this.database
                    .query(
                        `INSERT INTO game_saves
                            (user_id, slot, schema_version, revision, client_build, state_json,
                             state_hash, created_at, updated_at)
                         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`,
                    )
                    .run(
                        input.userId,
                        input.slot,
                        input.schemaVersion,
                        input.clientBuild,
                        input.stateJson,
                        input.stateHash,
                        now,
                        now,
                    );
                return { ok: true, value: this.getSave(input.userId, input.slot)! } as const;
            }

            if (current.revision !== input.expectedRevision) {
                return { ok: false, reason: 'conflict', current } as const;
            }

            if (
                current.stateHash === input.stateHash &&
                current.schemaVersion === input.schemaVersion &&
                current.clientBuild === input.clientBuild
            ) {
                return { ok: true, value: current } as const;
            }

            this.backUpSave(input.userId, current);
            this.database
                .query(
                    `UPDATE game_saves
                     SET schema_version = ?, revision = revision + 1, client_build = ?,
                         state_json = ?, state_hash = ?, updated_at = ?
                     WHERE user_id = ? AND slot = ? AND revision = ?`,
                )
                .run(
                    input.schemaVersion,
                    input.clientBuild,
                    input.stateJson,
                    input.stateHash,
                    now,
                    input.userId,
                    input.slot,
                    input.expectedRevision,
                );
            this.trimSaveBackups(input.userId, input.slot);
            return { ok: true, value: this.getSave(input.userId, input.slot)! } as const;
        })();
    }

    deleteSave(userId: string, slot: number, expectedRevision: number): WriteResult<SaveRecord> {
        return this.database.transaction(() => {
            const current = this.getSave(userId, slot);
            if (!current) {
                return { ok: false, reason: 'not_found' } as const;
            }
            if (current.revision !== expectedRevision) {
                return { ok: false, reason: 'conflict', current } as const;
            }
            this.backUpSave(userId, current);
            this.database
                .query('DELETE FROM game_saves WHERE user_id = ? AND slot = ? AND revision = ?')
                .run(userId, slot, expectedRevision);
            this.trimSaveBackups(userId, slot);
            return { ok: true, value: current } as const;
        })();
    }

    getProgress(userId: string): ProgressRecord | null {
        const row = this.database
            .query(
                `SELECT schema_version, revision, medals_json, created_at, updated_at
                 FROM user_progress WHERE user_id = ?`,
            )
            .get(userId) as ProgressRow | null;
        return row ? asProgressRecord(row) : null;
    }

    putProgress(input: {
        userId: string;
        expectedRevision: number;
        schemaVersion: number;
        medalsJson: string;
    }): WriteResult<ProgressRecord> {
        return this.database.transaction(() => {
            const current = this.getProgress(input.userId);
            const now = Date.now();
            if (!current) {
                if (input.expectedRevision !== 0) {
                    return { ok: false, reason: 'not_found' } as const;
                }
                this.database
                    .query(
                        `INSERT INTO user_progress
                            (user_id, schema_version, revision, medals_json, created_at, updated_at)
                         VALUES (?, ?, 1, ?, ?, ?)`,
                    )
                    .run(input.userId, input.schemaVersion, input.medalsJson, now, now);
                return { ok: true, value: this.getProgress(input.userId)! } as const;
            }
            if (current.revision !== input.expectedRevision) {
                return { ok: false, reason: 'conflict', current } as const;
            }
            const currentJson = JSON.stringify(current.medals);
            if (currentJson === input.medalsJson && current.schemaVersion === input.schemaVersion) {
                return { ok: true, value: current } as const;
            }
            this.database
                .query(
                    `UPDATE user_progress
                     SET schema_version = ?, revision = revision + 1, medals_json = ?, updated_at = ?
                     WHERE user_id = ? AND revision = ?`,
                )
                .run(
                    input.schemaVersion,
                    input.medalsJson,
                    now,
                    input.userId,
                    input.expectedRevision,
                );
            return { ok: true, value: this.getProgress(input.userId)! } as const;
        })();
    }

    private backUpSave(userId: string, save: SaveRecord): void {
        this.database
            .query(
                `INSERT OR IGNORE INTO save_backups
                    (user_id, slot, revision, schema_version, client_build, state_json,
                     state_hash, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                userId,
                save.slot,
                save.revision,
                save.schemaVersion,
                save.clientBuild,
                JSON.stringify(save.state),
                save.stateHash,
                Date.now(),
            );
    }

    private trimSaveBackups(userId: string, slot: number): void {
        this.database
            .query(
                `DELETE FROM save_backups
                 WHERE user_id = ? AND slot = ? AND revision NOT IN (
                     SELECT revision FROM save_backups
                     WHERE user_id = ? AND slot = ?
                     ORDER BY created_at DESC, revision DESC
                     LIMIT ?
                 )`,
            )
            .run(userId, slot, userId, slot, MAX_SAVE_BACKUPS);
    }

    private applyMigrations(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            ) STRICT;
        `);
        const applied = new Set(
            (
                this.database.query('SELECT version FROM schema_migrations').all() as Array<{
                    version: number;
                }>
            ).map((row) => row.version),
        );

        for (const migration of MIGRATIONS) {
            if (applied.has(migration.version)) {
                continue;
            }
            this.database.transaction(() => {
                this.database.exec(migration.sql);
                this.database
                    .query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
                    .run(migration.version, Date.now());
            })();
        }
    }
}
