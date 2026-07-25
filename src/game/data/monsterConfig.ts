/**
 * Monster stats and encounter packs ported from Buried-City monsterConfig.js
 * and monsterList.js. Every site difficulty (1..12) now has its original
 * candidate packs instead of silently falling back to difficulty one.
 */
export type MonsterDef = {
    id: number;
    name: string;
    prefixType: number;
    hp: number;
    speed: number;
    attackSpeed: number;
    attack: number;
};

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

export function monsterTypeName(prefixType: number): string {
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
    2: {
        id: 2,
        name: '腐烂的僵尸',
        prefixType: 2,
        hp: 100,
        speed: 1,
        attackSpeed: 1,
        attack: 13,
    },
    3: {
        id: 3,
        name: '臃肿的僵尸',
        prefixType: 3,
        hp: 150,
        speed: 1,
        attackSpeed: 1,
        attack: 16,
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
    5: {
        id: 5,
        name: '饥饿的僵尸',
        prefixType: 5,
        hp: 50,
        speed: 2,
        attackSpeed: 0.5,
        attack: 7,
    },
    6: {
        id: 6,
        name: '迅猛的僵尸',
        prefixType: 6,
        hp: 70,
        speed: 2,
        attackSpeed: 0.5,
        attack: 10,
    },
    7: {
        id: 7,
        name: '凶残的僵尸',
        prefixType: 7,
        hp: 220,
        speed: 1,
        attackSpeed: 0.5,
        attack: 16,
    },
    8: {
        id: 8,
        name: '邪恶的僵尸',
        prefixType: 8,
        hp: 160,
        speed: 2,
        attackSpeed: 0.5,
        attack: 16,
    },
    9: {
        id: 9,
        name: '狂暴的僵尸',
        prefixType: 9,
        hp: 200,
        speed: 2,
        attackSpeed: 1,
        attack: 20,
    },
    10: {
        id: 10,
        name: '异变的僵尸',
        prefixType: 10,
        hp: 260,
        speed: 1,
        attackSpeed: 1,
        attack: 23,
    },
};

const MONSTER_LIST_BY_DIFFICULTY: Record<number, readonly number[][]> = {
    1: [
        [1, 1],
        [4, 4],
    ],
    2: [
        [1, 1, 1],
        [4, 1, 1],
        [2, 1],
        [4, 5],
    ],
    3: [
        [1, 1, 1, 1],
        [4, 1, 1, 1],
        [4, 4, 4, 4],
        [1, 1, 2],
        [5, 5, 4],
    ],
    4: [
        [1, 1, 1, 1, 1, 1],
        [4, 4, 4, 1, 1, 1],
        [1, 1, 2, 1, 2],
        [2, 2, 2],
        [5, 4, 1, 1, 1],
        [5, 5, 2],
    ],
    5: [
        [1, 1, 1, 1, 1, 1, 1, 1],
        [4, 4, 1, 1, 4, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 2],
        [4, 4, 4, 4, 5, 5, 5],
        [1, 1, 1, 2, 2, 3],
        [4, 4, 4, 5, 5, 6],
        [6, 6, 3],
    ],
    6: [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [4, 1, 4, 1, 1, 4, 4, 1, 1, 1],
        [1, 1, 2, 2, 2, 2],
        [2, 2, 2, 3, 3],
        [4, 4, 4, 5, 5, 5, 5],
        [4, 4, 5, 5, 5, 6],
        [5, 5, 2, 2, 3],
        [6, 6, 3, 3],
    ],
    7: [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [4, 1, 1, 4, 1, 4, 1, 4, 1, 1, 1],
        [1, 1, 2, 2, 3, 3, 3],
        [4, 4, 5, 5, 6, 6],
        [4, 4, 6, 1, 1, 2, 3],
        [1, 1, 2, 4, 4, 5, 6],
        [4, 4, 5, 6, 7],
        [1, 1, 7, 7, 7, 2, 1],
        [7, 7, 7, 7],
    ],
    8: [
        [6, 6, 6, 7, 7, 7, 7],
        [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
        [7, 7, 7, 7, 7, 7, 7, 7],
    ],
    9: [
        [7, 7, 7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6],
        [6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7],
        [6, 6, 7, 7, 6, 6, 7, 7, 6, 6, 7, 7, 6, 6, 7, 7],
    ],
    10: [
        [7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9],
        [7, 8, 8, 8, 8, 8, 9, 9],
        [7, 7, 8, 8, 8, 8, 8, 7, 8, 8, 7, 8],
        [8, 8, 8, 8, 9, 8, 9, 9],
    ],
    11: [
        [7, 8, 7, 8, 9, 8, 9, 9, 9, 8, 9, 9],
        [8, 8, 9, 8, 8, 9, 8, 9, 9],
        [8, 8, 9, 9, 9, 9, 9],
        [7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9],
    ],
    12: [
        [7, 8, 8, 8, 9, 9, 8, 9, 10, 10, 10, 9, 10, 10],
        [8, 8, 9, 9, 10, 10, 9, 7, 10, 10, 10, 9, 9, 10],
        [8, 9, 9, 8, 10, 10, 10, 9, 8, 10, 9, 9, 9, 10, 10],
        [7, 10, 10, 9, 10, 9, 9, 10, 10, 10, 8, 10, 9, 10, 10],
        [8, 8, 10, 9, 9, 10, 9, 10, 8, 10, 10, 9, 9, 10, 10],
        [9, 10, 9, 10, 10, 10, 10, 9, 10, 10, 10, 9, 10, 10],
    ],
};

export function rollMonsterList(difficulty: number): number[] {
    const boundedDifficulty = Math.max(1, Math.min(12, Math.floor(difficulty)));
    const packs = MONSTER_LIST_BY_DIFFICULTY[boundedDifficulty] ?? MONSTER_LIST_BY_DIFFICULTY[1];
    const pack = packs[Math.floor(Math.random() * packs.length)] ?? [1];
    return [...pack];
}

export function getMonsterDef(monsterId: number): MonsterDef {
    return MONSTER_CONFIG[monsterId] ?? MONSTER_CONFIG[1]!;
}
