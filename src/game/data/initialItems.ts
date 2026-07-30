import { HAND_ITEM_ID, ITEM_CONFIG } from './itemConfig';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const REQUEST_TIMEOUT_MS = 2_500;

type ItemCounts = Record<number, number>;

type InitialItemsConfig = {
    version: 1;
    storage: ItemCounts;
    bag: ItemCounts;
};

let activeConfig: InitialItemsConfig = {
    version: 1,
    storage: {},
    bag: {},
};

let loadPromise: Promise<void> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeCounts(value: unknown): ItemCounts {
    if (!isRecord(value)) {
        return {};
    }
    const counts: ItemCounts = {};
    for (const [rawItemId, rawCount] of Object.entries(value)) {
        const itemId = Number(rawItemId);
        if (
            Number.isInteger(itemId) &&
            itemId !== HAND_ITEM_ID &&
            ITEM_CONFIG[itemId] !== undefined &&
            Number.isSafeInteger(rawCount) &&
            (rawCount as number) > 0
        ) {
            counts[itemId] = rawCount as number;
        }
    }
    return counts;
}

async function fetchInitialItems(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/v1/config/initial-items`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
            throw new Error(`Initial items request failed: ${response.status}`);
        }
        const body = (await response.json()) as unknown;
        if (!isRecord(body) || body.version !== 1) {
            throw new Error('Initial items response has an invalid shape.');
        }
        activeConfig = {
            version: 1,
            storage: sanitizeCounts(body.storage),
            bag: sanitizeCounts(body.bag),
        };
    } catch (error) {
        activeConfig = { version: 1, storage: {}, bag: {} };
        console.warn(
            'Initial items unavailable; new games will start with empty inventory.',
            error,
        );
    }
}

/** Start once; callers may await this before creating a new session. */
export function loadInitialItems(): Promise<void> {
    loadPromise ??= fetchInitialItems();
    return loadPromise;
}

export function initialStorage(): ItemCounts {
    return { ...activeConfig.storage };
}

export function initialBag(): ItemCounts {
    return { ...activeConfig.bag };
}
