export type Migration = {
    version: number;
    sql: string;
};

export const MIGRATIONS: readonly Migration[] = [
    {
        version: 1,
        sql: `
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'active',
                created_at INTEGER NOT NULL,
                last_seen_at INTEGER NOT NULL
            ) STRICT;

            CREATE TABLE auth_identities (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                provider TEXT NOT NULL,
                provider_subject TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(provider, provider_subject)
            ) STRICT;

            CREATE TABLE auth_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                last_seen_at INTEGER NOT NULL
            ) STRICT;

            CREATE INDEX auth_sessions_user_id ON auth_sessions(user_id);
            CREATE INDEX auth_sessions_expires_at ON auth_sessions(expires_at);

            CREATE TABLE game_saves (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 9),
                schema_version INTEGER NOT NULL CHECK(schema_version > 0),
                revision INTEGER NOT NULL CHECK(revision > 0),
                client_build TEXT NOT NULL,
                state_json TEXT NOT NULL CHECK(json_valid(state_json)),
                state_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY(user_id, slot)
            ) STRICT;

            CREATE TABLE save_backups (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                slot INTEGER NOT NULL,
                revision INTEGER NOT NULL,
                schema_version INTEGER NOT NULL,
                client_build TEXT NOT NULL,
                state_json TEXT NOT NULL CHECK(json_valid(state_json)),
                state_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY(user_id, slot, revision)
            ) STRICT;

            CREATE TABLE user_progress (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                schema_version INTEGER NOT NULL CHECK(schema_version > 0),
                revision INTEGER NOT NULL CHECK(revision > 0),
                medals_json TEXT NOT NULL CHECK(json_valid(medals_json)),
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            ) STRICT;

            CREATE TABLE entitlements (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                product_id TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 0),
                source TEXT NOT NULL,
                receipt_id TEXT UNIQUE,
                granted_at INTEGER NOT NULL,
                PRIMARY KEY(user_id, product_id)
            ) STRICT;
        `,
    },
];
