/**
 * Port of Buried-City weatherConfig.js + weatherSystemConfig.js.
 */

export type WeatherId = 0 | 1 | 2 | 3 | 4;

export type WeatherEffects = {
    id: WeatherId;
    lastDays?: number;
    vigour?: number;
    spirit?: number;
    temperature?: number;
    /** Production / combat side-effects kept for future systems. */
    item_1101061?: number;
    item_1103041?: number;
    build_2?: number;
    speed?: number;
    gun_precise?: number;
    monster_speed?: number;
};

/** Weather attribute / production modifiers by weatherId. */
export const WEATHER_CONFIG: Record<WeatherId, WeatherEffects> = {
    0: { id: 0 },
    1: { id: 1, lastDays: 2, vigour: 1, item_1101061: -4 },
    2: { id: 2, lastDays: 2, build_2: 2, spirit: -1 },
    3: { id: 3, lastDays: 3, speed: -0.1, temperature: -2, item_1103041: 4 },
    4: { id: 4, lastDays: 2, gun_precise: -0.15, monster_speed: -1 },
};

/** Season → weighted weather rolls (original weatherSystemConfig). */
export const WEATHER_BY_SEASON: Record<
    0 | 1 | 2 | 3,
    Array<{ weatherId: WeatherId; weight: number }>
> = {
    0: [
        { weatherId: 0, weight: 5 },
        { weatherId: 1, weight: 1 },
        { weatherId: 2, weight: 1 },
        { weatherId: 3, weight: 0 },
        { weatherId: 4, weight: 0 },
    ],
    1: [
        { weatherId: 0, weight: 5 },
        { weatherId: 1, weight: 1 },
        { weatherId: 2, weight: 0 },
        { weatherId: 3, weight: 2 },
        { weatherId: 4, weight: 0 },
    ],
    2: [
        { weatherId: 0, weight: 5 },
        { weatherId: 1, weight: 2 },
        { weatherId: 2, weight: 1 },
        { weatherId: 3, weight: 0 },
        { weatherId: 4, weight: 1 },
    ],
    3: [
        { weatherId: 0, weight: 1 },
        { weatherId: 1, weight: 3 },
        { weatherId: 2, weight: 3 },
        { weatherId: 3, weight: 0 },
        { weatherId: 4, weight: 3 },
    ],
};

export function getWeatherEffects(weatherId: number): WeatherEffects {
    const id = Math.max(0, Math.min(4, Math.floor(weatherId))) as WeatherId;
    return WEATHER_CONFIG[id] ?? WEATHER_CONFIG[0];
}

export function getWeatherValue(weatherId: number, key: keyof WeatherEffects): number {
    const cfg = getWeatherEffects(weatherId);
    const value = cfg[key];
    return typeof value === 'number' ? value : 0;
}

/** Weighted random weather for a season. */
export function rollWeatherForSeason(season: 0 | 1 | 2 | 3): WeatherId {
    const table = WEATHER_BY_SEASON[season] ?? WEATHER_BY_SEASON[0];
    const total = table.reduce((sum, row) => sum + row.weight, 0);
    if (total <= 0) {
        return 0;
    }
    let r = Math.random() * total;
    for (const row of table) {
        r -= row.weight;
        if (r <= 0) {
            return row.weatherId;
        }
    }
    return table[table.length - 1]?.weatherId ?? 0;
}
