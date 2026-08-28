import { type AccountUser, getCurrentAccount } from './authStore';
import type { SessionState } from './sessionStore';
import { isRecord, parseCloudSaveEnvelope, SAVE_SCHEMA_VERSION } from '../../shared/saveContract';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const SAVE_SLOT = 0;
const CLIENT_BUILD = 'web-1.1.0';
const RETRY_DELAY_MS = 15_000;
const REQUEST_TIMEOUT_MS = 2_500;
const SYNC_META_KEY_PREFIX = 'death_diary_cloud_sync_v2:';
const LOCAL_CONFLICT_BACKUP_KEY_PREFIX = 'death_diary_cloud_conflict_local_v2:';
const REMOTE_CONFLICT_BACKUP_KEY_PREFIX = 'death_diary_cloud_conflict_remote_v2:';

type CloudSaveAccess = {
    getLocalSession(): SessionState | null;
    applyRemoteSession(session: SessionState): void;
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

export type CloudSaveSnapshot = {
    revision: number;
    updatedAt: number;
    session: SessionState;
};

export type CloudSaveConflict = {
    local: SessionState;
    remote: CloudSaveSnapshot;
};

type SyncMetadata = {
    userId: string;
    revision: number;
    lastSyncedHash: string;
    lastSyncedAt: number;
};

export type CloudSaveStatus =
    | { state: 'idle' }
    | { state: 'pending' }
    | { state: 'syncing' }
    | { state: 'synced'; revision: number }
    | { state: 'offline' }
    | { state: 'conflict'; localBackupKey: string; remoteBackupKey: string }
    | { state: 'restored_remote'; revision: number }
    | { state: 'invalid_remote' };

let access: CloudSaveAccess | null = null;
let metadata: SyncMetadata | null = null;
let latestSession: SessionState | null = null;
let dirty = false;
let syncing = false;
let applyingRemote = false;
let initializationPromise: Promise<void> | null = null;
let lifecycleBound = false;
let retryTimer: number | null = null;
let checkpointQueued = false;
let blockedByConflict = false;
let currentStatus: CloudSaveStatus = { state: 'idle' };
let pendingConflict: CloudSaveConflict | null = null;

function emitStatus(detail: CloudSaveStatus): void {
    currentStatus = detail;
    window.dispatchEvent(new CustomEvent<CloudSaveStatus>('cloud-save-status', { detail }));
}

export function getCloudSaveStatus(): CloudSaveStatus {
    return currentStatus;
}

export function getPendingCloudConflict(): CloudSaveConflict | null {
    return pendingConflict;
}

function loadMetadata(userId: string): SyncMetadata | null {
    try {
        const raw = localStorage.getItem(`${SYNC_META_KEY_PREFIX}${userId}`);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as unknown;
        if (
            !isRecord(parsed) ||
            parsed.userId !== userId ||
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
        localStorage.setItem(`${SYNC_META_KEY_PREFIX}${next.userId}`, JSON.stringify(next));
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

function requireAccountIdentity(): AccountUser {
    const account = getCurrentAccount();
    if (!account) {
        throw new Error('Account authentication is unavailable.');
    }
    return account;
}

async function fetchRemoteSave(): Promise<CloudSaveResponse | null> {
    const response = await apiFetch(`/api/v1/saves/${SAVE_SLOT}`);
    if (response.status === 404) {
        return null;
    }
    if (response.status === 401) {
        throw new Error('Cloud session expired.');
    }
    if (!response.ok) {
        throw new Error(`Cloud save read failed: ${response.status}`);
    }
    const body = (await response.json()) as unknown;
    const envelope = parseCloudSaveEnvelope<SessionState>(body);
    if (!isRecord(body) || !Number.isInteger(body.revision) || !envelope) {
        emitStatus({ state: 'invalid_remote' });
        throw new Error('Cloud save response has an invalid shape.');
    }
    return {
        ...body,
        schemaVersion: envelope.schemaVersion,
        state: envelope.state,
    } as CloudSaveResponse;
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

export async function inspectCloudSave(): Promise<CloudSaveSnapshot | null> {
    const remote = await fetchRemoteSave();
    return remote
        ? {
              revision: remote.revision,
              updatedAt: remote.updatedAt,
              session: remote.state.session,
          }
        : null;
}

export async function commitLocalSaveToAccount(
    account: AccountUser,
    session: SessionState,
    expectedRevision: number,
): Promise<CloudSaveSnapshot> {
    const response = await uploadSession(session, expectedRevision);
    if (!response.ok) {
        throw new Error(`Cloud save write failed: ${response.status}`);
    }
    const saved = (await response.json()) as CloudSaveResponse;
    latestSession = session;
    dirty = false;
    blockedByConflict = false;
    pendingConflict = null;
    saveMetadata({
        userId: account.userId,
        revision: saved.revision,
        lastSyncedHash: await stateHash(session),
        lastSyncedAt: Date.now(),
    });
    emitStatus({ state: 'synced', revision: saved.revision });
    return { revision: saved.revision, updatedAt: saved.updatedAt, session };
}

export async function adoptCloudSaveForAccount(
    account: AccountUser,
    remote: CloudSaveSnapshot,
): Promise<SessionState> {
    latestSession = remote.session;
    dirty = false;
    blockedByConflict = false;
    pendingConflict = null;
    saveMetadata({
        userId: account.userId,
        revision: remote.revision,
        lastSyncedHash: await stateHash(remote.session),
        lastSyncedAt: Date.now(),
    });
    emitStatus({ state: 'restored_remote', revision: remote.revision });
    return remote.session;
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

function scheduleRetry(): void {
    if (retryTimer !== null || blockedByConflict) {
        return;
    }
    retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void flushCloudSave();
    }, RETRY_DELAY_MS);
}

function bindLifecycle(): void {
    if (lifecycleBound) {
        return;
    }
    lifecycleBound = true;
    window.addEventListener('online', () => {
        if (retryTimer !== null) {
            window.clearTimeout(retryTimer);
            retryTimer = null;
        }
        if (dirty) {
            void flushCloudSave();
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
    latestSession = access.getLocalSession();
    bindLifecycle();

    try {
        const currentIdentity = requireAccountIdentity();
        metadata = loadMetadata(currentIdentity.userId);
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
            if (!local) {
                emitStatus({ state: 'synced', revision: 0 });
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
                emitStatus({ state: 'synced', revision: remote.revision });
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

        const localBackupKey = `${LOCAL_CONFLICT_BACKUP_KEY_PREFIX}${currentIdentity.userId}`;
        const remoteBackupKey = `${REMOTE_CONFLICT_BACKUP_KEY_PREFIX}${currentIdentity.userId}`;
        storeConflictBackup(localBackupKey, { session: local });
        storeConflictBackup(remoteBackupKey, remote);
        pendingConflict = {
            local,
            remote: {
                revision: remote.revision,
                updatedAt: remote.updatedAt,
                session: remote.state.session,
            },
        };
        blockedByConflict = true;
        emitStatus({ state: 'conflict', localBackupKey, remoteBackupKey });
    } catch {
        emitStatus({ state: 'offline' });
        if (latestSession) {
            dirty = true;
            scheduleRetry();
        }
    }
}

export function initializeCloudSave(nextAccess: CloudSaveAccess): Promise<void> {
    initializationPromise ??= initializeCloudSaveOnce(nextAccess);
    return initializationPromise;
}

export function disconnectCloudSave(): void {
    if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
    }
    checkpointQueued = false;
    access = null;
    metadata = null;
    latestSession = null;
    dirty = false;
    syncing = false;
    applyingRemote = false;
    blockedByConflict = false;
    pendingConflict = null;
    initializationPromise = null;
    emitStatus({ state: 'idle' });
}

export function restartCloudSave(nextAccess: CloudSaveAccess): Promise<void> {
    disconnectCloudSave();
    return initializeCloudSave(nextAccess);
}

export async function resolveCloudConflictWithLocal(): Promise<void> {
    const conflict = pendingConflict;
    if (!conflict) {
        return;
    }
    await commitLocalSaveToAccount(
        requireAccountIdentity(),
        conflict.local,
        conflict.remote.revision,
    );
}

export async function resolveCloudConflictWithRemote(): Promise<void> {
    const conflict = pendingConflict;
    const currentAccess = access;
    if (!conflict || !currentAccess) {
        return;
    }
    applyingRemote = true;
    try {
        currentAccess.applyRemoteSession(conflict.remote.session);
    } finally {
        applyingRemote = false;
    }
    await adoptCloudSaveForAccount(requireAccountIdentity(), conflict.remote);
}

export function markCloudSaveDirty(session: SessionState): void {
    if (applyingRemote || !getCurrentAccount()) {
        return;
    }
    latestSession = session;
    dirty = true;
    if (blockedByConflict) {
        return;
    }
    emitStatus({ state: 'pending' });
}

export async function syncCloudSaveCheckpoint(session?: SessionState): Promise<void> {
    const source = session ?? access?.getLocalSession();
    if (!source || !getCurrentAccount()) {
        return;
    }
    if (blockedByConflict) {
        return;
    }
    const checkpoint = structuredClone(source);
    if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
    }
    latestSession = checkpoint;
    dirty = true;
    if (syncing) {
        checkpointQueued = true;
        return;
    }
    emitStatus({ state: 'pending' });
    await flushCloudSave();
}

export async function flushCloudSave(keepalive = false): Promise<void> {
    if (syncing || !dirty || blockedByConflict || !latestSession) {
        return;
    }
    syncing = true;
    emitStatus({ state: 'syncing' });
    const session = latestSession;
    dirty = false;

    try {
        const currentIdentity = requireAccountIdentity();
        const expectedRevision =
            metadata?.userId === currentIdentity.userId ? metadata.revision : 0;
        const response = await uploadSession(session, expectedRevision, keepalive);
        if (response.status === 401) {
            throw new Error('Cloud session expired.');
        }
        if (response.status === 409) {
            const conflict = (await response.json()) as { current?: CloudSaveResponse };
            const localBackupKey = `${LOCAL_CONFLICT_BACKUP_KEY_PREFIX}${currentIdentity.userId}`;
            const remoteBackupKey = `${REMOTE_CONFLICT_BACKUP_KEY_PREFIX}${currentIdentity.userId}`;
            if (conflict.current) {
                storeConflictBackup(remoteBackupKey, conflict.current);
            }
            storeConflictBackup(localBackupKey, { session });
            if (conflict.current) {
                pendingConflict = {
                    local: session,
                    remote: {
                        revision: conflict.current.revision,
                        updatedAt: conflict.current.updatedAt,
                        session: conflict.current.state.session,
                    },
                };
            }
            checkpointQueued = false;
            blockedByConflict = true;
            emitStatus({ state: 'conflict', localBackupKey, remoteBackupKey });
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
        pendingConflict = null;
        blockedByConflict = false;
        emitStatus({ state: 'synced', revision: saved.revision });
    } catch {
        dirty = true;
        emitStatus({ state: 'offline' });
        scheduleRetry();
    } finally {
        syncing = false;
        if (checkpointQueued && dirty && !blockedByConflict) {
            checkpointQueued = false;
            void flushCloudSave();
        } else if (dirty && !blockedByConflict && currentStatus.state === 'synced') {
            emitStatus({ state: 'pending' });
        }
    }
}
