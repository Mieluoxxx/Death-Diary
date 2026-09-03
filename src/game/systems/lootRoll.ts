/**
 * Weighted loot rolling shared by site produce, secret rooms and NPC help
 * requests. Port of Buried-City utils.getRoundRandom / getRandomItemId /
 * getFixedValueItemIds.
 */

import { RANDOM_LOOT_EXCLUDED_SET } from '../data/blackList';
import { ITEM_CONFIG } from '../data/itemConfig';
import type { SiteLoot } from '../data/siteConfig';
import type { WeightedSiteLoot } from '../data/siteProduceConfig';

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Original utils.getRoundRandom, including its inclusive 0..total roll. */
export function rollWeightedLoot(entries: readonly WeightedSiteLoot[]): WeightedSiteLoot {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total < 0 || entries.length === 0) {
        throw new Error('Site loot table must contain at least one non-negative entry.');
    }

    const roll = randomInt(0, total);
    let cumulative = 0;
    let selected = entries[entries.length - 1]!;
    for (const entry of entries) {
        cumulative += entry.weight;
        selected = entry;
        if (roll <= cumulative) {
            break;
        }
    }
    return selected;
}

/** Original utils.getRandomItemId wildcard matcher. */
export function resolveLootItemId(pattern: string): number {
    if (!pattern.includes('*')) {
        return Number(pattern);
    }

    let candidates = Object.keys(ITEM_CONFIG)
        .map(Number)
        .filter((itemId) => !RANDOM_LOOT_EXCLUDED_SET.has(itemId));
    let offset = 0;
    for (let index = 0; index < pattern.length; index++, offset += 2) {
        if (pattern[index] === '*') {
            continue;
        }

        const length = offset === 6 ? 1 : 2;
        const segment = pattern.slice(index, index + length);
        candidates = candidates.filter(
            (itemId) => String(itemId).slice(offset, offset + length) === segment,
        );
        index++;
    }

    if (candidates.length === 0) {
        throw new Error(`Loot wildcard ${pattern} resolved to no items.`);
    }
    return candidates[randomInt(0, candidates.length - 1)]!;
}

/**
 * Roll weighted item-id patterns until the value budget is spent, then aggregate
 * into counts. Shared by secret-room work rooms and NPC help requests
 * (original utils.getFixedValueItemIds + convertItemIds2Item).
 */
export function rollValueBudgetLoot(
    produceValue: number,
    produceList: readonly WeightedSiteLoot[],
): SiteLoot[] {
    const itemIds: number[] = [];
    let remainingValue = produceValue;
    while (remainingValue > 0) {
        const itemId = resolveLootItemId(rollWeightedLoot(produceList).itemId);
        const item = ITEM_CONFIG[itemId];
        if (!item) {
            throw new Error(`Value-budget loot item ${itemId} does not exist.`);
        }
        remainingValue -= item.value;
        itemIds.push(itemId);
    }

    const counts = new Map<number, number>();
    for (const itemId of itemIds) {
        counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    return [...counts].map(([itemId, num]) => ({ itemId, num }));
}
