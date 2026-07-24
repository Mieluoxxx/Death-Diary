/**
 * Port of Buried-City player.useItem / applyEffect / itemEffect / buff apply.
 */

import { itemName } from '../data/buildStrings';
import {
    BANDAGE_ITEM_ID,
    BUFF_EFFECTS,
    DIY_PENICILLIN_ITEM_ID,
    FOOD_EFFECTS,
    isBuffItem,
    isFoodItem,
    isMedicineItem,
    MEDICINE_EFFECTS,
    type AttrChanceMap,
} from '../data/itemEffects';
import {
    appendSessionLog,
    getSession,
    mutateSession,
    type ItemCounts,
    type SessionState,
} from '../session/sessionStore';
import { gameBusEmit } from './gameBus';
import {
    applyBuffItem,
    changeAttr,
    isAttrChangeGood,
    type MutableAttrKey,
} from './playerAttrs';

export type ItemUseSource = 'storage' | 'bag';

export type ItemUseResult =
    | { ok: true; msg: string }
    | { ok: false; msg: string };

const CHANCE_ATTRS = [
    'hp',
    'spirit',
    'starve',
    'vigour',
    'injury',
    'infect',
    'temperature',
] as const satisfies readonly MutableAttrKey[];

function containerOf (session: SessionState, source: ItemUseSource): ItemCounts
{
    return source === 'bag' ? session.bag : session.storage;
}

function takeOne (session: SessionState, source: ItemUseSource, itemId: number): boolean
{
    const bag = containerOf(session, source);
    const have = bag[itemId] ?? 0;
    if (have < 1)
    {
        return false;
    }
    if (have === 1)
    {
        delete bag[itemId];
    }
    else
    {
        bag[itemId] = have - 1;
    }
    return true;
}

function remaining (session: SessionState, source: ItemUseSource, itemId: number): number
{
    return containerOf(session, source)[itemId] ?? 0;
}

/** Apply chance-gated attr deltas. Returns bad (negative for player) effects. */
export function applyChanceEffectMap (
    effect: AttrChanceMap,
): Array<{ key: MutableAttrKey; delta: number }>
{
    const bad: Array<{ key: MutableAttrKey; delta: number }> = [];
    for (const key of CHANCE_ATTRS)
    {
        const raw = effect[key as keyof AttrChanceMap];
        if (typeof raw !== 'number' || raw === 0)
        {
            continue;
        }
        const chanceKey = `${key}_chance` as keyof AttrChanceMap;
        const chanceRaw = effect[chanceKey];
        const chance = typeof chanceRaw === 'number' ? chanceRaw : 1;
        if (Math.random() > chance)
        {
            continue;
        }
        changeAttr(key, raw);
        if (!isAttrChangeGood(key, raw))
        {
            bad.push({ key, delta: raw });
        }
    }
    return bad;
}

function logBadEffects (
    itemId: number,
    bad: Array<{ key: MutableAttrKey; delta: number }>,
): void
{
    if (bad.length === 0)
    {
        return;
    }
    const parts = bad.map((row) => `${row.key}:${row.delta}`).join(' ');
    appendSessionLog(`食用${itemName(itemId)}产生了副作用：${parts}`);
}

/**
 * Homemade penicillin: 40% chance to only deal hp damage and skip cure.
 * Original item1104032Effect.
 */
function applyDiyPenicillin (effect: AttrChanceMap): boolean
{
    const hpChance = effect.hp_chance ?? 0;
    if (Math.random() <= hpChance && effect.hp !== undefined)
    {
        changeAttr('hp', effect.hp);
        return false;
    }
    const cleaned: AttrChanceMap = { ...effect };
    delete cleaned.hp;
    delete cleaned.hp_chance;
    applyChanceEffectMap(cleaned);
    return true;
}

export function useItem (
    itemId: number,
    source: ItemUseSource = 'storage',
): ItemUseResult
{
    const session = getSession();
    if (!session || session.isDead)
    {
        return { ok: false, msg: '无法使用' };
    }
    if ((containerOf(session, source)[itemId] ?? 0) < 1)
    {
        return { ok: false, msg: '数量不足' };
    }

    const title = itemName(itemId);

    if (isFoodItem(itemId))
    {
        if (session.attrs.starve >= 100)
        {
            return { ok: false, msg: '你已经吃饱了' };
        }
        const effect = FOOD_EFFECTS[itemId];
        if (!effect)
        {
            return { ok: false, msg: '无法使用' };
        }
        mutateSession((live) =>
        {
            takeOne(live, source, itemId);
        });
        const left = remaining(getSession()!, source, itemId);
        appendSessionLog(`你吃了${title}（剩余${left}）`);
        const bad = applyChanceEffectMap(effect);
        logBadEffects(itemId, bad);
        gameBusEmit('session_updated');
        return { ok: true, msg: `吃了${title}` };
    }

    if (isMedicineItem(itemId))
    {
        const effect = MEDICINE_EFFECTS[itemId];
        if (!effect)
        {
            return { ok: false, msg: '无法使用' };
        }
        mutateSession((live) =>
        {
            takeOne(live, source, itemId);
        });
        const left = remaining(getSession()!, source, itemId);
        const now = getSession()!.gameTime;

        if (itemId === BANDAGE_ITEM_ID)
        {
            appendSessionLog(`你使用了${title}（剩余${left}）`);
            applyChanceEffectMap(effect);
            mutateSession((live) =>
            {
                live.binded = true;
                live.bindTime = now;
            });
            gameBusEmit('session_updated');
            return { ok: true, msg: `使用了${title}` };
        }

        appendSessionLog(`你服用了${title}（剩余${left}）`);
        let cured = true;
        if (itemId === DIY_PENICILLIN_ITEM_ID)
        {
            cured = applyDiyPenicillin(effect);
        }
        else
        {
            applyChanceEffectMap(effect);
        }
        if (cured)
        {
            mutateSession((live) =>
            {
                live.cured = true;
                live.cureTime = now;
            });
        }
        gameBusEmit('session_updated');
        return { ok: true, msg: `使用了${title}` };
    }

    if (isBuffItem(itemId))
    {
        const buff = BUFF_EFFECTS[itemId];
        if (!buff)
        {
            return { ok: false, msg: '无法使用' };
        }
        mutateSession((live) =>
        {
            takeOne(live, source, itemId);
        });
        const left = remaining(getSession()!, source, itemId);
        appendSessionLog(`你使用了${title}（剩余${left}）`);
        applyBuffItem(itemId);
        gameBusEmit('session_updated');
        return { ok: true, msg: `使用了${title}` };
    }

    return { ok: false, msg: '该物品无法直接使用' };
}
