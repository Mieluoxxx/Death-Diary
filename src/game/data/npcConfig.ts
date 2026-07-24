/**
 * NPC homes on the map — stub catalog for map markers / travel.
 * Full dialog/trade deferred.
 */

export type NpcDef = {
    id: number;
    coordinate: { x: number; y: number };
};

export type NpcCopy = {
    name: string;
    des: string;
};

/** Original NPC map coords subset (empty unlock list until story unlocks). */
export const NPC_CONFIG: Record<number, NpcDef> = {
    1: { id: 1, coordinate: { x: 180, y: 420 } },
    2: { id: 2, coordinate: { x: 360, y: 260 } },
    3: { id: 3, coordinate: { x: 480, y: 520 } },
    4: { id: 4, coordinate: { x: 240, y: 640 } },
};

const NPC_COPY: Record<number, NpcCopy> = {
    1: { name: '陌生人', des: '一位自称路过的好心人。' },
    2: { name: '老户', des: '看起来有东西可以交换。' },
    3: { name: '猎人', des: '靠狩猎勉强活着。' },
    4: { name: '医生', des: '还愿意帮人处理伤口。' },
};

export function getNpcDef (npcId: number): NpcDef | null
{
    return NPC_CONFIG[npcId] ?? null;
}

export function getNpcCopy (npcId: number): NpcCopy
{
    return NPC_COPY[npcId] ?? { name: `NPC${npcId}`, des: '' };
}
