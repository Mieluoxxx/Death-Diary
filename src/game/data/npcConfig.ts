/**
 * NPC definitions ported from Buried-City npcConfig.js / string_zh.js.
 * Runtime state belongs to SessionState.npcs; this file is immutable data only.
 */
import { ORIGINAL_NPC_DATA } from './npcData';

export const NPC_IDS = [1, 2, 3, 4, 5, 6] as const;
export type NpcId = (typeof NPC_IDS)[number];

export type NpcItemStack = { itemId: number; num: number };
export type NpcFavorite = { itemId: number; price: number };
export type NpcReward =
    | { kind: 'item'; itemId: number; num: number }
    | { kind: 'site'; siteId: number };

export type NpcDef = {
    id: NpcId;
    coordinate: { x: number; y: number };
    name: string;
    des: string;
    dialogs: readonly string[];
    favorite: readonly (readonly NpcFavorite[])[];
    trading: readonly (readonly NpcItemStack[])[];
    needItems: readonly (NpcItemStack | null)[];
    gifts: readonly (NpcReward | null)[];
    extraGifts: readonly (NpcReward | null)[];
};

export type NpcCopy = Pick<NpcDef, 'name' | 'des'>;

type RawItemStack = {
    readonly itemId: string | number;
    readonly num: string | number;
};
type RawFavorite = { readonly itemId: number; readonly price: number };
type RawReward = RawItemStack | { readonly siteId: string | number };
type RawNpcDef = {
    readonly coordinate: { readonly x: number; readonly y: number };
    readonly name: string;
    readonly des: string;
    readonly dialogs: readonly string[];
    readonly favorite: readonly (readonly RawFavorite[])[];
    readonly trading: readonly (readonly RawItemStack[] | null)[];
    readonly needItem: readonly (RawItemStack | null)[];
    readonly gift: readonly (RawReward | null)[];
    readonly gift_extra: readonly (RawReward | null)[];
};

function asItemStack(raw: RawItemStack): NpcItemStack {
    return { itemId: Number(raw.itemId), num: Number(raw.num) };
}

function asReward(raw: RawReward | null): NpcReward | null {
    if (!raw) {
        return null;
    }
    if ('siteId' in raw) {
        return { kind: 'site', siteId: Number(raw.siteId) };
    }
    return { kind: 'item', ...asItemStack(raw) };
}

function asNpcDef(id: NpcId): NpcDef {
    const raw = ORIGINAL_NPC_DATA[String(id) as keyof typeof ORIGINAL_NPC_DATA] as RawNpcDef;
    return {
        id,
        coordinate: { ...raw.coordinate },
        name: raw.name,
        des: raw.des.trim(),
        dialogs: raw.dialogs,
        favorite: raw.favorite,
        trading: raw.trading.map((row) => row?.map(asItemStack) ?? []),
        needItems: raw.needItem.map((item) => (item ? asItemStack(item) : null)),
        gifts: raw.gift.map(asReward),
        extraGifts: raw.gift_extra.map(asReward),
    };
}

export const NPC_CONFIG = {
    1: asNpcDef(1),
    2: asNpcDef(2),
    3: asNpcDef(3),
    4: asNpcDef(4),
    5: asNpcDef(5),
    6: asNpcDef(6),
} satisfies Record<NpcId, NpcDef>;

export const ROLE_NPC_ID = {
    STRANGER: 6,
    LUO: 1,
    YAZI: 4,
} as const satisfies Record<'STRANGER' | 'LUO' | 'YAZI', NpcId>;

export function isNpcId(value: number): value is NpcId {
    return NPC_IDS.includes(value as NpcId);
}

export function getNpcDef(npcId: number): NpcDef | null {
    return isNpcId(npcId) ? NPC_CONFIG[npcId] : null;
}

export function getNpcCopy(npcId: number): NpcCopy {
    const npc = getNpcDef(npcId);
    return npc ? { name: npc.name, des: npc.des } : { name: `NPC${npcId}`, des: '' };
}
