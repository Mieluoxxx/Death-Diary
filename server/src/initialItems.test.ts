import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_INITIAL_ITEMS, loadInitialItems } from './initialItems';

const tempDirectories: string[] = [];

function tempConfig(content: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'death-diary-initial-items-'));
    tempDirectories.push(directory);
    const path = join(directory, 'initial-items.json');
    writeFileSync(path, content);
    return path;
}

afterEach(() => {
    while (tempDirectories.length > 0) {
        rmSync(tempDirectories.pop()!, { recursive: true, force: true });
    }
});

describe('initial item configuration', () => {
    test('uses empty inventory when the file cannot be read', () => {
        const result = loadInitialItems('/path/that/does/not/exist/initial-items.json');

        expect(result.loaded).toBe(false);
        expect(result.config).toEqual(EMPTY_INITIAL_ITEMS);
        expect(result.warnings).toHaveLength(1);
    });

    test('loads known items and discards zero or invalid entries', () => {
        const path = tempConfig(
            JSON.stringify({
                version: 1,
                storage: {
                    1101011: 5,
                    1101021: 0,
                    1101031: -1,
                    9999999: 3,
                    1: 4,
                },
                bag: { 1302043: 1, 1301011: 1.5 },
            }),
        );

        const result = loadInitialItems(path);

        expect(result.loaded).toBe(true);
        expect(result.config).toEqual({
            version: 1,
            storage: { 1101011: 5 },
            bag: { 1302043: 1 },
        });
        expect(result.warnings).toHaveLength(4);
    });

    test('uses empty inventory for an unsupported configuration version', () => {
        const path = tempConfig(JSON.stringify({ version: 2, storage: { 1101011: 5 } }));

        const result = loadInitialItems(path);

        expect(result.loaded).toBe(false);
        expect(result.config).toEqual(EMPTY_INITIAL_ITEMS);
    });
});
