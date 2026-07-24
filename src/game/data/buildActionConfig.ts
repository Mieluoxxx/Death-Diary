/**
 * Port of Buried-City buildActionConfig.js
 * Facility non-formula actions (chair rest/drink, dog, minefield, bed rates, trap, bonfire).
 */

export type BuildActionCost = { itemId: number; num: number };

export type ChairActionLevel = {
    cost: BuildActionCost[];
    makeTime: number;
    effect: { spirit: number; spirit_chance: number };
};

/** bid 10: [level][0=coffee, 1=drink] */
export const CHAIR_ACTIONS: ChairActionLevel[][] = [
    [
        {
            cost: [
                { itemId: 1105011, num: 4 },
                { itemId: 1101061, num: 1 },
                { itemId: 1101011, num: 1 },
            ],
            makeTime: 60,
            effect: { spirit: 60, spirit_chance: 1 },
        },
        {
            cost: [{ itemId: 1105022, num: 3 }],
            makeTime: 60,
            effect: { spirit: 60, spirit_chance: 1 },
        },
    ],
    [
        {
            cost: [
                { itemId: 1105011, num: 4 },
                { itemId: 1101061, num: 1 },
                { itemId: 1101011, num: 1 },
            ],
            makeTime: 60,
            effect: { spirit: 80, spirit_chance: 1 },
        },
        {
            cost: [{ itemId: 1105022, num: 3 }],
            makeTime: 60,
            effect: { spirit: 80, spirit_chance: 1 },
        },
    ],
    [
        {
            cost: [
                { itemId: 1105011, num: 4 },
                { itemId: 1101061, num: 1 },
                { itemId: 1101011, num: 1 },
            ],
            makeTime: 60,
            effect: { spirit: 100, spirit_chance: 1 },
        },
        {
            cost: [{ itemId: 1105022, num: 3 }],
            makeTime: 60,
            effect: { spirit: 100, spirit_chance: 1 },
        },
    ],
];

export const DOG_FEED_ACTION = {
    cost: [{ itemId: 1103041, num: 2 }],
    makeTime: 30,
} as const;

export const MINEFIELD_ACTION = {
    cost: [{ itemId: 1303012, num: 3 }],
    makeTime: 30,
} as const;

export const BED_RATES = [0.7, 1] as const;
