/**
 * Port of Buried-City playerConfig.changeByTime + temperature tables (subset).
 */

/** Per-hour deltas: [self starve, dog starve, day-home vigour, day-out, night-home, night-out]. */
export const CHANGE_BY_TIME: readonly [
    readonly [number],
    readonly [number],
    readonly [number],
    readonly [number],
    readonly [number],
    readonly [number],
] = [[-4], [-4], [-1], [-2], [-2], [-4]];

/**
 * temperature[season] = [base, dayBonus, nightBonus]
 * temperature[4] = [fireBonus] — not used until bonfire/electric stove.
 */
export const TEMPERATURE_BY_SEASON: readonly (readonly [number, number, number])[] = [
    [15, 2, -2], // fall (original season 0)
    [0, 2, -2], // winter
    [10, 2, -2], // spring
    [18, 5, 0], // summer
];

export const FIRE_TEMPERATURE_BONUS = 13;
