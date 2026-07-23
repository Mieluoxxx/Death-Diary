/**
 * Minimal monsterConfig + monsterList for difficulty-1 battles.
 * From Buried-City monsterConfig.js / monsterList.js.
 */

export type MonsterDef = {
    id: number;
    name: string;
    hp: number;
    speed: number;
    attackSpeed: number;
    attack: number;
};

export const MONSTER_CONFIG: Record<number, MonsterDef> = {
    1: {
        id: 1,
        name: '普通僵尸',
        hp: 100,
        speed: 1,
        attackSpeed: 2,
        attack: 10,
    },
    4: {
        id: 4,
        name: '快速僵尸',
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
        hp: 80,
        speed: 1,
        attackSpeed: 1,
        attack: 8,
    };
}
