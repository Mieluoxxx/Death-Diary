/** Shared, dependency-free cloud-save envelope contract. */

export const SAVE_SCHEMA_VERSION = 1 as const;

export type CloudSaveState<TSession = Record<string, unknown>> = {
    session: TSession;
};

export type CloudSaveEnvelope<TSession = Record<string, unknown>> = {
    schemaVersion: typeof SAVE_SCHEMA_VERSION;
    state: CloudSaveState<TSession>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSupportedSaveSchemaVersion(value: unknown): value is typeof SAVE_SCHEMA_VERSION {
    return value === SAVE_SCHEMA_VERSION;
}

export function parseCloudSaveEnvelope<TSession = Record<string, unknown>>(
    value: unknown,
): CloudSaveEnvelope<TSession> | null {
    if (!isRecord(value) || !isSupportedSaveSchemaVersion(value.schemaVersion)) {
        return null;
    }
    const state = value.state;
    if (!isRecord(state) || !isRecord(state.session)) {
        return null;
    }
    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        state: { session: state.session as TSession },
    };
}
