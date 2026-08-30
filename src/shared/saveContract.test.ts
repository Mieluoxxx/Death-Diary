import { describe, expect, test } from 'bun:test';
import {
    isSupportedSaveSchemaVersion,
    parseCloudSaveEnvelope,
    SAVE_SCHEMA_VERSION,
} from './saveContract';

describe('cloud save contract', () => {
    test('accepts a schema version 1 session envelope', () => {
        const parsed = parseCloudSaveEnvelope({
            schemaVersion: SAVE_SCHEMA_VERSION,
            state: { session: { gameTime: 3600 } },
        });

        expect(parsed).toEqual({
            schemaVersion: 1,
            state: { session: { gameTime: 3600 } },
        });
    });

    test('rejects unsupported versions and malformed state', () => {
        expect(isSupportedSaveSchemaVersion(2)).toBe(false);
        expect(parseCloudSaveEnvelope({ schemaVersion: 1, state: {} })).toBeNull();
        expect(parseCloudSaveEnvelope({ schemaVersion: 2, state: { session: {} } })).toBeNull();
    });
});
