/**
 * Port of Buried-City MoonlightingConfig.js
 */

export type StrengthBand = {
    dayMin: number;
    /** Inclusive max; omit / Infinity for open-ended last band. */
    dayMax: number;
    strengthMin: number;
    strengthMax: number;
};

export const MOONLIGHTING_CONFIG = {
    probability: 0.25,
    lostValue: 100,
    strength: [
        { dayMin: 1, dayMax: 10, strengthMin: 5, strengthMax: 5 },
        { dayMin: 11, dayMax: 20, strengthMin: 5, strengthMax: 10 },
        { dayMin: 21, dayMax: 30, strengthMin: 10, strengthMax: 15 },
        { dayMin: 31, dayMax: 40, strengthMin: 10, strengthMax: 20 },
        { dayMin: 41, dayMax: 50, strengthMin: 15, strengthMax: 25 },
        { dayMin: 51, dayMax: 60, strengthMin: 20, strengthMax: 30 },
        { dayMin: 61, dayMax: 70, strengthMin: 30, strengthMax: 35 },
        { dayMin: 71, dayMax: Number.MAX_SAFE_INTEGER, strengthMin: 30, strengthMax: 36 },
    ] as const satisfies readonly StrengthBand[],
} as const;

/** Power plant site used by electric fence isActive (original WORK_SITE). */
export const WORK_SITE_ID = 204;
