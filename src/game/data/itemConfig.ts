/**
 * Minimal itemConfig subset for P0 main loop.
 * Weights / weapon / armor / tool effects from Buried-City itemConfig.js.
 */

export type EquipSlot = 'gun' | 'weapon' | 'equip' | 'tool';

export type WeaponEffect = {
    atk: number;
    atkCD: number;
    range: number;
    bulletMin: number;
    bulletMax: number;
    bulletNum: number;
    reloadCD: number;
    precise: number;
    dtPrecise: number;
    deathHit: number;
    dtDeathHit: number;
    brokenProbability: number;
};

export type ArmEffect = { def: number };
export type ToolEffect = { workingTime: number };

export type ItemDef = {
    id: number;
    name: string;
    weight: number;
    /** Equip slot when equippable; undefined = material/consumable. */
    slot?: EquipSlot;
    effectWeapon?: WeaponEffect;
    effectArm?: ArmEffect;
    effectTool?: ToolEffect;
};

/** Equipment.HAND placeholder — not a real bag item. */
export const HAND_ITEM_ID = 1;
export const BULLET_ID = 1305011;
export const BASE_BAG_WEIGHT = 35;
export const SMALL_BAG_ID = 1305023;
export const BIG_BAG_ID = 1305024;
export const FALCON_ID = 1305044;

const WEAPON_CROWBAR: WeaponEffect = {
    atk: 40,
    atkCD: 1,
    range: 0,
    bulletMin: 0,
    bulletMax: 0,
    bulletNum: 0,
    reloadCD: 1,
    precise: 1,
    dtPrecise: 0,
    deathHit: 0,
    dtDeathHit: 0,
    brokenProbability: 0.05,
};

const WEAPON_PISTOL: WeaponEffect = {
    atk: 0, // damage comes from bullet effect
    atkCD: 1,
    range: 4,
    bulletMin: 1,
    bulletMax: 1,
    bulletNum: 10,
    reloadCD: 1,
    precise: 0.55,
    dtPrecise: 0.05,
    deathHit: 0.05,
    dtDeathHit: 0.01,
    brokenProbability: 0.065,
};

const WEAPON_BULLET: WeaponEffect = {
    atk: 50,
    atkCD: 0,
    range: 0,
    bulletMin: 0,
    bulletMax: 0,
    bulletNum: 0,
    reloadCD: 0,
    precise: 0,
    dtPrecise: 0,
    deathHit: 0,
    dtDeathHit: 0,
    brokenProbability: 0,
};

export const ITEM_CONFIG: Record<number, ItemDef> = {
    [HAND_ITEM_ID]: {
        id: HAND_ITEM_ID,
        name: '徒手',
        weight: 0,
        slot: 'weapon',
        effectWeapon: {
            atk: 20,
            atkCD: 1,
            range: 0,
            bulletMin: 0,
            bulletMax: 0,
            bulletNum: 0,
            reloadCD: 1,
            precise: 1,
            dtPrecise: 0,
            deathHit: 0,
            dtDeathHit: 0,
            brokenProbability: 0,
        },
    },
    1101011: { id: 1101011, name: '木质材料', weight: 2 },
    1101021: { id: 1101021, name: '金属材料', weight: 2 },
    1101031: { id: 1101031, name: '柔性材料', weight: 1 },
    1101041: { id: 1101041, name: '零件', weight: 1 },
    1101051: { id: 1101051, name: '电器元件', weight: 1 },
    1101061: { id: 1101061, name: '水', weight: 1 },
    1103083: { id: 1103083, name: '罐头', weight: 2 },
    1301011: {
        id: 1301011,
        name: '手枪',
        weight: 1,
        slot: 'gun',
        effectWeapon: WEAPON_PISTOL,
    },
    1302011: {
        id: 1302011,
        name: '撬棍',
        weight: 2,
        slot: 'weapon',
        effectWeapon: WEAPON_CROWBAR,
        effectTool: { workingTime: 10 },
    },
    /** 电锯 — 武器 + 搜刮工具（开发开局赠送） */
    1302043: {
        id: 1302043,
        name: '电锯',
        weight: 6,
        slot: 'weapon',
        effectWeapon: {
            atk: 100,
            atkCD: 1.5,
            range: 0,
            bulletMin: 0,
            bulletMax: 0,
            bulletNum: 0,
            reloadCD: 0.6,
            precise: 1,
            dtPrecise: 0,
            deathHit: 0,
            dtDeathHit: 0,
            brokenProbability: 0.04,
        },
        // 原版仅 effect_weapon；开发用补 tool 以便搜刮选工具
        effectTool: { workingTime: 5 },
    },
    1303012: {
        id: 1303012,
        name: '炸药',
        weight: 1,
        slot: 'tool',
        effectWeapon: {
            atk: 50,
            atkCD: 5,
            range: 5,
            bulletMin: 0,
            bulletMax: 0,
            bulletNum: 0,
            reloadCD: 0.2,
            precise: 0,
            dtPrecise: 0,
            deathHit: 0,
            dtDeathHit: 0,
            brokenProbability: 0,
        },
    },
    1304012: {
        id: 1304012,
        name: '厚外套',
        weight: 2,
        slot: 'equip',
        effectArm: { def: 3 },
    },
    [BULLET_ID]: {
        id: BULLET_ID,
        name: '子弹',
        weight: 0,
        effectWeapon: WEAPON_BULLET,
    },
    [SMALL_BAG_ID]: { id: SMALL_BAG_ID, name: '小背包', weight: 0 },
    [BIG_BAG_ID]: { id: BIG_BAG_ID, name: '大背包', weight: 0 },
    [FALCON_ID]: { id: FALCON_ID, name: '战隼', weight: 0 },
};

export function getItemDef (itemId: number): ItemDef
{
    return ITEM_CONFIG[itemId] ?? {
        id: itemId,
        name: `物品${itemId}`,
        weight: 1,
    };
}

export function itemWeight (itemId: number): number
{
    return getItemDef(itemId).weight;
}

export function itemsForSlot (slot: EquipSlot): number[]
{
    return Object.values(ITEM_CONFIG)
        .filter((item) => item.slot === slot && item.id !== HAND_ITEM_ID)
        .map((item) => item.id);
}
