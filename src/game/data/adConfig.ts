/**
 * Site 202 (???) free scrapyard reward table.
 * Port of Buried-City adHelper.adConfig.reward (ads removed; once/day claim).
 */

import type { SiteProduceConfig } from './siteProduceConfig';

/** Daily free claim slots at the scrapyard (original: one gift after ad). */
export const SCRAPYARD_CLAIMS_PER_DAY = 1;

/** Weighted loot budget for one scrapyard claim. */
export const AD_REWARD_CONFIG = {
    produceValue: 3,
    produceList: [
        { itemId: '1101011', weight: 15 },
        { itemId: '1101021', weight: 15 },
        { itemId: '1101031', weight: 6 },
        { itemId: '1101041', weight: 5 },
        { itemId: '1101051', weight: 0 },
        { itemId: '1101**', weight: 10 },
        { itemId: '1102011', weight: 1 },
        { itemId: '1103*1', weight: 10 },
        { itemId: '1104011', weight: 5 },
        { itemId: '1104021', weight: 5 },
        { itemId: '1104043', weight: 0 },
        { itemId: '1105011', weight: 10 },
        { itemId: '1105042', weight: 2 },
        { itemId: '1105**', weight: 0 },
        { itemId: '1305011', weight: 30 },
        { itemId: '1103083', weight: 3 },
        { itemId: '1102**', weight: 2 },
        { itemId: '1301**', weight: 0 },
        { itemId: '1105022', weight: 5 },
        { itemId: '1105033', weight: 1 },
        { itemId: '1302*1', weight: 1 },
        { itemId: '1106013', weight: 0 },
    ],
} as const satisfies SiteProduceConfig;
