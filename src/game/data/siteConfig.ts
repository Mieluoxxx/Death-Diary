/**
 * Minimal map/site config for P0: HOME(100) + Gas Station(201) + Super Market(1).
 * From Buried-City siteConfig.js + string site_* names.
 */

export type SiteLoot = { itemId: number; num: number };

export type SiteConfig = {
    id: number;
    name: string;
    des: string;
    coordinate: { x: number; y: number };
    battleRoom: number;
    workRoom: number;
    /** Inclusive difficulty range for battle rooms. */
    difficulty: [number, number] | [];
    fixedProduceList: SiteLoot[];
    /** Sites unlocked when this site is fully cleared. */
    unlockSites: number[];
    def: number;
};

export const HOME_SITE_ID = 100;
export const STARTER_SITE_ID = 201;
/** Original site id 1 — unlocked by clearing gas station 201. */
export const SUPERMARKET_SITE_ID = 1;

export const SITE_CONFIG: Record<number, SiteConfig> = {
    [HOME_SITE_ID]: {
        id: HOME_SITE_ID,
        name: '家',
        des: '你的避难所。',
        coordinate: { x: 45, y: 50 },
        battleRoom: 0,
        workRoom: 0,
        difficulty: [],
        fixedProduceList: [],
        unlockSites: [],
        def: 10,
    },
    [STARTER_SITE_ID]: {
        id: STARTER_SITE_ID,
        name: '加油站',
        des: '加油站里面横七竖八地停放着各种汽车，彼此僵持，进退不能。这么混乱的场景，居然没有起火爆炸，真是奇迹！',
        coordinate: { x: 108, y: 127 },
        battleRoom: 1,
        workRoom: 1,
        difficulty: [1, 1],
        fixedProduceList: [
            { itemId: 1101031, num: 6 },
            { itemId: 1101041, num: 2 },
            { itemId: 1101021, num: 2 },
            { itemId: 1103083, num: 1 },
        ],
        // Original unlockValue.site: ["1","202"] — slice unlocks supermarket only.
        unlockSites: [SUPERMARKET_SITE_ID],
        def: 10,
    },
    [SUPERMARKET_SITE_ID]: {
        id: SUPERMARKET_SITE_ID,
        name: '超市',
        des: '仓皇出逃的人们洗劫了这里，橱窗被砸出几个大洞，玻璃渣满地都是。',
        coordinate: { x: 152, y: 60 },
        battleRoom: 2,
        workRoom: 2,
        difficulty: [1, 2],
        fixedProduceList: [
            { itemId: 1101011, num: 4 },
            { itemId: 1101031, num: 4 },
            { itemId: 1103083, num: 2 },
        ],
        unlockSites: [],
        def: 10,
    },
};

export function getSiteConfig (siteId: number): SiteConfig | null
{
    return SITE_CONFIG[siteId] ?? null;
}

/** Distance between two map coordinates (same units as original). */
export function mapDistance (
    a: { x: number; y: number },
    b: { x: number; y: number },
): number
{
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Original Actor.MAX_VELOCITY ≈ 97/(1*60*60)*0.8*1.1 ≈ 0.0237 map-units/s.
 * P0 uses this base only (no boots/moto/weather).
 */
export const MAP_BASE_VELOCITY = (97 / (1 * 60 * 60)) * 0.8 * 1.1;

export function travelTimeSeconds (distance: number): number
{
    return distance / MAP_BASE_VELOCITY;
}
