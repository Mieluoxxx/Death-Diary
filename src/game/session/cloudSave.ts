import type { SessionState } from './sessionStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const SAVE_SLOT = 0;
const SAVE_SCHEMA_VERSION = 1;
const CLIENT_BUILD = 'web-1.1.0';
const SYNC_DELAY_MS = 5_000;
const RETRY_DELAY_MS = 15_000;
const REQUEST_TIMEOUT_MS = 2_500;
const SYNC_META_KEY = 'death_diary_cloud_sync_v1';
const LOCAL_CONFLICT_BACKUP_KEY = 'death_diary_cloud_conflict_local_v1';
const REMOTE_CONFLICT_BACKUP_KEY = 'death_diary_cloud_conflict_remote_v1';

type CloudSaveAccess = {
    getLocalSession(): SessionState | null;
    applyRemoteSession(session: SessionState): void;
};

type GuestIdentity = {
    userId: string;
    kind: 'guest';
};

type CloudSaveResponse = {
    slot: number;
    schemaVersion: number;
    revision: number;
    clientBuild: string;
    state: { session: SessionState };
    createdAt: number;
    updatedAt: number;
};

type SyncMetadata = {
    userId: string;
    revision: number;
    lastSyncedHash: string;
    lastSyncedAt: number;
};

type CloudSaveStatus =
    | { state: 'synced'; revision: number }
    | { state: 'offline' }
    | { state: 'conflict'; localBackupKey: string; remoteBackupKey: string }
    | { state: 'restored_remote'; revision: number }
    | { state: 'invalid_remote' };

let access: CloudSaveAccess | null = null;
let identity: GuestIdentity | null = null;
let metadata: SyncMetadata | null = null;
let latestSession: SessionState | null = null;
let dirty = false;
let syncing = false;
let applyingRemote = false;
let initializationPromise: Promise<void> | null = null;
let lifecycleBound = false;
let flushTimer: number | null = null;
let blockedByConflict = false;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emitStatus(detail: CloudSaveStatus): void {
    window.dispatchEvent(new CustomEvent<CloudSaveStatus>('cloud-save-status', { detail }));
}

function loadMetadata(): SyncMetadata | null {
    try {
        const raw = localStorage.getItem(SYNC_META_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as unknown;
        if (
            !isRecord(parsed) ||
            typeof parsed.userId !== 'string' ||
            !Number.isInteger(parsed.revision) ||
            typeof parsed.lastSyncedHash !== 'string' ||
            typeof parsed.lastSyncedAt !== 'number'
        ) {
            return null;
        }
        return parsed as SyncMetadata;
    } catch {
        return null;
    }
}

function saveMetadata(next: SyncMetadata): void {
    metadata = next;
    try {
        localStorage.setItem(SYNC_META_KEY, JSON.stringify(next));
    } catch {
        // Cloud sync still works for this page lifetime when localStorage is unavailable.
    }
}

async function stateHash(session: SessionState): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify({ session }));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
    );
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    return fetch(`${API_BASE}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            ...init.headers,
        },
        signal: timeout,
    });
}

async function ensureGuestIdentity(): Promise<GuestIdentity> {
    if (identity) {
        return identity;
    }
    const response = await apiFetch('/api/v1/auth/guest', { method: 'POST' });
    if (!response.ok) {
        throw new Error(`Guest authentication failed: ${response.status}`);
    }
    const body = (await response.json()) as GuestIdentity;
    if (!body.userId) {
        throw new Error('Guest authentication returned no user id.');
    }
    identity = body;
    return body;
}

async function fetchRemoteSave(): Promise<CloudSaveResponse | null> {
    const response = await apiFetch(`/api/v1/saves/${SAVE_SLOT}`);
    if (response.status === 404) {
        return null;
    }
    if (response.status === 401) {
        identity = null;
        throw new Error('Cloud session expired.');
    }
    if (!response.ok) {
        throw new Error(`Cloud save read failed: ${response.status}`);
    }
    const body = (await response.json()) as unknown;
    if (
        !isRecord(body) ||
        !Number.isInteger(body.revision) ||
        !isRecord(body.state) ||
        !isRecord(body.state.session)
    ) {
        emitStatus({ state: 'invalid_remote' });
        throw new Error('Cloud save response has an invalid shape.');
    }
    return body as CloudSaveResponse;
}

async function uploadSession(
    session: SessionState,
    expectedRevision: number,
    keepalive = false,
): Promise<Response> {
    return apiFetch(`/api/v1/saves/${SAVE_SLOT}`, {
        method: 'PUT',
        keepalive,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            expectedRevision,
            schemaVersion: SAVE_SCHEMA_VERSION,
            clientBuild: CLIENT_BUILD,
            state: { session },
        }),
    });
}

function storeConflictBackup(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
    } catch {
        // The in-memory session remains untouched even if a backup cannot be written.
    }
}

async function acceptRemoteSave(remote: CloudSaveResponse, userId: string): Promise<void> {
    if (!access) {
        return;
    }
    applyingRemote = true;
    try {
        access.applyRemoteSession(remote.state.session);
        latestSession = remote.state.session;
    } finally {
        applyingRemote = false;
    }
    saveMetadata({
        userId,
        revision: remote.revision,
        lastSyncedHash: await stateHash(remote.state.session),
        lastSyncedAt: Date.now(),
    });
}

function scheduleFlush(delay = SYNC_DELAY_MS): void {
    if (flushTimer !== null || blockedByConflict) {
        return;
    }
    flushTimer = window.setTimeout(() => {
        flushTimer = null;
        void flushCloudSave();
    }, delay);
}

function bindLifecycle(): void {
    if (lifecycleBound) {
        return;
    }
    lifecycleBound = true;
    window.addEventListener('online', () => {
        if (dirty) {
            scheduleFlush(0);
        }
    });
    window.addEventListener('pagehide', () => {
        if (dirty) {
            void flushCloudSave(true);
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && dirty) {
            void flushCloudSave(true);
        }
    });
}

async function initializeCloudSaveOnce(nextAccess: CloudSaveAccess): Promise<void> {
    access = nextAccess;
    metadata = loadMetadata();
    latestSession = access.getLocalSession();
    bindLifecycle();

    try {
        const currentIdentity = await ensureGuestIdentity();
        const remote = await fetchRemoteSave();
        const local = latestSession;

        if (!remote) {
            if (local) {
                const response = await uploadSession(local, 0);
                if (!response.ok) {
                    throw new Error(`Initial cloud upload failed: ${response.status}`);
                }
                const created = (await response.json()) as CloudSaveResponse;
                saveMetadata({
                    userId: currentIdentity.userId,
                    revision: created.revision,
                    lastSyncedHash: await stateHash(local),
                    lastSyncedAt: Date.now(),
                });
                emitStatus({ state: 'synced', revision: created.revision });
            }
            return;
        }

        if (!local) {
            await acceptRemoteSave(remote, currentIdentity.userId);
            emitStatus({ state: 'restored_remote', revision: remote.revision });
            return;
        }

        const localHash = await stateHash(local);
        const currentMetadata = metadata;
        if (
            currentMetadata?.userId === currentIdentity.userId &&
            currentMetadata.revision === remote.revision
        ) {
            if (currentMetadata.lastSyncedHash === localHash) {
                saveMetadata({ ...currentMetadata, lastSyncedAt: Date.now() });
                return;
            }
            const response = await uploadSession(local, remote.revision);
            if (response.ok) {
                const updated = (await response.json()) as CloudSaveResponse;
                saveMetadata({
                    userId: currentIdentity.userId,
                    revision: updated.revision,
                    lastSyncedHash: localHash,
                    lastSyncedAt: Date.now(),
                });
                emitStatus({ state: 'synced', revision: updated.revision });
                return;
            }
        }

        if (
            currentMetadata?.userId === currentIdentity.userId &&
            currentMetadata.lastSyncedHash === localHash
        ) {
            await acceptRemoteSave(remote, currentIdentity.userId);
            emitStatus({ state: 'restored_remote', revision: remote.revision });
            return;
        }

        storeConflictBackup(LOCAL_CONFLICT_BACKUP_KEY, { session: local });
        await acceptRemoteSave(remote, currentIdentity.userId);
        emitStatus({ state: 'restored_remote', revision: remote.revision });
    } catch {
        emitStatus({ state: 'offline' });
        if (latestSession) {
            dirty = true;
            scheduleFlush(RETRY_DELAY_MS);
        }
    }
}

export function initializeCloudSave(nextAccess: CloudSaveAccess): Promise<void> {
    initializationPromise ??= initializeCloudSaveOnce(nextAccess);
    return initializationPromise;
}

/** Gate session-changing menu actions while the initial remote merge is unresolved. */
export function waitForCloudSaveInitialization(): Promise<void> {
    return initializationPromise ?? Promise.resolve();
}

export function scheduleCloudSave(session: SessionState): void {
    if (applyingRemote) {
        return;
    }
    latestSession = session;
    dirty = true;
    scheduleFlush();
}

export async function flushCloudSave(keepalive = false): Promise<void> {
    if (syncing || !dirty || blockedByConflict || !latestSession) {
        return;
    }
    syncing = true;
    const session = latestSession;
    dirty = false;

    try {
        const currentIdentity = await ensureGuestIdentity();
        const expectedRevision =
            metadata?.userId === currentIdentity.userId ? metadata.revision : 0;
        const response = await uploadSession(session, expectedRevision, keepalive);
        if (response.status === 401) {
            identity = null;
            throw new Error('Cloud session expired.');
        }
        if (response.status === 409) {
            const conflict = (await response.json()) as { current?: CloudSaveResponse };
            if (conflict.current) {
                storeConflictBackup(REMOTE_CONFLICT_BACKUP_KEY, conflict.current);
            }
            storeConflictBackup(LOCAL_CONFLICT_BACKUP_KEY, { session });
            blockedByConflict = true;
            emitStatus({
                state: 'conflict',
                localBackupKey: LOCAL_CONFLICT_BACKUP_KEY,
                remoteBackupKey: REMOTE_CONFLICT_BACKUP_KEY,
            });
            return;
        }
        if (!response.ok) {
            throw new Error(`Cloud save write failed: ${response.status}`);
        }
        const saved = (await response.json()) as CloudSaveResponse;
        saveMetadata({
            userId: currentIdentity.userId,
            revision: saved.revision,
            lastSyncedHash: await stateHash(session),
            lastSyncedAt: Date.now(),
        });
        emitStatus({ state: 'synced', revision: saved.revision });
    } catch {
        dirty = true;
        emitStatus({ state: 'offline' });
        scheduleFlush(RETRY_DELAY_MS);
    } finally {
        syncing = false;
        if (dirty && !blockedByConflict) {
            scheduleFlush();
        }
    }
}
