/**
 * Port of Buried-City itemConfig effect_food / effect_medicine / effect_buff.
 */

export type AttrChanceMap = {
    id?: string | number;
    hp?: number;
    hp_chance?: number;
    spirit?: number;
    spirit_chance?: number;
    starve?: number;
    starve_chance?: number;
    vigour?: number;
    vigour_chance?: number;
    injury?: number;
    injury_chance?: number;
    infect?: number;
    infect_chance?: number;
    temperature?: number;
    temperature_chance?: number;
};

export type BuffEffect = {
    id?: string | number;
    effect: number;
    effectType: number;
    value: number;
    /** Hours. */
    lastTime: number;
};

export const FOOD_EFFECTS: Record<number, AttrChanceMap> = {
    1103011: { id: 1103011, starve: 10, starve_chance: 1, infect: 10, infect_chance: 0.6 },
    1103022: { id: 1103022, starve: 35, starve_chance: 1 },
    1103033: { id: 1103033, starve: 35, starve_chance: 1 },
    1103041: { id: 1103041, starve: 14, starve_chance: 1, infect: 20, infect_chance: 0.9 },
    1103052: { id: 1103052, starve: 40, starve_chance: 1 },
    1103063: { id: 1103063, starve: 40, starve_chance: 1 },
    1103074: { id: 1103074, spirit: 30, spirit_chance: 1, starve: 80, starve_chance: 1 },
    1103083: { id: 1103083, starve: 40, starve_chance: 1 },
};

export const MEDICINE_EFFECTS: Record<number, AttrChanceMap> = {
    1104011: { id: 1104011, injury: -30, injury_chance: 1 },
    1104021: { id: 1104021, infect: -20, infect_chance: 1 },
    1104032: { id: 1104032, infect: -100, infect_chance: 1, hp: -150, hp_chance: 0.4 },
    1104043: { id: 1104043, infect: -100, infect_chance: 1 },
};

export const BUFF_EFFECTS: Record<number, BuffEffect> = {
    1107012: { id: 1107012, effect: 1, effectType: 1, value: 60, lastTime: 72 },
    1107022: { id: 1107022, effect: 2, effectType: 2, value: 0, lastTime: 72 },
    1107032: { id: 1107032, effect: 3, effectType: 2, value: 0, lastTime: 72 },
    1107042: { id: 1107042, effect: 4, effectType: 2, value: 0, lastTime: 72 },
};

export const BANDAGE_ITEM_ID = 1104011;
export const DIY_PENICILLIN_ITEM_ID = 1104032;
export const MAX_HP_BUFF_ITEM_ID = 1107012;
export const INFECT_IMMUNE_BUFF_ITEM_ID = 1107022;
export const VIGOUR_IMMUNE_BUFF_ITEM_ID = 1107032;
export const STARVE_IMMUNE_BUFF_ITEM_ID = 1107042;

export function isFoodItem (itemId: number): boolean
{
    return FOOD_EFFECTS[itemId] != null;
}

export function isMedicineItem (itemId: number): boolean
{
    return MEDICINE_EFFECTS[itemId] != null;
}

export function isBuffItem (itemId: number): boolean
{
    return BUFF_EFFECTS[itemId] != null;
}

export function isUsableItem (itemId: number): boolean
{
    return isFoodItem(itemId) || isMedicineItem(itemId) || isBuffItem(itemId);
}
