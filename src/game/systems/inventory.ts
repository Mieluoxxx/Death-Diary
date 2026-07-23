/**
 * Bag weight + equip + dual-storage transfer (P0).
 * Ports Storage/Bag/Equipment + ItemChangeNode.exchange subset.
 */

import {
    BASE_BAG_WEIGHT,
    BIG_BAG_ID,
    BULLET_ID,
    FALCON_ID,
    HAND_ITEM_ID,
    SMALL_BAG_ID,
    getItemDef,
    itemWeight,
    type EquipSlot,
} from '../data/itemConfig';
import {
    getSession,
    mutateSession,
    type ItemCounts,
    type SessionState,
} from '../session/sessionStore';
import { gameBusEmit } from './gameBus';

export type EquipPos = 0 | 1 | 2 | 3;

export const EquipPosMap = {
    GUN: 0 as EquipPos,
    WEAPON: 1 as EquipPos,
    EQUIP: 2 as EquipPos,
    TOOL: 3 as EquipPos,
};

export const SLOT_BY_POS: EquipSlot[] = ['gun', 'weapon', 'equip', 'tool'];
export const POS_BY_SLOT: Record<EquipSlot, EquipPos> = {
    gun: 0,
    weapon: 1,
    equip: 2,
    tool: 3,
};

export type TransferResult =
    | { ok: true }
    | { ok: false; reason: 'no_session' | 'not_enough' | 'overweight' | 'invalid' };

function countsWeight (counts: ItemCounts): number
{
    let total = 0;
    for (const [idText, num] of Object.entries(counts))
    {
        const id = Number(idText);
        if (!Number.isFinite(id) || num <= 0)
        {
            continue;
        }
        total += itemWeight(id) * num;
    }
    return total;
}

/** Capacity bonuses read home warehouse ownership (original Bag.getTotalWeight). */
export function getBagCapacity (session: SessionState = requireSession()): number
{
    let cap = BASE_BAG_WEIGHT;
    if ((session.storage[SMALL_BAG_ID] ?? 0) > 0)
    {
        cap += 10;
    }
    if ((session.storage[BIG_BAG_ID] ?? 0) > 0)
    {
        cap += 25;
    }
    if ((session.storage[FALCON_ID] ?? 0) > 0)
    {
        cap += 15;
    }
    return cap;
}

export function getBagWeight (session: SessionState = requireSession()): number
{
    return countsWeight(session.bag);
}

export function validateBagWeight (
    itemId: number,
    num: number,
    session: SessionState = requireSession(),
): boolean
{
    if (num <= 0)
    {
        return true;
    }
    const next = getBagWeight(session) + itemWeight(itemId) * num;
    return next <= getBagCapacity(session);
}

export function getCount (counts: ItemCounts, itemId: number): number
{
    return counts[itemId] ?? 0;
}

function setCount (counts: ItemCounts, itemId: number, num: number): void
{
    if (num <= 0)
    {
        delete counts[itemId];
    }
    else
    {
        counts[itemId] = num;
    }
}

export function listItems (counts: ItemCounts): Array<{ itemId: number; num: number }>
{
    return Object.entries(counts)
        .map(([id, num]) => ({ itemId: Number(id), num }))
        .filter((row) => Number.isFinite(row.itemId) && row.num > 0)
        .sort((a, b) => a.itemId - b.itemId);
}

function requireSession (): SessionState
{
    const session = getSession();
    if (!session)
    {
        throw new Error('No active session');
    }
    return session;
}

export function getBagCount (itemId: number): number
{
    const session = getSession();
    return session ? getCount(session.bag, itemId) : 0;
}

/**
 * Move items between two containers on the live session.
 * `toKind === 'bag'` enforces weight; home/site/temp do not.
 */
export function transferItems (
    fromKind: 'storage' | 'bag' | 'site' | 'temp',
    toKind: 'storage' | 'bag' | 'site' | 'temp',
    itemId: number,
    num: number,
    siteId?: number,
): TransferResult
{
    if (num <= 0 || fromKind === toKind)
    {
        return { ok: false, reason: 'invalid' };
    }

    const session = getSession();
    if (!session)
    {
        return { ok: false, reason: 'no_session' };
    }

    const from = resolveContainer(session, fromKind, siteId);
    const to = resolveContainer(session, toKind, siteId);
    if (!from || !to)
    {
        return { ok: false, reason: 'invalid' };
    }
    if (getCount(from, itemId) < num)
    {
        return { ok: false, reason: 'not_enough' };
    }
    if (toKind === 'bag' && !validateBagWeight(itemId, num, session))
    {
        return { ok: false, reason: 'overweight' };
    }

    mutateSession((live) =>
    {
        const src = resolveContainer(live, fromKind, siteId)!;
        const dst = resolveContainer(live, toKind, siteId)!;
        setCount(src, itemId, getCount(src, itemId) - num);
        setCount(dst, itemId, getCount(dst, itemId) + num);
        if (fromKind === 'bag')
        {
            maybeUnequipDepleted(live, itemId);
        }
        if (toKind === 'site' || fromKind === 'site')
        {
            const site = live.map.sites[siteId ?? live.nowSiteId ?? -1];
            if (site)
            {
                site.haveNewItems = Object.keys(site.storage).length > 0;
            }
        }
    });
    gameBusEmit('session_updated');
    return { ok: true };
}

function resolveContainer (
    session: SessionState,
    kind: 'storage' | 'bag' | 'site' | 'temp',
    siteId?: number,
): ItemCounts | null
{
    if (kind === 'storage')
    {
        return session.storage;
    }
    if (kind === 'bag')
    {
        return session.bag;
    }
    if (kind === 'temp')
    {
        return session.tempLoot;
    }
    const id = siteId ?? session.nowSiteId;
    if (id == null)
    {
        return null;
    }
    const site = session.map.sites[id];
    return site ? site.storage : null;
}

function maybeUnequipDepleted (session: SessionState, itemId: number): void
{
    if (getCount(session.bag, itemId) > 0)
    {
        return;
    }
    for (const pos of [0, 1, 2, 3] as EquipPos[])
    {
        if (session.equip[pos] === itemId)
        {
            session.equip[pos] = pos === EquipPosMap.WEAPON ? HAND_ITEM_ID : 0;
        }
    }
}

export function equipItem (pos: EquipPos, itemId: number): TransferResult
{
    const session = getSession();
    if (!session)
    {
        return { ok: false, reason: 'no_session' };
    }
    if (itemId === HAND_ITEM_ID)
    {
        mutateSession((live) =>
        {
            live.equip[pos] = HAND_ITEM_ID;
        });
        gameBusEmit('session_updated');
        return { ok: true };
    }
    if (itemId !== 0 && getCount(session.bag, itemId) < 1)
    {
        return { ok: false, reason: 'not_enough' };
    }
    const def = getItemDef(itemId);
    const expected = SLOT_BY_POS[pos];
    if (itemId !== 0 && def.slot && def.slot !== expected)
    {
        return { ok: false, reason: 'invalid' };
    }
    mutateSession((live) =>
    {
        live.equip[pos] = itemId;
    });
    gameBusEmit('session_updated');
    return { ok: true };
}

export function unequipItem (pos: EquipPos): void
{
    mutateSession((live) =>
    {
        live.equip[pos] = pos === EquipPosMap.WEAPON ? HAND_ITEM_ID : 0;
    });
    gameBusEmit('session_updated');
}

export function getEquipped (pos: EquipPos): number
{
    const session = getSession();
    if (!session)
    {
        return pos === EquipPosMap.WEAPON ? HAND_ITEM_ID : 0;
    }
    return session.equip[pos] ?? (pos === EquipPosMap.WEAPON ? HAND_ITEM_ID : 0);
}

export function getArmorDef (session: SessionState = requireSession()): number
{
    const equipId = session.equip[EquipPosMap.EQUIP] ?? 0;
    if (!equipId)
    {
        return 0;
    }
    return getItemDef(equipId).effectArm?.def ?? 0;
}

/** Home return: dump unequipped bag items (except bullets) into warehouse. */
export function flushBagToStorage (): void
{
    mutateSession((session) =>
    {
        const equipped = new Set(
            Object.values(session.equip).filter((id) => id && id !== HAND_ITEM_ID),
        );
        for (const [idText, num] of Object.entries(session.bag))
        {
            const itemId = Number(idText);
            if (!Number.isFinite(itemId) || num <= 0)
            {
                continue;
            }
            if (itemId === BULLET_ID || equipped.has(itemId))
            {
                continue;
            }
            session.storage[itemId] = (session.storage[itemId] ?? 0) + num;
            delete session.bag[itemId];
        }
    });
    gameBusEmit('session_updated');
}

export function transferAll (
    fromKind: 'storage' | 'bag' | 'site' | 'temp',
    toKind: 'storage' | 'bag' | 'site' | 'temp',
    siteId?: number,
): { moved: number; blocked: number }
{
    const session = getSession();
    if (!session)
    {
        return { moved: 0, blocked: 0 };
    }
    const from = resolveContainer(session, fromKind, siteId);
    if (!from)
    {
        return { moved: 0, blocked: 0 };
    }
    let moved = 0;
    let blocked = 0;
    const snapshot = listItems(from);
    for (const row of snapshot)
    {
        for (let i = 0; i < row.num; i++)
        {
            const res = transferItems(fromKind, toKind, row.itemId, 1, siteId);
            if (res.ok)
            {
                moved += 1;
            }
            else
            {
                blocked += 1;
                break;
            }
        }
    }
    return { moved, blocked };
}

export function defaultEquip (): Record<EquipPos, number>
{
    return {
        0: 0,
        1: HAND_ITEM_ID,
        2: 0,
        3: 0,
    };
}
