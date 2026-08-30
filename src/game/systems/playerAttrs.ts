/**
 * Port of Buried-City player.changeAttr + band lookups + buff immunity.
 */

import {
    BUFF_EFFECTS,
    INFECT_IMMUNE_BUFF_ITEM_ID,
    MAX_HP_BUFF_ITEM_ID,
    STARVE_IMMUNE_BUFF_ITEM_ID,
    VIGOUR_IMMUNE_BUFF_ITEM_ID,
} from '../data/itemEffects';
import { type AttrBand, findAttrBand } from '../data/playerAttrEffect';
import {
    appendSessionLog,
    formatClock,
    getSession,
    type PlayerAttrs,
    type SessionState,
} from '../session/sessionStore';
import { playEffect, Sound } from './audioManager';
import { gameBusEmit } from './gameBus';

export type MutableAttrKey = keyof PlayerAttrs | 'temperature';

/** Base max before injury/buff (original hpMaxOrigin default 240). */
export const HP_MAX_ORIGIN_BASE = 240;

const ATTR_MAX: Record<keyof PlayerAttrs, number> = {
    hp: 240,
    hpMax: 240,
    hpMaxOrigin: 240,
    injury: 100,
    infect: 100,
    starve: 100,
    vigour: 100,
    spirit: 100,
};

/** Whether a delta is "good" for the player (for future buffs / SFX). */
export function isAttrChangeGood(key: MutableAttrKey, delta: number): boolean {
    if (key === 'injury' || key === 'infect') {
        return delta < 0;
    }
    return delta >= 0;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function getAttrValue(session: SessionState, key: MutableAttrKey): number {
    if (key === 'temperature') {
        return session.temperature;
    }
    return session.attrs[key];
}

function setAttrValue(session: SessionState, key: MutableAttrKey, value: number): void {
    if (key === 'temperature') {
        session.temperature = value;
        return;
    }
    session.attrs[key] = value;
}

function maxFor(session: SessionState, key: MutableAttrKey): number {
    if (key === 'temperature') {
        return 100;
    }
    if (key === 'hp') {
        return Math.max(1, session.attrs.hpMax);
    }
    if (key === 'hpMax') {
        return ATTR_MAX.hpMax + 200;
    }
    return ATTR_MAX[key];
}

export function isBuffActive(itemId: number, session: SessionState = getSession()!): boolean {
    if (!session?.buff) {
        return false;
    }
    return session.buff.itemId === itemId && session.buff.remainingSeconds > 0;
}

export function getBuffHpBonus(session: SessionState = getSession()!): number {
    if (!session?.buff || session.buff.itemId !== MAX_HP_BUFF_ITEM_ID) {
        return 0;
    }
    if (session.buff.remainingSeconds <= 0) {
        return 0;
    }
    return session.buff.value;
}

/** Original: hpMax = origin + buff - injury. */
export function recomputeHpMax(session: SessionState): void {
    const origin = session.attrs.hpMaxOrigin ?? HP_MAX_ORIGIN_BASE;
    const nextMax = Math.max(
        1,
        origin + getBuffHpBonus(session) - Math.floor(session.attrs.injury),
    );
    session.attrs.hpMax = nextMax;
    if (session.attrs.hp > nextMax) {
        session.attrs.hp = nextMax;
    }
}

export function getAttrBand(key: string, value: number): AttrBand | null {
    return findAttrBand(key, value);
}

/**
 * Original player.isLowVigour: vigour band id===1 (≤25) and no 1107032 buff.
 */
export function isLowVigour(session: SessionState | null = getSession()): boolean {
    if (!session) {
        return true;
    }
    if (isBuffActive(VIGOUR_IMMUNE_BUFF_ITEM_ID, session)) {
        return false;
    }
    const band = findAttrBand('vigour', session.attrs.vigour);
    return band?.id === 1;
}

/** Original player.vigourEffect: low vigour → 2 (slower), else 1. */
export function vigourEffect(session: SessionState | null = getSession()): number {
    return isLowVigour(session) ? 2 : 1;
}

/**
 * Change an attribute, clamp, emit bus events, log band crosses, handle death.
 * Mutates the live session in place (caller should already hold it, or we fetch).
 */
export function changeAttr(key: MutableAttrKey, delta: number): number {
    const session = getSession();
    if (!session || session.isDead || delta === 0) {
        return 0;
    }

    // hpMax is derived; do not change via generic path.
    if (key === 'hpMax' || key === 'hpMaxOrigin') {
        return 0;
    }

    // Buff immunity against adverse changes (original changeAttr gates).
    if (!isAttrChangeGood(key, delta)) {
        if (key === 'infect' && isBuffActive(INFECT_IMMUNE_BUFF_ITEM_ID, session)) {
            return 0;
        }
        if (key === 'starve' && isBuffActive(STARVE_IMMUNE_BUFF_ITEM_ID, session)) {
            return 0;
        }
        if (key === 'vigour' && isBuffActive(VIGOUR_IMMUNE_BUFF_ITEM_ID, session)) {
            return 0;
        }
    }

    const before = getAttrValue(session, key);
    const beforeBand = getAttrBand(key, before);
    const max = maxFor(session, key);
    const after = clamp(before + delta, 0, max);
    const applied = after - before;
    if (applied === 0) {
        return 0;
    }

    setAttrValue(session, key, after);
    const afterBand = getAttrBand(key, after);

    if (key === 'temperature') {
        gameBusEmit('temperature_change', applied);
    } else {
        const eventKey = `${key}_change` as
            | 'hp_change'
            | 'spirit_change'
            | 'starve_change'
            | 'vigour_change'
            | 'injury_change'
            | 'infect_change';
        if (
            eventKey === 'hp_change' ||
            eventKey === 'spirit_change' ||
            eventKey === 'starve_change' ||
            eventKey === 'vigour_change' ||
            eventKey === 'injury_change' ||
            eventKey === 'infect_change'
        ) {
            gameBusEmit(eventKey, applied);
        }
    }
    gameBusEmit('attr_change', { key, delta: applied, value: after });

    if (beforeBand && afterBand && beforeBand.id !== afterBand.id) {
        const direction = afterBand.id > beforeBand.id ? '上升' : '下降';
        const label = attrDisplayName(key);
        // Original player.changeAttr band cross → GOOD/BAD_EFFECT (injury/infect inverted).
        const bandImproved = afterBand.id > beforeBand.id;
        const good = key === 'infect' || key === 'injury' ? !bandImproved : bandImproved;
        playEffect(good ? Sound.GOOD_EFFECT : Sound.BAD_EFFECT);
        appendSessionLog(
            `${label}${direction}（${bandHint(key, afterBand.id)}）`,
            `第${session.day}天 ${formatClock(session)}`,
        );
        gameBusEmit('logChanged', {
            text: session.lastLog,
            timeLabel: session.logs[session.logs.length - 1]?.timeLabel ?? '',
        });
    }

    if (key === 'injury') {
        recomputeHpMax(session);
    }

    if (key === 'hp' && session.attrs.hp <= 0) {
        markPlayerDead(session);
    }

    gameBusEmit('session_updated');
    return applied;
}

function markPlayerDead(session: SessionState): void {
    if (session.isDead) {
        return;
    }
    session.isDead = true;
    session.isInSleep = false;
    appendSessionLog('你死了。', `第${session.day}天 ${formatClock(session)}`);
    gameBusEmit('logChanged', {
        text: session.lastLog,
        timeLabel: session.logs[session.logs.length - 1]?.timeLabel ?? '',
    });
    gameBusEmit('player_died');
}

function attrDisplayName(key: MutableAttrKey): string {
    switch (key) {
        case 'hp':
            return '生命';
        case 'spirit':
            return '心情';
        case 'starve':
            return '饱食';
        case 'vigour':
            return '精力';
        case 'injury':
            return '外伤';
        case 'infect':
            return '感染';
        case 'temperature':
            return '体温';
        case 'hpMax':
            return '生命上限';
        case 'hpMaxOrigin':
            return '生命上限基线';
        default:
            return key;
    }
}

function bandHint(key: MutableAttrKey, bandId: number): string {
    if (key === 'starve' || key === 'vigour' || key === 'spirit' || key === 'hp') {
        return ['危急', '偏低', '尚可', '良好'][Math.min(3, Math.max(0, bandId - 1))] ?? '';
    }
    if (key === 'injury' || key === 'infect') {
        return ['无', '轻', '中', '重', '危'][Math.min(4, Math.max(0, bandId - 1))] ?? '';
    }
    return `档${bandId}`;
}

export function changeHp(delta: number): number {
    return changeAttr('hp', delta);
}

export function changeStarve(delta: number): number {
    return changeAttr('starve', delta);
}

export function changeVigour(delta: number): number {
    return changeAttr('vigour', delta);
}

export function changeSpirit(delta: number): number {
    return changeAttr('spirit', delta);
}

/** Apply / replace active buff (one at a time, original BuffManager). */
export function applyBuffItem(itemId: number): boolean {
    const session = getSession();
    const cfg = BUFF_EFFECTS[itemId];
    if (!session || !cfg) {
        return false;
    }
    // End previous buff first (MaxHpBuff onEnd).
    session.buff = null;
    recomputeHpMax(session);

    session.buff = {
        itemId,
        remainingSeconds: cfg.lastTime * 60 * 60,
        value: cfg.value,
    };
    recomputeHpMax(session);
    // Serum also tops current hp toward new max? Original only updates max; leave hp.
    return true;
}

/** Tick buff duration by game seconds; clear when expired. */
export function tickBuff(gameSeconds: number, session: SessionState = getSession()!): void {
    if (!session?.buff) {
        return;
    }
    session.buff.remainingSeconds -= gameSeconds;
    if (session.buff.remainingSeconds <= 0) {
        session.buff = null;
        recomputeHpMax(session);
    }
}

export function isInCure(session: SessionState = getSession()!): boolean {
    return Boolean(session?.cured);
}

export function isInBind(session: SessionState = getSession()!): boolean {
    return Boolean(session?.binded);
}
