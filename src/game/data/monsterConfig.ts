/**
 * Minimal monsterConfig + monsterList for difficulty-1 battles.
 * From Buried-City monsterConfig.js / monsterList.js.
 */

export type MonsterDef = {
    id: number;
    /** Full display fallback (prefix + 僵尸). */
    name: string;
    /** Original prefixType → monsterType_N string. */
    prefixType: number;
    hp: number;
    speed: number;
    attackSpeed: number;
    attack: number;
};

/** string_zh monsterType_N */
export const MONSTER_PREFIX: Record<number, string> = {
    1: '朽坏的',
    2: '腐烂的',
    3: '臃肿的',
    4: '瘦小的',
    5: '饥饿的',
    6: '迅猛的',
    7: '凶残的',
    8: '邪恶的',
    9: '狂暴的',
    10: '异变的',
};

export function monsterTypeName (prefixType: number): string
{
    return MONSTER_PREFIX[prefixType] ?? '';
}

export const MONSTER_CONFIG: Record<number, MonsterDef> = {
    1: {
        id: 1,
        name: '朽坏的僵尸',
        prefixType: 1,
        hp: 100,
        speed: 1,
        attackSpeed: 2,
        attack: 10,
    },
    4: {
        id: 4,
        name: '瘦小的僵尸',
        prefixType: 4,
        hp: 50,
        speed: 2,
        attackSpeed: 0.5,
        attack: 5,
    },
};

/** difficulty → candidate encounter packs (monster ids). */
const MONSTER_LIST_BY_DIFFICULTY: Record<number, number[][]> = {
    1: [
        [1, 1],
        [4, 4],
    ],
};

export function rollMonsterList (difficulty: number): number[]
{
    const packs = MONSTER_LIST_BY_DIFFICULTY[difficulty]
        ?? MONSTER_LIST_BY_DIFFICULTY[1];
    const pack = packs[Math.floor(Math.random() * packs.length)] ?? [1];
    return [...pack];
}

export function getMonsterDef (monsterId: number): MonsterDef
{
    return MONSTER_CONFIG[monsterId] ?? {
        id: monsterId,
        name: `怪物${monsterId}`,
        prefixType: 1,
        hp: 80,
        speed: 1,
        attackSpeed: 1,
        attack: 8,
    };
}
