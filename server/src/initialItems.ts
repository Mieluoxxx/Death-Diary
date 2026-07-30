import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HAND_ITEM_ID, ITEM_CONFIG } from '../../src/game/data/itemConfig';

export type InitialItemCounts = Record<number, number>;

export type InitialItemsConfig = {
    version: 1;
    storage: InitialItemCounts;
    bag: InitialItemCounts;
};

export type InitialItemsLoadResult = {
    config: InitialItemsConfig;
    loaded: boolean;
    path: string;
    warnings: string[];
};

export const EMPTY_INITIAL_ITEMS: InitialItemsConfig = {
    version: 1,
    storage: {},
    bag: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeCounts(
    value: unknown,
    section: 'storage' | 'bag',
    warnings: string[],
): InitialItemCounts {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        warnings.push(`${section} 必须是物品 ID 到数量的对象，已使用空配置。`);
        return {};
    }

    const counts: InitialItemCounts = {};
    for (const [rawItemId, rawCount] of Object.entries(value)) {
        const itemId = Number(rawItemId);
        if (
            !Number.isInteger(itemId) ||
            itemId === HAND_ITEM_ID ||
            ITEM_CONFIG[itemId] === undefined
        ) {
            warnings.push(`${section}.${rawItemId} 不是有效物品 ID，已忽略。`);
            continue;
        }
        if (!Number.isSafeInteger(rawCount) || (rawCount as number) < 0) {
            warnings.push(`${section}.${rawItemId} 的数量必须是非负安全整数，已忽略。`);
            continue;
        }
        if ((rawCount as number) > 0) {
            counts[itemId] = rawCount as number;
        }
    }
    return counts;
}

export function loadInitialItems(
    path = Bun.env.INITIAL_ITEMS_PATH ?? 'data/initial-items.json',
): InitialItemsLoadResult {
    const absolutePath = resolve(path);
    const warnings: string[] = [];
    let parsed: unknown;

    try {
        parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown;
    } catch (error) {
        warnings.push(
            `无法读取初始物资配置 ${absolutePath}：${error instanceof Error ? error.message : String(error)}`,
        );
        return {
            config: { version: 1, storage: {}, bag: {} },
            loaded: false,
            path: absolutePath,
            warnings,
        };
    }

    if (!isRecord(parsed) || parsed.version !== 1) {
        warnings.push('初始物资配置必须是 version=1 的 JSON 对象，已使用空配置。');
        return {
            config: { version: 1, storage: {}, bag: {} },
            loaded: false,
            path: absolutePath,
            warnings,
        };
    }

    return {
        config: {
            version: 1,
            storage: sanitizeCounts(parsed.storage, 'storage', warnings),
            bag: sanitizeCounts(parsed.bag, 'bag', warnings),
        },
        loaded: true,
        path: absolutePath,
        warnings,
    };
}
